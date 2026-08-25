/**
 * api/cron/[job].js
 * Vercel dynamic-segment consolidation of:
 *   /api/cron/squad-cycle    -> squadCycleHandler
 *   /api/cron/goal-processor -> goalProcessorHandler
 * There are no vercel.json "crons" entries — schedule these endpoints with an
 * external pinger (e.g. cron-job.org) hitting /api/cron/<job> with
 * `Authorization: Bearer ${CRON_SECRET}`. Both GET and POST are accepted.
 * Handler logic is preserved verbatim from the original route files.
 */

export const maxDuration = 60;

/**
 * api/cron/squad-cycle.js
 * GET or POST — cron entrypoint (external pinger; no vercel.json crons).
 * Guarded by `Authorization: Bearer ${CRON_SECRET}`.
 * Runs the squad cycle for every workspace.
 */
import { supabase, assertSupabase } from "../../backend/lib/supabase.js";
import { runSquadCycle } from "../../backend/lib/cycle.js";
import { processActiveGoals } from "../../backend/lib/ceo/goals.js";

async function squadCycleHandler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const secret = process.env.CRON_SECRET;
  if (!secret) return res.status(500).json({ error: "CRON_SECRET is not configured" });
  const auth = req.headers.authorization || "";
  if (auth !== `Bearer ${secret}`) return res.status(401).json({ error: "Unauthorized" });

  try {
    const db = assertSupabase();
    const { data: workspaces, error } = await db.from("workspaces").select("id, name");
    if (error) return res.status(500).json({ error: error.message });

    const outcomes = [];
    for (const ws of workspaces || []) {
      try {
        const r = await runSquadCycle(ws.id);
        outcomes.push({ workspaceId: ws.id, ok: true, cycleId: r.cycleId });
      } catch (e) {
        console.error(`[cron] cycle failed for workspace ${ws.id}:`, e);
        outcomes.push({ workspaceId: ws.id, ok: false, error: e.message });
      }
    }
    return res.status(200).json({ ok: true, ran: outcomes.length, outcomes });
  } catch (e) {
    console.error("[cron/squad-cycle]", e);
    return res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * api/cron/goal-processor.js
 * GET or POST — cron entrypoint (external pinger; no vercel.json crons).
 * Guarded by `Authorization: Bearer ${CRON_SECRET}`.
 * Advances every active goal in every workspace (processActiveGoals).
 */
async function goalProcessorHandler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const secret = process.env.CRON_SECRET;
  if (!secret) return res.status(500).json({ error: "CRON_SECRET is not configured" });
  const auth = req.headers.authorization || "";
  if (auth !== `Bearer ${secret}`) return res.status(401).json({ error: "Unauthorized" });

  try {
    const outcomes = await processActiveGoals();
    return res.status(200).json({ ok: true, processed: outcomes.length, outcomes });
  } catch (e) {
    console.error("[cron/goal-processor]", e);
    return res.status(500).json({ error: "Internal server error" });
  }
}

export default async function handler(req, res) {
  const job = Array.isArray(req.query.job) ? req.query.job[0] : req.query.job;
  switch (job) {
    case "squad-cycle":
      return squadCycleHandler(req, res);
    case "goal-processor":
      return goalProcessorHandler(req, res);
    default:
      return res.status(404).json({ error: "Not found" });
  }
}
