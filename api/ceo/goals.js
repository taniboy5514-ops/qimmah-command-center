/**
 * api/ceo/goals.js
 * Goal Mode routes. Auth: JWT cookie (qimmah_session).
 *   POST  { prompt }            — create + plan a goal
 *   GET                           — list goals with steps
 *   PATCH { id, action }        — pause | resume | cancel
 */
import { requireAuth } from "../../backend/lib/auth.js";
import { createGoal, listGoals, setGoalStatus } from "../../backend/lib/ceo/goals.js";

export default async function handler(req, res) {
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
