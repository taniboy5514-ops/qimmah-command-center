/**
 * api/ceo/[...ceo].js
 * Vercel catch-all consolidation of:
 *   /api/ceo/goals         -> goalsHandler         (req.query.ceo = ["goals"])
 *   /api/ceo/goals/execute -> executeHandler       (req.query.ceo = ["goals","execute"])
 * Public URL paths are unchanged.
 * Handler logic is preserved verbatim from the original route files
 * (relative import paths adjusted only for the merged file's depth).
 */

/**
 * api/ceo/goals.js
 * Goal Mode routes. Auth: JWT cookie (qimmah_session).
 *   POST  { prompt }            — create + plan a goal
 *   GET                         — list goals with steps
 *   PATCH { id, action }        — pause | resume | cancel
 */
import { requireAuth } from "../../backend/lib/auth.js";
import { assertSupabase } from "../../backend/lib/supabase.js";
import { createGoal, listGoals, setGoalStatus, processGoal } from "../../backend/lib/ceo/goals.js";

async function goalsHandler(req, res) {
  const session = requireAuth(req, res);
  if (!session) return;

  try {
    if (req.method === "POST") {
      const { prompt } = req.body || {};
      if (!prompt || !String(prompt).trim()) return res.status(400).json({ error: "prompt is required" });
      const { goal, steps } = await createGoal(session.workspaceId, session.userId, String(prompt).trim());
      return res.status(201).json({ goal, steps });
    }
    if (req.method === "GET") {
      const goals = await listGoals(session.workspaceId);
      return res.status(200).json({ goals });
    }
    if (req.method === "PATCH") {
      const { id, action } = req.body || {};
      if (!id) return res.status(400).json({ error: "id is required" });
      const goal = await setGoalStatus(session.workspaceId, id, action);
      return res.status(200).json({ goal });
    }
    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    console.error("[ceo/goals]", e);
    return res.status(500).json({ error: e.message || "Internal server error" });
  }
}

/**
 * api/ceo/goals/execute.js
 * POST { goalId } — manual trigger: advance one goal now (processGoal).
 * Auth: JWT cookie (qimmah_session); goal must belong to the caller's
 * workspace.
 */
async function executeHandler(req, res) {
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

export default async function handler(req, res) {
  const segments = Array.isArray(req.query.ceo)
    ? req.query.ceo
    : (req.query.ceo ? [req.query.ceo] : []);
  const path = segments.join("/");
  switch (path) {
    case "goals":
      return goalsHandler(req, res);
    case "goals/execute":
      return executeHandler(req, res);
    default:
      return res.status(404).json({ error: "Not found" });
  }
}
