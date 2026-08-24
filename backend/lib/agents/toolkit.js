/**
 * backend/lib/agents/toolkit.js
 * Per-agent toolkit resolution on top of the MCP registry.
 *
 * Toolkit sources, in order:
 *   1. Squad defaults (SQUAD_DEFAULT_TOOLS)
 *   2. agent_toolkits table overrides (granted: true adds, false revokes)
 * Budgets (SQUAD_BUDGETS) cap daily estimated spend per agent; at >=80%
 * of the daily budget, high-cost tools (costEstimate >= 0.002) are blocked.
 */
import { assertSupabase, logFeed } from "../supabase.js";
import { MCP_REGISTRY, getTool } from "../mcp/registry.js";

export const SQUAD_DEFAULT_TOOLS = {
  Alpha:   ["create_lead", "update_lead_status", "create_task", "complete_task", "send_whatsapp_message", "send_instagram_dm"],
  Beta:    ["create_task", "complete_task", "web_search", "study_topic", "create_lead"],
  Gamma:   ["create_task", "complete_task", "web_search", "study_topic", "query_analytics", "test_connector", "create_lead"],
  Delta:   ["create_task", "complete_task", "web_search", "study_topic", "query_analytics", "test_connector", "record_transaction", "create_invoice", "self_edit_code", "create_lead"],
  Epsilon: ["create_task", "complete_task", "create_lead", "update_lead_status", "send_whatsapp_message", "record_transaction", "create_invoice"],
};

/** Daily estimated-cost budget per agent (USD), by squad. */
export const SQUAD_BUDGETS = {
  Alpha:   { daily: 0.50 },
  Beta:    { daily: 0.30 },
  Gamma:   { daily: 0.40 },
  Delta:   { daily: 0.60 },
  Epsilon: { daily: 0.40 },
};

/** High-cost threshold used by the 80% budget gate. */
const HIGH_COST = 0.002;

/** Fetch an agent row by id within a workspace. */
async function getAgent(agentId, workspaceId) {
  const db = assertSupabase();
  const q = db.from("agents").select("id, code, name, squad, active").eq("id", agentId);
  if (workspaceId) q.eq("workspace_id", workspaceId);
  const { data, error } = await q.maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

/** Sum today's tool_executions cost for an agent (tolerates missing table). */
async function todayUsage(agentId) {
  try {
    const db = assertSupabase();
    const since = new Date(); since.setUTCHours(0, 0, 0, 0);
    const { data, error } = await db.from("tool_executions")
      .select("cost").eq("agent_id", agentId)
      .eq("success", true).gte("created_at", since.toISOString());
    if (error) return { spent: 0, calls: 0 };
    const rows = data || [];
    return { spent: rows.reduce((s, r) => s + Number(r.cost || 0), 0), calls: rows.length };
  } catch {
    return { spent: 0, calls: 0 };
  }
}

/** agent_toolkits overrides for an agent (tolerates missing table). */
async function getOverrides(agentId) {
  try {
    const db = assertSupabase();
    const { data, error } = await db.from("agent_toolkits").select("tool_name, granted").eq("agent_id", agentId);
    if (error) return [];
    return data || [];
  } catch {
    return [];
  }
}

/**
 * Resolve the full toolkit for an agent.
 * @returns {Promise<{agent: object, tools: string[], squadDefaults: string[],
 *   overrides: object[], budget: {daily: number, spentToday: number, callsToday: number}}>}
 */
export async function buildAgentToolkit(agentId, workspaceId) {
  const agent = await getAgent(agentId, workspaceId);
  if (!agent) throw new Error("Agent not found");
  const squadDefaults = [...(SQUAD_DEFAULT_TOOLS[agent.squad] || [])];
  const overrides = await getOverrides(agentId);
  const set = new Set(squadDefaults);
  for (const o of overrides) {
    if (o.granted) set.add(o.tool_name); else set.delete(o.tool_name);
  }
  const tools = [...set].filter((n) => getTool(n));
  const usage = await todayUsage(agentId);
  const budget = SQUAD_BUDGETS[agent.squad] || { daily: 0.30 };
  return {
    agent, tools, squadDefaults, overrides,
    budget: { daily: budget.daily, spentToday: usage.spent, callsToday: usage.calls },
  };
}

/**
 * Can this agent use this tool right now?
 * Checks: tool exists in registry, toolkit membership, squad access, and the
 * budget gate (>=80% of daily budget blocks high-cost tools).
 * @returns {Promise<{allowed: boolean, reason?: string}>}
 */
export async function canAgentUseTool(agentId, toolName, workspaceId) {
  const tool = getTool(toolName);
  if (!tool) return { allowed: false, reason: `Unknown tool: ${toolName}` };
  const tk = await buildAgentToolkit(agentId, workspaceId);
  if (!tk.agent.active) return { allowed: false, reason: "Agent is deactivated" };
  if (!tool.squadAccess.includes(tk.agent.squad)) {
    return { allowed: false, reason: `Tool not available to Squad ${tk.agent.squad}` };
  }
  if (!tk.tools.includes(toolName)) {
    return { allowed: false, reason: "Tool not in agent toolkit" };
  }
  const used = tk.budget.spentToday / tk.budget.daily;
  if (used >= 0.8 && (tool.costEstimate || 0) >= HIGH_COST) {
    return { allowed: false, reason: `Budget gate: ${(used * 100).toFixed(0)}% of daily budget used — high-cost tools blocked` };
  }
  return { allowed: true, toolkit: tk };
}

/** Grant a tool to an agent (upsert override), logging to the feed. */
export async function grantTool(agentId, toolName, workspaceId) {
  if (!getTool(toolName)) throw new Error(`Unknown tool: ${toolName}`);
  const db = assertSupabase();
  const { error } = await db.from("agent_toolkits")
    .upsert({ agent_id: agentId, tool_name: toolName, granted: true }, { onConflict: "agent_id,tool_name" });
  if (error) throw new Error(error.message);
  const agent = await getAgent(agentId, workspaceId);
  await logFeed(workspaceId || agent?.workspace_id, "tool", `Tool granted: ${toolName} → ${agent?.code || agentId} (${agent?.name || "agent"})`);
  return { agentId, toolName, granted: true };
}

/** Revoke a tool from an agent (upsert override), logging to the feed. */
export async function revokeTool(agentId, toolName, workspaceId) {
  const db = assertSupabase();
  const { error } = await db.from("agent_toolkits")
    .upsert({ agent_id: agentId, tool_name: toolName, granted: false }, { onConflict: "agent_id,tool_name" });
  if (error) throw new Error(error.message);
  const agent = await getAgent(agentId, workspaceId);
  await logFeed(workspaceId || agent?.workspace_id, "tool", `Tool revoked: ${toolName} ← ${agent?.code || agentId} (${agent?.name || "agent"})`);
  return { agentId, toolName, granted: false };
}
