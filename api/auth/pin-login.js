/**
 * api/auth/pin-login.js
 * PIN authentication for the Qimmah Command Center.
 *
 * POST   { name, pin }  — login. First login for a name auto-provisions
 *                         a workspace + 60 agents (via provision_workspace),
 *                         storing the bcrypt hash of the chosen PIN.
 * GET                   — return the current session user (or 401).
 * DELETE                — logout (clears the session cookie).
 *
 * Session: JWT (JWT_SECRET, 30d) with { userId, workspaceId } in an
 * httpOnly Secure SameSite=Lax cookie named `qimmah_session`.
 */
import bcrypt from "bcryptjs";
import { supabase, assertSupabase } from "../../backend/lib/supabase.js";
import { getSession, setSessionCookie, clearSessionCookie, signSession } from "../../backend/lib/auth.js";

const PIN_RE = /^\d{4,8}$/;

/** Brute-force throttle: `${ip}|${name.toLowerCase()}` -> { fails, until }.
 *  5 failed PIN attempts locks the IP+name pair for 15 minutes (429). */
const LOGIN_FAILS = new Map();
const MAX_FAILS = 5;
const LOCK_MS = 15 * 60 * 1000;

function clientIp(req) {
  const fwd = req.headers["x-forwarded-for"];
  const first = (Array.isArray(fwd) ? fwd[0] : String(fwd || "")).split(",")[0].trim();
  return first || (req.socket && req.socket.remoteAddress) || "unknown";
}

function throttleKey(req, name) {
  return `${clientIp(req)}|${name.toLowerCase()}`;
}

function isLockedOut(key) {
  const entry = LOGIN_FAILS.get(key);
  if (!entry) return false;
  if (entry.until && entry.until > Date.now()) return true;
  if (entry.until && entry.until <= Date.now()) LOGIN_FAILS.delete(key); // lockout expired
  return false;
}

function recordFail(key) {
  const now = Date.now();
  const entry = LOGIN_FAILS.get(key) || { fails: 0, until: 0 };
  if (entry.until && entry.until <= now) { entry.fails = 0; entry.until = 0; }
  entry.fails += 1;
  if (entry.fails >= MAX_FAILS) entry.until = now + LOCK_MS;
  LOGIN_FAILS.set(key, entry);
  // Opportunistic cleanup so the map cannot grow unbounded.
  if (LOGIN_FAILS.size > 10000) {
    for (const [k, v] of LOGIN_FAILS) {
      if (!v.until || v.until <= now) LOGIN_FAILS.delete(k);
    }
  }
}

function clearFails(key) {
  LOGIN_FAILS.delete(key);
}

/** Escape PostgREST ilike wildcards (% and _) and the escape char itself. */
function escapeIlike(value) {
  return value.replace(/[\\%_]/g, (m) => "\\" + m);
}

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const session = getSession(req);
      if (!session) return res.status(401).json({ error: "Unauthorized" });
      const { data: user } = await supabase
        .from("users")
        .select("id, name, role, created_at")
        .eq("id", session.userId)
        .maybeSingle();
      if (!user) return res.status(401).json({ error: "Unauthorized" });
      return res.status(200).json({ user, workspaceId: session.workspaceId });
    }

    if (req.method === "DELETE") {
      clearSessionCookie(res);
      return res.status(200).json({ ok: true });
    }

    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    const db = assertSupabase();
    const name = String(req.body?.name || "").trim().slice(0, 60);
    const pin = String(req.body?.pin || "");
    if (!name) return res.status(400).json({ error: "Name is required" });
    if (!PIN_RE.test(pin)) return res.status(400).json({ error: "PIN must be 4-8 digits" });

    // Brute-force throttle: refuse before doing any DB work while locked out.
    const tKey = throttleKey(req, name);
    if (isLockedOut(tKey)) {
      return res.status(429).json({ error: "Too many failed attempts — try again in 15 minutes" });
    }

    // Look for an existing user with this name across workspaces by
    // matching name first, then verifying the PIN hash. Wildcards are
    // escaped so user input cannot widen the ilike match.
    const { data: candidates, error: findErr } = await db
      .from("users")
      .select("id, workspace_id, name, role, pin_hash")
      .ilike("name", escapeIlike(name))
      .limit(5);
    if (findErr) return res.status(500).json({ error: findErr.message });

    let user = null;
    for (const c of candidates || []) {
      if (c.pin_hash && (await bcrypt.compare(pin, c.pin_hash))) {
        user = c;
        break;
      }
    }

    if (!user && (candidates || []).length > 0) {
      // Name exists but PIN didn't match any account.
      recordFail(tKey);
      if (isLockedOut(tKey)) {
        return res.status(429).json({ error: "Too many failed attempts — try again in 15 minutes" });
      }
      return res.status(401).json({ error: "Invalid PIN" });
    }

    if (!user) {
      // First login: provision workspace + 60 agents, storing the PIN hash.
      const pinHash = await bcrypt.hash(pin, 10);
      const { data, error } = await db.rpc("provision_workspace", {
        p_user_name: name,
        p_pin_hash: pinHash,
      });
      if (error) return res.status(500).json({ error: error.message });
      user = { id: data.user_id, workspace_id: data.workspace_id, name, role: "CEO" };
    }

    clearFails(tKey);
    const token = signSession({ userId: user.id, workspaceId: user.workspace_id });
    setSessionCookie(res, token);
    return res.status(200).json({
      user: { id: user.id, name: user.name, role: user.role },
      workspaceId: user.workspace_id,
    });
  } catch (e) {
    console.error("[pin-login]", e);
    return res.status(500).json({ error: "Internal server error" });
  }
}
