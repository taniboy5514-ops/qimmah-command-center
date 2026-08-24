/**
 * backend/lib/groq.js
 * Server-side Groq chat completions with the same model fallback
 * chain as src/shared.jsx. Key lives ONLY in process.env.GROQ_API_KEY.
 */

/** Same order as GROQ_MODELS in src/shared.jsx */
export const GROQ_MODELS = [
  "openai/gpt-oss-120b",
  "qwen/qwen3.6-27b",
  "moonshotai/kimi-k2-instruct-0905",
  "meta-llama/llama-4-scout-17b-16e-instruct",
  "openai/gpt-oss-20b",
];

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

/**
 * Call Groq chat completions, falling back through the model chain.
 * @param {string} sys - system prompt
 * @param {{role:string, content:string}[]} messages
 * @param {string} [model] - preferred model, tried first
 * @returns {Promise<{content: string, model: string}>}
 */
export async function callGroq(sys, messages, model) {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("GROQ_API_KEY is not set");

  const chain = [...new Set([model, ...GROQ_MODELS].filter(Boolean))];
  let lastErr = null;

  for (const m of chain) {
    try {
      const res = await fetch(GROQ_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + key },
        body: JSON.stringify({
          model: m,
          max_tokens: 1500,
          messages: [{ role: "system", content: sys }, ...messages],
        }),
      });
      if (!res.ok) {
        lastErr = new Error(`Groq ${res.status} for ${m}: ${(await res.text()).slice(0, 200)}`);
        continue; // try next model in the chain
      }
      const json = await res.json();
      const content = json?.choices?.[0]?.message?.content;
      if (!content) {
        lastErr = new Error(`Empty completion from ${m}`);
        continue;
      }
      return { content, model: m };
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error("All Groq models failed");
}

/**
 * Summarize one squad's mini-reports into an Alpha-style digest.
 * @param {string} squad
 * @param {{agent: string, report: string}[]} reports
 * @returns {Promise<{digest: string, model: string}>}
 */
export async function alphaDigest(squad, reports) {
  const sys =
    `You are the squad lead of Squad ${squad} at Qimmah Digital, an AI-powered digital marketing agency in Oman. ` +
    `Summarize your agents' reports into a crisp digest: 3-5 bullets of what was done, 1 key metric, 1 blocker or risk. ` +
    `Be factual and brief (max 150 words).`;
  const msg = reports.map((r) => `${r.agent}: ${r.report}`).join("\n");
  const { content, model } = await callGroq(sys, [{ role: "user", content: msg }]);
  return { digest: content, model };
}

/**
 * CEO-level study across all 5 squad digests.
 * @param {{squad: string, digest: string}[]} digests
 * @returns {Promise<{findings: string[], crossInsights: string[], directives: Record<string,string[]>, model: string}>}
 */
export async function ceoStudy(digests) {
  const sys =
    "You are the AI CEO of Qimmah Digital (Oman). Given the 5 squad digests (Alpha Lead Gen, Beta Delivery, " +
    "Gamma Intelligence, Delta Operations, Epsilon Innovation), produce a JSON object with EXACTLY these keys: " +
    '"findings" (array of 3-6 short strings), "crossInsights" (array of 2-4 short strings about cross-squad ' +
    'opportunities), "directives" (object with keys "Alpha","Beta","Gamma","Delta","Epsilon", each an array of ' +
    "1-3 short actionable directive strings). Output ONLY valid JSON, no markdown fences.";
  const msg = digests.map((d) => `## Squad ${d.squad}\n${d.digest}`).join("\n\n");
  const { content, model } = await callGroq(sys, [{ role: "user", content: msg }]);

  let parsed = {};
  try {
    parsed = JSON.parse(content.replace(/```json?|```/g, "").trim());
  } catch {
    parsed = { findings: [content.slice(0, 400)], crossInsights: [], directives: {} };
  }
  return {
    findings: Array.isArray(parsed.findings) ? parsed.findings.map(String) : [],
    crossInsights: Array.isArray(parsed.crossInsights) ? parsed.crossInsights.map(String) : [],
    directives: parsed.directives && typeof parsed.directives === "object" ? parsed.directives : {},
    model,
  };
}
