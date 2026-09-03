/* ============================================================
   PLUGINS — Kimi-style plugin store + the 60-agent tool map.

   Two jobs:
   1. PluginsPanel — a storefront (Installed / All / Featured /
      categories) rendered at the top of the Integrations Hub.
      Every card is honest: "Use" = works today, "Set up" = needs
      a key (with exact steps), "Soon" = needs OAuth we don't
      have yet. No fake "connected" badges.
   2. AGENT_TOOLKIT — which tools each of the 60 agents actually
      uses. The Task Runner injects this into the agent's system
      prompt so work is real and accurate, not generic chat.
   ============================================================ */
import { useState } from "react";
import { X, ArrowRight, CheckCircle2, Key, Puzzle } from "lucide-react";
import { CYAN, PURPLE, glass, btnPrimary, btnGhost, Card, AGENTS, SQUAD_META } from "./shared.jsx";

/* ---------- Tool dictionary (single source for labels + usage) ---------- */
export const TOOL_DEFS = {
  web_search:         { label: "web_search",          use: "Research the live topic before writing — ground the work in current facts" },
  study_topic:        { label: "study_topic",         use: "Produce a deep brief saved to the CEO knowledge base" },
  compose_whatsapp:   { label: "compose_whatsapp",    use: "Prepare a ready-to-send WhatsApp message (user taps to send)" },
  compose_email:      { label: "compose_email",       use: "Prepare a ready-to-send email (user taps to send)" },
  send_whatsapp_message: { label: "send_whatsapp_message", use: "Send via WhatsApp Business API — needs Meta keys, CEO approval" },
  send_instagram_dm:  { label: "send_instagram_dm",   use: "Send an Instagram DM via Meta API — needs keys, CEO approval" },
  create_lead:        { label: "create_lead",         use: "Add the lead you found to the pipeline" },
  update_lead_status: { label: "update_lead_status",  use: "Move a lead forward in the pipeline" },
  draft_invoice:      { label: "draft_invoice",       use: "Draft an invoice with real client + amount" },
  record_transaction: { label: "record_transaction",  use: "Record income/expense — approval required" },
  query_analytics:    { label: "query_analytics",     use: "Pull real numbers from the workspace before reporting" },
  create_task:        { label: "create_task",         use: "Create a tracked task on the board" },
  complete_task:      { label: "complete_task",       use: "Mark a task done after the work is delivered" },
  deliver_work:       { label: "deliver_work",        use: "Hand in the finished file — this is how work lands in Results" },
  self_edit_code:     { label: "self_edit_code",      use: "Propose code edits to this Command Center — approval required" },
  test_connector:     { label: "test_connector",      use: "Test a connector's credentials and reachability" },
  add_opportunity:    { label: "add_opportunity",     use: "Log a market opportunity you spotted" },
  save_contact:       { label: "save_contact",        use: "Save a client's phone/email so the fleet can reach them" },
  remember_fact:      { label: "remember_fact",       use: "Save a fact to long-term memory" },
};

/* ---------- The 60-agent tool map ----------
   Keyed by exact agent name (AGENT_NAMES in shared.jsx).
   fmt = preferred deliverable file extension for this agent. */
export const AGENT_TOOLKIT = {
  /* Squad Alpha — Lead Generation (01–15) */
  "Cold Outreach":        { tools: ["web_search", "create_lead", "compose_whatsapp", "compose_email", "deliver_work"], fmt: "md", note: "Research real Omani businesses first, add each as a lead, then write the outreach messages ready to send." },
  "Instagram Lead Gen":   { tools: ["web_search", "create_lead", "send_instagram_dm", "compose_whatsapp", "deliver_work"], fmt: "md", note: "Find real Oman-based accounts, log them as leads, draft the DM sequence." },
  "Email Campaigns":      { tools: ["web_search", "compose_email", "create_lead", "deliver_work"], fmt: "md", note: "Write the full sequence (subject lines + bodies), each email ready to send." },
  "Facebook Ads":         { tools: ["web_search", "study_topic", "add_opportunity", "deliver_work"], fmt: "md", note: "Deliver complete ad sets: audiences, angles, copy variants, budgets in OMR." },
  "Google Ads":           { tools: ["web_search", "study_topic", "query_analytics", "deliver_work"], fmt: "md", note: "Deliver keyword lists with match types, bids in OMR, and full ad copy." },
  "WhatsApp Bot":         { tools: ["compose_whatsapp", "send_whatsapp_message", "create_lead", "save_contact"], fmt: "md", note: "Design the actual chat flows and canned replies — bilingual (Arabic + English)." },
  "Landing Pages":        { tools: ["deliver_work", "web_search", "create_task"], fmt: "html", note: "Deliver a COMPLETE single-file HTML landing page — inline CSS, bilingual, mobile-first." },
  "SEO Keywords":         { tools: ["web_search", "study_topic", "deliver_work"], fmt: "md", note: "Deliver a real keyword map: primary/secondary/long-tail, Arabic + English, with search intent." },
  "Content Strategy":     { tools: ["study_topic", "web_search", "deliver_work", "create_task"], fmt: "md", note: "Deliver a full content calendar with angles, hooks, and channel per piece." },
  "Social Scheduler":     { tools: ["deliver_work", "create_task", "study_topic", "compose_whatsapp"], fmt: "md", note: "Deliver the posting schedule with the actual captions written out." },
  "Influencer Outreach":  { tools: ["web_search", "create_lead", "compose_email", "save_contact"], fmt: "md", note: "Find real Oman/GCC influencers, log them, draft the collab pitch." },
  "CRM Manager":          { tools: ["create_lead", "update_lead_status", "query_analytics", "save_contact"], fmt: "md", note: "Keep the pipeline truthful — every lead has a status and a next step." },
  "Proposal Writer":      { tools: ["deliver_work", "draft_invoice", "web_search"], fmt: "md", note: "Deliver a complete proposal: scope, pricing (OMR 99/500 packages), timeline in days, and the draft invoice." },
  "Pricing Analyst":      { tools: ["query_analytics", "web_search", "study_topic", "deliver_work"], fmt: "md", note: "Benchmark against real Oman/GCC agency pricing before recommending." },
  "Sales Closer":         { tools: ["compose_whatsapp", "compose_email", "draft_invoice", "create_lead"], fmt: "md", note: "Write the exact closing messages and the follow-up sequence." },

  /* Squad Beta — Delivery (16–30) */
  "Web Developer":        { tools: ["deliver_work", "web_search", "self_edit_code", "create_task"], fmt: "html", note: "Deliver COMPLETE working code — single-file HTML with inline CSS/JS unless told otherwise. No placeholders." },
  "UI/UX Designer":       { tools: ["deliver_work", "web_search", "study_topic"], fmt: "html", note: "Deliver the design as working HTML/CSS mockups — mobile-first, dark-premium aesthetic." },
  "E-commerce Specialist":{ tools: ["deliver_work", "web_search", "study_topic"], fmt: "html", note: "Deliver store pages/product layouts as complete HTML; pricing in OMR." },
  "Security Auditor":     { tools: ["web_search", "study_topic", "deliver_work", "test_connector"], fmt: "md", note: "Deliver a concrete findings list: severity, evidence, exact fix." },
  "Content Writer":       { tools: ["deliver_work", "web_search", "study_topic"], fmt: "md", note: "Deliver the full piece — bilingual where it helps the Omani market." },
  "Video Editor":         { tools: ["deliver_work", "study_topic", "create_task"], fmt: "md", note: "Deliver shot-by-shot scripts and edit notes a videographer can execute today." },
  "Graphic Designer":     { tools: ["deliver_work", "study_topic"], fmt: "svg", note: "Deliver logos/graphics as complete SVG code, plus usage notes." },
  "SEO On-Page":          { tools: ["web_search", "deliver_work", "query_analytics"], fmt: "md", note: "Deliver page-by-page fixes: titles, metas, headings, schema — ready to paste." },
  "SEO Off-Page":         { tools: ["web_search", "study_topic", "create_lead", "deliver_work"], fmt: "md", note: "Deliver a real backlink target list with outreach drafts." },
  "Social Media Manager": { tools: ["compose_whatsapp", "deliver_work", "create_task", "study_topic"], fmt: "md", note: "Deliver the week's posts written out in full — captions, hashtags, timings." },
  "Ad Copywriter":        { tools: ["deliver_work", "web_search", "study_topic"], fmt: "md", note: "Deliver 5+ complete ad variants per brief, headlines + body + CTA." },
  "Analytics Specialist": { tools: ["query_analytics", "deliver_work", "study_topic"], fmt: "md", note: "Report from REAL workspace numbers only — never invent metrics." },
  "QA Tester":            { tools: ["test_connector", "deliver_work", "create_task"], fmt: "md", note: "Deliver a pass/fail checklist with exact reproduction steps for every issue." },
  "Project Manager":      { tools: ["create_task", "complete_task", "query_analytics", "deliver_work"], fmt: "md", note: "Break work into board tasks with owners; deliver the plan." },
  "Account Manager":      { tools: ["compose_email", "compose_whatsapp", "create_task", "save_contact"], fmt: "md", note: "Deliver client-ready updates and check-in messages." },

  /* Squad Gamma — Intelligence (31–45) */
  "Market Research":      { tools: ["web_search", "study_topic", "deliver_work", "add_opportunity"], fmt: "md", note: "Deliver sourced market briefs on Oman/GCC — segments, sizes, gaps." },
  "Financial Analyst":    { tools: ["query_analytics", "record_transaction", "deliver_work"], fmt: "md", note: "Analyze from real transactions/invoices only; show the math." },
  "Competitor Tracker":   { tools: ["web_search", "study_topic", "deliver_work"], fmt: "md", note: "Name real competitors, their offers and prices, and our counter-move." },
  "Trend Forecaster":     { tools: ["web_search", "study_topic", "deliver_work"], fmt: "md", note: "Deliver trends with evidence and a 'what Qimmah does about it' section." },
  "Customer Insights":    { tools: ["web_search", "study_topic", "query_analytics"], fmt: "md", note: "Deliver persona briefs grounded in real Omani buyer behavior." },
  "Brand Strategist":     { tools: ["study_topic", "web_search", "deliver_work"], fmt: "md", note: "Deliver positioning, messaging pillars, and voice — with examples written out." },
  "Growth Hacker":        { tools: ["web_search", "add_opportunity", "deliver_work", "create_task"], fmt: "md", note: "Deliver ranked growth experiments: hypothesis, cost, expected impact." },
  "Data Scientist":       { tools: ["query_analytics", "study_topic", "deliver_work"], fmt: "md", note: "Analyze real data; state plainly when the data isn't there yet." },
  "Arabic Content":       { tools: ["deliver_work", "study_topic", "web_search"], fmt: "md", note: "Deliver polished Gulf-Arabic copy with the English version alongside." },
  "Localization":         { tools: ["deliver_work", "study_topic"], fmt: "md", note: "Deliver full bilingual versions — culturally right for Oman, not literal translation." },
  "Reputation Manager":   { tools: ["web_search", "compose_email", "create_task"], fmt: "md", note: "Deliver review-response templates and monitoring checklists." },
  "Technical SEO":        { tools: ["web_search", "study_topic", "deliver_work"], fmt: "md", note: "Deliver concrete technical fixes: schema, sitemaps, speed, hreflang." },
  "Backlink Analyst":     { tools: ["web_search", "study_topic", "deliver_work"], fmt: "md", note: "Deliver qualified link prospects with domain context and outreach angle." },
  "Keyword Tracker":      { tools: ["web_search", "study_topic", "deliver_work"], fmt: "md", note: "Deliver tracked keyword tables: term, intent, target page, priority." },
  "Content Gap Analyzer": { tools: ["web_search", "study_topic", "deliver_work"], fmt: "md", note: "Deliver the topics competitors rank for that we don't — with the plan to take them." },

  /* Squad Delta — Operations (46–55) */
  "Process Automation":   { tools: ["create_task", "complete_task", "test_connector", "deliver_work"], fmt: "md", note: "Deliver step-by-step automation runbooks the team can follow." },
  "Chatbot Builder":      { tools: ["deliver_work", "self_edit_code", "create_task"], fmt: "md", note: "Deliver full conversation trees — bilingual, with fallback paths." },
  "Email Automation":     { tools: ["compose_email", "create_task", "deliver_work"], fmt: "md", note: "Deliver complete drip sequences with triggers and timing." },
  "CRM Automator":        { tools: ["create_lead", "update_lead_status", "test_connector"], fmt: "md", note: "Keep lead data clean and moving; flag anything stuck." },
  "Invoice Generator":    { tools: ["draft_invoice", "record_transaction", "deliver_work"], fmt: "md", note: "Draft invoices with real clients and amounts from the workspace." },
  "Appointment Scheduler":{ tools: ["compose_whatsapp", "compose_email", "create_task"], fmt: "md", note: "Deliver scheduling messages ready to send with proposed times." },
  "Document Processor":   { tools: ["deliver_work", "study_topic"], fmt: "md", note: "Deliver clean, structured documents from messy inputs." },
  "Social Listening":     { tools: ["web_search", "study_topic", "deliver_work"], fmt: "md", note: "Deliver mention/sentiment digests with the recommended response." },
  "Report Generator":     { tools: ["query_analytics", "deliver_work", "study_topic"], fmt: "md", note: "Deliver client-ready reports built only from real workspace data." },
  "Quality Assurance":    { tools: ["test_connector", "query_analytics", "deliver_work"], fmt: "md", note: "Deliver QA sign-off checklists with evidence for every pass." },

  /* Squad Epsilon — Innovation (56–60) */
  "AI Prompt Engineer":   { tools: ["study_topic", "deliver_work", "self_edit_code"], fmt: "md", note: "Deliver tested prompt templates with example inputs/outputs." },
  "Tech Researcher":      { tools: ["web_search", "study_topic", "deliver_work"], fmt: "md", note: "Deliver tool evaluations: what it does, pricing, fit for Qimmah." },
  "Integration Specialist":{ tools: ["test_connector", "self_edit_code", "deliver_work"], fmt: "md", note: "Deliver connection guides with exact steps and honest limits." },
  "Training Coordinator": { tools: ["study_topic", "deliver_work", "create_task"], fmt: "md", note: "Deliver training material the team can use word-for-word." },
  "Innovation Lead":      { tools: ["study_topic", "web_search", "deliver_work", "add_opportunity"], fmt: "md", note: "Deliver opportunity briefs: new services Qimmah can sell within weeks." },
};

/* Squad-level fallback if a name is ever missing from the map. */
const SQUAD_DEFAULT_TOOLS = {
  Alpha:   ["web_search", "create_lead", "compose_whatsapp", "deliver_work"],
  Beta:    ["deliver_work", "web_search", "study_topic"],
  Gamma:   ["web_search", "study_topic", "deliver_work"],
  Delta:   ["create_task", "query_analytics", "deliver_work"],
  Epsilon: ["study_topic", "web_search", "deliver_work"],
};

export function toolkitFor(agent) {
  const named = AGENT_TOOLKIT[agent.name];
  if (named) return named;
  return { tools: SQUAD_DEFAULT_TOOLS[agent.squad] || ["deliver_work"], fmt: "md", note: "Do the complete work and hand in the finished file." };
}

/* ---------- Design training — the 5 sources every design agent studies FIRST ----------
   Taught to all agents that deliver visual work (html/svg). Design from
   evidence, not vibes. */
export const DESIGN_SOURCES = [
  { name: "Refero", url: "styles.refero.design", what: "2,000+ real DESIGN.md systems from leading sites — colors, typography, spacing, component rules" },
  { name: "Mobbin", url: "mobbin.com", what: "1,400+ real apps & sites, 620k+ screens, 320k+ user flows — proven patterns (onboarding, checkout, paywalls)" },
  { name: "SupaHero", url: "supahero.io", what: "Curated hero-section library — how top sites structure the first screen (headline, CTA, hierarchy)" },
  { name: "21st.dev", url: "21st.dev", what: "10,000+ production React/Tailwind component patterns — navbars, pricing, forms, built by design engineers" },
  { name: "Motion", url: "motion.dev", what: "Free MIT animation library (springs, scroll effects, gestures) — apply its patterns as GPU-friendly CSS transform/opacity transitions" },
];

export function designTrainingNote(agent) {
  const tk = toolkitFor(agent);
  if (tk.fmt !== "html" && tk.fmt !== "svg") return "";
  return "\n\nDESIGN TRAINING — study these sources FIRST, before any visual work:\n"
    + DESIGN_SOURCES.map((s) => "- " + s.name + " (" + s.url + "): " + s.what).join("\n")
    + "\nRULES: Pick ONE reference system per job and follow its palette/type/spacing. Copy the SYSTEM, never clone the site."
    + " Use proven patterns from these libraries instead of inventing layouts. Name the pattern you applied in your handoff note.";
}

/* Prompt snippet injected by the Task Runner — tells the agent exactly
   which tools it owns and how to make the work REAL. */
export function agentToolkitNote(agent) {
  const tk = toolkitFor(agent);
  const lines = tk.tools.map((id) => {
    const d = TOOL_DEFS[id];
    return d ? "- " + d.label + ": " + d.use : null;
  }).filter(Boolean).join("\n");
  const fmtLine = tk.fmt === "html"
    ? "Your filename MUST end in .html — deliver a complete, working single-file page (inline CSS/JS, mobile-first)."
    : tk.fmt === "svg"
      ? "Your filename MUST end in .svg — deliver complete, valid SVG markup."
      : "Your filename should end in .md — clean markdown the CEO can read and reuse.";
  return "\n\nYOUR TOOLKIT — you are the specialist; use these to make the work REAL:\n" + lines
    + "\nWorking style: " + tk.note
    + designTrainingNote(agent)
    + "\nDELIVERABLE FORMAT: " + fmtLine;
}

/* ---------- Plugin catalog (Kimi-style storefront) ----------
   kind: builtin (always on) · key (needs an API key) · free (works,
   opens externally) · soon (needs OAuth — honest about it).          */
export const PLUGIN_CATEGORIES = ["Installed", "All", "Featured", "Productivity", "Creativity & 3D", "Developer Tools", "Research", "Finance"];

export const PLUGIN_CATALOG = [
  /* ---- Built-in, working today ---- */
  { id: "task-runner", name: "Task Runner", icon: "⚙️", tint: "#FFB020", tagline: "Agents execute board tasks end-to-end", cats: ["Featured", "Productivity"], kind: "builtin",
    about: "The autonomous executor: picks up In Progress tasks, runs them with the best-fit specialist, and hands the deliverable into Review — in minutes, while the app is open.",
    powers: "All 60 agents", tools: ["deliver_work", "create_task", "complete_task"] },
  { id: "preview-publish", name: "Preview & Publish", icon: "📦", tint: "#22D3EE", tagline: "Review agent work in-app, publish like Kimi", cats: ["Featured", "Productivity"], kind: "builtin",
    about: "Tap any deliverable badge to preview it in-app (markdown or sandboxed HTML) — no download needed. Publish ships HTML to a public URL via GitHub.",
    powers: "All 60 agents", tools: ["deliver_work"] },
  { id: "ceo-actions", name: "CEO Chat Actions", icon: "💬", tint: "#7C3AED", tagline: "Tasks, invoices and outreach straight from chat", cats: ["Featured", "Productivity"], kind: "builtin",
    about: "The AI CEO takes real actions mid-conversation: create/move tasks, draft invoices, compose WhatsApp & email, save contacts, remember facts, deliver files.",
    powers: "AI CEO + Squad leads", tools: ["create_task", "draft_invoice", "compose_whatsapp", "compose_email", "deliver_work"] },
  { id: "study-mode", name: "Study Mode", icon: "🔬", tint: "#A78BFA", tagline: "Live web research with saved sources", cats: ["Featured", "Research"], kind: "builtin",
    about: "Groq Compound searches the live web; every brief is saved forever in the CEO knowledge base with the pages it actually visited.",
    powers: "Gamma squad + CEO Brain", tools: ["web_search", "study_topic"] },
  { id: "neural-voice", name: "Neural Voice (Free)", icon: "🔊", tint: "#34D399", tagline: "Browser speech — no API key needed", cats: ["Creativity & 3D"], kind: "builtin",
    about: "The CEO speaks replies using the device's neural voices. Free forever, works offline of any TTS provider.",
    powers: "AI CEO", tools: [] },
  { id: "wa-composer", name: "WhatsApp Composer", icon: "🟢", tint: "#25D366", tagline: "Real messages via wa.me — no API needed", cats: ["Featured", "Productivity"], kind: "builtin",
    about: "Composes real WhatsApp messages and opens them in your app, ready to send. Works today with zero setup.",
    powers: "Alpha squad, Account Manager", tools: ["compose_whatsapp"] },
  { id: "email-composer", name: "Email Composer", icon: "✉️", tint: "#FBBF24", tagline: "Pre-filled emails in your mail app", cats: ["Productivity"], kind: "builtin",
    about: "Drafts complete emails (to, subject, body) and opens them in your real mail app. Bulk automation needs an email service key.",
    powers: "Alpha + Delta squads", tools: ["compose_email"] },
  { id: "live-feed", name: "Live Feed", icon: "📡", tint: "#F472B6", tagline: "Truthful log of everything the fleet does", cats: ["Productivity"], kind: "builtin",
    about: "Every chat, task move, invoice, message and agent action lands here in real time.",
    powers: "Whole fleet", tools: [] },
  { id: "mcp-tools", name: "MCP Tool System", icon: "🧰", tint: "#06B6D4", tagline: "13 governed tools · 6-gate executor", cats: ["Developer Tools", "Featured"], kind: "builtin",
    about: "The backend tool registry with squad budgets, approval gates for sensitive actions, and a live execution log. External MCP clients can discover it at /api/mcp/discover.",
    powers: "All squads (budget-governed)", tools: ["web_search", "study_topic", "send_whatsapp_message", "send_instagram_dm", "create_lead", "update_lead_status", "record_transaction", "draft_invoice", "create_task", "complete_task", "self_edit_code", "query_analytics", "test_connector"] },

  /* ---- Key-based (installed when the key is set) ---- */
  { id: "groq", name: "Groq AI Engine", icon: "⚡", tint: "#F55036", tagline: "The brain powering all 60 agents", cats: ["Featured", "Developer Tools"], kind: "key",
    isOn: (S) => Boolean(S.groqKey),
    about: "Every agent's work runs through Groq's fast models with an automatic fallback chain (GPT-OSS 120B → Qwen 3.6 → Kimi K2 → Llama 4 Scout).",
    steps: ["Open the AI CEO tab → Settings", "Paste a key from console.groq.com (free tier works)", "The whole fleet lights up instantly"],
    powers: "All 60 agents", tools: ["web_search", "study_topic"] },
  { id: "elevenlabs", name: "ElevenLabs Voice", icon: "🎙️", tint: "#E9E4FB", tagline: "Studio-grade voice for the AI CEO", cats: ["Creativity & 3D"], kind: "key",
    isOn: (S) => Boolean(S.elKey),
    about: "Premium neural voices for CEO replies. Without a key, the free browser voice takes over automatically.",
    steps: ["Get a key at elevenlabs.io", "AI CEO tab → Settings → paste it", "Pick a voice (Rachel, Grace, Bella, Elli)"],
    powers: "AI CEO", tools: [] },
  { id: "github-edit", name: "GitHub Self-Edit", icon: "🐙", tint: "#C9D1D9", tagline: "The CEO improves this app itself", cats: ["Developer Tools"], kind: "key", scrollTo: "vault-github",
    isOn: (S) => Boolean(S.github && S.github.token && S.github.connectedAt),
    about: "Ask the CEO for a change and it edits this Command Center's code and publishes deliverables to /published. Human-approved flow, max 3 files per commit.",
    steps: ["Create a fine-grained token at github.com/settings/personal-access-tokens", "Repo access: this repo only · Contents: Read and write", "Paste it in the GitHub card below → Test connection"],
    powers: "Web Developer, Integration Specialist, AI Prompt Engineer", tools: ["self_edit_code"] },
  { id: "whatsapp-api", name: "WhatsApp Business API", icon: "📱", tint: "#25D366", tagline: "Full automation for client messaging", cats: ["Productivity", "Finance"], kind: "key", scrollTo: "vault-whatsapp",
    isOn: (S) => Boolean(S.integrations && S.integrations.whatsapp && S.integrations.whatsapp.token && S.integrations.whatsapp.phoneNumberId),
    about: "Unlocks true automated sending (approval-gated). Without it, the wa.me composer still covers manual sending.",
    steps: ["Create a Meta app at developers.facebook.com → add the WhatsApp product", "Copy the Access Token (make it permanent via System Users) + Phone Number ID", "Paste both in the WhatsApp card below"],
    powers: "Cold Outreach, WhatsApp Bot, Sales Closer", tools: ["send_whatsapp_message", "compose_whatsapp"] },
  { id: "instagram-api", name: "Instagram Graph API", icon: "📸", tint: "#E1306C", tagline: "DMs and publishing for @qimmah.digital", cats: ["Productivity"], kind: "key", scrollTo: "vault-instagram",
    isOn: (S) => Boolean(S.integrations && S.integrations.instagram && S.integrations.instagram.token),
    about: "Automated Instagram DMs and insights via Meta. Needs a verified Business account and app review.",
    steps: ["Add the Instagram Graph API product to your Meta app", "Create a long-lived token via Graph API Explorer", "Paste token + App ID + App Secret below"],
    powers: "Instagram Lead Gen, Social Media Manager", tools: ["send_instagram_dm"] },
  { id: "video-host", name: "Video Hosting", icon: "▶️", tint: "#FF0000", tagline: "YouTube / Vimeo / S3 for client video", cats: ["Creativity & 3D"], kind: "key", scrollTo: "vault-video",
    isOn: (S) => Boolean(S.integrations && S.integrations.video && S.integrations.video.key),
    about: "Connect a video platform so the Video Editor's output has somewhere real to live.",
    steps: ["YouTube: API key at console.cloud.google.com (enable YouTube Data API v3)", "Vimeo: developer.vimeo.com → generate access token", "Paste it in the Video card below"],
    powers: "Video Editor, Social Media Manager", tools: [] },
  { id: "supabase", name: "Supabase Backend", icon: "🗄️", tint: "#34D399", tagline: "Real database for leads, goals, executions", cats: ["Developer Tools"], kind: "key",
    isOn: (S) => Boolean(S.backendOn),
    about: "The server-side brain: MCP executions, approvals, goals and sessions persist here. Set the env vars in Vercel and run the 3 schema SQL files.",
    steps: ["Set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY + JWT_SECRET in Vercel", "Run backend/schema.sql, schema-mcp.sql, schema-goals.sql in Supabase", "Sign in — the Backend pill on Overview turns green"],
    powers: "Whole fleet (persistence)", tools: ["query_analytics", "record_transaction"] },

  /* ---- Free / external, work today ---- */
  { id: "world-bank", name: "World Bank Data", icon: "🌍", tint: "#60A5FA", tagline: "Oman & GCC economic indicators, free", cats: ["Research", "Finance"], kind: "free",
    about: "29,000+ development indicators — GDP, population, trade — for market sizing briefs. Free public API, no key.",
    steps: ["Ask the CEO: 'study Oman's economy using World Bank data'"],
    powers: "Market Research, Financial Analyst", tools: ["web_search", "study_topic"] },
  { id: "academic", name: "Academic Data", icon: "🎓", tint: "#3B82F6", tagline: "Scholarly search for deep briefs", cats: ["Research"], kind: "free",
    about: "Papers, citations and author profiles for evidence-backed strategy work. Free scholarly search engines.",
    steps: ["Ask the CEO to study a topic — sources are saved automatically"],
    powers: "Gamma squad", tools: ["study_topic", "web_search"] },
  { id: "context7", name: "Context7 Docs", icon: "📚", tint: "#10B981", tagline: "Up-to-date library documentation", cats: ["Developer Tools"], kind: "free",
    about: "Live documentation lookup for the frameworks this app is built on — keeps code work accurate.",
    steps: ["Ask the Web Developer agent for code — it researches current docs first"],
    powers: "Web Developer, AI Prompt Engineer", tools: ["web_search", "study_topic"] },

  /* ---- Design training library (free external sources — taught to all design agents) ---- */
  { id: "refero", name: "Refero DESIGN.md", icon: "🎨", tint: "#A78BFA", tagline: "2,000+ AI-readable design systems from real sites", cats: ["Creativity & 3D", "Developer Tools", "Featured"], kind: "free",
    about: "Every leading website distilled into a DESIGN.md: exact colors, typography, spacing rhythm, component rules. Agents design from evidence, not vibes — paste a reference system, then build.",
    steps: ["Already taught to all design agents — they study it before any visual work", "Browse styles.refero.design to pick a style yourself"],
    powers: "UI/UX Designer, Web Developer, Graphic Designer, Landing Pages", tools: ["study_topic", "web_search", "deliver_work"] },
  { id: "mobbin", name: "Mobbin", icon: "📱", tint: "#34D399", tagline: "1,400+ real apps · 620k screens · 320k flows", cats: ["Creativity & 3D", "Research"], kind: "free",
    about: "The world's largest UI/UX reference library. Real screens and complete user flows from top apps — onboarding, checkout, paywalls, profiles. Agents study proven patterns instead of inventing layouts.",
    steps: ["Taught to design agents as their pattern library", "Free plan at mobbin.com — browse the latest apps"],
    powers: "UI/UX Designer, App Developer, Web Developer", tools: ["web_search", "study_topic"] },
  { id: "supahero", name: "SupaHero", icon: "🦸", tint: "#FBBF24", tagline: "Curated hero sections from top websites", cats: ["Creativity & 3D"], kind: "free",
    about: "A handpicked library of stunning website hero sections. The first screen decides if a visitor stays — agents study how the best sites structure headline, CTA and visual hierarchy.",
    steps: ["Taught to Landing Pages + Web Developer agents", "Browse supahero.io for hero inspiration"],
    powers: "Landing Pages, Web Developer, UI/UX Designer", tools: ["web_search", "deliver_work"] },
  { id: "twentyfirst", name: "21st.dev Components", icon: "🧱", tint: "#60A5FA", tagline: "10,000+ production UI component patterns", cats: ["Developer Tools", "Creativity & 3D"], kind: "free",
    about: "The 'npm for design engineers' — community-built React/Tailwind components (navbars, pricing, forms, heroes) with AI-ready prompts. Agents build with proven component patterns, not from scratch.",
    steps: ["Taught to Web Developer + UI/UX agents", "Browse 21st.dev — 2 free component copies daily"],
    powers: "Web Developer, UI/UX Designer, App Developer", tools: ["deliver_work", "web_search"] },
  { id: "motion", name: "Motion Animations", icon: "✨", tint: "#F472B6", tagline: "Free MIT animation library — springs, scroll, gestures", cats: ["Creativity & 3D", "Developer Tools"], kind: "free",
    about: "Production-grade animation (formerly Framer Motion), trusted by Framer and Figma. 430+ copy-paste examples. Agents apply its patterns as GPU-friendly CSS transform/opacity transitions in single-file pages.",
    steps: ["Taught to all design agents — animate with transform/opacity only", "Docs + examples at motion.dev"],
    powers: "Web Developer, UI/UX Designer, Video Editor", tools: ["deliver_work", "web_search"] },

  /* ---- Coming soon (honest: needs OAuth we haven't built yet) ---- */
  { id: "composio", name: "Composio (500+ apps)", icon: "🧩", tint: "#F97316", tagline: "One key → Gmail, Notion, Slack, 500 more", cats: ["Featured", "Developer Tools"], kind: "soon",
    about: "The fastest route to a Kimi-sized plugin catalog: one Composio API key unlocks 500+ managed-OAuth apps as agent tools. Free tier covers 20k tool calls/month.",
    steps: ["Recommended next upgrade — researched and ready", "Sign up at composio.dev → one API key", "We wire it in as a single MCP server"] },
  { id: "notion", name: "Notion", icon: "📝", tint: "#E9E4FB", tagline: "Docs & knowledge base sync", cats: ["Productivity"], kind: "soon",
    about: "Sync deliverables and knowledge into a Notion workspace. Notion ships a hosted MCP server — we connect when OAuth login lands.",
    steps: ["Needs OAuth sign-in flow — on the roadmap"] },
  { id: "gdrive", name: "Google Drive", icon: "📁", tint: "#FBBF24", tagline: "Client files & asset storage", cats: ["Productivity"], kind: "soon",
    about: "Store and fetch client assets from Drive. Coming with the OAuth connect flow.",
    steps: ["Needs OAuth sign-in flow — on the roadmap"] },
  { id: "canva", name: "Canva", icon: "🎨", tint: "#8B5CF6", tagline: "Design templates for client work", cats: ["Creativity & 3D"], kind: "soon",
    about: "Generate on-brand designs from templates. Canva ships an official MCP server — connectable once OAuth lands.",
    steps: ["Needs OAuth sign-in flow — on the roadmap"] },
  { id: "google-ads", name: "Google Ads", icon: "📈", tint: "#34D399", tagline: "Live campaign data & management", cats: ["Finance"], kind: "soon",
    about: "Pull real campaign performance into Analytics and let the Google Ads agent optimize from live data.",
    steps: ["Needs a Google Ads developer token + OAuth — on the roadmap"] },
  { id: "meta-ads", name: "Meta Ads", icon: "📊", tint: "#1877F2", tagline: "Facebook & Instagram ads data", cats: ["Finance"], kind: "soon",
    about: "Real spend and ROAS from Meta campaigns, feeding the Facebook Ads agent.",
    steps: ["Needs Meta Marketing API access — on the roadmap"] },
  { id: "cloudflare", name: "Cloudflare", icon: "☁️", tint: "#F97316", tagline: "CDN, DNS & edge for client sites", cats: ["Developer Tools"], kind: "soon",
    about: "Manage DNS and caching for client websites from the Command Center.",
    steps: ["Needs a Cloudflare API token — on the roadmap"] },
];

export function pluginStatus(p, S) {
  if (p.kind === "builtin" || p.kind === "free") return "installed";
  if (p.kind === "key") return p.isOn && p.isOn(S) ? "installed" : "setup";
  return "soon"; // oauth/soon
}

/* ============================================================
   PluginsPanel — the Kimi-style storefront.
   Rendered at the top of the Integrations Hub.
   ============================================================ */
export function PluginsPanel({ S, log }) {
  const [cat, setCat] = useState("Installed");
  const [open, setOpen] = useState(null); // plugin id in the detail modal

  const list = PLUGIN_CATALOG.filter((p) => {
    if (cat === "All") return true;
    if (cat === "Installed") return pluginStatus(p, S) === "installed";
    return (p.cats || []).includes(cat);
  });
  const installedCount = PLUGIN_CATALOG.filter((p) => pluginStatus(p, S) === "installed").length;
  const active = open ? PLUGIN_CATALOG.find((p) => p.id === open) : null;

  function statusButton(p) {
    const st = pluginStatus(p, S);
    if (st === "installed") return { label: "Use", bg: "rgba(52,211,153,0.14)", color: "#34D399", border: "rgba(52,211,153,0.4)" };
    if (st === "setup") return { label: "Set up", bg: "rgba(251,191,36,0.12)", color: "#FBBF24", border: "rgba(251,191,36,0.4)" };
    return { label: "Soon", bg: "rgba(255,255,255,0.06)", color: "#8B86A3", border: "rgba(255,255,255,0.14)" };
  }

  return (
    <Card style={{ marginBottom: 18, padding: 0, overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "16px 18px 10px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <Puzzle size={16} style={{ color: CYAN }} />
          <span style={{ fontSize: 15, fontWeight: 700, color: "#F5F3FF", fontFamily: "'Space Grotesk', sans-serif" }}>Plugins</span>
          <span style={{ fontSize: 11, color: "#8B86A3" }}>{installedCount} installed · {PLUGIN_CATALOG.length} in catalog</span>
        </div>
        <span style={{ fontSize: 10.5, color: "#6B6685" }}>Kimi-style — every card states honestly what works today</span>
      </div>

      {/* Category tabs */}
      <div style={{ display: "flex", gap: 6, padding: "4px 18px 12px", overflowX: "auto", scrollbarWidth: "none" }}>
        {PLUGIN_CATEGORIES.map((c) => (
          <button key={c} onClick={() => setCat(c)} style={{
            flexShrink: 0, padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
            background: cat === c ? "rgba(124,58,237,0.25)" : "rgba(255,255,255,0.05)",
            color: cat === c ? "#E9E4FB" : "#8B86A3",
            border: "1px solid " + (cat === c ? "rgba(124,58,237,0.55)" : "rgba(255,255,255,0.1)"),
          }}>{c}</button>
        ))}
      </div>

      {/* Plugin rows — Kimi list style */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "0 14px 16px" }}>
        {list.length === 0 && (
          <div style={{ fontSize: 12.5, color: "#8B86A3", padding: "14px 6px" }}>Nothing in this category yet.</div>
        )}
        {list.map((p) => {
          const b = statusButton(p);
          return (
            <div key={p.id} style={{ ...glass, borderRadius: 14, padding: "11px 14px", display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{
                width: 42, height: 42, borderRadius: 12, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 20, background: p.tint + "22", border: "1px solid " + p.tint + "44",
              }}>{p.icon}</span>
              <button onClick={() => setOpen(p.id)} style={{ flex: 1, minWidth: 0, background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}>
                <div style={{ fontSize: 14, fontWeight: 650, color: "#F5F3FF" }}>{p.name}</div>
                <div style={{ fontSize: 12, color: "#8B86A3", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.tagline}</div>
              </button>
              <button onClick={() => setOpen(p.id)} style={{
                flexShrink: 0, padding: "7px 16px", borderRadius: 20, fontSize: 12.5, fontWeight: 650, cursor: "pointer", fontFamily: "inherit",
                background: b.bg, color: b.color, border: "1px solid " + b.border,
              }}>{b.label}</button>
            </div>
          );
        })}
      </div>

      {/* Detail modal */}
      {active && (
        <div onClick={() => setOpen(null)} style={{
          position: "fixed", inset: 0, zIndex: 80, background: "rgba(5,3,10,0.7)",
          backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: 18,
        }}>
          <div onClick={(e) => e.stopPropagation()} style={{ ...glass, background: "rgba(18,12,30,0.92)", borderRadius: 18, padding: 22, maxWidth: 480, width: "100%", maxHeight: "82vh", overflowY: "auto" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
              <span style={{ width: 52, height: 52, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, background: active.tint + "22", border: "1px solid " + active.tint + "44", flexShrink: 0 }}>{active.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 17, fontWeight: 700, color: "#F5F3FF" }}>{active.name}</div>
                <div style={{ fontSize: 12.5, color: "#8B86A3", marginTop: 2 }}>{active.tagline}</div>
              </div>
              <button onClick={() => setOpen(null)} style={{ ...btnGhost, padding: "6px 9px" }}><X size={14} /></button>
            </div>

            <p style={{ fontSize: 13, color: "#C9C4DC", lineHeight: 1.7, margin: "0 0 14px" }}>{active.about}</p>

            {active.powers && (
              <div style={{ fontSize: 12, color: "#A5A0B8", marginBottom: 12 }}>
                <span style={{ color: CYAN, fontWeight: 600 }}>Powers: </span>{active.powers}
              </div>
            )}

            {active.tools && active.tools.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
                {active.tools.map((t) => (
                  <span key={t} style={{ fontSize: 10.5, fontFamily: "monospace", color: "#A5F3FC", background: "rgba(6,182,212,0.1)", border: "1px solid rgba(6,182,212,0.25)", borderRadius: 6, padding: "2px 8px" }}>{t}</span>
                ))}
              </div>
            )}

            {active.steps && active.steps.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", color: "#8B86A3", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                  <Key size={11} /> How to connect
                </div>
                {active.steps.map((s, i) => (
                  <div key={i} style={{ display: "flex", gap: 9, fontSize: 12.5, color: "#C9C4DC", lineHeight: 1.6, marginBottom: 6 }}>
                    <span style={{ color: PURPLE, fontWeight: 700, flexShrink: 0 }}>{i + 1}.</span> {s}
                  </div>
                ))}
              </div>
            )}

            {pluginStatus(active, S) === "installed" && (
              <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: "#34D399", marginBottom: 12 }}>
                <CheckCircle2 size={13} /> Installed and working today
              </div>
            )}
            {pluginStatus(active, S) === "soon" && (
              <div style={{ fontSize: 11.5, color: "#FDE68A", background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.3)", borderRadius: 10, padding: "9px 12px", lineHeight: 1.6, marginBottom: 12 }}>
                Honest limits: this one needs OAuth sign-in we haven't built yet. It's on the roadmap — no fake "connected" badge here.
              </div>
            )}

            {active.scrollTo && pluginStatus(active, S) === "setup" && (
              <button style={{ ...btnPrimary, width: "100%", justifyContent: "center" }}
                onClick={() => {
                  setOpen(null);
                  setTimeout(() => {
                    const el = document.getElementById(active.scrollTo);
                    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
                  }, 60);
                  if (log) log("integration", "Plugin setup opened: " + active.name);
                }}>
                Open the setup card <ArrowRight size={14} />
              </button>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

/* Agents that use a given tool — for future "powered by" views. */
export function agentsUsingTool(toolId) {
  return AGENTS.filter((a) => toolkitFor(a).tools.includes(toolId))
    .map((a) => a.code + " " + a.name + " (" + (SQUAD_META[a.squad] || {}).role + ")");
}
