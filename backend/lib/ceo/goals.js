/**
 * backend/lib/ceo/goals.js
 * GOAL MODE engine. The CEO Brain turns an objective ("get me 5 clients
 * by Friday") into a DAG of steps (goal_steps), then advances the DAG:
 * ready steps execute through the 6-gate MCP executor
 * (backend/lib/agents/executor.js), sensitive tools queue a
 * tool_approvals row and block until a human approves, failed steps retry
 * up to 2 times with linear backoff, and the goal completes with a feed
 * summary when every step is done.
 *
 * Planning is AI-first (callGroq returns the DAG as JSON) with a
 * deterministic fallback planner built from the skill templates in
 * backend/lib/ceo/skills.js when the AI is unavailable.
 */
import { assertSupabase, logFeed } from "../supabase.js";
import { callGroq } from "../groq.js";
import { listAllTools, getTool, getToolSchema } from "../mcp/registry.js";
import { executeTool } from "../agents/executor.js";
import { detectSkill, planFromSkill, APPROVAL_TOOLS, SQUADS } from "./skills.js";

const MAX_ATTEMPTS = 3; // initial try + 2 retries
const BACKOFF_MS = 120000; // attempts * 2 minutes
const STEPS_PER_RUN = 4; // max steps executed per processGoal invocation

/* ------------------------------------------------------------------ */
/* Events + progress                                                   */
/* ------------------------------------------------------------------ */

async function addEvent(goalId, kind, text) {
  try {
    const db = assertSupabase();
    await db.from("goal_events").insert({ goal_id: goalId, kind, text: String(text).slice(0, 500) });
  } catch (e) {
    console.error("[goals] event:", e.message);
  }
}

function computeProgress(steps) {
  if (!steps.length) return 0;
  return steps.filter((s) => s.status === "done").length / steps.length;
}

async function touchGoal(goalId, patch) {
  const db = assertSupabase();
  const { error } = await db.from("goals")
    .update({ ...patch, updated_at: new Date().toISOString() }).eq("id", goalId);
  if (error) throw new Error(error.message);
}

/* ------------------------------------------------------------------ */
/* Planning                                                            */
/* ------------------------------------------------------------------ */

/** Tools offered to the AI planner, with one-line descriptions. */
function plannerToolList() {
  return listAllTools().map((n) => {
    const s = getToolSchema(n);
    return `- ${n} (squads: ${s.squadAccess.join("/")}${s.requiresApproval ? ", approval" : ""}): ${s.description}`;
  }).join("\n");
}

/** Validate + normalize an AI-produced plan; returns null if unusable. */
function normalizePlan(raw, prompt) {
  if (!raw || !Array.isArray(raw.steps) || !raw.steps.length) return null;
  const steps = [];
  raw.steps.slice(0, 12).forEach((s, i) => {
    if (!s || typeof s !== "object") return;
    const tool = getTool(s.tool_name);
    if (!tool) return; // drop steps with tools that don't exist
    const squad = SQUADS.includes(s.squad) ? s.squad : tool.squadAccess[0];
    const deps = Array.isArray(s.depends_on)
      ? s.depends_on.filter((d) => Number.isInteger(d) && d >= 0 && d < i)
      : [];
    steps.push({
      title: String(s.title || tool.name).slice(0, 140),
      squad,
      tool_name: tool.name,
      tool_args: s.tool_args && typeof s.tool_args === "object" ? s.tool_args : {},
      depends_on: deps,
      needs_approval: !!(s.needs_approval || APPROVAL_TOOLS.has(tool.name)),
    });
  });
  return steps.length ? steps : null;
}

/**
 * Plan a goal: AI-first DAG generation, deterministic skill-template
 * fallback when the AI is unavailable or returns junk.
 * @returns {Promise<{skill: string, confidence: number, steps: object[], planner: string}>}
 */
export async function planGoal(prompt) {
  const { skill, confidence } = detectSkill(prompt);
  const sys =
    "You are the CEO Brain of Qimmah Digital (Oman) planning a business objective into executable steps. " +
    "Output ONLY valid JSON, no markdown fences, with this exact shape: " +
    '{"steps":[{"title":string,"squad":"Alpha"|"Beta"|"Gamma"|"Delta"|"Epsilon","tool_name":string,"tool_args":object,"depends_on":number[],"needs_approval":boolean}]}. ' +
    "Rules: 2-6 steps; every tool_name MUST be one of the available tools below; depends_on holds the 0-based indexes of steps that must finish first (empty array for first-wave steps); " +
    "needs_approval MUST be true for send_whatsapp_message, send_instagram_dm, record_transaction, create_invoice and self_edit_code. " +
    "Ground tool_args in the objective text.\n\nAVAILABLE TOOLS:\n" + plannerToolList();
  try {
    const { content } = await callGroq(sys, [{ role: "user", content: "Objective: " + String(prompt).slice(0, 800) }]);
    const parsed = JSON.parse(content.replace(/```json?|```/g, "").trim());
    const steps = normalizePlan(parsed, prompt);
    if (steps) return { skill: skill ? skill.name : "custom", confidence, steps, planner: "ai" };
  } catch (e) {
    console.warn("[goals] AI planner unavailable, using skill fallback:", e.message);
  }
  // Deterministic fallback: skill templates, or a generic research+task plan.
  const fallback = skill
    ? planFromSkill(skill, prompt)
    : [
        { title: "Research the objective", squad: "Gamma", tool_name: "web_search", tool_args: { query: String(prompt).slice(0, 300) }, depends_on: [], needs_approval: false },
        { title: "Study the findings", squad: "Gamma", tool_name: "study_topic", tool_args: { topic: String(prompt).slice(0, 300) }, depends_on: [0], needs_approval: false },
        { title: "Create the action task", squad: "Delta", tool_name: "create_task", tool_args: { title: String(prompt).slice(0, 120), priority: "high" }, depends_on: [1], needs_approval: false },
      ];
  return { skill: skill ? skill.name : "custom", confidence, steps: fallback, planner: "fallback" };
}

/* ------------------------------------------------------------------ */
/* Create / list / control                                             */
/* ------------------------------------------------------------------ */

/** Create a goal from a prompt: plan it and insert goal + steps + event. */
export async function createGoal(workspaceId, userId, prompt) {
  const db = assertSupabase();
  const plan = await planGoal(prompt);
  const { data: goal, error } = await db.from("goals").insert({
    workspace_id: workspaceId, user_id: userId || null,
    prompt: String(prompt).slice(0, 1000), skill: plan.skill, status: "active",
    plan: { steps: plan.steps, planner: plan.planner, confidence: plan.confidence },
  }).select().single();
  if (error) throw new Error(error.message);

  const rows = plan.steps.map((s, i) => ({
    goal_id: goal.id, idx: i, title: s.title, squad: s.squad,
    tool_name: s.tool_name, tool_args: s.tool_args,
    depends_on: s.depends_on, needs_approval: s.needs_approval,
    status: s.depends_on.length === 0 ? "ready" : "pending",
  }));
  const { error: sErr } = await db.from("goal_steps").insert(rows);
  if (sErr) throw new Error(sErr.message);

  await addEvent(goal.id, "plan",
    `Planned ${plan.steps.length} steps (${plan.planner === "ai" ? "CEO Brain" : "skill templates"}${plan.skill !== "custom" ? ", skill: " + plan.skill : ""})`);
  await logFeed(workspaceId, "system",
    `Goal created: "${String(prompt).slice(0, 120)}" — ${plan.steps.length} steps planned`);
  return { goal, steps: rows };
}

/** List goals with their steps, newest first. */
export async function listGoals(workspaceId, limit = 20) {
  const db = assertSupabase();
  const { data: goals, error } = await db.from("goals")
    .select("id, prompt, skill, status, progress, created_at, updated_at")
    .eq("workspace_id", workspaceId).order("created_at", { ascending: false }).limit(limit);
  if (error) throw new Error(error.message);
  if (!goals || !goals.length) return [];
  const { data: steps, error: stErr } = await db.from("goal_steps")
    .select("goal_id, idx, title, squad, tool_name, status, needs_approval, attempts, updated_at")
    .in("goal_id", goals.map((g) => g.id)).order("idx", { ascending: true });
  if (stErr) throw new Error(stErr.message);
  const byGoal = {};
  for (const s of steps || []) (byGoal[s.goal_id] = byGoal[s.goal_id] || []).push(s);
  return goals.map((g) => ({ ...g, steps: byGoal[g.id] || [] }));
}

/** Pause / resume / cancel a goal. */
export async function setGoalStatus(workspaceId, goalId, action) {
  const map = { pause: "paused", resume: "active", cancel: "cancelled" };
  const status = map[action];
  if (!status) throw new Error("action must be pause, resume or cancel");
  const db = assertSupabase();
  const { data, error } = await db.from("goals")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", goalId).eq("workspace_id", workspaceId)
    .in("status", action === "resume" ? ["paused"] : ["active", "paused"])
    .select().maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Goal not found or already finished");
  await addEvent(goalId, "control", `Goal ${status} by user`);
  await logFeed(workspaceId, "system", `Goal ${status}: "${String(data.prompt).slice(0, 100)}"`);
  return data;
}

/* ------------------------------------------------------------------ */
/* Processing                                                          */
/* ------------------------------------------------------------------ */

/** Pick one active agent of a squad to own a step's tool execution. */
async function pickAgent(workspaceId, squad) {
  const db = assertSupabase();
  const { data, error } = await db.from("agents")
    .select("id, code, name, squad")
    .eq("workspace_id", workspaceId).eq("squad", squad).eq("active", true)
    .order("num", { ascending: true }).limit(1).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

/** Reconcile a blocked step: done if its approval was approved, failed if rejected. */
async function reconcileBlocked(workspaceId, step) {
  const approvalId = step.result && step.result.approvalId;
  if (!approvalId) return null;
  try {
    const db = assertSupabase();
    const { data } = await db.from("tool_approvals")
      .select("status").eq("id", approvalId).eq("workspace_id", workspaceId).maybeSingle();
    return data ? data.status : null; // 'pending' | 'approved' | 'rejected'
  } catch {
    return null;
  }
}

/** Execute one step through the 6-gate executor and persist the outcome. */
async function runStep(goal, step) {
  const db = assertSupabase();
  const agent = await pickAgent(goal.workspace_id, step.squad);
  if (!agent) {
    await db.from("goal_steps").update({
      status: "failed", attempts: step.attempts + 1,
      result: { error: `No active agent in Squad ${step.squad}` },
      updated_at: new Date().toISOString(),
    }).eq("id", step.id);
    await addEvent(goal.id, "step", `Step ${step.idx + 1} failed: no active agent in Squad ${step.squad}`);
    return { ran: false };
  }

  await db.from("goal_steps").update({ status: "running", updated_at: new Date().toISOString() }).eq("id", step.id);

  const result = await executeTool(step.tool_name, step.tool_args || {}, {
    workspaceId: goal.workspace_id,
    agentId: agent.id,
    agentName: `${agent.code} (${agent.name})`,
    squadCode: agent.squad,
    userId: goal.user_id || null,
  });

  const now = new Date().toISOString();
  if (result.success) {
    await db.from("goal_steps").update({
      status: "done", attempts: step.attempts + 1, result: { output: result.result }, updated_at: now,
    }).eq("id", step.id);
    await addEvent(goal.id, "step", `Step ${step.idx + 1} done: ${step.title} (${step.tool_name})`);
  } else if (result.approvalRequired) {
    await db.from("goal_steps").update({
      status: "blocked", attempts: step.attempts + 1,
      result: { approvalId: result.approvalId, note: "Waiting for human approval" },
      updated_at: now,
    }).eq("id", step.id);
    await addEvent(goal.id, "approval", `Step ${step.idx + 1} needs approval: ${step.tool_name}`);
  } else {
    const attempts = step.attempts + 1;
    const final = attempts >= MAX_ATTEMPTS;
    await db.from("goal_steps").update({
      status: final ? "failed" : "ready", attempts,
      result: { error: String(result.error || "unknown").slice(0, 400), retry: !final },
      updated_at: now,
    }).eq("id", step.id);
    await addEvent(goal.id, "step",
      `Step ${step.idx + 1} ${final ? "failed" : "will retry"}: ${String(result.error || "unknown").slice(0, 160)}`);
  }
  return { ran: true, result };
}

/**
 * Advance one goal: reconcile blocked steps, promote pending → ready,
 * execute up to STEPS_PER_RUN ready steps, update progress, complete the
 * goal (with feed summary) when everything is done.
 */
export async function processGoal(goalId) {
  const db = assertSupabase();
  const { data: goal, error } = await db.from("goals").select("*").eq("id", goalId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!goal) throw new Error("Goal not found");
  if (goal.status !== "active") return { goalId, status: goal.status, ran: 0 };

  const { data: steps, error: stErr } = await db.from("goal_steps")
    .select("*").eq("goal_id", goalId).order("idx", { ascending: true });
  if (stErr) throw new Error(stErr.message);
  const all = steps || [];

  // 1. Reconcile blocked steps against their approvals.
  for (const s of all.filter((x) => x.status === "blocked")) {
    const decision = await reconcileBlocked(goal.workspace_id, s);
    if (decision === "approved") {
      // The tool already executed at approval time (api/mcp/approve).
      await db.from("goal_steps").update({ status: "done", result: { ...(s.result || {}), approved: true }, updated_at: new Date().toISOString() }).eq("id", s.id);
      s.status = "done";
      await addEvent(goalId, "step", `Step ${s.idx + 1} approved and executed: ${s.tool_name}`);
    } else if (decision === "rejected") {
      await db.from("goal_steps").update({ status: "failed", result: { ...(s.result || {}), rejected: true }, updated_at: new Date().toISOString() }).eq("id", s.id);
      s.status = "failed";
      await addEvent(goalId, "step", `Step ${s.idx + 1} approval rejected: ${s.tool_name}`);
    }
  }

  // 2. Promote pending steps whose dependencies are all done (or failed → blocked forever).
  const byIdx = new Map(all.map((s) => [s.idx, s]));
  for (const s of all.filter((x) => x.status === "pending")) {
    const deps = s.depends_on || [];
    const failed = deps.some((d) => byIdx.get(d) && byIdx.get(d).status === "failed");
    const done = deps.every((d) => !byIdx.get(d) || byIdx.get(d).status === "done");
    if (failed) {
      await db.from("goal_steps").update({ status: "failed", result: { error: "Dependency failed" }, updated_at: new Date().toISOString() }).eq("id", s.id);
      s.status = "failed";
    } else if (done) {
      await db.from("goal_steps").update({ status: "ready", updated_at: new Date().toISOString() }).eq("id", s.id);
      s.status = "ready";
    }
  }

  // 3. Execute ready steps (respect retry backoff).
  let ran = 0;
  const now = Date.now();
  for (const s of all) {
    if (ran >= STEPS_PER_RUN) break;
    if (s.status !== "ready") continue;
    if (s.attempts > 0) {
      const wait = s.attempts * BACKOFF_MS;
      if (now - new Date(s.updated_at).getTime() < wait) continue; // backoff
    }
    const r = await runStep(goal, s);
    if (r.ran) ran++;
  }

  // 4. Progress + completion.
  const { data: fresh } = await db.from("goal_steps").select("status").eq("goal_id", goalId);
  const progress = computeProgress(fresh || []);
  const remaining = (fresh || []).filter((s) => ["pending", "ready", "running", "blocked"].includes(s.status)).length;
  if (remaining === 0 && (fresh || []).length > 0) {
    const done = (fresh || []).filter((s) => s.status === "done").length;
    const failed = (fresh || []).filter((s) => s.status === "failed").length;
    await touchGoal(goalId, { status: "completed", progress: 1 });
    await addEvent(goalId, "complete", `Goal completed: ${done} steps done, ${failed} failed`);
    await logFeed(goal.workspace_id, "system",
      `Goal completed: "${String(goal.prompt).slice(0, 120)}" — ${done} steps done${failed ? `, ${failed} failed` : ""}`);
    return { goalId, status: "completed", ran, progress: 1 };
  }
  await touchGoal(goalId, { progress });
  return { goalId, status: "active", ran, progress };
}

/** Process every active goal (optionally scoped to one workspace). */
export async function processActiveGoals(workspaceId) {
  const db = assertSupabase();
  let q = db.from("goals").select("id").eq("status", "active");
  if (workspaceId) q = q.eq("workspace_id", workspaceId);
  const { data, error } = await q.limit(25);
  if (error) throw new Error(error.message);
  const outcomes = [];
  for (const g of data || []) {
    try {
      outcomes.push(await processGoal(g.id));
    } catch (e) {
      console.error("[goals] processGoal failed:", g.id, e);
      outcomes.push({ goalId: g.id, error: e.message });
    }
  }
  return outcomes;
}
