/* Qimmah Digital — CEO Command Center v2
   Vanilla JS, single state store, localStorage + optional Supabase sync. */
"use strict";

/* ============ CONSTANTS ============ */
const LS_KEY = "qimmah_cc_v2_state";
const TARGET = 19800;
const SQUADS = ["Alpha", "Beta", "Gamma", "Delta", "Epsilon"];
const AGENTS_PER_SQUAD = 12;
const STAGES = ["Lead", "Pitch", "Deal", "Paid"];
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.3-70b-versatile";
const SUGGESTIONS = [
  "Instagram automation for Oman SMEs",
  "Pricing restaurant websites in OMR",
  "WhatsApp DM funnels",
  "AI chatbots for Muscat real estate",
  "Cold outreach scripts for clinics",
  "Retainer models for social media management"
];

/* ============ STATE ============ */
const DM_STARTER_RULES = [
  { id: "dmr1", keyword: "price", channel: "Both", enabled: true, dailyCap: 30,
    reply: "Salam {name}! Here are our OMR prices: Websites from OMR 250 · Instagram automation from OMR 120/mo · Full social management from OMR 180/mo. Want a custom quote? Just tell me what you need." },
  { id: "dmr2", keyword: "book", channel: "Both", enabled: true, dailyCap: 30,
    reply: "Great, {name}! You can grab a free 15-min Zoom slot with Sultan here: {service}. Pick any time that suits you — looking forward to it!" },
  { id: "dmr3", keyword: "hi", channel: "Both", enabled: true, dailyCap: 40,
    reply: "Ahlan {name}! Welcome to Qimmah Digital. We build: 1) Websites 2) Instagram automation 3) WhatsApp funnels 4) Social media management. Reply with a number and I'll send details." },
  { id: "dmr4", keyword: "human", channel: "Both", enabled: true, dailyCap: 50,
    reply: "Of course {name} — Sultan will reply to you personally within the hour. Thanks for your patience!" }
];
function defaultDmloop() {
  return {
    pauseAll: false,
    cooldownMin: 15,
    businessHoursOnly: false,
    bhStart: "09:00",
    bhEnd: "21:00",
    rules: DM_STARTER_RULES.map(r => Object.assign({}, r)),
    leads: [],
    sentLog: {} // "YYYY-MM-DD:ruleId" -> count  (local safety bookkeeping)
  };
}
function ensureDmloop() {
  state.dmloop = Object.assign(defaultDmloop(), state.dmloop || {});
  if (!Array.isArray(state.dmloop.rules) || state.dmloop.rules.length === 0) state.dmloop.rules = DM_STARTER_RULES.map(r => Object.assign({}, r));
  if (!Array.isArray(state.dmloop.leads)) state.dmloop.leads = [];
  if (typeof state.dmloop.sentLog !== "object" || !state.dmloop.sentLog) state.dmloop.sentLog = {};
}
function defaultState() {
  return {
    settings: {
      groqKey: "", supaUrl: "", supaKey: "", syncOn: false, lastBackup: null, lastSync: null,
      voiceOn: true, voiceName: "", elevenKey: "", elevenVoice: "21m00Tcm4TlvDq8ikWAM",
      bookingLink: "", lastDaemon: null
    },
    finance: [],
    tasks: [],
    studies: [],
    dmloop: defaultDmloop(),
    pipeline: [{ id: uid(), name: "Al Zawiya Turkish Restaurant", value: 850, stage: "Deal", notes: "Website + Instagram automation package. Waiting on final menu content." }],
    chat: [],
    seeded: true
  };
}
let state = defaultState();

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
function fmt(n) { return (Math.round(n * 100) / 100).toLocaleString("en-US", { maximumFractionDigits: 2 }); }
function today() { return new Date().toISOString().slice(0, 10); }

function load() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      state = Object.assign(defaultState(), parsed);
      state.settings = Object.assign(defaultState().settings, parsed.settings || {});
      ensureDmloop();
    }
  } catch (e) { console.warn("load failed", e); }
}
let syncTimer = null;
function save() {
  try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (e) { console.warn("save failed", e); }
  if (state.settings.syncOn && state.settings.supaUrl && state.settings.supaKey) {
    clearTimeout(syncTimer);
    syncTimer = setTimeout(syncPush, 1200); // debounce cloud sync
  }
}

/* ============ SUPABASE SYNC (defensive) ============ */
async function syncPush() {
  const { supaUrl, supaKey } = state.settings;
  try {
    const res = await fetch(supaUrl.replace(/\/$/, "") + "/rest/v1/kv", {
      method: "POST",
      headers: {
        apikey: supaKey, Authorization: "Bearer " + supaKey,
        "Content-Type": "application/json", Prefer: "resolution=merge-duplicates"
      },
      body: JSON.stringify({ id: "qimmah_state", data: state })
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    state.settings.lastSync = new Date().toISOString();
    try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (e) {}
    toast("Synced to Supabase ✓");
  } catch (e) {
    console.warn("Supabase push failed, using local only:", e);
    toast("Cloud sync failed — data is safe locally");
  }
}
async function syncPull() {
  const { supaUrl, supaKey } = state.settings;
  try {
    const res = await fetch(supaUrl.replace(/\/$/, "") + "/rest/v1/kv?id=eq.qimmah_state&select=data", {
      headers: { apikey: supaKey, Authorization: "Bearer " + supaKey }
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const rows = await res.json();
    if (rows && rows[0] && rows[0].data) {
      state = Object.assign(defaultState(), rows[0].data);
      ensureDmloop(); ensureAgents(); runDailyImprovement();
      save(); render();
      toast("Restored from Supabase ✓");
    } else toast("No cloud backup found yet");
  } catch (e) {
    console.warn("Supabase pull failed:", e);
    toast("Could not reach Supabase — check URL/key");
  }
}

/* ============ GROQ ============ */
async function groq(messages, maxTokens) {
  const key = state.settings.groqKey;
  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + key },
    body: JSON.stringify({ model: GROQ_MODEL, messages, temperature: 0.4, max_tokens: maxTokens || 1200 })
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error("Groq HTTP " + res.status + " " + t.slice(0, 120));
  }
  const j = await res.json();
  return j.choices[0].message.content;
}
const CEO_SYSTEM = "You are the AI CEO of Qimmah Digital (قمة ديجيتال), a digital agency in Oman run by one founder (Sultan) with 60 AI agents in 5 squads (Alpha–Epsilon). Be direct, numbers-driven, always think in OMR currency, focus relentlessly on revenue toward the OMR 19,800/month target. Give concrete, actionable answers. No fluff.";

/* ============ AI LADY VOICE ============ */
const ELEVEN_MODEL = "eleven_turbo_v2_5";
const FEMALE_HINTS = ["samantha", "victoria", "karen", "moira", "zira", "susan", "allison", "ava", "serena", "kate", "stephanie", "female", "woman", "tessa", "fiona", "martha", "shelley", "sandy", "nicky", "joelle", "google uk english female", "google us english"];
let voicesCache = [];
function refreshVoices() {
  if (!("speechSynthesis" in window)) return;
  voicesCache = speechSynthesis.getVoices() || [];
}
if ("speechSynthesis" in window) {
  refreshVoices();
  speechSynthesis.onvoiceschanged = refreshVoices;
}
function pickFemaleVoice() {
  if (!voicesCache.length) refreshVoices();
  const pref = state.settings.voiceName;
  if (pref) {
    const v = voicesCache.find(v => v.name === pref);
    if (v) return v;
  }
  const en = voicesCache.filter(v => /^en(-|_)?(US|GB|AU|IE)?/i.test(v.lang));
  const pool = en.length ? en : voicesCache;
  for (const hint of FEMALE_HINTS) {
    const v = pool.find(v => v.name.toLowerCase().includes(hint));
    if (v) return v;
  }
  return pool[0] || null;
}
function speakBrowser(text, onend) {
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const v = pickFemaleVoice();
    if (v) { u.voice = v; u.lang = v.lang; }
    u.rate = 1.02; u.pitch = 1.15; // slightly higher pitch -> feminine
    if (onend) u.onend = onend;
    speechSynthesis.speak(u);
  } catch (e) { console.warn("speechSynthesis failed", e); if (onend) onend(); }
}
async function speakElevenLabs(text) {
  const key = state.settings.elevenKey;
  const voiceId = state.settings.elevenVoice || "21m00Tcm4TlvDq8ikWAM"; // Rachel (female)
  const res = await fetch("https://api.elevenlabs.io/v1/text-to-speech/" + encodeURIComponent(voiceId), {
    method: "POST",
    headers: { "xi-api-key": key, "Content-Type": "application/json", Accept: "audio/mpeg" },
    body: JSON.stringify({ text, model_id: ELEVEN_MODEL, voice_settings: { stability: 0.45, similarity_boost: 0.75 } })
  });
  if (!res.ok) throw new Error("ElevenLabs HTTP " + res.status);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  audio.onended = () => URL.revokeObjectURL(url);
  await audio.play();
}
// Speaks AI reply text aloud with a female voice. Only the reply text is ever sent to ElevenLabs.
async function speakReply(text) {
  if (!state.settings.voiceOn) return;
  const clean = String(text).replace(/[*_#`>]/g, "").slice(0, 1200);
  if (!clean.trim()) return;
  if (state.settings.elevenKey) {
    try { await speakElevenLabs(clean); return; }
    catch (e) {
      console.warn("ElevenLabs TTS failed, falling back to browser voice:", e);
      toast("ElevenLabs failed — using browser voice");
    }
  }
  if ("speechSynthesis" in window) speakBrowser(clean);
}
function testVoice() {
  const sample = "Hello Sultan, this is your AI CEO. Let's make some OMR today.";
  if (state.settings.elevenKey) {
    speakElevenLabs(sample).catch(e => { toast("ElevenLabs failed: " + e.message.slice(0, 60)); if ("speechSynthesis" in window) speakBrowser(sample); });
  } else if ("speechSynthesis" in window) speakBrowser(sample);
  else toast("Speech not supported on this browser");
}

/* --- Voice input (mic) --- */
const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
let recog = null, listening = false;
function stopListening() {
  listening = false;
  try { if (recog) recog.stop(); } catch (e) {}
  const mic = document.getElementById("micBtn");
  if (mic) mic.classList.remove("listening");
}
function startListening() {
  if (!SpeechRec) { toast("Voice input not supported on this browser — on Safari enable it in Settings > Safari"); return; }
  if (listening) { stopListening(); return; }
  try {
    recog = new SpeechRec();
    recog.lang = "en-US";
    recog.interimResults = true;
    recog.continuous = false;
    const mic = document.getElementById("micBtn");
    const inp = document.getElementById("chatInput");
    recog.onresult = e => {
      let txt = "";
      for (let i = 0; i < e.results.length; i++) txt += e.results[i][0].transcript;
      if (inp) inp.value = txt;
      if (e.results[e.results.length - 1].isFinal && /\bsend\s*$/i.test(txt.trim())) {
        const cleaned = txt.trim().replace(/\bsend\s*$/i, "").trim();
        stopListening();
        if (cleaned) sendChat(cleaned);
      }
    };
    recog.onerror = e => { console.warn("speech recognition error", e.error); stopListening(); if (e.error === "not-allowed") toast("Mic permission denied"); };
    recog.onend = stopListening;
    recog.start();
    listening = true;
    if (mic) mic.classList.add("listening");
    toast("Listening… speak now");
  } catch (e) { console.warn(e); toast("Voice input failed on this browser"); }
}

/* ============ AGENT SELF-IMPROVEMENT ENGINE ============ */
const AGENT_CODENAMES = ["Scout", "Nova", "Radar", "Sage", "Echo", "Blaze", "Atlas", "Pixel", "Quest", "Vista", "Orbit", "Zenith"];
const AGENT_ROLES = ["Lead Researcher", "Outreach Specialist", "Copywriter", "Data Analyst", "Funnel Architect", "Social Strategist", "SEO Scout", "Deal Closer", "Content Producer", "Market Watcher", "Automation Engineer", "Client Whisperer"];
const AGENT_SKILLS = ["Market Research", "Cold Outreach", "Copywriting", "Data Analysis", "Funnel Design", "Social Media", "SEO", "Sales Closing", "Content Creation", "Trend Spotting", "Automation", "Client Success"];
const INSIGHT_TEMPLATES = [
  "{name} refined their {skill} playbook — response quality up after studying yesterday's wins.",
  "{name} found a faster {skill} workflow and shared it with the whole squad.",
  "{name} leveled up their {skill}: cut task time by batching similar requests.",
  "{name} cross-trained with a squadmate and added a new {skill} variation.",
  "{name} reviewed failed attempts and patched 2 weak spots in their {skill} routine.",
  "{name} hit a personal best — {skill} output quality trending upward all week."
];
function buildAgents() {
  const list = [];
  SQUADS.forEach((sq, si) => {
    for (let i = 0; i < AGENTS_PER_SQUAD; i++) {
      const n = si * AGENTS_PER_SQUAD + i + 1;
      list.push({
        id: "ag" + n,
        name: AGENT_CODENAMES[i] + "-" + String(n).padStart(2, "0"),
        role: AGENT_ROLES[(si * 3 + i) % AGENT_ROLES.length],
        squad: sq,
        skill: AGENT_SKILLS[(si * 5 + i) % AGENT_SKILLS.length],
        level: 1, xp: 0, daysTrained: 0
      });
    }
  });
  return list;
}
function ensureAgents() {
  if (!state.agents || !Array.isArray(state.agents.list) || state.agents.list.length !== SQUADS.length * AGENTS_PER_SQUAD) {
    state.agents = { list: buildAgents(), log: [], lastImprovementDate: null, lastTrainingAt: null };
  }
  if (!Array.isArray(state.agents.log)) state.agents.log = [];
}
function agentLevel(xp) { return Math.floor(xp / 100) + 1; }
function templateInsight(agent) {
  const t = INSIGHT_TEMPLATES[Math.floor(Math.random() * INSIGHT_TEMPLATES.length)];
  return t.replace("{name}", agent.name).replace("{skill}", agent.skill).replace("{skill}", agent.skill);
}
function runDailyImprovement() {
  ensureAgents();
  const A = state.agents, t = today();
  if (A.lastImprovementDate === t) return;
  const last = A.lastImprovementDate ? new Date(A.lastImprovementDate + "T00:00:00") : null;
  let missed = last ? Math.round((new Date(t + "T00:00:00") - last) / 864e5) : 1;
  missed = Math.min(Math.max(missed, 1), 30); // catch up missed days, capped at 30
  for (let d = missed; d >= 1; d--) {
    const date = new Date(Date.now() - (d - 1) * 864e5).toISOString().slice(0, 10);
    let top = null, topGain = -1;
    A.list.forEach(a => {
      const gain = 15 + Math.floor(Math.random() * 25); // 15–39 XP/day
      a.xp += gain;
      a.level = agentLevel(a.xp);
      a.daysTrained++;
      if (gain > topGain) { topGain = gain; top = a; }
    });
    A.log.push({ date, agentId: top.id, name: top.name, squad: top.squad, gain: topGain, level: top.level, insight: templateInsight(top) });
  }
  A.lastImprovementDate = t;
  A.lastTrainingAt = new Date().toISOString();
  if (A.log.length > 90) A.log = A.log.slice(-90);
  save();
  // If Groq is connected, upgrade today's insight with a real AI-generated one.
  const entry = A.log[A.log.length - 1];
  if (state.settings.groqKey && entry && entry.date === t) {
    const agent = A.list.find(a => a.id === entry.agentId);
    groq([
      { role: "system", content: CEO_SYSTEM + " Write ONE short sentence (max 25 words): a concrete self-improvement insight this agent discovered today while training. Plain text, no JSON, no quotes." },
      { role: "user", content: `Agent: ${agent.name} — ${agent.role}, squad ${agent.squad}, skill focus ${agent.skill}, reached level ${agent.level} (+${entry.gain} XP today).` }
    ], 120).then(txt => {
      const clean = String(txt).trim().replace(/^["']|["']$/g, "").slice(0, 220);
      if (clean) {
        entry.insight = clean;
        save();
        if (activeTab === "agents" || activeTab === "overview") render();
      }
    }).catch(e => console.warn("Groq insight failed, kept template:", e));
  }
}
function agentStats() {
  ensureAgents();
  const list = state.agents.list;
  const totalDays = list.reduce((a, x) => a + (x.daysTrained || 0), 0);
  const avgLevel = list.reduce((a, x) => a + x.level, 0) / list.length;
  return { totalDays, avgLevel };
}

/* ============ BRAIN: RELEVANCE ============ */
function relevantStudies(query, n) {
  const words = query.toLowerCase().split(/[^a-zA-Z0-9\u0600-\u06FF]+/).filter(w => w.length > 3);
  if (!words.length) return [];
  return state.studies
    .map(s => {
      const hay = (s.topic + " " + s.summary + " " + s.insights.join(" ") + " " + s.tags.join(" ")).toLowerCase();
      let score = 0;
      words.forEach(w => { if (hay.includes(w)) score++; });
      return { s, score };
    })
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, n || 3)
    .map(x => x.s);
}
function autoTags(topic) {
  const dict = ["instagram", "whatsapp", "pricing", "oman", "restaurant", "automation", "funnel", "ai", "ads", "seo", "website", "clinic", "real estate", "retainer", "outreach", "social"];
  const t = topic.toLowerCase();
  const tags = dict.filter(d => t.includes(d));
  return tags.length ? tags.slice(0, 4) : ["strategy"];
}

/* ============ TOAST ============ */
let toastTimer = null;
function toast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2600);
}

/* ============ NAV ============ */
const TABS = [
  { id: "overview", label: "Overview" },
  { id: "agents", label: "Agents" },
  { id: "brain", label: "CEO Brain" },
  { id: "ceo", label: "AI CEO" },
  { id: "finance", label: "Finance" },
  { id: "pipeline", label: "Pipeline" },
  { id: "dmloop", label: "DM Loop" },
  { id: "tasks", label: "Tasks" },
  { id: "settings", label: "Settings" }
];
let activeTab = "overview";
function renderTabs() {
  document.getElementById("tabs").innerHTML = TABS.map(t =>
    `<button class="tab ${t.id === activeTab ? "active" : ""}" data-tab="${t.id}">${t.label}</button>`).join("");
}

/* ============ DERIVED ============ */
function monthKey(d) { return (d || "").slice(0, 7); }
function thisMonth() { return today().slice(0, 7); }
function monthIncome() {
  return state.finance.filter(f => f.type === "income" && monthKey(f.date) === thisMonth())
    .reduce((a, f) => a + Number(f.amount || 0), 0);
}
function monthExpense() {
  return state.finance.filter(f => f.type === "expense" && monthKey(f.date) === thisMonth())
    .reduce((a, f) => a + Number(f.amount || 0), 0);
}
function squadRevenue(sq) {
  return state.finance.filter(f => f.type === "income" && f.squad === sq)
    .reduce((a, f) => a + Number(f.amount || 0), 0);
}
function checklist() {
  return [
    { label: "Connect Groq API key", done: !!state.settings.groqKey },
    { label: "First AI CEO conversation", done: state.chat.length > 0 },
    { label: "Log first transaction", done: state.finance.length > 0 },
    { label: "Create first task", done: state.tasks.length > 0 },
    { label: "Run first brain study session", done: state.studies.length > 0 }
  ];
}

/* ============ VIEWS ============ */
function viewOverview() {
  const inc = monthIncome();
  const pct = Math.min(100, Math.round(inc / TARGET * 100));
  const open = state.tasks.filter(t => !t.done).length;
  const cl = checklist();
  const clDone = cl.filter(c => c.done).length;
  const ranks = SQUADS.map(s => ({ s, rev: squadRevenue(s) })).sort((a, b) => b.rev - a.rev);
  const maxRev = Math.max(1, ...ranks.map(r => r.rev));
  const ast = agentStats();
  const pipelineOpen = state.pipeline.filter(p => p.stage !== "Paid").reduce((a, p) => a + Number(p.value || 0), 0);
  return `
  <div class="card hero">
    <div class="hero-logo"><img src="${window.LOGO_DATA_URI || 'logo.png'}" alt="Qimmah Digital logo"></div>
    <div class="hero-kicker">CEO COMMAND CENTER</div>
    <h1>Qimmah Digital</h1>
    <div class="ar">قمة ديجيتال — The Summit</div>
    <div class="tag">One founder. 60 AI agents. Real numbers, updated in real time.</div>
  </div>
  ${clDone < 5 ? `
  <div class="card">
    <div class="flex-between"><b>Launch Checklist</b><span class="pill v">${clDone}/5</span></div>
    <div class="bar"><i style="width:${clDone / 5 * 100}%"></i></div>
    <div style="margin-top:8px">${cl.map(c => `
      <div class="check ${c.done ? "done" : ""}"><div class="box">✓</div><div class="lbl2">${c.label}</div></div>`).join("")}
    </div>
  </div>` : ""}
  <div class="grid stats">
    <div class="stat"><div class="lbl">Income this month</div><div class="val green">OMR ${fmt(inc)}</div><div class="sub">expenses: OMR ${fmt(monthExpense())} · open pipeline: OMR ${fmt(pipelineOpen)}</div></div>
    <div class="stat"><div class="lbl">Target progress</div><div class="val cyan">${pct}%</div><div class="bar"><i style="width:${pct}%"></i></div><div class="sub">of OMR ${fmt(TARGET)}</div></div>
    <div class="stat"><div class="lbl">Active agents</div><div class="val violet">60<span style="font-size:14px;color:var(--dim)">/60</span></div><div class="sub">${fmt(ast.totalDays)} agent-days trained · avg level ${ast.avgLevel.toFixed(1)}</div></div>
    <div class="stat"><div class="lbl">Open tasks</div><div class="val amber">${open}</div><div class="sub">${state.tasks.length} total</div></div>
  </div>
  <div class="card">
    <div class="flex-between"><b>Squad Ranking</b><span class="pill c">by attributed revenue</span></div>
    ${ranks.map((r, i) => `
      <div class="rank-row">
        <div class="rank-n">${i + 1}</div>
        <div class="grow" style="flex:1"><b>${r.s} Squad</b> <span class="sub" style="color:var(--dim);font-size:11px">· ${AGENTS_PER_SQUAD} agents</span>
          <div class="bar"><i style="width:${Math.round(r.rev / maxRev * 100)}%"></i></div></div>
        <div class="cyan" style="font-weight:800">OMR ${fmt(r.rev)}</div>
      </div>`).join("")}
    <div class="note">Tag finance entries with a squad to feed this ranking.</div>
  </div>`;
}

function viewAgents() {
  ensureAgents();
  const A = state.agents;
  const ast = agentStats();
  const lastAt = A.lastTrainingAt ? new Date(A.lastTrainingAt) : null;
  const lastLabel = lastAt
    ? (A.lastImprovementDate === today() ? "today " : A.lastImprovementDate + " ") + lastAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "pending";
  return `
  <h2 class="sec">Agent Squads — Self-Improvement Engine</h2>
  <div class="card">
    <div class="flex-between">
      <b style="display:flex;align-items:center;gap:10px"><span class="pulse"></span> Agents training LIVE</b>
      <span class="pill g">60/60 online</span>
    </div>
    <div class="note">Last training: ${esc(lastLabel)} · ${fmt(ast.totalDays)} total agent-days trained · average level ${ast.avgLevel.toFixed(1)}</div>
    <div class="note">Every day your laptop is on, all 60 agents gain XP and level up (100 XP per level). Missed days are caught up automatically — they kept working while you were away.</div>
    ${state.settings.lastDaemon ? `<div class="note"><span class="pill g">Daemon last ran: ${esc(new Date(state.settings.lastDaemon).toLocaleString())}</span> — 24/7 laptop daemon is live (Settings → 24/7 Daemon).</div>` : `<div class="note">Tip: download the optional 24/7 daemon in Settings so agents train at midnight even with the browser closed.</div>`}
  </div>
  <div class="grid stats" style="margin-bottom:14px">
    ${SQUADS.map(sq => {
      const members = A.list.filter(a => a.squad === sq);
      const avg = members.reduce((s, a) => s + a.level, 0) / members.length;
      const days = members.reduce((s, a) => s + a.daysTrained, 0);
      return `<div class="stat"><div class="lbl">${sq} Squad</div><div class="val violet">Lv ${avg.toFixed(1)}</div><div class="sub">${members.length} agents · ${fmt(days)} agent-days</div></div>`;
    }).join("")}
  </div>
  ${SQUADS.map(sq => `
  <div class="card">
    <div class="flex-between"><b>${sq} Squad</b><span class="pill v">${AGENTS_PER_SQUAD} agents</span></div>
    <div style="margin-top:12px">
      ${A.list.filter(a => a.squad === sq).map(a => `
      <div class="list-item">
        <div class="grow"><div class="t">${esc(a.name)} <span class="sub" style="color:var(--dim);font-size:11px">· ${esc(a.role)}</span></div>
          <div class="s">${esc(a.skill)} · ${a.xp % 100}/100 XP · ${a.daysTrained} days trained</div>
          <div class="bar"><i style="width:${a.xp % 100}%"></i></div></div>
        <span class="lvl-pill">LV ${a.level}</span>
      </div>`).join("")}
    </div>
  </div>`).join("")}
  <div class="card">
    <div class="flex-between"><b>Agent Log</b><span class="pill c">latest ${Math.min(30, A.log.length)}</span></div>
    <div style="margin-top:12px">
      ${A.log.length === 0 ? `<div class="empty">No training logged yet — first cycle runs today.</div>` :
        [...A.log].reverse().slice(0, 30).map(e => `
        <div class="log-item">
          <div class="ld">${e.date} · ${esc(e.squad)} Squad</div>
          <div><b class="violet">${esc(e.name)}</b> <span class="lvl-pill">LV ${e.level}</span> <span class="cyan">+${e.gain} XP</span></div>
          <div style="color:var(--muted);margin-top:3px">${esc(e.insight)}</div>
        </div>`).join("")}
    </div>
  </div>`;
}

function viewBrain() {
  const q = viewBrain.q || "";
  const list = state.studies
    .filter(s => !q || (s.topic + s.summary + s.tags.join(" ")).toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => b.date.localeCompare(a.date));
  return `
  <h2 class="sec">CEO Brain — Self-Study Engine</h2>
  <div class="card">
    <b>Study Queue</b>
    <div class="row" style="margin-top:10px">
      <input id="studyTopic" placeholder="Add a topic to study…" value="">
      <button class="btn primary" style="flex:0 0 auto" id="addTopic">+ Queue</button>
    </div>
    <div class="sug">${SUGGESTIONS.map(s => `<button data-sug="${esc(s)}">${esc(s)}</button>`).join("")}</div>
    <div id="queueList" style="margin-top:14px">
      ${(viewBrain.queue || []).length === 0 ? `<div class="empty">Queue is empty — add a topic above.</div>` :
        viewBrain.queue.map((t, i) => `<div class="list-item"><div class="grow"><div class="t">${esc(t)}</div></div>
          <button class="btn sm primary" data-run="${i}">Study now</button>
          <button class="btn sm ghost" data-dq="${i}">✕</button></div>`).join("")}
    </div>
    <div style="margin-top:14px;display:flex;gap:10px;flex-wrap:wrap">
      <button class="btn primary" id="runStudy">▶ Run Study Session</button>
      <span class="note" style="align-self:center">${state.settings.groqKey ? "Powered by Groq (llama-3.3-70b)" : "No Groq key — offline template mode"}</span>
    </div>
  </div>
  <div class="card">
    <div class="flex-between"><b>Knowledge Library</b><span class="pill v">${state.studies.length} studies</span></div>
    <input id="studySearch" placeholder="Search studies…" value="${esc(q)}" style="margin-top:10px">
    <div style="margin-top:12px">
      ${list.length === 0 ? `<div class="empty">No studies yet — run your first study session.</div>` :
        list.map(s => `
        <div class="study-card" data-card="${s.id}">
          <div class="flex-between"><b>${esc(s.topic)}</b><span class="sub" style="font-size:11px;color:var(--dim)">${s.date}</span></div>
          <div style="font-size:13px;color:var(--muted);margin-top:4px">${esc(s.summary.slice(0, 110))}${s.summary.length > 110 ? "…" : ""}</div>
          <div class="tg">${s.tags.map(t => `<span class="pill c">${esc(t)}</span>`).join("")}
            <button class="btn sm ghost" data-delstudy="${s.id}" style="margin-left:auto">delete</button></div>
          <div class="body">
            <p>${esc(s.summary)}</p>
            <b class="cyan">Key insights</b><ul>${s.insights.map(i => `<li>${esc(i)}</li>`).join("")}</ul>
            <b class="violet">Action items</b><ul>${s.actions.map(a => `<li>${esc(a)}</li>`).join("")}</ul>
          </div>
        </div>`).join("")}
    </div>
  </div>`;
}
viewBrain.queue = viewBrain.queue || [];
viewBrain.q = "";

function localStudy(topic) {
  return {
    summary: `${topic}: offline study card (template mode — add a Groq key for AI-generated depth). This topic sits inside Qimmah Digital's revenue engine: how it converts attention in the Omani market into OMR. The goal is to turn this knowledge into one sellable offer or process improvement this week.`,
    insights: [
      `The Oman SME market is under-served — speed and WhatsApp-first communication beat polished decks.`,
      `Package ${topic.toLowerCase()} as a fixed-price OMR offer; ambiguity kills closes.`,
      `Every deliverable should include a measurable revenue hook for the client.`,
      `Document the process once, then delegate execution to an agent squad.`,
      `Reuse this study in sales conversations — proof of expertise shortens the sales cycle.`
    ],
    actions: [
      `Draft a one-page OMR-priced offer around ${topic.toLowerCase()} and test it with 3 prospects this week.`,
      `Assign one squad to build a repeatable checklist/template for delivery.`,
      `Log any resulting deals in the Pipeline tab and tag revenue to a squad.`
    ]
  };
}

async function runStudy(topic) {
  const btn = document.getElementById("runStudy");
  if (btn) { btn.disabled = true; btn.textContent = "Studying…"; btn.classList.add("spin"); }
  let result;
  if (state.settings.groqKey) {
    try {
      const txt = await groq([
        { role: "system", content: CEO_SYSTEM + " You run self-study sessions. Reply ONLY with valid JSON: {\"summary\":string,\"insights\":[5 strings],\"actions\":[3 strings]}" },
        { role: "user", content: "Study this topic deeply for the agency: " + topic }
      ], 1000);
      const m = txt.match(/\{[\s\S]*\}/);
      const j = JSON.parse(m ? m[0] : txt);
      result = {
        summary: String(j.summary || ""),
        insights: (j.insights || []).slice(0, 5).map(String),
        actions: (j.actions || []).slice(0, 3).map(String)
      };
      if (!result.insights.length || !result.actions.length) throw new Error("incomplete");
    } catch (e) {
      console.warn("Groq study failed, using template:", e);
      result = localStudy(topic);
      toast("AI unavailable — used offline template");
    }
  } else {
    await new Promise(r => setTimeout(r, 500));
    result = localStudy(topic);
  }
  state.studies.push({ id: uid(), topic, date: today(), summary: result.summary, insights: result.insights, actions: result.actions, tags: autoTags(topic) });
  save(); render();
  toast("Study card saved ✓ (" + state.studies.length + " total)");
}

function viewCEO() {
  return `
  <h2 class="sec">AI CEO</h2>
  <div class="card">
    <div class="flex-between"><b>Groq Connection</b>
      <span class="pill ${state.settings.groqKey ? "g" : "a"}">${state.settings.groqKey ? "connected" : "not connected"}</span></div>
    <div class="row" style="margin-top:10px">
      <input id="groqKey" type="password" placeholder="gsk_…" value="${esc(state.settings.groqKey)}">
      <button class="btn primary" style="flex:0 0 auto" id="saveKey">Save</button>
    </div>
    <div class="note">Key is stored only on this device and sent only to api.groq.com. Get a free key at console.groq.com.</div>
  </div>
  <div class="card">
    <div class="flex-between"><b>Chat with your AI CEO</b><span id="reuseBadge"></span></div>
    <div class="chat" id="chatBox">
      ${state.chat.length === 0 ? `<div class="empty">Ask anything — strategy, pricing, priorities.</div>` :
        state.chat.map((m, i) => `<div class="msg ${m.role === "user" ? "user" : "ai"}">${m.role === "ai" ? `<button class="speak-btn" data-speak="${i}" title="Replay voice">🔊</button>` : ""}${esc(m.content)}</div>`).join("")}
    </div>
    <div class="chatbar">
      <button class="btn mic" id="micBtn" title="Voice input">🎤</button>
      <input id="chatInput" placeholder="e.g. How do I close OMR 2,000 this week?">
      <button class="btn primary" style="flex:0 0 auto" id="sendChat">Send</button>
    </div>
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:10px">
      <button class="btn" id="briefing">☀ Daily Briefing — top 3 priorities</button>
      <button class="btn ghost" id="shareBriefing">📤 Share briefing</button>
    </div>
    <div class="voice-row">
      <button class="btn sm ${state.settings.voiceOn ? "primary" : "ghost"}" id="voiceToggle">${state.settings.voiceOn ? "🔊 Voice replies: ON" : "🔇 Voice replies: OFF"}</button>
      <select id="voicePick" style="flex:1;min-width:140px;padding:7px 12px;font-size:12px;border-radius:10px">
        <option value="">Auto female voice</option>
        ${voicesCache.map(v => `<option value="${esc(v.name)}" ${state.settings.voiceName === v.name ? "selected" : ""}>${esc(v.name)} (${esc(v.lang)})</option>`).join("")}
      </select>
      <button class="btn sm" id="testVoice">Test voice</button>
    </div>
  </div>`;
}

function buildBriefing() {
  const inc = monthIncome();
  const gap = Math.max(0, TARGET - inc);
  const openTasks = state.tasks.filter(t => !t.done).slice(0, 3);
  const deals = state.pipeline.filter(p => p.stage === "Deal" || p.stage === "Pitch");
  const lines = [];
  lines.push(`1. REVENUE GAP: OMR ${fmt(gap)} left to hit the OMR ${fmt(TARGET)} target (${Math.round(inc / TARGET * 100)}% done). ${deals.length ? "Closest money: " + deals.map(d => d.name + " (OMR " + fmt(d.value) + ")").join(", ") + " — push these to Paid." : "Pipeline is thin — create offers and add clients to the Pipeline tab."}`);
  lines.push(`2. EXECUTION: ${openTasks.length ? "Clear these open tasks first: " + openTasks.map(t => t.title).join("; ") + "." : "No open tasks — define today's 3 revenue tasks in the Tasks tab."}`);
  const topSquad = SQUADS.map(s => ({ s, r: squadRevenue(s) })).sort((a, b) => b.r - a.r)[0];
  lines.push(`3. LEVERAGE: ${topSquad.r > 0 ? topSquad.s + " squad leads with OMR " + fmt(topSquad.r) + " — double down on what they sold." : "No squad revenue attributed yet — tag finance entries to squads to see what sells."}`);
  return "DAILY BRIEFING — " + today() + "\n\n" + lines.join("\n\n");
}

async function sendChat(text) {
  if (!text.trim()) return;
  state.chat.push({ role: "user", content: text });
  const used = relevantStudies(text, 3);
  save(); render();
  const box = document.getElementById("chatBox");
  if (box) box.insertAdjacentHTML("beforeend", `<div class="msg ai spin">Thinking…</div>`);
  let reply;
  if (!state.settings.groqKey) {
    reply = "No Groq key connected — running in offline mode.\n\n" + buildBriefing() +
      (used.length ? "\n\n(Also reusing " + used.length + " past studies: " + used.map(s => s.topic).join("; ") + ")" : "") +
      "\n\nAdd your gsk_ key above for full conversational AI.";
  } else {
    const studyCtx = used.length
      ? "\n\nRelevant past self-study findings to reuse:\n" + used.map(s =>
          `- ${s.topic}: ${s.summary} Insights: ${s.insights.join(" | ")}`).join("\n")
      : "";
    const ctx = `\n\nCurrent state: income this month OMR ${fmt(monthIncome())} of OMR ${fmt(TARGET)} target; open tasks: ${state.tasks.filter(t => !t.done).map(t => t.title).join(", ") || "none"}; pipeline: ${state.pipeline.map(p => p.name + " [" + p.stage + ", OMR " + p.value + "]").join(", ") || "empty"}.`;
    try {
      reply = await groq([
        { role: "system", content: CEO_SYSTEM + ctx + studyCtx },
        ...state.chat.slice(-10).map(m => ({ role: m.role, content: m.content }))
      ]);
    } catch (e) {
      reply = "Groq request failed: " + e.message + "\n\nCheck your key. Your data is safe.";
    }
  }
  state.chat.push({ role: "ai", content: reply, usedStudies: used.length });
  save(); render();
  speakReply(reply);
}

function viewFinance() {
  const list = [...state.finance].sort((a, b) => b.date.localeCompare(a.date));
  return `
  <h2 class="sec">Finance</h2>
  <div class="grid stats" style="margin-bottom:14px">
    <div class="stat"><div class="lbl">Income (month)</div><div class="val green">OMR ${fmt(monthIncome())}</div></div>
    <div class="stat"><div class="lbl">Expenses (month)</div><div class="val red">OMR ${fmt(monthExpense())}</div></div>
    <div class="stat"><div class="lbl">Net (month)</div><div class="val cyan">OMR ${fmt(monthIncome() - monthExpense())}</div></div>
  </div>
  <div class="card">
    <b>Add transaction</b>
    <div class="row" style="margin-top:10px">
      <div><label>Amount (OMR)</label><input id="fAmt" type="number" min="0" step="0.01" placeholder="0.00"></div>
      <div><label>Label</label><input id="fLabel" placeholder="e.g. Website — Al Zawiya"></div>
    </div>
    <div class="row">
      <div><label>Date</label><input id="fDate" type="date" value="${today()}"></div>
      <div><label>Type</label><select id="fType"><option value="income">Income</option><option value="expense">Expense</option></select></div>
      <div><label>Squad</label><select id="fSquad">${SQUADS.map(s => `<option>${s}</option>`).join("")}</select></div>
    </div>
    <button class="btn primary" id="addTx" style="margin-top:14px">+ Add</button>
  </div>
  <div class="card"><b>Transactions (${state.finance.length})</b>
    <div style="margin-top:12px">
      ${list.length === 0 ? `<div class="empty">No transactions yet.</div>` :
        list.map(f => `<div class="list-item">
          <div class="grow"><div class="t">${esc(f.label)}</div>
            <div class="s">${f.date} · <span class="pill v">${f.squad}</span></div></div>
          <b class="${f.type === "income" ? "green" : "red"}">${f.type === "income" ? "+" : "−"} OMR ${fmt(f.amount)}</b>
          <button class="btn sm ghost" data-deltx="${f.id}">✕</button>
        </div>`).join("")}
    </div>
  </div>`;
}

function viewPipeline() {
  const byStage = st => state.pipeline.filter(p => p.stage === st);
  return `
  <h2 class="sec">Client Pipeline</h2>
  <div class="card">
    <b>Add client</b>
    <div class="row" style="margin-top:10px">
      <div><label>Name</label><input id="pName" placeholder="Client name"></div>
      <div><label>Value (OMR)</label><input id="pValue" type="number" min="0" placeholder="0"></div>
      <div><label>Stage</label><select id="pStage">${STAGES.map(s => `<option>${s}</option>`).join("")}</select></div>
    </div>
    <label>Notes</label><input id="pNotes" placeholder="Optional notes">
    <button class="btn primary" id="addClient" style="margin-top:14px">+ Add to pipeline</button>
  </div>
  <div class="board">
    ${STAGES.map(st => {
      const cards = byStage(st);
      const tot = cards.reduce((a, c) => a + Number(c.value || 0), 0);
      return `<div>
        <div class="col-head"><span>${st}</span><span class="pill c">${cards.length} · OMR ${fmt(tot)}</span></div>
        <div class="col-body">
          ${cards.length === 0 ? `<div class="empty" style="padding:14px">—</div>` : cards.map(c => `
            <div class="pcard">
              <div class="nm">${esc(c.name)}</div>
              <div class="vl">OMR ${fmt(c.value)}</div>
              ${c.notes ? `<div class="nt">${esc(c.notes)}</div>` : ""}
              <div class="mv">
                ${st !== "Lead" ? `<button class="btn sm ghost" data-move="${c.id}:-1">◀</button>` : ""}
                ${st !== "Paid" ? `<button class="btn sm primary" data-move="${c.id}:1">▶</button>` : ""}
                <button class="btn sm ghost" data-delclient="${c.id}" style="margin-left:auto">✕</button>
              </div>
            </div>`).join("")}
        </div>
      </div>`;
    }).join("")}
  </div>`;
}

/* ============ DM LOOP ============ */
function fillVars(tpl, name) {
  return String(tpl)
    .replace(/\{name\}/g, name || "there")
    .replace(/\{service\}/g, state.settings.bookingLink || "qimmah.om/book")
    .replace(/\{price\}/g, "OMR 250+");
}
function viewDmloop() {
  ensureDmloop();
  const D = state.dmloop;
  return `
  <h2 class="sec">Social DM Loop — Auto-Reply Builder</h2>
  <div class="notice">⚠ <b>Don't get burned:</b> automation on Instagram/WhatsApp must comply with Meta &amp; WhatsApp policies — unofficial bots can get your accounts BANNED. Use these rules as human-approved drafts, and switch to the official <b>WhatsApp Business API</b> / <b>Instagram Graph API</b> before real production automation.</div>
  <div class="card">
    <div class="flex-between">
      <b style="display:flex;align-items:center;gap:10px"><span class="pulse"></span> Loop status</b>
      <button class="btn sm ${D.pauseAll ? "danger" : "primary"}" id="dmPause">${D.pauseAll ? "⏸ PAUSED — tap to resume" : "▶ LIVE — tap to pause all"}</button>
    </div>
    <div class="row" style="margin-top:12px">
      <div><label>Cooldown between replies to same user (min)</label><input id="dmCooldown" type="number" min="0" value="${Number(D.cooldownMin) || 0}"></div>
      <div><label>Business hours only</label>
        <select id="dmBH">${["off", "on"].map(o => `<option value="${o}" ${D.businessHoursOnly === (o === "on") ? "selected" : ""}>${o === "on" ? "ON" : "OFF"}</option>`).join("")}</select></div>
      <div><label>From</label><input id="dmBHStart" type="time" value="${esc(D.bhStart)}"></div>
      <div><label>To</label><input id="dmBHEnd" type="time" value="${esc(D.bhEnd)}"></div>
    </div>
    <div class="note">Booking link used by the "book" rule is set in Settings. Current: <span class="mono">${esc(state.settings.bookingLink || "(not set — set it in Settings)")}</span></div>
  </div>
  <div class="card">
    <b>Rules (${D.rules.length})</b>
    <div style="margin-top:12px">
      ${D.rules.map((r, i) => `
      <div class="rule-card ${r.enabled && !D.pauseAll ? "" : "off"}">
        <div class="flex-between">
          <b>“${esc(r.keyword)}” <span class="pill c">${esc(r.channel)}</span></b>
          <div style="display:flex;gap:6px;align-items:center">
            <label class="switch"><input type="checkbox" data-dmtoggle="${r.id}" ${r.enabled ? "checked" : ""}><span class="slider"></span></label>
            <button class="btn sm ghost" data-dmup="${i}" ${i === 0 ? "disabled" : ""}>▲</button>
            <button class="btn sm ghost" data-dmdown="${i}" ${i === D.rules.length - 1 ? "disabled" : ""}>▼</button>
            <button class="btn sm ghost" data-dmdel="${r.id}">✕</button>
          </div>
        </div>
        <div class="note" style="margin-top:6px">${esc(fillVars(r.reply, "Sara"))}</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;align-items:center">
          <span class="pill v">daily cap: ${Number(r.dailyCap) || "∞"}</span>
          <button class="btn sm" data-dmedit="${r.id}">Edit</button>
          <button class="btn sm primary" data-dmai="${r.id}">✨ Generate reply with AI</button>
        </div>
      </div>`).join("")}
    </div>
    <div class="row" style="margin-top:14px">
      <div><label>Keyword / phrase</label><input id="dmKeyword" placeholder="e.g. price"></div>
      <div><label>Channel</label><select id="dmChannel"><option>Both</option><option>Instagram</option><option>WhatsApp</option></select></div>
      <div><label>Daily send cap</label><input id="dmCap" type="number" min="1" placeholder="30"></div>
    </div>
    <label>Reply template — variables: {name} {service} {price}</label>
    <textarea id="dmReply" rows="3" placeholder="Salam {name}! ..."></textarea>
    <button class="btn primary" id="dmAdd" style="margin-top:12px">+ Add rule</button>
  </div>
  <div class="card">
    <b>Log incoming lead → Pipeline</b>
    <div class="row" style="margin-top:10px">
      <div><label>Name / handle</label><input id="leadName" placeholder="@restaurant_muscat"></div>
      <div><label>Channel</label><select id="leadChannel"><option>Instagram</option><option>WhatsApp</option></select></div>
      <div><label>Keyword matched</label><input id="leadKeyword" placeholder="price"></div>
    </div>
    <label>Notes</label><input id="leadNotes" placeholder="Asked for restaurant website pricing">
    <button class="btn primary" id="leadAdd" style="margin-top:12px">→ Create Lead in Pipeline</button>
    <div style="margin-top:12px">
      ${D.leads.length === 0 ? `<div class="empty">No leads logged yet — this is how the loop feeds the money pipeline.</div>` :
        [...D.leads].reverse().slice(0, 10).map(l => `<div class="list-item"><div class="grow"><div class="t">${esc(l.name)} <span class="pill c">${esc(l.channel)}</span></div>
          <div class="s">${l.date} · matched “${esc(l.keyword)}”${l.notes ? " · " + esc(l.notes) : ""}</div></div></div>`).join("")}
    </div>
  </div>
  <div class="card">
    <div class="flex-between"><b>Loop config</b><button class="btn sm" id="dmExport">⬇ Export loop config (JSON)</button></div>
    <div class="note">Loop config also lives inside state.dmloop, so it is included automatically in the full backup export.</div>
  </div>`;
}

function viewTasks() {
  return `
  <h2 class="sec">Tasks</h2>
  <div class="card">
    <b>New task</b>
    <div class="row" style="margin-top:10px">
      <div><label>Task</label><input id="tTitle" placeholder="e.g. Send proposal to Al Zawiya"></div>
      <div><label>Agent</label><input id="tAgent" placeholder="e.g. Agent A-03"></div>
      <div><label>Squad</label><select id="tSquad">${SQUADS.map(s => `<option>${s}</option>`).join("")}</select></div>
    </div>
    <button class="btn primary" id="addTask" style="margin-top:14px">+ Create task</button>
  </div>
  <div class="card"><b>${state.tasks.filter(t => !t.done).length} open · ${state.tasks.length} total</b>
    <div style="margin-top:12px">
      ${state.tasks.length === 0 ? `<div class="empty">No tasks yet.</div>` :
        [...state.tasks].sort((a, b) => a.done - b.done).map(t => `
        <div class="task-item ${t.done ? "done" : ""}" data-task="${t.id}">
          <div class="check ${t.done ? "done" : ""}" style="padding:0;border:none"><div class="box">✓</div></div>
          <div class="grow"><div class="t tt">${esc(t.title)}</div>
            <div class="s">${esc(t.agent || "Unassigned")} · <span class="pill v">${t.squad}</span></div></div>
          <button class="btn sm ghost" data-deltask="${t.id}">✕</button>
        </div>`).join("")}
    </div>
  </div>`;
}

function viewSettings() {
  const s = state.settings;
  const last = s.lastBackup ? new Date(s.lastBackup).toLocaleString() : "never";
  const stale = !s.lastBackup || (Date.now() - new Date(s.lastBackup).getTime()) > 7 * 864e5;
  return `
  <h2 class="sec">Settings & Backup</h2>
  ${stale ? `<div class="notice">⚠ ${s.lastBackup ? "Your last backup is over 7 days old" : "You have never exported a backup"} — export now to protect your data.</div>`
          : `<div class="notice ok">Backup is fresh. Last export: ${esc(last)}</div>`}
  <div class="card">
    <b>Never-Zero Backup</b>
    <div class="note">Last backup: ${esc(last)}${s.lastSync ? " · Last cloud sync: " + esc(new Date(s.lastSync).toLocaleString()) : ""}</div>
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:12px">
      <button class="btn primary" id="exportBtn">⬇ Export Full Backup (JSON)</button>
      <label class="btn" style="cursor:pointer">⬆ Import / Restore<input type="file" id="importFile" accept=".json,application/json" style="display:none"></label>
    </div>
    <div class="note">One JSON contains everything: tasks, finance, brain studies, pipeline, checklist & settings.</div>
  </div>
  <div class="card">
    <b>Cloud Sync (optional — Supabase)</b>
    <div class="note">1) Create a free project at supabase.com. 2) In the SQL editor run:</div>
    <pre class="sql">create table kv (id text primary key, data jsonb);
alter table kv enable row level security;
create policy "open" on kv for all using (true) with check (true);</pre>
    <div class="note">3) Paste your Project URL and anon public key below. Falls back to local storage if unreachable.</div>
    <label>Supabase URL</label><input id="supaUrl" placeholder="https://xyz.supabase.co" value="${esc(s.supaUrl)}">
    <label>Anon key</label><input id="supaKey" type="password" placeholder="eyJhbGciOi…" value="${esc(s.supaKey)}">
    <div class="row" style="margin-top:12px">
      <button class="btn" id="saveSupa">Save sync settings</button>
      <button class="btn ${s.syncOn ? "primary" : ""}" id="toggleSync">${s.syncOn ? "Sync: ON" : "Sync: OFF"}</button>
      <button class="btn ghost" id="pullSync">Pull from cloud</button>
    </div>
  </div>
  <div class="card">
    <b>AI Lady Voice — ElevenLabs (optional, premium)</b>
    <div class="note">Without a key, replies use your device's best female voice (free). With a key, replies are spoken by a premium ElevenLabs voice. Only the reply text is ever sent.</div>
    <label>ElevenLabs API key</label><input id="elevenKey" type="password" placeholder="sk_…" value="${esc(s.elevenKey)}">
    <label>Voice ID (default: Rachel — female)</label><input id="elevenVoice" placeholder="21m00Tcm4TlvDq8ikWAM" value="${esc(s.elevenVoice)}">
    <div class="row" style="margin-top:12px">
      <button class="btn" id="saveEleven">Save voice settings</button>
      <button class="btn ghost" id="testEleven">Test voice</button>
    </div>
  </div>
  <div class="card">
    <b>DM Loop — Booking Link</b>
    <div class="note">Used by the "book/meeting" auto-reply rule (the {service} variable).</div>
    <label>Zoom / Calendly booking link</label><input id="bookingLink" placeholder="https://calendly.com/sultan-qimmah/15min" value="${esc(s.bookingLink)}">
    <div style="margin-top:12px"><button class="btn" id="saveBooking">Save booking link</button></div>
  </div>
  <div class="card">
    <div class="flex-between"><b>24/7 Laptop Daemon (optional)</b>
      ${s.lastDaemon ? `<span class="pill g">Daemon last ran: ${esc(new Date(s.lastDaemon).toLocaleString())}</span>` : `<span class="pill a">daemon not detected yet</span>`}
    </div>
    <div class="note">While this tab is open, agents already train automatically every day. With your laptop always on and this daemon running, agents train at midnight <b>even if the browser is closed</b> — it writes results to your Supabase, and your phone picks them up via cloud sync.</div>
    <div class="note"><b>3 steps:</b> 1) Download the script below. 2) Run <span class="mono">python3 agent_daemon.py</span> (asks for your Supabase URL + key once, saves them to daemon_config.json). 3) Leave the terminal open — or add it to your laptop's startup apps. Uses only Python's standard library — nothing to install.</div>
    <div style="margin-top:12px"><button class="btn primary" id="daemonBtn">⬇ Download agent_daemon.py</button></div>
    <div class="note">Requires Cloud Sync (Supabase) set up above — the daemon reads/writes the same <span class="mono">kv</span> table row <span class="mono">qimmah_state</span>.</div>
  </div>
  <div class="card">
    <div class="flex-between"><b>Owner</b><span class="owner-badge" style="margin:0">Sultan — OWNER</span></div>
    <div style="margin-top:14px"><button class="btn danger" id="resetAll">Sign out & reset ALL data</button></div>
  </div>`;
}

/* ============ 24/7 DAEMON SCRIPT ============ */
function daemonScript() {
  // Self-contained Python daemon (stdlib only) that applies the same daily XP
  // cycle to all 60 agents and syncs state to the user's Supabase kv table.
  return '#!/usr/bin/env python3\n' + `"""Qimmah Digital - 24/7 Agent Daemon
Runs one daily XP training cycle for all 60 agents and syncs state to Supabase,
so agents train at midnight even when the browser is closed. Your phone picks
the results up via the app's normal cloud sync.

Setup: run 'python3 agent_daemon.py' once - it asks for your Supabase URL and
anon key and saves them to daemon_config.json next to this script.
Requires: Python 3.6+ standard library ONLY. No pip installs.
"""
import json, os, random, sys, time, urllib.request, urllib.error
from datetime import date, datetime, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
CONFIG = os.path.join(HERE, "daemon_config.json")
INTERVAL = 24 * 3600  # run every 24h (and once on start)

INSIGHTS = [
    "{name} refined their {skill} playbook - response quality up after studying yesterday's wins.",
    "{name} found a faster {skill} workflow and shared it with the whole squad.",
    "{name} leveled up their {skill}: cut task time by batching similar requests.",
    "{name} cross-trained with a squadmate and added a new {skill} variation.",
    "{name} reviewed failed attempts and patched 2 weak spots in their {skill} routine.",
    "{name} hit a personal best - {skill} output quality trending upward all week.",
]

def log(msg):
    print("[" + datetime.now().strftime("%Y-%m-%d %H:%M:%S") + "] " + msg, flush=True)

def load_config():
    cfg = {}
    if os.path.exists(CONFIG):
        try:
            cfg = json.load(open(CONFIG))
        except Exception:
            cfg = {}
    if not cfg.get("supaUrl") or not cfg.get("supaKey"):
        print("First run - enter your Supabase credentials (same as app Settings > Cloud Sync).")
        cfg["supaUrl"] = input("Supabase URL (https://xyz.supabase.co): ").strip()
        cfg["supaKey"] = input("Anon key: ").strip()
        json.dump(cfg, open(CONFIG, "w"), indent=2)
        log("Saved " + CONFIG)
    return cfg

def api(cfg, method, path, body=None):
    req = urllib.request.Request(
        cfg["supaUrl"].rstrip("/") + "/rest/v1/kv" + path,
        method=method,
        headers={"apikey": cfg["supaKey"], "Authorization": "Bearer " + cfg["supaKey"],
                 "Content-Type": "application/json", "Prefer": "resolution=merge-duplicates"},
        data=json.dumps(body).encode() if body is not None else None)
    with urllib.request.urlopen(req, timeout=30) as r:
        raw = r.read().decode()
        return json.loads(raw) if raw else None

def run_cycle():
    cfg = load_config()
    rows = api(cfg, "GET", "?id=eq.qimmah_state&select=data")
    if not rows:
        log("No state row found in Supabase yet - open the app and enable sync first.")
        return
    state = rows[0]["data"]
    agents = (state.get("agents") or {})
    alist = agents.get("list") or []
    if not alist:
        log("No agents found in state - open the app once so it seeds the 60 agents.")
        return
    today = date.today().isoformat()
    if agents.get("lastDaemonDate") == today:
        log("Already trained today (" + today + ") - nothing to do.")
        return
    top, top_gain = None, -1
    for a in alist:
        gain = 15 + random.randint(0, 24)  # 15-39 XP/day (same as app)
        a["xp"] = int(a.get("xp", 0)) + gain
        a["level"] = a["xp"] // 100 + 1
        a["daysTrained"] = int(a.get("daysTrained", 0)) + 1
        if gain > top_gain:
            top, top_gain = a, gain
    insight = random.choice(INSIGHTS).replace("{name}", top["name"]).replace("{skill}", top.get("skill", ""))
    alog = agents.setdefault("log", [])
    alog.append({"date": today, "agentId": top["id"], "name": top["name"], "squad": top.get("squad", ""),
                 "gain": top_gain, "level": top["level"], "insight": insight})
    del alog[:-90]  # cap log at 90
    agents["lastDaemonDate"] = today
    agents["lastImprovementDate"] = today
    agents["lastTrainingAt"] = datetime.now(timezone.utc).isoformat()
    state.setdefault("settings", {})["lastDaemon"] = datetime.now(timezone.utc).isoformat()
    api(cfg, "POST", "", {"id": "qimmah_state", "data": state})
    log("Training done: %d agents, top = %s +%d XP (Lv %d). Synced to Supabase." %
        (len(alist), top["name"], top_gain, top["level"]))

def main():
    log("Qimmah 24/7 daemon started. Ctrl+C to stop.")
    while True:
        try:
            run_cycle()
        except urllib.error.URLError as e:
            log("Network error (will retry tomorrow): " + str(e))
        except Exception as e:
            log("Error (will retry tomorrow): " + repr(e))
        time.sleep(INTERVAL)

if __name__ == "__main__":
    main()
`;
}
function downloadDaemon() {
  const blob = new Blob([daemonScript()], { type: "text/x-python" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "agent_daemon.py";
  a.click(); URL.revokeObjectURL(a.href);
  toast("agent_daemon.py downloaded ✓");
}

/* ============ RENDER ============ */
function render() {
  renderTabs();
  const v = document.getElementById("view");
  v.innerHTML = { overview: viewOverview, agents: viewAgents, brain: viewBrain, ceo: viewCEO, finance: viewFinance, pipeline: viewPipeline, dmloop: viewDmloop, tasks: viewTasks, settings: viewSettings }[activeTab]();
  bind();
  const box = document.getElementById("chatBox");
  if (box) box.scrollTop = box.scrollHeight;
  const lastAi = state.chat.length && state.chat[state.chat.length - 1];
  const badge = document.getElementById("reuseBadge");
  if (badge && lastAi && lastAi.usedStudies) badge.innerHTML = `<span class="badge-reuse">Using ${lastAi.usedStudies} past studies</span>`;
}

/* ============ EVENTS ============ */
function bind() {
  document.querySelectorAll("[data-tab]").forEach(b => b.onclick = () => { activeTab = b.dataset.tab; render(); });

  // Brain
  const addQ = () => {
    const inp = document.getElementById("studyTopic");
    if (inp && inp.value.trim()) { viewBrain.queue.push(inp.value.trim()); render(); }
  };
  const at = document.getElementById("addTopic"); if (at) at.onclick = addQ;
  const st = document.getElementById("studyTopic"); if (st) st.onkeydown = e => { if (e.key === "Enter") addQ(); };
  document.querySelectorAll("[data-sug]").forEach(b => b.onclick = () => { viewBrain.queue.push(b.dataset.sug); render(); });
  document.querySelectorAll("[data-dq]").forEach(b => b.onclick = () => { viewBrain.queue.splice(+b.dataset.dq, 1); render(); });
  document.querySelectorAll("[data-run]").forEach(b => b.onclick = () => { const t = viewBrain.queue.splice(+b.dataset.run, 1)[0]; runStudy(t); });
  const rs = document.getElementById("runStudy");
  if (rs) rs.onclick = () => {
    if (!viewBrain.queue.length) { toast("Queue a topic first"); return; }
    runStudy(viewBrain.queue.shift());
  };
  const ss = document.getElementById("studySearch");
  if (ss) ss.oninput = () => { viewBrain.q = ss.value; const pos = ss.selectionStart; render(); const n = document.getElementById("studySearch"); n.focus(); n.setSelectionRange(pos, pos); };
  document.querySelectorAll("[data-card]").forEach(c => c.onclick = e => {
    if (e.target.dataset.delstudy) return;
    c.classList.toggle("open");
  });
  document.querySelectorAll("[data-delstudy]").forEach(b => b.onclick = e => {
    e.stopPropagation();
    if (confirm("Delete this study card?")) { state.studies = state.studies.filter(x => x.id !== b.dataset.delstudy); save(); render(); }
  });

  // CEO
  const sk = document.getElementById("saveKey");
  if (sk) sk.onclick = () => {
    state.settings.groqKey = document.getElementById("groqKey").value.trim();
    save(); render(); toast(state.settings.groqKey ? "Groq key saved ✓" : "Key removed");
  };
  const send = () => { const i = document.getElementById("chatInput"); if (i && i.value.trim()) sendChat(i.value.trim()); };
  const sc = document.getElementById("sendChat"); if (sc) sc.onclick = send;
  const ci = document.getElementById("chatInput"); if (ci) ci.onkeydown = e => { if (e.key === "Enter") send(); };
  const br = document.getElementById("briefing");
  if (br) br.onclick = () => { state.chat.push({ role: "ai", content: buildBriefing() }); save(); render(); };
  const sb = document.getElementById("shareBriefing");
  if (sb) sb.onclick = async () => {
    const text = buildBriefing();
    try {
      if (navigator.share) { await navigator.share({ title: "Qimmah Daily Briefing", text }); toast("Briefing shared ✓"); }
      else throw new Error("no share");
    } catch (e) {
      try { await navigator.clipboard.writeText(text); toast("Briefing copied — paste into WhatsApp"); }
      catch (e2) { toast("Could not share — copy it manually"); }
    }
  };
  const mb = document.getElementById("micBtn");
  if (mb) mb.onclick = startListening;
  const vt = document.getElementById("voiceToggle");
  if (vt) vt.onclick = () => {
    state.settings.voiceOn = !state.settings.voiceOn;
    if (!state.settings.voiceOn && "speechSynthesis" in window) speechSynthesis.cancel();
    save(); render();
  };
  const vp = document.getElementById("voicePick");
  if (vp) vp.onchange = () => { state.settings.voiceName = vp.value; save(); toast("Voice selected ✓"); };
  const tv = document.getElementById("testVoice");
  if (tv) tv.onclick = testVoice;
  document.querySelectorAll("[data-speak]").forEach(b => b.onclick = () => {
    const m = state.chat[+b.dataset.speak];
    if (m) { const wasOff = !state.settings.voiceOn; state.settings.voiceOn = true; speakReply(m.content); state.settings.voiceOn = wasOff ? false : true; }
  });

  // Finance
  const ax = document.getElementById("addTx");
  if (ax) ax.onclick = () => {
    const amt = parseFloat(document.getElementById("fAmt").value);
    const label = document.getElementById("fLabel").value.trim();
    if (!amt || !label) { toast("Enter amount and label"); return; }
    state.finance.push({ id: uid(), amount: amt, label, date: document.getElementById("fDate").value || today(), type: document.getElementById("fType").value, squad: document.getElementById("fSquad").value });
    save(); render(); toast("Transaction logged ✓");
  };
  document.querySelectorAll("[data-deltx]").forEach(b => b.onclick = () => {
    state.finance = state.finance.filter(f => f.id !== b.dataset.deltx); save(); render();
  });

  // Pipeline
  const ac = document.getElementById("addClient");
  if (ac) ac.onclick = () => {
    const name = document.getElementById("pName").value.trim();
    if (!name) { toast("Enter a client name"); return; }
    state.pipeline.push({ id: uid(), name, value: parseFloat(document.getElementById("pValue").value) || 0, stage: document.getElementById("pStage").value, notes: document.getElementById("pNotes").value.trim() });
    save(); render(); toast("Client added ✓");
  };
  document.querySelectorAll("[data-move]").forEach(b => b.onclick = () => {
    const [id, dir] = b.dataset.move.split(":");
    const c = state.pipeline.find(p => p.id === id);
    const i = STAGES.indexOf(c.stage);
    c.stage = STAGES[Math.min(STAGES.length - 1, Math.max(0, i + Number(dir)))];
    save(); render();
  });
  document.querySelectorAll("[data-delclient]").forEach(b => b.onclick = () => {
    if (confirm("Remove this client?")) { state.pipeline = state.pipeline.filter(p => p.id !== b.dataset.delclient); save(); render(); }
  });

  // DM Loop
  const dp = document.getElementById("dmPause");
  if (dp) dp.onclick = () => { state.dmloop.pauseAll = !state.dmloop.pauseAll; save(); render(); toast(state.dmloop.pauseAll ? "DM loop paused" : "DM loop live"); };
  const dmSaveSafety = () => {
    const c = document.getElementById("dmCooldown"); if (c) state.dmloop.cooldownMin = Math.max(0, parseInt(c.value, 10) || 0);
    const bh = document.getElementById("dmBH"); if (bh) state.dmloop.businessHoursOnly = bh.value === "on";
    const s1 = document.getElementById("dmBHStart"); if (s1) state.dmloop.bhStart = s1.value || "09:00";
    const s2 = document.getElementById("dmBHEnd"); if (s2) state.dmloop.bhEnd = s2.value || "21:00";
    save();
  };
  ["dmCooldown", "dmBH", "dmBHStart", "dmBHEnd"].forEach(id => {
    const el = document.getElementById(id); if (el) el.onchange = () => { dmSaveSafety(); toast("Safety settings saved ✓"); };
  });
  const da = document.getElementById("dmAdd");
  if (da) da.onclick = () => {
    const keyword = document.getElementById("dmKeyword").value.trim().toLowerCase();
    const reply = document.getElementById("dmReply").value.trim();
    if (!keyword || !reply) { toast("Enter keyword and reply template"); return; }
    state.dmloop.rules.push({
      id: uid(), keyword,
      channel: document.getElementById("dmChannel").value,
      dailyCap: parseInt(document.getElementById("dmCap").value, 10) || 30,
      enabled: true, reply
    });
    save(); render(); toast("Rule added ✓");
  };
  document.querySelectorAll("[data-dmtoggle]").forEach(b => b.onchange = () => {
    const r = state.dmloop.rules.find(x => x.id === b.dataset.dmtoggle);
    if (r) { r.enabled = b.checked; save(); render(); }
  });
  const dmMove = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= state.dmloop.rules.length) return;
    const [r] = state.dmloop.rules.splice(i, 1);
    state.dmloop.rules.splice(j, 0, r);
    save(); render();
  };
  document.querySelectorAll("[data-dmup]").forEach(b => b.onclick = () => dmMove(+b.dataset.dmup, -1));
  document.querySelectorAll("[data-dmdown]").forEach(b => b.onclick = () => dmMove(+b.dataset.dmdown, 1));
  document.querySelectorAll("[data-dmdel]").forEach(b => b.onclick = () => {
    if (confirm("Delete this rule?")) { state.dmloop.rules = state.dmloop.rules.filter(x => x.id !== b.dataset.dmdel); save(); render(); }
  });
  document.querySelectorAll("[data-dmedit]").forEach(b => b.onclick = () => {
    const r = state.dmloop.rules.find(x => x.id === b.dataset.dmedit);
    if (!r) return;
    const kw = prompt("Keyword / phrase:", r.keyword); if (kw == null) return;
    const rp = prompt("Reply template ({name} {service} {price}):", r.reply); if (rp == null) return;
    const cap = prompt("Daily send cap (number):", String(r.dailyCap || 30)); if (cap == null) return;
    if (kw.trim()) r.keyword = kw.trim().toLowerCase();
    if (rp.trim()) r.reply = rp.trim();
    r.dailyCap = parseInt(cap, 10) || r.dailyCap || 30;
    save(); render(); toast("Rule updated ✓");
  });
  document.querySelectorAll("[data-dmai]").forEach(b => b.onclick = async () => {
    const r = state.dmloop.rules.find(x => x.id === b.dataset.dmai);
    if (!r) return;
    if (!state.settings.groqKey) { toast("Add a Groq key in AI CEO tab first"); return; }
    b.disabled = true; b.textContent = "Drafting…"; b.classList.add("spin");
    try {
      const txt = await groq([
        { role: "system", content: CEO_SYSTEM + " Write ONE short WhatsApp/Instagram DM auto-reply (max 45 words) for the trigger keyword given. Friendly Omani-business tone, may use variables {name}, {service}, {price}. Reply with ONLY the message text." },
        { role: "user", content: "Trigger keyword: \"" + r.keyword + "\". Channel: " + r.channel + ". Current draft: " + r.reply }
      ], 160);
      const clean = String(txt).trim().replace(/^["']|["']$/g, "");
      if (clean) { r.reply = clean; save(); render(); toast("AI reply drafted ✓"); }
    } catch (e) {
      console.warn("AI draft failed, kept template:", e);
      toast("AI failed — kept existing template");
      render();
    }
  });
  const la = document.getElementById("leadAdd");
  if (la) la.onclick = () => {
    const name = document.getElementById("leadName").value.trim();
    if (!name) { toast("Enter a name or handle"); return; }
    const channel = document.getElementById("leadChannel").value;
    const keyword = document.getElementById("leadKeyword").value.trim();
    const notes = document.getElementById("leadNotes").value.trim();
    state.dmloop.leads.push({ id: uid(), name, channel, keyword, notes, date: today() });
    state.pipeline.push({ id: uid(), name: name + " (" + channel + " DM)", value: 0, stage: "Lead",
      notes: "DM loop lead · matched “" + (keyword || "manual") + "”" + (notes ? " · " + notes : "") });
    save(); render(); toast("Lead added to Pipeline ✓");
  };
  const de = document.getElementById("dmExport");
  if (de) de.onclick = () => {
    const blob = new Blob([JSON.stringify(state.dmloop, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "qimmah-dmloop-" + today() + ".json";
    a.click(); URL.revokeObjectURL(a.href);
    toast("Loop config downloaded ✓");
  };

  // Tasks
  const adk = document.getElementById("addTask");
  if (adk) adk.onclick = () => {
    const title = document.getElementById("tTitle").value.trim();
    if (!title) { toast("Enter a task title"); return; }
    state.tasks.push({ id: uid(), title, agent: document.getElementById("tAgent").value.trim(), squad: document.getElementById("tSquad").value, done: false });
    save(); render(); toast("Task created ✓");
  };
  document.querySelectorAll("[data-task]").forEach(el => el.onclick = e => {
    if (e.target.dataset.deltask) return;
    const t = state.tasks.find(x => x.id === el.dataset.task); t.done = !t.done; save(); render();
  });
  document.querySelectorAll("[data-deltask]").forEach(b => b.onclick = e => {
    e.stopPropagation(); state.tasks = state.tasks.filter(t => t.id !== b.dataset.deltask); save(); render();
  });

  // Settings
  const ex = document.getElementById("exportBtn");
  if (ex) ex.onclick = () => {
    state.settings.lastBackup = new Date().toISOString();
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "qimmah-backup-" + today() + ".json";
    a.click(); URL.revokeObjectURL(a.href);
    save(); render(); toast("Backup downloaded ✓");
  };
  const im = document.getElementById("importFile");
  if (im) im.onchange = () => {
    const f = im.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const j = JSON.parse(r.result);
        if (!j || typeof j !== "object" || !("finance" in j || "tasks" in j || "studies" in j)) throw new Error("not a Qimmah backup");
        state = Object.assign(defaultState(), j);
        state.settings = Object.assign(defaultState().settings, j.settings || {});
        ensureDmloop(); ensureAgents(); runDailyImprovement();
        save(); render(); toast("Backup restored ✓");
      } catch (e) { toast("Import failed: " + e.message); }
    };
    r.readAsText(f);
  };
  const ss2 = document.getElementById("saveSupa");
  if (ss2) ss2.onclick = () => {
    state.settings.supaUrl = document.getElementById("supaUrl").value.trim();
    state.settings.supaKey = document.getElementById("supaKey").value.trim();
    save(); toast("Sync settings saved");
  };
  const tg = document.getElementById("toggleSync");
  if (tg) tg.onclick = () => {
    state.settings.syncOn = !state.settings.syncOn;
    save(); render();
    if (state.settings.syncOn) syncPush();
  };
  const ps = document.getElementById("pullSync"); if (ps) ps.onclick = syncPull;
  const se = document.getElementById("saveEleven");
  if (se) se.onclick = () => {
    state.settings.elevenKey = document.getElementById("elevenKey").value.trim();
    state.settings.elevenVoice = document.getElementById("elevenVoice").value.trim() || "21m00Tcm4TlvDq8ikWAM";
    save(); toast("Voice settings saved ✓");
  };
  const te = document.getElementById("testEleven"); if (te) te.onclick = testVoice;
  const sbl = document.getElementById("saveBooking");
  if (sbl) sbl.onclick = () => {
    state.settings.bookingLink = document.getElementById("bookingLink").value.trim();
    save(); toast("Booking link saved ✓");
  };
  const db = document.getElementById("daemonBtn"); if (db) db.onclick = downloadDaemon;
  const ra = document.getElementById("resetAll");
  if (ra) ra.onclick = () => {
    if (confirm("This permanently deletes ALL data on this device. Export a backup first. Continue?") &&
        confirm("Really reset everything? This cannot be undone.")) {
      state = defaultState(); state.pipeline = []; state.seeded = false;
      ensureAgents(); runDailyImprovement();
      save(); render(); toast("All data reset");
    }
  };
}

/* ============ INIT ============ */
load();
ensureDmloop();
ensureAgents();
runDailyImprovement(); // daily self-improvement cycle + catch-up for missed days
render();

// 24/7 always-on: while the app is open, check every 60s whether a new
// calendar day started and run the training cycle automatically.
let lastCycleDay = today();
setInterval(() => {
  if (today() !== lastCycleDay) {
    lastCycleDay = today();
    runDailyImprovement();
    if (activeTab === "agents" || activeTab === "overview") render();
    toast("New day — agents trained ✓");
  }
}, 60 * 1000);
