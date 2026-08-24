/**
 * api/mcp/executions.js
 * GET — the latest 50 tool executions for the caller's workspace,
 * newest first. Auth: JWT cookie (same pattern as api/mcp/approve.js).
 * Graceful by design: any backend/table problem returns
 * { ok:false, error } with HTTP 200 — never a bare 500 — so the
 * Execution Log UI can show an honest-limits note instead of crashing.
 */
import { requireAuth } from "../../backend/lib/auth.js";
import { supabase } from "../../backend/lib/supabase.js";

export default async function handler(req, res) {
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
