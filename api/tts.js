/**
 * api/tts.js
 * Free neural text-to-speech via Microsoft Edge voices (node-edge-tts).
 *
 * POST { text, voice?, rate? }  -> audio/mpeg (binary)
 *
 * - voice: an Edge neural voice short name (default en-US-AriaNeural).
 *   Only a curated female-voice allowlist is accepted.
 * - rate:  0.5–2.0 multiplier (mapped to Edge "-50%".."+100%").
 * - text:  capped at 2000 chars.
 *
 * Optional shared-secret: if TTS_KEY is set in the environment, requests must
 * send the same value in the `x-tts-key` header. When unset the endpoint is
 * open (the owner's own app).
 *
 * Honest caveat: this uses an unofficial, free Microsoft Edge service — it
 * could change or be rate-limited at any time. The frontend falls back to
 * the browser voice automatically if this endpoint fails.
 */
import { EdgeTTS } from "node-edge-tts";
import { readFile, unlink } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { randomBytes } from "crypto";

const MAX_TEXT = 2000;

const ALLOWED_VOICES = new Set([
  "en-US-AriaNeural",     // warm, natural (default)
  "en-US-JennyNeural",    // friendly
  "en-US-MichelleNeural", // clear
  "en-GB-SoniaNeural",    // British
  "ar-SA-ZariyahNeural",  // Arabic female
]);

function rateToPercent(rate) {
  const r = Number(rate);
  if (!Number.isFinite(r)) return "+0%";
  const clamped = Math.min(2, Math.max(0.5, r));
  const pct = Math.round((clamped - 1) * 100);
  return (pct >= 0 ? "+" : "") + pct + "%";
}

function jsonError(res, status, error) {
  res.status(status).json({ error });
}

export default async function handler(req, res) {
  if (req.method !== "POST") return jsonError(res, 405, "Method not allowed — use POST.");

  if (process.env.TTS_KEY) {
    const key = req.headers["x-tts-key"];
    if (key !== process.env.TTS_KEY) return jsonError(res, 401, "Invalid or missing x-tts-key header.");
  }

  const body = req.body || {};
  const text = String(body.text || "").trim();
  if (!text) return jsonError(res, 400, "Missing 'text'.");
  if (text.length > MAX_TEXT) return jsonError(res, 413, "Text too long — max " + MAX_TEXT + " characters.");

  const voice = body.voice && ALLOWED_VOICES.has(body.voice) ? body.voice : "en-US-AriaNeural";
  const rate = rateToPercent(body.rate);

  const file = join(tmpdir(), "tts-" + randomBytes(8).toString("hex") + ".mp3");
  try {
    const tts = new EdgeTTS({ voice, rate });
    await tts.ttsPromise(text, file);
    const audio = await readFile(file);
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Content-Length", String(audio.length));
    res.setHeader("Cache-Control", "no-store");
    res.status(200).send(audio);
  } catch (e) {
    jsonError(res, 502, "Speech synthesis failed: " + (e && e.message ? e.message : "unknown error"));
  } finally {
    try { await unlink(file); } catch (e) { /* temp file may not exist */ }
  }
}
