/**
 * api/cron/squad-cycle.js
 * GET — Vercel Cron entrypoint (see vercel.json "crons").
 * Guarded by `Authorization: Bearer ${CRON_SECRET}`.
 * Runs the squad cycle for every workspace.
 */
import { supabase, assertSupabase } from "../../backend/lib/supabase.js";
import { runSquadCycle } from "../../backend/lib/cycle.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

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
