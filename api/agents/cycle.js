/**
 * api/agents/cycle.js
 * POST — run one squad cycle for the caller's workspace
 * (60 mini-reports -> 5 squad digests -> 1 CEO study ->
 *  squad_directives + feed entries + results row).
 */
import { requireAuth } from "../../backend/lib/auth.js";
import { runSquadCycle } from "../../backend/lib/cycle.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const session = requireAuth(req, res);
  if (!session) return;

  try {
    const result = await runSquadCycle(session.workspaceId);
    return res.status(200).json(result);
  } catch (e) {
    console.error("[agents/cycle]", e);
    return res.status(500).json({ error: e.message || "Internal server error" });
  }
}
