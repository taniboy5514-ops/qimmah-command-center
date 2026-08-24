/**
 * api/mcp/approve.js
 * POST { approvalId, decision: "approve" | "reject", reason? }
 * Approves or rejects a pending tool approval. On approve, the tool is
 * executed immediately (approval gate pre-satisfied). Auth: JWT cookie.
 */
import { requireAuth } from "../../backend/lib/auth.js";
import { assertSupabase, logFeed } from "../../backend/lib/supabase.js";
import { executeTool } from "../../backend/lib/agents/executor.js";

export default async function handler(req, res) {
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
    }

    return res.status(200).json({ decision, executed, ...(result ? { result } : {}) });
  } catch (e) {
    console.error("[mcp/approve]", e);
    return res.status(500).json({ error: e.message || "Internal server error" });
  }
}
