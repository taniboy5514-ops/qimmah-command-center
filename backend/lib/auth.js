/**
 * backend/lib/auth.js
 * Shared JWT verification helper for all /api routes.
 * Reads the `qimmah_session` httpOnly cookie and verifies with JWT_SECRET.
 */
import jwt from "jsonwebtoken";

export const SESSION_COOKIE = "qimmah_session";
const MAX_AGE_S = 60 * 60 * 24 * 30; // 30 days

/**
 * Sign a session token.
 * @param {{userId: string, workspaceId: string}} payload
 * @returns {string}
 */
export function signSession(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: MAX_AGE_S });
}

/**
 * Set the session cookie on a response.
 */
export function setSessionCookie(res, token) {
  const cookie = [
    `${SESSION_COOKIE}=${token}`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    `Max-Age=${MAX_AGE_S}`,
  ].join("; ");
  res.setHeader("Set-Cookie", cookie);
}

export function clearSessionCookie(res) {
  res.setHeader("Set-Cookie", `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
}

/**
 * Parse cookies from a request.
 */
function parseCookies(req) {
  const header = req.headers.cookie || "";
  const out = {};
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i > -1) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

/**
 * Verify the session cookie and return its payload, or null.
 * @returns {{userId: string, workspaceId: string} | null}
 */
export function getSession(req) {
  try {
    const token = parseCookies(req)[SESSION_COOKIE];
    if (!token || !process.env.JWT_SECRET) return null;
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (!payload?.userId || !payload?.workspaceId) return null;
    return { userId: payload.userId, workspaceId: payload.workspaceId };
  } catch {
    return null;
  }
}

/**
 * Middleware-style guard: returns the session or sends 401 and returns null.
 * Usage: const session = requireAuth(req, res); if (!session) return;
 */
export function requireAuth(req, res) {
  const session = getSession(req);
  if (!session) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }
  return session;
}
