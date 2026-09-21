# Qimmah Digital — CEO Command Center

## Deploy in ~10 minutes (no coding needed)

### Option A — GitHub + Vercel (recommended)
1. Go to github.com → sign in → New repository → name it `qimmah-command-center` → Create.
2. Click "uploading an existing file" and drag ALL files from this folder in
   (package.json, vite.config.js, index.html, .gitignore, and the src folder with its 2 files).
   Commit the upload.
3. Go to vercel.com → Continue with GitHub → Add New Project → Import `qimmah-command-center`.
   Vercel auto-detects Vite. Click Deploy.
4. Two minutes later you get a live URL like `qimmah-command-center.vercel.app`.

### After it is live
- Open the URL → create your Owner account (name + PIN).
- The AI CEO will ask for your free Groq API key: console.groq.com/keys.
- Optional premium voice: paste an ElevenLabs key in Voice Settings (elevenlabs.io).
- Add your custom domain in Vercel → Project → Settings → Domains (e.g. ceo.qimmah.digital).

### Run locally instead (optional)
    npm install
    npm run dev

### Notes
- All data lives in the browser (localStorage) — device-level, no server.
- On a new device or browser, the app starts fresh (create the owner account again).
- Use the Backup button (owner only) to download your data as JSON.

## Backend setup (required env vars)

The `/api` backend (login sessions, approvals, goals, MCP log, studies) runs as
Vercel serverless functions backed by Supabase. If the app shows
"offline mode — backend not connected", the cause is almost always one of these:

1. **Set the environment variables** in Vercel → Project → Settings → Environment
   Variables, then **Redeploy** (env changes only apply to new deployments):
   - `SUPABASE_URL` — your Supabase project URL (https://xxxx.supabase.co)
   - `SUPABASE_SERVICE_ROLE_KEY` — Supabase service-role key (server only, never in the browser)
   - `JWT_SECRET` — any long random string (signs the 30-day session cookie)
   - `GROQ_API_KEY` — free key from console.groq.com/keys (studies, cycles, CEO)
   - Optional: `MCP_API_KEY`, `CRON_SECRET`
2. **Run the schema SQL once** in the Supabase SQL editor: `backend/schema.sql`,
   then `backend/schema-goals.sql` and `backend/schema-mcp.sql`. Without these,
   the `users` table and the `provision_workspace` function don't exist and
   login fails with a 503 "database: …" error.
3. **Disable Vercel Deployment Protection** (or add a bypass) if it is enabled —
   it turns every `/api/*` answer into a 401 HTML page the app cannot parse.

### Health check
`GET /api/health` is public and always answers 200 with live status per
dependency (Supabase configured/reachable, JWT configured, Groq configured).
Open it in a browser to see exactly what is missing. Vercel cron pings it
hourly (see `vercel.json`) to keep the functions warm. While the app is in
offline mode it re-checks `/api/health` every 30 seconds and reconnects
automatically the moment the backend is healthy again.

## CEO Brain — Study Mode + Export Brain

### Study Mode (nav: "CEO Brain")
- Type any topic — a market, a tool, a competitor, a trend — and tap **Study this**.
- The AI CEO researches the **live open web** using **Groq Compound** (`groq/compound`),
  which has web search built in — zero extra keys or cost, it runs on the same free
  Groq key as the chat. If Compound is unavailable on your key/model, it falls back
  gracefully to `llama-3.3-70b-versatile` (trained knowledge only) and says so.
- Each study session produces a structured brief: summary, key findings, recommended
  actions for Qimmah Digital, and the web sources it used (with links).
- Every brief is saved permanently into the CEO's **knowledge base** (persisted with
  the rest of your data) and also posted into the AI CEO chat — and the CEO is told
  what it has studied, so it remembers those topics in later conversations.

### Export Brain (owner only)
- Tap **Export Brain** in the top bar or inside the CEO Brain view.
- Two files download:
  - `qimmah-ceo-brain-YYYY-MM-DD.json` — the full brain: knowledge, insights, chat,
    tasks, finance, contracts, leads — everything.
  - `qimmah-ceo-brain-YYYY-MM-DD.md` — a human-readable report of every studied
    topic with dates, key points, sources, recommended actions, insights, and a
    business snapshot — readable on your Desktop without parsing JSON.
- Files land in your **Downloads** folder — move them to your Desktop.
- The original **Backup** button still exports the plain JSON only.
