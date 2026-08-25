import { useState, useRef } from "react";
import { CheckCircle2, Circle, ListTodo, Plus, ChevronLeft, ChevronRight, Trash2, Wallet, FileText, Paperclip, Download, ExternalLink, Inbox, RefreshCw, Settings, Send } from "lucide-react";
import { PURPLE, CYAN, AGENTS, SQUAD_META, Card, SectionTitle, Stat, Empty, Field, glass, inputStyle, btnPrimary, btnGhost, uid, omr, timeAgo, lastMonths, REVENUE_TARGET, COLS, IN_PREVIEW, TOOL_CATALOG } from "./shared.jsx";
import { SquadCyclePanel, SquadDirectiveCards, FleetActivity } from "./squadcycle.jsx";
import { useRunnerStatus } from "./taskrunner.jsx";
/* ============================================================
   SQUAD TOOLKIT — static mirror of the MCP registry
   (TOOL_CATALOG in shared.jsx). Green = runs automatically,
   amber = requires human approval via the Pending Approvals card.
   ============================================================ */
export function SquadToolkit() {
  return (
    <Card style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <div style={{ fontSize: 11, letterSpacing: 2.5, textTransform: "uppercase", color: CYAN, fontWeight: 600 }}>Squad Toolkits · MCP</div>
        <div style={{ display: "flex", gap: 12, fontSize: 11, color: "#8B86A3" }}>
          <span><span style={{ color: "#34D399" }}>●</span> automatic</span>
          <span><span style={{ color: "#FBBF24" }}>●</span> needs approval</span>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
        {Object.entries(SQUAD_META).map(([sq, m]) => {
          const tools = TOOL_CATALOG.filter((t) => t.squads.includes(sq));
          return (
            <div key={sq} style={{ ...glass, padding: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: m.color, marginBottom: 8 }}>Squad {sq} · {m.role}</div>
              {tools.map((t) => (
                <div key={t.name} style={{ display: "flex", alignItems: "center", gap: 7, padding: "3px 0" }} title={t.desc}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", flexShrink: 0, background: t.approval ? "#FBBF24" : "#34D399", boxShadow: "0 0 6px " + (t.approval ? "#FBBF24" : "#34D399") }} />
                  <span style={{ fontSize: 12, color: "#C9C4DE", fontFamily: "monospace" }}>{t.name}</span>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/* ============================================================
   AGENTS — the 60-agent fleet
   ============================================================ */
export function Agents({ S, up, log, squadRunning, squadPhase, onRunSquadNow }) {
  const [filter, setFilter] = useState("All");
  const squads = ["All", "Alpha", "Beta", "Gamma", "Delta", "Epsilon"];
  const shown = AGENTS.filter((a) => filter === "All" || a.squad === filter);
  const activeCount = AGENTS.length - Object.keys(S.agentsOff).length;

  return (
    <div>
      <SectionTitle eyebrow="The Fleet" title="60 AI Agents · 5 Squads" sub="Toggle agents on or off based on live client needs. The AI CEO knows every one of them by code and specialty." />
      <SquadCyclePanel S={S} up={up} log={log} onRunNow={onRunSquadNow} running={squadRunning} phase={squadPhase} />
      <SquadToolkit />
      <FleetActivity S={S} />
      <SquadDirectiveCards S={S} />
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
const PRIORITIES = { High: "#F87171", Medium: "#FBBF24", Low: "#34D399" };

export function Tasks({ S, up, log }) {
  const [title, setTitle] = useState("");
  const [prio, setPrio] = useState("Medium");
  const [agentId, setAgentId] = useState("");
  const runner = useRunnerStatus();
  const runnerOn = S.runnerOn !== false;
  const openCount = S.tasks.filter((t) => t.col === "Backlog" || t.col === "In Progress").length;

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
      <Card style={{ marginBottom: 18, padding: 12, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, fontWeight: 600, color: runnerOn ? CYAN : "#8B86A3", cursor: "pointer" }}
          title="While this app is open, the fleet automatically works your board: In Progress tasks get executed and handed into Review.">
          <input type="checkbox" checked={runnerOn} style={{ accentColor: CYAN }}
            onChange={(e) => { up((s) => ({ ...s, runnerOn: e.target.checked })); log("runner", "Task auto-run turned " + (e.target.checked ? "ON" : "OFF")); }} />
          ⚙ Auto-run tasks
        </label>
        <span style={{ fontSize: 11.5, color: runner.working ? "#FFD27A" : "#8B86A3", display: "flex", alignItems: "center", gap: 7 }}>
          {runner.working && <span className="q-blink" style={{ width: 6, height: 6, borderRadius: "50%", background: "#FFB020", display: "inline-block" }} />}
          {!runnerOn
            ? "auto-run off — tasks wait for you"
            : runner.working
              ? "working on '" + (runner.title.length > 36 ? runner.title.slice(0, 34) + "…" : runner.title) + "'" + (runner.remaining > 0 ? " · " + runner.remaining + " to go" : "")
              : openCount > 0
                ? "idle — " + openCount + " task" + (openCount > 1 ? "s" : "") + " queued"
                : "idle — board clear"}
        </span>
      </Card>
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
                        {t.resultId && (
                          <div style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 700, letterSpacing: 0.5, padding: "2px 8px", borderRadius: 20, background: "rgba(34,211,238,0.12)", color: "#22D3EE", border: "1px solid rgba(34,211,238,0.35)", marginBottom: 6 }}
                            title="The agent's finished deliverable is saved in the Results tab">
                            📦 deliverable in Results
                          </div>
                        )}
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
export function Finance({ S, up, log }) {
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
    // Guard: cycling Draft→Sent→Paid wraps around, so without a flag a second
    // pass through "Paid" would book the same income twice.
    const bookNow = next === "Paid" && !i.booked;
    up((s) => ({
      ...s,
      invoices: s.invoices.map((x) => (x.id === i.id ? { ...x, status: next, booked: x.booked || bookNow } : x)),
      transactions: bookNow
        ? [{ id: uid(), desc: "Invoice paid — " + i.client, amount: i.amount, type: "income", date: new Date().toISOString().slice(0, 10) }, ...s.transactions]
        : s.transactions,
    }));
    if (bookNow) log("finance", "Invoice paid: " + i.client + " — " + omr(i.amount));
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

export function Contracts({ S, up, log }) {
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
    // Guard: the flow wraps around, so without a flag a second pass through
    // "Signed" would draft a duplicate invoice and overwrite the signed date.
    const draftNow = next === "Signed" && !c.invoiced;
    up((s) => ({
      ...s,
      contracts: s.contracts.map((x) => (x.id === c.id
        ? { ...x, status: next, invoiced: x.invoiced || draftNow, signedDate: draftNow ? new Date().toISOString().slice(0, 10) : x.signedDate }
        : x)),
      invoices: draftNow
        ? [{ id: uid(), client: c.client, amount: c.value, status: "Draft", date: new Date().toISOString().slice(0, 10) }, ...s.invoices]
        : s.invoices,
    }));
    if (draftNow) {
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

export function Leads({ S, up, log }) {
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
        up((s) => ({ ...s, leads: [...fresh.map((l) => ({ id: l.id, name: String(l.name || "").slice(0, 80), contact: String(l.contact || "").slice(0, 120), message: String(l.message || "").slice(0, 1000), source: String(l.source || "website").slice(0, 40), ts: Number(l.ts) || Date.now(), status: "New" })), ...(s.leads || [])] }));
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
