/**
 * api/cron/goal-processor.js
 * GET — Vercel Cron entrypoint (see vercel.json "crons").
 * Guarded by `Authorization: Bearer ${CRON_SECRET}`.
 * Advances every active goal in every workspace (processActiveGoals).
 */
import { processActiveGoals } from "../../backend/lib/ceo/goals.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

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
