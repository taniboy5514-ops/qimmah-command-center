/**
 * api/ping.js — TEMPORARY diagnostics endpoint (remove after debugging).
 * GET /api/ping            -> { ok, node, mode:'none' } (zero imports)
 * GET /api/ping?m=imports  -> tries importing every dep/lib, reports which fails
 */
export default async function handler(req, res) {
  const m = (req.query && req.query.m) || "none";
  const out = { ok: true, node: process.version, mode: m, steps: [] };
  if (m === "imports") {
    const tryImport = async (name, path) => {
      try {
        await import(path);
        out.steps.push(name + ":ok");
      } catch (e) {
        out.steps.push(name + ":FAIL:" + (e && e.message ? e.message : String(e)));
        out.ok = false;
      }
    };
    await tryImport("pkg:@supabase/supabase-js", "@supabase/supabase-js");
    await tryImport("pkg:jsonwebtoken", "jsonwebtoken");
    await tryImport("pkg:bcryptjs", "bcryptjs");
    await tryImport("pkg:node-edge-tts", "node-edge-tts");
    await tryImport("lib:supabase", "../backend/lib/supabase.js");
    await tryImport("lib:auth", "../backend/lib/auth.js");
    await tryImport("lib:groq", "../backend/lib/groq.js");
    await tryImport("lib:registry", "../backend/lib/mcp/registry.js");
    await tryImport("lib:toolkit", "../backend/lib/agents/toolkit.js");
    await tryImport("lib:executor", "../backend/lib/agents/executor.js");
    await tryImport("lib:cycle", "../backend/lib/cycle.js");
  }
  res.status(200).json(out);
}
