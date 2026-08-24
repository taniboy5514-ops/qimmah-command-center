/**
 * api/agents/execute-tool.js
 * POST { toolName, args, agentId, cycleId? } — run one MCP tool through the
 * 6-gate executor for an agent in the caller's workspace.
 * Auth: qimmah_session JWT cookie (backend/lib/auth.js).
 */
import { requireAuth } from "../../backend/lib/auth.js";
import { assertSupabase } from "../../backend/lib/supabase.js";
import { executeTool } from "../../backend/lib/agents/executor.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const session = requireAuth(req, res);
  if (!session) return;

  const { toolName, args, agentId, cycleId } = req.body || {};
  if (!toolName || typeof toolName !== "string") return res.status(400).json({ error: "toolName is required" });
  if (!agentId || typeof agentId !== "string") return res.status(400).json({ error: "agentId is required" });
  if (args !== undefined && (typeof args !== "object" || args === null || Array.isArray(args))) {
    return res.status(400).json({ error: "args must be an object" });
  }

  try {
    const db = assertSupabase();
    const { data: agent, error } = await db.from("agents")
      .select("id, code, name, squad, active")
      .eq("id", agentId).eq("workspace_id", session.workspaceId).maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    if (!agent) return res.status(403).json({ error: "Agent not found in this workspace" });

    const context = {
      workspaceId: session.workspaceId,
      agentId: agent.id,
      agentName: `${agent.code} (${agent.name})`,
      squadCode: agent.squad,
      userId: session.userId,
      cycleId: cycleId || null,
    };

    const result = await executeTool(toolName, args || {}, context);
    const status = result.success ? 200 : result.approvalRequired ? 202 : 422;
    return res.status(status).json(result);
  } catch (e) {
    console.error("[agents/execute-tool]", e);
    return res.status(500).json({ error: e.message || "Internal server error" });
  }
}
