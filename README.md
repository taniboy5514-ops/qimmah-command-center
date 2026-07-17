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
