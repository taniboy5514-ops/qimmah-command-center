/**
 * backend/lib/mcp/registry.js
 * MCP-compatible tool registry for the 60-agent fleet.
 *
 * Each tool is an MCP-style object:
 *   { name, description, squadAccess, requiresApproval, costEstimate,
 *     rateLimit: { maxCalls, windowMs }, parameters: <JSON Schema>, handler }
 *
 * Handler signature: (args, context) where context is
 *   { workspaceId, agentId, agentName, squadCode, userId, cycleId }
 * Handlers log to the workspace feed (via logFeed) and return a structured
 * result object. WhatsApp/Instagram handlers are structured for the real
 * Meta APIs: they read workspace integration settings (settings table,
 * key 'integrations') and, when no live credentials exist, return a
 * structured mock success so the rest of the pipeline can be tested end to end.
 */
import { assertSupabase, logFeed } from "../supabase.js";
import { callGroq } from "../groq.js";

/** Read workspace settings row, tolerating a missing table/row. */
async function getSetting(workspaceId, key) {
  try {
    const db = assertSupabase();
    const { data, error } = await db.from("settings").select("value")
      .eq("workspace_id", workspaceId).eq("key", key).maybeSingle();
    if (error) return null;
    return data?.value || null;
  } catch {
    return null;
  }
}

const jsonString = (description, opts = {}) => ({ type: "string", description, ...opts });
const jsonNumber = (description, opts = {}) => ({ type: "number", description, ...opts });

/* ------------------------------------------------------------------ */
/* Individual handlers                                                 */
/* ------------------------------------------------------------------ */

async function handleSendWhatsapp(args, context) {
  const { workspaceId, agentName } = context;
  const integ = await getSetting(workspaceId, "integrations");
  const wa = integ?.whatsapp || {};
  await logFeed(workspaceId, "tool", `${agentName} composed WhatsApp message to ${args.to}: "${String(args.message).slice(0, 80)}"`);
  if (wa.token && wa.phoneNumberId) {
    // Real Meta WhatsApp Business API call — activated when credentials are stored.
    const res = await fetch(`https://graph.facebook.com/v21.0/${wa.phoneNumberId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + wa.token },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: String(args.to).replace(/[^0-9]/g, ""),
        type: "text",
        text: { body: args.message },
      }),
    });
    if (!res.ok) throw new Error(`WhatsApp API ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const json = await res.json();
    return { delivered: true, live: true, to: args.to, messageId: json?.messages?.[0]?.id || null };
  }
  return { delivered: true, live: false, mock: true, to: args.to, note: "WhatsApp Business API credentials not configured — message logged as mock success." };
}

async function handleSendInstagramDm(args, context) {
  const { workspaceId, agentName } = context;
  const integ = await getSetting(workspaceId, "integrations");
  const ig = integ?.instagram || {};
  await logFeed(workspaceId, "tool", `${agentName} composed Instagram DM to ${args.recipientId}: "${String(args.message).slice(0, 80)}"`);
  if (ig.token && ig.appId) {
    const res = await fetch(`https://graph.facebook.com/v21.0/${ig.appId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + ig.token },
      body: JSON.stringify({ recipient: { id: args.recipientId }, message: { text: args.message } }),
    });
    if (!res.ok) throw new Error(`Instagram API ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return { delivered: true, live: true, to: args.recipientId };
  }
  return { delivered: true, live: false, mock: true, to: args.recipientId, note: "Instagram API credentials not configured — message logged as mock success." };
}

async function handleCreateLead(args, context) {
  const db = assertSupabase();
  const { data, error } = await db.from("leads").insert({
    workspace_id: context.workspaceId,
    name: args.name, company: args.company || null, channel: args.channel || null,
    value: args.value ?? null, notes: args.notes || null, status: "new",
  }).select().single();
  if (error) throw new Error(error.message);
  await logFeed(context.workspaceId, "tool", `${context.agentName} created lead: ${args.name}`);
  return { leadId: data.id, status: data.status };
}

async function handleUpdateLeadStatus(args, context) {
  const db = assertSupabase();
  const { data, error } = await db.from("leads")
    .update({ status: args.status, ...(args.notes ? { notes: args.notes } : {}) })
    .eq("id", args.leadId).eq("workspace_id", context.workspaceId).select().single();
  if (error) throw new Error(error.message);
  await logFeed(context.workspaceId, "tool", `${context.agentName} moved lead ${args.leadId} → ${args.status}`);
  return { leadId: data.id, status: data.status };
}

async function handleWebSearch(args, context) {
  // LLM-assisted web research via the existing Groq fallback chain.
  const sys = "You are a research analyst at Qimmah Digital (Oman). Answer the query with factual, current knowledge. " +
    "If you are unsure of live facts, say so honestly. Return 3-6 concise bullet findings plus 1-3 source suggestions.";
  const { content, model } = await callGroq(sys, [{ role: "user", content: args.query }]);
  await logFeed(context.workspaceId, "tool", `${context.agentName} researched: "${String(args.query).slice(0, 80)}" (model: ${model})`);
  return { query: args.query, findings: content, model, live: false, note: "LLM knowledge synthesis — not a live web crawl." };
}

async function handleStudyTopic(args, context) {
  const db = assertSupabase();
  const sys = "You are the AI CEO of Qimmah Digital studying a topic. Produce a structured brief: key facts, implications for the business, and 2-3 action items.";
  const { content, model } = await callGroq(sys, [{ role: "user", content: args.topic }]);
  const { data, error } = await db.from("studies").insert({
    workspace_id: context.workspaceId, topic: args.topic, brief: content, model,
  }).select().single();
  if (error) throw new Error(error.message);
  await logFeed(context.workspaceId, "study", `${context.agentName} completed a study on "${String(args.topic).slice(0, 80)}" (model: ${model})`);
  return { studyId: data.id, topic: args.topic, brief: content, model };
}

async function handleRecordTransaction(args, context) {
  const db = assertSupabase();
  const { data, error } = await db.from("transactions").insert({
    workspace_id: context.workspaceId,
    kind: args.kind, amount: args.amount, category: args.category || null,
    description: args.description || `Recorded by ${context.agentName}`,
  }).select().single();
  if (error) throw new Error(error.message);
  await logFeed(context.workspaceId, "finance", `${context.agentName} recorded ${args.kind} of OMR ${Number(args.amount).toFixed(3)}`);
  return { transactionId: data.id, kind: data.kind, amount: Number(data.amount) };
}

async function handleCreateInvoice(args, context) {
  const db = assertSupabase();
  const { data: inv, error } = await db.from("invoices").insert({
    workspace_id: context.workspaceId, client_name: args.clientName,
    due_date: args.dueDate || null, notes: args.notes || null,
  }).select().single();
  if (error) throw new Error(error.message);
  const items = (args.items || []).map((it) => ({
    workspace_id: context.workspaceId, invoice_id: inv.id,
    description: it.description, qty: it.qty ?? 1, unit_price: it.unitPrice ?? 0,
  }));
  if (items.length) {
    const { error: itErr } = await db.from("invoice_items").insert(items);
    if (itErr) throw new Error(itErr.message);
  }
  const total = items.reduce((s, it) => s + Number(it.qty) * Number(it.unit_price), 0);
  await logFeed(context.workspaceId, "finance", `${context.agentName} drafted invoice for ${args.clientName} (OMR ${total.toFixed(3)})`);
  return { invoiceId: inv.id, status: inv.status, total };
}

async function handleCreateTask(args, context) {
  const db = assertSupabase();
  const { data, error } = await db.from("tasks").insert({
    workspace_id: context.workspaceId, agent_id: context.agentId,
    title: args.title, priority: args.priority || "normal", status: "open",
  }).select().single();
  if (error) throw new Error(error.message);
  await logFeed(context.workspaceId, "tool", `${context.agentName} created task: ${args.title}`);
  return { taskId: data.id, status: data.status };
}

async function handleCompleteTask(args, context) {
  const db = assertSupabase();
  const { data, error } = await db.from("tasks")
    .update({ status: "done" })
    .eq("id", args.taskId).eq("workspace_id", context.workspaceId).select().single();
  if (error) throw new Error(error.message);
  await logFeed(context.workspaceId, "tool", `${context.agentName} completed task ${args.taskId}`);
  return { taskId: data.id, status: data.status };
}

const SECRET_PATTERNS = [/api[_-]?key/i, /secret/i, /token/i, /password/i, /service[_-]?role/i];

async function handleSelfEditCode(args, context) {
  const files = Array.isArray(args.files) ? args.files : [];
  if (!files.length || files.length > 3) throw new Error("self_edit_code accepts 1-3 files per call");
  for (const f of files) {
    if (f.deleted) throw new Error("self_edit_code never deletes files");
    const blob = `${f.path}\n${f.content || ""}`;
    for (const pat of SECRET_PATTERNS) {
      if (pat.test(blob)) throw new Error(`Blocked: ${f.path} appears to contain a secret reference (${pat})`);
    }
  }
  await logFeed(context.workspaceId, "tool", `${context.agentName} proposed self-edit of ${files.length} file(s): ${files.map((f) => f.path).join(", ")}`);
  // Commits are performed by the human-approved GitHub sync flow (src/github-sync.js).
  return { accepted: true, staged: files.map((f) => f.path), committed: false, note: "Edits staged; commit requires the approved GitHub connection flow." };
}

async function handleQueryAnalytics(args, context) {
  const db = assertSupabase();
  const ws = context.workspaceId;
  const metric = args.metric || "overview";
  const out = { metric };
  const [txRes, leadRes, taskRes] = await Promise.all([
    db.from("transactions").select("kind, amount, tx_date").eq("workspace_id", ws).order("tx_date", { ascending: false }).limit(200),
    db.from("leads").select("id, status, channel, value").eq("workspace_id", ws),
    db.from("tasks").select("id, status").eq("workspace_id", ws),
  ]);
  if (metric === "overview" || metric === "finance") {
    const txs = txRes.data || [];
    out.finance = {
      income: txs.filter((t) => t.kind === "income").reduce((s, t) => s + Number(t.amount), 0),
      expense: txs.filter((t) => t.kind === "expense").reduce((s, t) => s + Number(t.amount), 0),
    };
  }
  if (metric === "overview" || metric === "leads") {
    const leads = leadRes.data || [];
    out.leads = { total: leads.length, byStatus: leads.reduce((m, l) => ({ ...m, [l.status]: (m[l.status] || 0) + 1 }), {}) };
  }
  if (metric === "overview" || metric === "tasks") {
    const tasks = taskRes.data || [];
    out.tasks = { total: tasks.length, open: tasks.filter((t) => t.status !== "done").length };
  }
  await logFeed(ws, "tool", `${context.agentName} queried analytics (${metric})`);
  return out;
}

async function handleTestConnector(args, context) {
  const integ = await getSetting(context.workspaceId, "integrations");
  const name = args.connector;
  const cfg = (integ && integ[name]) || {};
  const configured = Object.values(cfg).some((v) => typeof v === "string" && v.trim());
  const result = { connector: name, configured, reachable: false, note: "" };
  if (configured && (name === "whatsapp" || name === "instagram") && cfg.token) {
    try {
      const res = await fetch("https://graph.facebook.com/v21.0/me", { headers: { Authorization: "Bearer " + cfg.token } });
      result.reachable = res.ok;
      result.note = res.ok ? "Meta API token accepted." : `Meta API returned ${res.status}.`;
    } catch (e) {
      result.note = "Network error: " + e.message;
    }
  } else {
    result.note = configured ? "Credentials stored; no live probe for this connector yet." : "No credentials stored — runs in mock mode.";
  }
  await logFeed(context.workspaceId, "tool", `${context.agentName} tested connector ${name}: ${result.reachable ? "OK" : "not live"}`);
  return result;
}

/* ------------------------------------------------------------------ */
/* Registry                                                            */
/* ------------------------------------------------------------------ */

const ALL_SQUADS = ["Alpha", "Beta", "Gamma", "Delta", "Epsilon"];

export const MCP_REGISTRY = [
  {
    name: "send_whatsapp_message",
    description: "Send a WhatsApp message via the WhatsApp Business API. Requires approval. Mock success when credentials are not configured.",
    squadAccess: ["Alpha", "Epsilon"],
    requiresApproval: true,
    costEstimate: 0.01,
    rateLimit: { maxCalls: 10, windowMs: 3600000 },
    parameters: {
      type: "object",
      properties: { to: jsonString("Recipient phone number (international format)"), message: jsonString("Message body") },
      required: ["to", "message"],
    },
    handler: handleSendWhatsapp,
  },
  {
    name: "send_instagram_dm",
    description: "Send an Instagram direct message via the Meta Instagram API. Requires approval. Mock success when credentials are not configured.",
    squadAccess: ["Alpha"],
    requiresApproval: true,
    costEstimate: 0.01,
    rateLimit: { maxCalls: 10, windowMs: 3600000 },
    parameters: {
      type: "object",
      properties: { recipientId: jsonString("Instagram-scoped user ID"), message: jsonString("Message body") },
      required: ["recipientId", "message"],
    },
    handler: handleSendInstagramDm,
  },
  {
    name: "create_lead",
    description: "Add a new lead to the workspace pipeline.",
    squadAccess: ALL_SQUADS,
    requiresApproval: false,
    costEstimate: 0,
    rateLimit: { maxCalls: 60, windowMs: 3600000 },
    parameters: {
      type: "object",
      properties: {
        name: jsonString("Lead contact name"),
        company: jsonString("Company name"),
        channel: jsonString("Acquisition channel"),
        value: jsonNumber("Estimated deal value (OMR)"),
        notes: jsonString("Free-form notes"),
      },
      required: ["name"],
    },
    handler: handleCreateLead,
  },
  {
    name: "update_lead_status",
    description: "Move a lead to a new pipeline status.",
    squadAccess: ["Alpha", "Epsilon"],
    requiresApproval: false,
    costEstimate: 0,
    rateLimit: { maxCalls: 60, windowMs: 3600000 },
    parameters: {
      type: "object",
      properties: {
        leadId: jsonString("Lead UUID"),
        status: jsonString("New status", { enum: ["new", "contacted", "qualified", "proposal", "won", "lost"] }),
        notes: jsonString("Optional note to append"),
      },
      required: ["leadId", "status"],
    },
    handler: handleUpdateLeadStatus,
  },
  {
    name: "web_search",
    description: "Research a query using the server-side Groq model fallback chain (LLM knowledge synthesis, not a live crawl).",
    squadAccess: ["Beta", "Gamma", "Delta"],
    requiresApproval: false,
    costEstimate: 0.002,
    rateLimit: { maxCalls: 30, windowMs: 3600000 },
    parameters: {
      type: "object",
      properties: { query: jsonString("Search query") },
      required: ["query"],
    },
    handler: handleWebSearch,
  },
  {
    name: "study_topic",
    description: "Produce a structured study brief on a topic via Groq and persist it to the knowledge base.",
    squadAccess: ["Beta", "Gamma", "Delta"],
    requiresApproval: false,
    costEstimate: 0.003,
    rateLimit: { maxCalls: 20, windowMs: 3600000 },
    parameters: {
      type: "object",
      properties: { topic: jsonString("Topic to study") },
      required: ["topic"],
    },
    handler: handleStudyTopic,
  },
  {
    name: "record_transaction",
    description: "Record an income or expense transaction. Requires approval.",
    squadAccess: ["Delta", "Epsilon"],
    requiresApproval: true,
    costEstimate: 0,
    rateLimit: { maxCalls: 30, windowMs: 3600000 },
    parameters: {
      type: "object",
      properties: {
        kind: jsonString("Transaction kind", { enum: ["income", "expense"] }),
        amount: jsonNumber("Amount (OMR, positive)"),
        category: jsonString("Category"),
        description: jsonString("Description"),
      },
      required: ["kind", "amount"],
    },
    handler: handleRecordTransaction,
  },
  {
    name: "create_invoice",
    description: "Draft an invoice with line items for a client. Requires approval.",
    squadAccess: ["Delta", "Epsilon"],
    requiresApproval: true,
    costEstimate: 0,
    rateLimit: { maxCalls: 20, windowMs: 3600000 },
    parameters: {
      type: "object",
      properties: {
        clientName: jsonString("Client name"),
        items: { type: "array", description: "Line items", items: { type: "object", properties: { description: { type: "string" }, qty: { type: "number" }, unitPrice: { type: "number" } }, required: ["description"] } },
        dueDate: jsonString("Due date (YYYY-MM-DD)"),
        notes: jsonString("Notes"),
      },
      required: ["clientName", "items"],
    },
    handler: handleCreateInvoice,
  },
  {
    name: "create_task",
    description: "Create a tracked task assigned to the calling agent.",
    squadAccess: ALL_SQUADS,
    requiresApproval: false,
    costEstimate: 0,
    rateLimit: { maxCalls: 60, windowMs: 3600000 },
    parameters: {
      type: "object",
      properties: {
        title: jsonString("Task title"),
        priority: jsonString("Priority", { enum: ["low", "normal", "high"] }),
      },
      required: ["title"],
    },
    handler: handleCreateTask,
  },
  {
    name: "complete_task",
    description: "Mark a task as done.",
    squadAccess: ALL_SQUADS,
    requiresApproval: false,
    costEstimate: 0,
    rateLimit: { maxCalls: 60, windowMs: 3600000 },
    parameters: {
      type: "object",
      properties: { taskId: jsonString("Task UUID") },
      required: ["taskId"],
    },
    handler: handleCompleteTask,
  },
  {
    name: "self_edit_code",
    description: "Propose edits to the Command Center codebase (max 3 files, no deletions, no secrets). Requires approval; commits go through the human-approved GitHub sync flow.",
    squadAccess: ["Delta"],
    requiresApproval: true,
    costEstimate: 0.005,
    rateLimit: { maxCalls: 5, windowMs: 3600000 },
    parameters: {
      type: "object",
      properties: {
        files: { type: "array", description: "1-3 file edits", maxItems: 3, items: { type: "object", properties: { path: { type: "string" }, content: { type: "string" } }, required: ["path", "content"] } },
        reason: jsonString("Why this change is needed"),
      },
      required: ["files", "reason"],
    },
    handler: handleSelfEditCode,
  },
  {
    name: "query_analytics",
    description: "Query workspace analytics (overview, finance, leads, tasks) computed from real rows.",
    squadAccess: ["Gamma", "Delta"],
    requiresApproval: false,
    costEstimate: 0,
    rateLimit: { maxCalls: 60, windowMs: 3600000 },
    parameters: {
      type: "object",
      properties: { metric: jsonString("Analytics metric", { enum: ["overview", "finance", "leads", "tasks"] }) },
      required: ["metric"],
    },
    handler: handleQueryAnalytics,
  },
  {
    name: "test_connector",
    description: "Test whether an external connector (whatsapp, instagram, video, github) has credentials and is reachable.",
    squadAccess: ["Delta", "Gamma"],
    requiresApproval: false,
    costEstimate: 0.001,
    rateLimit: { maxCalls: 10, windowMs: 3600000 },
    parameters: {
      type: "object",
      properties: { connector: jsonString("Connector name", { enum: ["whatsapp", "instagram", "video", "github"] }) },
      required: ["connector"],
    },
    handler: handleTestConnector,
  },
];

const BY_NAME = Object.fromEntries(MCP_REGISTRY.map((t) => [t.name, t]));

/** Tools available to one squad (by squadAccess), schema-less summaries. */
export function getToolsForSquad(squadCode) {
  return MCP_REGISTRY.filter((t) => t.squadAccess.includes(squadCode));
}

/** Full MCP schema object for one tool (handler stripped), or null. */
export function getToolSchema(name) {
  const t = BY_NAME[name];
  if (!t) return null;
  const { handler, ...schema } = t;
  return schema;
}

/** All tool names. */
export function listAllTools() {
  return MCP_REGISTRY.map((t) => t.name);
}

/** Internal lookup including the handler (server-side only). */
export function getTool(name) {
  return BY_NAME[name] || null;
}
