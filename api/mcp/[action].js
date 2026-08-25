/**
 * api/mcp/[action].js
 * Vercel dynamic-segment consolidation of:
 *   /api/mcp/approve    -> approveHandler
 *   /api/mcp/discover   -> discoverHandler
 *   /api/mcp/executions -> executionsHandler
 * Public URL paths are unchanged; req.query.action selects the handler.
 * Handler logic is preserved verbatim from the original route files.
 */

/**
 * api/mcp/approve.js
 * POST { approvalId, decision: "approve" | "reject", reason? }
 * Approves or rejects a pending tool approval. On approve, the tool is
 * executed immediately (approval gate pre-satisfied). Auth: JWT cookie.
 */
import { requireAuth } from "../../backend/lib/auth.js";
import { assertSupabase, supabase, logFeed } from "../../backend/lib/supabase.js";
import { executeTool } from "../../backend/lib/agents/executor.js";
import { MCP_REGISTRY } from "../../backend/lib/mcp/registry.js";

async function approveHandler(req, res) {
  // GET — list pending approvals for the caller's workspace.
  if (req.method === "GET") {
    const session = requireAuth(req, res);
    if (!session) return;
    try {
      const db = assertSupabase();
      const { data, error } = await db.from("tool_approvals")
        .select("id, agent_id, tool_name, args, created_at")
        .eq("workspace_id", session.workspaceId).eq("status", "pending")
        .order("created_at", { ascending: false }).limit(50);
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ approvals: data || [] });
    } catch (e) {
      console.error("[mcp/approve GET]", e);
      return res.status(500).json({ error: e.message || "Internal server error" });
    }
  }

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const session = requireAuth(req, res);
  if (!session) return;

  const { approvalId, decision, reason } = req.body || {};
  if (!approvalId) return res.status(400).json({ error: "approvalId is required" });
  if (decision !== "approve" && decision !== "reject") {
    return res.status(400).json({ error: "decision must be 'approve' or 'reject'" });
  }

  try {
    const db = assertSupabase();
    const { data: approval, error } = await db.from("tool_approvals")
      .select("*").eq("id", approvalId).eq("workspace_id", session.workspaceId).maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    if (!approval) return res.status(404).json({ error: "Approval not found" });
    if (approval.status !== "pending") {
      return res.status(409).json({ error: `Approval already ${approval.status}` });
    }

    const status = decision === "approve" ? "approved" : "rejected";
    const { error: upErr } = await db.from("tool_approvals").update({
      status, decided_by: session.userId, reason: reason || null, decided_at: new Date().toISOString(),
    }).eq("id", approvalId);
    if (upErr) return res.status(500).json({ error: upErr.message });

    await logFeed(session.workspaceId, "approval",
      `Tool approval ${status}: ${approval.tool_name} for agent ${approval.agent_id}${reason ? " — " + reason : ""}`);

    let result = null;
    let executed = false;
    if (decision === "approve") {
      const { data: agent } = await db.from("agents")
        .select("id, code, name, squad").eq("id", approval.agent_id).maybeSingle();
      const context = {
        workspaceId: session.workspaceId,
        agentId: approval.agent_id,
        agentName: agent ? `${agent.code} (${agent.name})` : String(approval.agent_id),
        squadCode: agent?.squad || null,
        userId: session.userId,
      };
      result = await executeTool(approval.tool_name, approval.args || {}, context,
        { skipApprovalCheck: true, approvalId });
      executed = result.success;
      if (executed) {
        // Single-use: consume the approval row so it cannot unlock a replay
        // of the same tool call from the executor's pre-approval check.
        await db.from("tool_approvals").delete().eq("id", approvalId);
      }
    }

    return res.status(200).json({ decision, executed, ...(result ? { result } : {}) });
  } catch (e) {
    console.error("[mcp/approve]", e);
    return res.status(500).json({ error: e.message || "Internal server error" });
  }
}

/**
 * api/mcp/discover.js
 * GET — MCP discovery endpoint.
 *   Without x-api-key: public tool list (name, description, requiresApproval).
 *   With x-api-key === process.env.MCP_API_KEY: full JSON schemas + metadata.
 */
async function discoverHandler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const key = req.headers["x-api-key"];
  const authenticated = Boolean(process.env.MCP_API_KEY && key && key === process.env.MCP_API_KEY);

  const tools = MCP_REGISTRY.map((t) => {
    const pub = {
      name: t.name,
      description: t.description,
      requiresApproval: t.requiresApproval,
    };
    if (authenticated) {
      pub.squadAccess = t.squadAccess;
      pub.costEstimate = t.costEstimate;
      pub.rateLimit = t.rateLimit;
      pub.parameters = t.parameters;
    }
    return pub;
  });

  return res.status(200).json({
    name: "Qimmah Digital Command Center",
    version: "1.0.0",
    protocol: "mcp-v1",
    authenticated,
    tools,
    endpoints: {
      execute: "/api/agents/execute-tool",
      approve: "/api/mcp/approve",
      discover: "/api/mcp/discover",
    },
  });
}

/**
 * api/mcp/executions.js
 * GET — the latest 50 tool executions for the caller's workspace,
 * newest first. Auth: JWT cookie (same pattern as api/mcp/approve.js).
 * Graceful by design: any backend/table problem returns
 * { ok:false, error } with HTTP 200 — never a bare 500 — so the
 * Execution Log UI can show an honest-limits note instead of crashing.
 */
async function executionsHandler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const session = requireAuth(req, res);
  if (!session) return;
  try {
    if (!supabase) {
      return res.status(200).json({ ok: false, error: "Supabase is not configured — the execution log needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on the server." });
    }
    const { data, error } = await supabase.from("tool_executions")
      .select("id, agent_id, tool_name, args, success, error, cost, latency_ms, created_at")
      .eq("workspace_id", session.workspaceId)
      .order("created_at", { ascending: false }).limit(50);
    if (error) return res.status(200).json({ ok: false, error: error.message });
    return res.status(200).json({ ok: true, executions: data || [] });
  } catch (e) {
    console.error("[mcp/executions]", e);
    return res.status(200).json({ ok: false, error: e.message || "Internal server error" });
  }
}

export default async function handler(req, res) {
  const action = Array.isArray(req.query.action) ? req.query.action[0] : req.query.action;
  switch (action) {
    case "approve":
      return approveHandler(req, res);
    case "discover":
      return discoverHandler(req, res);
    case "executions":
      return executionsHandler(req, res);
    default:
      return res.status(404).json({ error: "Not found" });
  }
}
