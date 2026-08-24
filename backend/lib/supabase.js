/**
 * backend/lib/supabase.js
 * Server-side Supabase client (SERVICE ROLE key — never ship to browser)
 * plus shared helpers: workspace lookup and feed logging.
 */
import { createClient } from "@supabase/supabase-js";

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.warn("[supabase] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set");
}

/** Singleton service-role client (bypasses RLS — server only). */
export const supabase =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;

export function assertSupabase() {
  if (!supabase) throw new Error("Supabase is not configured");
  return supabase;
}

/**
 * Fetch the workspace row for a user.
 * @param {string} workspaceId
 * @returns {Promise<object|null>}
 */
export async function getWorkspace(workspaceId) {
  const db = assertSupabase();
  const { data, error } = await db
    .from("workspaces")
    .select("*")
    .eq("id", workspaceId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

/**
 * Append a feed entry for a workspace.
 * @param {string} workspaceId
 * @param {string} kind - e.g. 'system' | 'agent' | 'finance' | 'study' | 'cycle'
 * @param {string} text
 */
export async function logFeed(workspaceId, kind, text) {
  const db = assertSupabase();
  const { error } = await db
    .from("feed_entries")
    .insert({ workspace_id: workspaceId, kind, text: String(text).slice(0, 2000) });
  if (error) console.error("[logFeed]", error.message);
}
