/**
 * api/finance.js
 * Money in / money out for the workspace.
 *
 * GET    ?month=YYYY-MM — monthly stats + transactions + invoices.
 * POST   { type: "transaction", kind, amount, category?, description?, tx_date? }
 * POST   { type: "invoice", client_name, items: [{description, qty, unit_price}], due_date?, notes? }
 * PATCH  { invoice_id, status } — when status becomes "paid", an income
 *          transaction is auto-inserted for the invoice total.
 */
import { assertSupabase, logFeed } from "../backend/lib/supabase.js";
import { requireAuth } from "../backend/lib/auth.js";

export default async function handler(req, res) {
  const session = requireAuth(req, res);
  if (!session) return;
  const db = assertSupabase();
  const ws = session.workspaceId;

  try {
    if (req.method === "GET") {
      const now = new Date();
      const month = /^\d{4}-\d{2}$/.test(req.query.month || "")
        ? req.query.month
        : now.toISOString().slice(0, 7);
      const from = `${month}-01`;
      const to = new Date(Date.UTC(+month.slice(0, 4), +month.slice(5, 7), 1)).toISOString().slice(0, 10);

      const [txRes, invRes] = await Promise.all([
        db.from("transactions").select("*").eq("workspace_id", ws)
          .gte("tx_date", from).lt("tx_date", to).order("tx_date", { ascending: false }),
        db.from("invoices").select("*, invoice_items(*)").eq("workspace_id", ws)
          .order("created_at", { ascending: false }),
      ]);
      if (txRes.error) return res.status(500).json({ error: txRes.error.message });
      if (invRes.error) return res.status(500).json({ error: invRes.error.message });

      const txs = txRes.data || [];
      const income = txs.filter((t) => t.kind === "income").reduce((s, t) => s + Number(t.amount), 0);
      const expense = txs.filter((t) => t.kind === "expense").reduce((s, t) => s + Number(t.amount), 0);
      const outstanding = (invRes.data || [])
        .filter((i) => i.status === "sent" || i.status === "overdue")
        .reduce((s, i) => s + (i.invoice_items || []).reduce((a, it) => a + Number(it.qty) * Number(it.unit_price), 0), 0);

      return res.status(200).json({
        month,
        stats: { income, expense, net: income - expense, outstanding },
        transactions: txs,
        invoices: invRes.data || [],
      });
    }

    if (req.method === "POST") {
      const type = req.body?.type;

      if (type === "transaction") {
        const kind = req.body.kind === "expense" ? "expense" : "income";
        const amount = Number(req.body.amount);
        if (!Number.isFinite(amount) || amount <= 0) {
          return res.status(400).json({ error: "Amount must be a positive number" });
        }
        const { data, error } = await db.from("transactions").insert({
          workspace_id: ws, kind, amount,
          category: String(req.body.category || "").slice(0, 80) || null,
          description: String(req.body.description || "").slice(0, 500) || null,
          tx_date: /^\d{4}-\d{2}-\d{2}$/.test(req.body.tx_date || "") ? req.body.tx_date : undefined,
        }).select().single();
        if (error) return res.status(500).json({ error: error.message });
        await logFeed(ws, "finance", `${kind === "income" ? "Income" : "Expense"} logged: OMR ${amount.toFixed(3)}${req.body.description ? " — " + req.body.description : ""}`);
        return res.status(201).json({ transaction: data });
      }

      if (type === "invoice") {
        const clientName = String(req.body.client_name || "").trim().slice(0, 120);
        const items = Array.isArray(req.body.items) ? req.body.items.slice(0, 50) : [];
        if (!clientName) return res.status(400).json({ error: "client_name is required" });
        if (!items.length) return res.status(400).json({ error: "At least one line item is required" });

        const { data: invoice, error: invErr } = await db.from("invoices").insert({
          workspace_id: ws, client_name: clientName,
          status: req.body.status === "sent" ? "sent" : "draft",
          due_date: /^\d{4}-\d{2}-\d{2}$/.test(req.body.due_date || "") ? req.body.due_date : null,
          notes: String(req.body.notes || "").slice(0, 1000) || null,
        }).select().single();
        if (invErr) return res.status(500).json({ error: invErr.message });

        const rows = items.map((it) => ({
          workspace_id: ws,
          invoice_id: invoice.id,
          description: String(it.description || "Item").slice(0, 200),
          qty: Number(it.qty) > 0 ? Number(it.qty) : 1,
          unit_price: Number(it.unit_price) >= 0 ? Number(it.unit_price) : 0,
        }));
        const { error: itemsErr } = await db.from("invoice_items").insert(rows);
        if (itemsErr) return res.status(500).json({ error: itemsErr.message });

        await logFeed(ws, "finance", `Invoice created for ${clientName} (${rows.length} item${rows.length === 1 ? "" : "s"})`);
        return res.status(201).json({ invoice: { ...invoice, invoice_items: rows } });
      }

      return res.status(400).json({ error: 'type must be "transaction" or "invoice"' });
    }

    if (req.method === "PATCH") {
      const invoiceId = String(req.body?.invoice_id || "");
      const status = String(req.body?.status || "");
      const allowed = ["draft", "sent", "paid", "overdue", "cancelled"];
      if (!invoiceId || !allowed.includes(status)) {
        return res.status(400).json({ error: "invoice_id and a valid status are required" });
      }
      // Read the current status first so the income transaction below is only
      // recorded on the transition INTO "paid" (not on repeat PATCHes).
      const { data: current, error: curErr } = await db.from("invoices")
        .select("status")
        .eq("id", invoiceId)
        .eq("workspace_id", ws)
        .maybeSingle();
      if (curErr) return res.status(500).json({ error: curErr.message });
      if (!current) return res.status(404).json({ error: "Invoice not found" });

      const { data: invoice, error: updErr } = await db.from("invoices")
        .update({ status })
        .eq("id", invoiceId)
        .eq("workspace_id", ws)
        .select("*, invoice_items(*)")
        .maybeSingle();
      if (updErr) return res.status(500).json({ error: updErr.message });
      if (!invoice) return res.status(404).json({ error: "Invoice not found" });

      if (status === "paid" && current.status !== "paid") {
        const total = (invoice.invoice_items || []).reduce(
          (s, it) => s + Number(it.qty) * Number(it.unit_price), 0);
        if (total > 0) {
          const { error: txErr } = await db.from("transactions").insert({
            workspace_id: ws, kind: "income", amount: total,
            category: "Invoice payment",
            description: `Invoice ${invoice.id.slice(0, 8)} — ${invoice.client_name}`,
          });
          if (txErr) return res.status(500).json({ error: txErr.message });
        }
        await logFeed(ws, "finance", `Invoice paid by ${invoice.client_name}: OMR ${total.toFixed(3)}`);
      }
      return res.status(200).json({ invoice });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    console.error("[finance]", e);
    return res.status(500).json({ error: "Internal server error" });
  }
}
