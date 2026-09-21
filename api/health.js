/**
 * api/health.js
 * Public liveness + configuration check for the Qimmah Command Center backend.
 *
 * Always answers HTTP 200 with a JSON body describing each dependency, so the
 * frontend (and the Vercel cron keep-warm) can tell "deployed but
 * misconfigured" apart from "down". Never throws, never requires auth,
 * never leaks secret values — only whether they are set.
 *
 * GET -> { ok, now, services: { supabase: {configured, reachable, detail?},
 *                                groq: {configured}, jwt: {configured} } }
 */
import { supabase } from "../backend/lib/supabase.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  const services = {
    supabase: { configured: false, reachable: false },
    groq: { configured: Boolean(process.env.GROQ_API_KEY) },
    jwt: { configured: Boolean(process.env.JWT_SECRET) },
  };

  services.supabase.configured = Boolean(supabase);
  if (supabase) {
    try {
      const probe = supabase.from("users").select("id").limit(1);
      const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("timeout after 4s")), 4000)
      );
      const { error } = await Promise.race([probe, timeout]);
      if (error) {
        // e.g. relation "users" does not exist — schema SQL not run yet
        services.supabase.detail = String(error.message || error).slice(0, 200);
      } else {
        services.supabase.reachable = true;
      }
    } catch (e) {
      services.supabase.detail = String((e && e.message) || e).slice(0, 200);
    }
  } else {
    services.supabase.detail = "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set";
  }

  const ok =
    services.supabase.configured &&
    services.supabase.reachable &&
    services.jwt.configured;

  return res.status(200).json({ ok, now: new Date().toISOString(), services });
}
