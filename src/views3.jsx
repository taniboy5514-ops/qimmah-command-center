import { useState, useMemo } from "react";
import { Plus, Trash2, Brain, Download, ExternalLink, Send, Radio, CheckCircle2, Circle, Copy, Sparkles, MessageSquareText, Github, Video, ShieldCheck } from "lucide-react";
import { PURPLE, CYAN, AGENTS, glass, inputStyle, btnPrimary, btnGhost, Card, SectionTitle, Stat, Empty, Field, uid, omr, timeAgo, lastMonths, monthLabel, REVENUE_TARGET, SQUAD_META, SYSTEM_PROMPT, buildSnapshot, aiCall, IN_PREVIEW, BackupControls, TOOL_CATALOG, MCP_LIMITS_NOTE } from "./shared.jsx";
import { testGhConnection } from "./github-sync.js";
import { resultMarkdown } from "./autopilot.jsx";
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

export function Analytics({ S }) {
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

/* Scenario Mode — three paths to the OMR 19,800/mo target, computed from
   editable deal economics. Works from day one, before any income history. */
function scenarioPaths(web, ret, closeRate) {
  const w = Math.max(0, Number(web) || 0), r = Math.max(0, Number(ret) || 0);
  const cr = Math.min(100, Math.max(1, Number(closeRate) || 1)) / 100;
  const mk = (name, color, webDeals, retClients, months) => {
    const steady = retClients * r + w * (webDeals / Math.max(1, months)); // recurring retainers + websites amortized over the path
    const pitchesPerWeek = Math.ceil(((webDeals + retClients) / Math.max(1, months * 4.33)) / cr);
    return {
      name, color, months,
      webDeals, retClients,
      dealsPerWeek: Math.max(1, Math.round((webDeals + retClients) / Math.max(1, months * 4.33) * 10) / 10),
      pitchesPerWeek,
      projection: Math.round(steady),
    };
  };
  return [
    mk("Conservative", "#34D399", 8, 40, 12),
    mk("Base", CYAN, 12, 56, 8),
    mk("Aggressive", "#F472B6", 16, 72, 5),
  ].map((p) => ({ ...p, hitsTarget: p.projection >= REVENUE_TARGET }));
}

export function MiroFish({ S, up, log }) {
  const [opp, setOpp] = useState({ segment: "", note: "" });
  const [econ, setEcon] = useState({ web: 400, ret: 250, close: 20 });
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
          {!fc && (
            <div style={{ marginTop: 14, padding: "10px 12px", borderRadius: 10, background: "rgba(6,182,212,0.08)", border: "1px solid rgba(6,182,212,0.25)", fontSize: 12, color: "#A5F3FC", lineHeight: 1.6 }}>
              No trend data yet — so MiroFish is running in <b>Scenario Mode</b> below: three real paths to {omr(REVENUE_TARGET)}/mo computed from your deal economics. Record income and the live forecast takes over automatically.
            </div>
          )}
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

      {/* SCENARIO MODE — three paths to the target, plus a live what-if calculator */}
      <Card glow style={{ marginTop: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: "#C4B5FD" }}>Scenario Mode · paths to {omr(REVENUE_TARGET)}/mo</div>
          {!fc && <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: "rgba(167,139,250,0.15)", color: "#A78BFA", border: "1px solid rgba(167,139,250,0.35)" }}>works from day one</span>}
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
          <Field label="Avg website deal · OMR"><input style={{ ...inputStyle, width: 110 }} inputMode="numeric" value={econ.web} onChange={(e) => setEcon({ ...econ, web: e.target.value.replace(/[^0-9]/g, "") })} /></Field>
          <Field label="Avg retainer · OMR/mo"><input style={{ ...inputStyle, width: 110 }} inputMode="numeric" value={econ.ret} onChange={(e) => setEcon({ ...econ, ret: e.target.value.replace(/[^0-9]/g, "") })} /></Field>
          <Field label={"Close rate · " + econ.close + "%"}>
            <input type="range" min="5" max="60" value={econ.close} onChange={(e) => setEcon({ ...econ, close: Number(e.target.value) })} style={{ width: 140, accentColor: PURPLE }} />
          </Field>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
          {scenarioPaths(econ.web, econ.ret, econ.close).map((p) => (
            <div key={p.name} style={{ ...glass, padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: p.color }}>{p.name}</span>
                <span style={{ fontSize: 10.5, color: "#8B86A3" }}>{p.months} months</span>
              </div>
              <div style={{ fontSize: 12.5, color: "#D8D3E8", lineHeight: 1.8 }}>
                <div>Websites to sell: <b style={{ color: "#F5F3FF" }}>{p.webDeals}</b> × {omr(econ.web)}</div>
                <div>Retainer clients: <b style={{ color: "#F5F3FF" }}>{p.retClients}</b> × {omr(econ.ret)}/mo</div>
                <div>Pace: <b style={{ color: "#F5F3FF" }}>{p.dealsPerWeek} deals/wk</b> · ~{p.pitchesPerWeek} pitches/wk at {econ.close}% close</div>
                <div>Projection: <b style={{ color: p.hitsTarget ? "#34D399" : "#FBBF24" }}>{omr(p.projection)}/mo</b>{p.hitsTarget ? " ▲ target hit" : " (raise deal size or close rate)"}</div>
              </div>
              <div style={{ fontSize: 11, color: "#8B86A3", marginTop: 8, paddingTop: 8, borderTop: "1px solid rgba(255,255,255,0.07)", lineHeight: 1.6 }}>
                Squad Alpha hunts the {p.dealsPerWeek} weekly deals · Beta delivers websites in days · Gamma tracks close rates · Delta automates onboarding · Epsilon upgrades the offer.
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 12, fontSize: 12, color: "#8B86A3", lineHeight: 1.6 }}>
          What-if is live: move the close-rate slider or edit the OMR deal sizes and every path recomputes instantly. When real income history exists, this sits under the live forecast.
        </div>
      </Card>
    </div>
  );
}

/* ============================================================
   CEO BRAIN — Study Mode: the CEO studies any topic on the open
   web (Groq Compound, built-in web search), saves a structured
   brief with sources into the knowledge base, and the whole
   brain can be exported to disk (JSON + MD).
   ============================================================ */
export function downloadFile(name, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function buildBrainMarkdown(S) {
  const k = S.knowledge || [];
  const snap = buildSnapshot(S);
  let md = "# Qimmah Digital — CEO Brain Export\n\n";
  md += "_Exported " + new Date().toLocaleString() + " · Qimmah Digital CEO Command Center_\n\n";
  md += "---\n\n## Knowledge base · " + k.length + " studied topic" + (k.length === 1 ? "" : "s") + "\n\n";
  if (k.length === 0) {
    md += "No topics studied yet. Open CEO Brain → Study Mode to teach the CEO something new.\n\n";
  }
  k.forEach((e, i) => {
    md += "### " + (i + 1) + ". " + e.topic + "\n\n";
    md += "_Studied " + new Date(e.createdAt).toLocaleString() + " · " + (e.web ? "live web research" : "trained knowledge") + "_\n\n";
    if (e.summary) md += e.summary + "\n\n";
    if (e.keyPoints && e.keyPoints.length) {
      md += "Key points:\n";
      e.keyPoints.forEach((p) => { md += "- " + p + "\n"; });
      md += "\n";
    }
    if (e.actions && e.actions.length) {
      md += "Recommended actions for Qimmah Digital:\n";
      e.actions.forEach((a) => { md += "- " + a + "\n"; });
      md += "\n";
    }
    if (e.sources && e.sources.length) {
      md += "Sources:\n";
      e.sources.forEach((src) => { md += "- [" + src.title + "](" + src.url + ")\n"; });
      md += "\n";
    }
  });
  md += "---\n\n## Extracted insights · " + S.insights.length + "\n\n";
  if (S.insights.length === 0) md += "None yet — insights are pulled from every AI CEO answer.\n";
  S.insights.forEach((i) => { md += "- **[" + i.cat + "]** " + i.text + " _(" + timeAgo(i.ts) + ")_\n"; });
  md += "\n---\n\n## Business snapshot · " + snap.month + "\n\n";
  md += "- Income this month: " + omr(snap.incomeThisMonthOMR) + " (target " + omr(snap.monthlyTargetOMR) + ")\n";
  md += "- Expenses this month: " + omr(snap.expensesThisMonthOMR) + "\n";
  md += "- Unpaid invoices: " + snap.unpaidInvoices.length + "\n";
  md += "- Tasks — backlog: " + snap.tasks.backlog.length + ", in progress: " + snap.tasks.inProgress.length + ", review: " + snap.tasks.review.length + ", done: " + snap.tasks.doneCount + "\n";
  md += "- Active agents: " + snap.activeAgents + " / 60\n";
  md += "- New website leads: " + snap.websiteLeads.newCount + "\n";
  md += "- CEO conversations on record: " + S.chat.filter((m) => m.role === "user").length + "\n";
  return md;
}

export function Study({ S, up, log, user, exportBrain, exportBackup, importBackup }) {
  const [topic, setTopic] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const knowledge = S.knowledge || [];
  /* The brain also learns on its own: hourly autopilot study briefs and the
     squad cycle's CEO Brain Full Studies live in S.results — surface them here
     so the knowledge base visibly fills as the fleet works. */
  const fleetStudies = (S.results || []).filter((r) => r.type === "study" || r.type === "squad-study" || r.type === "meta");
  const isOwner = user && user.role === "owner";

  async function study() {
    const t = topic.trim();
    if (!t || busy) return;
    setBusy(true); setError("");
    try {
      const sys = SYSTEM_PROMPT
        + "\n\nLIVE BUSINESS STATE (real, current, from the Command Center):\n" + JSON.stringify(buildSnapshot(S));
      const brief = "Write a tight study brief: what the topic is, why it matters for an Omani digital agency, and how Qimmah Digital can use it this month. "
        + "Then end your reply with a fenced json block exactly like:\n"
        + "```json\n{\"summary\":\"2-4 sentence executive summary\",\"keyPoints\":[\"point 1\",\"point 2\",\"point 3\",\"point 4\",\"point 5\"],\"actions\":[\"recommended action for Qimmah Digital 1\",\"action 2\",\"action 3\"]}\n```\n"
        + "Keep the prose before the json block free of JSON.";
      const webPrompt = "STUDY MODE (live web). The founder asked you to study this topic: \"" + t + "\".\n"
        + "Search the open web for current facts, prices, trends and examples before you answer — prefer sources from 2025-2026. Mention what you found online. " + brief;
      const offlinePrompt = "STUDY MODE. The founder asked you to study this topic: \"" + t + "\".\n"
        + "Honest constraint: live web search was unavailable for this run — study from your trained knowledge and say so in one short line at the start. " + brief;
      // Groq Compound has built-in web search, so the CEO can genuinely study
      // the open web with the same key. If the key/model can't run Compound
      // (model error), fall back to the standard model gracefully.
      let raw = "", sources = [], web = !IN_PREVIEW;
      try {
        const out = await aiCall(S, sys, [{ role: "user", content: webPrompt }], { model: "groq/compound", full: true });
        raw = out.reply; sources = out.sources;
      } catch (e) {
        const modelErr = e && (e.status === 400 || e.status === 404 || /model|compound|decommissioned|not found/i.test(String(e.detail || "")));
        if (!modelErr || IN_PREVIEW) throw e;
        web = false;
        raw = await aiCall(S, sys, [{ role: "user", content: offlinePrompt }]);
      }
      // If Compound didn't expose tool results, fall back to links cited in text.
      if (sources.length === 0) {
        const linkRe = /\[([^\]]{1,140})\]\((https?:\/\/[^\s)]+)\)/g;
        let m;
        while ((m = linkRe.exec(raw)) && sources.length < 8) {
          if (!sources.some((x) => x.url === m[2])) sources.push({ title: m[1], url: m[2] });
        }
      }
      let summary = "", keyPoints = [], actions = [], clean = raw;
      const fence = raw.match(/```json\s*([\s\S]*?)```/) || raw.match(/```\s*(\{[\s\S]*?"summary"[\s\S]*?\})\s*```/);
      if (fence) {
        try {
          const p = JSON.parse(fence[1]);
          summary = String(p.summary || "").slice(0, 1200);
          keyPoints = (Array.isArray(p.keyPoints) ? p.keyPoints : []).map((x) => String(x).slice(0, 300)).filter(Boolean).slice(0, 10);
          actions = (Array.isArray(p.actions) ? p.actions : []).map((x) => String(x).slice(0, 300)).filter(Boolean).slice(0, 8);
          clean = raw.replace(fence[0], "").trim();
        } catch (e) { /* malformed block: fall back to raw text as the summary */ }
      }
      if (!summary) summary = (clean || raw).replace(/[*#_`]/g, "").slice(0, 600);
      const entry = { id: uid(), topic: t.slice(0, 120), summary, keyPoints, actions, sources, web, source: web ? "web study" : "study", createdAt: Date.now() };
      const aiMsg = { id: uid(), role: "assistant", content: "📚 Study brief — " + entry.topic + (web ? " (live web research)" : "") + "\n\n" + (clean || summary), actions: null, applied: false, links: sources.map((x) => ({ kind: "Source", href: x.url, label: x.title })), ts: Date.now() };
      up((s) => ({ ...s, knowledge: [entry, ...(s.knowledge || [])], chat: [...s.chat, aiMsg] }));
      log("study", "CEO studied: " + entry.topic + (web ? " (live web)" : " (offline)"));
      setTopic("");
    } catch (e) {
      const msg = e && e.message ? e.message : "";
      setError(msg === "Failed to fetch" || !msg ? "Couldn't reach the AI engine. Check your internet connection and try again." : msg);
    } finally {
      setBusy(false);
    }
  }

  if (!S.groqKey && !IN_PREVIEW) {
    return (
      <div>
        <SectionTitle eyebrow="CEO Brain" title="Study Mode" sub="The CEO needs its AI engine before it can study." />
        <Card glow style={{ maxWidth: 520 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <Brain size={20} style={{ color: PURPLE }} />
            <div style={{ fontWeight: 600, fontSize: 15 }}>Connect Groq first</div>
          </div>
          <div style={{ fontSize: 13.5, color: "#B8B3CC", lineHeight: 1.7 }}>
            Study Mode runs on the same Groq key as the AI CEO chat. Open the <b style={{ color: "#E9E4FB" }}>AI CEO</b> tab, paste your free key from console.groq.com, then come back and the brain wakes up.
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <SectionTitle eyebrow="CEO Brain" title="Study Mode" sub="Give the CEO any topic — a market, a tool, a competitor, a trend. It researches the live web (Groq Compound), saves a structured brief with sources into its permanent knowledge base, and posts the brief to your AI CEO chat." />
      <Card glow style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
          <Field label="Topic to study">
            <input style={inputStyle} placeholder="e.g. Short-form video trends for Omani restaurants"
              value={topic} onChange={(e) => setTopic(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") study(); }} />
          </Field>
          <button style={btnPrimary} onClick={study} disabled={busy || !topic.trim()}>
            <Brain size={15} /> {busy ? "Studying…" : "Study this"}
          </button>
          {isOwner && (
            <button style={{ ...btnGhost, borderColor: "rgba(6,182,212,0.4)", color: CYAN }} onClick={exportBrain}
              title="Download the full CEO brain as JSON + a readable Markdown report">
              <Download size={14} /> Export Brain
            </button>
          )}
          {isOwner && exportBackup && <BackupControls S={S} onExport={exportBackup} onImport={importBackup} />}
        </div>
        <div style={{ fontSize: 11.5, color: "#8B86A3", marginTop: 10, lineHeight: 1.6 }}>
          The CEO researches the live open web via Groq Compound (web search built in — no extra keys, same free Groq key). If web search is unavailable on your key, it falls back to its trained knowledge and says so. Export Brain downloads two files (JSON backup + readable report). Saved to your Downloads — move it to your Desktop.
        </div>
        {error && <div style={{ marginTop: 12, padding: "10px 14px", borderRadius: 10, background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", color: "#FCA5A5", fontSize: 13 }}>{error}</div>}
      </Card>

      {knowledge.length === 0 && fleetStudies.length === 0
        ? <Empty icon={Brain} title="The brain is empty — teach it something" body="Study your first topic above, or let the fleet work — hourly autopilot studies and squad-cycle Full Studies land here automatically as the 60 agents learn." />
        : <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: "#C4B5FD" }}>
              Knowledge base · {knowledge.length} topic{knowledge.length === 1 ? "" : "s"} studied
            </div>
            {knowledge.map((e) => (
              <Card key={e.id}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#F5F3FF" }}>{e.topic}</div>
                    <div style={{ fontSize: 10.5, color: "#6B6685", marginTop: 2, textTransform: "uppercase", letterSpacing: 1, display: "flex", alignItems: "center", gap: 6 }}>
                      {e.web && <span style={{ color: CYAN, border: "1px solid rgba(6,182,212,0.4)", borderRadius: 20, padding: "1px 7px", fontSize: 9.5 }}>live web</span>}
                      {e.source} · {timeAgo(e.createdAt)}
                    </div>
                  </div>
                  <button style={{ background: "none", border: "none", cursor: "pointer", color: "#6B6685", padding: 2 }}
                    onClick={() => { up((s) => ({ ...s, knowledge: (s.knowledge || []).filter((x) => x.id !== e.id) })); log("study", "Knowledge entry removed: " + e.topic); }}>
                    <Trash2 size={14} />
                  </button>
                </div>
                {e.summary && <div style={{ fontSize: 13, color: "#C9C4DC", lineHeight: 1.65, marginBottom: 10, whiteSpace: "pre-wrap" }}>{e.summary}</div>}
                {e.keyPoints && e.keyPoints.length > 0 && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: CYAN, marginBottom: 5 }}>Key points</div>
                    <div style={{ fontSize: 12.5, color: "#D8D3E8", lineHeight: 1.7 }}>
                      {e.keyPoints.map((p, i) => <div key={i}>{"\u2022"} {p}</div>)}
                    </div>
                  </div>
                )}
                {e.actions && e.actions.length > 0 && (
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "#FFB020", marginBottom: 5 }}>Recommended actions</div>
                    <div style={{ fontSize: 12.5, color: "#D8D3E8", lineHeight: 1.7 }}>
                      {e.actions.map((a, i) => <div key={i}>{"\u2192"} {a}</div>)}
                    </div>
                  </div>
                )}
                {e.sources && e.sources.length > 0 && (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "#A78BFA", marginBottom: 5 }}>Sources from the web</div>
                    <div style={{ fontSize: 12.5, lineHeight: 1.7 }}>
                      {e.sources.map((src, i) => (
                        <div key={i}>
                          <a href={src.url} target="_blank" rel="noreferrer" style={{ color: CYAN, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}>
                            <ExternalLink size={11} /> {src.title}
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            ))}
          </div>}

      {/* Fleet learning — hourly autopilot studies + squad-cycle Full Studies */}
      {fleetStudies.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 18 }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: "#C4B5FD" }}>
            Fleet learning · {fleetStudies.length} automatic stud{fleetStudies.length === 1 ? "y" : "ies"}
          </div>
          <div style={{ fontSize: 11.5, color: "#8B86A3", marginTop: -6, lineHeight: 1.6 }}>
            Saved automatically by the hourly autopilot and the 10–15 min squad report cycle — the same cards as the Results tab, with a .md download.
          </div>
          {fleetStudies.map((r) => <FleetStudyCard key={r.id} r={r} log={log} />)}
        </div>
      )}
    </div>
  );
}

/* One fleet-study card in the CEO Brain — same styling as the knowledge-base
   cards, labeled by origin (Autopilot study / Squad Full Study / Method review). */
const FLEET_STUDY_LABEL = {
  study: { label: "Autopilot study", c: "#A78BFA" },
  "squad-study": { label: "Squad Full Study", c: "#34D399" },
  meta: { label: "Method review", c: "#FBBF24" },
};

function FleetStudyCard({ r, log }) {
  const tag = FLEET_STUDY_LABEL[r.type] || FLEET_STUDY_LABEL.study;
  const squadColor = SQUAD_META[r.squad] ? SQUAD_META[r.squad].color : "#A78BFA";
  return (
    <Card>
      <div style={{ marginBottom: 8 }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginBottom: 5 }}>
          <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: tag.c + "22", color: tag.c, border: "1px solid " + tag.c + "55", textTransform: "uppercase", letterSpacing: 1 }}>{tag.label}</span>
          <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: squadColor + "22", color: squadColor, border: "1px solid " + squadColor + "55", textTransform: "uppercase", letterSpacing: 1 }}>Squad {r.squad}</span>
          {r.offline && <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 20, background: "rgba(255,255,255,0.06)", color: "#8B86A3", border: "1px solid rgba(255,255,255,0.12)" }}>offline</span>}
        </div>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#F5F3FF" }}>{r.topic}</div>
        <div style={{ fontSize: 10.5, color: "#6B6685", marginTop: 2, textTransform: "uppercase", letterSpacing: 1 }}>
          {r.hour} · {r.agent} · {timeAgo(r.ts)}
        </div>
      </div>
      {r.summary && <div style={{ fontSize: 13, color: "#C9C4DC", lineHeight: 1.65, marginBottom: 10, whiteSpace: "pre-wrap" }}>{r.summary}</div>}
      {r.insights && r.insights.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: CYAN, marginBottom: 5 }}>{r.type === "squad-study" ? "Findings & insights" : "Key points"}</div>
          <div style={{ fontSize: 12.5, color: "#D8D3E8", lineHeight: 1.7 }}>
            {r.insights.map((p, i) => <div key={i}>{"\u2022"} {p}</div>)}
          </div>
        </div>
      )}
      {r.directives && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "#34D399", marginBottom: 5 }}>CEO Brain directives{r.cycleId ? " · " + r.cycleId : ""}</div>
          <div style={{ fontSize: 12.5, color: "#D8D3E8", lineHeight: 1.7 }}>
            {Object.entries(r.directives).map(([sq, d]) => <div key={sq}>{"\u2192"} <b style={{ color: (SQUAD_META[sq] || {}).color || "#A78BFA" }}>Squad {sq}:</b> {d}</div>)}
          </div>
        </div>
      )}
      {r.action && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "#FFB020", marginBottom: 5 }}>Recommended action</div>
          <div style={{ fontSize: 12.5, color: "#D8D3E8", lineHeight: 1.7 }}>{"\u2192"} {r.action}</div>
        </div>
      )}
      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
        <button style={btnGhost} onClick={() => { try { downloadFile("qimmah-brain-" + (r.type || "study") + "-" + new Date(r.ts).toISOString().slice(0, 16).replace(/[:T]/g, "-") + ".md", resultMarkdown(r), "text/markdown"); if (log) log("system", "Brain study downloaded: " + String(r.topic || "").slice(0, 50)); } catch (err) { /* download unavailable */ } }}>
          <Download size={13} /> Download .md
        </button>
      </div>
    </Card>
  );
}

/* ============================================================
   DM GHOSTWRITER — the CEO Brain studies Sultan's real voice from
   messages he actually sent, then drafts DMs in that voice.
   Honest label: drafts ready to copy & send — no fake automation.
   ============================================================ */
const DM_GOALS = ["Reply to inquiry", "Follow up", "Close deal", "Upsell"];

export function DMGhostwriter({ S, up, log }) {
  const style = S.dmStyle || { samples: [], profile: "" };
  const drafts = S.dmDrafts || [];
  const [sample, setSample] = useState("");
  const [learnBusy, setLearnBusy] = useState(false);
  const [draftBusy, setDraftBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");
  const [form, setForm] = useState({ platform: "WhatsApp", who: "", goal: DM_GOALS[0], context: "", waNumber: "" });

  function addSample() {
    const t = sample.trim();
    if (t.length < 10) return;
    up((s) => ({ ...s, dmStyle: { ...(s.dmStyle || { samples: [], profile: "" }), samples: [...((s.dmStyle || {}).samples || []), t].slice(-12) } }));
    setSample("");
    log("system", "DM style sample added (" + t.length + " chars)");
  }

  async function learnStyle() {
    if (learnBusy || style.samples.length < 3) return;
    setLearnBusy(true); setError("");
    try {
      const sys = "You are a writing-style analyst. Study the example messages below — they are real messages Sultan (founder of Qimmah Digital, Oman) sent to clients and leads. "
        + "Summarize his voice into a compact style profile (max 180 words) covering: language mix (English/Arabic words he uses), tone, emoji use (which ones, how often), typical length, how he greets, how he closes, how he talks about pricing and OMR amounts, and any signature phrases. "
        + "Write it as direct instructions a ghostwriter can follow, e.g. \"Open with Marhaba + first name, keep it under 4 lines…\".";
      const profile = await aiCall(S, sys, [{ role: "user", content: "Sultan's real messages:\n\n" + style.samples.map((m, i) => (i + 1) + ". " + m).join("\n") }]);
      up((s) => ({ ...s, dmStyle: { ...(s.dmStyle || { samples: [] }), profile: profile.trim().slice(0, 1200) } }));
      log("system", "DM Ghostwriter learned Sultan's style from " + style.samples.length + " samples");
    } catch (e) {
      setError(e && e.message ? e.message : "Style learning failed — try again.");
    } finally {
      setLearnBusy(false);
    }
  }

  async function writeDM() {
    if (draftBusy || !form.who.trim()) return;
    setDraftBusy(true); setError("");
    try {
      const sys = "You are the DM Ghostwriter for Sultan, founder of Qimmah Digital (Oman). You write DMs in HIS exact voice — not generic sales copy.\n\n"
        + "STYLE PROFILE (learned from his real messages):\n" + (style.profile || "No learned profile yet — infer his voice from the samples below.")
        + (style.samples.length ? "\n\nHIS REAL MESSAGE SAMPLES:\n" + style.samples.map((m, i) => (i + 1) + ". " + m).join("\n") : "")
        + "\n\nRULES: Match his language mix, emoji habits, length, greeting and closing exactly. Never sound like a marketing bot. Platform: " + form.platform + ". "
        + "End your reply with a fenced json block exactly like:\n```json\n{\"variants\":[\"variant 1\",\"variant 2\",\"variant 3\"]}\n```\nKeep any prose before the json block free of JSON.";
      const prompt = "Write 3 DM variants in Sultan's voice.\nPlatform: " + form.platform
        + "\nWho this person is: " + form.who.trim()
        + "\nGoal: " + form.goal
        + (form.context.trim() ? "\nContext: " + form.context.trim() : "")
        + "\nEach variant ready to paste and send as-is.";
      const raw = await aiCall(S, sys, [{ role: "user", content: prompt }]);
      const fence = raw.match(/```json\s*([\s\S]*?)```/) || raw.match(/```\s*(\{[\s\S]*?"variants"[\s\S]*?\})\s*```/);
      let variants = null;
      if (fence) { try { const p = JSON.parse(fence[1]); if (Array.isArray(p.variants)) variants = p.variants; } catch (e) { /* malformed */ } }
      if (!variants || !variants.length) variants = [raw.replace(/```[\s\S]*?```/g, "").trim()];
      const entry = {
        id: uid(), platform: form.platform, who: form.who.trim().slice(0, 80), goal: form.goal,
        variants: variants.slice(0, 3).map((v) => ({ text: String(v).slice(0, 900), copies: 0 })),
        ts: Date.now(),
      };
      up((s) => ({ ...s, dmDrafts: [entry, ...(s.dmDrafts || [])].slice(0, 50) }));
      log("system", "DM Ghostwriter drafted " + entry.variants.length + " " + form.platform + " messages (" + form.goal.toLowerCase() + ")");
    } catch (e) {
      setError(e && e.message ? e.message : "Drafting failed — try again.");
    } finally {
      setDraftBusy(false);
    }
  }

  function copyVariant(draftId, idx, text) {
    try {
      navigator.clipboard.writeText(text);
      setCopied(draftId + ":" + idx);
      setTimeout(() => setCopied(""), 1500);
      up((s) => ({
        ...s,
        dmDrafts: (s.dmDrafts || []).map((d) => d.id === draftId
          ? { ...d, variants: d.variants.map((v, i) => (i === idx ? { ...v, copies: (v.copies || 0) + 1 } : v)) }
          : d),
      }));
    } catch (e) { /* clipboard blocked */ }
  }

  const waNum = form.waNumber.replace(/[^0-9]/g, "");

  return (
    <Card glow style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <MessageSquareText size={18} style={{ color: CYAN }} />
        <div style={{ fontWeight: 700, fontSize: 15 }}>DM Ghostwriter</div>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "#FBBF24", padding: "2px 8px", borderRadius: 20, background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.3)" }}>
          drafts ready to copy &amp; send
        </span>
      </div>
      <p style={{ fontSize: 12.5, color: "#A5A0B8", margin: "0 0 16px", lineHeight: 1.6 }}>
        The CEO Brain studies messages you actually sent and drafts new DMs in your voice. Nothing is sent automatically — you copy the draft and send it yourself.
      </p>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        {/* Step 1 — style learning */}
        <div style={{ flex: "1 1 320px", minWidth: 280 }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: "#C4B5FD", marginBottom: 10 }}>1 · Teach it your voice</div>
          <Field label={"Paste a message you really sent · " + style.samples.length + " saved (need 3+)"}>
            <textarea style={{ ...inputStyle, minHeight: 70, resize: "vertical" }} placeholder="Marhaba Ahmed! Sultan here from Qimmah Digital — about the website we discussed…" value={sample} onChange={(e) => setSample(e.target.value)} />
          </Field>
          <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
            <button style={btnGhost} onClick={addSample} disabled={sample.trim().length < 10}><Plus size={13} /> Add sample</button>
            <button style={{ ...btnPrimary, opacity: style.samples.length >= 3 ? 1 : 0.45 }} onClick={learnStyle} disabled={learnBusy || style.samples.length < 3}>
              <Sparkles size={14} /> {learnBusy ? "Learning your style…" : "Learn my style"}
            </button>
          </div>
          {style.samples.length > 0 && style.samples.length < 3 && (
            <div style={{ fontSize: 11.5, color: "#8B86A3", marginTop: 8 }}>Add {3 - style.samples.length} more sample{3 - style.samples.length === 1 ? "" : "s"} to unlock style learning.</div>
          )}
          {style.samples.length > 0 && (
            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6, maxHeight: 130, overflowY: "auto" }}>
              {style.samples.map((m, i) => (
                <div key={i} style={{ fontSize: 11.5, color: "#B7B2CC", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 8, padding: "6px 10px", display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <span style={{ whiteSpace: "pre-wrap" }}>{m.length > 90 ? m.slice(0, 90) + "…" : m}</span>
                  <button style={{ background: "none", border: "none", color: "#6B6685", cursor: "pointer", padding: 0, flexShrink: 0 }}
                    onClick={() => up((s) => ({ ...s, dmStyle: { ...(s.dmStyle || { samples: [], profile: "" }), samples: ((s.dmStyle || {}).samples || []).filter((_, x) => x !== i) } }))}>
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
          {style.profile ? (
            <div style={{ marginTop: 12 }}>
              <Field label="Your style profile · learned, editable">
                <textarea style={{ ...inputStyle, minHeight: 110, resize: "vertical", fontSize: 12.5, lineHeight: 1.6 }}
                  value={style.profile}
                  onChange={(e) => up((s) => ({ ...s, dmStyle: { ...(s.dmStyle || { samples: [] }), profile: e.target.value.slice(0, 1500) } }))} />
              </Field>
            </div>
          ) : (
            <div style={{ fontSize: 11.5, color: "#8B86A3", marginTop: 10 }}>No style profile yet — paste 3+ real messages and tap "Learn my style".</div>
          )}
        </div>

        {/* Step 2 — drafting */}
        <div style={{ flex: "1 1 320px", minWidth: 280 }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: "#C4B5FD", marginBottom: 10 }}>2 · Draft a message</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Field label="Platform">
              <select style={{ ...inputStyle, cursor: "pointer" }} value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })}>
                {["WhatsApp", "Instagram"].map((p) => <option key={p} value={p} style={{ background: "#1a1327" }}>{p}</option>)}
              </select>
            </Field>
            <Field label="Goal">
              <select style={{ ...inputStyle, cursor: "pointer" }} value={form.goal} onChange={(e) => setForm({ ...form, goal: e.target.value })}>
                {DM_GOALS.map((g) => <option key={g} value={g} style={{ background: "#1a1327" }}>{g}</option>)}
              </select>
            </Field>
          </div>
          <div style={{ marginTop: 10 }}>
            <Field label="Who is this person? (one line)">
              <input style={inputStyle} placeholder="Restaurant owner in Al Khuwair, asked about prices last week" value={form.who} onChange={(e) => setForm({ ...form, who: e.target.value })} />
            </Field>
          </div>
          <div style={{ marginTop: 10 }}>
            <Field label="Context (optional)">
              <textarea style={{ ...inputStyle, minHeight: 54, resize: "vertical" }} placeholder="He liked the Army Burger work, budget around OMR 300/mo…" value={form.context} onChange={(e) => setForm({ ...form, context: e.target.value })} />
            </Field>
          </div>
          {form.platform === "WhatsApp" && (
            <div style={{ marginTop: 10 }}>
              <Field label="Recipient WhatsApp number (for the send button — you have +968 9176 3555)">
                <input style={inputStyle} inputMode="tel" placeholder="968 9XXX XXXX" value={form.waNumber} onChange={(e) => setForm({ ...form, waNumber: e.target.value })} />
              </Field>
            </div>
          )}
          <button style={{ ...btnPrimary, marginTop: 12, opacity: form.who.trim() ? 1 : 0.45 }} onClick={writeDM} disabled={draftBusy || !form.who.trim()}>
            <Sparkles size={14} /> {draftBusy ? "Writing in your voice…" : "Write DM"}
          </button>
          {error && <div style={{ fontSize: 12, color: "#FCA5A5", marginTop: 8 }}>{error}</div>}
          {!style.profile && style.samples.length === 0 && (
            <div style={{ fontSize: 11.5, color: "#8B86A3", marginTop: 8 }}>Tip: drafts work best after you teach it your voice on the left.</div>
          )}
        </div>
      </div>

      {/* Drafts */}
      {drafts.length > 0 && (
        <div style={{ marginTop: 18, borderTop: "1px solid rgba(255,255,255,0.07)", paddingTop: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: "#C4B5FD" }}>Your drafts · {drafts.length}</div>
            <button style={{ background: "none", border: "none", color: "#8B86A3", cursor: "pointer", fontSize: 11.5, fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 4 }}
              onClick={() => up((s) => ({ ...s, dmDrafts: [] }))}><Trash2 size={12} /> Clear all</button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {drafts.map((d) => (
              <div key={d.id} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: 12 }}>
                <div style={{ fontSize: 10.5, color: "#6B6685", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
                  {d.platform} · {d.goal} · to {d.who} · {timeAgo(d.ts)}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {d.variants.map((v, i) => {
                    const waHref = d.platform === "WhatsApp" && waNum.length >= 8
                      ? "https://wa.me/" + waNum + "?text=" + encodeURIComponent(v.text)
                      : null;
                    return (
                      <div key={i} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "10px 12px" }}>
                        <div style={{ fontSize: 13, color: "#E9E4FB", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{v.text}</div>
                        <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap", alignItems: "center" }}>
                          <button style={{ ...btnGhost, padding: "5px 12px", fontSize: 11.5 }} onClick={() => copyVariant(d.id, i, v.text)}>
                            <Copy size={12} /> {copied === d.id + ":" + i ? "Copied" : "Copy"}{v.copies > 0 ? " · " + v.copies : ""}
                          </button>
                          {d.platform === "WhatsApp" && (
                            <a href={waHref || undefined} target="_blank" rel="noreferrer"
                              style={{ ...btnPrimary, padding: "5px 12px", fontSize: 11.5, textDecoration: "none", opacity: waHref ? 1 : 0.45, cursor: waHref ? "pointer" : "not-allowed", background: "linear-gradient(135deg,#059669,#047857)" }}
                              onClick={(e) => { if (!waHref) { e.preventDefault(); return; } log("integration", "Ghostwriter DM opened in WhatsApp to +" + waNum); }}>
                              <Send size={12} /> Send via WhatsApp
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

/* ============================================================
   INTEGRATIONS HUB — real links, real composers, honest status
   ============================================================ */
/* Credentials vault helpers — one status pill + password inputs per card.
   Everything is stored in S (localStorage on this device only). */
function VaultStatus({ ok, okText }) {
  return (
    <span style={{
      fontSize: 10.5, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase",
      padding: "3px 9px", borderRadius: 20, whiteSpace: "nowrap",
      color: ok ? "#34D399" : "#8B86A3",
      background: ok ? "rgba(52,211,153,0.1)" : "rgba(255,255,255,0.05)",
      border: "1px solid " + (ok ? "rgba(52,211,153,0.4)" : "rgba(255,255,255,0.12)"),
    }}>
      {ok ? (okText || "Configured ✓") : "Not connected"}
    </span>
  );
}
function VaultInput({ label, value, onChange, placeholder, type }) {
  return (
    <Field label={label}>
      <input type={type || "password"} autoComplete="off" style={inputStyle} placeholder={placeholder} value={value || ""} onChange={(e) => onChange(e.target.value)} />
    </Field>
  );
}

/* ============================================================
   MCP DISCOVERY — external access panel for the tool system.
   Shows the /api/mcp/discover endpoint, a copy button, and a
   readable catalog of the 13 tools (mirror of the registry).
   ============================================================ */
export function McpDiscoveryPanel() {
  const [copied, setCopied] = useState(false);
  const url = (typeof window !== "undefined" ? window.location.origin : "") + "/api/mcp/discover";
  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (e) { /* clipboard unavailable */ }
  }
  return (
    <Card style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 11, letterSpacing: 2.5, textTransform: "uppercase", color: CYAN, fontWeight: 600, marginBottom: 8 }}>External Access · MCP</div>
      <p style={{ fontSize: 12.5, color: "#A5A0B8", lineHeight: 1.6, margin: "0 0 12px" }}>
        External MCP clients can discover the agent tool system at this endpoint. Public callers see tool names and
        descriptions; full JSON schemas require the <code style={{ color: CYAN }}>MCP_API_KEY</code> header (<code style={{ color: CYAN }}>x-api-key</code>). Executing tools still requires a signed-in session.
      </p>
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        <code style={{ ...inputStyle, flex: 1, minWidth: 220, display: "flex", alignItems: "center", fontSize: 12, overflowX: "auto" }}>{url}</code>
        <button style={btnPrimary} onClick={copyUrl}><Copy size={13} /> {copied ? "Copied" : "Copy"}</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 8, marginBottom: 12 }}>
        {TOOL_CATALOG.map((t) => (
          <div key={t.name} style={{ ...glass, padding: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: t.approval ? "#FBBF24" : "#34D399" }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: "#E9E4FB", fontFamily: "monospace" }}>{t.name}</span>
            </div>
            <div style={{ fontSize: 11.5, color: "#8B86A3", lineHeight: 1.5 }}>{t.desc}</div>
            <div style={{ fontSize: 10.5, color: "#6B6685", marginTop: 4 }}>{t.squads.join(" · ")}{t.approval ? " · approval required" : ""}</div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 11.5, color: "#FDE68A", background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.3)", borderRadius: 10, padding: "10px 12px", lineHeight: 1.6 }}>
        {MCP_LIMITS_NOTE}
      </div>
    </Card>
  );
}

export function Integrations({ S, up, log }) {
  const [wa, setWa] = useState({ phone: "", msg: "" });
  const [em, setEm] = useState({ to: "", subject: "", body: "" });
  const [ghTest, setGhTest] = useState({ phase: "idle", msg: "" });

  const waPhone = wa.phone.replace(/[^0-9]/g, "");
  const waReady = waPhone.length >= 8 && wa.msg.trim().length > 0;
  const waHref = waReady ? "https://wa.me/" + waPhone + "?text=" + encodeURIComponent(wa.msg.trim()) : "";
  const emReady = /.+@.+\..+/.test(em.to.trim());
  const emHref = emReady ? "mailto:" + em.to.trim() + "?subject=" + encodeURIComponent(em.subject) + "&body=" + encodeURIComponent(em.body) : "";

  const linkBtn = (ready) => ({
    ...btnPrimary, textDecoration: "none", justifyContent: "center",
    opacity: ready ? 1 : 0.45, cursor: ready ? "pointer" : "not-allowed",
  });

  /* Vault state with safe defaults for older saved states. */
  const integ = { whatsapp: {}, instagram: {}, video: { service: "YouTube" }, ...(S.integrations || {}) };
  const gh = { owner: "taniboy5514-ops", repo: "qimmah-command-center", branch: "main", ...(S.github || {}) };
  const setInteg = (key, patch) => up((s) => {
    const cur = { whatsapp: {}, instagram: {}, video: { service: "YouTube" }, ...(s.integrations || {}) };
    return { ...s, integrations: { ...cur, [key]: { ...(cur[key] || {}), ...patch } } };
  });
  const setGh = (patch) => up((s) => ({
    ...s,
    github: { token: "", owner: "taniboy5514-ops", repo: "qimmah-command-center", branch: "main", ...(s.github || {}), ...patch },
  }));

  const waConfigured = Boolean(integ.whatsapp.token && integ.whatsapp.phoneNumberId);
  const igConfigured = Boolean(integ.instagram.token && integ.instagram.appId && integ.instagram.appSecret);
  const videoConfigured = Boolean(integ.video.service && integ.video.key);

  async function testGithub() {
    if (!gh.token.trim()) { setGhTest({ phase: "err", msg: "Paste your personal access token first." }); return; }
    setGhTest({ phase: "testing", msg: "" });
    try {
      const fullName = await testGhConnection({ ...gh, token: gh.token.trim() });
      setGh({ token: gh.token.trim(), connectedAt: Date.now() });
      setGhTest({ phase: "ok", msg: "✓ Connected to " + fullName });
      log("integration", "GitHub connected: " + fullName + " (" + (gh.branch || "main") + ")");
    } catch (e) {
      setGh({ connectedAt: null });
      setGhTest({ phase: "err", msg: e && e.message ? e.message : "Connection failed." });
      log("integration", "GitHub connection failed: " + (e && e.message ? e.message : "unknown error"));
    }
  }

  const vaultCardTitle = (color, icon, label, statusEl) => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 10 }}>
      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color, display: "flex", alignItems: "center", gap: 7 }}>{icon} {label}</div>
      {statusEl}
    </div>
  );
  const guideStyle = { fontSize: 12, color: "#A5A0B8", lineHeight: 1.6, margin: "0 0 12px" };
  const linkStyle = { color: CYAN, textDecoration: "none" };
  const deviceNote = <div style={{ fontSize: 11, color: "#8B86A3", marginTop: 4 }}>🔒 Stored only on this device — never emailed, never sent to our servers.</div>;

  const platforms = [
    { name: "Instagram", color: "#E1306C", href: "https://www.instagram.com/accounts/login/", note: "Opens Instagram login. Automated posting and DM replies require the official Instagram Business API via Meta — a verified Business account and app review." },
    { name: "WhatsApp", color: "#25D366", href: "https://web.whatsapp.com/", note: "Opens WhatsApp Web. The composer below sends real messages through wa.me — works today, no API needed. Full automation requires the WhatsApp Business API." },
    { name: "Facebook", color: "#1877F2", href: "https://business.facebook.com/", note: "Opens Meta Business Suite for page and ads management. Automated publishing requires a Meta developer app with approved permissions." },
    { name: "Email", color: "#FBBF24", href: "https://mail.google.com/", note: "The composer below opens your real mail app with everything pre-filled. Bulk automation requires an email service like Resend or SendGrid." },
  ];

  return (
    <div>
      <SectionTitle eyebrow="Channels" title="Integrations Hub" sub="Every button here does something real. Where official APIs are required, the card says so plainly — no fake 'connected' badges." />

      <McpDiscoveryPanel />

      {/* Security banner — replaces the old "email us your API keys" idea. */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderRadius: 12, marginBottom: 18, background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.35)", fontSize: 13, color: "#FDE68A" }}>
        <ShieldCheck size={18} style={{ flexShrink: 0, color: "#FBBF24" }} />
        <span><b>Never send API keys by email or DM.</b> Keys stay in this device vault — saved only in this browser's local storage and used only for direct calls to each official API.</span>
      </div>

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

      {/* CREDENTIALS VAULT */}
      <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: PURPLE, marginBottom: 12 }}>Credentials vault</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 12, marginBottom: 18 }}>

        <Card>
          {vaultCardTitle("#25D366", <Send size={14} />, "WhatsApp Business API", <VaultStatus ok={waConfigured} />)}
          <p style={guideStyle}>
            Create a Meta app at <a href="https://developers.facebook.com/" target="_blank" rel="noreferrer" style={linkStyle}>developers.facebook.com</a> → add the <b>WhatsApp</b> product.
            The API Setup panel gives you the Access Token (make it permanent under System Users) and the Phone Number ID.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <VaultInput label="Access Token" value={integ.whatsapp.token} onChange={(v) => setInteg("whatsapp", { token: v })} placeholder="EAA…" />
            <VaultInput label="Phone Number ID" value={integ.whatsapp.phoneNumberId} onChange={(v) => setInteg("whatsapp", { phoneNumberId: v })} placeholder="e.g. 123456789012345" />
            {deviceNote}
          </div>
        </Card>

        <Card>
          {vaultCardTitle("#E1306C", <ExternalLink size={14} />, "Instagram Graph API", <VaultStatus ok={igConfigured} />)}
          <p style={guideStyle}>
            At <a href="https://developers.facebook.com/" target="_blank" rel="noreferrer" style={linkStyle}>developers.facebook.com</a> open your app → add the <b>Instagram Graph API</b> product.
            App ID &amp; App Secret are under Settings → Basic; create a long-lived token via Graph API Explorer.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <VaultInput label="Access Token" value={integ.instagram.token} onChange={(v) => setInteg("instagram", { token: v })} placeholder="IGA… / EAA…" />
            <VaultInput label="App ID" value={integ.instagram.appId} onChange={(v) => setInteg("instagram", { appId: v })} placeholder="e.g. 9876543210" />
            <VaultInput label="App Secret" value={integ.instagram.appSecret} onChange={(v) => setInteg("instagram", { appSecret: v })} placeholder="32-character secret" />
            {deviceNote}
          </div>
        </Card>

        <Card>
          {vaultCardTitle(CYAN, <Video size={14} />, "Video Hosting", <VaultStatus ok={videoConfigured} />)}
          <p style={guideStyle}>
            <b>YouTube:</b> create an API key at <a href="https://console.cloud.google.com/" target="_blank" rel="noreferrer" style={linkStyle}>console.cloud.google.com</a> (enable YouTube Data API v3).{" "}
            <b>Vimeo:</b> developer.vimeo.com → My Apps → Generate access token. <b>S3:</b> IAM access key + bucket name.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Field label="Service">
              <select style={{ ...inputStyle, background: "#1a1327" }} value={integ.video.service || "YouTube"} onChange={(e) => setInteg("video", { service: e.target.value })}>
                {["YouTube", "Vimeo", "S3", "Other"].map((v) => <option key={v} value={v} style={{ background: "#1a1327" }}>{v}</option>)}
              </select>
            </Field>
            <VaultInput label="API key / token" value={integ.video.key} onChange={(v) => setInteg("video", { key: v })} placeholder="Paste the key or token" />
            <VaultInput label="Project / bucket name" type="text" value={integ.video.project} onChange={(v) => setInteg("video", { project: v })} placeholder="e.g. qimmah-videos" />
            {deviceNote}
          </div>
        </Card>

        <Card>
          {vaultCardTitle("#E9E4FB", <Github size={14} />, "GitHub — self-edit", <VaultStatus ok={Boolean(gh.token && gh.connectedAt)} okText="Connected ✓" />)}
          <p style={guideStyle}>
            Lets the AI CEO change this Command Center when you ask. Create a fine-grained token at{" "}
            <a href="https://github.com/settings/personal-access-tokens" target="_blank" rel="noreferrer" style={linkStyle}>github.com/settings/personal-access-tokens</a>{" "}
            — access to <b>this repo only</b>, permission <b>Contents: Read and write</b>.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <VaultInput label="Personal Access Token" value={gh.token} onChange={(v) => { setGh({ token: v, connectedAt: null }); setGhTest({ phase: "idle", msg: "" }); }} placeholder="github_pat_…" />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <VaultInput label="Owner" type="text" value={gh.owner} onChange={(v) => setGh({ owner: v.trim() || "taniboy5514-ops" })} placeholder="taniboy5514-ops" />
              <VaultInput label="Repo" type="text" value={gh.repo} onChange={(v) => setGh({ repo: v.trim() || "qimmah-command-center" })} placeholder="qimmah-command-center" />
            </div>
            <VaultInput label="Branch" type="text" value={gh.branch} onChange={(v) => setGh({ branch: v.trim() || "main" })} placeholder="main" />
            <button style={{ ...btnPrimary, opacity: ghTest.phase === "testing" ? 0.6 : 1 }} disabled={ghTest.phase === "testing"} onClick={testGithub}>
              <Github size={14} /> {ghTest.phase === "testing" ? "Testing…" : "Test connection"}
            </button>
            {ghTest.phase === "ok" && <div style={{ fontSize: 12, color: "#34D399" }}>{ghTest.msg}</div>}
            {ghTest.phase === "err" && <div style={{ fontSize: 12, color: "#F87171" }}>{ghTest.msg}</div>}
            {!ghTest.msg && gh.connectedAt && <div style={{ fontSize: 12, color: "#34D399" }}>✓ Connected to {gh.owner}/{gh.repo} ({gh.branch}) · {timeAgo(gh.connectedAt)}</div>}
            {deviceNote}
          </div>
        </Card>
      </div>

      <DMGhostwriter S={S} up={up} log={log} />
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
const FEED_COLORS = { chat: PURPLE, task: CYAN, finance: "#34D399", agent: "#FBBF24", integration: "#F472B6", contract: "#22D3EE", autopilot: "#FFB020", lead: "#60A5FA", study: "#A78BFA", system: "#8B86A3" };
export function LiveFeed({ S, up }) {
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
export function Overview({ S, go }) {
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
