import { useState, useEffect, useRef } from "react";
import { Mic, Send, Copy, Volume2, VolumeX, Trash2, Settings, Sparkles, Check, Download, FileCheck2, Radio, Target, X, Plus, Camera, Image, FileUp, Link2, Plug, Flag, ChevronRight } from "lucide-react";
import { PURPLE, CYAN, SQUAD_META, AGENTS, SYSTEM_PROMPT, TOOL_INSTRUCTIONS, buildSnapshot, knowledgeNote, memoryNote, teamNote, pickFemaleVoice, sanitizeHistory, parseActions, describeAction, applyActions, aiCall, classifyInsight, uid, timeAgo, VOICE_IDS, IN_PREVIEW, REVENUE_TARGET, glass, inputStyle, btnPrimary, btnGhost, Card, SectionTitle, Field, wantsWork, wantsGoal, SKILL_CATALOG, fleetChatMsg, CHAT_CAP, GROQ_MODELS, GROQ_MODEL_LABELS } from "./shared.jsx";
import { deliverableMime } from "./autopilot.jsx";
import { downloadFile } from "./views3.jsx";
import { getFileSha, commitFiles } from "./github-sync.js";

/* Self-edit intent — the user is asking to change the Command Center app
   itself (not business work). Requires the GitHub connection in Integrations. */
const SELF_EDIT_RE = /(command center|this app|the app itself|the dashboard|change the (app'?s? |site )?(title|heading|name|color|logo)|add a (card|button|tab|section)|update the (app|dashboard|interface|ui)|edit the (app|code|ui|site)|self[- ]?edit)/i;
const SELF_EDIT_FILES = [
  { path: "src/app.jsx", what: "App shell — navigation, layout, tab titles" },
  { path: "src/shared.jsx", what: "Shared state, styles, AI engine, colors" },
  { path: "src/views1.jsx", what: "AI CEO chat and Settings" },
  { path: "src/views2.jsx", what: "Business views (tasks, finance, leads…)" },
  { path: "src/views3.jsx", what: "Integrations Hub, results, live feed" },
];
/* ============================================================
   PENDING APPROVALS — MCP approval queue. Polls /api/mcp/approve
   (GET) and renders Approve/Reject. Degrades gracefully: when the
   backend is not configured the card stays completely hidden.
   ============================================================ */
export function PendingApprovals({ log }) {
  const [approvals, setApprovals] = useState(null); // null = backend not detected
  const [busyId, setBusyId] = useState("");

  useEffect(() => {
    let alive = true;
    async function poll() {
      try {
        const res = await fetch("/api/mcp/approve");
        if (!alive) return;
        if (res.ok) {
          const json = await res.json();
          setApprovals(json.approvals || []);
        } // 401/404/500 → backend not live for this session; stay hidden
      } catch (e) { /* backend not configured — stay hidden */ }
    }
    poll();
    const t = setInterval(poll, 30000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  if (!approvals || approvals.length === 0) return null;

  /* Short context line from the approval args (goal steps carry their
     tool args here, e.g. a WhatsApp message or invoice lines). */
  function argsSummary(args) {
    if (!args || typeof args !== "object") return "";
    const parts = [];
    if (args.to) parts.push("to +" + String(args.to).replace(/[^0-9]/g, ""));
    if (args.recipientId) parts.push("to IG " + args.recipientId);
    if (args.message) parts.push("\"" + String(args.message).slice(0, 80) + (args.message.length > 80 ? "…" : "") + "\"");
    if (args.clientName) parts.push("client " + args.clientName);
    if (args.kind && args.amount !== undefined) parts.push(args.kind + " OMR " + args.amount);
    if (args.title) parts.push(String(args.title).slice(0, 60));
    if (args.files) parts.push((args.files.length || 1) + " file(s): " + args.files.map((f) => f.path).join(", ").slice(0, 60));
    return parts.slice(0, 2).join(" · ");
  }

  async function decide(id, decision) {
    setBusyId(id);
    try {
      const res = await fetch("/api/mcp/approve", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approvalId: id, decision }),
      });
      if (res.ok) {
        setApprovals((list) => (list || []).filter((a) => a.id !== id));
        log && log("approval", "Tool approval " + decision + "d");
      }
    } catch (e) { /* leave the row in place */ }
    setBusyId("");
  }

  async function approveAll() {
    setBusyId("all");
    for (const a of approvals) {
      try {
        const res = await fetch("/api/mcp/approve", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ approvalId: a.id, decision: "approve" }),
        });
        if (res.ok) setApprovals((list) => (list || []).filter((x) => x.id !== a.id));
      } catch (e) { /* keep the row */ }
    }
    log && log("approval", "Bulk-approved pending tool approvals");
    setBusyId("");
  }

  return (
    <Card style={{ marginBottom: 16, borderColor: "rgba(251,191,36,0.35)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
        <div style={{ fontSize: 11, letterSpacing: 2.5, textTransform: "uppercase", color: "#FBBF24", fontWeight: 600 }}>
          Pending approvals · {approvals.length}
        </div>
        <button style={{ ...btnGhost, padding: "5px 12px", fontSize: 12, color: "#FBBF24", borderColor: "rgba(251,191,36,0.35)" }}
          disabled={busyId === "all"} onClick={approveAll}>
          <Check size={13} /> Approve All
        </button>
      </div>
      {approvals.map((a) => (
        <div key={a.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "8px 0", borderTop: "1px solid rgba(255,255,255,0.06)", flexWrap: "wrap" }}>
          <div style={{ minWidth: 0, flex: "1 1 200px" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#E9E4FB" }}>{a.tool_name}</div>
            {argsSummary(a.args) && <div style={{ fontSize: 11.5, color: "#B8B3CC", marginTop: 1 }}>{argsSummary(a.args)}</div>}
            <div style={{ fontSize: 11, color: "#8B86A3" }}>{timeAgo(new Date(a.created_at).getTime())} · agent {String(a.agent_id).slice(0, 8)}</div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button style={{ ...btnPrimary, padding: "6px 14px", fontSize: 12 }} disabled={busyId === a.id || busyId === "all"} onClick={() => decide(a.id, "approve")}>
              <Check size={13} /> Approve
            </button>
            <button style={{ ...btnGhost, padding: "6px 14px", fontSize: 12 }} disabled={busyId === a.id || busyId === "all"} onClick={() => decide(a.id, "reject")}>
              Reject
            </button>
          </div>
        </div>
      ))}
    </Card>
  );
}

/* ============================================================
   GOAL MODE — progress card. Polls /api/ceo/goals; when a goal is
   active it shows prompt, Step X of N, progress bar, elapsed time
   and status, with pause/resume/cancel controls. Fully hidden when
   the backend is not configured (graceful, no errors).
   ============================================================ */
export function GoalProgressCard({ log }) {
  const [goals, setGoals] = useState(null); // null = backend not detected
  const [tick, setTick] = useState(0); // re-render for elapsed time

  useEffect(() => {
    let alive = true;
    async function poll() {
      try {
        const res = await fetch("/api/ceo/goals");
        if (!alive) return;
        if (res.ok) {
          const json = await res.json();
          setGoals(json.goals || []);
        } // 401/404/500 → backend not live; stay hidden
      } catch (e) { /* backend not configured — stay hidden */ }
    }
    poll();
    const t = setInterval(poll, 15000);
    const e = setInterval(() => setTick((n) => n + 1), 30000);
    return () => { alive = false; clearInterval(t); clearInterval(e); };
  }, []);

  if (!goals) return null;
  const goal = goals.find((g) => g.status === "active") || goals.find((g) => g.status === "paused") || null;
  if (!goal) return null;

  const steps = goal.steps || [];
  const done = steps.filter((s) => s.status === "done").length;
  const total = steps.length;
  const current = steps.find((s) => s.status === "running" || s.status === "ready" || s.status === "blocked");
  const pct = Math.round((goal.progress != null ? Number(goal.progress) : total ? done / total : 0) * 100);
  const elapsedMin = Math.max(1, Math.round((Date.now() - new Date(goal.created_at).getTime()) / 60000));
  const statusColor = { active: CYAN, paused: "#FBBF24", completed: "#34D399", cancelled: "#F87171" }[goal.status] || CYAN;

  async function control(action) {
    try {
      const res = await fetch("/api/ceo/goals", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: goal.id, action }),
      });
      if (res.ok) {
        const json = await res.json();
        setGoals((list) => (list || []).map((g) => (g.id === goal.id ? { ...g, ...json.goal, steps: g.steps } : g)));
        log && log("system", "Goal " + action + "d: " + goal.prompt.slice(0, 50));
        if (action === "cancel") setGoals((list) => (list || []).filter((g) => g.id !== goal.id));
      }
    } catch (e) { /* leave state as-is */ }
  }

  return (
    <Card style={{ marginBottom: 16, borderColor: "rgba(6,182,212,0.35)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
        <div style={{ fontSize: 11, letterSpacing: 2.5, textTransform: "uppercase", color: CYAN, fontWeight: 600, display: "flex", alignItems: "center", gap: 7 }}>
          <Target size={13} /> Goal Mode · Step {Math.min(done + 1, total)} of {total}
        </div>
        <div style={{ fontSize: 11, color: "#8B86A3" }}>
          <span style={{ color: statusColor, fontWeight: 700, textTransform: "uppercase" }}>{goal.status}</span>
          {" · "}{elapsedMin < 60 ? elapsedMin + "m" : Math.floor(elapsedMin / 60) + "h " + (elapsedMin % 60) + "m"} elapsed
        </div>
      </div>
      <div style={{ fontSize: 13.5, fontWeight: 600, color: "#E9E4FB", marginBottom: 4 }}>{goal.prompt}</div>
      {current && goal.status === "active" && (
        <div style={{ fontSize: 11.5, color: "#8B86A3", marginBottom: 8 }}>
          Now: {current.title} ({current.squad} · {current.tool_name}){current.status === "blocked" ? " — waiting for approval" : ""}
        </div>
      )}
      <div style={{ height: 8, borderRadius: 6, background: "rgba(255,255,255,0.07)", overflow: "hidden", marginBottom: 10 }}>
        <div style={{ height: "100%", width: pct + "%", borderRadius: 6, background: "linear-gradient(90deg,#7C3AED,#06B6D4)", transition: "width 0.6s ease" }} />
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {goal.status === "active" && <button style={{ ...btnGhost, padding: "5px 12px", fontSize: 12 }} onClick={() => control("pause")}>Pause</button>}
        {goal.status === "paused" && <button style={{ ...btnGhost, padding: "5px 12px", fontSize: 12, color: "#34D399", borderColor: "rgba(52,211,153,0.35)" }} onClick={() => control("resume")}>Resume</button>}
        <button style={{ ...btnGhost, padding: "5px 12px", fontSize: 12, color: "#F87171", borderColor: "rgba(248,113,113,0.3)" }} onClick={() => control("cancel")}>Cancel</button>
      </div>
    </Card>
  );
}

/* ============================================================
   START AS GOAL — shown under a CEO reply when the user's message
   read as an objective. Probes the backend once and stays hidden
   when Goal Mode is not configured.
   ============================================================ */
export function GoalOffer({ prompt, log }) {
  const [state, setState] = useState("probing"); // probing | ready | starting | started | hidden
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/ceo/goals");
        if (alive) setState(res.ok ? "ready" : "hidden");
      } catch (e) { if (alive) setState("hidden"); }
    })();
    return () => { alive = false; };
  }, []);

  if (state === "probing" || state === "hidden") return null;

  async function start() {
    setState("starting");
    try {
      const res = await fetch("/api/ceo/goals", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      if (res.ok) {
        setState("started");
        log && log("system", "Goal started: " + prompt.slice(0, 60));
      } else {
        setState("ready");
      }
    } catch (e) { setState("ready"); }
  }

  if (state === "started") {
    return (
      <div style={{ marginTop: 6, fontSize: 12, color: "#34D399", display: "flex", alignItems: "center", gap: 6 }}>
        <Check size={13} /> Goal started — watch the Goal Mode card above.
      </div>
    );
  }
  return (
    <button style={{ ...btnGhost, marginTop: 6, padding: "7px 14px", fontSize: 12.5, color: CYAN, borderColor: "rgba(6,182,212,0.4)" }}
      disabled={state === "starting"} onClick={start}>
      <Target size={13} /> {state === "starting" ? "Planning steps…" : "Start as Goal"}
    </button>
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

export function OpsRadar({ S, busy }) {
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
export function AutopilotPanel({ S, up, log, user }) {
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
        + knowledgeNote(S) + memoryNote(S) + teamNote(S)
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
                  {ap.last.links.map((l, i) => <a key={i} href={l.href} download={l.download || null} target="_blank" rel="noreferrer" style={{ ...btnGhost, fontSize: 12, textDecoration: "none" }}><Send size={12} /> {l.label}</a>)}
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

/* Free neural female voices (Microsoft Edge TTS via /api/tts — no key needed).
   Honest caveat: unofficial free service, could change or be rate-limited. */
export const EDGE_VOICES = {
  Aria: "en-US-AriaNeural",              // warm, natural (default)
  Jenny: "en-US-JennyNeural",            // friendly
  Michelle: "en-US-MichelleNeural",      // clear
  Sonia: "en-GB-SoniaNeural",            // British
  "Zariyah (Arabic)": "ar-SA-ZariyahNeural",
};

/* ============================================================
   AI CEO CHAT — direct Groq API, voice in/out, insights
   ============================================================ */
export function CEOChat({ S, up, log, user, go }) {
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [showVoice, setShowVoice] = useState(false);
  const [keyDraft, setKeyDraft] = useState("");
  const [copied, setCopied] = useState("");
  const [showSkills, setShowSkills] = useState(false);
  const [voiceEngine, setVoiceEngine] = useState(""); // engine that last spoke: ElevenLabs | Neural (free) | Browser voice
  /* "+" connectors menu (Kimi-style) — attachments, links, plugins, skills, goals */
  const [showPlus, setShowPlus] = useState(false);
  const [showLink, setShowLink] = useState(false);
  const [linkDraft, setLinkDraft] = useState("");
  const [attachments, setAttachments] = useState([]);
  const camRef = useRef(null);
  const photoRef = useRef(null);
  const filePickRef = useRef(null);
  const inputRef = useRef(null);
  const scrollRef = useRef(null);
  const recRef = useRef(null);
  const audioRef = useRef(null);
  const draftRef = useRef("");
  draftRef.current = draft;

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [S.chat.length, busy]);

  // Browser voices load asynchronously — warm the list so the female voice is ready on first speak.
  useEffect(() => {
    try {
      if (!window.speechSynthesis) return;
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
    } catch (e) {}
  }, []);

  function stopAudio() {
    try { if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; } } catch (e) {}
    try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch (e) {}
    setSpeaking(false);
  }

  async function speak(text) {
    stopAudio();
    const clean = text.replace(/[*#_`>]/g, "").slice(0, 2500);
    /* Voice engine chain: ElevenLabs (if key) → free Edge neural voice → browser voice. */
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
          setVoiceEngine("ElevenLabs");
          a.onended = () => { setSpeaking(false); URL.revokeObjectURL(url); };
          a.onerror = () => { setSpeaking(false); URL.revokeObjectURL(url); };
          await a.play();
          return;
        }
      } catch (e) { /* fall through to free neural voice */ }
    }
    /* Free neural voice — Microsoft Edge neural TTS via /api/tts (no key needed). */
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: clean.slice(0, 2000), voice: EDGE_VOICES[S.edgeVoice] || EDGE_VOICES.Aria, rate: S.rate }),
      });
      if (!res.ok) throw new Error("TTS " + res.status);
      const blob = await res.blob();
      if (!blob.size) throw new Error("Empty audio");
      const url = URL.createObjectURL(blob);
      const a = new Audio(url);
      audioRef.current = a; // speed is baked in server-side via the rate parameter
      setSpeaking(true);
      setVoiceEngine("Neural (free)");
      a.onended = () => { setSpeaking(false); URL.revokeObjectURL(url); };
      a.onerror = () => { setSpeaking(false); URL.revokeObjectURL(url); };
      await a.play();
      return;
    } catch (e) { /* fall through to browser voice (preview, endpoint down, etc.) */ }
    try {
      const u = new SpeechSynthesisUtterance(clean);
      u.rate = S.rate;
      u.pitch = 1.05;
      const fv = pickFemaleVoice();
      if (fv) u.voice = fv;
      u.onend = () => setSpeaking(false);
      u.onerror = () => setSpeaking(false);
      setSpeaking(true);
      setVoiceEngine("Browser voice");
      window.speechSynthesis.speak(u);
    } catch (e) { setSpeaking(false); }
  }

  /* SELF-EDIT — change the Command Center itself via the GitHub connection.
     Plans a small find/replace edit with the AI, applies it to the real files
     and commits straight to the repo. Vercel redeploys automatically. */
  async function selfEdit(text) {
    setDraft(""); setError("");
    const userMsg = { id: uid(), role: "user", content: text, ts: Date.now(), by: user ? user.name : "" };
    up((s) => ({ ...s, chat: [...s.chat, userMsg].slice(-CHAT_CAP) }));
    const gh = { owner: "taniboy5514-ops", repo: "qimmah-command-center", branch: "main", ...(S.github || {}) };
    const postReply = (content, deliverable) => up((s) => ({
      ...s,
      chat: [...s.chat, { id: uid(), role: "assistant", content, deliverable: deliverable || null, ts: Date.now() }].slice(-CHAT_CAP),
    }));
    if (!gh.token) {
      postReply("I can change the Command Center myself, but I need GitHub access first. Open the Integrations Hub → “GitHub — self-edit” card, paste a fine-grained token (Contents: Read and write on " + gh.repo + ") and tap Test connection. Then ask me again.");
      return;
    }
    setBusy(true);
    try {
      /* Phase 1 — pick the files to touch. */
      const pickSys = "You route self-edit requests for the Qimmah Command Center (Vite + React SPA). "
        + "Reply ONLY with json like {\"files\":[\"src/views3.jsx\"]} — at most 3 paths chosen from this list:\n"
        + SELF_EDIT_FILES.map((f) => "- " + f.path + " — " + f.what).join("\n");
      const pickRaw = await aiCall(S, pickSys, [{ role: "user", content: "Change requested: " + text }]);
      const pickFence = pickRaw.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, pickRaw];
      let pick = null;
      try { pick = JSON.parse(pickFence[1]); } catch (e) { /* malformed */ }
      const paths = (pick && Array.isArray(pick.files) ? pick.files : [])
        .filter((p) => /^src\/[A-Za-z0-9._-]+\.jsx$/.test(String(p)))
        .slice(0, 3);
      if (!paths.length) throw new Error("I couldn't map that change to a file in the app. Be more specific (e.g. \"change the title in the AI CEO chat\").");

      /* Phase 2 — fetch the real files and plan verbatim find/replace edits. */
      const current = {};
      for (const p of paths) current[p] = (await getFileSha(gh, p)).content;
      const planSys = "You are the self-edit engine for the Qimmah Command Center (Vite 5 + React 18, inline styles, CYAN/PURPLE palette, lucide-react icons, no router). "
        + "Apply the user's change to the current file contents below by replying ONLY with a fenced json block:\n"
        + "```json\n{\"summary\":\"one-line summary\",\"files\":[{\"path\":\"src/x.jsx\",\"action\":\"update\",\"find\":\"snippet copied VERBATIM from the current file\",\"replace\":\"replacement snippet\"}]}\n```\n"
        + "Rules: edits only (never delete or create files), at most 3 files, keep changes small and in the existing style, \"find\" must appear exactly once per file and verbatim in the content shown, never touch or output API keys/tokens.\n\nCURRENT FILES:\n"
        + paths.map((p) => "=== " + p + " ===\n" + current[p]).join("\n\n");
      const planRaw = await aiCall(S, planSys, [{ role: "user", content: "Change requested: " + text }]);
      const planFence = planRaw.match(/```json\s*([\s\S]*?)```/) || planRaw.match(/```\s*(\{[\s\S]*?"files"[\s\S]*?\})\s*```/);
      let plan = null;
      if (planFence) { try { plan = JSON.parse(planFence[1]); } catch (e) { /* malformed */ } }
      const edits = plan && Array.isArray(plan.files) ? plan.files.slice(0, 3) : [];
      if (!edits.length) throw new Error("The AI couldn't produce a safe edit plan. Try describing the change a little differently.");
      const summary = String(plan.summary || text).slice(0, 120);

      /* Apply + validate. Never let the Groq/GitHub tokens anywhere near a commit. */
      const secrets = [S.groqKey, gh.token].filter(Boolean);
      const out = [];
      for (const e of edits) {
        const p = String(e.path || "");
        if (!/^src\/[A-Za-z0-9._-]+\.jsx$/.test(p)) throw new Error("Blocked edit outside src/*.jsx: " + p);
        if (e.action !== "update") throw new Error("Blocked non-update action on " + p + " (edits only, no deletions).");
        if (!(p in current)) current[p] = (await getFileSha(gh, p)).content;
        const find = String(e.find || ""), replace = String(e.replace || "");
        if (!find) throw new Error("Empty find snippet for " + p + ".");
        if (current[p].indexOf(find) === -1) throw new Error("The find snippet wasn't found in " + p + " — the app may have changed. Ask me to try again.");
        const next = current[p].replace(find, replace);
        if (secrets.some((k) => next.includes(k))) throw new Error("Blocked: the edit would include a secret token. Refusing to commit.");
        current[p] = next;
        out.push({ path: p, content: next });
      }

      await commitFiles(gh, "AI CEO self-edit: " + summary, out);
      const note = "✅ Committed to " + gh.owner + "/" + gh.repo + " (" + (gh.branch || "main") + "): " + summary + "\nFiles: " + out.map((f) => f.path).join(", ") + "\nVercel redeploys in ~2 min.";
      postReply(note, {
        id: uid(), title: "Command Center self-edit", filename: "self-edit-summary.md",
        content: "# AI CEO self-edit\n\n" + note + "\n\n## Replacements\n" + edits.map((e) => "### " + e.path + "\nFIND:\n" + e.find + "\n\nREPLACE:\n" + e.replace).join("\n\n"),
      });
      up((s) => ({ ...s, chat: [...s.chat, fleetChatMsg("GitHub Sync", "🔧 AI CEO self-edit committed: " + summary + " → " + out.map((f) => f.path).join(", ") + ". Vercel redeploys in ~2 min.")].slice(-CHAT_CAP) }));
      log("system", "AI CEO self-edit committed: " + summary + " (" + out.map((f) => f.path).join(", ") + ")");
    } catch (e) {
      postReply("Self-edit failed: " + (e && e.message ? e.message : "unknown error") + "\nNothing was committed.");
      log("system", "AI CEO self-edit failed: " + (e && e.message ? e.message : "unknown error"));
    } finally {
      setBusy(false);
    }
  }

  /* ---------- Attachments ("+" menu) ---------- */
  const ATTACH_TEXT_EXT = ["txt", "md", "csv", "json", "js", "jsx", "html", "css", "xml", "log"];
  const ATTACH_MAX_FILES = 5;
  const ATTACH_MAX_BYTES = 2 * 1024 * 1024;
  const fmtSize = (n) => (n >= 1048576 ? (n / 1048576).toFixed(1) + " MB" : n >= 1024 ? Math.round(n / 1024) + " KB" : (n || 0) + " B");

  function addFiles(list) {
    const files = Array.from(list || []);
    if (!files.length) return;
    setError("");
    const room = ATTACH_MAX_FILES - attachments.length;
    if (room <= 0) { setError("You can attach up to " + ATTACH_MAX_FILES + " files at a time. Remove one first."); return; }
    files.slice(0, room).forEach((f) => {
      if (f.size > ATTACH_MAX_BYTES) { setError('"' + f.name + '" is over 2MB — attach smaller files.'); return; }
      const ext = (String(f.name).split(".").pop() || "").toLowerCase();
      const isImage = f.type && f.type.startsWith("image/");
      const isText = ATTACH_TEXT_EXT.includes(ext) || (f.type && f.type.startsWith("text/") && f.size < 200 * 1024);
      if (isImage || isText) {
        const reader = new FileReader();
        reader.onload = () => {
          setAttachments((cur) => {
            if (cur.length >= ATTACH_MAX_FILES) return cur;
            if (isImage) return [...cur, { name: f.name, size: f.size, type: f.type || "image", dataUrl: String(reader.result || "") }];
            return [...cur, { name: f.name, size: f.size, type: f.type || "text/plain", text: String(reader.result || "") }];
          });
        };
        try { if (isImage) reader.readAsDataURL(f); else reader.readAsText(f); } catch (e) { /* file unreadable — skip */ }
      } else {
        setAttachments((cur) => (cur.length >= ATTACH_MAX_FILES ? cur : [...cur, { name: f.name, size: f.size, type: f.type || "file" }]));
      }
    });
    if (files.length > room) setError("Only the first " + room + " file(s) were attached — the cap is " + ATTACH_MAX_FILES + ".");
  }

  function attachLink() {
    const u = linkDraft.trim();
    if (!u) return;
    if (attachments.length >= ATTACH_MAX_FILES) { setError("You can attach up to " + ATTACH_MAX_FILES + " attachments at a time."); return; }
    const url = /^https?:\/\//i.test(u) ? u : "https://" + u;
    let name = url;
    try { name = new URL(url).hostname; } catch (e) { /* keep the raw text as the name */ }
    setAttachments((cur) => (cur.length >= ATTACH_MAX_FILES ? cur : [...cur, { name, size: 0, type: "link", url, text: "Link shared by the user: " + url }]));
    setLinkDraft(""); setShowLink(false); setShowPlus(false);
  }

  async function send(textArg) {
    const atts = attachments;
    let text = (textArg || draft).trim();
    if (atts.length) {
      const block = "\n\n📎 Attachments:\n" + atts.map((a) => {
        const line = "- " + a.name + (a.type === "link" ? " (link)" : " (" + fmtSize(a.size) + ")");
        if (a.dataUrl) return line + "\n[image attached: " + a.name + " — the CEO cannot see image contents yet, describe what you need]";
        if (a.text != null) return line + "\n```\n" + String(a.text).slice(0, 4000) + "\n```";
        return line;
      }).join("\n");
      text = (text || "Please review the attached file(s).") + block;
      setAttachments([]);
      setShowLink(false); setLinkDraft("");
    }
    if (!text || busy) return;
    if (SELF_EDIT_RE.test(text)) { await selfEdit(text); return; }
    setDraft(""); setError("");
    const userMsg = { id: uid(), role: "user", content: text, ts: Date.now(), by: user ? user.name : "", ...(atts.length ? { attachments: atts.map((a) => ({ name: a.name, size: a.size, type: a.type })) } : {}) };
    up((s) => ({ ...s, chat: [...s.chat, userMsg].slice(-CHAT_CAP) }));
    setBusy(true);
    try {
      const history = sanitizeHistory([...S.chat, userMsg].slice(-40));
      const sys = SYSTEM_PROMPT
        + (user ? "\n\nCURRENT USER: You are speaking with " + user.name + " (" + user.role + " at Qimmah Digital). Address them by name when natural." : "")
        + "\n\nLIVE BUSINESS STATE (real, current, from the Command Center):\n" + JSON.stringify(buildSnapshot(S))
        + knowledgeNote(S) + memoryNote(S) + teamNote(S)
        + "\n\n" + TOOL_INSTRUCTIONS;
      const raw = await aiCall(S, sys, history);
      const parsed = parseActions(raw);
      let reply = parsed.clean || raw;
      const aiMsg = { id: uid(), role: "assistant", content: reply, actions: parsed.actions || null, applied: false, links: [], ts: Date.now(), goalOffer: wantsGoal(text) ? text : null };
      const cat = classifyInsight(reply);
      const insight = { id: uid(), cat, text: reply.replace(/[*#_`]/g, "").slice(0, 200), ts: Date.now() };
      up((s) => ({
        ...s,
        chat: [...s.chat, aiMsg].slice(-CHAT_CAP),
        insights: [insight, ...s.insights].slice(0, 40),
      }));
      log("chat", "AI CEO answered " + (user ? user.name : "") + ": " + text.slice(0, 60));
      if (S.autoSpeak) speak(reply);

      /* WORK GETS DONE — if the user asked for a deliverable and the reply
         only talked about it (no deliver_work action), make a second call
         that produces the actual artifact and save it to Results. */
      const alreadyDelivered = (parsed.actions || []).some((a) => a && a.type === "deliver_work");
      if (wantsWork(text) && !alreadyDelivered) {
        try {
          const dsys = SYSTEM_PROMPT
            + "\n\nLIVE BUSINESS STATE (real, current):\n" + JSON.stringify(buildSnapshot(S))
            + "\n\nDELIVERABLE MODE: The delivery fleet (Squad Beta) now produces the COMPLETE finished artifact the user asked for — the full website copy section by section, the full HTML page, the full outreach script, the full proposal, the full plan or the full code. No placeholders, no 'TODO', no talking about the work — the finished work itself, ready to use as-is. "
            + "End your reply with a fenced json block exactly like:\n"
            + "```json\n{\"title\":\"short deliverable title\",\"filename\":\"kebab-case-name.md or .html\",\"content\":\"the COMPLETE file content\"}\n```\n"
            + "Use .html as the filename when the deliverable is a web page. Keep any prose before the json block free of JSON.";
          const dmsgs = [{ role: "user", content: "User request: " + text + "\n\nThe CEO's reply for context: " + reply.slice(0, 900) + "\n\nNow produce the complete deliverable file." }];
          let draw;
          try {
            draw = await aiCall(S, dsys, dmsgs, { model: "groq/compound" });
          } catch (e) {
            const modelErr = e && (e.status === 400 || e.status === 404 || /model|compound|decommissioned|not found/i.test(String(e.detail || "")));
            if (!modelErr || IN_PREVIEW) throw e;
            draw = await aiCall(S, dsys, dmsgs);
          }
          const fence = draw.match(/```json\s*([\s\S]*?)```/) || draw.match(/```\s*(\{[\s\S]*?"content"[\s\S]*?\})\s*```/);
          let d = null;
          if (fence) { try { d = JSON.parse(fence[1]); } catch (e) { /* malformed */ } }
          const content = d && d.content ? String(d.content).slice(0, 60000) : String(draw).slice(0, 60000);
          const title = String((d && d.title) || ("Deliverable: " + text.slice(0, 60))).slice(0, 100);
          const filename = String((d && d.filename) || "deliverable.md").replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 60) || "deliverable.md";
          const hour = new Date().toLocaleString("en", { weekday: "short", hour: "2-digit", minute: "2-digit" });
          const entry = {
            id: uid(), type: "deliverable", topic: title, title, filename, content,
            summary: "Delivered for: \"" + text.slice(0, 120) + "\"",
            hour, squad: "Beta", agent: "Delivery Fleet", cycle: null, ts: Date.now(),
          };
          up((s) => ({
            ...s,
            results: [entry, ...(s.results || [])].slice(0, 200),
            chat: [...s.chat.map((x) => (x.id === aiMsg.id ? { ...x, deliverable: { id: entry.id, title, filename, content } } : x)),
              fleetChatMsg("Squad Beta · Delivery Fleet", "📦 Handed in: " + title + " (" + filename + ") — download it from the card above or the Results tab.")].slice(-CHAT_CAP),
          }));
          log("autopilot", "Work delivered: " + title + " (" + filename + ")");
        } catch (e) { /* deliverable pass failed — the chat reply still stands */ }
      }
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
    "Build a demo website for a new restaurant client — deliver the file now.",
    "Write next month's Army Burger campaign and deliver the copy deck.",
    "Design a logo concept as SVG and hand me the file.",
    "Plan the path from OMR 4,800 to OMR 19,800 monthly.",
  ];

  /* --- API key setup screen (deployed mode only; preview runs keyless) --- */
  if (!S.groqKey && !IN_PREVIEW) {
    return (
      <div>
        <SectionTitle eyebrow="AI CEO" title="Activate your AI CEO" sub="The AI CEO runs on Groq — free tier available. Your key is stored only on this device and sent only to Groq." />
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
      <GoalProgressCard log={log} />
      <PendingApprovals log={log} />
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
                {speaking ? "Speaking…" : IN_PREVIEW ? "Online · Claude (preview engine)" : "Online · Groq " + (GROQ_MODEL_LABELS[S.groqModel] ? S.groqModel : "gpt-oss-120b") + ""}
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

        {/* Settings: API keys + voice */}
        {showVoice && (
          <div style={{ padding: 16, borderBottom: "1px solid rgba(255,255,255,0.07)", background: "rgba(124,58,237,0.05)" }}>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "#C4B5FD", marginBottom: 10 }}>Settings</div>
            <div style={{ marginBottom: 14, padding: 12, borderRadius: 10, background: "rgba(34,211,238,0.06)", border: "1px solid rgba(34,211,238,0.18)" }}>
              <Field label="Groq API key (powers the CEO Brain)">
                <input style={inputStyle} type="password" placeholder="gsk_... paste a fresh key here anytime" value={S.groqKey}
                  onChange={(e) => up((s) => ({ ...s, groqKey: e.target.value.trim() }))} />
              </Field>
              <div style={{ fontSize: 11.5, marginTop: 6, color: S.groqKey ? "#34D399" : "#F87171" }}>
                {S.groqKey ? "● Key saved — CEO Brain is live" : "○ No key — fleet is running on offline templates"}
              </div>
              <div style={{ fontSize: 11.5, color: "#8B86A3", marginTop: 4 }}>
                Key invalid or expired? Get a fresh free key at console.groq.com → API Keys → Create, paste it here. Stored only on this device, sent only to Groq.
              </div>
              <Field label="AI model (auto falls back if one is retired)">
                <select style={{ ...inputStyle, cursor: "pointer", marginTop: 8 }} value={S.groqModel || ""} onChange={(e) => up((s) => ({ ...s, groqModel: e.target.value }))}>
                  <option value="" style={{ background: "#1a1327" }}>Auto (recommended) — tries the best live model</option>
                  {GROQ_MODELS.map((m) => <option key={m} value={m} style={{ background: "#1a1327" }}>{GROQ_MODEL_LABELS[m] || m}</option>)}
                </select>
              </Field>
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "#C4B5FD", marginBottom: 10, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              Voice settings
              <span style={{ fontSize: 10, letterSpacing: 1, padding: "2px 9px", borderRadius: 20, fontWeight: 700,
                ...(S.elKey
                  ? { color: "#FFB020", background: "rgba(255,176,32,0.12)", border: "1px solid rgba(255,176,32,0.35)" }
                  : voiceEngine === "Browser voice"
                    ? { color: "#8B86A3", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.15)" }
                    : { color: "#34D399", background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.35)" }) }}>
                Engine: {S.elKey ? "ElevenLabs" : (voiceEngine || "Neural (free)")}
              </span>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
              <Field label="ElevenLabs key (optional)">
                <input style={inputStyle} type="password" placeholder="Leave empty — free neural voice is used" value={S.elKey} onChange={(e) => up((s) => ({ ...s, elKey: e.target.value.trim() }))} />
              </Field>
              {S.elKey ? (
                <Field label="Voice preset (ElevenLabs — all female AI voices)">
                  <select style={{ ...inputStyle, cursor: "pointer" }} value={S.elVoice} onChange={(e) => up((s) => ({ ...s, elVoice: e.target.value }))}>
                    <optgroup label="ElevenLabs voices">
                      {Object.keys(VOICE_IDS).map((v) => <option key={v} value={v} style={{ background: "#1a1327" }}>{v}</option>)}
                    </optgroup>
                  </select>
                </Field>
              ) : (
                <Field label="Voice preset (free neural — no key needed)">
                  <select style={{ ...inputStyle, cursor: "pointer" }} value={S.edgeVoice || "Aria"} onChange={(e) => up((s) => ({ ...s, edgeVoice: e.target.value }))}>
                    <optgroup label="Free neural voices (no key)">
                      {Object.keys(EDGE_VOICES).map((v) => <option key={v} value={v} style={{ background: "#1a1327" }}>{v}</option>)}
                    </optgroup>
                  </select>
                </Field>
              )}
            </div>
            <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <Field label={"Speed · " + S.rate.toFixed(1) + "x"}>
                <input type="range" min="0.5" max="2" step="0.1" value={S.rate} onChange={(e) => up((s) => ({ ...s, rate: Number(e.target.value) }))} style={{ width: "100%", accentColor: PURPLE }} />
              </Field>
              <button style={btnGhost} onClick={() => speak("Marhaba Sultan. Qimmah Digital voice system is live and ready.")}><Volume2 size={14} /> Test voice</button>
            </div>
            <div style={{ fontSize: 11.5, color: "#8B86A3", marginTop: 8 }}>
              No ElevenLabs key? You now get a free natural neural voice automatically — no key needed. (Unofficial free Microsoft Edge service.) The speed slider applies to it too. If it's ever unavailable, the built-in browser voice takes over.
              {IN_PREVIEW && " Note: in this preview, ElevenLabs and the /api/tts endpoint are unreachable from the sandbox, so the browser voice is used here. The free neural voice activates after you deploy."}
            </div>
          </div>
        )}

        {/* Messages */}
        <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 12, minHeight: 320, maxHeight: 480 }}>
          {S.chat.length === 0 && (
            <div style={{ textAlign: "center", padding: "30px 10px" }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: "#E9E4FB", marginBottom: 6 }}>Marhaba{user ? ", " + user.name : ""} 👋</div>
              <div style={{ fontSize: 13, color: "#A5A0B8", maxWidth: 400, margin: "0 auto 16px" }}>
                Your AI CEO is live with 60 agents that work in minutes, not days. Ask for a website, a logo, a campaign or a proposal — and get the real file delivered right here, ready to download. Tap the mic and speak, or pick a starter below.
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
              {m.fleet && (
                <div style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 9.5, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", color: CYAN, padding: "2px 8px", borderRadius: 20, background: "rgba(6,182,212,0.1)", border: "1px solid rgba(6,182,212,0.35)", marginBottom: 4 }}>
                  <Radio size={10} /> Fleet · {m.by || "agent"}
                </div>
              )}
              <div style={{
                padding: "10px 14px", borderRadius: 14, fontSize: 14, lineHeight: 1.55, whiteSpace: "pre-wrap",
                ...(m.role === "user"
                  ? { background: "linear-gradient(135deg,#7C3AED,#6D28D9)", color: "#fff", borderBottomRightRadius: 4 }
                  : m.fleet
                    ? { background: "rgba(6,182,212,0.06)", border: "1px solid rgba(6,182,212,0.25)", color: "#D6F3FB", borderBottomLeftRadius: 4 }
                    : { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "#E9E4FB", borderBottomLeftRadius: 4 }),
              }}>
                {m.content}
              </div>
              {m.role === "user" && m.attachments && m.attachments.length > 0 && (
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 6, justifyContent: "flex-end" }}>
                  {m.attachments.map((a, i) => (
                    <span key={i} style={{ fontSize: 10.5, color: "#C4B5FD", background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.35)", borderRadius: 20, padding: "2px 9px", display: "inline-flex", alignItems: "center", gap: 5 }}>
                      {a.type === "link" ? <Link2 size={10} /> : <FileUp size={10} />} {a.name}{a.size ? " · " + fmtSize(a.size) : ""}
                    </span>
                  ))}
                </div>
              )}
              {m.role === "assistant" && m.deliverable && (
                <div style={{ marginTop: 6, padding: 12, borderRadius: 10, background: "rgba(34,211,238,0.08)", border: "1px solid rgba(34,211,238,0.35)" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "#22D3EE", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
                    <FileCheck2 size={13} /> Work delivered
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#F5F3FF", marginBottom: 2 }}>{m.deliverable.title}</div>
                  <div style={{ fontSize: 11, color: "#8B86A3", marginBottom: 8 }}>{m.deliverable.filename} · saved in the Results tab</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <button style={{ ...btnPrimary, padding: "7px 14px", fontSize: 12.5 }}
                      onClick={() => { try { downloadFile(m.deliverable.filename, m.deliverable.content, deliverableMime(m.deliverable.filename)); log("system", "Deliverable downloaded: " + m.deliverable.filename); } catch (err) { /* download unavailable */ } }}>
                      <Download size={13} /> Download {m.deliverable.filename}
                    </button>
                    {go && (
                      <button style={{ ...btnGhost, padding: "7px 14px", fontSize: 12.5 }} onClick={() => go("results")}>
                        Open in Results
                      </button>
                    )}
                  </div>
                </div>
              )}
              {m.role === "assistant" && m.goalOffer && !m.fleet && (
                <GoalOffer prompt={m.goalOffer} log={log} />
              )}
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
                      {m.links.map((l, i) => <a key={i} href={l.href} download={l.download || null} target="_blank" rel="noreferrer" style={{ ...btnGhost, fontSize: 12, textDecoration: "none" }}><Send size={12} /> {l.label}</a>)}
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

        {/* Attachment chips — shown above the input row */}
        {attachments.length > 0 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", padding: "10px 14px", borderTop: "1px solid rgba(255,255,255,0.07)" }}>
            {attachments.map((a, i) => (
              <span key={a.name + ":" + i} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "#E9E4FB", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 20, padding: "4px 8px" }}>
                {a.dataUrl
                  ? <img src={a.dataUrl} alt="" style={{ width: 20, height: 20, borderRadius: 5, objectFit: "cover" }} />
                  : a.type === "link"
                    ? <Link2 size={12} style={{ color: CYAN, flexShrink: 0 }} />
                    : <FileUp size={12} style={{ color: CYAN, flexShrink: 0 }} />}
                <span style={{ maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.name}</span>
                <span style={{ color: "#8B86A3", fontSize: 10.5 }}>{a.type === "link" ? "link" : fmtSize(a.size)}</span>
                <button onClick={() => setAttachments((cur) => cur.filter((_, x) => x !== i))} title="Remove"
                  style={{ background: "none", border: "none", color: "#8B86A3", cursor: "pointer", padding: 0, display: "flex", flexShrink: 0 }}><X size={11} /></button>
              </span>
            ))}
          </div>
        )}

        {/* Composer */}
        <div style={{ display: "flex", gap: 10, padding: 14, borderTop: attachments.length ? "none" : "1px solid rgba(255,255,255,0.07)", alignItems: "center", position: "relative" }}>
          {/* Hidden file pickers for the "+" menu */}
          <input ref={camRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }}
            onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
          <input ref={photoRef} type="file" accept="image/*" multiple style={{ display: "none" }}
            onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
          <input ref={filePickRef} type="file" multiple style={{ display: "none" }}
            onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
          {/* "+" connectors sheet (Kimi-style) */}
          {showPlus && (
            <div>
              <div onClick={() => { setShowPlus(false); setShowLink(false); }} style={{ position: "fixed", inset: 0, zIndex: 15 }} />
              <div style={{ position: "absolute", bottom: 76, left: 14, zIndex: 20, width: 320, maxWidth: "calc(100vw - 40px)", ...glass, background: "rgba(15,10,26,0.96)", padding: 12, boxShadow: "0 12px 40px rgba(0,0,0,0.5)" }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 10 }}>
                  {[
                    { icon: Camera, label: "Camera", fn: () => { setShowPlus(false); if (camRef.current) camRef.current.click(); } },
                    { icon: Image, label: "Photos", fn: () => { setShowPlus(false); if (photoRef.current) photoRef.current.click(); } },
                    { icon: FileUp, label: "Local file", fn: () => { setShowPlus(false); if (filePickRef.current) filePickRef.current.click(); } },
                    { icon: Link2, label: "Paste link", fn: () => setShowLink(!showLink) },
                  ].map((t) => (
                    <button key={t.label} onClick={t.fn}
                      style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "12px 4px", borderRadius: 12, background: "rgba(255,255,255,0.05)", border: "1px solid " + (t.label === "Paste link" && showLink ? "rgba(6,182,212,0.45)" : "rgba(255,255,255,0.1)"), cursor: "pointer", fontFamily: "inherit", fontSize: 11, color: "#E9E4FB" }}>
                      <t.icon size={18} style={{ color: CYAN }} />
                      {t.label}
                    </button>
                  ))}
                </div>
                {showLink && (
                  <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                    <input style={{ ...inputStyle, padding: "8px 10px", fontSize: 12.5 }} placeholder="https://…" value={linkDraft} autoFocus
                      onChange={(e) => setLinkDraft(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") attachLink(); }} />
                    <button style={{ ...btnPrimary, padding: "8px 12px", fontSize: 12.5 }} onClick={attachLink}>Attach</button>
                  </div>
                )}
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {[
                    { icon: Plug, title: "Plugins", sub: "Open the Integrations Hub and connect apps", fn: () => { setShowPlus(false); setShowLink(false); if (go) go("integrations"); } },
                    { icon: Target, title: "Skills", sub: "Reuse a playbook to handle tasks reliably", fn: () => { setShowPlus(false); setShowLink(false); setShowSkills(true); } },
                    { icon: Flag, title: "Goal", sub: "Set a goal — the CEO keeps working until it's done", fn: () => { setShowPlus(false); setShowLink(false); setDraft("Goal: "); if (inputRef.current) inputRef.current.focus(); } },
                  ].map((r) => (
                    <button key={r.title} onClick={r.fn}
                      style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "9px 10px", borderRadius: 10, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
                      <span style={{ width: 30, height: 30, borderRadius: 9, background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.35)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <r.icon size={14} style={{ color: "#A78BFA" }} />
                      </span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#E9E4FB" }}>{r.title}</span>
                        <span style={{ display: "block", fontSize: 11, color: "#8B86A3", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.sub}</span>
                      </span>
                      <ChevronRight size={14} style={{ color: "#6B6685", flexShrink: 0 }} />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
          {showSkills && (
            <div style={{ position: "absolute", bottom: 76, left: 14, right: 14, zIndex: 20, ...glass, background: "rgba(15,10,26,0.96)", padding: 12, maxHeight: 300, overflowY: "auto" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: CYAN, display: "flex", alignItems: "center", gap: 6 }}>
                  <Target size={12} /> Skills Registry — start a Goal
                </div>
                <button style={{ background: "none", border: "none", color: "#8B86A3", cursor: "pointer", padding: 0 }} onClick={() => setShowSkills(false)}><X size={14} /></button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {SKILL_CATALOG.map((sk) => (
                  <button key={sk.name} style={{ ...btnGhost, justifyContent: "flex-start", textAlign: "left", padding: "8px 12px" }}
                    onClick={() => { setDraft(sk.prompt); setShowSkills(false); }}>
                    <span>
                      <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#E9E4FB" }}>{sk.label}</span>
                      <span style={{ display: "block", fontSize: 11, color: "#8B86A3" }}>{sk.desc}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <button onClick={() => { if (busy) return; setShowPlus(!showPlus); setShowLink(false); setShowSkills(false); }} disabled={busy}
            title="Attach files, links, plugins, skills and goals"
            style={{
              ...btnGhost, padding: 0, width: 44, height: 44, borderRadius: "50%", flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center", cursor: busy ? "not-allowed" : "pointer",
              ...(showPlus ? { color: CYAN, borderColor: "rgba(6,182,212,0.45)" } : {}),
            }}>
            <Plus size={19} />
          </button>
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
            ref={inputRef}
            style={{ ...inputStyle, flex: 1 }} placeholder={listening ? "Listening…" : "Ask your AI CEO anything…"}
            value={draft} onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") send(); }}
          />
          <button style={{ ...btnGhost, padding: "12px 14px", ...(showSkills ? { color: CYAN, borderColor: "rgba(6,182,212,0.45)" } : {}) }}
            title="Skills Registry — 8 goal playbooks" onClick={() => { setShowSkills(!showSkills); setShowPlus(false); setShowLink(false); }}>
            <Target size={16} />
          </button>
          <button style={{ ...btnPrimary, padding: "12px 16px" }} onClick={() => send()} disabled={busy}>
            <Send size={16} />
          </button>
        </div>
      </div>

      {/* Insights panel */}
      <div style={{ flex: "0 1 280px", minWidth: 240 }}>
        <Card style={{ height: "100%" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: "#C4B5FD" }}>
              Extracted insights
              {(S.memory || []).length > 0 && <span style={{ marginLeft: 8, fontSize: 10, letterSpacing: 0.5, color: "#34D399", textTransform: "none" }}>+ {(S.memory || []).length} long-term {(S.memory || []).length === 1 ? "memory" : "memories"}</span>}
            </div>
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
