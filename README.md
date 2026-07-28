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
