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
  send_telegram:      { label: "send_telegram",       use: "Send a real Telegram message to the CEO's phone via the vault bot — instant and free" },
  make_call:          { label: "make_call",           use: "Place a real AI voice phone call via Vapi/Bland from the vault — the phone actually rings" },
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
  "Cold Outreach":        { tools: ["web_search", "create_lead", "compose_whatsapp", "compose_email", "make_call", "deliver_work"], fmt: "md", note: "Research real Omani businesses first, add each as a lead, then write the outreach messages ready to send. When the CEO asks for a presell call, hand the call task to make_call." },
  "Instagram Lead Gen":   { tools: ["web_search", "create_lead", "send_instagram_dm", "compose_whatsapp", "deliver_work"], fmt: "md", note: "Find real Oman-based accounts, log them as leads, draft the DM sequence." },
  "Email Campaigns":      { tools: ["web_search", "compose_email", "create_lead", "deliver_work"], fmt: "md", note: "Write the full sequence (subject lines + bodies), each email ready to send." },
  "Facebook Ads":         { tools: ["web_search", "study_topic", "add_opportunity", "deliver_work"], fmt: "md", note: "Deliver complete ad sets: audiences, angles, copy variants, budgets in OMR." },
  "Google Ads":           { tools: ["web_search", "study_topic", "query_analytics", "deliver_work"], fmt: "md", note: "Deliver keyword lists with match types, bids in OMR, and full ad copy." },
  "WhatsApp Bot":         { tools: ["compose_whatsapp", "send_whatsapp_message", "send_telegram", "create_lead", "save_contact"], fmt: "md", note: "Design the actual chat flows and canned replies — bilingual (Arabic + English). Telegram is the free instant channel to the CEO's phone — use send_telegram for alerts." },
  "Landing Pages":        { tools: ["deliver_work", "web_search", "create_task"], fmt: "html", note: "Deliver a COMPLETE single-file HTML landing page — inline CSS, bilingual, mobile-first." },
  "SEO Keywords":         { tools: ["web_search", "study_topic", "deliver_work"], fmt: "md", note: "Deliver a real keyword map: primary/secondary/long-tail, Arabic + English, with search intent." },
  "Content Strategy":     { tools: ["study_topic", "web_search", "deliver_work", "create_task"], fmt: "md", note: "Deliver a full content calendar with angles, hooks, and channel per piece." },
  "Social Scheduler":     { tools: ["deliver_work", "create_task", "study_topic", "compose_whatsapp"], fmt: "md", note: "Deliver the posting schedule with the actual captions written out." },
  "Influencer Outreach":  { tools: ["web_search", "create_lead", "compose_email", "save_contact"], fmt: "md", note: "Find real Oman/GCC influencers, log them, draft the collab pitch." },
  "CRM Manager":          { tools: ["create_lead", "update_lead_status", "query_analytics", "save_contact"], fmt: "md", note: "Keep the pipeline truthful — every lead has a status and a next step." },
  "Proposal Writer":      { tools: ["deliver_work", "draft_invoice", "web_search"], fmt: "md", note: "Deliver a complete proposal: scope, pricing (OMR 99/500 packages), timeline in days, and the draft invoice." },
  "Pricing Analyst":      { tools: ["query_analytics", "web_search", "study_topic", "deliver_work"], fmt: "md", note: "Benchmark against real Oman/GCC agency pricing before recommending." },
  "Sales Closer":         { tools: ["compose_whatsapp", "compose_email", "draft_invoice", "create_lead", "make_call"], fmt: "md", note: "Write the exact closing messages and the follow-up sequence. When a hot lead needs a voice, prepare the make_call task — what the AI should say on the phone." },

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
  "Account Manager":      { tools: ["compose_email", "compose_whatsapp", "send_telegram", "create_task", "save_contact"], fmt: "md", note: "Deliver client-ready updates and check-in messages. Use send_telegram to keep the CEO posted instantly." },

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
  "Process Automation":   { tools: ["create_task", "complete_task", "test_connector", "send_telegram", "deliver_work"], fmt: "md", note: "Deliver step-by-step automation runbooks the team can follow. send_telegram is the notification leg of every automation — the alert that reaches the CEO's phone." },
  "Chatbot Builder":      { tools: ["deliver_work", "self_edit_code", "create_task"], fmt: "md", note: "Deliver full conversation trees — bilingual, with fallback paths." },
  "Email Automation":     { tools: ["compose_email", "create_task", "deliver_work"], fmt: "md", note: "Deliver complete drip sequences with triggers and timing." },
  "CRM Automator":        { tools: ["create_lead", "update_lead_status", "test_connector"], fmt: "md", note: "Keep lead data clean and moving; flag anything stuck." },
  "Invoice Generator":    { tools: ["draft_invoice", "record_transaction", "deliver_work"], fmt: "md", note: "Draft invoices with real clients and amounts from the workspace." },
  "Appointment Scheduler":{ tools: ["compose_whatsapp", "compose_email", "make_call", "create_task"], fmt: "md", note: "Deliver scheduling messages ready to send with proposed times. Use make_call for voice reminders when the CEO asks for one." },
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
    + " Use proven patterns from these libraries instead of inventing layouts. Name the pattern you applied in your handoff note."
    + " DIAGRAMS: when the deliverable includes an architecture, flow, funnel or process diagram, deliver it as Mermaid code or clean hand-built SVG (Diagram Design repo patterns) — editorial quality, never ASCII art.";
}

/* ---------- AI security reference — taught to security-adjacent agents ----------
   The AI Security Hub repo (github.com/sonuoffsec/AI-Security-Hub) is the
   fleet's reference base for LLM / MCP / RAG / agent security: payloads,
   cheat sheets, labs. Agents study it before security work. */
export const SECURITY_SOURCES = [
  { name: "AI Security Hub", url: "github.com/sonuoffsec/AI-Security-Hub", what: "Prompt-injection payloads, LLM/RAG/MCP/agent security cheat sheets, hands-on labs and CTFs" },
  { name: "Anthropic Cybersecurity Skills", url: "github.com/mukul975/Anthropic-Cybersecurity-Skills", what: "818 production-grade security skills mapped to MITRE ATT&CK, NIST CSF 2.0, ATLAS, D3FEND and AI RMF" },
];

const SECURITY_TRAINED_AGENTS = ["Security Auditor", "Tech Researcher", "Integration Specialist", "AI Prompt Engineer"];

export function securityTrainingNote(agent) {
  if (!SECURITY_TRAINED_AGENTS.includes(agent.name)) return "";
  return "\n\nAI SECURITY REFERENCE — consult these s