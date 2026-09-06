/* ============================================================
   QIMMAH DIGITAL — CEO COMMAND CENTER
   No demo data. Every number on screen comes from real input.
   ============================================================ */
import { useRef } from "react";
import { Download, Upload } from "lucide-react";

export const PURPLE = "#7C3AED";
export const CYAN = "#06B6D4";
export const BG = "#0B0713";
export const REVENUE_TARGET = 19800;

export const SQUAD_META = {
  Alpha:   { role: "Lead Generation", color: "#A78BFA", range: "01–15" },
  Beta:    { role: "Delivery",        color: "#22D3EE", range: "16–30" },
  Gamma:   { role: "Intelligence",    color: "#FBBF24", range: "31–45" },
  Delta:   { role: "Operations",      color: "#34D399", range: "46–55" },
  Epsilon: { role: "Innovation",      color: "#F472B6", range: "56–60" },
};

export const AGENT_NAMES = {
  Alpha: ["Cold Outreach","Instagram Lead Gen","Email Campaigns","Facebook Ads","Google Ads","WhatsApp Bot","Landing Pages","SEO Keywords","Content Strategy","Social Scheduler","Influencer Outreach","CRM Manager","Proposal Writer","Pricing Analyst","Sales Closer"],
  Beta: ["Web Developer","UI/UX Designer","E-commerce Specialist","Security Auditor","Content Writer","Video Editor","Graphic Designer","SEO On-Page","SEO Off-Page","Social Media Manager","Ad Copywriter","Analytics Specialist","QA Tester","Project Manager","Account Manager"],
  Gamma: ["Market Research","Financial Analyst","Competitor Tracker","Trend Forecaster","Customer Insights","Brand Strategist","Growth Hacker","Data Scientist","Arabic Content","Localization","Reputation Manager","Technical SEO","Backlink Analyst","Keyword Tracker","Content Gap Analyzer"],
  Delta: ["Process Automation","Chatbot Builder","Email Automation","CRM Automator","Invoice Generator","Appointment Scheduler","Document Processor","Social Listening","Report Generator","Quality Assurance"],
  Epsilon: ["AI Prompt Engineer","Tech Researcher","Integration Specialist","Training Coordinator","Innovation Lead"],
};

export const AGENTS = (() => {
  const list = []; let id = 1;
  for (const squad of ["Alpha","Beta","Gamma","Delta","Epsilon"]) {
    for (const name of AGENT_NAMES[squad]) {
      list.push({ id, code: "Agent-" + String(id).padStart(2, "0"), name, squad });
      id++;
    }
  }
  return list;
})();

export const SYSTEM_PROMPT = `You are the AI CEO of Qimmah Digital (قمة ديجيتال — "The Summit"), a premium AI-powered digital marketing agency in Oman founded by Sultan.

BUSINESS FACTS:
- Current revenue: OMR 4,800/month. Target: OMR 19,800/month.
- Pricing: OMR 99/mo SMB package, OMR 500+/mo premium package.
- Key client: Army Burger (full-service digital marketing).
- Market: Oman primary (restaurants, e-commerce, real estate, healthcare, tourism). GCC expansion planned (UAE, KSA, Kuwait, Bahrain, Qatar).
- Differentiator: 60 specialized AI agents in 5 squads.

THE 60 AGENTS:
Squad Alpha (01-15, Lead Generation): ${AGENT_NAMES.Alpha.join(", ")}.
Squad Beta (16-30, Delivery): ${AGENT_NAMES.Beta.join(", ")}.
Squad Gamma (31-45, Intelligence): ${AGENT_NAMES.Gamma.join(", ")}.
Squad Delta (46-55, Operations): ${AGENT_NAMES.Delta.join(", ")}.
Squad Epsilon (56-60, Innovation): ${AGENT_NAMES.Epsilon.join(", ")}.

HOW TO REACH THE BUSINESS AND TEAM:
- Qimmah Digital WhatsApp Business: +968 9176 3555 (primary channel for clients and team)
- Business phone: +968 7503 7654
- Email: hello@qimmah.digital (backup: qimmahdigital@gmail.com)
- Instagram: @qimmah.digital
- Website: https://qimmah.digital
- When asked to contact a worker, team member, client or the business, ALWAYS use the compose_whatsapp or compose_email action with the right number/email from this list or the TEAM DIRECTORY below. Never say you cannot contact people - prepare the message so the user can tap and send.

SPEED AND EXECUTION — THE MOST IMPORTANT RULES:
- The 60 agents are AI agents: they work in MINUTES, not days. NEVER quote timelines of days or weeks. A demo website is minutes of agent work, not "24 hours". If asked how long something takes, answer in minutes or hours — and start immediately.
- DO THE WORK NOW, don't just plan it. When Sultan asks for something (website, logo, copy, campaign, proposal, menu, script), produce the actual deliverable in this reply or with a deliver_work action — real content, real code, ready to use. Never answer with only a plan, a timeline, or a task card when you could produce the thing itself.
- create_task is for tracking, never a substitute for delivery. Every request ends with something tangible: the work itself, a downloadable file, or a message ready to send.
- Be generous with real output: write the full website copy section by section, produce complete HTML, draft the whole ad script. Long, useful deliverables are welcome — filler talk is not.

STYLE: Direct, action-oriented, no fluff. Reference specific agents by code and name when deploying them. Keep the talk short — let the work speak.`;

export const VOICE_IDS = {
  Rachel: "21m00Tcm4TlvDq8ikWAM",
  Grace:  "oWAxZDx7w5VEj9dCyTzz",
  Bella:  "EXAVITQu4vr4xnSDxMaL",
  Elli:   "MF3mGyEYCl7XinCquKG4",
};

export const DEFAULT_STATE = {
  groqKey: "", groqModel: "", elKey: "", elVoice: "Rachel", rate: 1, autoSpeak: true,
  edgeVoice: "Aria", // Free neural voice (no key) — see EDGE_VOICES in views1.jsx
  agentsOff: {}, tasks: [], transactions: [], invoices: [], accounts: [],
  chat: [], insights: [], feed: [], opportunities: [], users: [], contracts: [],
  autopilot: { auto: true, last: null, lastCycleAt: null, cycleCount: 0, nextTopicIdx: 0 },
  squadDirectives: {}, // Squad Report Cycle — latest CEO Brain directive per squad: {Alpha:{text,ts,cycleId},...}
  squadCycle: { enabled: true, intervalMin: 12, lastRun: null, cycleCount: 0, phase: "" }, // 10–15 min squad report loop
  results: [], // Hourly autopilot — every cycle saves a result here (cap 200)
  studyQueue: [], // User-queued topics run before the rotating curriculum
  leads: [], bridge: { url: "", key: "" },
  knowledge: [], // CEO Brain — every topic the AI CEO has studied, kept forever
  lastFullBackup: null, // Timestamp of the last "Never-Zero" full backup export
  memory: [], // Long-term memory — facts the AI CEO chose to keep forever
  deliverables: [], // Finished work products delivered by the agents (files)
  dmStyle: { samples: [], profile: "" }, // DM Ghostwriter — Sultan's real message samples + learned style profile
  dmDrafts: [], // DM Ghostwriter drafts (cap 50) — drafts ready to copy & send
  /* Credentials vault — stored only on this device (localStorage), never emailed
     or sent anywhere except the matching official API. */
  integrations: {
    whatsapp: { token: "", phoneNumberId: "" },
    instagram: { token: "", appId: "", appSecret: "" },
    video: { service: "YouTube", key: "", project: "" },
  },
  github: { token: "", owner: "taniboy5514-ops", repo: "qimmah-command-center", branch: "main", connectedAt: null }, // AI CEO self-edit connection
  contacts: [ // Directory the AI CEO uses to reach workers, clients and the business
    { id: "c-wa", name: "Qimmah Digital WhatsApp Business", role: "Business channel", phone: "96891763555", email: "" },
    { id: "c-phone", name: "Qimmah Digital Phone", role: "Business channel", phone: "96875037654", email: "" },
    { id: "c-email", name: "Qimmah Digital Email", role: "Business channel", phone: "", email: "hello@qimmah.digital" },
  ],
};

/* Device-level PIN hashing — keeps PINs out of plain sight in storage.
   Honest limit: this is device protection, not server-grade auth. */
export function pinHash(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (((h << 5) + h) + s.charCodeAt(i)) >>> 0;
  return "q" + h.toString(36);
}
/* AI APIs require strictly alternating user/assistant turns. After a failed
   send, two user messages can sit next to each other — merge them. */
export function sanitizeHistory(msgs) {
  const out = [];
  for (const m of msgs) {
    const last = out[out.length - 1];
    if (last && last.role === m.role) last.content += "\n\n" + m.content;
    else out.push({ role: m.role, content: m.content });
  }
  while (out.length && out[0].role !== "user") out.shift();
  return out;
}

/* ============================================================
   AGENTIC LAYER — the AI CEO reads live business state and can
   execute real, validated actions inside the Command Center.
   ============================================================ */
export function buildSnapshot(S) {
  const m = lastMonths(1)[0];
  const inc = S.transactions.filter((t) => t.type === "income" && t.date.startsWith(m)).reduce((a, t) => a + t.amount, 0);
  const exp = S.transactions.filter((t) => t.type === "expense" && t.date.startsWith(m)).reduce((a, t) => a + t.amount, 0);
  return {
    month: m,
    incomeThisMonthOMR: inc,
    expensesThisMonthOMR: exp,
    monthlyTargetOMR: REVENUE_TARGET,
    unpaidInvoices: S.invoices.filter((i) => i.status !== "Paid").slice(0, 10).map((i) => ({ client: i.client, amountOMR: i.amount, status: i.status })),
    contracts: (S.contracts || []).slice(0, 12).map((c) => ({ client: c.client, valueOMR: c.value, billing: c.billing, status: c.status, ends: c.end || null })),
    tasks: {
      backlog: S.tasks.filter((t) => t.col === "Backlog").slice(0, 10).map((t) => t.title),
      inProgress: S.tasks.filter((t) => t.col === "In Progress").slice(0, 10).map((t) => t.title),
      review: S.tasks.filter((t) => t.col === "Review").slice(0, 10).map((t) => t.title),
      doneCount: S.tasks.filter((t) => t.col === "Done").length,
    },
    activeAgents: AGENTS.length - Object.keys(S.agentsOff).length,
    opportunities: S.opportunities.slice(0, 8).map((o) => o.segment),
    websiteLeads: {
      newCount: (S.leads || []).filter((l) => l.status === "New").length,
      recent: (S.leads || []).filter((l) => l.status === "New").slice(0, 5).map((l) => ({ name: l.name, contact: l.contact, note: (l.message || "").slice(0, 80) })),
      // FULL pipeline — the whole fleet works from the same real leads list
      pipeline: (S.leads || []).slice(0, 15).map((l) => ({
        name: String(l.name || "Lead").slice(0, 60),
        contact: String(l.contact || "").slice(0, 40),
        status: l.status || "New",
        note: String(l.message || "").slice(0, 100),
      })),
    },
  };
}

/* Short runtime note so the AI CEO "remembers" what it studied in Study Mode. */
export function knowledgeNote(S) {
  const k = S.knowledge || [];
  if (k.length === 0) return "";
  return "\n\nCEO KNOWLEDGE BASE: In Study Mode you have researched " + k.length + " topic" + (k.length === 1 ? "" : "s") + " on the open web and kept permanent notes"
    + " — most recent: " + k.slice(0, 5).map((e) => "\"" + e.topic + "\"").join(", ")
    + (k.length > 5 ? " (+" + (k.length - 5) + " more)" : "")
    + ". Draw on these study briefs when relevant; if the founder asks about a studied topic, answer from what you learned and mention that you studied it.";
}

/* Long-term memory: facts the AI CEO saved with remember_fact — survives new conversations. */
export function memoryNote(S) {
  const m = S.memory || [];
  if (m.length === 0) return "";
  return "\n\nLONG-TERM MEMORY (facts you chose to remember from past conversations — treat them as true and use them naturally):\n"
    + m.slice(-25).map((f) => "- " + f.text).join("\n");
}

/* Team directory: who works here and how to reach them. */
export function teamNote(S) {
  const users = (S.users || []).map((u) => u.name + " (" + u.role + ")");
  const contacts = S.contacts || [];
  let note = "\n\nTEAM DIRECTORY: People with Command Center access: " + (users.length ? users.join(", ") : "none yet") + ".";
  if (contacts.length) {
    note += " Saved contacts: " + contacts.map((c) => c.name
      + (c.phone ? " — WhatsApp/phone +" + c.phone : "")
      + (c.email ? " — email " + c.email : "")).join("; ") + ".";
  }
  note += " To contact any of them, use the compose_whatsapp or compose_email action with these exact details. If a worker's contact is missing, ask the user for it and save it with save_contact.";
  return note;
}

export const TOOL_INSTRUCTIONS = `TOOLS: You can take real actions inside the Command Center by ending your reply with a fenced json block:
\`\`\`json
{"actions":[{"type":"create_task","title":"...","priority":"High","agentCode":"Agent-02"}]}
\`\`\`
Available actions (max 6 per reply):
- {"type":"create_task","title":string,"priority":"High"|"Medium"|"Low","agentCode":"Agent-NN" optional}
- {"type":"move_task","match":"part of the task title","to":"In Progress"|"Review"|"Done"|"Backlog"}
- {"type":"draft_invoice","client":string,"amountOMR":number}
- {"type":"add_opportunity","segment":string,"note":string optional}
- {"type":"compose_whatsapp","phone":"digits with country code","message":string}
- {"type":"compose_email","to":string,"subject":string,"body":string}
- {"type":"remember_fact","fact":string} — permanently save something worth remembering long-term (a decision, a client detail, a number, a preference)
- {"type":"save_contact","name":string,"phone":string optional,"email":string optional,"note":string optional} — save how to reach a worker or client so you can contact them later
- {"type":"deliver_work","title":string,"filename":"name.html|.md|.txt|.svg","content":"the COMPLETE file content"} — deliver a finished work product (website page, logo SVG, copy deck, proposal) as a downloadable file. Use this whenever you produce tangible work.
RULES: Only include actions when the user asks you to do, execute, organize or prepare something, or in AUTOPILOT MODE. Ground every client name and amount in the LIVE BUSINESS STATE or the conversation - never invent them. Messages you compose are prepared for the user to tap and send; nothing is sent automatically. When the user tells you something worth remembering long-term, include a remember_fact action in the same reply so it survives new conversations. When you learn a worker's or client's phone or email, save it with save_contact. Whenever you produce tangible work (code, copy, designs as SVG), deliver it with deliver_work so the user can download the file immediately — that is how the agents "hand in" their work. Keep the visible text of your reply free of JSON.`;

/* Work-intent detection — when the user asks the AI CEO for tangible work
   (build/write/design/plan something), the chat makes a second call that
   produces the actual deliverable file instead of only talking about it. */
export const WORK_INTENT_RE = /(build|write|draft|design|create|make|produce|develop|code|plan|deliver|website|landing page|logo|svg|copy deck|copywriting|proposal|outreach|script|campaign|menu|article|email sequence|ad copy|content plan)/i;
export function wantsWork(text) {
  return WORK_INTENT_RE.test(String(text || ""));
}

/* Fleet → CEO chat channel: agents, squad Alphas and the CEO Brain post key
   messages directly into the AI CEO chat, flagged with fleet:true + by so the
   UI shows a FLEET badge. Chat is capped at 60 messages. */
export const CHAT_CAP = 60;
export function fleetChatMsg(by, text) {
  return { id: uid(), role: "assistant", fleet: true, by: String(by || "Fleet"), content: String(text || "").slice(0, 600), ts: Date.now() };
}

export function parseActions(text) {
  let actions = null;
  let clean = text;
  // Match a ```json fence first; fall back to any fence whose body looks like
  // an actions object (models sometimes emit unlabeled fences).
  const fence = text.match(/```json\s*([\s\S]*?)```/) || text.match(/```\s*(\{[\s\S]*?"actions"[\s\S]*?\})\s*```/);
  if (fence) {
    try {
      const p = JSON.parse(fence[1]);
      if (p && Array.isArray(p.actions)) {
        actions = p.actions.slice(0, 6);
        clean = text.replace(fence[0], "").trim();
      }
    } catch (e) { /* malformed block: show raw text, take no actions */ }
  }
  return { clean, actions };
}

export function describeAction(a) {
  if (a.type === "create_task") return "Create task: " + a.title + (a.agentCode ? " (" + a.agentCode + ")" : "");
  if (a.type === "move_task") return "Move task matching " + JSON.stringify(String(a.match || "")) + " to " + a.to;
  if (a.type === "draft_invoice") return "Draft invoice: " + a.client + " - OMR " + a.amountOMR;
  if (a.type === "add_opportunity") return "Log opportunity: " + a.segment;
  if (a.type === "compose_whatsapp") return "Prepare WhatsApp message" + (a.phone ? " for +" + a.phone : "");
  if (a.type === "compose_email") return "Prepare email to " + a.to;
  if (a.type === "remember_fact") return "Remember: " + String(a.fact || "").slice(0, 80);
  if (a.type === "save_contact") return "Save contact: " + String(a.name || "");
  if (a.type === "deliver_work") return "Deliver file: " + String(a.filename || a.title || "work file");
  return "Unrecognized action (skipped)";
}

export function applyActions(actions, S, up, log) {
  const results = [];
  const links = [];
  (actions || []).slice(0, 6).forEach((a) => {
    try {
      if (a.type === "create_task" && a.title) {
        const agent = a.agentCode ? AGENTS.find((x) => x.code.toLowerCase() === String(a.agentCode).toLowerCase()) : null;
        const prio = ["High", "Medium", "Low"].includes(a.priority) ? a.priority : "Medium";
        const title = String(a.title).slice(0, 120);
        up((s) => ({ ...s, tasks: [...s.tasks, { id: uid(), title, col: "Backlog", prio, agentId: agent ? agent.id : null, ts: Date.now() }] }));
        log("autopilot", "Task created: " + title + (agent ? " for " + agent.code : ""));
        results.push("Task created: " + title + (agent ? " (" + agent.code + " " + agent.name + ")" : ""));
      } else if (a.type === "move_task" && a.match && COLS.includes(a.to)) {
        const target = S.tasks.find((t) => t.title.toLowerCase().includes(String(a.match).toLowerCase()));
        if (target) {
          up((s) => ({ ...s, tasks: s.tasks.map((t) => (t.id === target.id ? { ...t, col: a.to } : t)) }));
          log("autopilot", "Task moved to " + a.to + ": " + target.title.slice(0, 50));
          results.push("Task moved to " + a.to + ": " + target.title);
        } else {
          results.push("No task found matching " + JSON.stringify(String(a.match)) + " (skipped)");
        }
      } else if (a.type === "draft_invoice" && a.client && Number(a.amountOMR) > 0) {
        const amount = Math.round(Number(a.amountOMR));
        up((s) => ({ ...s, invoices: [{ id: uid(), client: String(a.client).slice(0, 60), amount, status: "Draft", date: new Date().toISOString().slice(0, 10) }, ...s.invoices] }));
        log("autopilot", "Invoice drafted: " + a.client + " - " + omr(amount));
        results.push("Invoice drafted: " + a.client + " - " + omr(amount));
      } else if (a.type === "add_opportunity" && a.segment) {
        up((s) => ({ ...s, opportunities: [{ id: uid(), segment: String(a.segment).slice(0, 80), note: String(a.note || "").slice(0, 160), ts: Date.now() }, ...s.opportunities] }));
        log("autopilot", "Opportunity logged: " + a.segment);
        results.push("Opportunity logged: " + a.segment);
      } else if (a.type === "compose_whatsapp" && a.message) {
        const phone = String(a.phone || "").replace(/[^0-9]/g, "");
        const href = "https://wa.me/" + phone + "?text=" + encodeURIComponent(String(a.message).slice(0, 800));
        links.push({ kind: "WhatsApp", href, label: "Send WhatsApp" + (phone ? " +" + phone : "") });
        log("autopilot", "WhatsApp message prepared" + (phone ? " for +" + phone : ""));
        results.push("WhatsApp message prepared - tap the button to send");
      } else if (a.type === "compose_email" && a.to) {
        const href = "mailto:" + String(a.to).trim() + "?subject=" + encodeURIComponent(String(a.subject || "")) + "&body=" + encodeURIComponent(String(a.body || "").slice(0, 1500));
        links.push({ kind: "Email", href, label: "Open email to " + String(a.to).trim() });
        log("autopilot", "Email prepared for " + a.to);
        results.push("Email prepared for " + a.to);
      } else if (a.type === "remember_fact" && a.fact) {
        const fact = String(a.fact).slice(0, 200);
        up((s) => ({ ...s, memory: [...(s.memory || []).filter((f) => f.text !== fact), { id: uid(), text: fact, ts: Date.now() }].slice(-60) }));
        log("system", "Memory saved: " + fact.slice(0, 60));
        results.push("Remembered forever: " + fact);
      } else if (a.type === "save_contact" && a.name && (a.phone || a.email)) {
        const phone = String(a.phone || "").replace(/[^0-9]/g, "");
        const email = String(a.email || "").trim().slice(0, 80);
        const cname = String(a.name).slice(0, 60);
        up((s) => ({ ...s, contacts: [...(s.contacts || []).filter((c) => c.name.toLowerCase() !== cname.toLowerCase()), { id: uid(), name: cname, role: String(a.note || "Contact").slice(0, 40), phone, email }] }));
        log("system", "Contact saved: " + cname);
        results.push("Contact saved: " + cname + (phone ? " +" + phone : "") + (email ? " " + email : ""));
      } else if (a.type === "deliver_work" && a.content) {
        const fname = String(a.filename || "deliverable.md").replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 60);
        const content = String(a.content).slice(0, 60000);
        const title = String(a.title || fname).slice(0, 100);
        const mime = fname.endsWith(".html") ? "text/html" : fname.endsWith(".svg") ? "image/svg+xml" : "text/plain";
        const href = "data:" + mime + ";charset=utf-8," + encodeURIComponent(content);
        links.push({ kind: "File", href, label: "Download " + fname, download: fname });
        up((s) => ({ ...s, deliverables: [{ id: uid(), title, filename: fname, content, ts: Date.now() }, ...(s.deliverables || [])].slice(0, 30) }));
        log("autopilot", "Work delivered: " + title);
        results.push("Delivered: " + title + " — tap Download " + fname + " to get the file");
      }
    } catch (e) { /* skip malformed action, never crash the run */ }
  });
  return { results, links };
}

/* Model fallback chain — Groq retires model IDs over time (llama-3.3-70b-versatile
   was shut down 2026-08-16). If the requested/default model is gone (404 or
   decommissioned message), automatically try the next production model so the
   fleet never goes silent. S.groqModel (Settings) forces a specific model first. */
export const GROQ_MODELS = ["openai/gpt-oss-120b", "qwen/qwen3.6-27b", "moonshotai/kimi-k2-instruct-0905", "meta-llama/llama-4-scout-17b-16e-instruct", "openai/gpt-oss-20b"];

/* ============================================================
   MCP TOOL CATALOG — client-side mirror of backend/lib/mcp/registry.js.
   Keep in sync with the registry; the server is the source of truth.
   approval: true tools show amber and require human sign-off.
   ============================================================ */
export const TOOL_CATALOG = [
  { name: "send_whatsapp_message", desc: "Send a WhatsApp message via the WhatsApp Business API", squads: ["Alpha", "Epsilon"], approval: true },
  { name: "send_instagram_dm", desc: "Send an Instagram DM via the Meta Instagram API", squads: ["Alpha"], approval: true },
  { name: "create_lead", desc: "Add a new lead to the pipeline", squads: ["Alpha", "Beta", "Gamma", "Delta", "Epsilon"], approval: false },
  { name: "update_lead_status", desc: "Move a lead to a new pipeline status", squads: ["Alpha", "Epsilon"], approval: false },
  { name: "web_search", desc: "Research a query via the Groq model fallback chain", squads: ["Beta", "Gamma", "Delta"], approval: false },
  { name: "study_topic", desc: "Produce a study brief and save it to the knowledge base", squads: ["Beta", "Gamma", "Delta"], approval: false },
  { name: "record_transaction", desc: "Record an income or expense transaction", squads: ["Delta", "Epsilon"], approval: true },
  { name: "create_invoice", desc: "Draft an invoice with line items", squads: ["Delta", "Epsilon"], approval: true },
  { name: "create_task", desc: "Create a tracked task", squads: ["Alpha", "Beta", "Gamma", "Delta", "Epsilon"], approval: false },
  { name: "complete_task", desc: "Mark a task as done", squads: ["Alpha", "Beta", "Gamma", "Delta", "Epsilon"], approval: false },
  { name: "self_edit_code", desc: "Propose code edits (max 3 files, no deletions, no secrets)", squads: ["Delta"], approval: true },
  { name: "query_analytics", desc: "Query workspace analytics from real rows", squads: ["Gamma", "Delta"], approval: false },
  { name: "test_connector", desc: "Test an external connector's credentials and reachability", squads: ["Delta", "Gamma"], approval: false },
];

/* ============================================================
   GOAL MODE — client-side mirror of backend/lib/ceo/skills.js.
   The server is the source of truth; these templates pre-fill
   the CEO chat from the Skills Registry popover.
   ============================================================ */
export const SKILL_CATALOG = [
  { name: "market_research", label: "Market Research", desc: "Competitors, pricing and gaps in Oman/GCC", prompt: "Goal: research the market for our services — competitors, pricing, and gaps we can win in Oman." },
  { name: "lead_generation", label: "Lead Generation", desc: "Find leads, fill the pipeline, queue outreach", prompt: "Goal: get me 5 new clients in the restaurant segment — research them, add them to the pipeline and prepare outreach." },
  { name: "client_followup", label: "Client Follow-up", desc: "Nudge warm leads and move them forward", prompt: "Goal: follow up with every warm lead — review the pipeline and send nudges." },
  { name: "financial_review", label: "Financial Review", desc: "Income, expenses, invoices, next actions", prompt: "Goal: run a full financial review — income, expenses, unpaid invoices, and next actions." },
  { name: "website_audit", label: "Website Audit", desc: "SEO and performance gaps + fix tasks", prompt: "Goal: audit our website and SEO — find the gaps and queue the fixes." },
  { name: "content_campaign", label: "Content Campaign", desc: "Angles, calendar and production tasks", prompt: "Goal: launch a content campaign for Army Burger — angles, calendar, and production tasks." },
  { name: "proposal_builder", label: "Proposal Builder", desc: "Research, offer structure, draft invoice", prompt: "Goal: build a proposal for a new real-estate client — research, offer structure, and a draft invoice." },
  { name: "ops_cleanup", label: "Ops Cleanup", desc: "Clear stalled work, test connectors, fix", prompt: "Goal: operations cleanup — clear stalled work, test connectors, propose fixes." },
];

/* Goal-intent detection — a message that reads as an objective (explicit
   "goal:" prefix, "get me X clients by Friday", or a target with a
   deadline) offers a "Start as Goal" action under the CEO reply. */
export const GOAL_INTENT_RE = /(^\s*goal\s*:|\bget me\b.{0,60}\b(client|lead|sale|invoice)s?\b|\b(objective|mission)\b|\b(by|before)\s+(friday|monday|tuesday|wednesday|thursday|saturday|sunday|end of (day|week|month)|eod|eow)\b|\btarget\b.{0,50}\b(omr|clients|revenue)\b)/i;
export function wantsGoal(text) {
  return GOAL_INTENT_RE.test(String(text || ""));
}

/* Honest-limits note shown on the MCP Discovery panel. */
export const MCP_LIMITS_NOTE = "Honest limits: WhatsApp and Instagram tools return mock success until Meta API credentials are configured; web_search and study_topic are LLM knowledge synthesis, not a live web crawl; self_edit_code stages edits only — commits go through the human-approved GitHub flow.";
export const GROQ_MODEL_LABELS = {
  "openai/gpt-oss-120b": "GPT-OSS 120B (default — production)",
  "qwen/qwen3.6-27b": "Qwen 3.6 27B (multilingual, vision)",
  "moonshotai/kimi-k2-instruct-0905": "Kimi K2 (agentic)",
  "meta-llama/llama-4-scout-17b-16e-instruct": "Llama 4 Scout",
  "openai/gpt-oss-20b": "GPT-OSS 20B (fastest, cheapest)",
};

/* opts.model overrides the default model (Study Mode uses groq/compound for live
   web search). opts.full returns { reply, sources } so callers can keep the web
   sources Groq Compound used. */
export async function aiCall(S, sys, messages, opts) {
  const o = opts || {};
  if (IN_PREVIEW) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 1200, system: sys, messages }),
    });
    if (!res.ok) throw new Error("The preview AI engine returned error " + res.status + ". Try again.");
    const data = await res.json();
    const reply = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
    if (!reply) throw new Error("The AI returned an empty response. Try again.");
    return o.full ? { reply, sources: [] } : reply;
  }
  const candidates = o.model
    ? [o.model]
    : [...new Set([S.groqModel, ...GROQ_MODELS].filter(Boolean))];
  let res = null, lastErr = null;
  for (let mi = 0; mi < candidates.length; mi++) {
    const model = candidates[mi];
    res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + S.groqKey },
      body: JSON.stringify({ model, max_tokens: 1200, messages: [{ role: "system", content: sys }, ...messages] }),
    });
    if (res.ok) {
      if (mi > 0) { o._usedModel = model; }
      break;
    }
    let detail = "";
    try { const ej = await res.clone().json(); detail = ej && ej.error && ej.error.message ? String(ej.error.message) : ""; } catch (e) { /* non-JSON error body */ }
    const modelGone = res.status === 404 || res.status === 400 && /decommission|does not exist|no longer supported/i.test(detail) || /decommission|does not exist|no longer supported/i.test(detail);
    if (modelGone && mi < candidates.length - 1 && !o.model) { lastErr = { status: res.status, detail }; continue; }
    const msg = res.status === 401
      ? "Invalid Groq API key. Open Settings and paste a fresh key from console.groq.com."
      : res.status === 429
        ? "Groq rate limit reached. Wait about a minute, then try again."
        : modelGone
          ? "Model unavailable on Groq. Open Settings and pick another AI model."
          : "Groq returned error " + res.status + ". Check your connection and try again.";
    const err = new Error(detail && res.status !== 401 && res.status !== 429 ? msg + " (" + detail.slice(0, 160) + ")" : msg);
    err.status = res.status;
    err.detail = detail;
    throw err;
  }
  const data = await res.json();
  const msgObj = data.choices && data.choices[0] && data.choices[0].message;
  const reply = msgObj ? msgObj.content : "";
  if (!reply) throw new Error("The AI returned an empty response. Try again.");
  if (o.full) {
    // Groq Compound reports the tools it ran (web search). Pull the pages it
    // actually visited out of executed_tools so the study brief keeps sources.
    const sources = [];
    const push = (title, url) => {
      url = String(url || "").trim();
      if (!/^https?:\/\//.test(url)) return;
      if (sources.some((x) => x.url === url)) return;
      if (sources.length < 10) sources.push({ title: String(title || url).slice(0, 140), url });
    };
    const walk = (node) => {
      if (!node) return;
      if (Array.isArray(node)) { node.forEach(walk); return; }
      if (typeof node !== "object") return;
      if (node.url) push(node.title || node.name || node.url, node.url);
      ["search_results", "results", "output", "content", "sources", "citations"].forEach((k) => {
        const v = node[k];
        if (!v || v === node) return;
        if (typeof v === "string") {
          if (/^https?:\/\//.test(v)) { push(node.title || v, v); return; }
          try { walk(JSON.parse(v)); } catch (e) { /* plain text, not JSON */ }
        } else if (typeof v === "object") walk(v);
      });
    };
    walk(msgObj.executed_tools);
    return { reply, sources };
  }
  return reply;
}

/* Environment detection: inside the Claude preview sandbox, outside API calls
   (Groq, ElevenLabs) are blocked, but the Anthropic API is available with no key.
   When deployed to a real host (Vercel, Netlify), Groq takes over. */
export const IN_PREVIEW = typeof window !== "undefined" && !!window.storage;

/* ---------- Persistence: artifact storage → localStorage → memory ---------- */
export const mem = {};
export const SKEY = "qimmah-command-center-v1";
export async function loadState() {
  try {
    if (typeof window !== "undefined" && window.storage) {
      const r = await window.storage.get(SKEY);
      if (r && r.value) return JSON.parse(r.value);
    }
  } catch (e) { /* key missing or unavailable */ }
  try {
    const v = localStorage.getItem(SKEY);
    if (v) return JSON.parse(v);
  } catch (e) { /* blocked in this environment */ }
  return mem.s || null;
}
export async function saveState(s) {
  const str = JSON.stringify(s);
  try {
    if (typeof window !== "undefined" && window.storage) {
      await window.storage.set(SKEY, str);
      return;
    }
  } catch (e) { /* fall through */ }
  try { localStorage.setItem(SKEY, str); return; } catch (e) { /* fall through */ }
  mem.s = s;
}

/* ---------- Helpers ---------- */
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
export const omr = (n) => "OMR " + Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 });
export const timeAgo = (ts) => {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return Math.floor(s / 60) + "m ago";
  if (s < 86400) return Math.floor(s / 3600) + "h ago";
  return Math.floor(s / 86400) + "d ago";
};
export function lastMonths(n) {
  const out = []; const d = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const x = new Date(d.getFullYear(), d.getMonth() - i, 1);
    out.push(x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0"));
  }
  return out;
}
export const monthLabel = (m) => new Date(m + "-01T00:00:00").toLocaleString("en", { month: "short" });
export function classifyInsight(text) {
  const t = text.toLowerCase();
  if (/(omr|revenue|price|pricing|cost|profit|invoice|budget|margin)/.test(t)) return "finance";
  if (/(agent-|squad|deploy)/.test(t)) return "agents";
  if (/(oman|gcc|market|competitor|client|customer|restaurant)/.test(t)) return "market";
  if (/(process|workflow|automat|task|operation)/.test(t)) return "operations";
  return "strategy";
}

/* Pick a female browser voice for the AI CEO — the free fallback when no
   ElevenLabs key is set. Prefers explicit female voices, avoids known male ones. */
export function pickFemaleVoice() {
  try {
    const vs = window.speechSynthesis ? window.speechSynthesis.getVoices() : [];
    const en = vs.filter((v) => (v.lang || "").toLowerCase().startsWith("en"));
    const pool = en.length ? en : vs;
    return pool.find((v) => /female|zira|samantha|susan|victoria|karen|moira|tessa|fiona|serena|allison|ava|joelle|shelley|kate|stephanie|catherine|aria|jenny|emma|libby|sonia|natasha/i.test(v.name))
      || pool.find((v) => !/\bmale\b|david|mark|\balex\b|fred|daniel|george|james|\bguy\b|ryan|brian|eric|thomas|arthur|aaron/i.test(v.name))
      || null;
  } catch (e) { return null; }
}

/* ---------- Shared styles ---------- */
export const glass = {
  background: "rgba(255,255,255,0.035)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 16,
  backdropFilter: "blur(14px)",
  WebkitBackdropFilter: "blur(14px)",
};
export const inputStyle = {
  background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 10, color: "#EDE9FE", padding: "10px 12px", fontSize: 14,
  outline: "none", width: "100%", fontFamily: "inherit",
};
export const btnPrimary = {
  background: "linear-gradient(135deg, #7C3AED, #6D28D9)", color: "#fff",
  border: "none", borderRadius: 10, padding: "10px 16px", fontSize: 14,
  fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center",
  gap: 6, boxShadow: "0 0 18px rgba(124,58,237,0.35)", fontFamily: "inherit",
};
export const btnGhost = {
  background: "rgba(255,255,255,0.06)", color: "#C4B5FD",
  border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "8px 14px",
  fontSize: 13, fontWeight: 500, cursor: "pointer", display: "inline-flex",
  alignItems: "center", gap: 6, fontFamily: "inherit",
};

/* Qimmah brand mark — the gradient "Q" tile, used wherever the brand shows
   (Website Review chrome, share cards). Pure SVG, no asset files. */
export function QimmahMark({ size = 26 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-label="Qimmah">
      <defs>
        <linearGradient id="qimmah-mark-g" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop stopColor="#7C3AED" />
          <stop offset="1" stopColor="#06B6D4" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="13" fill="url(#qimmah-mark-g)" />
      <circle cx="22.5" cy="22.5" r="9.5" stroke="#fff" strokeWidth="3.4" fill="none" />
      <line x1="28.5" y1="29" x2="35.5" y2="36" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" />
    </svg>
  );
}

/* ---------- Atoms ---------- */
export function Card({ children, style, glow }) {
  return (
    <div style={{ ...glass, padding: 18, ...(glow ? { boxShadow: "0 0 40px rgba(124,58,237,0.12)" } : {}), ...style }}>
      {children}
    </div>
  );
}
export function SectionTitle({ eyebrow, title, sub }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 11, letterSpacing: 2.5, textTransform: "uppercase", color: CYAN, fontWeight: 600, marginBottom: 4 }}>{eyebrow}</div>
      <h2 style={{ margin: 0, fontSize: 26, fontWeight: 700, color: "#F5F3FF", fontFamily: "'Space Grotesk', sans-serif" }}>{title}</h2>
      {sub && <p style={{ margin: "6px 0 0", fontSize: 13.5, color: "#A5A0B8", maxWidth: 640 }}>{sub}</p>}
    </div>
  );
}
export function Stat({ label, value, accent, sub }) {
  return (
    <Card style={{ flex: "1 1 150px", minWidth: 150 }}>
      <div style={{ fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", color: "#8B86A3", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color: accent || "#F5F3FF", fontFamily: "'Space Grotesk', sans-serif" }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: "#8B86A3", marginTop: 4 }}>{sub}</div>}
    </Card>
  );
}
export function Empty({ icon: Icon, title, body, action }) {
  return (
    <Card style={{ textAlign: "center", padding: "36px 20px" }}>
      {Icon && <Icon size={28} style={{ color: PURPLE, marginBottom: 10 }} />}
      <div style={{ fontSize: 15.5, fontWeight: 600, color: "#E9E4FB", marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 13.5, color: "#A5A0B8", maxWidth: 420, margin: "0 auto" }}>{body}</div>
      {action && <div style={{ marginTop: 14 }}>{action}</div>}
    </Card>
  );
}
export function Field({ label, children }) {
  return (
    <label style={{ display: "block", flex: 1, minWidth: 120 }}>
      <div style={{ fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: "#8B86A3", marginBottom: 5 }}>{label}</div>
      {children}
    </label>
  );
}

/* Kanban columns — shared by the Tasks board and the CEO action layer. */
export const COLS = ["Backlog", "In Progress", "Review", "Done"];

/* ============================================================
   NEVER-ZERO FULL BACKUP — one JSON file with the ENTIRE state
   ============================================================ */
export function buildFullBackup(S) {
  return JSON.stringify({
    meta: { app: "qimmah-cc", version: 1, exportedAt: new Date().toISOString() },
    state: S,
  }, null, 2);
}

/* Validate a parsed backup file. Returns the restored state object or null. */
export function parseFullBackup(data) {
  if (!data || typeof data !== "object") return null;
  if (!data.meta || data.meta.app !== "qimmah-cc") return null;
  const st = data.state;
  if (!st || typeof st !== "object") return null;
  if (!Array.isArray(st.tasks) || !Array.isArray(st.transactions) || !Array.isArray(st.users)) return null;
  return st;
}

/* Compact Backup / Restore buttons + freshness note. Used in the user bar
   and in CEO Brain → Study Mode. */
export function BackupControls({ S, onExport, onImport }) {
  const fileRef = useRef(null);
  const stale = !S.lastFullBackup || (Date.now() - S.lastFullBackup) > 7 * 86400000;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <button style={btnGhost} onClick={onExport} title="Download one JSON file with your ENTIRE Command Center — never lose your data">
        <Download size={13} /> Backup
      </button>
      <input ref={fileRef} type="file" accept="application/json,.json" style={{ display: "none" }}
        onChange={(e) => { const f = e.target.files && e.target.files[0]; if (f) onImport(f); e.target.value = ""; }} />
      <button style={btnGhost} onClick={() => fileRef.current && fileRef.current.click()} title="Restore the Command Center from a full backup file">
        <Upload size={13} /> Restore
      </button>
      <span style={{ fontSize: 11, color: "#8B86A3" }}>
        Last backup: {S.lastFullBackup ? timeAgo(S.lastFullBackup) : "never"}
      </span>
      {stale && (
        <span style={{ fontSize: 11, color: "#FBBF24" }}>
          ⚠ Protect your data — export a backup
        </span>
      )}
    </span>
  );
}