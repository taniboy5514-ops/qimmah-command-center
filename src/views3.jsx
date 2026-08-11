import { useState, useMemo } from "react";
import { Plus, Trash2, Brain, Download, ExternalLink, Send, Radio, CheckCircle2, Circle } from "lucide-react";
import { PURPLE, CYAN, AGENTS, glass, inputStyle, btnPrimary, btnGhost, Card, SectionTitle, Stat, Empty, Field, uid, omr, timeAgo, lastMonths, monthLabel, REVENUE_TARGET, SQUAD_META, SYSTEM_PROMPT, buildSnapshot, aiCall, IN_PREVIEW, BackupControls } from "./shared.jsx";
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

export function MiroFish({ S, up, log }) {
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

      {knowledge.length === 0
        ? <Empty icon={Brain} title="The brain is empty — teach it something" body="Study your first topic above. Every brief is stored permanently on this device, shown in the AI CEO chat, and included in every Export Brain download." />
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
    </div>
  );
}

/* ============================================================
   INTEGRATIONS HUB — real links, real composers, honest status
   ============================================================ */
export function Integrations({ S, up, log }) {
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
