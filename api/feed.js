/**
 * api/feed.js
 * Workspace activity feed.
 *
 * GET    ?before=<ISO ts>&limit=50  — paginated, scoped to the JWT workspace.
 * POST   { kind, text }             — manual feed entry.
 * DELETE                            — clear the workspace feed.
 */
import { assertSupabase } from "../backend/lib/supabase.js";
import { requireAuth } from "../backend/lib/auth.js";

const ALLOWED_KINDS = new Set(["info", "system", "agent", "finance", "study", "cycle", "lead", "task"]);

export default async function handler(req, res) {
  const session = requireAuth(req, res);
  if (!session) return;
  const db = assertSupabase();

  try {
    if (req.method === "GET") {
      const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);
      let q = db
        .from("feed_entries")
        .select("id, kind, text, created_at")
        .eq("workspace_id", session.workspaceId)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (req.query.before) q = q.lt("created_at", String(req.query.before));
      const { data, error } = await q;
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ entries: data || [], hasMore: (data || []).length === limit });
    }

    if (req.method === "POST") {
      const kind = ALLOWED_KINDS.has(req.body?.kind) ? req.body.kind : "info";
      const text = String(req.body?.text || "").trim().slice(0, 2000);
      if (!text) return res.status(400).json({ error: "Text is required" });
      const { data, error } = await db
        .from("feed_entries")
        .insert({ workspace_id: session.workspaceId, kind, text })
        .select()
        .single();
      if (error) return res.status(500).json({ error: error.message });
      return res.status(201).json({ entry: data });
    }

    if (req.method === "DELETE") {
      const { error } = await db
        .from("feed_entries")
        .delete()
        .eq("workspace_id", session.workspaceId);
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    console.error("[feed]", e);
    return res.status(500).json({ error: "Internal server error" });
  }
}
