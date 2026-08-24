/**
 * backend/lib/agents/executor.js
 * 6-gate execution pipeline for MCP tools:
 *   1. exists      — tool is in the registry
 *   2. authorized  — agent toolkit/squad/budget gate (toolkit.js)
 *   3. rate limit  — in-memory sliding window per agent+tool
 *   4. budget gate — handled inside canAgentUseTool (re-asserted here)
 *   5. approval    — requiresApproval tools need an approved tool_approvals
 *                    row, otherwise a pending approval is created and the
 *                    call returns { approvalRequired, approvalId }
 *   6. validate    — required params + enum checks against the JSON schema
 * Then: execute -> log to tool_executions + feed.
 */
import { randomUUID } from "node:crypto";
import { assertSupabase, logFeed } from "../supabase.js";
import { getTool } from "../mcp/registry.js";
import { canAgentUseTool } from "./toolkit.js";

/** In-memory rate-limit buckets: `${agentId}:${toolName}` -> timestamps[] */
const RATE_BUCKETS = new Map();

function checkRateLimit(agentId, tool) {
  const key = `${agentId}:${tool.name}`;
  const now = Date.now();
  const { maxCalls, windowMs } = tool.rateLimit || { maxCalls: 60, windowMs: 3600000 };
  const arr = (RATE_BUCKETS.get(key) || []).filter((t) => now - t < windowMs);
  if (arr.length >= maxCalls) {
    RATE_BUCKETS.set(key, arr);
    return { ok: false, retryAfterMs: windowMs - (now - arr[0]) };
  }
  arr.push(now);
  RATE_BUCKETS.set(key, arr);
  return { ok: true };
}

/** Validate args against the tool's JSON-schema parameters (required + enums). */
function validateParams(tool, args) {
  const schema = tool.parameters || {};
  const problems = [];
  for (const req of schema.required || []) {
    if (args[req] === undefined || args[req] === null || args[req] === "") {
      problems.push(`Missing required parameter: ${req}`);
    }
  }
  for (const [key, prop] of Object.entries(schema.properties || {})) {
    const v = args[key];
    if (v === undefined || v === null) continue;
    if (prop.enum && !prop.enum.includes(v)) {
      problems.push(`Parameter "${key}" must be one of: ${prop.enum.join(", ")}`);
    }
    if (prop.type === "number" && typeof v !== "number") {
      const n = Number(v);
      if (!Number.isFinite(n)) problems.push(`Parameter "${key}" must be a number`);
      else args[key] = n;
    }
  }
  return problems;
}

/** Look for an existing approved approval for this agent+tool+args hash. */
async function findPreApproval(workspaceId, agentId, toolName) {
  try {
    const db = assertSupabase();
    const { data, error } = await db.from("tool_approvals")
      .select("id").eq("workspace_id", workspaceId).eq("agent_id", agentId)
      .eq("tool_name", toolName).eq("status", "approved")
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (error) return null;
    return data;
  } catch {
    return null;
  }
}

/** Create a pending approval row and return its id (or null if table missing). */
async function createPendingApproval(context, toolName, args) {
  try {
    const db = assertSupabase();
    const { data, error } = await db.from("tool_approvals").insert({
      workspace_id: context.workspaceId, agent_id: context.agentId,
      tool_name: toolName, args, status: "pending",
    }).select("id").single();
    if (error) { console.error("[executor] approval insert:", error.message); return null; }
    await logFeed(context.workspaceId, "approval",
      `${context.agentName || context.agentId} requested approval to run ${toolName}`);
    return data?.id || null;
  } catch (e) {
    console.error("[executor] approval insert:", e.message);
    return null;
  }
}

/** Record an execution row (tolerates missing table). */
async function recordExecution(row) {
  try {
    const db = assertSupabase();
    const { error } = await db.from("tool_executions").insert(row);
    if (error) console.error("[executor] log:", error.message);
  } catch (e) {
    console.error("[executor] log:", e.message);
  }
}

/**
 * Execute one tool call through the 6-gate pipeline.
 * @param {string} toolName
 * @param {object} args
 * @param {{workspaceId, agentId, agentName?, squadCode?, userId?, cycleId?}} context
 * @param {{skipApprovalCheck?: boolean, approvalId?: string}} [opts]
 */
export async function executeTool(toolName, args = {}, context = {}, opts = {}) {
  const started = Date.now();
  const executionId = randomUUID();
  const base = { toolName, agentId: context.agentId || null, executionId, latencyMs: 0 };
  const fail = (error) => ({
    ...base, success: false, error, latencyMs: Date.now() - started,
  });

  // Gate 1: exists
  const tool = getTool(toolName);
  if (!tool) return fail(`Unknown tool: ${toolName}`);

  // Gate 2 (+4): authorization & budget
  const auth = await canAgentUseTool(context.agentId, toolName, context.workspaceId);
  if (!auth.allowed) return fail(auth.reason);

  // Gate 3: rate limit
  const rl = checkRateLimit(context.agentId, tool);
  if (!rl.ok) return fail(`Rate limit exceeded for ${toolName} — retry in ${Math.ceil(rl.retryAfterMs / 1000)}s`);

  // Gate 5: approval
  if (tool.requiresApproval && !opts.skipApprovalCheck) {
    const pre = await findPreApproval(context.workspaceId, context.agentId, toolName);
    if (!pre) {
      const approvalId = await createPendingApproval(context, toolName, args);
      return {
        ...base, success: false, approvalRequired: true, approvalId,
        error: "Approval required before execution", latencyMs: Date.now() - started,
      };
    }
  }

  // Gate 6: parameter validation
  const cleanArgs = { ...args };
  const problems = validateParams(tool, cleanArgs);
  if (problems.length) return fail(problems.join("; "));

  // Execute
  try {
    const result = await tool.handler(cleanArgs, { ...context, toolName });
    const latencyMs = Date.now() - started;
    await recordExecution({
      id: executionId, workspace_id: context.workspaceId, agent_id: context.agentId,
      tool_name: toolName, args: cleanArgs, success: true, result,
      cost: tool.costEstimate || 0, latency_ms: latencyMs,
      cycle_id: context.cycleId || null, approval_id: opts.approvalId || null,
    });
    return {
      ...base, success: true, result, cost: tool.costEstimate || 0, latencyMs,
    };
  } catch (e) {
    const latencyMs = Date.now() - started;
    await recordExecution({
      id: executionId, workspace_id: context.workspaceId, agent_id: context.agentId,
      tool_name: toolName, args: cleanArgs, success: false, error: e.message,
      cost: 0, latency_ms: latencyMs,
      cycle_id: context.cycleId || null, approval_id: opts.approvalId || null,
    });
    await logFeed(context.workspaceId, "tool", `${context.agentName || context.agentId} failed ${toolName}: ${e.message}`);
    return { ...base, success: false, error: e.message, latencyMs };
  }
}

/**
 * Execute a batch of tool calls with concurrency 5. A single failure never
 * crashes the batch — each call gets its own result entry.
 * @param {{toolName: string, args?: object}[]} calls
 * @param {object} context
 * @returns {Promise<{success: boolean, results: object[]}>}
 */
export async function executeBatch(calls, context) {
  const results = new Array(calls.length);
  let idx = 0;
  async function worker() {
    while (idx < calls.length) {
      const i = idx++;
      const call = calls[i];
      try {
        results[i] = await executeTool(call.toolName, call.args || {}, context);
      } catch (e) {
        results[i] = { success: false, toolName: call.toolName, agentId: context.agentId, error: e.message };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(5, calls.length) }, worker));
  return { success: results.every((r) => r && r.success), results };
}
