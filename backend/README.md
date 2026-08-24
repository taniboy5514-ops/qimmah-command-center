# Qimmah Command Center — Backend

Serverless backend for the Qimmah CEO Command Center: Vercel `/api` functions +
Supabase Postgres (RLS) + Groq (server-side key) + Vercel Cron.

## Architecture

```
Browser (React/Vite on Vercel)
  └─> /api/*  serverless functions (Node, ESM, `export default handler`)
        ├─> Supabase Postgres  (service-role key server-side, RLS for direct clients)
        └─> Groq API           (model fallback chain, key server-side)
  Vercel Cron ──GET /api/cron/squad-cycle (Bearer CRON_SECRET)──> runs squad cycle
```

No Next.js. Any file in `api/` is a serverless function. Shared code lives in
`backend/lib/` (`supabase.js`, `groq.js`, `auth.js`, `cycle.js`).

## Setup

### 1. Create a Supabase project

1. <https://supabase.com/dashboard> → New project (free tier).
2. SQL Editor → paste the contents of `backend/schema.sql` → Run.
   This creates the 15 tables, indexes, RLS policies, realtime publication
   (`feed_entries`, `squad_directives`) and the `provision_workspace(name, pin_hash)`
   function that seeds the 60 agents in 5 squads:
   Alpha 15 (Lead Gen), Beta 15 (Delivery), Gamma 15 (Intelligence),
   Delta 10 (Operations), Epsilon 5 (Innovation).

### 2. Get a Groq API key

<https://console.groq.com/keys> → create key (free tier).

### 3. Environment variables (Vercel → Project → Settings → Environment Variables)

| Variable                    | Where to get it                                        |
| --------------------------- | ------------------------------------------------------ |
| `SUPABASE_URL`              | Supabase → Project Settings → API → Project URL        |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → service_role key   |
| `GROQ_API_KEY`              | Groq console                                           |
| `JWT_SECRET`                | `openssl rand -hex 32`                                 |
| `CRON_SECRET`               | `openssl rand -hex 32`                                 |
| `MCP_API_KEY`               | `openssl rand -hex 32` — unlocks full MCP tool schemas on `/api/mcp/discover` |

> The service-role key bypasses RLS — it must **never** be exposed to the
> browser. Only the `/api` functions use it. No `VITE_` prefix on any secret.

### 4. Deploy

```bash
npm install
vercel --prod   # or connect the GitHub repo to Vercel
```

Vercel Cron will call `/api/cron/squad-cycle` every 10 minutes
(`*/10 * * * *`, see `vercel.json`). On the free Hobby plan, adjust the
schedule to once daily if needed.

## API

| Route                 | Methods            | Description                                        |
| --------------------- | ------------------ | -------------------------------------------------- |
| `/api/auth/pin-login` | POST / GET / DELETE | PIN login (first login provisions workspace+agents), session check, logout |
| `/api/feed`           | GET / POST / DELETE | Paginated activity feed, manual log, clear         |
| `/api/finance`        | GET / POST / PATCH  | Monthly stats, transactions, invoices; paid → auto income |
| `/api/studies`        | GET / POST          | Knowledge base; POST runs a Groq research study    |
| `/api/agents/cycle`   | POST                | Run one squad cycle for your workspace             |
| `/api/cron/squad-cycle` | GET               | Cron-guarded; runs the cycle for all workspaces    |
| `/api/agents/execute-tool` | POST           | Execute one MCP tool for an agent (6-gate pipeline) |
| `/api/mcp/discover`   | GET                 | MCP discovery — public tool list, full schemas with `x-api-key` |
| `/api/mcp/approve`    | GET / POST          | List pending approvals; approve/reject (approved tools execute immediately) |

## MCP tool system

13 MCP-compatible tools in `backend/lib/mcp/registry.js` (messaging, CRM,
research, finance, tasks, self-edit, analytics, connector tests). Per-agent
toolkits in `backend/lib/agents/toolkit.js` (squad defaults + `agent_toolkits`
overrides + daily budget gates). The 6-gate executor
(`backend/lib/agents/executor.js`): exists → authorized → rate limit → budget →
approval → validation, then execute + log to `tool_executions` and the feed.

Setup: run `backend/schema-mcp.sql` in the Supabase SQL editor after
`schema.sql` (adds `agent_toolkits`, `tool_executions`, `tool_approvals` with
the same workspace-isolation RLS + realtime). Set `MCP_API_KEY` to expose full
tool schemas via `GET /api/mcp/discover` (`x-api-key` header).

> Honest limits: WhatsApp and Instagram tools return mock success until Meta
> API credentials are configured; web_search and study_topic are LLM knowledge
> synthesis, not a live web crawl; self_edit_code stages edits only — commits
> go through the human-approved GitHub flow.

Auth: JWT in an httpOnly `qimmah_session` cookie (`{ userId, workspaceId }`, 30d).

## Goal Mode

The CEO Brain turns an objective ("get me 5 clients by Friday", "goal: …")
into a DAG of steps (`goal_steps`) and executes each step through the same
6-gate MCP executor (`backend/lib/agents/executor.js`) — so authorization,
rate limits, budgets, approvals and validation all apply unchanged.

- Planning: AI-first via `callGroq` (`backend/lib/ceo/goals.js` → `planGoal`),
  with a deterministic fallback planner built from the 8 skill templates in
  `backend/lib/ceo/skills.js` when Groq is unavailable.
- Execution: `processGoal(goalId)` advances READY steps (respecting
  `depends_on`), retries failed steps up to 2 times with linear backoff
  (`attempts × 2 min`), and blocks steps whose tools require approval
  (`tool_approvals` row — approving in the UI executes the tool and the next
  processor run marks the step done). When all steps finish, the goal is
  completed and a summary lands in the feed.
- Tables (run `backend/schema-goals.sql` after `schema.sql` and
  `schema-mcp.sql`): `goals`, `goal_steps`, `goal_events`, `skills`
  (8 built-in seed rows), `knowledge_edges` — same `jwt_workspace_id()` RLS,
  realtime publication for `goals` + `goal_steps`.

| Route                     | Methods           | Description                                  |
| ------------------------- | ----------------- | -------------------------------------------- |
| `/api/ceo/goals`          | GET / POST / PATCH | List goals; create+plan from `{prompt}`; pause/resume/cancel |
| `/api/ceo/goals/execute`  | POST              | Manually advance one goal (`{goalId}`)       |
| `/api/cron/goal-processor` | GET              | Cron-guarded; advances all active goals      |

Setup order: `schema.sql` → `schema-mcp.sql` → `schema-goals.sql`, then add
the cron row (already merged in `vercel.json`, `*/15 * * * *`). On the Vercel
Hobby plan only daily crons run reliably — adjust both schedules to once
daily if needed. Test with:

```bash
curl -X POST https://<your-app>/api/ceo/goals \
  -H 'Content-Type: application/json' --cookie 'qimmah_session=<token>' \
  -d '{"prompt":"goal: research the Oman restaurant market"}'
```

> Honest note: goal steps run real tools, but web_search/study_topic are LLM
> knowledge synthesis (not a live crawl) and WhatsApp/Instagram steps return
> mock success until Meta credentials are configured — Goal Mode inherits the
> same limits as the MCP tool system above.


## 4-week migration path (from localStorage to cloud)

1. **Week 1 — Cloud sync button.** Add a "Sync to cloud" button in Settings that
   POSTs the current localStorage state to `/api/feed` (and finance/studies).
   Local data stays the source of truth; cloud is a backup.
2. **Week 2 — Dual-write.** Every local mutation also writes to the API
   (fire-and-forget with retry). Reads still come from localStorage.
3. **Week 3 — Supabase as source of truth.** Reads switch to the API
   (feed realtime via Supabase subscription on `feed_entries`); localStorage
   becomes an offline cache.
4. **Week 4 — Cron on.** Enable the Vercel Cron schedule; squads cycle
   autonomously every 10 minutes. Remove dual-write code paths.

## Cost — $0/month free tier

| Service  | Free tier                                  | Fits?                       |
| -------- | ------------------------------------------ | --------------------------- |
| Vercel   | Hobby: serverless functions + cron (daily) | Yes (adjust cron if needed) |
| Supabase | 500 MB Postgres, realtime, 2 GB bandwidth  | Yes                         |
| Groq     | Free API tier with rate limits             | Yes (fallback chain helps)  |
