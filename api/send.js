/**
 * api/send.js
 * Real messaging + AI voice calls for the Qimmah Command Center.
 *
 * POST { channel, ...creds, ...payload }  -> { ok, detail } or { error }
 *
 * Channels:
 *   telegram  — send a Telegram message via your own bot.
 *               { botToken, chatId, text }
 *               Free, instant, no approval needed. Create the bot with
 *               @BotFather, then get your chatId from @userinfobot.
 *
 *   whatsapp  — send a WhatsApp message via the Meta Cloud API.
 *               { token, phoneNumberId, to, text }
 *               Free-form text works while the 24-hour customer-service
 *               window is open (the person messaged you in the last 24h).
 *               Outside the window Meta rejects it — use an approved
 *               template instead.
 *
 *   call      — place a real AI phone call.
 *               provider "vapi":  { apiKey, assistantId, phoneNumberId, to }
 *               provider "bland": { apiKey, to, task }
 *               Vapi = your own assistant script (paid per minute, needs a
 *               Vapi phone number with outbound enabled). Bland = simplest:
 *               one key, describe the call in plain English.
 *
 * Security: every credential arrives with the request from the user's own
 * device (localStorage) and is used only for the single provider call below.
 * Nothing is stored, logged, or forwarded anywhere else. The server keeps
 * no copy of any key.
 */

const MAX_TEXT = 4000;
const MAX_TASK = 1200;

function jsonError(res, status, error) {
  res.status(status).json({ error });
}

function digits(v) {
  return String(v || "").replace(/[^0-9]/g, "");
}

async function postJSON(url, headers, body, timeoutMs) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs || 20000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    let data = null;
    try { data = await res.json(); } catch (e) { /* non-JSON provider reply */ }
    return { status: res.status, data };
  } finally {
    clearTimeout(timer);
  }
}

/* Translate a provider's error body into one plain-English sentence. */
function providerError(data, fallback) {
  if (!data || typeof data !== "object") return fallback;
  if (data.error && data.error.message) return String(data.error.message);
  if (data.description) return String(data.description); // Telegram
  if (data.message) return String(data.message);         // Vapi / Bland
  if (Array.isArray(data.errors) && data.errors[0] && data.errors[0].message) return String(data.errors[0].message);
  return fallback;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return jsonError(res, 405, "Method not allowed — use POST.");

  const body = req.body || {};
  const channel = String(body.channel || "");

  /* ---------------- Telegram Bot ---------------- */
  if (channel === "telegram") {
    const botToken = String(body.botToken || "").trim();
    const chatId = String(body.chatId || "").trim();
    const text = String(body.text || "").trim();
    if (!botToken || !chatId) return jsonError(res, 400, "Telegram needs the bot token and your chat ID (set them in the Integrations tab).");
    if (!text) return jsonError(res, 400, "Missing message text.");
    if (text.length > MAX_TEXT) return jsonError(res, 413, "Text too long — max " + MAX_TEXT + " characters.");
    if (!/^\d{5,}:[A-Za-z0-9_-]{20,}$/.test(botToken)) return jsonError(res, 400, "That bot token does not look right — copy it exactly from @BotFather.");

    const r = await postJSON(
      "https://api.telegram.org/bot" + botToken + "/sendMessage",
      {},
      { chat_id: chatId, text },
    );
    if (r.status === 200 && r.data && r.data.ok) {
      return res.status(200).json({ ok: true, detail: "Telegram message delivered to chat " + chatId + "." });
    }
    return jsonError(res, 502, "Telegram refused the send: " + providerError(r.data, "check the token and chat ID."));
  }

  /* ---------------- WhatsApp Cloud API ---------------- */
  if (channel === "whatsapp") {
    const token = String(body.token || "").trim();
    const phoneNumberId = String(body.phoneNumberId || "").trim();
    const to = digits(body.to);
    const text = String(body.text || "").trim();
    if (!token || !phoneNumberId) return jsonError(res, 400, "WhatsApp needs the access token and phone number ID (set them in the Integrations tab).");
    if (to.length < 8) return jsonError(res, 400, "Recipient number looks wrong — use full international format, e.g. 9689XXXXXXX.");
    if (!text) return jsonError(res, 400, "Missing message text.");
    if (text.length > MAX_TEXT) return jsonError(res, 413, "Text too long — max " + MAX_TEXT + " characters.");

    const r = await postJSON(
      "https://graph.facebook.com/v21.0/" + encodeURIComponent(phoneNumberId) + "/messages",
      { Authorization: "Bearer " + token },
      { messaging_product: "whatsapp", to, type: "text", text: { body: text } },
    );
    if ((r.status === 200 || r.status === 201) && r.data && r.data.messages) {
      return res.status(200).json({ ok: true, detail: "WhatsApp message sent to +" + to + "." });
    }
    /* Meta's most common refusal: outside the 24h customer-service window. */
    const raw = providerError(r.data, "check the token, phone number ID and recipient.");
    const hint = /24|window|template|131047|131026|1320/i.test(raw)
      ? " (Most likely the 24-hour window is closed — the person must message you first, or use an approved template.)"
      : "";
    return jsonError(res, 502, "WhatsApp refused the send: " + raw + hint);
  }

  /* ---------------- AI voice call ---------------- */
  if (channel === "call") {
    const provider = String(body.provider || "vapi");
    const apiKey = String(body.apiKey || "").trim();
    const to = digits(body.to);
    if (!apiKey) return jsonError(res, 400, "The call needs your " + (provider === "bland" ? "Bland" : "Vapi") + " API key (set it in the Integrations tab).");
    if (to.length < 8) return jsonError(res, 400, "Phone number looks wrong — use full international format, e.g. 9689XXXXXXX.");
    const e164 = "+" + to;

    if (provider === "bland") {
      const task = String(body.task || "").trim();
      if (!task) return jsonError(res, 400, "Describe what the AI should say on the call (the task).");
      if (task.length > MAX_TASK) return jsonError(res, 413, "Call task too long — max " + MAX_TASK + " characters.");
      const r = await postJSON(
        "https://us.api.bland.ai/v1/calls",
        { authorization: apiKey },
        { phone_number: e164, task },
      );
      if ((r.status === 200 || r.status === 201) && r.data && (r.data.call_id || r.data.status)) {
        return res.status(200).json({ ok: true, detail: "Bland AI is dialing " + e164 + " now — the phone will ring in a few seconds." });
      }
      return jsonError(res, 502, "Bland refused the call: " + providerError(r.data, "check the API key and your balance."));
    }

    /* Default: Vapi */
    const assistantId = String(body.assistantId || "").trim();
    const phoneNumberId = String(body.phoneNumberId || "").trim();
    if (!assistantId || !phoneNumberId) return jsonError(res, 400, "Vapi needs the assistant ID and phone number ID (from your Vapi dashboard).");
    const r = await postJSON(
      "https://api.vapi.ai/call/phone",
      { Authorization: "Bearer " + apiKey },
      { assistantId, phoneNumberId, customer: { number: e164 } },
    );
    if ((r.status === 200 || r.status === 201) && r.data && r.data.id) {
      return res.status(200).json({ ok: true, detail: "Vapi is calling " + e164 + " now — pick up, your assistant is on the line." });
    }
    const raw = providerError(r.data, "check the key, assistant ID and phone number ID.");
    const hint = /outbound|international|number|balance|credit/i.test(raw)
      ? " (Free Vapi trial numbers cannot dial out — import a paid number or top up your balance.)"
      : "";
    return jsonError(res, 502, "Vapi refused the call: " + raw + hint);
  }

  return jsonError(res, 400, "Unknown channel — use telegram, whatsapp or call.");
}
