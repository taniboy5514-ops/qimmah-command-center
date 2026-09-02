/* ============================================================
   TASK RUNNER — the client-side autonomous executor.
   Works while the app is open (no server cron needed): every 20s
   it looks at the Tasks board, picks the oldest In Progress task,
   assigns the best-fit agent if unassigned, and has that agent
   produce the COMPLETE deliverable via Groq. The task moves to
   Review with a resultId; the deliverable is saved to Results.
   Review → Done stays manual — the user always signs off.
   ============================================================ */
import { useEffect, useRef, useState } from "react";
import { AGENTS, SQUAD_META, aiCall, uid, fleetChatMsg, CHAT_CAP, IN_PREVIEW, glass } from "./shared.jsx";

const TICK_MS = 20000;          // pipeline tick
const FIRST_TICK_MS = 3000;     // quick start after mount
const FAIL_COOLDOWN_MS = 5 * 60000;  // retry a failed task after 5 min
const NUDGE_COOLDOWN_MS = 30 * 60000; // CEO nudges at most every 30 min

/* ---------- Module-level runner status store ----------
   The TaskRunner writes here; the fixed status chip and the Tasks
   Board header read from here (subscribe hook). */
let runnerStatus = { working: false, agentCode: "", title: "", remaining: 0 };
const statusListeners = new Set();
function setRunnerStatus(patch) {
  runnerStatus = { ...runnerStatus, ...patch };
  statusListeners.forEach((fn) => { try { fn(runnerStatus); } catch (e) { /* listener gone */ } });
}
export function useRunnerStatus() {
  const [st, setSt] = useState(runnerStatus);
  useEffect(() => {
    statusListeners.add(setSt);
    return () => { statusListeners.delete(setSt); };
  }, []);
  return st;
}

/* ---------- Best-fit agent for a task title ----------
   Keyword match against squad roles; prefers agents that are not
   toggled off. Default: Squad Gamma (intelligence/strategy — the
   CEO-adjacent squad). */
export function pickAgentFor(title, S) {
  const t = String(title || "").toLowerCase();
  const off = (S && S.agentsOff) || {};
  let squad = "Gamma";
  let prefer = [];
  if (/(outreach|sales|sell|lead|prospect|cold|pitch|clos|crm|proposal|client hunt|whatsapp)/.test(t)) {
    squad = "Alpha"; prefer = ["Sales Closer", "Proposal Writer", "Cold Outreach", "CRM Manager", "Instagram Lead Gen", "Email Campaigns", "WhatsApp Bot"];
  } else if (/(content|copy|seo|blog|article|newsletter|script|caption|story|keyword)/.test(t)) {
    squad = "Beta"; prefer = ["Content Writer", "Ad Copywriter", "SEO On-Page", "Content Strategy"];
  } else if (/(price|pricing|financ|invoice|budget|omr|account|bookkeep|revenue|cost|profit)/.test(t)) {
    squad = "Delta"; prefer = ["Invoice Generator", "Report Generator"];
  } else if (/(instagram|social|tiktok|reel|facebook|twitter|linkedin|snap|post)/.test(t)) {
    squad = "Beta"; prefer = ["Social Media Manager", "Graphic Designer", "Video Editor"];
  } else if (/(website|web\b|design|logo|app\b|technical|develop|code|landing|ui|ux|page)/.test(t)) {
    squad = "Beta"; prefer = ["Web Developer", "UI/UX Designer", "Graphic Designer", "QA Tester"];
  } else if (/(research|market|competitor|trend|analy|data|report|study|strategy|plan)/.test(t)) {
    squad = "Gamma"; prefer = ["Market Research", "Brand Strategist", "Competitor Tracker", "Growth Hacker"];
  } else if (/(automat|bot|process|workflow|email campaign)/.test(t)) {
    squad = "Delta"; prefer = ["Process Automation", "Chatbot Builder", "Email Automation"];
  }
  // Content Strategy lives in Alpha per the roster — honor exact names wherever they sit.
  const byName = (name) => AGENTS.find((a) => a.name === name);
  for (const n of prefer) {
    const a = byName(n);
    if (a && !off[a.id]) return a;
  }
  const squadPool = AGENTS.filter((a) => a.squad === squad && !off[a.id]);
  if (squadPool.length) return squadPool[0];
  const anyActive = AGENTS.filter((a) => !off[a.id]);
  return anyActive[0] || AGENTS[0];
}

/* ---------- DELIVERABLE MODE prompt (mirrors CEOChat pattern) ---------- */
function runnerSys(agent) {
  return ("You are " + agent.code + " — " + agent.name + ", a specialist agent in Squad " + agent.squad
    + " (" + (SQUAD_META[agent.squad] || {}).role + ") at Qimmah Digital (قمة ديجيتال), a bilingual (Arabic/English) AI-powered digital marketing agency based in Oman, founded by Sultan. "
    + "Pricing: OMR 99/mo SMB package, OMR 500+/mo premium. Key client: Army Burger. Market: Oman first (restaurants, e-commerce, real estate, healthcare, tourism), GCC next. Agents work in minutes, not days.\n\n"
    + "DELIVERABLE MODE: Produce the COMPLETE finished artifact for this task — the full copy deck, the full outreach script, the full plan, the full code — ready to use as-is. No placeholders, no 'TODO', no describing the work — the finished work itself. Bilingual (Arabic + English) where it helps the Omani market.\n"
    + "End your reply with a fenced json block exactly like:\n"
    + "```json\n{\"title\":\"short deliverable title\",\"filename\":\"kebab-case-name.md\",\"content\":\"the COMPLETE file content\"}\n```\n"
    + "Use .html as the filename when the deliverable is a web page. Keep any prose before the json block free of JSON."
    + agentToolkitNote(agent)).slice(0, 3600);
}

/* Pull {title, filename, content} out of the model reply; fall back to
   the raw text as the deliverable if the fence is missing/malformed. */
function parseDeliverable(raw, taskTitle) {
  let d = null;
  const fence = raw.match(/```json\s*([\s\S]*?)```/) || raw.match(/```\s*(\{[\s\S]*?"content"[\s\S]*?\})\s*```/);
  if (fence) { try { d = JSON.parse(fence[1]); } catch (e) { /* malformed — use raw */ } }
  const content = String((d && d.content) || raw).slice(0, 6000);
  const title = String((d && d.title) || ("Deliverable: " + taskTitle.slice(0, 60))).slice(0, 100);
  const filename = (String((d && d.filename) || "deliverable.md").replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 60)) || "deliverable.md";
  return { title, filename, content };
}

/* ============================================================
   TaskRunner — mounted once at the app root. Renders only a small
   fixed bottom-right status pill while an agent is working.
   ============================================================ */
export function TaskRunner({ S, up, log }) {
  const busyRef = useRef(false);
  const failedRef = useRef(new Map()); // taskId -> retry-allowed-after timestamp
  const nudgeRef = useRef(0);          // last "backlog waiting" nudge
  const keyNudgeRef = useRef(0);       // last "add Groq key" nudge
  const sRef = useRef(S);
  sRef.current = S;
  const st = useRunnerStatus();

  useEffect(() => {
    let alive = true;

    async function tick() {
      try {
        if (busyRef.current) return;
        const s = sRef.current;
        if (!s) return;
        if (s.runnerOn === false) { setRunnerStatus({ working: false, agentCode: "", title: "", remaining: 0 }); return; }

        const now = Date.now();
        const tasks = s.tasks || [];
        const open = tasks.filter((t) => t.col === "Backlog" || t.col === "In Progress");

        /* No engine key (and not the keyless preview): pause and nudge. */
        if (!s.groqKey && !IN_PREVIEW) {
          if (open.length > 0 && now - keyNudgeRef.current > NUDGE_COOLDOWN_MS) {
            keyNudgeRef.current = now;
            up((x) => ({ ...x, chat: [...x.chat, fleetChatMsg("Task Runner", "⚠️ Auto-run is on but no Groq key is set — the fleet can't execute tasks yet. Open the AI CEO tab → Settings and paste your key; I'll resume automatically.")].slice(-CHAT_CAP) }));
          }
          setRunnerStatus({ working: false, agentCode: "", title: "", remaining: open.length });
          return;
        }

        /* Candidate = oldest In Progress task not in failure cooldown. */
        const cooled = (t) => { const until = failedRef.current.get(t.id); return !until || until <= now; };
        let candidate = tasks.filter((t) => t.col === "In Progress" && cooled(t)).sort((a, b) => (a.ts || 0) - (b.ts || 0))[0] || null;

        if (!candidate) {
          const backlog = tasks.filter((t) => t.col === "Backlog" && cooled(t)).sort((a, b) => (a.ts || 0) - (b.ts || 0));
          const fullAuto = !!(s.autopilot && s.autopilot.auto);
          if (backlog.length > 0 && fullAuto) {
            /* Full auto: pull the oldest Backlog task, assign, start it. */
            const t = backlog[0];
            const agent = t.agentId ? (AGENTS.find((a) => a.id === t.agentId) || pickAgentFor(t.title, s)) : pickAgentFor(t.title, s);
            up((x) => ({
              ...x,
              tasks: x.tasks.map((y) => (y.id === t.id ? { ...y, col: "In Progress", agentId: agent.id } : y)),
              chat: [...x.chat, fleetChatMsg("Task Runner", "🎯 CEO follow-up: " + agent.code + " · " + agent.name + " picked up '" + t.title.slice(0, 70) + "' from Backlog — work starts now.")].slice(-CHAT_CAP),
            }));
            log("runner", "Auto-started backlog task with " + agent.code + ": " + t.title.slice(0, 60));
            candidate = { ...t, col: "In Progress", agentId: agent.id };
          } else {
            /* Full auto off: one gentle nudge per 30 min, then idle. */
            if (backlog.length > 0 && now - nudgeRef.current > NUDGE_COOLDOWN_MS) {
              nudgeRef.current = now;
              up((x) => ({ ...x, chat: [...x.chat, fleetChatMsg("Task Runner", "👋 You have " + backlog.length + " task" + (backlog.length > 1 ? "s" : "") + " in Backlog — want me to start them? Move one to In Progress (or turn on Full auto in the AI CEO → Autopilot panel) and I'll execute it.")].slice(-CHAT_CAP) }));
            }
            setRunnerStatus({ working: false, agentCode: "", title: "", remaining: open.length });
            return;
          }
        }

        busyRef.current = true;
        try {
          /* Assign the best-fit agent if the task is unassigned. */
          let agent = candidate.agentId ? AGENTS.find((a) => a.id === candidate.agentId) : null;
          if (!agent) {
            agent = pickAgentFor(candidate.title, s);
            up((x) => ({
              ...x,
              tasks: x.tasks.map((y) => (y.id === candidate.id ? { ...y, agentId: agent.id } : y)),
              chat: [...x.chat, fleetChatMsg("Task Runner", "🎯 CEO follow-up: assigned " + agent.code + " · " + agent.name + " to '" + candidate.title.slice(0, 70) + "'.")].slice(-CHAT_CAP),
            }));
            log("runner", "Assigned " + agent.code + " to task: " + candidate.title.slice(0, 60));
          }

          setRunnerStatus({ working: true, agentCode: agent.code, title: candidate.title, remaining: Math.max(0, open.length - 1) });

          /* EXECUTE — the agent produces the complete deliverable. */
          const sys = runnerSys(agent);
          const brief = "TASK: " + candidate.title + "\nPriority: " + (candidate.prio || "Medium")
            + (candidate.note ? "\nNotes from the CEO: " + String(candidate.note).slice(0, 400) : "")
            + "\n\nProduce the complete deliverable now.";
          const raw = await aiCall(s, sys, [{ role: "user", content: brief.slice(0, 2000) }]);
          const d = parseDeliverable(raw, candidate.title);
          const resultId = uid();
          const hour = new Date().toLocaleString("en", { weekday: "short", hour: "2-digit", minute: "2-digit" });
          const entry = {
            id: resultId, type: "deliverable", topic: d.title, title: d.title, filename: d.filename, content: d.content,
            summary: "Delivered by " + agent.code + " · " + agent.name + " for board task: \"" + candidate.title.slice(0, 120) + "\"",
            hour, squad: agent.squad, agent: agent.code + " " + agent.name, taskId: candidate.id, cycle: null, ts: now,
          };
          /* One state update: task → Review (+resultId), result saved, chat informed. */
          up((x) => ({
            ...x,
            tasks: x.tasks.map((y) => (y.id === candidate.id ? { ...y, col: "Review", resultId } : y)),
            results: [entry, ...(x.results || [])].slice(0, 200),
            chat: [...x.chat, fleetChatMsg(agent.code + " · " + agent.name, "📦 " + agent.code + " handed in '" + d.title.slice(0, 70) + "' — it's in Review. Deliverable saved to Results.")].slice(-CHAT_CAP),
          }));
          log("runner", "Task executed → Review: " + candidate.title.slice(0, 60) + " (" + agent.code + ", " + d.filename + ")");
        } catch (e) {
          /* Failure: task stays put, 5-min cooldown, one chat note. */
          failedRef.current.set(candidate.id, Date.now() + FAIL_COOLDOWN_MS);
          const short = String((e && e.message) || "unknown error").replace(/\s+/g, " ").slice(0, 90);
          up((x) => ({ ...x, chat: [...x.chat, fleetChatMsg("Task Runner", "⚠️ Couldn't complete '" + candidate.title.slice(0, 60) + "' yet: " + short + " — retrying in 5 min.")].slice(-CHAT_CAP) }));
          log("runner", "Task failed (retry in 5 min): " + candidate.title.slice(0, 60) + " — " + short);
        } finally {
          busyRef.current = false;
          setRunnerStatus({ working: false, agentCode: "", title: "", remaining: 0 });
        }
      } catch (e) {
        /* A bad tick must never break the app. */
        busyRef.current = false;
        setRunnerStatus({ working: false, agentCode: "", title: "", remaining: 0 });
      }
    }

    const first = setTimeout(() => { if (alive) tick(); }, FIRST_TICK_MS);
    const timer = setInterval(() => { if (alive) tick(); }, TICK_MS);
    return () => { alive = false; clearTimeout(first); clearInterval(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Status chip — only visible while an agent is actively working. */
  if (!st.working) return null;
  const short = st.title.length > 44 ? st.title.slice(0, 42) + "…" : st.title;
  return (
    <div style={{
      position: "fixed", bottom: 16, right: 16, zIndex: 60, ...glass,
      padding: "9px 15px", borderRadius: 30, border: "1px solid rgba(255,176,32,0.4)",
      background: "rgba(20,14,8,0.72)", display: "flex", alignItems: "center", gap: 9,
      boxShadow: "0 8px 30px rgba(0,0,0,0.45)", fontSize: 12, color: "#FFD27A", maxWidth: "calc(100vw - 32px)",
    }}>
      <span className="q-blink" style={{ width: 8, height: 8, borderRadius: "50%", background: "#FFB020", boxShadow: "0 0 10px #FFB020", flexShrink: 0 }} />
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        ⚙ <b style={{ color: "#FFB020" }}>{st.agentCode}</b> working on '{short}'{st.remaining > 0 ? " · " + st.remaining + " to go" : ""}
      </span>
    </div>
  );
}
