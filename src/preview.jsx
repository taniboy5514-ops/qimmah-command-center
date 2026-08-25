/* ============================================================
   DELIVERABLE PREVIEW — full-screen modal for work products.
   HTML deliverables render live in a sandboxed iframe (scripts
   run, but isolated) with a Preview | Code toggle; Markdown and
   text render as a clean readable view via a tiny dependency-free
   renderer. Footer: Download / Copy / Close.
   ============================================================ */
import { useState, useEffect } from "react";
import { X, Download, Copy, Check, Eye, Code2 } from "lucide-react";
import { CYAN, SQUAD_META, btnPrimary, btnGhost } from "./shared.jsx";
import { downloadFile } from "./views3.jsx";
import { deliverableMime } from "./autopilot.jsx";

/* Never feed more than ~1MB into an iframe srcDoc or the DOM. */
export const MAX_PREVIEW_CHARS = 1024 * 1024;

/* HTML deliverable = .html/.htm filename, or content that opens a document. */
export function isHtmlDeliverable(d) {
  const f = String((d && d.filename) || "").toLowerCase();
  if (f.endsWith(".html") || f.endsWith(".htm")) return true;
  const head = String((d && d.content) || "").trimStart().slice(0, 200).toLowerCase();
  return head.startsWith("<!doctype") || head.startsWith("<html");
}

/* ---------- Tiny markdown renderer (no dependencies) ---------- */
const mdStyles = {
  h: (n) => ({
    margin: n <= 2 ? "18px 0 8px" : "14px 0 6px",
    fontSize: n === 1 ? 21 : n === 2 ? 18 : n === 3 ? 15.5 : 14,
    fontWeight: 700, color: "#F5F3FF", fontFamily: "'Space Grotesk', sans-serif", lineHeight: 1.3,
  }),
  p: { margin: "0 0 10px", fontSize: 13.5, color: "#D8D3E8", lineHeight: 1.75 },
  list: { margin: "0 0 12px", paddingLeft: 22, fontSize: 13.5, color: "#D8D3E8", lineHeight: 1.75 },
  codeBlock: {
    margin: "0 0 12px", padding: "12px 14px", borderRadius: 10, overflowX: "auto",
    background: "rgba(0,0,0,0.45)", border: "1px solid rgba(255,255,255,0.09)",
    fontSize: 12.5, lineHeight: 1.6, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    color: "#C4B5FD", whiteSpace: "pre", wordBreak: "normal",
  },
  inlineCode: {
    padding: "1px 6px", borderRadius: 5, background: "rgba(124,58,237,0.18)",
    border: "1px solid rgba(124,58,237,0.3)", fontSize: "0.9em",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", color: "#DDD6FE",
  },
  hr: { border: "none", borderTop: "1px solid rgba(255,255,255,0.1)", margin: "14px 0" },
};

/* Inline: **bold**, *italic*, `code`, [links](url). Plain text stays text,
   so React escapes any HTML for us — nothing here is ever injected. */
function mdInline(text) {
  const parts = [];
  const re = /(\*\*[^*]+\*\*|\*[^*\n]+\*|`[^`\n]+`|\[[^\]\n]+\]\([^)\s]+\))/g;
  let last = 0, m, k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const t = m[0];
    if (t.startsWith("**")) parts.push(<strong key={k++} style={{ color: "#F5F3FF" }}>{t.slice(2, -2)}</strong>);
    else if (t.startsWith("`")) parts.push(<code key={k++} style={mdStyles.inlineCode}>{t.slice(1, -1)}</code>);
    else if (t.startsWith("*")) parts.push(<em key={k++}>{t.slice(1, -1)}</em>);
    else {
      const lm = t.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/);
      const href = lm[2];
      if (/^https?:\/\//i.test(href) || href.startsWith("mailto:")) {
        parts.push(<a key={k++} href={href} target="_blank" rel="noreferrer" style={{ color: CYAN }}>{lm[1]}</a>);
      } else parts.push(lm[1]);
    }
    last = m.index + t.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

const BLOCK_START = /^(#{1,4}\s|```|\s*[-*]\s+|\s*\d+[.)]\s+|\s*---+\s*$)/;

/* Block level: fenced code, headings, ul/ol lists, rules, paragraphs. */
export function renderMarkdown(src) {
  const lines = String(src || "").replace(/\r\n?/g, "\n").split("\n");
  const blocks = [];
  let i = 0, key = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (/^\s*```/.test(line)) {
      const buf = []; i++;
      while (i < lines.length && !/^\s*```/.test(lines[i])) { buf.push(lines[i]); i++; }
      i++;
      blocks.push(<pre key={key++} style={mdStyles.codeBlock}><code>{buf.join("\n")}</code></pre>);
      continue;
    }
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) { blocks.push(<div key={key++} style={mdStyles.h(h[1].length)}>{mdInline(h[2])}</div>); i++; continue; }
    if (/^\s*---+\s*$/.test(line)) { blocks.push(<hr key={key++} style={mdStyles.hr} />); i++; continue; }
    if (/^\s*[-*]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*[-*]\s+/, "")); i++; }
      blocks.push(<ul key={key++} style={mdStyles.list}>{items.map((it, j) => <li key={j}>{mdInline(it)}</li>)}</ul>);
      continue;
    }
    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*\d+[.)]\s+/, "")); i++; }
      blocks.push(<ol key={key++} style={mdStyles.list}>{items.map((it, j) => <li key={j}>{mdInline(it)}</li>)}</ol>);
      continue;
    }
    if (!line.trim()) { i++; continue; }
    const buf = [line.trim()]; i++;
    while (i < lines.length && lines[i].trim() && !BLOCK_START.test(lines[i])) { buf.push(lines[i].trim()); i++; }
    blocks.push(<p key={key++} style={mdStyles.p}>{mdInline(buf.join(" "))}</p>);
  }
  return blocks;
}

/* ---------- Modal ---------- */
export function DeliverablePreview({ d, S, up, log, onClose }) {
  const html = isHtmlDeliverable(d);
  const [mode, setMode] = useState("preview"); // html only: preview | code
  const [copied, setCopied] = useState(false);
  const content = String(d.content || "");
  const tooBig = content.length > MAX_PREVIEW_CHARS;
  const squadColor = SQUAD_META[d.squad] ? SQUAD_META[d.squad].color : "#A78BFA";
  const date = d.ts ? new Date(d.ts).toLocaleString("en", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "";

  /* Escape closes; listener lives only while the modal is open. */
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function copyContent() {
    const done = () => { setCopied(true); setTimeout(() => setCopied(false), 1600); };
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(content).then(done, () => done());
      } else {
        const ta = document.createElement("textarea");
        ta.value = content; document.body.appendChild(ta); ta.select();
        try { document.execCommand("copy"); } catch (e) { /* copy unavailable */ }
        document.body.removeChild(ta); done();
      }
    } catch (e) { done(); }
  }

  return (
    <div onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(5,3,10,0.78)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 960, height: "min(88vh, 900px)", display: "flex", flexDirection: "column", background: "rgba(19,13,32,0.96)", border: "1px solid rgba(124,58,237,0.35)", borderRadius: 18, boxShadow: "0 24px 80px rgba(0,0,0,0.6), 0 0 50px rgba(124,58,237,0.15)", overflow: "hidden" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: squadColor + "22", color: squadColor, border: "1px solid " + squadColor + "55", textTransform: "uppercase", letterSpacing: 1 }}>
                {d.agent || "Agent"}{d.squad ? " · Squad " + d.squad : ""}
              </span>
              <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: "rgba(34,211,238,0.12)", color: "#22D3EE", border: "1px solid rgba(34,211,238,0.35)", letterSpacing: 0.5 }}>
                {d.filename || "deliverable"}
              </span>
              {date && <span style={{ fontSize: 10.5, color: "#6B6685", textTransform: "uppercase", letterSpacing: 1 }}>{date}</span>}
            </div>
            <div style={{ fontSize: 17, fontWeight: 700, color: "#F5F3FF", fontFamily: "'Space Grotesk', sans-serif", lineHeight: 1.35 }}>{d.title || d.topic || d.filename || "Deliverable"}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            {html && !tooBig && (
              <div style={{ display: "flex", borderRadius: 9, overflow: "hidden", border: "1px solid rgba(255,255,255,0.14)" }}>
                {[["preview", Eye, "Preview"], ["code", Code2, "Code"]].map(([m, Icon, label]) => (
                  <button key={m} onClick={() => setMode(m)}
                    style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", border: "none", fontFamily: "inherit", background: mode === m ? "rgba(124,58,237,0.4)" : "rgba(255,255,255,0.05)", color: mode === m ? "#EDE9FE" : "#8B86A3" }}>
                    <Icon size={12} /> {label}
                  </button>
                ))}
              </div>
            )}
            <button onClick={onClose} title="Close (Esc)"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 9, color: "#C4B5FD", cursor: "pointer", padding: 7, display: "flex" }}>
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, minHeight: 0, overflow: "auto", padding: html && mode === "preview" && !tooBig ? 0 : "18px 22px" }}>
          {tooBig ? (
            <div style={{ textAlign: "center", padding: "48px 20px" }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: "#E9E4FB", marginBottom: 8 }}>Too large to preview</div>
              <div style={{ fontSize: 13, color: "#A5A0B8", maxWidth: 420, margin: "0 auto" }}>
                This file is {(content.length / 1048576).toFixed(1)} MB — over the 1 MB preview limit. Download it instead and open it locally.
              </div>
            </div>
          ) : html && mode === "preview" ? (
            <iframe title={"Preview of " + (d.filename || "deliverable")} sandbox="allow-scripts" srcDoc={content}
              style={{ width: "100%", height: "100%", border: "none", background: "#fff", display: "block" }} />
          ) : html ? (
            <pre style={{ margin: 0, fontSize: 12.5, lineHeight: 1.65, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", color: "#C9C4DC", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{content}</pre>
          ) : (
            <div style={{ maxWidth: 720, margin: "0 auto" }}>{renderMarkdown(content)}</div>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", padding: "12px 20px", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
          <button style={btnPrimary}
            onClick={() => { try { downloadFile(d.filename || "deliverable.md", content, deliverableMime(d.filename)); if (log) log("system", "Deliverable downloaded: " + String(d.filename || "").slice(0, 50)); } catch (err) { /* download unavailable */ } }}>
            <Download size={13} /> Download
          </button>
          <button style={btnGhost} onClick={copyContent}>
            {copied ? <Check size={13} style={{ color: "#34D399" }} /> : <Copy size={13} />} {copied ? "Copied" : "Copy"}
          </button>
          <span style={{ flex: 1 }} />
          <button style={btnGhost} onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
