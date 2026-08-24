/**
 * api/ceo/goals/execute.js
 * POST { goalId } — manual trigger: advance one goal now (processGoal).
 * Auth: JWT cookie (qimmah_session); goal must belong to the caller's
 * workspace.
 */
import { requireAuth } from "../../../backend/lib/auth.js";
import { assertSupabase } from "../../../backend/lib/supabase.js";
import { processGoal } from "../../../backend/lib/ceo/goals.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const session = requireAuth(req, res);
  if (!session) return;

  const { goalId } = req.body || {};
  if (!goalId) return res.status(400).json({ error: "goalId is required" });

  try {
    const db = assertSupabase();
    const { data: goal, error } = await db.from("goals")
      .select("id").eq("id", goalId).eq("workspace_id", session.workspaceId).maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    if (!goal) return res.status(404).json({ error: "Goal not found" });
    const result = await processGoal(goalId);
    return res.status(200).json(result);
  } catch (e) {
    console.error("[ceo/goals/execute]", e);
    return res.status(500).json({ error: e.message || "Internal server error" });
  }
}
