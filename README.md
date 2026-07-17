import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  LayoutDashboard, MessageSquare, Users, ListTodo, BarChart3, Wallet, Plug,
  Radio, Fish, Mic, Send, Copy, Volume2, VolumeX, Trash2, Plus, ChevronLeft,
  ChevronRight, ExternalLink, Settings, Sparkles, TrendingUp, CheckCircle2,
  Circle, X, Check, FileText, Paperclip, Download, Inbox, RefreshCw
} from "lucide-react";

/* ============================================================
   QIMMAH DIGITAL — CEO COMMAND CENTER
   No demo data. Every number on screen comes from real input.
   ============================================================ */

const PURPLE = "#7C3AED";
const CYAN = "#06B6D4";
const BG = "#0B0713";
const REVENUE_TARGET = 19800;

const SQUAD_META = {
  Alpha:   { role: "Lead Generation", color: "#A78BFA", range: "01–15" },
  Beta:    { role: "Delivery",        color: "#22D3EE", range: "16–30" },
  Gamma:   { role: "Intelligence",    color: "#FBBF24", range: "31–45" },
  Delta:   { role: "Operations",      color: "#34D399", range: "46–55" },
  Epsilon: { role: "Innovation",      color: "#F472B6", range: "56–60" },
};

const AGENT_NAMES = {
  Alpha: ["Cold Outreach","Instagram Lead Gen","Email Campaigns","Facebook Ads","Google Ads","WhatsApp Bot","Landing Pages","SEO Keywords","Content Strategy","Social Scheduler","Influencer Outreach","CRM Manager","Proposal Writer","Pricing Analyst","Sales Closer"],
  Beta: ["Web Developer","UI/UX Designer","E-commerce Specialist","Security Auditor","Content Writer","Video Editor","Graphic Designer","SEO On-Page","SEO Off-Page","Social Media Manager","Ad Copywriter","Analytics Specialist","QA Tester","Project Manager","Account Manager"],
  Gamma: ["Market Research","Financial Analyst","Competitor Tracker","Trend Forecaster","Customer Insights","Brand Strategist","Growth Hacker","Data Scientist","Arabic Content","Localization","Reputation Manager","Technical SEO","Backlink Analyst","Keyword Tracker","Content Gap Analyzer"],
  Delta: ["Process Automation","Chatbot Builder","Email Automation","CRM Automator","Invoice Generator","Appointment Scheduler","Document Processor","Social Listening","Report Generator","Quality Assurance"],
  Epsilon: ["AI Prompt Engineer","Tech Researcher","Integration Specialist","Training Coordinator","Innovation Lead"],
};

const AGENTS = (() => {
  const list = []; let id = 1;
  for (const squad of ["Alpha","Beta","Gamma","Delta","Epsilon"]) {
    for (const name of AGENT_NAMES[squad]) {
      list.push({ id, code: "Agent-" + String(id).padStart(2, "0"), name, squad });
      id++;
    }
  }
  return list;
})();

const SYSTEM_PROMPT = `You are the AI CEO of Qimmah Digital (قمة ديجيتال — "The Summit"), a premium AI-powered digital marketing agency in Oman founded by Sultan.

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

STYLE: Direct, action-oriented, no fluff. Give concrete recommendations with numbers where possible. Reference specific agents by code and name when recommending deployments. Sultan values speed, real results, and clear next steps. Keep answers tight — short paragraphs or short lists.`;

const VOICE_IDS = {
  Rachel: "21m00Tcm4TlvDq8ikWAM",
  Grace:  "oWAxZDx7w5VEj9dCyTzz",
  Bella:  "EXAVITQu4vr4xnSDxMaL",
  Elli:   "MF3mGyEYCl7XinCquKG4",
};

const DEFAULT_STATE = {
  groqKey: "", elKey: "", elVoice: "Rachel", rate: 1, autoSpeak: true,
  agentsOff: {}, tasks: [], transactions: [], invoices: [], accounts: [],
  chat: [], insights: [], feed: [], opportunities: [], users: [], contracts: [],
  autopilot: { auto: false, last: null },
  leads: [], bridge: { url: "", key: "" },
};

/* Device-level PIN hashing — keeps PINs out of plain sight in storage.
   Honest limit: this is device protection, not server-grade auth. */
function pinHash(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (((h << 5) + h) + s.charCodeAt(i)) >>> 0;
  return "q" + h.toString(36);
}
/* AI APIs require strictly alternating user/assistant turns. After a failed
   send, two user messages can sit next to each other — merge them. */
function sanitizeHistory(msgs) {
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
function buildSnapshot(S) {
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
    },
  };
}

const TOOL_INSTRUCTIONS = `TOOLS: You can take real actions inside the Command Center by ending your reply with a fenced json block:
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
RULES: Only include actions when the user asks you to do, execute, organize or prepare something, or in AUTOPILOT MODE. Ground every client name and amount in the LIVE BUSINESS STATE or the conversation - never invent them. Messages you compose are prepared for the user to tap and send; nothing is sent automatically. Keep the visible text of your reply free of JSON.`;

function parseActions(text) {
  let actions = null;
  let clean = text;
  const fence = text.match(/```json\s*([\s\S]*?)```/);
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

function describeAction(a) {
  if (a.type === "create_task") return "Create task: " + a.title + (a.agentCode ? " (" + a.agentCode + ")" : "");
  if (a.type === "move_task") return "Move task matching " + JSON.stringify(String(a.match || "")) + " to " + a.to;
  if (a.type === "draft_invoice") return "Draft invoice: " + a.client + " - OMR " + a.amountOMR;
  if (a.type === "add_opportunity") return "Log opportunity: " + a.segment;
  if (a.type === "compose_whatsapp") return "Prepare WhatsApp message" + (a.phone ? " for +" + a.phone : "");
  if (a.type === "compose_email") return "Prepare email to " + a.to;
  return "Unrecognized action (skipped)";
}

function applyActions(actions, S, up, log) {
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
      }
    } catch (e) { /* skip malformed action, never crash the run */ }
  });
  return { results, links };
}

async function aiCall(S, sys, messages) {
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
    return reply;
  }
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + S.groqKey },
    body: JSON.stringify({ model: "llama-3.3-70b-versatile", max_tokens: 1200, messages: [{ role: "system", content: sys }, ...messages] }),
  });
  if (!res.ok) {
    if (res.status === 401) throw new Error("Invalid Groq API key. Open Settings and paste a fresh key from console.groq.com.");
    if (res.status === 429) throw new Error("Groq rate limit reached. Wait about a minute, then try again.");
    throw new Error("Groq returned error " + res.status + ". Check your connection and try again.");
  }
  const data = await res.json();
  const reply = data.choices && data.choices[0] && data.choices[0].message ? data.choices[0].message.content : "";
  if (!reply) throw new Error("The AI returned an empty response. Try again.");
  return reply;
}

/* Environment detection: inside the Claude preview sandbox, outside API calls
   (Groq, ElevenLabs) are blocked, but the Anthropic API is available with no key.
   When deployed to a real host (Vercel, Netlify), Groq takes over. */
const IN_PREVIEW = typeof window !== "undefined" && !!window.storage;

/* ---------- Persistence: artifact storage → localStorage → memory ---------- */
const mem = {};
const SKEY = "qimmah-command-center-v1";
async function loadState() {
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
async function saveState(s) {
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
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const omr = (n) => "OMR " + Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 });
const timeAgo = (ts) => {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return Math.floor(s / 60) + "m ago";
  if (s < 86400) return Math.floor(s / 3600) + "h ago";
  return Math.floor(s / 86400) + "d ago";
};
function lastMonths(n) {
  const out = []; const d = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const x = new Date(d.getFullYear(), d.getMonth() - i, 1);
    out.push(x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0"));
  }
  return out;
}
const monthLabel = (m) => new Date(m + "-01T00:00:00").toLocaleString("en", { month: "short" });
function classifyInsight(text) {
  const t = text.toLowerCase();
  if (/(omr|revenue|price|pricing|cost|profit|invoice|budget|margin)/.test(t)) return "finance";
  if (/(agent-|squad|deploy)/.test(t)) return "agents";
  if (/(oman|gcc|market|competitor|client|customer|restaurant)/.test(t)) return "market";
  if (/(process|workflow|automat|task|operation)/.test(t)) return "operations";
  return "strategy";
}

/* ---------- Shared styles ---------- */
const glass = {
  background: "rgba(255,255,255,0.035)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 16,
  backdropFilter: "blur(14px)",
  WebkitBackdropFilter: "blur(14px)",
};
const inputStyle = {
  background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 10, color: "#EDE9FE", padding: "10px 12px", fontSize: 14,
  outline: "none", width: "100%", fontFamily: "inherit",
};
const btnPrimary = {
  background: "linear-gradient(135deg, #7C3AED, #6D28D9)", color: "#fff",
  border: "none", borderRadius: 10, padding: "10px 16px", fontSize: 14,
  fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center",
  gap: 6, boxShadow: "0 0 18px rgba(124,58,237,0.35)", fontFamily: "inherit",
};
const btnGhost = {
  background: "rgba(255,255,255,0.06)", color: "#C4B5FD",
  border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "8px 14px",
  fontSize: 13, fontWeight: 500, cursor: "pointer", display: "inline-flex",
  alignItems: "center", gap: 6, fontFamily: "inherit",
};

/* ---------- Atoms ---------- */
function Card({ children, style, glow }) {
  return (
    <div style={{ ...glass, padding: 18, ...(glow ? { boxShadow: "0 0 40px rgba(124,58,237,0.12)" } : {}), ...style }}>
      {children}
    </div>
  );
}
function SectionTitle({ eyebrow, title, sub }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 11, letterSpacing: 2.5, textTransform: "uppercase", color: CYAN, fontWeight: 600, marginBottom: 4 }}>{eyebrow}</div>
      <h2 style={{ margin: 0, fontSize: 26, fontWeight: 700, color: "#F5F3FF", fontFamily: "'Space Grotesk', sans-serif" }}>{title}</h2>
      {sub && <p style={{ margin: "6px 0 0", fontSize: 13.5, color: "#A5A0B8", maxWidth: 640 }}>{sub}</p>}
    </div>
  );
}
function Stat({ label, value, accent, sub }) {
  return (
    <Card style={{ flex: "1 1 150px", minWidth: 150 }}>
      <div style={{ fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", color: "#8B86A3", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color: accent || "#F5F3FF", fontFamily: "'Space Grotesk', sans-serif" }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: "#8B86A3", marginTop: 4 }}>{sub}</div>}
    </Card>
  );
}
function Empty({ icon: Icon, title, body, action }) {
  return (
    <Card style={{ textAlign: "center", padding: "36px 20px" }}>
      {Icon && <Icon size={28} style={{ color: PURPLE, marginBottom: 10 }} />}
      <div style={{ fontSize: 15.5, fontWeight: 600, color: "#E9E4FB", marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 13.5, color: "#A5A0B8", maxWidth: 420, margin: "0 auto" }}>{body}</div>
      {action && <div style={{ marginTop: 14 }}>{action}</div>}
    </Card>
  );
}
function Field({ label, children }) {
  return (
    <label style={{ display: "block", flex: 1, minWidth: 120 }}>
      <div style={{ fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: "#8B86A3", marginBottom: 5 }}>{label}</div>
      {children}
    </label>
  );
}

/* ============================================================
   OPERATIONS RADAR — live view of what every agent is doing.
   Lit entirely by real data: tasks In Progress burn bright,
   Review and Backlog glow softer, idle agents stay dim.
   ============================================================ */
const RADAR_STATES = {
  working: { color: "#FFB020", label: "Working now" },
  review:  { color: "#22D3EE", label: "In review" },
  queued:  { color: "#A78BFA", label: "Queued" },
  idle:    { color: "#4C4766", label: "Standing by" },
  off:     { color: "#2C2840", label: "Offline" },
};

function OpsRadar({ S, busy }) {
  const [open, setOpen] = useState(true);
  const cx = 300, cy = 178;
  const radii = { Alpha: 62, Beta: 88, Gamma: 114, Delta: 138, Epsilon: 158 };

  const taskFor = (id, col) => S.tasks.find((t) => t.agentId === id && t.col === col);
  const stateOf = (id) => {
    if (S.agentsOff[id]) return "off";
    if (taskFor(id, "In Progress")) return "working";
    if (taskFor(id, "Review")) return "review";
    if (taskFor(id, "Backlog")) return "queued";
    return "idle";
  };

  const squadKeys = Object.keys(SQUAD_META);
  const nodes = [];
  for (const squad of squadKeys) {
    const members = AGENTS.filter((a) => a.squad === squad);
    members.forEach((a, i) => {
      const angle = (i / members.length) * Math.PI * 2 - Math.PI / 2 + squadKeys.indexOf(squad) * 0.35;
      nodes.push({
        agent: a,
        x: Math.round((cx + Math.cos(angle) * radii[squad]) * 10) / 10,
        y: Math.round((cy + Math.sin(angle) * radii[squad]) * 10) / 10,
        state: stateOf(a.id),
      });
    });
  }
  const workingNodes = nodes.filter((n) => n.state === "working");
  const counts = nodes.reduce((acc, n) => { acc[n.state] = (acc[n.state] || 0) + 1; return acc; }, {});

  return (
    <Card glow style={{ marginBottom: 16, padding: 0, overflow: "hidden" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderBottom: open ? "1px solid rgba(255,255,255,0.07)" : "none", flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: "#C4B5FD", display: "flex", alignItems: "center", gap: 7 }}>
            <span className="q-blink" style={{ width: 7, height: 7, borderRadius: "50%", background: workingNodes.length ? "#FFB020" : "#4C4766", boxShadow: workingNodes.length ? "0 0 10px #FFB020" : "none" }} />
            Operations Radar
          </span>
          <span style={{ fontSize: 11, color: "#8B86A3" }}>
            <b style={{ color: "#FFB020" }}>{counts.working || 0}</b> working · <b style={{ color: "#22D3EE" }}>{counts.review || 0}</b> in review · <b style={{ color: "#A78BFA" }}>{counts.queued || 0}</b> queued · {(counts.idle || 0)} standing by{counts.off ? " · " + counts.off + " offline" : ""}
          </span>
        </div>
        <button style={{ ...btnGhost, fontSize: 12, padding: "5px 12px" }} onClick={() => setOpen(!open)}>{open ? "Hide" : "Show"}</button>
      </div>
      {open && (
        <div>
          <svg viewBox="0 0 600 356" style={{ width: "100%", height: "auto", display: "block", background: "radial-gradient(circle at 50% 50%, rgba(124,58,237,0.10), transparent 65%)" }}>
            <defs>
              <radialGradient id="coreGlow">
                <stop offset="0%" stopColor="#FFB020" stopOpacity="0.9" />
                <stop offset="45%" stopColor="#7C3AED" stopOpacity="0.55" />
                <stop offset="100%" stopColor="#7C3AED" stopOpacity="0" />
              </radialGradient>
              <linearGradient id="linkGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#7C3AED" stopOpacity="0.1" />
                <stop offset="100%" stopColor="#FFB020" stopOpacity="0.8" />
              </linearGradient>
            </defs>

            <g opacity="0.35">
              <circle cx={cx} cy={cy} r="170" fill="none" stroke="#7C3AED" strokeWidth="0.7" strokeDasharray="2 10">
                <animateTransform attributeName="transform" type="rotate" from={"0 " + cx + " " + cy} to={"360 " + cx + " " + cy} dur="80s" repeatCount="indefinite" />
              </circle>
              <circle cx={cx} cy={cy} r="126" fill="none" stroke="#06B6D4" strokeWidth="0.6" strokeDasharray="14 22">
                <animateTransform attributeName="transform" type="rotate" from={"360 " + cx + " " + cy} to={"0 " + cx + " " + cy} dur="110s" repeatCount="indefinite" />
              </circle>
            </g>
            {Object.entries(radii).map(([sq, r]) => (
              <circle key={sq} cx={cx} cy={cy} r={r} fill="none" stroke={SQUAD_META[sq].color} strokeOpacity="0.13" strokeWidth="1" />
            ))}

            {workingNodes.map((n) => (
              <line key={"l" + n.agent.id} x1={cx} y1={cy} x2={n.x} y2={n.y} stroke="url(#linkGrad)" strokeWidth="1.1">
                <animate attributeName="stroke-opacity" values="0.35;1;0.35" dur="2.4s" repeatCount="indefinite" />
              </line>
            ))}

            <circle cx={cx} cy={cy} r="34" fill="url(#coreGlow)">
              {busy && <animate attributeName="r" values="30;40;30" dur="1.2s" repeatCount="indefinite" />}
            </circle>
            <circle cx={cx} cy={cy} r="13" fill="#0B0713" stroke="#FFB020" strokeWidth="1.4" />
            <circle cx={cx} cy={cy} r="5" fill="#FFB020">
              <animate attributeName="opacity" values="1;0.4;1" dur={busy ? "0.7s" : "2.6s"} repeatCount="indefinite" />
            </circle>
            <text x={cx} y={cy + 30} textAnchor="middle" fontSize="9.5" fill="#C4B5FD" letterSpacing="2" fontFamily="'Space Grotesk', sans-serif">{busy ? "CEO THINKING" : "CEO CORE"}</text>

            {nodes.map((n) => {
              const st = RADAR_STATES[n.state];
              const w = n.state === "working";
              const wt = w ? taskFor(n.agent.id, "In Progress") : null;
              return (
                <g key={n.agent.id}>
                  {w && <circle cx={n.x} cy={n.y} r="9" fill={st.color} opacity="0.22"><animate attributeName="r" values="7;12;7" dur="2s" repeatCount="indefinite" /></circle>}
                  <circle cx={n.x} cy={n.y} r={w ? 4.4 : n.state === "idle" || n.state === "off" ? 2.4 : 3.4}
                    fill={st.color} opacity={n.state === "off" ? 0.5 : 1}
                    style={w ? { filter: "drop-shadow(0 0 4px " + st.color + ")" } : {}}>
                    <title>{n.agent.code + " " + n.agent.name + " — " + st.label + (wt ? ": " + wt.title : "")}</title>
                  </circle>
                </g>
              );
            })}
          </svg>

          <div style={{ padding: "10px 16px 14px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            {workingNodes.length === 0
              ? <div style={{ fontSize: 12, color: "#8B86A3" }}>The fleet is standing by. Assign a task to an agent on the Tasks board and move it to In Progress — watch them light up and link to the core, live.</div>
              : <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {workingNodes.map((n) => {
                    const t = taskFor(n.agent.id, "In Progress");
                    return (
                      <span key={n.agent.id} style={{ fontSize: 11.5, padding: "5px 12px", borderRadius: 20, background: "rgba(255,176,32,0.1)", border: "1px solid rgba(255,176,32,0.3)", color: "#FFD27A", display: "inline-flex", alignItems: "center", gap: 7 }}>
                        <span className="q-blink" style={{ width: 5, height: 5, borderRadius: "50%", background: "#FFB020", display: "inline-block" }} />
                        <b style={{ color: "#FFB020" }}>{n.agent.code}</b> {n.agent.name} → {t.title.length > 44 ? t.title.slice(0, 42) + "…" : t.title}
                      </span>
                    );
                  })}
                </div>}
          </div>
        </div>
      )}
    </Card>
  );
}

/* ============================================================
   AUTOPILOT — the CEO reviews the live business and acts.
   Approve-first by default; full-auto applies immediately.
   ============================================================ */
function AutopilotPanel({ S, up, log, user }) {
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(null);
  const [open, setOpen] = useState(true);
  const ap = S.autopilot || { auto: false, last: null };

  async function run() {
    if (running) return;
    setRunning(true); setError(""); setPending(null);
    try {
      const sys = SYSTEM_PROMPT
        + (user ? "\n\nCURRENT USER: " + user.name + " (" + user.role + " at Qimmah Digital)." : "")
        + "\n\nLIVE BUSINESS STATE (real, current, from the Command Center):\n" + JSON.stringify(buildSnapshot(S))
        + "\n\n" + TOOL_INSTRUCTIONS;
      const prompt = "AUTOPILOT MODE. Review the live business state and act as the operating CEO. Reply with: (1) a briefing of 3-5 short lines covering the biggest risk, the biggest opportunity, and what you are doing about them right now; (2) an actions block with 2-6 concrete actions grounded in the state that move revenue toward the OMR " + REVENUE_TARGET + " monthly target. Prioritize new website leads (follow up fast), unpaid invoices, contracts near expiry, stalled or unassigned tasks, and an empty pipeline. If the business state is empty, your actions should set up the first real pipeline steps.";
      const raw = await aiCall(S, sys, [{ role: "user", content: prompt }]);
      const parsed = parseActions(raw);
      const briefing = (parsed.clean || raw).slice(0, 1500);
      if (ap.auto && parsed.actions && parsed.actions.length) {
        const out = applyActions(parsed.actions, S, up, log);
        up((s) => ({ ...s, autopilot: { ...(s.autopilot || {}), auto: true, last: { ts: Date.now(), briefing, results: out.results, links: out.links } } }));
        log("autopilot", "Autopilot run: " + out.results.length + " actions applied automatically");
      } else {
        setPending({ briefing, actions: parsed.actions || [] });
      }
    } catch (e) {
      setError(e && e.message ? e.message : "Autopilot could not reach the AI engine.");
    } finally {
      setRunning(false);
    }
  }

  function approve() {
    if (!pending) return;
    const out = applyActions(pending.actions, S, up, log);
    up((s) => ({ ...s, autopilot: { ...(s.autopilot || {}), last: { ts: Date.now(), briefing: pending.briefing, results: out.results, links: out.links } } }));
    log("autopilot", "Autopilot actions approved: " + out.results.length + " applied");
    setPending(null);
  }

  return (
    <Card glow style={{ marginBottom: 16, padding: 0, overflow: "hidden", border: "1px solid rgba(255,176,32,0.25)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", flexWrap: "wrap", gap: 8, borderBottom: open ? "1px solid rgba(255,255,255,0.07)" : "none" }}>
        <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: "#FFB020", display: "flex", alignItems: "center", gap: 7 }}>
          <Sparkles size={14} /> CEO Autopilot
        </span>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: ap.auto ? "#FFB020" : "#8B86A3", cursor: "pointer" }}>
            <input type="checkbox" checked={!!ap.auto} style={{ accentColor: "#FFB020" }}
              onChange={(e) => up((s) => ({ ...s, autopilot: { ...(s.autopilot || {}), auto: e.target.checked } }))} />
            Full auto (apply without approval)
          </label>
          <button style={{ ...btnPrimary, padding: "7px 14px", fontSize: 12.5, background: "linear-gradient(135deg,#B45309,#FFB020)", boxShadow: "0 0 18px rgba(255,176,32,0.3)" }} onClick={run} disabled={running}>
            {running ? "Reviewing the business…" : "Run Autopilot"}
          </button>
          <button style={{ ...btnGhost, fontSize: 12, padding: "5px 12px" }} onClick={() => setOpen(!open)}>{open ? "Hide" : "Show"}</button>
        </div>
      </div>
      {open && (
        <div style={{ padding: "12px 16px 14px" }}>
          {error && <div style={{ marginBottom: 10, padding: "9px 12px", borderRadius: 10, background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", color: "#FCA5A5", fontSize: 12.5 }}>{error}</div>}

          {pending && (
            <div style={{ marginBottom: 12, padding: 12, borderRadius: 12, background: "rgba(255,176,32,0.07)", border: "1px solid rgba(255,176,32,0.3)" }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "#FFB020", marginBottom: 6 }}>Briefing</div>
              <div style={{ fontSize: 13, color: "#E9E4FB", whiteSpace: "pre-wrap", lineHeight: 1.6, marginBottom: 10 }}>{pending.briefing}</div>
              {pending.actions.length > 0 ? (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "#FFB020", marginBottom: 6 }}>{pending.actions.length} proposed action{pending.actions.length > 1 ? "s" : ""}</div>
                  <div style={{ fontSize: 12.5, color: "#D8D3E8", lineHeight: 1.7, marginBottom: 10 }}>
                    {pending.actions.map((a, i) => <div key={i}>{"\u2022"} {describeAction(a)}</div>)}
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button style={{ ...btnPrimary, padding: "8px 16px", fontSize: 13 }} onClick={approve}><Check size={14} /> Approve and apply</button>
                    <button style={btnGhost} onClick={() => setPending(null)}>Discard</button>
                  </div>
                </div>
              ) : <div style={{ fontSize: 12, color: "#8B86A3" }}>No actions proposed this run.</div>}
            </div>
          )}

          {!pending && ap.last && (
            <div style={{ fontSize: 12.5, color: "#A5A0B8" }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "#C4B5FD", marginBottom: 5 }}>Last run · {timeAgo(ap.last.ts)}</div>
              <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.6, color: "#C9C4DC", marginBottom: 8 }}>{ap.last.briefing}</div>
              {ap.last.results && ap.last.results.length > 0 && (
                <div style={{ lineHeight: 1.7 }}>
                  {ap.last.results.map((r, i) => <div key={i} style={{ color: "#9FE8C4" }}>{"\u2713"} {r}</div>)}
                </div>
              )}
              {ap.last.links && ap.last.links.length > 0 && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                  {ap.last.links.map((l, i) => <a key={i} href={l.href} target="_blank" rel="noreferrer" style={{ ...btnGhost, fontSize: 12, textDecoration: "none" }}><Send size={12} /> {l.label}</a>)}
                </div>
              )}
            </div>
          )}

          {!pending && !ap.last && (
            <div style={{ fontSize: 12.5, color: "#8B86A3", lineHeight: 1.65 }}>
              Tap Run Autopilot and the CEO reads your entire live business — revenue vs target, unpaid invoices, contracts near expiry, stalled tasks — then briefs you and executes real actions: creating and assigning tasks, drafting invoices, preparing client messages. Approve-first by default; flip Full auto to let it act instantly. Honest limit: it runs when you trigger it (a browser app cannot work while closed), and prepared messages always need your tap to send.
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

/* ============================================================
   AI CEO CHAT — direct Groq API, voice in/out, insights
   ============================================================ */
function CEOChat({ S, up, log, user }) {
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [showVoice, setShowVoice] = useState(false);
  const [keyDraft, setKeyDraft] = useState("");
  const [copied, setCopied] = useState("");
  const scrollRef = useRef(null);
  const recRef = useRef(null);
  const audioRef = useRef(null);
  const draftRef = useRef("");
  draftRef.current = draft;

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [S.chat.length, busy]);

  function stopAudio() {
    try { if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; } } catch (e) {}
    try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch (e) {}
    setSpeaking(false);
  }

  async function speak(text) {
    stopAudio();
    const clean = text.replace(/[*#_`>]/g, "").slice(0, 2500);
    if (S.elKey) {
      try {
        const res = await fetch("https://api.elevenlabs.io/v1/text-to-speech/" + VOICE_IDS[S.elVoice], {
          method: "POST",
          headers: { "xi-api-key": S.elKey, "Content-Type": "application/json" },
          body: JSON.stringify({ text: clean, model_id: "eleven_multilingual_v2", voice_settings: { stability: 0.5, similarity_boost: 0.75 } }),
        });
        if (res.ok) {
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          const a = new Audio(url);
          a.playbackRate = S.rate;
          audioRef.current = a;
          setSpeaking(true);
          a.onended = () => { setSpeaking(false); URL.revokeObjectURL(url); };
          a.onerror = () => { setSpeaking(false); URL.revokeObjectURL(url); };
          await a.play();
          return;
        }
      } catch (e) { /* fall through to browser voice */ }
    }
    try {
      const u = new SpeechSynthesisUtterance(clean);
      u.rate = S.rate;
      u.onend = () => setSpeaking(false);
      u.onerror = () => setSpeaking(false);
      setSpeaking(true);
      window.speechSynthesis.speak(u);
    } catch (e) { setSpeaking(false); }
  }

  async function send(textArg) {
    const text = (textArg || draft).trim();
    if (!text || busy) return;
    setDraft(""); setError("");
    const userMsg = { id: uid(), role: "user", content: text, ts: Date.now(), by: user ? user.name : "" };
    up((s) => ({ ...s, chat: [...s.chat, userMsg] }));
    setBusy(true);
    try {
      const history = sanitizeHistory([...S.chat, userMsg].slice(-14));
      const sys = SYSTEM_PROMPT
        + (user ? "\n\nCURRENT USER: You are speaking with " + user.name + " (" + user.role + " at Qimmah Digital). Address them by name when natural." : "")
        + "\n\nLIVE BUSINESS STATE (real, current, from the Command Center):\n" + JSON.stringify(buildSnapshot(S))
        + "\n\n" + TOOL_INSTRUCTIONS;
      const raw = await aiCall(S, sys, history);
      const parsed = parseActions(raw);
      const reply = parsed.clean || raw;
      const aiMsg = { id: uid(), role: "assistant", content: reply, actions: parsed.actions || null, applied: false, links: [], ts: Date.now() };
      const cat = classifyInsight(reply);
      const insight = { id: uid(), cat, text: reply.replace(/[*#_`]/g, "").slice(0, 200), ts: Date.now() };
      up((s) => ({
        ...s,
        chat: [...s.chat, aiMsg],
        insights: [insight, ...s.insights].slice(0, 40),
      }));
      log("chat", "AI CEO answered " + (user ? user.name : "") + ": " + text.slice(0, 60));
      if (S.autoSpeak) speak(reply);
    } catch (e) {
      const msg = e && e.message ? e.message : "";
      setError(msg === "Failed to fetch" || !msg
        ? "Couldn't reach the AI engine. Check your internet connection and try again."
        : msg);
    } finally {
      setBusy(false);
    }
  }

  function toggleMic() {
    if (listening) {
      try { recRef.current && recRef.current.stop(); } catch (e) {}
      setListening(false);
      return;
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setError("Voice input is not supported in this browser. Chrome, Edge or Safari work best."); return; }
    setError("");
    const rec = new SR();
    recRef.current = rec;
    rec.lang = "en-US";
    rec.interimResults = true;
    rec.continuous = false;
    rec.onresult = (ev) => {
      let t = "";
      for (let i = 0; i < ev.results.length; i++) t += ev.results[i][0].transcript;
      setDraft(t);
    };
    rec.onend = () => {
      setListening(false);
      const finalText = draftRef.current.trim();
      if (finalText) send(finalText);
    };
    rec.onerror = (ev) => { setListening(false); if (ev && ev.error === "not-allowed") setError("Microphone access was blocked. Allow the mic in your browser settings — or in this preview, test voice after deploying."); };
    setListening(true);
    try { rec.start(); } catch (e) { setListening(false); }
  }

  const quicks = [
    "Which squad should handle a new restaurant client?",
    "Plan the path from OMR 4,800 to OMR 19,800 monthly.",
    "Draft next month's campaign focus for Army Burger.",
    "Top 3 priorities for this week.",
  ];

  /* --- API key setup screen (deployed mode only; preview runs keyless) --- */
  if (!S.groqKey && !IN_PREVIEW) {
    return (
      <div>
        <SectionTitle eyebrow="AI CEO" title="Activate your AI CEO" sub="The AI CEO runs on Groq's Llama 3.3 70B — free tier available. Your key is stored only on this device and sent only to Groq." />
        <Card glow style={{ maxWidth: 520 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <Sparkles size={20} style={{ color: PURPLE }} />
            <div style={{ fontWeight: 600, fontSize: 15 }}>Connect Groq</div>
          </div>
          <ol style={{ margin: "0 0 16px", paddingLeft: 18, fontSize: 13.5, color: "#B8B3CC", lineHeight: 1.8 }}>
            <li>Open <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer" style={{ color: CYAN }}>console.groq.com/keys</a> and create a free key</li>
            <li>Paste it below — it never leaves your browser except to Groq</li>
          </ol>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              style={inputStyle} type="password" placeholder="gsk_..."
              value={keyDraft} onChange={(e) => setKeyDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && keyDraft.trim()) { up((s) => ({ ...s, groqKey: keyDraft.trim() })); log("system", "Groq API key connected"); } }}
            />
            <button style={btnPrimary} onClick={() => { if (keyDraft.trim()) { up((s) => ({ ...s, groqKey: keyDraft.trim() })); log("system", "Groq API key connected"); } }}>
              <Check size={15} /> Activate
            </button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <OpsRadar S={S} busy={busy} />
      <AutopilotPanel S={S} up={up} log={log} user={user} />
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "stretch" }}>
      <div style={{ flex: "1 1 460px", minWidth: 300, display: "flex", flexDirection: "column", ...glass, overflow: "hidden" }}>
        {/* Chat header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: "50%", background: "linear-gradient(135deg,#7C3AED,#06B6D4)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 16px rgba(124,58,237,0.5)" }}>
              <Sparkles size={17} color="#fff" />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14.5 }}>AI CEO</div>
              <div style={{ fontSize: 11.5, color: speaking ? CYAN : "#34D399", display: "flex", alignItems: "center", gap: 5 }}>
                <span className={speaking ? "q-blink" : ""} style={{ width: 6, height: 6, borderRadius: "50%", background: speaking ? CYAN : "#34D399", display: "inline-block" }} />
                {speaking ? "Speaking…" : IN_PREVIEW ? "Online · Claude (preview engine)" : "Online · Groq Llama 3.3 70B"}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {speaking && <button style={btnGhost} onClick={stopAudio}><VolumeX size={14} /> Stop</button>}
            {S.chat.length > 0 && (
              <button style={btnGhost} title="Start a new conversation (insights are kept)"
                onClick={() => { stopAudio(); up((s) => ({ ...s, chat: [] })); log("chat", "Conversation cleared" + (user ? " by " + user.name : "")); }}>
                <Trash2 size={14} />
              </button>
            )}
            <button style={btnGhost} onClick={() => up((s) => ({ ...s, autoSpeak: !s.autoSpeak }))} title="Auto-speak replies">
              {S.autoSpeak ? <Volume2 size={14} /> : <VolumeX size={14} />}
            </button>
            <button style={btnGhost} onClick={() => setShowVoice(!showVoice)}><Settings size={14} /></button>
          </div>
        </div>

        {/* Voice settings */}
        {showVoice && (
          <div style={{ padding: 16, borderBottom: "1px solid rgba(255,255,255,0.07)", background: "rgba(124,58,237,0.05)" }}>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "#C4B5FD", marginBottom: 10 }}>Voice settings</div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
              <Field label="ElevenLabs key (optional)">
                <input style={inputStyle} type="password" placeholder="Leave empty to use browser voice" value={S.elKey} onChange={(e) => up((s) => ({ ...s, elKey: e.target.value.trim() }))} />
              </Field>
              <Field label="Voice preset">
                <select style={{ ...inputStyle, cursor: "pointer" }} value={S.elVoice} onChange={(e) => up((s) => ({ ...s, elVoice: e.target.value }))}>
                  {Object.keys(VOICE_IDS).map((v) => <option key={v} value={v} style={{ background: "#1a1327" }}>{v}</option>)}
                </select>
              </Field>
            </div>
            <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <Field label={"Speed · " + S.rate.toFixed(1) + "x"}>
                <input type="range" min="0.5" max="2" step="0.1" value={S.rate} onChange={(e) => up((s) => ({ ...s, rate: Number(e.target.value) }))} style={{ width: "100%", accentColor: PURPLE }} />
              </Field>
              <button style={btnGhost} onClick={() => speak("Marhaba Sultan. Qimmah Digital voice system is live and ready.")}><Volume2 size={14} /> Test voice</button>
            </div>
            <div style={{ fontSize: 11.5, color: "#8B86A3", marginTop: 8 }}>
              No ElevenLabs key? The built-in browser voice is used automatically — free, always available.
              {IN_PREVIEW && " Note: in this preview, ElevenLabs is blocked by the sandbox, so the browser voice is always used. Your ElevenLabs key activates after you deploy."}
            </div>
          </div>
        )}

        {/* Messages */}
        <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 12, minHeight: 320, maxHeight: 480 }}>
          {S.chat.length === 0 && (
            <div style={{ textAlign: "center", padding: "30px 10px" }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: "#E9E4FB", marginBottom: 6 }}>Marhaba{user ? ", " + user.name : ""} 👋</div>
              <div style={{ fontSize: 13, color: "#A5A0B8", maxWidth: 400, margin: "0 auto 16px" }}>
                Your AI CEO is live — full knowledge of all 60 agents, Oman market strategy, and the road to OMR 19,800/month. Ask anything, or tap the mic and speak.
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
                {quicks.map((q) => (
                  <button key={q} style={{ ...btnGhost, fontSize: 12 }} onClick={() => send(q)}>{q}</button>
                ))}
              </div>
            </div>
          )}
          {S.chat.map((m) => (
            <div key={m.id} style={{ alignSelf: m.role === "user" ? "flex-end" : "flex-start", maxWidth: "85%" }}>
              <div style={{
                padding: "10px 14px", borderRadius: 14, fontSize: 14, lineHeight: 1.55, whiteSpace: "pre-wrap",
                ...(m.role === "user"
                  ? { background: "linear-gradient(135deg,#7C3AED,#6D28D9)", color: "#fff", borderBottomRightRadius: 4 }
                  : { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "#E9E4FB", borderBottomLeftRadius: 4 }),
              }}>
                {m.content}
              </div>
              {m.role === "assistant" && m.actions && m.actions.length > 0 && (
                <div style={{ marginTop: 6, padding: 10, borderRadius: 10, background: "rgba(255,176,32,0.08)", border: "1px solid rgba(255,176,32,0.3)" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "#FFB020", marginBottom: 6 }}>
                    {m.applied ? "Actions executed" : m.actions.length + " proposed action" + (m.actions.length > 1 ? "s" : "")}
                  </div>
                  <div style={{ fontSize: 12, color: "#D8D3E8", lineHeight: 1.65 }}>
                    {m.actions.map((a, i) => <div key={i}>{"\u2022"} {describeAction(a)}</div>)}
                  </div>
                  {!m.applied && (
                    <button style={{ ...btnPrimary, marginTop: 8, padding: "7px 14px", fontSize: 12.5 }}
                      onClick={() => {
                        const out = applyActions(m.actions, S, up, log);
                        up((s) => ({ ...s, chat: s.chat.map((x) => (x.id === m.id ? { ...x, applied: true, links: out.links } : x)) }));
                      }}>
                      <Check size={13} /> Apply now
                    </button>
                  )}
                  {m.applied && m.links && m.links.length > 0 && (
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                      {m.links.map((l, i) => <a key={i} href={l.href} target="_blank" rel="noreferrer" style={{ ...btnGhost, fontSize: 12, textDecoration: "none" }}><Send size={12} /> {l.label}</a>)}
                    </div>
                  )}
                </div>
              )}
              {m.role === "assistant" && (
                <div style={{ display: "flex", gap: 10, marginTop: 5, paddingLeft: 4 }}>
                  <button style={{ background: "none", border: "none", color: copied === m.id ? "#34D399" : "#8B86A3", cursor: "pointer", fontSize: 11.5, display: "flex", alignItems: "center", gap: 4, padding: 0, fontFamily: "inherit" }}
                    onClick={() => { try { navigator.clipboard.writeText(m.content); setCopied(m.id); setTimeout(() => setCopied(""), 1500); } catch (e) {} }}>
                    <Copy size={12} /> {copied === m.id ? "Copied" : "Copy"}
                  </button>
                  <button style={{ background: "none", border: "none", color: "#8B86A3", cursor: "pointer", fontSize: 11.5, display: "flex", alignItems: "center", gap: 4, padding: 0, fontFamily: "inherit" }} onClick={() => speak(m.content)}>
                    <Volume2 size={12} /> Play
                  </button>
                </div>
              )}
            </div>
          ))}
          {busy && (
            <div style={{ alignSelf: "flex-start", padding: "12px 16px", borderRadius: 14, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", gap: 5 }}>
              <span className="q-dot" style={{ animationDelay: "0s" }} />
              <span className="q-dot" style={{ animationDelay: "0.15s" }} />
              <span className="q-dot" style={{ animationDelay: "0.3s" }} />
            </div>
          )}
        </div>

        {error && (
          <div style={{ margin: "0 16px 10px", padding: "10px 14px", borderRadius: 10, background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", color: "#FCA5A5", fontSize: 13 }}>
            {error}
          </div>
        )}

        {/* Composer */}
        <div style={{ display: "flex", gap: 10, padding: 14, borderTop: "1px solid rgba(255,255,255,0.07)", alignItems: "center" }}>
          <button onClick={toggleMic} title={listening ? "Stop listening" : "Speak to your AI CEO"}
            style={{
              width: 56, height: 56, borderRadius: "50%", border: "none", cursor: "pointer", flexShrink: 0,
              background: listening ? "linear-gradient(135deg,#EF4444,#DC2626)" : "linear-gradient(135deg,#7C3AED,#6D28D9)",
              boxShadow: listening ? "0 0 24px rgba(239,68,68,0.6)" : "0 0 24px rgba(124,58,237,0.5)",
              display: "flex", alignItems: "center", justifyContent: "center", position: "relative",
            }}>
            {listening && <span className="q-ring" />}
            {listening
              ? <span style={{ display: "flex", gap: 3, alignItems: "flex-end", height: 22 }}>
                  {[0,1,2,3,4,5,6].map((i) => <span key={i} className="q-bar" style={{ animationDelay: (i * 0.09) + "s" }} />)}
                </span>
              : <Mic size={22} color="#fff" />}
          </button>
          <input
            style={{ ...inputStyle, flex: 1 }} placeholder={listening ? "Listening…" : "Ask your AI CEO anything…"}
            value={draft} onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") send(); }}
          />
          <button style={{ ...btnPrimary, padding: "12px 16px" }} onClick={() => send()} disabled={busy}>
            <Send size={16} />
          </button>
        </div>
      </div>

      {/* Insights panel */}
      <div style={{ flex: "0 1 280px", minWidth: 240 }}>
        <Card style={{ height: "100%" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: "#C4B5FD" }}>Extracted insights</div>
            {S.insights.length > 0 && (
              <button style={{ background: "none", border: "none", color: "#8B86A3", cursor: "pointer", padding: 0 }} title="Clear insights"
                onClick={() => up((s) => ({ ...s, insights: [] }))}><Trash2 size={13} /></button>
            )}
          </div>
          {S.insights.length === 0
            ? <div style={{ fontSize: 12.5, color: "#8B86A3" }}>Insights are pulled automatically from every AI CEO answer and categorized as strategy, agents, market, finance or operations. Start a conversation to build your knowledge base.</div>
            : <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 460, overflowY: "auto" }}>
                {S.insights.map((i) => (
                  <div key={i.id} style={{ padding: 10, borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 10, letterSpacing: 1, textTransform: "uppercase", color: CYAN, fontWeight: 700 }}>{i.cat}</span>
                      <span style={{ fontSize: 10, color: "#6B6685" }}>{timeAgo(i.ts)}</span>
                    </div>
                    <div style={{ fontSize: 12, color: "#C9C4DC", lineHeight: 1.5 }}>{i.text}…</div>
                  </div>
                ))}
              </div>}
        </Card>
      </div>
      </div>
    </div>
  );
}

/* ============================================================
   AGENTS — the 60-agent fleet
   ============================================================ */
function Agents({ S, up, log }) {
  const [filter, setFilter] = useState("All");
  const squads = ["All", "Alpha", "Beta", "Gamma", "Delta", "Epsilon"];
  const shown = AGENTS.filter((a) => filter === "All" || a.squad === filter);
  const activeCount = AGENTS.length - Object.keys(S.agentsOff).length;

  return (
    <div>
      <SectionTitle eyebrow="The Fleet" title="60 AI Agents · 5 Squads" sub="Toggle agents on or off based on live client needs. The AI CEO knows every one of them by code and specialty." />
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 18 }}>
        <Stat label="Active agents" value={activeCount + " / 60"} accent="#34D399" />
        {Object.entries(SQUAD_META).map(([sq, m]) => {
          const total = AGENTS.filter((a) => a.squad === sq).length;
          const off = AGENTS.filter((a) => a.squad === sq && S.agentsOff[a.id]).length;
          return <Stat key={sq} label={"Squad " + sq} value={(total - off) + "/" + total} accent={m.color} sub={m.role} />;
        })}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        {squads.map((sq) => (
          <button key={sq} onClick={() => setFilter(sq)}
            style={{ ...btnGhost, ...(filter === sq ? { background: "rgba(124,58,237,0.25)", borderColor: PURPLE, color: "#EDE9FE" } : {}) }}>
            {sq}
          </button>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: 10 }}>
        {shown.map((a) => {
          const isOff = !!S.agentsOff[a.id];
          const m = SQUAD_META[a.squad];
          return (
            <div key={a.id} style={{ ...glass, padding: 14, opacity: isOff ? 0.5 : 1, borderColor: isOff ? "rgba(255,255,255,0.06)" : "rgba(124,58,237,0.25)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 1, color: m.color }}>{a.code}</span>
                <button
                  onClick={() => {
                    up((s) => {
                      const off = { ...s.agentsOff };
                      if (off[a.id]) delete off[a.id]; else off[a.id] = true;
                      return { ...s, agentsOff: off };
                    });
                    log("agent", a.code + " " + a.name + (isOff ? " activated" : " deactivated"));
                  }}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                  {isOff ? <Circle size={16} style={{ color: "#6B6685" }} /> : <CheckCircle2 size={16} style={{ color: "#34D399" }} />}
                </button>
              </div>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: "#E9E4FB", marginBottom: 3 }}>{a.name}</div>
              <div style={{ fontSize: 11, color: "#8B86A3" }}>Squad {a.squad} · {m.role}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ============================================================
   TASKS — kanban board
   ============================================================ */
const COLS = ["Backlog", "In Progress", "Review", "Done"];
const PRIORITIES = { High: "#F87171", Medium: "#FBBF24", Low: "#34D399" };

function Tasks({ S, up, log }) {
  const [title, setTitle] = useState("");
  const [prio, setPrio] = useState("Medium");
  const [agentId, setAgentId] = useState("");

  function addTask() {
    const t = title.trim();
    if (!t) return;
    const task = { id: uid(), title: t, col: "Backlog", prio, agentId: agentId ? Number(agentId) : null, ts: Date.now() };
    up((s) => ({ ...s, tasks: [...s.tasks, task] }));
    log("task", "Task created: " + t.slice(0, 60));
    setTitle("");
  }
  function move(task, dir) {
    const i = COLS.indexOf(task.col);
    const next = COLS[i + dir];
    if (!next) return;
    up((s) => ({ ...s, tasks: s.tasks.map((t) => (t.id === task.id ? { ...t, col: next } : t)) }));
    if (next === "Done") log("task", "Task completed: " + task.title.slice(0, 60));
  }

  return (
    <div>
      <SectionTitle eyebrow="Execution" title="Tasks Board" sub="Assign work to specific agents and move it through the pipeline. Completed tasks feed your analytics." />
      <Card style={{ marginBottom: 18 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
          <Field label="New task">
            <input style={inputStyle} placeholder="e.g. Launch Army Burger Ramadan campaign" value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addTask(); }} />
          </Field>
          <Field label="Priority">
            <select style={{ ...inputStyle, cursor: "pointer" }} value={prio} onChange={(e) => setPrio(e.target.value)}>
              {Object.keys(PRIORITIES).map((p) => <option key={p} style={{ background: "#1a1327" }}>{p}</option>)}
            </select>
          </Field>
          <Field label="Assign agent">
            <select style={{ ...inputStyle, cursor: "pointer" }} value={agentId} onChange={(e) => setAgentId(e.target.value)}>
              <option value="" style={{ background: "#1a1327" }}>Unassigned</option>
              {AGENTS.map((a) => <option key={a.id} value={a.id} style={{ background: "#1a1327" }}>{a.code} · {a.name}</option>)}
            </select>
          </Field>
          <button style={btnPrimary} onClick={addTask}><Plus size={15} /> Add</button>
        </div>
      </Card>
      {S.tasks.length === 0
        ? <Empty icon={ListTodo} title="No tasks yet" body="Add your first task above. Assign it to one of your 60 agents and track it from Backlog to Done." />
        : <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 12 }}>
            {COLS.map((col) => (
              <div key={col} style={{ ...glass, padding: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "#C4B5FD", marginBottom: 10, display: "flex", justifyContent: "space-between" }}>
                  {col}
                  <span style={{ color: "#6B6685" }}>{S.tasks.filter((t) => t.col === col).length}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {S.tasks.filter((t) => t.col === col).map((t) => {
                    const agent = t.agentId ? AGENTS.find((a) => a.id === t.agentId) : null;
                    return (
                      <div key={t.id} style={{ background: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: 10 }}>
                        <div style={{ fontSize: 13, color: "#E9E4FB", marginBottom: 6, lineHeight: 1.4 }}>{t.title}</div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: PRIORITIES[t.prio] + "22", color: PRIORITIES[t.prio] }}>{t.prio}</span>
                          <div style={{ display: "flex", gap: 4 }}>
                            <button style={{ background: "none", border: "none", cursor: "pointer", color: "#8B86A3", padding: 2 }} onClick={() => move(t, -1)} disabled={t.col === COLS[0]}><ChevronLeft size={14} /></button>
                            <button style={{ background: "none", border: "none", cursor: "pointer", color: "#8B86A3", padding: 2 }} onClick={() => move(t, 1)} disabled={t.col === COLS[3]}><ChevronRight size={14} /></button>
                            <button style={{ background: "none", border: "none", cursor: "pointer", color: "#8B86A3", padding: 2 }} onClick={() => up((s) => ({ ...s, tasks: s.tasks.filter((x) => x.id !== t.id) }))}><Trash2 size={13} /></button>
                          </div>
                        </div>
                        {agent && <div style={{ fontSize: 10.5, color: SQUAD_META[agent.squad].color, marginTop: 6 }}>{agent.code} · {agent.name}</div>}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>}
    </div>
  );
}

/* ============================================================
   FINANCE HUB — real manual entry, computed KPIs
   ============================================================ */
function Finance({ S, up, log }) {
  const [tab, setTab] = useState("transactions");
  const [tx, setTx] = useState({ desc: "", amount: "", type: "income" });
  const [inv, setInv] = useState({ client: "", amount: "" });
  const [acc, setAcc] = useState({ name: "", balance: "" });

  const thisMonth = lastMonths(1)[0];
  const monthTx = S.transactions.filter((t) => t.date.startsWith(thisMonth));
  const income = monthTx.filter((t) => t.type === "income").reduce((a, t) => a + t.amount, 0);
  const expenses = monthTx.filter((t) => t.type === "expense").reduce((a, t) => a + t.amount, 0);
  const pct = Math.min(100, Math.round((income / REVENUE_TARGET) * 100));

  function addTx() {
    const amount = Number(tx.amount);
    if (!tx.desc.trim() || !amount || amount <= 0) return;
    const rec = { id: uid(), desc: tx.desc.trim(), amount, type: tx.type, date: new Date().toISOString().slice(0, 10) };
    up((s) => ({ ...s, transactions: [rec, ...s.transactions] }));
    log("finance", (tx.type === "income" ? "Income" : "Expense") + " recorded: " + omr(amount) + " — " + tx.desc.slice(0, 40));
    setTx({ desc: "", amount: "", type: tx.type });
  }
  function addInv() {
    const amount = Number(inv.amount);
    if (!inv.client.trim() || !amount || amount <= 0) return;
    up((s) => ({ ...s, invoices: [{ id: uid(), client: inv.client.trim(), amount, status: "Draft", date: new Date().toISOString().slice(0, 10) }, ...s.invoices] }));
    log("finance", "Invoice drafted: " + inv.client + " — " + omr(amount));
    setInv({ client: "", amount: "" });
  }
  function cycleInvoice(i) {
    const order = ["Draft", "Sent", "Paid"];
    const next = order[(order.indexOf(i.status) + 1) % 3];
    up((s) => ({ ...s, invoices: s.invoices.map((x) => (x.id === i.id ? { ...x, status: next } : x)) }));
    if (next === "Paid") {
      const rec = { id: uid(), desc: "Invoice paid — " + i.client, amount: i.amount, type: "income", date: new Date().toISOString().slice(0, 10) };
      up((s) => ({ ...s, transactions: [rec, ...s.transactions] }));
      log("finance", "Invoice paid: " + i.client + " — " + omr(i.amount));
    }
  }
  function addAcc() {
    const balance = Number(acc.balance);
    if (!acc.name.trim() || isNaN(balance)) return;
    up((s) => ({ ...s, accounts: [...s.accounts, { id: uid(), name: acc.name.trim(), balance }] }));
    setAcc({ name: "", balance: "" });
  }

  const invColor = { Draft: "#8B86A3", Sent: "#FBBF24", Paid: "#34D399" };

  return (
    <div>
      <SectionTitle eyebrow="Money" title="Finance Hub" sub="Every figure below is computed from entries you make here — nothing is simulated. Mark an invoice as Paid and it books itself as income." />
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 18 }}>
        <Stat label="Income this month" value={omr(income)} accent="#34D399" />
        <Stat label="Expenses this month" value={omr(expenses)} accent="#F87171" />
        <Stat label="Net this month" value={omr(income - expenses)} accent={income - expenses >= 0 ? CYAN : "#F87171"} />
        <Card style={{ flex: "1 1 200px", minWidth: 200 }}>
          <div style={{ fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", color: "#8B86A3", marginBottom: 6 }}>Target · {omr(REVENUE_TARGET)}/mo</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#F5F3FF", fontFamily: "'Space Grotesk', sans-serif", marginBottom: 8 }}>{pct}%</div>
          <div style={{ height: 8, borderRadius: 8, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
            <div style={{ height: "100%", width: pct + "%", background: "linear-gradient(90deg,#7C3AED,#06B6D4)", borderRadius: 8, transition: "width 0.6s" }} />
          </div>
        </Card>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        {["transactions", "invoices", "accounts"].map((t) => (
          <button key={t} onClick={() => setTab(t)} style={{ ...btnGhost, textTransform: "capitalize", ...(tab === t ? { background: "rgba(124,58,237,0.25)", borderColor: PURPLE, color: "#EDE9FE" } : {}) }}>{t}</button>
        ))}
      </div>

      {tab === "transactions" && (
        <div>
          <Card style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
              <Field label="Description"><input style={inputStyle} placeholder="e.g. Army Burger monthly retainer" value={tx.desc} onChange={(e) => setTx({ ...tx, desc: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter") addTx(); }} /></Field>
              <Field label="Amount (OMR)"><input style={inputStyle} type="number" min="0" placeholder="0" value={tx.amount} onChange={(e) => setTx({ ...tx, amount: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter") addTx(); }} /></Field>
              <Field label="Type">
                <select style={{ ...inputStyle, cursor: "pointer" }} value={tx.type} onChange={(e) => setTx({ ...tx, type: e.target.value })}>
                  <option value="income" style={{ background: "#1a1327" }}>Income</option>
                  <option value="expense" style={{ background: "#1a1327" }}>Expense</option>
                </select>
              </Field>
              <button style={btnPrimary} onClick={addTx}><Plus size={15} /> Record</button>
            </div>
          </Card>
          {S.transactions.length === 0
            ? <Empty icon={Wallet} title="No transactions yet" body="Record your first real income or expense above. Analytics and MiroFish forecasts are built from these entries." />
            : <Card style={{ padding: 0, overflow: "hidden" }}>
                {S.transactions.map((t, i) => (
                  <div key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderBottom: i < S.transactions.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none" }}>
                    <div>
                      <div style={{ fontSize: 13.5, color: "#E9E4FB" }}>{t.desc}</div>
                      <div style={{ fontSize: 11, color: "#6B6685" }}>{t.date}</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{ fontWeight: 700, fontSize: 14, color: t.type === "income" ? "#34D399" : "#F87171" }}>{t.type === "income" ? "+" : "−"}{omr(t.amount)}</span>
                      <button style={{ background: "none", border: "none", cursor: "pointer", color: "#6B6685", padding: 2 }} onClick={() => up((s) => ({ ...s, transactions: s.transactions.filter((x) => x.id !== t.id) }))}><Trash2 size={13} /></button>
                    </div>
                  </div>
                ))}
              </Card>}
        </div>
      )}

      {tab === "invoices" && (
        <div>
          <Card style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
              <Field label="Client"><input style={inputStyle} placeholder="e.g. Army Burger" value={inv.client} onChange={(e) => setInv({ ...inv, client: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter") addInv(); }} /></Field>
              <Field label="Amount (OMR)"><input style={inputStyle} type="number" min="0" placeholder="0" value={inv.amount} onChange={(e) => setInv({ ...inv, amount: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter") addInv(); }} /></Field>
              <button style={btnPrimary} onClick={addInv}><Plus size={15} /> Draft invoice</button>
            </div>
          </Card>
          {S.invoices.length === 0
            ? <Empty icon={Wallet} title="No invoices yet" body="Draft an invoice, tap its status to move it Draft → Sent → Paid. Paid invoices are booked as income automatically." />
            : <Card style={{ padding: 0, overflow: "hidden" }}>
                {S.invoices.map((iv, i) => (
                  <div key={iv.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderBottom: i < S.invoices.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none" }}>
                    <div>
                      <div style={{ fontSize: 13.5, color: "#E9E4FB" }}>{iv.client}</div>
                      <div style={{ fontSize: 11, color: "#6B6685" }}>{iv.date} · {omr(iv.amount)}</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <button onClick={() => cycleInvoice(iv)} title="Tap to change status"
                        style={{ fontSize: 11, fontWeight: 700, padding: "4px 12px", borderRadius: 20, cursor: "pointer", background: invColor[iv.status] + "22", color: invColor[iv.status], border: "1px solid " + invColor[iv.status] + "44", fontFamily: "inherit" }}>
                        {iv.status}
                      </button>
                      <button style={{ background: "none", border: "none", cursor: "pointer", color: "#6B6685", padding: 2 }} onClick={() => up((s) => ({ ...s, invoices: s.invoices.filter((x) => x.id !== iv.id) }))}><Trash2 size={13} /></button>
                    </div>
                  </div>
                ))}
              </Card>}
        </div>
      )}

      {tab === "accounts" && (
        <div>
          <Card style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
              <Field label="Account name"><input style={inputStyle} placeholder="e.g. Bank Muscat — Business" value={acc.name} onChange={(e) => setAcc({ ...acc, name: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter") addAcc(); }} /></Field>
              <Field label="Balance (OMR)"><input style={inputStyle} type="number" placeholder="0" value={acc.balance} onChange={(e) => setAcc({ ...acc, balance: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter") addAcc(); }} /></Field>
              <button style={btnPrimary} onClick={addAcc}><Plus size={15} /> Add account</button>
            </div>
          </Card>
          {S.accounts.length === 0
            ? <Empty icon={Wallet} title="No accounts yet" body="Add your real bank accounts to track balances alongside monthly cash flow." />
            : <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
                {S.accounts.map((a) => (
                  <Card key={a.id}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <div style={{ fontSize: 13, color: "#C9C4DC" }}>{a.name}</div>
                      <button style={{ background: "none", border: "none", cursor: "pointer", color: "#6B6685", padding: 0 }} onClick={() => up((s) => ({ ...s, accounts: s.accounts.filter((x) => x.id !== a.id) }))}><Trash2 size={13} /></button>
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: "#F5F3FF", fontFamily: "'Space Grotesk', sans-serif", marginTop: 8 }}>{omr(a.balance)}</div>
                  </Card>
                ))}
              </div>}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   CONTRACTS — client agreements with signed-file storage
   ============================================================ */
const CONTRACT_FLOW = ["Draft", "Sent", "Signed", "Active", "Completed"];
const CONTRACT_COLORS = { Draft: "#8B86A3", Sent: "#FBBF24", Signed: "#34D399", Active: "#22D3EE", Completed: "#A78BFA" };
const MAX_FILE_KB = 400;

function Contracts({ S, up, log }) {
  const [form, setForm] = useState({ client: "", service: "", value: "", billing: "monthly", start: "", end: "", link: "" });
  const [err, setErr] = useState("");
  const fileRefs = useRef({});

  const contracts = S.contracts || [];
  const signedOrLater = contracts.filter((c) => ["Signed", "Active"].includes(c.status));
  const mrr = signedOrLater.filter((c) => c.billing === "monthly").reduce((a, c) => a + c.value, 0);
  const oneOff = signedOrLater.filter((c) => c.billing === "one-time").reduce((a, c) => a + c.value, 0);
  const soon = contracts.filter((c) => {
    if (c.status !== "Active" || !c.end) return false;
    const days = Math.ceil((new Date(c.end) - new Date()) / 86400000);
    return days >= 0 && days <= 30;
  }).length;
  const attachedKB = Math.round(contracts.reduce((a, c) => a + (c.fileData ? c.fileData.length : 0), 0) / 1024);

  function addContract() {
    const value = Number(form.value);
    if (!form.client.trim()) { setErr("Enter the client name."); return; }
    if (!form.service.trim()) { setErr("Enter the service or package."); return; }
    if (!value || value <= 0) { setErr("Enter a contract value above zero."); return; }
    const c = {
      id: uid(), client: form.client.trim(), service: form.service.trim(), value,
      billing: form.billing, start: form.start, end: form.end, link: form.link.trim(),
      status: "Draft", signedDate: "", fileName: "", fileData: "", ts: Date.now(),
    };
    up((s) => ({ ...s, contracts: [c, ...(s.contracts || [])] }));
    log("contract", "Contract drafted: " + c.client + " — " + omr(value) + (c.billing === "monthly" ? "/mo" : ""));
    setForm({ client: "", service: "", value: "", billing: form.billing, start: "", end: "", link: "" });
    setErr("");
  }

  function cycle(c) {
    const next = CONTRACT_FLOW[(CONTRACT_FLOW.indexOf(c.status) + 1) % CONTRACT_FLOW.length];
    up((s) => ({
      ...s,
      contracts: s.contracts.map((x) => (x.id === c.id ? { ...x, status: next, signedDate: next === "Signed" ? new Date().toISOString().slice(0, 10) : x.signedDate } : x)),
    }));
    if (next === "Signed") {
      up((s) => ({ ...s, invoices: [{ id: uid(), client: c.client, amount: c.value, status: "Draft", date: new Date().toISOString().slice(0, 10) }, ...s.invoices] }));
      log("contract", "Contract SIGNED: " + c.client + " — invoice for " + omr(c.value) + " auto-drafted in Finance");
    } else {
      log("contract", "Contract " + c.client + " moved to " + next);
    }
  }

  function attachFile(c, file) {
    setErr("");
    if (!file) return;
    if (file.size > MAX_FILE_KB * 1024) {
      setErr("\"" + file.name + "\" is " + Math.round(file.size / 1024) + " KB — over the " + MAX_FILE_KB + " KB on-device limit. Paste a Google Drive or Dropbox link instead; it works for any size.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      up((s) => ({ ...s, contracts: s.contracts.map((x) => (x.id === c.id ? { ...x, fileName: file.name, fileData: reader.result } : x)) }));
      log("contract", "Signed file attached to " + c.client + ": " + file.name);
    };
    reader.onerror = () => setErr("Couldn't read that file. Try again or use a link instead.");
    reader.readAsDataURL(file);
  }

  return (
    <div>
      <SectionTitle eyebrow="Agreements" title="Contracts" sub="Track every client agreement from draft to completion. Mark one as Signed and its invoice is drafted in the Finance Hub automatically." />
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 18 }}>
        <Stat label="Contracted MRR" value={omr(mrr) + "/mo"} accent="#34D399" sub="signed + active monthly deals" />
        <Stat label="One-time signed" value={omr(oneOff)} accent={CYAN} />
        <Stat label="Active contracts" value={contracts.filter((c) => c.status === "Active").length} accent="#A78BFA" />
        <Stat label="Expiring in 30 days" value={soon} accent={soon > 0 ? "#FBBF24" : "#8B86A3"} sub={soon > 0 ? "time to renew" : "all clear"} />
      </div>

      <Card style={{ marginBottom: 8 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
          <Field label="Client"><input style={inputStyle} placeholder="e.g. Army Burger" value={form.client} onChange={(e) => setForm({ ...form, client: e.target.value })} /></Field>
          <Field label="Service / package"><input style={inputStyle} placeholder="e.g. Premium — full digital marketing" value={form.service} onChange={(e) => setForm({ ...form, service: e.target.value })} /></Field>
          <Field label="Value (OMR)"><input style={inputStyle} type="number" min="0" placeholder="500" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} /></Field>
          <Field label="Billing">
            <select style={{ ...inputStyle, cursor: "pointer" }} value={form.billing} onChange={(e) => setForm({ ...form, billing: e.target.value })}>
              <option value="monthly" style={{ background: "#1a1327" }}>Monthly</option>
              <option value="one-time" style={{ background: "#1a1327" }}>One-time</option>
            </select>
          </Field>
          <Field label="Start"><input style={inputStyle} type="date" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} /></Field>
          <Field label="End"><input style={inputStyle} type="date" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} /></Field>
          <Field label="File link (Drive / Dropbox, optional)"><input style={inputStyle} placeholder="https://…" value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} /></Field>
          <button style={btnPrimary} onClick={addContract}><Plus size={15} /> Add contract</button>
        </div>
      </Card>
      {err && <div style={{ margin: "0 0 14px", padding: "10px 14px", borderRadius: 10, background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", color: "#FCA5A5", fontSize: 13 }}>{err}</div>}
      {attachedKB > 0 && <div style={{ fontSize: 11.5, color: "#8B86A3", margin: "0 0 14px" }}>On-device signed files: ~{attachedKB} KB stored. Keep total small — big files belong in Drive links.</div>}

      {contracts.length === 0
        ? <Empty icon={FileText} title="No contracts yet" body="Add your first client agreement above. When your customer signs, tap the status until it says Signed — the file can be attached right on the card, and the invoice drafts itself." />
        : <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))", gap: 12 }}>
            {contracts.map((c) => {
              const days = c.end ? Math.ceil((new Date(c.end) - new Date()) / 86400000) : null;
              return (
                <Card key={c.id}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: "#F5F3FF" }}>{c.client}</div>
                      <div style={{ fontSize: 12, color: "#A5A0B8", marginTop: 2 }}>{c.service}</div>
                    </div>
                    <button onClick={() => cycle(c)} title="Tap to advance status"
                      style={{ fontSize: 11, fontWeight: 700, padding: "4px 12px", borderRadius: 20, cursor: "pointer", flexShrink: 0, fontFamily: "inherit", background: CONTRACT_COLORS[c.status] + "22", color: CONTRACT_COLORS[c.status], border: "1px solid " + CONTRACT_COLORS[c.status] + "44" }}>
                      {c.status}
                    </button>
                  </div>
                  <div style={{ fontSize: 19, fontWeight: 700, color: "#E9E4FB", fontFamily: "'Space Grotesk', sans-serif", marginBottom: 6 }}>
                    {omr(c.value)}<span style={{ fontSize: 12, color: "#8B86A3", fontWeight: 500 }}>{c.billing === "monthly" ? " /month" : " one-time"}</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: "#8B86A3", lineHeight: 1.7, marginBottom: 10 }}>
                    {c.start && <span>From {c.start} </span>}{c.end && <span>to {c.end}</span>}
                    {c.signedDate && <div style={{ color: "#34D399" }}>Signed on {c.signedDate}</div>}
                    {days !== null && c.status === "Active" && days <= 30 && days >= 0 && <div style={{ color: "#FBBF24" }}>⚠ Renewal in {days} day{days === 1 ? "" : "s"}</div>}
                    {days !== null && days < 0 && c.status === "Active" && <div style={{ color: "#F87171" }}>Ended {-days} day{days === -1 ? "" : "s"} ago — renew or complete it</div>}
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                    <input type="file" accept=".pdf,.png,.jpg,.jpeg" style={{ display: "none" }}
                      ref={(el) => { fileRefs.current[c.id] = el; }}
                      onChange={(e) => { attachFile(c, e.target.files && e.target.files[0]); e.target.value = ""; }} />
                    <button style={{ ...btnGhost, fontSize: 12 }} onClick={() => { const el = fileRefs.current[c.id]; if (el) el.click(); }}>
                      <Paperclip size={12} /> {c.fileName ? "Replace file" : "Attach signed file"}
                    </button>
                    {c.fileData && (
                      <a href={c.fileData} download={c.fileName} style={{ ...btnGhost, fontSize: 12, textDecoration: "none" }}>
                        <Download size={12} /> {c.fileName.length > 18 ? c.fileName.slice(0, 15) + "…" : c.fileName}
                      </a>
                    )}
                    {c.link && (
                      <a href={c.link} target="_blank" rel="noreferrer" style={{ ...btnGhost, fontSize: 12, textDecoration: "none" }}>
                        <ExternalLink size={12} /> Open link
                      </a>
                    )}
                    <button style={{ background: "none", border: "none", cursor: "pointer", color: "#6B6685", padding: 4, marginLeft: "auto" }}
                      onClick={() => { up((s) => ({ ...s, contracts: s.contracts.filter((x) => x.id !== c.id) })); log("contract", "Contract removed: " + c.client); }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                </Card>
              );
            })}
          </div>}
    </div>
  );
}

/* ============================================================
   LEADS — the plug between qimmah.digital and the CEO.
   Pulls real form submissions from the free Cloudflare bridge.
   ============================================================ */
const LEAD_STATUS = ["New", "Contacted", "Won", "Lost"];
const LEAD_COLORS = { New: "#60A5FA", Contacted: "#FBBF24", Won: "#34D399", Lost: "#8B86A3" };

function Leads({ S, up, log }) {
  const [syncing, setSyncing] = useState(false);
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");
  const [showSetup, setShowSetup] = useState(false);
  const [manual, setManual] = useState({ name: "", contact: "", message: "" });
  const bridge = S.bridge || { url: "", key: "" };
  const leads = S.leads || [];
  const newCount = leads.filter((l) => l.status === "New").length;

  async function sync() {
    if (!bridge.url.trim() || !bridge.key.trim()) { setShowSetup(true); setErr("Add your Bridge Worker URL and key first, then sync."); return; }
    setSyncing(true); setErr(""); setInfo("");
    try {
      const res = await fetch(bridge.url.trim().replace(/\/+$/, "") + "/leads", { headers: { "X-Bridge-Key": bridge.key.trim() } });
      if (res.status === 401) throw new Error("Bridge key rejected - it must match the BRIDGE_KEY secret on your Worker.");
      if (!res.ok) throw new Error("Bridge returned error " + res.status + ".");
      const data = await res.json();
      const incoming = Array.isArray(data.leads) ? data.leads : [];
      const have = new Set(leads.map((l) => l.id));
      const fresh = incoming.filter((l) => l && l.id && !have.has(l.id));
      if (fresh.length > 0) {
        up((s) => ({ ...s, leads: [...fresh.map((l) => ({ id: l.id, name: String(l.name || "").slice(0, 80), contact: String(l.contact || "").slice(0, 120), message: String(l.message || "").slice(0, 1000), source: String(l.source || "website").slice(0, 40), ts: l.ts || Date.now(), status: "New" })), ...(s.leads || [])] }));
        log("lead", fresh.length + " new website lead" + (fresh.length > 1 ? "s" : "") + " pulled from the bridge");
        setInfo(fresh.length + " new lead" + (fresh.length > 1 ? "s" : "") + " pulled in.");
      } else {
        setInfo("Synced - no new leads since last pull.");
      }
    } catch (e) {
      const msg = e && e.message ? e.message : "";
      if (msg === "Failed to fetch") {
        setErr(IN_PREVIEW
          ? "The preview sandbox blocks outside connections - the bridge works once the Command Center is deployed to your own URL. You can still add leads manually below."
          : "Could not reach the bridge. Check the Worker URL and that the Worker is deployed.");
      } else setErr(msg);
    } finally { setSyncing(false); }
  }

  function addManual() {
    if (!manual.name.trim() || !manual.contact.trim()) { setErr("A lead needs at least a name and a contact."); return; }
    const lead = { id: uid(), name: manual.name.trim(), contact: manual.contact.trim(), message: manual.message.trim(), source: "manual", ts: Date.now(), status: "New" };
    up((s) => ({ ...s, leads: [lead, ...(s.leads || [])] }));
    log("lead", "Lead added manually: " + lead.name);
    setManual({ name: "", contact: "", message: "" });
    setErr("");
  }

  function cycleStatus(l) {
    const next = LEAD_STATUS[(LEAD_STATUS.indexOf(l.status) + 1) % LEAD_STATUS.length];
    up((s) => ({ ...s, leads: s.leads.map((x) => (x.id === l.id ? { ...x, status: next } : x)) }));
    if (next === "Won") log("lead", "Lead WON: " + l.name);
  }

  function followUpTask(l) {
    const closer = AGENTS.find((a) => a.name === "Sales Closer");
    up((s) => ({ ...s, tasks: [...s.tasks, { id: uid(), title: "Follow up lead: " + l.name + " (" + l.contact + ")", col: "Backlog", prio: "High", agentId: closer ? closer.id : null, ts: Date.now() }] }));
    log("lead", "Follow-up task created for lead: " + l.name);
  }

  const isPhone = (c) => /^[+0-9 ()-]{8,}$/.test(c);
  const isEmail = (c) => /.+@.+\..+/.test(c);

  return (
    <div>
      <SectionTitle eyebrow="Pipeline" title="Website Leads" sub="The plug between qimmah.digital and your CEO. Form submissions on your site land here through your free Cloudflare bridge - and the AI CEO sees every new lead in its live business state." />
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 18 }}>
        <Stat label="New leads" value={newCount} accent="#60A5FA" sub={newCount > 0 ? "waiting for follow-up" : "all handled"} />
        <Stat label="Contacted" value={leads.filter((l) => l.status === "Contacted").length} accent="#FBBF24" />
        <Stat label="Won" value={leads.filter((l) => l.status === "Won").length} accent="#34D399" />
        <Stat label="Total captured" value={leads.length} accent={CYAN} />
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        <button style={btnPrimary} onClick={sync} disabled={syncing}><RefreshCw size={14} /> {syncing ? "Syncing…" : "Sync from website"}</button>
        <button style={btnGhost} onClick={() => setShowSetup(!showSetup)}><Settings size={13} /> Bridge setup</button>
      </div>

      {showSetup && (
        <Card style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: "#C4B5FD", marginBottom: 10 }}>Bridge connection</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
            <Field label="Worker URL">
              <input style={inputStyle} placeholder="https://qimmah-bridge.YOUR-SUBDOMAIN.workers.dev" value={bridge.url} onChange={(e) => up((s) => ({ ...s, bridge: { ...(s.bridge || {}), url: e.target.value } }))} />
            </Field>
            <Field label="Bridge key (your Worker secret)">
              <input style={inputStyle} type="password" placeholder="paste the BRIDGE_KEY secret" value={bridge.key} onChange={(e) => up((s) => ({ ...s, bridge: { ...(s.bridge || {}), key: e.target.value } }))} />
            </Field>
          </div>
          <div style={{ fontSize: 12, color: "#8B86A3", lineHeight: 1.65 }}>
            One-time setup: deploy the qimmah-bridge Worker (file provided in chat) on your free Cloudflare account, create a KV namespace named LEADS, set a BRIDGE_KEY secret, and add the form snippet to qimmah.digital. Full steps are in the Worker file comments.
          </div>
        </Card>
      )}

      {err && <div style={{ margin: "0 0 12px", padding: "10px 14px", borderRadius: 10, background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", color: "#FCA5A5", fontSize: 13 }}>{err}</div>}
      {info && <div style={{ margin: "0 0 12px", padding: "10px 14px", borderRadius: 10, background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.3)", color: "#9FE8C4", fontSize: 13 }}>{info}</div>}

      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: "#C4B5FD", marginBottom: 10 }}>Add a lead manually</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
          <Field label="Name"><input style={inputStyle} placeholder="e.g. Ahmed from Muscat Cafe" value={manual.name} onChange={(e) => setManual({ ...manual, name: e.target.value })} /></Field>
          <Field label="Phone or email"><input style={inputStyle} placeholder="968 9XXX XXXX" value={manual.contact} onChange={(e) => setManual({ ...manual, contact: e.target.value })} /></Field>
          <Field label="Note"><input style={inputStyle} placeholder="What do they want?" value={manual.message} onChange={(e) => setManual({ ...manual, message: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter") addManual(); }} /></Field>
          <button style={btnPrimary} onClick={addManual}><Plus size={14} /> Add lead</button>
        </div>
      </Card>

      {leads.length === 0
        ? <Empty icon={Inbox} title="No leads yet" body="Once the bridge is live on qimmah.digital, every contact-form submission lands here automatically. Until then, add walk-in and WhatsApp leads manually - the CEO sees them either way." />
        : <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))", gap: 12 }}>
            {leads.map((l) => (
              <Card key={l.id}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#F5F3FF" }}>{l.name}</div>
                    <div style={{ fontSize: 12, color: CYAN, marginTop: 2 }}>{l.contact}</div>
                  </div>
                  <button onClick={() => cycleStatus(l)} title="Tap to change status"
                    style={{ fontSize: 11, fontWeight: 700, padding: "4px 12px", borderRadius: 20, cursor: "pointer", flexShrink: 0, fontFamily: "inherit", background: LEAD_COLORS[l.status] + "22", color: LEAD_COLORS[l.status], border: "1px solid " + LEAD_COLORS[l.status] + "44" }}>
                    {l.status}
                  </button>
                </div>
                {l.message && <div style={{ fontSize: 12.5, color: "#C9C4DC", lineHeight: 1.55, marginBottom: 8 }}>{l.message}</div>}
                <div style={{ fontSize: 10.5, color: "#6B6685", marginBottom: 10, textTransform: "uppercase", letterSpacing: 1 }}>{l.source} · {timeAgo(l.ts)}</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                  {isPhone(l.contact) && (
                    <a href={"https://wa.me/" + l.contact.replace(/[^0-9]/g, "")} target="_blank" rel="noreferrer" style={{ ...btnGhost, fontSize: 12, textDecoration: "none" }}>
                      <Send size={12} /> WhatsApp
                    </a>
                  )}
                  {isEmail(l.contact) && (
                    <a href={"mailto:" + l.contact} style={{ ...btnGhost, fontSize: 12, textDecoration: "none" }}>
                      <Send size={12} /> Email
                    </a>
                  )}
                  <button style={{ ...btnGhost, fontSize: 12 }} onClick={() => followUpTask(l)}><Plus size={12} /> Follow-up task</button>
                  <button style={{ background: "none", border: "none", cursor: "pointer", color: "#6B6685", padding: 4, marginLeft: "auto" }}
                    onClick={() => { up((s) => ({ ...s, leads: s.leads.filter((x) => x.id !== l.id) })); log("lead", "Lead removed: " + l.name); }}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </Card>
            ))}
          </div>}
    </div>
  );
}

/* ============================================================
   ANALYTICS — computed entirely from real entries
   ============================================================ */
function BarsChart({ months, incomeBy, expenseBy }) {
  const max = Math.max(1, ...months.map((m) => Math.max(incomeBy[m] || 0, expenseBy[m] || 0)));
  const W = 600, H = 200, pad = 10;
  const bw = (W - pad * 2) / months.length;
  return (
    <svg viewBox={"0 0 " + W + " " + (H + 26)} style={{ width: "100%", height: "auto" }}>
      {months.map((m, i) => {
        const ih = ((incomeBy[m] || 0) / max) * (H - 20);
        const eh = ((expenseBy[m] || 0) / max) * (H - 20);
        const x = pad + i * bw;
        return (
          <g key={m}>
            <rect x={x + bw * 0.18} y={H - ih} width={bw * 0.26} height={Math.max(ih, 1)} rx="3" fill="url(#qgrad)" />
            <rect x={x + bw * 0.52} y={H - eh} width={bw * 0.26} height={Math.max(eh, 1)} rx="3" fill="rgba(248,113,113,0.65)" />
            <text x={x + bw / 2} y={H + 18} textAnchor="middle" fontSize="11" fill="#8B86A3">{monthLabel(m)}</text>
          </g>
        );
      })}
      <defs>
        <linearGradient id="qgrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7C3AED" /><stop offset="100%" stopColor="#06B6D4" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function Donut({ value, total, color, label }) {
  const r = 42, c = 2 * Math.PI * r;
  const frac = total > 0 ? value / total : 0;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <svg width="110" height="110" viewBox="0 0 110 110">
        <circle cx="55" cy="55" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="10" />
        <circle cx="55" cy="55" r={r} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
          strokeDasharray={c * frac + " " + c} transform="rotate(-90 55 55)" style={{ transition: "stroke-dasharray 0.6s" }} />
        <text x="55" y="60" textAnchor="middle" fontSize="18" fontWeight="700" fill="#F5F3FF" fontFamily="'Space Grotesk', sans-serif">{value}</text>
      </svg>
      <div style={{ fontSize: 11.5, color: "#8B86A3" }}>{label}</div>
    </div>
  );
}

function Analytics({ S }) {
  const months = lastMonths(6);
  const incomeBy = {}, expenseBy = {};
  S.transactions.forEach((t) => {
    const m = t.date.slice(0, 7);
    if (t.type === "income") incomeBy[m] = (incomeBy[m] || 0) + t.amount;
    else expenseBy[m] = (expenseBy[m] || 0) + t.amount;
  });
  const hasData = S.transactions.length > 0;
  const active = AGENTS.length - Object.keys(S.agentsOff).length;
  const done = S.tasks.filter((t) => t.col === "Done").length;
  const open = S.tasks.length - done;

  return (
    <div>
      <SectionTitle eyebrow="Intelligence" title="Analytics" sub="Charts are generated live from your Finance Hub entries, task board and agent fleet — no simulated numbers." />
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <Card style={{ flex: "2 1 380px", minWidth: 300 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: "#C4B5FD" }}>Revenue vs expenses · last 6 months</div>
            <div style={{ display: "flex", gap: 12, fontSize: 11, color: "#8B86A3" }}>
              <span><span style={{ display: "inline-block", width: 9, height: 9, borderRadius: 2, background: PURPLE, marginRight: 5 }} />Income</span>
              <span><span style={{ display: "inline-block", width: 9, height: 9, borderRadius: 2, background: "rgba(248,113,113,0.65)", marginRight: 5 }} />Expenses</span>
            </div>
          </div>
          {hasData
            ? <BarsChart months={months} incomeBy={incomeBy} expenseBy={expenseBy} />
            : <div style={{ padding: "40px 10px", textAlign: "center", fontSize: 13, color: "#8B86A3" }}>Record transactions in the Finance Hub and this chart builds itself month by month.</div>}
        </Card>
        <Card style={{ flex: "1 1 260px", minWidth: 240 }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: "#C4B5FD", marginBottom: 14 }}>Operations pulse</div>
          <div style={{ display: "flex", justifyContent: "space-around", flexWrap: "wrap", gap: 10 }}>
            <Donut value={active} total={60} color="#34D399" label="Active agents / 60" />
            <Donut value={done} total={Math.max(S.tasks.length, 1)} color={CYAN} label={"Tasks done / " + S.tasks.length} />
          </div>
          <div style={{ marginTop: 14, fontSize: 12.5, color: "#A5A0B8", lineHeight: 1.7 }}>
            <div>Open tasks: <b style={{ color: "#E9E4FB" }}>{open}</b></div>
            <div>Invoices outstanding: <b style={{ color: "#E9E4FB" }}>{S.invoices.filter((i) => i.status !== "Paid").length}</b></div>
            <div>CEO conversations: <b style={{ color: "#E9E4FB" }}>{S.chat.filter((m) => m.role === "user").length}</b></div>
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ============================================================
   MIROFISH — forecasts computed from real revenue history
   ============================================================ */
function forecastSeries(points) {
  const n = points.length;
  if (n < 2) return null;
  const xm = (n - 1) / 2, ym = points.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  points.forEach((y, x) => { num += (x - xm) * (y - ym); den += (x - xm) * (x - xm); });
  const slope = den ? num / den : 0, b = ym - slope * xm;
  return Array.from({ length: 6 }, (_, i) => Math.max(0, Math.round(slope * (n + i) + b)));
}

function MiroFish({ S, up, log }) {
  const [opp, setOpp] = useState({ segment: "", note: "" });
  const monthsWithData = useMemo(() => {
    const by = {};
    S.transactions.filter((t) => t.type === "income").forEach((t) => {
      const m = t.date.slice(0, 7);
      by[m] = (by[m] || 0) + t.amount;
    });
    return Object.keys(by).sort().map((m) => ({ m, v: by[m] }));
  }, [S.transactions]);
  const fc = forecastSeries(monthsWithData.map((x) => x.v));
  const confidence = Math.min(90, 30 + monthsWithData.length * 10);
  const monthsAhead = (() => {
    const out = []; const d = new Date();
    for (let i = 1; i <= 6; i++) {
      const x = new Date(d.getFullYear(), d.getMonth() + i, 1);
      out.push(x.toLocaleString("en", { month: "short" }));
    }
    return out;
  })();

  function addOpp() {
    if (!opp.segment.trim()) return;
    up((s) => ({ ...s, opportunities: [{ id: uid(), segment: opp.segment.trim(), note: opp.note.trim(), ts: Date.now() }, ...s.opportunities] }));
    log("system", "Market opportunity logged: " + opp.segment);
    setOpp({ segment: "", note: "" });
  }

  return (
    <div style={{ position: "relative" }}>
      <div className="q-swarm" aria-hidden="true">
        {Array.from({ length: 24 }, (_, i) => (
          <span key={i} className="q-particle" style={{
            left: (i * 41 % 100) + "%", top: (i * 29 % 100) + "%",
            animationDuration: (7 + (i % 6)) + "s", animationDelay: (i * 0.4) + "s",
            background: i % 3 === 0 ? CYAN : PURPLE, width: 3 + (i % 3), height: 3 + (i % 3),
          }} />
        ))}
      </div>
      <SectionTitle eyebrow="Swarm Intelligence" title="MiroFish Predictions" sub="Forecasts are calculated from your actual income history in the Finance Hub — the more months of real data, the higher the confidence." />
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <Card glow style={{ flex: "2 1 380px", minWidth: 300 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: "#C4B5FD" }}>6-month revenue forecast</div>
            {fc && <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: "rgba(6,182,212,0.15)", color: CYAN, border: "1px solid rgba(6,182,212,0.3)" }}>{confidence}% confidence · {monthsWithData.length} months of data</span>}
          </div>
          {!fc
            ? <div style={{ padding: "30px 10px", textAlign: "center", fontSize: 13, color: "#8B86A3", lineHeight: 1.7 }}>
                MiroFish needs income recorded in at least <b style={{ color: "#E9E4FB" }}>2 different months</b> to project a trend.<br />
                You have {monthsWithData.length === 0 ? "no income entries yet" : "income in " + monthsWithData.length + " month so far"} — add real entries in the Finance Hub and the swarm wakes up.
              </div>
            : <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(90px, 1fr))", gap: 10 }}>
                {fc.map((v, i) => (
                  <div key={i} style={{ textAlign: "center", padding: "12px 6px", borderRadius: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(124,58,237,0.2)" }}>
                    <div style={{ fontSize: 11, color: "#8B86A3", marginBottom: 4 }}>{monthsAhead[i]}</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: v >= REVENUE_TARGET ? "#34D399" : "#E9E4FB", fontFamily: "'Space Grotesk', sans-serif" }}>{omr(v)}</div>
                    {v >= REVENUE_TARGET && <div style={{ fontSize: 9.5, color: "#34D399", marginTop: 2 }}>▲ target hit</div>}
                  </div>
                ))}
              </div>}
          {fc && <div style={{ marginTop: 12, fontSize: 12, color: "#8B86A3" }}>Linear trend projection from {monthsWithData.length} months of recorded income. Confidence grows +10% per month of history, capped at 90%.</div>}
        </Card>
        <Card style={{ flex: "1 1 280px", minWidth: 260 }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: "#C4B5FD", marginBottom: 12 }}>Market opportunities</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
            <input style={{ ...inputStyle, flex: "1 1 120px" }} placeholder="Segment, e.g. Muscat restaurants" value={opp.segment} onChange={(e) => setOpp({ ...opp, segment: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter") addOpp(); }} />
            <button style={btnPrimary} onClick={addOpp}><Plus size={14} /></button>
          </div>
          <input style={{ ...inputStyle, marginBottom: 12 }} placeholder="Note (optional)" value={opp.note} onChange={(e) => setOpp({ ...opp, note: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter") addOpp(); }} />
          {S.opportunities.length === 0
            ? <div style={{ fontSize: 12.5, color: "#8B86A3" }}>Log real opportunities you spot — segments, leads, gaps. Ask the AI CEO to prioritize them.</div>
            : <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 260, overflowY: "auto" }}>
                {S.opportunities.map((o) => (
                  <div key={o.id} style={{ padding: 10, borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#E9E4FB" }}>{o.segment}</div>
                      {o.note && <div style={{ fontSize: 11.5, color: "#8B86A3", marginTop: 2 }}>{o.note}</div>}
                    </div>
                    <button style={{ background: "none", border: "none", cursor: "pointer", color: "#6B6685", padding: 0, alignSelf: "flex-start" }} onClick={() => up((s) => ({ ...s, opportunities: s.opportunities.filter((x) => x.id !== o.id) }))}><Trash2 size={13} /></button>
                  </div>
                ))}
              </div>}
        </Card>
      </div>
    </div>
  );
}

/* ============================================================
   INTEGRATIONS HUB — real links, real composers, honest status
   ============================================================ */
function Integrations({ S, up, log }) {
  const [wa, setWa] = useState({ phone: "", msg: "" });
  const [em, setEm] = useState({ to: "", subject: "", body: "" });

  const waPhone = wa.phone.replace(/[^0-9]/g, "");
  const waReady = waPhone.length >= 8 && wa.msg.trim().length > 0;
  const waHref = waReady ? "https://wa.me/" + waPhone + "?text=" + encodeURIComponent(wa.msg.trim()) : "";
  const emReady = /.+@.+\..+/.test(em.to.trim());
  const emHref = emReady ? "mailto:" + em.to.trim() + "?subject=" + encodeURIComponent(em.subject) + "&body=" + encodeURIComponent(em.body) : "";

  const linkBtn = (ready) => ({
    ...btnPrimary, textDecoration: "none", justifyContent: "center",
    opacity: ready ? 1 : 0.45, cursor: ready ? "pointer" : "not-allowed",
  });

  const platforms = [
    { name: "Instagram", color: "#E1306C", href: "https://www.instagram.com/accounts/login/", note: "Opens Instagram login. Automated posting and DM replies require the official Instagram Business API via Meta — a verified Business account and app review." },
    { name: "WhatsApp", color: "#25D366", href: "https://web.whatsapp.com/", note: "Opens WhatsApp Web. The composer below sends real messages through wa.me — works today, no API needed. Full automation requires the WhatsApp Business API." },
    { name: "Facebook", color: "#1877F2", href: "https://business.facebook.com/", note: "Opens Meta Business Suite for page and ads management. Automated publishing requires a Meta developer app with approved permissions." },
    { name: "Email", color: "#FBBF24", href: "https://mail.google.com/", note: "The composer below opens your real mail app with everything pre-filled. Bulk automation requires an email service like Resend or SendGrid." },
  ];

  return (
    <div>
      <SectionTitle eyebrow="Channels" title="Integrations Hub" sub="Every button here does something real. Where official APIs are required, the card says so plainly — no fake 'connected' badges." />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 12, marginBottom: 18 }}>
        {platforms.map((p) => (
          <Card key={p.name}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: p.color, boxShadow: "0 0 10px " + p.color }} />
              <span style={{ fontWeight: 700, fontSize: 15 }}>{p.name}</span>
            </div>
            <p style={{ fontSize: 12.5, color: "#A5A0B8", lineHeight: 1.6, margin: "0 0 12px" }}>{p.note}</p>
            <a href={p.href} target="_blank" rel="noreferrer" style={{ ...btnGhost, textDecoration: "none" }}>
              <ExternalLink size={13} /> Open {p.name}
            </a>
          </Card>
        ))}
      </div>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <Card style={{ flex: "1 1 300px" }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: "#25D366", marginBottom: 12 }}>WhatsApp composer · sends for real</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Field label="Phone with country code"><input style={inputStyle} inputMode="tel" placeholder="968 9XXX XXXX" value={wa.phone} onChange={(e) => setWa({ ...wa, phone: e.target.value })} /></Field>
            <Field label="Message"><textarea style={{ ...inputStyle, minHeight: 70, resize: "vertical" }} placeholder="Marhaba! This is Sultan from Qimmah Digital…" value={wa.msg} onChange={(e) => setWa({ ...wa, msg: e.target.value })} /></Field>
            <a href={waReady ? waHref : undefined} target="_blank" rel="noreferrer" style={linkBtn(waReady)}
              onClick={(e) => { if (!waReady) { e.preventDefault(); return; } log("integration", "WhatsApp message opened to +" + waPhone); }}>
              <Send size={14} /> Open in WhatsApp
            </a>
            {!waReady && <div style={{ fontSize: 11.5, color: "#8B86A3" }}>Enter a full number with country code (e.g. 968…) and a message to activate the button.</div>}
          </div>
        </Card>
        <Card style={{ flex: "1 1 300px" }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: "#FBBF24", marginBottom: 12 }}>Email composer · opens your mail app</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Field label="To"><input style={inputStyle} inputMode="email" placeholder="client@company.om" value={em.to} onChange={(e) => setEm({ ...em, to: e.target.value })} /></Field>
            <Field label="Subject"><input style={inputStyle} placeholder="Qimmah Digital — proposal" value={em.subject} onChange={(e) => setEm({ ...em, subject: e.target.value })} /></Field>
            <Field label="Body"><textarea style={{ ...inputStyle, minHeight: 70, resize: "vertical" }} value={em.body} onChange={(e) => setEm({ ...em, body: e.target.value })} /></Field>
            <a href={emReady ? emHref : undefined} style={linkBtn(emReady)}
              onClick={(e) => { if (!emReady) { e.preventDefault(); return; } log("integration", "Email drafted to " + em.to.trim()); }}>
              <Send size={14} /> Open in Mail
            </a>
            {!emReady && <div style={{ fontSize: 11.5, color: "#8B86A3" }}>Enter a valid email address to activate the button.</div>}
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ============================================================
   LIVE FEED — real activity log of everything done in the app
   ============================================================ */
const FEED_COLORS = { chat: PURPLE, task: CYAN, finance: "#34D399", agent: "#FBBF24", integration: "#F472B6", contract: "#22D3EE", autopilot: "#FFB020", lead: "#60A5FA", system: "#8B86A3" };
function LiveFeed({ S, up }) {
  return (
    <div>
      <SectionTitle eyebrow="Pulse" title="Live Feed" sub="A truthful record of everything that happens in the Command Center — chats, tasks, money, agent changes, messages sent." />
      {S.feed.length > 0 && (
        <button style={{ ...btnGhost, marginBottom: 14 }} onClick={() => up((s) => ({ ...s, feed: [] }))}><Trash2 size={13} /> Clear feed</button>
      )}
      {S.feed.length === 0
        ? <Empty icon={Radio} title="Nothing yet — and that's honest" body="This feed only shows real events. Chat with your AI CEO, add a task or record income, and it appears here instantly." />
        : <Card style={{ padding: 0, overflow: "hidden" }}>
            {S.feed.map((f, i) => (
              <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderBottom: i < S.feed.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none" }}>
                <span className={i === 0 ? "q-blink" : ""} style={{ width: 8, height: 8, borderRadius: "50%", background: FEED_COLORS[f.type] || "#8B86A3", flexShrink: 0, boxShadow: "0 0 8px " + (FEED_COLORS[f.type] || "#8B86A3") }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: "#E9E4FB" }}>{f.text}</div>
                  <div style={{ fontSize: 10.5, color: "#6B6685", textTransform: "uppercase", letterSpacing: 1 }}>{f.type}{f.by ? " · " + f.by : ""} · {timeAgo(f.ts)}</div>
                </div>
              </div>
            ))}
          </Card>}
    </div>
  );
}

/* ============================================================
   OVERVIEW — setup checklist + live KPIs
   ============================================================ */
function Overview({ S, go }) {
  const thisMonth = lastMonths(1)[0];
  const income = S.transactions.filter((t) => t.type === "income" && t.date.startsWith(thisMonth)).reduce((a, t) => a + t.amount, 0);
  const active = AGENTS.length - Object.keys(S.agentsOff).length;
  const openTasks = S.tasks.filter((t) => t.col !== "Done").length;
  const pct = Math.min(100, Math.round((income / REVENUE_TARGET) * 100));

  const checklist = [
    { done: !!S.groqKey || IN_PREVIEW, label: IN_PREVIEW ? "AI CEO engine — active (preview runs keyless; add Groq key after deploy)" : "Connect Groq API key — activate the AI CEO", goto: "ceo" },
    { done: S.chat.length > 0, label: "Have your first AI CEO conversation", goto: "ceo" },
    { done: S.transactions.length > 0, label: "Record your first real transaction", goto: "finance" },
    { done: S.tasks.length > 0, label: "Create your first task and assign an agent", goto: "tasks" },
    { done: !!S.elKey, label: "Optional: add ElevenLabs key for premium voice", goto: "ceo" },
  ];
  const doneCount = checklist.filter((c) => c.done).length;

  return (
    <div>
      {/* Hero */}
      <div style={{ ...glass, padding: "28px 24px", marginBottom: 18, position: "relative", overflow: "hidden", boxShadow: "0 0 60px rgba(124,58,237,0.15)" }}>
        <svg viewBox="0 0 400 90" preserveAspectRatio="none" style={{ position: "absolute", bottom: 0, left: 0, width: "100%", height: 90, opacity: 0.25 }} aria-hidden="true">
          <polyline points="0,90 60,55 110,70 170,25 230,45 300,8 400,38 400,90" fill="none" stroke="url(#peak)" strokeWidth="2" />
          <defs><linearGradient id="peak" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#7C3AED" /><stop offset="100%" stopColor="#06B6D4" /></linearGradient></defs>
        </svg>
        <div style={{ fontSize: 12, letterSpacing: 3, textTransform: "uppercase", color: CYAN, fontWeight: 700, marginBottom: 8 }}>CEO Command Center</div>
        <h1 style={{ margin: 0, fontSize: 32, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif", background: "linear-gradient(90deg,#EDE9FE,#A78BFA)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          Qimmah Digital
        </h1>
        <div style={{ fontSize: 17, color: "#C4B5FD", marginTop: 2, fontWeight: 500 }}>قمة ديجيتال — The Summit</div>
        <p style={{ margin: "10px 0 0", fontSize: 13.5, color: "#A5A0B8", maxWidth: 560 }}>
          One founder, 60 AI agents, one target: {omr(REVENUE_TARGET)}/month. Every number on this dashboard is real — it moves only when your business moves.
        </p>
      </div>

      {/* KPIs */}
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 18 }}>
        <Stat label="Income this month" value={omr(income)} accent="#34D399" sub={income === 0 ? "Record income in Finance Hub" : pct + "% of target"} />
        <Stat label="Target progress" value={pct + "%"} accent={CYAN} sub={"of " + omr(REVENUE_TARGET) + "/mo"} />
        <Stat label="Active agents" value={active + "/60"} accent="#A78BFA" sub="across 5 squads" />
        <Stat label="Open tasks" value={openTasks} accent="#FBBF24" sub={S.tasks.filter((t) => t.col === "Done").length + " completed"} />
      </div>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        {/* Checklist */}
        <Card glow style={{ flex: "1 1 320px", minWidth: 280 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: "#C4B5FD" }}>Launch checklist</div>
            <span style={{ fontSize: 11, fontWeight: 700, color: doneCount === checklist.length ? "#34D399" : "#8B86A3" }}>{doneCount}/{checklist.length}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {checklist.map((c, i) => (
              <button key={i} onClick={() => go(c.goto)}
                style={{ display: "flex", alignItems: "center", gap: 10, background: "none", border: "none", cursor: "pointer", padding: 0, textAlign: "left", fontFamily: "inherit" }}>
                {c.done ? <CheckCircle2 size={17} style={{ color: "#34D399", flexShrink: 0 }} /> : <Circle size={17} style={{ color: "#6B6685", flexShrink: 0 }} />}
                <span style={{ fontSize: 13, color: c.done ? "#6B6685" : "#E9E4FB", textDecoration: c.done ? "line-through" : "none" }}>{c.label}</span>
              </button>
            ))}
          </div>
        </Card>

        {/* Squads */}
        <Card style={{ flex: "2 1 380px", minWidth: 300 }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: "#C4B5FD", marginBottom: 14 }}>The five squads</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
            {Object.entries(SQUAD_META).map(([sq, m]) => (
              <button key={sq} onClick={() => go("agents")} style={{ ...glass, padding: 12, textAlign: "left", cursor: "pointer", fontFamily: "inherit" }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: m.color }}>Squad {sq}</div>
                <div style={{ fontSize: 11.5, color: "#A5A0B8", margin: "3px 0" }}>{m.role}</div>
                <div style={{ fontSize: 10.5, color: "#6B6685" }}>Agents {m.range}</div>
              </button>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ============================================================
   APP SHELL
   ============================================================ */
const NAV = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "ceo", label: "AI CEO", icon: MessageSquare },
  { id: "agents", label: "AI Agents", icon: Users },
  { id: "tasks", label: "Tasks", icon: ListTodo },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "finance", label: "Finance", icon: Wallet },
  { id: "contracts", label: "Contracts", icon: FileText },
  { id: "leads", label: "Leads", icon: Inbox },
  { id: "integrations", label: "Integrations", icon: Plug },
  { id: "feed", label: "Live Feed", icon: Radio },
  { id: "mirofish", label: "MiroFish", icon: Fish },
];

/* ============================================================
   SHELL — shared background, fonts, animations
   ============================================================ */
function Shell({ children }) {
  return (
    <div style={{
      minHeight: "100vh", color: "#EDE9FE",
      fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      background: "radial-gradient(1100px 700px at 85% -10%, rgba(124,58,237,0.22), transparent 60%), radial-gradient(800px 600px at -10% 110%, rgba(6,182,212,0.14), transparent 60%), " + BG,
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Inter:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-thumb { background: rgba(124,58,237,0.4); border-radius: 8px; }
        ::-webkit-scrollbar-track { background: transparent; }
        button:focus-visible, input:focus-visible, select:focus-visible, textarea:focus-visible, a:focus-visible { outline: 2px solid #06B6D4; outline-offset: 2px; }
        input::placeholder, textarea::placeholder { color: #6B6685; }
        .q-dot { width: 7px; height: 7px; border-radius: 50%; background: #A78BFA; display: inline-block; animation: qbounce 1s infinite; }
        .q-bar { width: 3px; height: 12px; background: #fff; border-radius: 3px; display: inline-block; animation: qbar 0.8s infinite ease-in-out; }
        .q-ring { position: absolute; inset: -6px; border-radius: 50%; border: 2px solid rgba(239,68,68,0.5); animation: qring 1.4s infinite; }
        .q-blink { animation: qblink 1.6s infinite; }
        .q-swarm { position: absolute; inset: 0; overflow: hidden; pointer-events: none; z-index: 0; }
        .q-particle { position: absolute; border-radius: 50%; opacity: 0.5; animation: qfloat linear infinite; box-shadow: 0 0 8px currentColor; }
        @keyframes qbounce { 0%,80%,100% { transform: translateY(0); opacity: 0.4; } 40% { transform: translateY(-5px); opacity: 1; } }
        @keyframes qbar { 0%,100% { height: 6px; } 50% { height: 20px; } }
        @keyframes qring { 0% { transform: scale(1); opacity: 0.8; } 100% { transform: scale(1.6); opacity: 0; } }
        @keyframes qblink { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }
        @keyframes qfloat { 0% { transform: translateY(0) translateX(0); } 50% { transform: translateY(-30px) translateX(14px); } 100% { transform: translateY(0) translateX(0); } }
        @media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }
      `}</style>
      {children}
    </div>
  );
}

/* ============================================================
   LOGIN — owner setup, PIN sign-in, accountability
   ============================================================ */
function AuthCard({ children }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ ...glass, padding: "30px 26px", width: "100%", maxWidth: 400, boxShadow: "0 0 60px rgba(124,58,237,0.18)" }}>
        <div style={{ textAlign: "center", marginBottom: 22 }}>
          <div style={{ fontSize: 24, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif" }}>Qimmah<span style={{ color: PURPLE }}>.</span></div>
          <div style={{ fontSize: 12.5, color: "#8B86A3" }}>قمة ديجيتال · CEO Command Center</div>
        </div>
        {children}
      </div>
    </div>
  );
}

function CreateOwner({ onCreate }) {
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [err, setErr] = useState("");
  function submit() {
    const n = name.trim();
    if (!n) { setErr("Enter your name."); return; }
    if (!/^\d{4,8}$/.test(pin)) { setErr("PIN must be 4–8 digits."); return; }
    if (pin !== pin2) { setErr("PINs don't match."); return; }
    onCreate({ id: uid(), name: n, pin: pinHash(pin), role: "owner", created: Date.now() });
  }
  return (
    <AuthCard>
      <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Create the owner account</div>
      <div style={{ fontSize: 12.5, color: "#A5A0B8", marginBottom: 16, lineHeight: 1.6 }}>
        This account controls the Command Center. You can add team members later — every action is recorded under the name that did it.
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Field label="Your name"><input style={inputStyle} placeholder="Sultan" value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Choose a PIN (4–8 digits)"><input style={inputStyle} type="password" inputMode="numeric" placeholder="••••" value={pin} onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, ""))} /></Field>
        <Field label="Confirm PIN"><input style={inputStyle} type="password" inputMode="numeric" placeholder="••••" value={pin2} onChange={(e) => setPin2(e.target.value.replace(/[^0-9]/g, ""))} onKeyDown={(e) => { if (e.key === "Enter") submit(); }} /></Field>
        {err && <div style={{ fontSize: 12.5, color: "#FCA5A5" }}>{err}</div>}
        <button style={{ ...btnPrimary, justifyContent: "center" }} onClick={submit}><Check size={15} /> Create account and enter</button>
        <div style={{ fontSize: 11, color: "#6B6685", lineHeight: 1.6 }}>
          Honest note: this is device-level protection — accounts live on this device/browser, not on a server. For multi-device team accounts, a backend comes later.
        </div>
      </div>
    </AuthCard>
  );
}

function Login({ users, onLogin }) {
  const [sel, setSel] = useState(users.length === 1 ? users[0] : null);
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");
  function submit() {
    if (!sel) return;
    if (pinHash(pin) === sel.pin) onLogin(sel);
    else { setErr("Wrong PIN. Try again."); setPin(""); }
  }
  return (
    <AuthCard>
      <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>Who is commanding today?</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
        {users.map((u) => (
          <button key={u.id} onClick={() => { setSel(u); setErr(""); }}
            style={{
              ...btnGhost, justifyContent: "space-between", padding: "12px 14px",
              ...(sel && sel.id === u.id ? { background: "rgba(124,58,237,0.25)", borderColor: PURPLE, color: "#F5F3FF" } : {}),
            }}>
            <span style={{ fontWeight: 600 }}>{u.name}</span>
            <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: u.role === "owner" ? "#FBBF24" : "#8B86A3" }}>{u.role}</span>
          </button>
        ))}
      </div>
      {sel && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Field label={"PIN for " + sel.name}>
            <input style={inputStyle} type="password" inputMode="numeric" autoFocus placeholder="••••" value={pin}
              onChange={(e) => { setPin(e.target.value.replace(/[^0-9]/g, "")); setErr(""); }}
              onKeyDown={(e) => { if (e.key === "Enter") submit(); }} />
          </Field>
          {err && <div style={{ fontSize: 12.5, color: "#FCA5A5" }}>{err}</div>}
          <button style={{ ...btnPrimary, justifyContent: "center" }} onClick={submit}>Enter Command Center</button>
        </div>
      )}
    </AuthCard>
  );
}

/* ============================================================
   TEAM PANEL — owner manages who has access
   ============================================================ */
function TeamPanel({ S, up, log, user, onClose }) {
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");
  function addMember() {
    const n = name.trim();
    if (!n) { setErr("Enter a name."); return; }
    if (!/^\d{4,8}$/.test(pin)) { setErr("PIN must be 4–8 digits."); return; }
    if (S.users.some((u) => u.name.toLowerCase() === n.toLowerCase())) { setErr("That name is already on the team."); return; }
    up((s) => ({ ...s, users: [...s.users, { id: uid(), name: n, pin: pinHash(pin), role: "member", created: Date.now() }] }));
    log("system", "Team member added: " + n);
    setName(""); setPin(""); setErr("");
  }
  return (
    <Card glow style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: "#C4B5FD" }}>Team access</div>
        <button style={{ background: "none", border: "none", color: "#8B86A3", cursor: "pointer", padding: 0 }} onClick={onClose}><X size={16} /></button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
        {S.users.map((u) => (
          <div key={u.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <div>
              <span style={{ fontSize: 13.5, fontWeight: 600, color: "#E9E4FB" }}>{u.name}</span>
              <span style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: 1, color: u.role === "owner" ? "#FBBF24" : "#8B86A3", marginLeft: 8 }}>{u.role}</span>
            </div>
            {u.role !== "owner" && (
              <button style={{ background: "none", border: "none", cursor: "pointer", color: "#6B6685", padding: 2 }}
                onClick={() => { up((s) => ({ ...s, users: s.users.filter((x) => x.id !== u.id) })); log("system", "Team member removed: " + u.name); }}>
                <Trash2 size={14} />
              </button>
            )}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
        <Field label="New member name"><input style={inputStyle} placeholder="e.g. Ahmed" value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Their PIN (4–8 digits)"><input style={inputStyle} type="password" inputMode="numeric" placeholder="••••" value={pin} onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, ""))} onKeyDown={(e) => { if (e.key === "Enter") addMember(); }} /></Field>
        <button style={btnPrimary} onClick={addMember}><Plus size={14} /> Add member</button>
      </div>
      {err && <div style={{ fontSize: 12.5, color: "#FCA5A5", marginTop: 8 }}>{err}</div>}
      <div style={{ fontSize: 11, color: "#6B6685", marginTop: 10 }}>
        Every chat, task, transaction and message is recorded in the Live Feed under the name that did it.
      </div>
    </Card>
  );
}

/* ============================================================
   APP
   ============================================================ */
export default function App() {
  const [S, setS] = useState(null);
  const [user, setUser] = useState(null); // session lives in memory only — every reload asks who's there
  const [view, setView] = useState("overview");
  const [showTeam, setShowTeam] = useState(false);
  const [narrow, setNarrow] = useState(typeof window !== "undefined" ? window.innerWidth < 900 : false);
  const saveTimer = useRef(null);
  const userRef = useRef(null);
  userRef.current = user;

  useEffect(() => {
    let alive = true;
    loadState().then((saved) => {
      if (!alive) return;
      setS(saved ? { ...DEFAULT_STATE, ...saved } : { ...DEFAULT_STATE });
    });
    const onResize = () => setNarrow(window.innerWidth < 900);
    window.addEventListener("resize", onResize);
    return () => { alive = false; window.removeEventListener("resize", onResize); };
  }, []);

  useEffect(() => {
    if (!S) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveState(S), 500);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [S]);

  const up = (fn) => setS((s) => (typeof fn === "function" ? fn(s) : { ...s, ...fn }));
  const log = (type, text) =>
    setS((s) => ({ ...s, feed: [{ id: uid(), type, text, ts: Date.now(), by: userRef.current ? userRef.current.name : "" }, ...s.feed].slice(0, 100) }));

  function exportData() {
    try {
      const blob = new Blob([JSON.stringify(S, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "qimmah-backup-" + new Date().toISOString().slice(0, 10) + ".json";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      log("system", "Data backup exported");
    } catch (e) { /* export unavailable in this environment */ }
  }

  if (!S) {
    return (
      <Shell>
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#C4B5FD" }}>
          <div style={{ textAlign: "center" }}>
            <div className="q-blink" style={{ width: 12, height: 12, borderRadius: "50%", background: PURPLE, margin: "0 auto 12px", boxShadow: "0 0 20px " + PURPLE }} />
            Loading Command Center…
          </div>
        </div>
      </Shell>
    );
  }

  if (S.users.length === 0) {
    return (
      <Shell>
        <CreateOwner onCreate={(owner) => {
          setS((s) => ({ ...s, users: [owner], feed: [{ id: uid(), type: "system", text: "Owner account created: " + owner.name, ts: Date.now(), by: owner.name }, ...s.feed] }));
          setUser(owner);
        }} />
      </Shell>
    );
  }

  if (!user) {
    return (
      <Shell>
        <Login users={S.users} onLogin={(u) => {
          setUser(u);
          setS((s) => ({ ...s, feed: [{ id: uid(), type: "system", text: u.name + " signed in", ts: Date.now(), by: u.name }, ...s.feed].slice(0, 100) }));
        }} />
      </Shell>
    );
  }

  const views = {
    overview: <Overview S={S} go={setView} />,
    ceo: <CEOChat S={S} up={up} log={log} user={user} />,
    agents: <Agents S={S} up={up} log={log} />,
    tasks: <Tasks S={S} up={up} log={log} />,
    analytics: <Analytics S={S} />,
    finance: <Finance S={S} up={up} log={log} />,
    contracts: <Contracts S={S} up={up} log={log} />,
    leads: <Leads S={S} up={up} log={log} />,
    integrations: <Integrations S={S} up={up} log={log} />,
    feed: <LiveFeed S={S} up={up} />,
    mirofish: <MiroFish S={S} up={up} log={log} />,
  };

  return (
    <Shell>
      <div style={{ display: "flex", flexDirection: narrow ? "column" : "row", minHeight: "100vh" }}>
        <nav style={narrow
          ? { display: "flex", gap: 4, overflowX: "auto", padding: "10px 12px", borderBottom: "1px solid rgba(255,255,255,0.07)", background: "rgba(11,7,19,0.85)", backdropFilter: "blur(14px)", position: "sticky", top: 0, zIndex: 20 }
          : { width: 210, flexShrink: 0, padding: "22px 12px", borderRight: "1px solid rgba(255,255,255,0.07)", display: "flex", flexDirection: "column", gap: 3, position: "sticky", top: 0, height: "100vh", overflowY: "auto" }}>
          {!narrow && (
            <div style={{ padding: "0 10px 18px" }}>
              <div style={{ fontWeight: 700, fontSize: 16, fontFamily: "'Space Grotesk', sans-serif" }}>Qimmah<span style={{ color: PURPLE }}>.</span></div>
              <div style={{ fontSize: 11, color: "#8B86A3" }}>قمة ديجيتال</div>
            </div>
          )}
          {NAV.map((n) => {
            const active = view === n.id;
            const Icon = n.icon;
            return (
              <button key={n.id} onClick={() => setView(n.id)}
                style={{
                  display: "flex", alignItems: "center", gap: 9, padding: narrow ? "8px 12px" : "9px 12px",
                  borderRadius: 10, border: "none", cursor: "pointer", fontSize: 13, fontWeight: active ? 600 : 500,
                  whiteSpace: "nowrap", fontFamily: "inherit", flexShrink: 0,
                  background: active ? "linear-gradient(135deg, rgba(124,58,237,0.3), rgba(6,182,212,0.12))" : "transparent",
                  color: active ? "#F5F3FF" : "#8B86A3",
                  boxShadow: active ? "inset 0 0 0 1px rgba(124,58,237,0.4)" : "none",
                }}>
                <Icon size={16} style={{ color: active ? "#A78BFA" : "#6B6685" }} />
                {n.label}
              </button>
            );
          })}
        </nav>

        <main style={{ flex: 1, padding: narrow ? "14px 14px 40px" : "20px 28px 60px", maxWidth: 1200, width: "100%", margin: "0 auto", position: "relative", zIndex: 1 }}>
          {/* User bar */}
          <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
            <span style={{ ...glass, padding: "6px 14px", fontSize: 12.5, display: "inline-flex", alignItems: "center", gap: 8, borderRadius: 30 }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#34D399", boxShadow: "0 0 8px #34D399" }} />
              <b>{user.name}</b>
              <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: user.role === "owner" ? "#FBBF24" : "#8B86A3" }}>{user.role}</span>
            </span>
            {user.role === "owner" && <button style={btnGhost} onClick={() => setShowTeam(!showTeam)}><Users size={13} /> Team</button>}
            {user.role === "owner" && <button style={btnGhost} onClick={exportData} title="Download all your data as a JSON backup">Backup</button>}
            <button style={btnGhost} onClick={() => { log("system", user.name + " signed out"); setUser(null); setShowTeam(false); setView("overview"); }}>Sign out</button>
          </div>
          {showTeam && user.role === "owner" && <TeamPanel S={S} up={up} log={log} user={user} onClose={() => setShowTeam(false)} />}
          {views[view]}
        </main>
      </div>
    </Shell>
  );
}
