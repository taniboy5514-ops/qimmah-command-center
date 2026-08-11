/* ============================================================
   HOURLY AUTOPILOT — the 60 agents work and study every hour.
   A rotating squad studies one topic per clock hour, saves a
   result every cycle, and every 6th cycle the brain reviews
   its own methods (meta-learning) and upgrades its checklist.
   ============================================================ */
import { useState, useEffect } from "react";
import { Award, Download, Play, Power, Zap, FileText, Users, Brain, ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { PURPLE, CYAN, SQUAD_META, AGENT_NAMES, SYSTEM_PROMPT, buildSnapshot, aiCall, IN_PREVIEW, uid, omr, timeAgo, glass, inputStyle, btnPrimary, btnGhost, Card, SectionTitle, Stat, Empty } from "./shared.jsx";
import { downloadFile } from "./views3.jsx";

export const SQUADS = ["Alpha", "Beta", "Gamma", "Delta", "Epsilon"];

/* Rotating curriculum — Qimmah-relevant topics the squads study on their own. */
export const CURRICULUM = [
  "Oman SME digital marketing — what small businesses in Muscat actually buy",
  "Instagram automation for Omani restaurants — reels, DMs and booking flows",
  "Restaurant website pricing in OMR — packages Omani owners say yes to",
  "WhatsApp sales funnels for GCC service businesses",
  "Monthly retainer models for small digital agencies — pricing and scope",
  "AI chatbots for Muscat real estate agencies — lead qualification flows",
  "Google Business Profile optimization for Omani local businesses",
  "Short-form video trends 2025-2026 for GCC food brands",
  "E-commerce in Oman — payment gateways, delivery partners, conversion basics",
  "Cold outreach scripts that work with Omani business owners",
  "Arabic-English bilingual content strategy for Omani brands",
  "Tourism marketing in Oman — hotels, tour operators, seasonal campaigns",
  "Healthcare clinic marketing in Muscat — trust, reviews, appointment funnels",
  "SEO for Oman — keywords, Arabic search behavior, local backlinks",
  "Upselling existing clients — from one-off website to monthly retainer",
  "Proposal and pricing psychology — how to quote OMR 500/mo and win",
  "Meta ads for Omani restaurants — budgets, creatives, targeting Muscat",
  "Client reporting that retains — what to show a client every month",
  "AI agent workflows — how a 60-agent fleet delivers a website in hours",
  "GCC expansion playbook — UAE, KSA, Kuwait entry strategy from Oman",
];

/* ---------- Result shaping ---------- */
function templateBrief(topic, squad, agent, offline) {
  return {
    summary: (offline ? "Offline mode — connect Groq for live research. " : "")
      + "Squad " + squad + " (" + agent + ") worked the topic \"" + topic + "\" for Qimmah Digital. "
      + "This is a structured working brief from the squad's trained knowledge: what the topic is, why it matters for an Omani digital agency, and the single move to make this week.",
    insights: [
      "For an Omani SME, the buying trigger is usually visibility on WhatsApp/Instagram and a clear OMR price — lead with one concrete package, not a menu.",
      "Qimmah's edge is speed: 60 AI agents can turn this topic into a client-ready deliverable (page, script, campaign) in hours, which competitors quoting days cannot match.",
    ],
    action: "Turn \"" + topic + "\" into one tangible offer this week — draft the package, price it in OMR, and have Squad Alpha pitch it to 10 Muscat businesses on WhatsApp (+968 9176 3555).",
  };
}

/* Parse {summary, insights, action} out of a model reply, Study-Mode style. */
function parseBrief(raw, topic, squad, agent, offline) {
  let summary = "", insights = [], action = "", clean = raw;
  const fence = raw.match(/```json\s*([\s\S]*?)```/) || raw.match(/```\s*(\{[\s\S]*?"summary"[\s\S]*?\})\s*```/);
  if (fence) {
    try {
      const p = JSON.parse(fence[1]);
      summary = String(p.summary || "").slice(0, 900);
      insights = (Array.isArray(p.insights) ? p.insights : []).map((x) => String(x).slice(0, 260)).filter(Boolean).slice(0, 5);
      action = String(p.action || "").slice(0, 300);
      clean = raw.replace(fence[0], "").trim();
    } catch (e) { /* malformed block: fall back below */ }
  }
  if (!summary) {
    const t = templateBrief(topic, squad, agent, offline);
    summary = summary || (clean || raw).replace(/[*#_`]/g, "").slice(0, 500) || t.summary;
    if (insights.length === 0) insights = t.insights;
    if (!action) action = t.action;
  }
  return { summary, insights, action };
}

/* The last meta card's upgraded checklist gets injected into future prompts —
   the brain genuinely studies how to study. */
function metaChecklist(S) {
  const metas = (S.results || []).filter((r) => r.type === "meta" && r.meta && Array.isArray(r.meta.checklist));
  if (!metas.length) return "";
  return "\n\nMETHOD UPGRADE (your own last self-review — follow this improved study checklist):\n"
    + metas[0].meta.checklist.map((c, i) => (i + 1) + ". " + c).join("\n");
}

/* ---------- ONE CYCLE ---------- */
export async function runCycle(S, up, log, opts) {
  const o = opts || {};
  const cycleNo = (S.autopilot && S.autopilot.cycleCount || 0) + 1;
  const isMeta = cycleNo % 6 === 0;
  const hour = new Date().toLocaleString("en", { weekday: "short", hour: "2-digit", minute: "2-digit" });
  const squad = SQUADS[(cycleNo - 1) % SQUADS.length];
  const names = AGENT_NAMES[squad];
  const agent = names[(cycleNo - 1) % names.length];
  const queued = (S.studyQueue || [])[0];
  const topic = isMeta ? "Method self-review — how the 60 agents study and work" : (queued || CURRICULUM[(S.autopilot && S.autopilot.nextTopicIdx || 0) % CURRICULUM.length]);
  const hasKey = !!S.groqKey || IN_PREVIEW;

  let entry;
  try {
    if (isMeta) {
      entry = await runMeta(S, cycleNo, squad, agent, hour, hasKey);
    } else if (hasKey) {
      const sys = SYSTEM_PROMPT
        + "\n\nLIVE BUSINESS STATE (real, current, from the Command Center):\n" + JSON.stringify(buildSnapshot(S))
        + metaChecklist(S);
      const brief = "End your reply with a fenced json block exactly like:\n"
        + "```json\n{\"summary\":\"2-4 sentence executive summary\",\"insights\":[\"insight 1\",\"insight 2\"],\"action\":\"one concrete action for Qimmah Digital this week\"}\n```\n"
        + "Keep the prose before the json block free of JSON.";
      const webPrompt = "HOURLY WORK CYCLE #" + cycleNo + " (live web). Squad " + squad + " — lead agent " + agent + " — works this topic: \"" + topic + "\".\n"
        + "Search the open web for current facts, prices and examples (prefer 2025-2026 sources), then produce a tight mini-brief: what it is, why it matters for an Omani digital agency, and how Qimmah Digital uses it this month. " + brief;
      const offlinePrompt = "HOURLY WORK CYCLE #" + cycleNo + ". Squad " + squad + " — lead agent " + agent + " — works this topic: \"" + topic + "\".\n"
        + "Honest constraint: live web search was unavailable for this run — work from trained knowledge and say so in one short line at the start. " + brief;
      let raw = "";
      try {
        raw = await aiCall(S, sys, [{ role: "user", content: webPrompt }], { model: "groq/compound" });
      } catch (e) {
        const modelErr = e && (e.status === 400 || e.status === 404 || /model|compound|decommissioned|not found/i.test(String(e.detail || "")));
        if (!modelErr || IN_PREVIEW) throw e;
        raw = await aiCall(S, sys, [{ role: "user", content: offlinePrompt }]);
      }
      const b = parseBrief(raw, topic, squad, agent, false);
      entry = { id: uid(), hour, squad, agent, topic: topic.slice(0, 120), summary: b.summary, insights: b.insights, action: b.action, type: "study", offline: false, cycle: cycleNo, ts: Date.now() };
    } else {
      const t = templateBrief(topic, squad, agent, true);
      entry = { id: uid(), hour, squad, agent, topic: topic.slice(0, 120), summary: t.summary, insights: t.insights, action: t.action, type: "study", offline: true, cycle: cycleNo, ts: Date.now() };
    }
  } catch (e) {
    const t = templateBrief(topic, squad, agent, true);
    entry = { id: uid(), hour, squad, agent, topic: topic.slice(0, 120), summary: "Cycle hit an engine error (" + String(e && e.message || "unknown").slice(0, 120) + ") — saved an offline brief so the hour's work is never lost. " + t.summary, insights: t.insights, action: t.action, type: "study", offline: true, cycle: cycleNo, ts: Date.now() };
  }

  up((s) => ({
    ...s,
    results: [entry, ...(s.results || [])].slice(0, 200),
    studyQueue: queued && !isMeta ? (s.studyQueue || []).slice(1) : (s.studyQueue || []),
    autopilot: {
      ...(s.autopilot || {}),
      lastCycleAt: Date.now(),
      cycleCount: cycleNo,
      nextTopicIdx: queued && !isMeta ? (s.autopilot && s.autopilot.nextTopicIdx || 0) : ((s.autopilot && s.autopilot.nextTopicIdx || 0) + (isMeta ? 0 : 1)),
    },
    chat: [...s.chat, { id: uid(), role: "assistant", content: "⚙️ Cycle #" + cycleNo + " — Squad " + squad + " (" + agent + ") " + (isMeta ? "reviewed its own methods" : "worked: " + entry.topic) + (entry.offline ? " [offline]" : "") + ". Result saved in the Results tab.", actions: null, applied: true, ts: Date.now() }],
  }));
  log("autopilot", "Cycle #" + cycleNo + " — Squad " + squad + ": " + (isMeta ? "method self-review saved" : entry.topic.slice(0, 60)));
  return entry;
}

/* ---------- META CYCLE — study how to study ---------- */
async function runMeta(S, cycleNo, squad, agent, hour, hasKey) {
  const recent = (S.results || []).filter((r) => r.type === "study").slice(0, 5);
  let meta;
  if (hasKey && recent.length > 0) {
    const sys = SYSTEM_PROMPT + metaChecklist(S);
    const prompt = "META-LEARNING CYCLE #" + cycleNo + ". You are reviewing how your own 60-agent fleet studies and works. Here are your last " + recent.length + " results:\n"
      + recent.map((r, i) => (i + 1) + ". [" + r.squad + " / " + r.agent + "] " + r.topic + " — " + (r.summary || "").slice(0, 220)).join("\n")
      + "\nJudge honestly: what worked, what should change in how the squads study, and write an upgraded study checklist for future cycles. End with a fenced json block exactly like:\n"
      + "```json\n{\"worked\":\"what worked\",\"change\":\"what to change\",\"checklist\":[\"step 1\",\"step 2\",\"step 3\",\"step 4\",\"step 5\"]}\n```\nKeep the prose before the json block free of JSON.";
    try {
      const raw = await aiCall(S, sys, [{ role: "user", content: prompt }], { model: "groq/compound" });
      const fence = raw.match(/```json\s*([\s\S]*?)```/) || raw.match(/```\s*(\{[\s\S]*?"worked"[\s\S]*?\})\s*```/);
      if (fence) {
        const p = JSON.parse(fence[1]);
        meta = {
          worked: String(p.worked || "").slice(0, 400),
          change: String(p.change || "").slice(0, 400),
          checklist: (Array.isArray(p.checklist) ? p.checklist : []).map((x) => String(x).slice(0, 160)).filter(Boolean).slice(0, 8),
        };
      }
    } catch (e) { /* fall through to template */ }
  }
  if (!meta || !meta.checklist || meta.checklist.length === 0) {
    meta = {
      worked: (recent.length ? recent.length + " study cycles completed" : "Engine is running") + " — every hour saved a result, squads rotated, topics came from the curriculum.",
      change: "Briefs should end in one sellable OMR offer, not just knowledge — every study hour should name the exact client segment in Oman to pitch next.",
      checklist: [
        "Start from the live business state (income, open tasks, unpaid invoices) before picking an angle",
        "Ground every brief in Omani/GCC reality — Muscat segments, OMR prices, WhatsApp-first channels",
        "Search the live web for 2025-2026 facts before writing; cite real prices and examples",
        "Extract exactly 2 insights that change a decision, plus 1 action doable this week",
        "End every cycle by naming the squad and client segment that uses the result next",
      ],
    };
    if (!hasKey) meta.worked = "Offline mode — connect Groq for live self-analysis. " + meta.worked;
  }
  const summary = "Method Improvement — what worked: " + meta.worked + " What to change: " + meta.change;
  return {
    id: uid(), hour, squad, agent, topic: "Method self-review — how the 60 agents study and work",
    summary, insights: ["What worked: " + meta.worked, "What to change: " + meta.change],
    action: "Apply the upgraded " + meta.checklist.length + "-step study checklist to every future cycle (auto-injected).",
    type: "meta", meta, offline: !hasKey, cycle: cycleNo, ts: Date.now(),
  };
}

/* ---------- Scheduling helpers ---------- */
export const hourKey = (ts) => Math.floor((ts || Date.now()) / 3600000);

/* Which hours are due? Returns how many cycles to run (cap 8 on catch-up). */
export function dueCycles(S, catchUp) {
  const ap = S.autopilot || {};
  if (!ap.auto) return 0;
  const now = hourKey();
  if (!ap.lastCycleAt) return 1;
  const missed = now - hourKey(ap.lastCycleAt);
  if (missed <= 0) return 0;
  return catchUp ? Math.min(missed, 8) : 1;
}

/* ---------- Quick Deploy — fast ways with the 60 AI ---------- */
export async function quickDeploy(S, up, log, kind) {
  const hour = new Date().toLocaleString("en", { weekday: "short", hour: "2-digit", minute: "2-digit" });
  const hasKey = !!S.groqKey || IN_PREVIEW;
  const DEFS = {
    leads: {
      title: "All squads: 5 lead ideas each (25 total)",
      prompt: "QUICK DEPLOY. Each of the 5 squads (Alpha lead gen, Beta delivery, Gamma intelligence, Delta operations, Epsilon innovation) must propose 5 specific lead/client ideas for Qimmah Digital in Oman — named segments in Muscat, why they'd buy, and the channel to reach them. End with a fenced json block exactly like:\n```json\n{\"summary\":\"one line\",\"ideas\":[\"idea 1\",\"idea 2\",\"... up to 25 ideas total\"]}\n```\nKeep prose before the json free of JSON.",
      fallback: () => ({
        summary: "25 lead ideas — 5 per squad — for Qimmah Digital in Oman (offline template — connect Groq for live generation).",
        list: SQUADS.flatMap((sq) => [
          "Muscat shawarma & burger restaurants with no website — pitch OMR 400 site + WhatsApp ordering (Squad " + sq + ")",
          "Real estate brokers in Al Khuwair — AI chatbot lead qualifier demo (Squad " + sq + ")",
          "Dental & dermatology clinics in Qurum — Google reviews + booking funnel (Squad " + sq + ")",
          "Home-based e-commerce sellers on Instagram — OMR 250/mo content retainer (Squad " + sq + ")",
          "Tour operators for Khareef Salalah season — short-form video package (Squad " + sq + ")",
        ]),
      }),
    },
    offer: {
      title: "Draft this week's offer",
      prompt: "QUICK DEPLOY. Draft this week's offer for Qimmah Digital: one concrete, priced (OMR) package for Omani SMEs that Squad Alpha can pitch on WhatsApp today — name, price, what's included, guarantee, and the 3-line pitch message. End with a fenced json block exactly like:\n```json\n{\"summary\":\"offer name + price\",\"ideas\":[\"package component 1\",\"component 2\",\"component 3\",\"the 3-line WhatsApp pitch\"]}\n```\nKeep prose before the json free of JSON.",
      fallback: () => ({
        summary: "This week's offer: \"Muscat Visible in 7 Days\" — OMR 400 website + OMR 250/mo growth retainer (offline template — connect Groq for live drafting).",
        list: [
          "OMR 400 — 5-page bilingual website, WhatsApp button, Google Business Profile, live in days not weeks",
          "OMR 250/mo — 12 reels/posts, WhatsApp funnel management, monthly report",
          "Guarantee: first page draft in 48 hours or the setup fee is waived",
          "Pitch: Marhaba! Qimmah Digital gets Muscat businesses online in 7 days — a full bilingual website for OMR 400, built by our 60-agent AI team. Want to see a free demo page for your business?",
        ],
      }),
    },
    standup: {
      title: "Squad standup report",
      prompt: "QUICK DEPLOY. Produce a standup status report for Qimmah Digital's 5 squads based on the live business state: what each squad did, what's blocked, and each squad's next move. End with a fenced json block exactly like:\n```json\n{\"summary\":\"one-line overall status\",\"ideas\":[\"Squad Alpha: status...\",\"Squad Beta: status...\",\"Squad Gamma: status...\",\"Squad Delta: status...\",\"Squad Epsilon: status...\"]}\n```\nKeep prose before the json free of JSON.",
      fallback: (S) => ({
        summary: "Standup — 5 squads reporting. " + (S.tasks || []).filter((t) => t.col !== "Done").length + " open tasks, " + ((S.results || [])[0] ? "last cycle: " + (S.results || [])[0].topic : "no cycles yet") + " (offline template — connect Groq for live reporting).",
        list: SQUADS.map((sq) => {
          const open = (S.tasks || []).filter((t) => t.col !== "Done").length;
          const studied = (S.results || []).filter((r) => r.squad === sq).length;
          return "Squad " + sq + " (" + SQUAD_META[sq].role + "): " + studied + " cycle results on record, " + open + " open tasks fleet-wide — next move: run the next hourly cycle and pitch this week's offer.";
        }),
      }),
    },
  };
  const def = DEFS[kind];
  if (!def) return null;
  let summary = "", list = [], offline = !hasKey;
  if (hasKey) {
    try {
      const sys = SYSTEM_PROMPT + "\n\nLIVE BUSINESS STATE:\n" + JSON.stringify(buildSnapshot(S)) + metaChecklist(S);
      const raw = await aiCall(S, sys, [{ role: "user", content: def.prompt }], { model: "groq/compound" });
      const fence = raw.match(/```json\s*([\s\S]*?)```/) || raw.match(/```\s*(\{[\s\S]*?"summary"[\s\S]*?\})\s*```/);
      if (fence) {
        try {
          const p = JSON.parse(fence[1]);
          summary = String(p.summary || "").slice(0, 400);
          list = (Array.isArray(p.ideas) ? p.ideas : []).map((x) => String(x).slice(0, 260)).filter(Boolean).slice(0, 30);
        } catch (e) { /* fall through */ }
      }
    } catch (e) { offline = true; }
  }
  if (!summary || list.length === 0) {
    const f = def.fallback(S);
    summary = f.summary; list = f.list; offline = true;
  }
  const entry = {
    id: uid(), hour, squad: "All 5", agent: "60 agents", topic: def.title, summary,
    insights: list.slice(0, 10), action: "Review the full list below and send the best items to Squad Alpha for outreach.",
    list, type: "work", offline, ts: Date.now(),
  };
  up((s) => ({ ...s, results: [entry, ...(s.results || [])].slice(0, 200) }));
  log("autopilot", "Quick Deploy: " + def.title);
  return entry;
}

/* ---------- Markdown export for one result ---------- */
export function resultMarkdown(r) {
  let md = "# Qimmah Digital — Work Result\n\n";
  md += "_" + r.hour + " · Squad " + r.squad + " · " + r.agent + (r.type ? " · " + r.type : "") + (r.offline ? " · offline mode" : "") + "_\n\n";
  md += "## " + r.topic + "\n\n" + (r.summary || "") + "\n\n";
  if (r.insights && r.insights.length) {
    md += "## Insights\n";
    r.insights.forEach((i) => { md += "- " + i + "\n"; });
    md += "\n";
  }
  if (r.action) md += "## Action\n" + r.action + "\n\n";
  if (r.list && r.list.length) {
    md += "## Full output\n";
    r.list.forEach((x, i) => { md += (i + 1) + ". " + x + "\n"; });
    md += "\n";
  }
  if (r.meta && r.meta.checklist) {
    md += "## Upgraded study checklist\n";
    r.meta.checklist.forEach((c, i) => { md += (i + 1) + ". " + c + "\n"; });
    md += "\n";
  }
  md += "---\nGenerated by the Qimmah Digital CEO Command Center hourly autopilot.\n";
  return md;
}

/* ============================================================
   RESULTS VIEW — feed of every cycle's saved result
   ============================================================ */
const TYPE_STYLE = { study: { c: "#A78BFA", label: "study" }, work: { c: CYAN, label: "work" }, meta: { c: "#FBBF24", label: "method" } };

function ResultCard({ r, up, log }) {
  const [open, setOpen] = useState(false);
  const ts = TYPE_STYLE[r.type] || TYPE_STYLE.study;
  const squadColor = SQUAD_META[r.squad] ? SQUAD_META[r.squad].color : "#A78BFA";
  return (
    <Card style={{ padding: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, cursor: "pointer" }} onClick={() => setOpen(!open)}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginBottom: 5 }}>
            <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: squadColor + "22", color: squadColor, border: "1px solid " + squadColor + "55", textTransform: "uppercase", letterSpacing: 1 }}>Squad {r.squad}</span>
            <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: ts.c + "22", color: ts.c, border: "1px solid " + ts.c + "55", textTransform: "uppercase", letterSpacing: 1 }}>{ts.label}</span>
            {r.offline && <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 20, background: "rgba(255,255,255,0.06)", color: "#8B86A3", border: "1px solid rgba(255,255,255,0.12)" }}>offline</span>}
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#F5F3FF", lineHeight: 1.4 }}>{r.topic}</div>
          <div style={{ fontSize: 10.5, color: "#6B6685", marginTop: 3, textTransform: "uppercase", letterSpacing: 1 }}>{r.hour} · {r.agent} · {timeAgo(r.ts)}</div>
        </div>
        {open ? <ChevronUp size={16} style={{ color: "#8B86A3", flexShrink: 0 }} /> : <ChevronDown size={16} style={{ color: "#8B86A3", flexShrink: 0 }} />}
      </div>
      {open && (
        <div style={{ marginTop: 10 }}>
          {r.summary && <div style={{ fontSize: 13, color: "#C9C4DC", lineHeight: 1.65, marginBottom: 10, whiteSpace: "pre-wrap" }}>{r.summary}</div>}
          {r.insights && r.insights.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: CYAN, marginBottom: 5 }}>Insights</div>
              <div style={{ fontSize: 12.5, color: "#D8D3E8", lineHeight: 1.7 }}>{r.insights.map((p, i) => <div key={i}>{"\u2022"} {p}</div>)}</div>
            </div>
          )}
          {r.action && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "#FFB020", marginBottom: 5 }}>Action</div>
              <div style={{ fontSize: 12.5, color: "#D8D3E8", lineHeight: 1.7 }}>{"\u2192"} {r.action}</div>
            </div>
          )}
          {r.list && r.list.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "#A78BFA", marginBottom: 5 }}>Full output · {r.list.length} items</div>
              <div style={{ fontSize: 12.5, color: "#D8D3E8", lineHeight: 1.7, maxHeight: 240, overflowY: "auto" }}>{r.list.map((x, i) => <div key={i}>{i + 1}. {x}</div>)}</div>
            </div>
          )}
          {r.meta && r.meta.checklist && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "#FBBF24", marginBottom: 5 }}>Upgraded study checklist</div>
              <div style={{ fontSize: 12.5, color: "#D8D3E8", lineHeight: 1.7 }}>{r.meta.checklist.map((c, i) => <div key={i}>{i + 1}. {c}</div>)}</div>
            </div>
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
            <button style={btnGhost} onClick={(e) => { e.stopPropagation(); try { downloadFile("qimmah-result-" + (r.type || "work") + "-" + new Date(r.ts).toISOString().slice(0, 16).replace(/[:T]/g, "-") + ".md", resultMarkdown(r), "text/markdown"); log("system", "Result downloaded: " + r.topic.slice(0, 50)); } catch (err) { /* download unavailable */ } }}>
              <Download size={13} /> Download .md
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}

export function Results({ S, up, log, onRunNow, running }) {
  const results = S.results || [];
  const ap = S.autopilot || {};
  const [busy, setBusy] = useState("");
  const [, forceTick] = useState(0);

  /* 1s tick so the next-cycle countdown stays live; cleared on unmount. */
  useEffect(() => {
    const t = setInterval(() => forceTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const weekAgo = Date.now() - 7 * 86400000;
  const thisWeek = results.filter((r) => r.ts > weekAgo && r.type === "study").length;
  const nextIn = (() => {
    if (!ap.auto) return "—";
    const base = ap.lastCycleAt || Date.now();
    const next = (hourKey(base) + 1) * 3600000;
    const ms = Math.max(0, next - Date.now());
    const mm = Math.floor(ms / 60000), ss = Math.floor((ms % 60000) / 1000);
    return mm + "m " + String(ss).padStart(2, "0") + "s";
  })();

  async function deploy(kind) {
    if (busy) return;
    setBusy(kind);
    try { await quickDeploy(S, up, log, kind); } catch (e) { /* quickDeploy guards itself */ }
    setBusy("");
  }

  return (
    <div>
      <SectionTitle eyebrow="Autopilot" title="Results" sub="Every hour a different squad works and studies one topic — and every cycle saves its result here. Every 6th cycle the brain reviews its own methods and upgrades how it studies." />

      {/* Controls + stats */}
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 18 }}>
        <Stat label="Total cycles" value={ap.cycleCount || 0} accent="#A78BFA" sub={results.length + " results saved"} />
        <Stat label="Studies this week" value={thisWeek} accent={CYAN} sub="last 7 days" />
        <Stat label="Last cycle" value={ap.lastCycleAt ? timeAgo(ap.lastCycleAt) : "never"} accent="#34D399" sub={ap.auto ? "autopilot running" : "autopilot off"} />
        <Stat label="Next cycle" value={nextIn} accent="#FBBF24" sub={ap.auto ? "countdown" : "turn autopilot on"} />
      </div>

      <Card glow style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <button
            style={{ ...btnPrimary, background: ap.auto ? "linear-gradient(135deg, #059669, #047857)" : "linear-gradient(135deg, #7C3AED, #6D28D9)" }}
            onClick={() => {
              up((s) => ({ ...s, autopilot: { ...(s.autopilot || {}), auto: !(s.autopilot && s.autopilot.auto) } }));
              log("autopilot", "Autopilot turned " + (ap.auto ? "OFF" : "ON") + " — squads " + (ap.auto ? "stand down" : "work every hour"));
            }}>
            <Power size={15} /> Autopilot: {ap.auto ? "ON" : "OFF"}
          </button>
          <button style={btnGhost} disabled={!!running} onClick={onRunNow}>
            <Play size={13} /> {running ? "Cycle running…" : "Run cycle now"}
          </button>
          <span style={{ fontSize: 11.5, color: "#8B86A3", lineHeight: 1.5 }}>
            {S.groqKey || IN_PREVIEW ? "Live research via Groq Compound. Missed hours (up to 8) are caught up when you open the app." : "Offline mode — connect a Groq key (AI CEO tab) for live web research; cycles still run and save results."}
          </span>
        </div>
      </Card>

      {/* Quick Deploy — fast ways with the 60 AI */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: "#C4B5FD", marginBottom: 4 }}>Quick Deploy · fast ways with the 60 AI</div>
        <div style={{ fontSize: 12, color: "#8B86A3", marginBottom: 12 }}>One tap deploys all 5 squads and saves a downloadable result.</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button style={btnGhost} disabled={!!busy} onClick={() => deploy("leads")}><Zap size={13} /> {busy === "leads" ? "Deploying…" : "All squads: find 5 lead ideas each"}</button>
          <button style={btnGhost} disabled={!!busy} onClick={() => deploy("offer")}><FileText size={13} /> {busy === "offer" ? "Drafting…" : "Draft this week's offer"}</button>
          <button style={btnGhost} disabled={!!busy} onClick={() => deploy("standup")}><Users size={13} /> {busy === "standup" ? "Reporting…" : "Squad standup report"}</button>
        </div>
      </Card>

      {/* Study queue */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: "#C4B5FD", marginBottom: 10 }}>Study queue · your topics run first</div>
        <QueueEditor S={S} up={up} log={log} />
      </Card>

      {/* Feed */}
      {results.length === 0
        ? <Empty icon={Award} title="No results yet" body="Turn the autopilot ON or tap “Run cycle now” — the first squad works within the hour and the result lands here." />
        : <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: "#C4B5FD" }}>Work results · {results.length}</div>
              <button style={{ ...btnGhost, padding: "5px 10px", fontSize: 11 }} onClick={() => { if (window.confirm("Clear all saved results? This cannot be undone.")) { up((s) => ({ ...s, results: [] })); log("system", "Results feed cleared"); } }}>
                <Trash2 size={11} /> Clear
              </button>
            </div>
            {results.map((r) => <ResultCard key={r.id} r={r} up={up} log={log} />)}
          </div>}
    </div>
  );
}

function QueueEditor({ S, up, log }) {
  const [t, setT] = useState("");
  const q = S.studyQueue || [];
  function add() {
    const v = t.trim();
    if (!v) return;
    up((s) => ({ ...s, studyQueue: [...(s.studyQueue || []), v.slice(0, 120)] }));
    log("autopilot", "Study topic queued: " + v.slice(0, 60));
    setT("");
  }
  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: q.length ? 10 : 0 }}>
        <input style={{ ...inputStyle, flex: 1 }} placeholder="Queue a topic, e.g. TikTok ads for Omani cafés" value={t}
          onChange={(e) => setT(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add(); }} />
        <button style={btnPrimary} onClick={add}>Queue</button>
      </div>
      {q.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {q.map((x, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <span style={{ fontSize: 13, color: "#E9E4FB" }}>{i + 1}. {x}</span>
              <button style={{ background: "none", border: "none", cursor: "pointer", color: "#6B6685", padding: 2 }}
                onClick={() => up((s) => ({ ...s, studyQueue: (s.studyQueue || []).filter((_, j) => j !== i) }))}>
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
