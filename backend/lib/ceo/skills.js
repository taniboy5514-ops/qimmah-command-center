/**
 * backend/lib/ceo/skills.js
 * Goal Mode skill registry: 8 built-in skills, each with trigger keywords
 * and deterministic step templates used by the fallback planner when the
 * AI planner (callGroq) is unavailable. Custom skills live in the `skills`
 * table (backend/schema-goals.sql).
 *
 * Step template shape:
 *   { title, squad, tool_name, tool_args?, needs_approval? }
 * tool_args values may contain the token "{{prompt}}" which the planner
 * substitutes with the user's objective text.
 */
import { getTool } from "../mcp/registry.js";

export const SQUADS = ["Alpha", "Beta", "Gamma", "Delta", "Epsilon"];

/** Sensitive tools always get needs_approval: true in generated plans. */
export const APPROVAL_TOOLS = new Set([
  "send_whatsapp_message",
  "send_instagram_dm",
  "record_transaction",
  "create_invoice",
  "self_edit_code",
]);

export const BUILTIN_SKILLS = [
  {
    name: "market_research",
    description: "Research a market, segment or competitor set and save the briefs to the knowledge base.",
    keywords: ["market", "research", "competitor", "segment", "industry", "trend", "oman", "gcc"],
    promptTemplate: "Goal: research the market for {topic} — competitors, pricing, and gaps we can win in Oman.",
    steps: [
      { title: "Research the target market", squad: "Gamma", tool_name: "web_search", tool_args: { query: "{{prompt}} — market size, segments, pricing in Oman/GCC" } },
      { title: "Study the top competitors", squad: "Gamma", tool_name: "study_topic", tool_args: { topic: "Competitors and positioning for: {{prompt}}" } },
      { title: "Snapshot current business analytics", squad: "Gamma", tool_name: "query_analytics", tool_args: { metric: "overview" } },
    ],
  },
  {
    name: "lead_generation",
    description: "Find and log new leads for a segment, then queue outreach.",
    keywords: ["lead", "leads", "client", "clients", "prospect", "pipeline", "outreach", "get me"],
    promptTemplate: "Goal: get me {n} new clients in {segment} — research them, add them to the pipeline and prepare outreach.",
    steps: [
      { title: "Research where the leads are", squad: "Gamma", tool_name: "web_search", tool_args: { query: "Find prospects and channels for: {{prompt}}" } },
      { title: "Study the ideal client profile", squad: "Gamma", tool_name: "study_topic", tool_args: { topic: "Ideal client profile for: {{prompt}}" } },
      { title: "Create the first lead in the pipeline", squad: "Alpha", tool_name: "create_lead", tool_args: { name: "Prospect: {{prompt}}", channel: "goal-mode", notes: "Seeded by Goal Mode — replace with a researched prospect." } },
      { title: "Prepare WhatsApp outreach", squad: "Alpha", tool_name: "send_whatsapp_message", needs_approval: true, tool_args: { to: "96891763555", message: "Intro outreach for: {{prompt}}" } },
    ],
  },
  {
    name: "client_followup",
    description: "Follow up with existing leads and move them forward in the pipeline.",
    keywords: ["follow up", "follow-up", "followup", "nudge", "warm lead", "check in", "re-engage"],
    promptTemplate: "Goal: follow up with every warm lead — review the pipeline and send nudges.",
    steps: [
      { title: "Review pipeline status", squad: "Gamma", tool_name: "query_analytics", tool_args: { metric: "leads" } },
      { title: "Send follow-up WhatsApp messages", squad: "Alpha", tool_name: "send_whatsapp_message", needs_approval: true, tool_args: { to: "96891763555", message: "Follow-up regarding: {{prompt}}" } },
    ],
  },
  {
    name: "financial_review",
    description: "Review income, expenses and invoices; record anything missing.",
    keywords: ["finance", "financial", "money", "revenue", "expense", "invoice", "profit", "omr", "budget"],
    promptTemplate: "Goal: run a full financial review — income, expenses, unpaid invoices, and next actions.",
    steps: [
      { title: "Query finance analytics", squad: "Delta", tool_name: "query_analytics", tool_args: { metric: "finance" } },
      { title: "Study cost-saving options", squad: "Gamma", tool_name: "study_topic", tool_args: { topic: "Cost and revenue actions for: {{prompt}}" } },
      { title: "Draft outstanding invoice", squad: "Delta", tool_name: "create_invoice", needs_approval: true, tool_args: { clientName: "Client (from review)", items: [{ description: "Services per review", qty: 1, unitPrice: 0 }], notes: "Drafted by Goal Mode for: {{prompt}}" } },
    ],
  },
  {
    name: "website_audit",
    description: "Audit the website and online presence; create fix tasks for Squad Beta.",
    keywords: ["website", "site", "audit", "seo", "landing page", "performance"],
    promptTemplate: "Goal: audit our website and SEO — find the gaps and queue the fixes.",
    steps: [
      { title: "Research SEO best practices", squad: "Beta", tool_name: "web_search", tool_args: { query: "Website and SEO audit checklist for: {{prompt}}" } },
      { title: "Study our website gaps", squad: "Beta", tool_name: "study_topic", tool_args: { topic: "Website audit: {{prompt}}" } },
      { title: "Create fix tasks", squad: "Beta", tool_name: "create_task", tool_args: { title: "Fix website issues found in audit: {{prompt}}", priority: "high" } },
    ],
  },
  {
    name: "content_campaign",
    description: "Plan and draft a content campaign across channels.",
    keywords: ["content", "campaign", "post", "posts", "social", "instagram", "tiktok", "calendar", "blog"],
    promptTemplate: "Goal: launch a content campaign for {topic} — angles, calendar, and production tasks.",
    steps: [
      { title: "Research content angles", squad: "Gamma", tool_name: "web_search", tool_args: { query: "Content angles and hooks for: {{prompt}}" } },
      { title: "Study the campaign theme", squad: "Gamma", tool_name: "study_topic", tool_args: { topic: "Campaign theme: {{prompt}}" } },
      { title: "Create content production tasks", squad: "Beta", tool_name: "create_task", tool_args: { title: "Produce campaign content for: {{prompt}}", priority: "normal" } },
    ],
  },
  {
    name: "proposal_builder",
    description: "Build a client proposal: research the client, draft the offer, create the invoice.",
    keywords: ["proposal", "quote", "offer", "pitch", "rfp", "bid"],
    promptTemplate: "Goal: build a proposal for {client} — research, offer structure, and a draft invoice.",
    steps: [
      { title: "Research the prospect", squad: "Gamma", tool_name: "web_search", tool_args: { query: "Prospect research for proposal: {{prompt}}" } },
      { title: "Draft the proposal task", squad: "Beta", tool_name: "create_task", tool_args: { title: "Write proposal for: {{prompt}}", priority: "high" } },
      { title: "Draft the invoice", squad: "Delta", tool_name: "create_invoice", needs_approval: true, tool_args: { clientName: "Prospect ({{prompt}})", items: [{ description: "Services per proposal", qty: 1, unitPrice: 0 }], notes: "Drafted by Goal Mode." } },
    ],
  },
  {
    name: "ops_cleanup",
    description: "Operations hygiene: clear stalled tasks, test connectors, propose fixes.",
    keywords: ["ops", "cleanup", "clean up", "operations", "hygiene", "stalled", "maintenance", "fix"],
    promptTemplate: "Goal: operations cleanup — clear stalled work, test connectors, propose fixes.",
    steps: [
      { title: "Review task backlog", squad: "Delta", tool_name: "query_analytics", tool_args: { metric: "tasks" } },
      { title: "Test connectors", squad: "Delta", tool_name: "test_connector", tool_args: { connector: "whatsapp" } },
      { title: "Propose code fixes", squad: "Delta", tool_name: "self_edit_code", needs_approval: true, tool_args: { files: [{ path: "src/shared.jsx", content: "/* proposed improvement placeholder — replaced by the CEO Brain with a real diff */" }], reason: "Ops cleanup goal: {{prompt}}" } },
    ],
  },
];

/**
 * Detect the best-matching skill for a prompt.
 * @returns {{skill: object|null, confidence: number}} confidence 0..1
 *   (fraction of that skill's keywords found, boosted by phrase matches).
 */
export function detectSkill(prompt) {
  const text = " " + String(prompt || "").toLowerCase() + " ";
  let best = null;
  let bestScore = 0;
  for (const skill of BUILTIN_SKILLS) {
    let hits = 0;
    for (const kw of skill.keywords) {
      if (kw.includes(" ") ? text.includes(kw) : new RegExp("\\b" + kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b").test(text)) hits++;
    }
    const score = hits / skill.keywords.length;
    if (score > bestScore) { best = skill; bestScore = score; }
  }
  return { skill: best, confidence: Math.round(bestScore * 100) / 100 };
}

/**
 * Build a deterministic step plan from a skill's templates (fallback planner
 * when Groq is unavailable). "{{prompt}}" tokens are substituted.
 * @returns {{title, squad, tool_name, tool_args, depends_on, needs_approval}[]}
 */
export function planFromSkill(skill, prompt) {
  const sub = (v) => typeof v === "string" ? v.replaceAll("{{prompt}}", String(prompt).slice(0, 300)) : v;
  const steps = (skill.steps || []).map((tpl, i) => ({
    title: sub(tpl.title),
    squad: SQUADS.includes(tpl.squad) ? tpl.squad : "Delta",
    tool_name: tpl.tool_name,
    tool_args: Object.fromEntries(Object.entries(tpl.tool_args || {}).map(([k, v]) => [k, sub(v)])),
    depends_on: i === 0 ? [] : [i - 1],
    needs_approval: !!(tpl.needs_approval || APPROVAL_TOOLS.has(tpl.tool_name)),
  }));
  return steps.filter((s) => getTool(s.tool_name)); // drop steps for unknown tools
}

/**
 * Validate + register a custom skill for a workspace.
 * Steps must reference real registry tools.
 */
export async function createCustomSkill(db, workspaceId, { name, description, keywords, steps }) {
  const cleanName = String(name || "").trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_").slice(0, 60);
  if (!cleanName) throw new Error("Skill name is required");
  if (!Array.isArray(steps) || !steps.length) throw new Error("Skill needs at least one step template");
  for (const s of steps) {
    if (!getTool(s.tool_name)) throw new Error(`Unknown tool in skill: ${s.tool_name}`);
    if (!SQUADS.includes(s.squad)) throw new Error(`Unknown squad in skill: ${s.squad}`);
  }
  const row = {
    workspace_id: workspaceId,
    name: cleanName,
    description: String(description || "").slice(0, 300),
    keywords: (Array.isArray(keywords) ? keywords : []).map((k) => String(k).toLowerCase().slice(0, 40)).slice(0, 20),
    steps: steps.slice(0, 20),
    builtin: false,
  };
  const { data, error } = await db.from("skills").upsert(row, { onConflict: "workspace_id,name" }).select().single();
  if (error) throw new Error(error.message);
  return data;
}
