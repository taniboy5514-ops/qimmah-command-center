/* ============================================================
   SQUAD REPORT CYCLE — every 10–15 minutes:
   Phase 1 · all 60 agents file mini status/work reports (local)
   Phase 2 · each squad's Alpha compiles a squad digest (1 aiCall per squad)
   Phase 3 · the 5 digests go to the CEO Brain → ONE consolidated
             "Full Study" with a directive per squad (1 aiCall)
   Phase 4 · the study is saved to Results and each squad's directive
             is routed back to its Alpha (S.squadDirectives).
   ============================================================ */
import { useState, useEffect } from "react";
import { Power, Play, Brain, Radio, Users, FileText, CheckCircle2 } from "lucide-react";
import { PURPLE, CYAN, SQUAD_META, AGENT_NAMES, AGENTS, SYSTEM_PROMPT, buildSnapshot, aiCall, IN_PREVIEW, uid, timeAgo, btnPrimary, btnGhost, Card } from "./shared.jsx";

export const SQUADS = ["Alpha", "Beta", "Gamma", "Delta", "Epsilon"];
export const MIN_INTERVAL = 10, MAX_INTERVAL = 15, DEFAULT_INTERVAL = 12;

export const PHASES = [
  { id: "agents", label: "Agents reporting", icon: Users },
  { id: "alphas", label: "Alphas compiling", icon: FileText },
  { id: "ceo", label: "CEO Brain studying", icon: Brain },
  { id: "done", label: "Directives delivered", icon: CheckCircle2 },
];

/* ---------- Scheduling ---------- */
export function clampInterval(n) {
  n = Math.round(Number(n) || DEFAULT_INTERVAL);
  return Math.max(MIN_INTERVAL, Math.min(MAX_INTERVAL, n));
}

/* Is a squad-report cycle due? Catch-up runs at most 1 missed cycle. */
export function dueSquadCycle(S) {
  const sc = S.squadCycle || {};
  if (!sc.enabled) return false;
  const intervalMs = clampInterval(sc.intervalMin) * 60000;
  if (!sc.lastRun) return true;
  return (Date.now() - sc.lastRun) >= intervalMs;
}

/* ---------- Phase 1: 60 deterministic mini-reports (no API calls) ---------- */
const REPORT_STATUS = ["on track", "ahead of quota", "steady progress", "clearing backlog", "waiting on input", "testing a new approach"];
const REPORT_WORK = {
  Alpha: ["sent outreach batches to Muscat SMEs", "qualified new WhatsApp leads", "refreshed ad creatives for this week", "drafted proposals for warm leads", "pitched the OMR 400 website package"],
  Beta: ["shipped deliverable drafts for client work", "polished landing pages and copy", "ran QA on pending deliverables", "updated client reporting dashboards", "edited short-form content for clients"],
  Gamma: ["tracked Omani competitor moves", "scanned GCC market trends 2025-2026", "analyzed keyword and pricing data", "profiled new Muscat client segments", "benchmarked retainer pricing in OMR"],
  Delta: ["automated routine reporting flows", "processed documents and invoices", "kept CRM and scheduling clean", "monitored brand mentions and reviews", "tightened workflow automations"],
  Epsilon: ["prototyped a new agent workflow", "researched AI tooling upgrades", "drafted training notes for the fleet", "tested prompt improvements", "explored a new service line idea"],
};
const REPORT_ASK = ["needs CEO sign-off", "requests budget guidance", "asks for a client decision", "no blockers", "needs cross-squad support", "requests priority clarity"];

function seeded(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = (((h << 5) + h) + str.charCodeAt(i)) >>> 0;
  return h;
}

function miniReport(agent, cycleNo, highlights) {
  const h = seeded(agent.code + ":" + cycleNo);
  const works = REPORT_WORK[agent.squad] || [];
  const status = REPORT_STATUS[h % REPORT_STATUS.length];
  const work = works[h % works.length];
  const ask = REPORT_ASK[(h >> 3) % REPORT_ASK.length];
  const hl = highlights.length ? highlights[h % highlights.length] : null;
  let text = agent.code + " " + agent.name + " — " + status + ": " + work + ".";
  if (hl) text += " Building on recent result: \"" + hl + "\".";
  text += " Ask: " + ask + ".";
  return { code: agent.code, name: agent.name, squad: agent.squad, status, text };
}

/* ---------- Phase 2: per-squad Alpha digest ---------- */
function templateDigest(squad, reports) {
  const onTrack = reports.filter((r) => /on track|ahead|steady/.test(r.status)).length;
  const asks = reports.filter((r) => !/no blockers/.test(r.text)).slice(0, 3).map((r) => r.code + " " + (/Ask: ([^.]+)/.exec(r.text) || [])[1]);
  return {
    wins: onTrack + "/" + reports.length + " agents on track or ahead — " + (reports[0] ? reports[0].text.replace(/^[^—]+— /, "") : "work progressing"),
    blockers: "Waiting-on-input agents: " + reports.filter((r) => /waiting/.test(r.status)).length + ". No hard blockers reported.",
    metrics: reports.length + " reports filed · " + onTrack + " green statuses · " + asks.length + " open asks",
    asks: asks.length ? asks.join("; ") : "No requests this cycle",
    offline: true,
  };
}

async function compileDigest(S, squad, reports) {
  const hasKey = !!S.groqKey || IN_PREVIEW;
  const lead = AGENT_NAMES[squad][0];
  if (!hasKey) return templateDigest(squad, reports);
  const prompt = "SQUAD REPORT DIGEST — Squad " + squad + " (" + SQUAD_META[squad].role + ", lead agent " + lead + ").\n"
    + "Here are this cycle's " + reports.length + " agent mini-reports:\n"
    + reports.map((r, i) => (i + 1) + ". " + r.text).join("\n")
    + "\nCompile them into a tight squad digest for the CEO Brain. End with a fenced json block exactly like:\n"
    + "```json\n{\"wins\":\"top wins this cycle (1-2 sentences)\",\"blockers\":\"blockers or 'none'\",\"metrics\":\"key numbers in one line\",\"asks\":\"what the squad asks of the CEO, or 'none'\"}\n```\nKeep prose before the json free of JSON.";
  try {
    const sys = SYSTEM_PROMPT + "\n\nLIVE BUSINESS STATE:\n" + JSON.stringify(buildSnapshot(S));
    const raw = await aiCall(S, sys, [{ role: "user", content: prompt }], { model: "groq/compound" });
    const fence = raw.match(/```json\s*([\s\S]*?)```/) || raw.match(/```\s*(\{[\s\S]*?"wins"[\s\S]*?\})\s*```/);
    if (fence) {
      const p = JSON.parse(fence[1]);
      return {
        wins: String(p.wins || "").slice(0, 400),
        blockers: String(p.blockers || "").slice(0, 300),
        metrics: String(p.metrics || "").slice(0, 200),
        asks: String(p.asks || "").slice(0, 300),
        offline: false,
      };
    }
  } catch (e) { /* fall back to template below */ }
  return templateDigest(squad, reports);
}

/* ---------- Phase 3: CEO Brain consolidated Full Study ---------- */
function templateStudy(digests, cycleId) {
  const findings = [
    "All 60 agents filed reports this cycle — fleet is operational across all 5 squads.",
    "Squad " + SQUADS[cycleId % SQUADS.length] + " shows the strongest momentum this cycle; keep feeding it live client work.",
    "Open asks cluster around CEO sign-off and priority clarity — fast decisions unblock multiple squads at once.",
  ];
  const insights = [
    "Reports feed digests, digests feed strategy: repeating this loop every 10–15 minutes keeps the whole fleet aligned on OMR 19,800/mo.",
    "Squads that cite recent Results entries produce sharper work — keep the hourly autopilot running alongside this cycle.",
  ];
  const directives = {};
  const DIR = {
    Alpha: "Double down on what's working: pitch this week's OMR offer to 10 fresh Muscat businesses on WhatsApp before the next cycle.",
    Beta: "Clear every waiting-on-input deliverable first, then pick up the top lead from Squad Alpha and produce a demo in hours, not days.",
    Gamma: "Turn this cycle's market scan into one concrete OMR pricing recommendation the CEO can act on today.",
    Delta: "Automate the most repeated manual step reported this cycle and document the new flow for the fleet.",
    Epsilon: "Ship one small prototype from this cycle's research and hand it to Squad Beta for a live client test.",
  };
  SQUADS.forEach((sq) => { directives[sq] = DIR[sq] + " (offline template — connect Groq for live CEO Brain study)"; });
  return { findings, insights, directives, offline: true, digests };
}

async function ceoStudy(S, digests, cycleId) {
  const hasKey = !!S.groqKey || IN_PREVIEW;
  if (!hasKey) return templateStudy(digests, cycleId);
  const prompt = "SQUAD REPORT CYCLE — FULL STUDY. All 60 agents reported; the 5 squad Alphas compiled these digests:\n\n"
    + SQUADS.map((sq) => {
      const d = digests[sq];
      return "SQUAD " + sq.toUpperCase() + " (" + SQUAD_META[sq].role + ")\nWins: " + d.wins + "\nBlockers: " + d.blockers + "\nMetrics: " + d.metrics + "\nAsks: " + d.asks;
    }).join("\n\n")
    + "\n\nYou are the CEO Brain. Produce ONE consolidated Full Study: the key findings across the fleet, cross-squad insights, and exactly ONE concrete directive per squad that the squad's Alpha will execute next cycle. End with a fenced json block exactly like:\n"
    + "```json\n{\"findings\":[\"finding 1\",\"finding 2\",\"finding 3\"],\"insights\":[\"cross-squad insight 1\",\"cross-squad insight 2\"],\"directives\":{\"Alpha\":\"...\",\"Beta\":\"...\",\"Gamma\":\"...\",\"Delta\":\"...\",\"Epsilon\":\"...\"}}\n```\nKeep prose before the json free of JSON. Directives must be specific, doable within one 10–15 minute cycle, and grounded in the live business state.";
  try {
    const sys = SYSTEM_PROMPT + "\n\nLIVE BUSINESS STATE:\n" + JSON.stringify(buildSnapshot(S));
    const raw = await aiCall(S, sys, [{ role: "user", content: prompt }], { model: "groq/compound" });
    const fence = raw.match(/```json\s*([\s\S]*?)```/) || raw.match(/```\s*(\{[\s\S]*?"directives"[\s\S]*?\})\s*```/);
    if (fence) {
      const p = JSON.parse(fence[1]);
      const dirs = p.directives || {};
      const directives = {};
      SQUADS.forEach((sq) => { directives[sq] = String(dirs[sq] || "").slice(0, 300); });
      if (SQUADS.every((sq) => directives[sq])) {
        return {
          findings: (Array.isArray(p.findings) ? p.findings : []).map((x) => String(x).slice(0, 260)).filter(Boolean).slice(0, 6),
          insights: (Array.isArray(p.insights) ? p.insights : []).map((x) => String(x).slice(0, 260)).filter(Boolean).slice(0, 4),
          directives, offline: false, digests,
        };
      }
    }
  } catch (e) { /* fall back below */ }
  return templateStudy(digests, cycleId);
}

/* ---------- ONE FULL CYCLE (4 phases) ---------- */
export async function runSquadCycle(S, up, log, onPhase) {
  const sc = S.squadCycle || {};
  const cycleNo = (sc.cycleCount || 0) + 1;
  const cycleId = "SC-" + String(cycleNo).padStart(4, "0");
  const hour = new Date().toLocaleString("en", { weekday: "short", hour: "2-digit", minute: "2-digit" });
  const setPhase = (p) => { try { if (onPhase) onPhase(p); } catch (e) { /* UI hook optional */ } };

  // Phase 1 — 60 agents report (local, instant, free)
  setPhase("agents");
  const highlights = (S.results || []).filter((r) => r.topic).slice(0, 6).map((r) => r.topic);
  const reports = AGENTS.map((a) => miniReport(a, cycleNo, highlights));

  // Phase 2 — each squad's Alpha compiles a digest
  setPhase("alphas");
  const digests = {};
  for (const sq of SQUADS) {
    digests[sq] = await compileDigest(S, sq, reports.filter((r) => r.squad === sq));
  }

  // Phase 3 — CEO Brain produces the consolidated Full Study
  setPhase("ceo");
  const study = await ceoStudy(S, digests, cycleNo);
  if (!study.findings.length) study.findings = templateStudy(digests, cycleNo).findings;

  // Phase 4 — route directives back to the Alphas
  const ts = Date.now();
  const directiveState = {};
  SQUADS.forEach((sq) => {
    directiveState[sq] = { text: study.directives[sq], ts, cycleId, squad: sq };
  });
  const entry = {
    id: uid(), hour, squad: "All 5", agent: "CEO Brain",
    topic: "Squad Report Cycle " + cycleId + " — Full Study",
    summary: "All 60 agents reported → 5 squad Alphas compiled digests → the CEO Brain consolidated this Full Study and issued one directive per squad. " + (study.findings[0] || ""),
    insights: study.findings.concat(study.insights).slice(0, 8),
    action: "Each squad Alpha executes its directive below before the next cycle (" + clampInterval(sc.intervalMin) + " min).",
    type: "squad-study",
    cycleId, findings: study.findings, crossInsights: study.insights,
    directives: study.directives, digests,
    offline: study.offline, cycle: cycleNo, ts,
  };
  up((s) => ({
    ...s,
    results: [entry, ...(s.results || [])].slice(0, 200),
    squadDirectives: { ...(s.squadDirectives || {}), ...directiveState },
    squadCycle: { ...(s.squadCycle || {}), lastRun: ts, cycleCount: cycleNo, phase: "done", intervalMin: clampInterval((s.squadCycle || {}).intervalMin) },
    feed: [
      { id: uid(), type: "autopilot", text: "Squad cycle " + cycleId + ": 60 reports → 5 digests → Full Study saved (Results)", ts, by: "CEO Brain" },
      ...SQUADS.map((sq) => ({ id: uid(), type: "agent", text: "Directive for Squad " + sq + ": " + String(study.directives[sq]).slice(0, 90), ts, by: "CEO Brain" })),
      ...(s.feed || []),
    ].slice(0, 100),
  }));
  setPhase("done");
  log("autopilot", "Squad cycle " + cycleId + " complete — directives routed to all 5 Alphas" + (study.offline ? " [offline]" : ""));
  return entry;
}

/* ============================================================
   UI — cycle control panel (toggle, interval, countdown, phase)
   ============================================================ */
export function SquadCyclePanel({ S, up, log, onRunNow, running, phase }) {
  const sc = S.squadCycle || {};
  const enabled = sc.enabled !== false;
  const intervalMin = clampInterval(sc.intervalMin);
  const [, forceTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => forceTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const nextIn = (() => {
    if (!enabled) return "—";
    if (!sc.lastRun) return "due now";
    const ms = Math.max(0, (sc.lastRun + intervalMin * 60000) - Date.now());
    const mm = Math.floor(ms / 60000), ss = Math.floor((ms % 60000) / 1000);
    return mm + "m " + String(ss).padStart(2, "0") + "s";
  })();
  const activePhase = running ? (phase || "agents") : null;

  return (
    <Card glow style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: "#C4B5FD" }}>
            <Radio size={12} style={{ verticalAlign: "-1px", marginRight: 6, color: CYAN }} />
            Squad Report Cycle · every {intervalMin} min
          </div>
          <div style={{ fontSize: 12, color: "#8B86A3", marginTop: 4 }}>
            60 agents report → Alphas compile digests → CEO Brain issues one directive per squad.
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <select
            value={intervalMin}
            onChange={(e) => up((s) => ({ ...s, squadCycle: { ...(s.squadCycle || {}), intervalMin: clampInterval(e.target.value) } }))}
            style={{ ...btnGhost, padding: "8px 10px", appearance: "auto" }} title="Cycle interval (10–15 minutes)">
            {[10, 11, 12, 13, 14, 15].map((m) => <option key={m} value={m}>{m} min</option>)}
          </select>
          <button
            style={{ ...btnPrimary, background: enabled ? "linear-gradient(135deg, #059669, #047857)" : "linear-gradient(135deg, #7C3AED, #6D28D9)" }}
            onClick={() => {
              up((s) => ({ ...s, squadCycle: { ...(s.squadCycle || {}), enabled: !enabled } }));
              log("autopilot", "Squad report cycle turned " + (enabled ? "OFF" : "ON"));
            }}>
            <Power size={14} /> Cycle: {enabled ? "ON" : "OFF"}
          </button>
          <button style={btnGhost} disabled={!!running} onClick={onRunNow}>
            <Play size={13} /> {running ? "Cycle running…" : "Run cycle now"}
          </button>
        </div>
      </div>
      {/* Live phase indicator */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        {PHASES.map((p, i) => {
          const Icon = p.icon;
          const active = activePhase === p.id;
          const passed = activePhase && PHASES.findIndex((x) => x.id === activePhase) > i;
          const done = !running && sc.lastRun;
          return (
            <span key={p.id} style={{
              fontSize: 11, fontWeight: active ? 700 : 500, padding: "4px 10px", borderRadius: 20,
              display: "inline-flex", alignItems: "center", gap: 5,
              background: active ? "rgba(6,182,212,0.15)" : "rgba(255,255,255,0.04)",
              color: active ? CYAN : (passed || done ? "#34D399" : "#6B6685"),
              border: "1px solid " + (active ? "rgba(6,182,212,0.5)" : "rgba(255,255,255,0.08)"),
            }}>
              <Icon size={11} className={active ? "q-blink" : ""} /> {p.label}
              {i < PHASES.length - 1 && <span style={{ color: "#4B4665", marginLeft: 4 }}>→</span>}
            </span>
          );
        })}
        <span style={{ fontSize: 11, color: "#8B86A3", marginLeft: "auto" }}>
          Last: {sc.lastRun ? timeAgo(sc.lastRun) : "never"} · Next: {nextIn} · Cycles: {sc.cycleCount || 0}
        </span>
      </div>
    </Card>
  );
}

/* Per-squad "Latest directive from CEO Brain" cards for the Agents view. */
export function SquadDirectiveCards({ S }) {
  const dirs = S.squadDirectives || {};
  const keys = SQUADS.filter((sq) => dirs[sq]);
  if (!keys.length) return null;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 10, marginBottom: 16 }}>
      {keys.map((sq) => {
        const d = dirs[sq];
        const m = SQUAD_META[sq];
        return (
          <Card key={sq} style={{ padding: 14, borderColor: m.color + "55" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: m.color }}>
                Squad {sq} directive
              </span>
              <Brain size={13} style={{ color: PURPLE }} />
            </div>
            <div style={{ fontSize: 12.5, color: "#D8D3E8", lineHeight: 1.6 }}>{d.text}</div>
            <div style={{ fontSize: 10, color: "#6B6685", marginTop: 6, textTransform: "uppercase", letterSpacing: 1 }}>
              {d.cycleId} · {timeAgo(d.ts)} · from CEO Brain
            </div>
          </Card>
        );
      })}
    </div>
  );
}
