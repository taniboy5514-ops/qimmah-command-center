import { useState, useEffect, useRef } from "react";
import { LayoutDashboard, MessageSquare, Brain, Users, ListTodo, BarChart3, Wallet, FileText, Inbox, Plug, Radio, Fish, Award, Download, X, Trash2, Plus, Check } from "lucide-react";
import { DEFAULT_STATE, loadState, saveState, pinHash, uid, PURPLE, CYAN, BG, glass, inputStyle, btnPrimary, btnGhost, Card, Field, buildFullBackup, parseFullBackup, BackupControls } from "./shared.jsx";
import { CEOChat } from "./views1.jsx";
import { Agents, Tasks, Finance, Contracts, Leads } from "./views2.jsx";
import { Analytics, MiroFish, Study, Integrations, LiveFeed, Overview, downloadFile, buildBrainMarkdown } from "./views3.jsx";
import { Results, runCycle, dueCycles } from "./autopilot.jsx";
import { runSquadCycle, dueSquadCycle } from "./squadcycle.jsx";
import { TaskRunner } from "./taskrunner.jsx";
/* ============================================================
   APP SHELL
   ============================================================ */
const NAV = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "ceo", label: "AI CEO", icon: MessageSquare },
  { id: "study", label: "CEO Brain", icon: Brain },
  { id: "agents", label: "AI Agents", icon: Users },
  { id: "tasks", label: "Tasks", icon: ListTodo },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "finance", label: "Finance", icon: Wallet },
  { id: "contracts", label: "Contracts", icon: FileText },
  { id: "leads", label: "Leads", icon: Inbox },
  { id: "integrations", label: "Integrations", icon: Plug },
  { id: "results", label: "Results", icon: Award },
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
function App() {
  const [S, setS] = useState(null);
  const [user, setUser] = useState(null); // session lives in memory only — every reload asks who's there
  const [view, setView] = useState("overview");
  const [showTeam, setShowTeam] = useState(false);
  const [narrow, setNarrow] = useState(typeof window !== "undefined" ? window.innerWidth < 900 : false);
  const saveTimer = useRef(null);
  const userRef = useRef(null);
  userRef.current = user;
  const sRef = useRef(null);
  sRef.current = S;
  const cycleLock = useRef(false);
  const [cycleRunning, setCycleRunning] = useState(false);
  const squadLock = useRef(false);
  const [squadRunning, setSquadRunning] = useState(false);
  const [squadPhase, setSquadPhase] = useState("");

  /* SQUAD REPORT CYCLE — every 10–15 min all 60 agents report to their squad
     Alpha, the 5 digests go to the CEO Brain, and directives route back.
     Checks every 60s; at most 1 missed cycle is caught up on open. */
  useEffect(() => {
    if (!S) return;
    let alive = true;
    async function tick() {
      if (squadLock.current || !sRef.current) return;
      if (!dueSquadCycle(sRef.current)) return;
      squadLock.current = true;
      setSquadRunning(true);
      try {
        await runSquadCycle(sRef.current, setS, log, (p) => { if (alive) setSquadPhase(p); });
      } catch (e) { /* a failed squad cycle never stops the engine */ }
      squadLock.current = false;
      if (alive) setSquadRunning(false);
    }
    tick(); // silent catch-up (max 1 missed cycle) on app open
    const t = setInterval(() => tick(), 60000);
    return () => { alive = false; clearInterval(t); };
  }, [!!S]);

  /* HOURLY AUTOPILOT ENGINE — once per clock hour a squad works and studies.
     Checks every 60s; on open, missed hours are caught up silently (cap 8). */
  useEffect(() => {
    if (!S) return;
    let alive = true;
    async function tick(catchUp) {
      if (cycleLock.current || !sRef.current) return;
      let n = dueCycles(sRef.current, catchUp);
      if (n <= 0) return;
      cycleLock.current = true;
      setCycleRunning(true);
      try {
        while (alive && n > 0 && sRef.current && dueCycles(sRef.current, false) > 0) {
          await runCycle(sRef.current, setS, log, {});
          n--;
        }
      } catch (e) { /* a failed cycle never stops the engine */ }
      cycleLock.current = false;
      if (alive) setCycleRunning(false);
    }
    tick(true); // silent catch-up of missed hours on app open
    const t = setInterval(() => tick(false), 60000);
    return () => { alive = false; clearInterval(t); };
  }, [!!S]);

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

  /* Never-Zero full backup — one JSON file with the ENTIRE persisted state. */
  function exportBackup() {
    try {
      const date = new Date().toISOString().slice(0, 10);
      downloadFile("qimmah-full-backup-" + date + ".json", buildFullBackup(S), "application/json");
      setS((s) => ({ ...s, lastFullBackup: Date.now() }));
      log("system", "Full backup exported (qimmah-full-backup-" + date + ".json)");
    } catch (e) { /* export unavailable in this environment */ }
  }

  /* Restore the Command Center from a full backup file. */
  function importBackup(file) {
    const reader = new FileReader();
    reader.onload = () => {
      let restored = null;
      try { restored = parseFullBackup(JSON.parse(String(reader.result))); } catch (e) { restored = null; }
      if (!restored) {
        alert("That file isn't a valid Qimmah full backup. Choose a qimmah-full-backup-*.json file exported from this app.");
        return;
      }
      if (!window.confirm("Restore from backup? This replaces everything currently in the Command Center with the backup's contents.")) return;
      setS((s) => ({ ...DEFAULT_STATE, ...restored, feed: [{ id: uid(), type: "system", text: "Command Center restored from full backup", ts: Date.now(), by: userRef.current ? userRef.current.name : "" }, ...(restored.feed || s.feed)].slice(0, 100) }));
      alert("Backup restored. Your Command Center is back exactly as it was. ✅");
    };
    reader.onerror = () => alert("Couldn't read that file. Try again.");
    reader.readAsText(file);
  }

  function exportBrain() {
    try {
      const date = new Date().toISOString().slice(0, 10);
      downloadFile("qimmah-ceo-brain-" + date + ".json", JSON.stringify(S, null, 2), "application/json");
      // Small delay so the browser doesn't suppress the second download
      setTimeout(() => downloadFile("qimmah-ceo-brain-" + date + ".md", buildBrainMarkdown(S), "text/markdown"), 400);
      log("system", "CEO Brain exported (JSON + Markdown report)");
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
    ceo: <CEOChat S={S} up={up} log={log} user={user} go={setView} />,
    study: <Study S={S} up={up} log={log} user={user} exportBrain={exportBrain} exportBackup={exportBackup} importBackup={importBackup} />,
    agents: <Agents S={S} up={up} log={log} squadRunning={squadRunning} squadPhase={squadPhase} onRunSquadNow={async () => {
      if (squadLock.current) return;
      squadLock.current = true;
      setSquadRunning(true);
      try { await runSquadCycle(sRef.current || S, setS, log, setSquadPhase); } catch (e) { /* squad cycle guards itself */ }
      squadLock.current = false;
      setSquadRunning(false);
    }} />,
    tasks: <Tasks S={S} up={up} log={log} />,
    analytics: <Analytics S={S} />,
    finance: <Finance S={S} up={up} log={log} />,
    contracts: <Contracts S={S} up={up} log={log} />,
    leads: <Leads S={S} up={up} log={log} />,
    integrations: <Integrations S={S} up={up} log={log} />,
    feed: <LiveFeed S={S} up={up} />,
    results: <Results S={S} up={up} log={log} running={cycleRunning} onRunNow={async () => {
      if (cycleLock.current) return;
      cycleLock.current = true;
      setCycleRunning(true);
      try { await runCycle(sRef.current || S, setS, log, { force: true }); } catch (e) { /* cycle guards itself */ }
      cycleLock.current = false;
      setCycleRunning(false);
    }} />,
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
            {user.role === "owner" && <BackupControls S={S} onExport={exportBackup} onImport={importBackup} />}
            {user.role === "owner" && (
              <button style={{ ...btnGhost, borderColor: "rgba(6,182,212,0.4)", color: CYAN }} onClick={exportBrain}
                title="Download the full CEO brain: JSON backup + readable Markdown report. Saved to your Downloads — move it to your Desktop.">
                <Download size={13} /> Export Brain
              </button>
            )}
            <button style={btnGhost} onClick={() => { log("system", user.name + " signed out"); setUser(null); setShowTeam(false); setView("overview"); }}>Sign out</button>
          </div>
          {showTeam && user.role === "owner" && <TeamPanel S={S} up={up} log={log} user={user} onClose={() => setShowTeam(false)} />}
          {views[view]}
        </main>
      </div>
      {/* Autonomous Task Runner — executes board tasks while the app is open.
          Renders only a small bottom-right status pill while an agent works. */}
      <TaskRunner S={S} up={up} log={log} />
    </Shell>
  );
}

export default App;
