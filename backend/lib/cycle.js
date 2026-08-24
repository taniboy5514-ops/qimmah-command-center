/**
 * backend/lib/cycle.js
 * One full squad cycle, shared by api/agents/cycle.js and api/cron/squad-cycle.js:
 *   1. Generate 60 deterministic mini-reports from agents + recent tasks/results.
 *   2. 5 squad digests via Groq (alphaDigest).
 *   3. 1 CEO study across digests (ceoStudy).
 *   4. Persist squad_directives, feed entries, and a results row.
 */
import { assertSupabase, logFeed } from "./supabase.js";
import { alphaDigest, ceoStudy } from "./groq.js";

const SQUADS = ["Alpha", "Beta", "Gamma", "Delta", "Epsilon"];

const ACTIONS = [
  "reviewed pipeline and flagged stale items",
  "completed outreach batch and tracked replies",
  "audited deliverables for quality gaps",
  "compiled performance metrics for the week",
  "researched market movements in the Oman/GCC region",
  "updated playbooks based on last cycle outcomes",
  "drafted client-facing assets for review",
  "automated a recurring reporting step",
  "synced with adjacent squads on dependencies",
  "identified a cost-saving opportunity",
];

/** Deterministic pseudo-random from (seed, index) so cycles are reproducible. */
function prng(seed, i) {
  let h = (seed * 2654435761 + i * 40503) >>> 0;
  h ^= h >> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >> 15;
  return (h >>> 0) / 4294967296;
}

/**
 * Run one squad cycle for a workspace.
 * @param {string} workspaceId
 * @returns {Promise<{cycleId: string|null, digests: object, study: object}>}
 */
export async function runSquadCycle(workspaceId) {
  const db = assertSupabase();

  const [agentRes, taskRes, resultRes] = await Promise.all([
    db.from("agents").select("id, num, code, name, squad, active").eq("workspace_id", workspaceId).order("num"),
    db.from("tasks").select("id, title, status, agent_id").eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false }).limit(100),
    db.from("results").select("id, squad, summary").eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false }).limit(20),
  ]);
  if (agentRes.error) throw new Error(agentRes.error.message);
  const agents = agentRes.data || [];
  if (!agents.length) throw new Error("No agents found for workspace — provision first");
  const tasks = taskRes.data || [];
  const recentResults = resultRes.data || [];

  const seed = Math.floor(Date.now() / 600000); // one seed per 10-min slot

  // 1) Deterministic mini-reports for all agents.
  const reportsBySquad = Object.fromEntries(SQUADS.map((s) => [s, []]));
  for (const a of agents) {
    const r = prng(seed, a.num);
    const myTasks = tasks.filter((t) => t.agent_id === a.id);
    const openTasks = myTasks.filter((t) => t.status !== "done").length;
    const action = ACTIONS[Math.floor(r * ACTIONS.length)];
    const report = a.active
      ? `${a.name} ${action}. Open tasks: ${openTasks}. Throughput score: ${(60 + r * 40).toFixed(0)}/100.`
      : `${a.name} is offline this cycle.`;
    reportsBySquad[a.squad]?.push({ agent: `${a.code} (${a.name})`, report });
  }

  // 2) Five squad digests via Groq.
  const digests = [];
  for (const squad of SQUADS) {
    const { digest, model } = await alphaDigest(squad, reportsBySquad[squad]);
    digests.push({ squad, digest, model });
    await logFeed(workspaceId, "cycle", `Squad ${squad} digest ready (model: ${model})`);
  }

  // 3) CEO study across the digests.
  const study = await ceoStudy(digests);

  // 4) Persist: deactivate old directives, insert new ones per squad.
  await db.from("squad_directives").update({ active: false })
    .eq("workspace_id", workspaceId).eq("active", true);

  const directiveRows = [];
  for (const squad of SQUADS) {
    const list = study.directives?.[squad];
    for (const d of Array.isArray(list) ? list : []) {
      directiveRows.push({ workspace_id: workspaceId, squad, directive: String(d).slice(0, 500), active: true });
    }
  }
  if (directiveRows.length) {
    const { error: dirErr } = await db.from("squad_directives").insert(directiveRows);
    if (dirErr) throw new Error(dirErr.message);
  }

  const { data: resultRow, error: resErr } = await db.from("results").insert({
    workspace_id: workspaceId,
    kind: "squad_cycle",
    summary: `Squad cycle complete: ${agents.length} agents, ${digests.length} digests, ${directiveRows.length} directives.`,
    data: { digests, study, priorResults: recentResults.map((r) => r.id) },
  }).select().single();
  if (resErr) throw new Error(resErr.message);

  await logFeed(workspaceId, "cycle",
    `CEO study: ${study.findings[0] || "cycle complete"} Directives issued: ${directiveRows.length}.`);

  return { cycleId: resultRow.id, digests, study };
}
