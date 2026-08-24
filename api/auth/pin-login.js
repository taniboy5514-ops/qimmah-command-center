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

    // Look for an existing user with this name across workspaces by
    // matching name first, then verifying the PIN hash.
    const { data: candidates, error: findErr } = await db
      .from("users")
      .select("id, workspace_id, name, role, pin_hash")
      .ilike("name", name)
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
