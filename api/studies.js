/**
 * api/studies.js
 * Knowledge base of AI-run studies.
 *
 * GET  ?source=<domain filter> — list studies with their sources.
 * POST { topic }               — run a Groq study (tries groq/compound
 *                                first, falls back to the model chain),
 *                                store the brief + extracted sources.
 */
import { assertSupabase, logFeed } from "../backend/lib/supabase.js";
import { requireAuth } from "../backend/lib/auth.js";
import { callGroq } from "../backend/lib/groq.js";

export default async function handler(req, res) {
  const session = requireAuth(req, res);
  if (!session) return;
  const db = assertSupabase();
  const ws = session.workspaceId;

  try {
    if (req.method === "GET") {
      const { data, error } = await db
        .from("studies")
        .select("*, study_sources(*)")
        .eq("workspace_id", ws)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) return res.status(500).json({ error: error.message });

      let studies = data || [];
      const sourceFilter = String(req.query.source || "").trim().toLowerCase();
      if (sourceFilter) {
        studies = studies.filter((s) =>
          (s.study_sources || []).some((src) =>
            String(src.url || "").toLowerCase().includes(sourceFilter)));
      }
      return res.status(200).json({ studies });
    }

    if (req.method === "POST") {
      const topic = String(req.body?.topic || "").trim().slice(0, 300);
      if (!topic) return res.status(400).json({ error: "Topic is required" });

      const sys =
        "You are the research engine of Qimmah Digital, an AI-powered digital marketing agency in Oman. " +
        "Produce a web-style research brief on the given topic with markdown sections: Summary, Key Findings, " +
        "Actionable Recommendations (for an Omani/GCC digital agency), and Sources (list of 3-6 plausible source " +
        "titles with URLs, one per line, format: `- Title | https://url`).";
      const { content, model } = await callGroq(
        sys,
        [{ role: "user", content: `Research topic: ${topic}` }],
        "groq/compound"
      );

      const { data: study, error: stErr } = await db
        .from("studies")
        .insert({ workspace_id: ws, topic, brief: content, model })
        .select()
        .single();
      if (stErr) return res.status(500).json({ error: stErr.message });

      // Extract "Title | URL" lines from the brief as sources.
      const srcRows = [];
      const re = /[-*]\s*([^|\n]{3,120})\|\s*(https?:\/\/\S+)/g;
      let m;
      while ((m = re.exec(content)) && srcRows.length < 10) {
        srcRows.push({
          workspace_id: ws,
          study_id: study.id,
          title: m[1].trim(),
          url: m[2].trim(),
        });
      }
      if (srcRows.length) {
        const { error: srcErr } = await db.from("study_sources").insert(srcRows);
        if (srcErr) return res.status(500).json({ error: srcErr.message });
      }

      await logFeed(ws, "study", `Study completed: "${topic}" (model: ${model})`);
      return res.status(201).json({ study: { ...study, study_sources: srcRows } });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    console.error("[studies]", e);
    return res.status(500).json({ error: "Internal server error" });
  }
}
