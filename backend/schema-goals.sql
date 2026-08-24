-- ============================================================
-- QIMMAH DIGITAL — GOAL MODE
-- Tables for CEO Brain goals: an objective is planned into a DAG
-- of steps, each step executed through the MCP 6-gate executor
-- (backend/lib/agents/executor.js) with approvals for sensitive
-- tools, retries, and a cron processor.
-- Run AFTER backend/schema.sql and backend/schema-mcp.sql.
-- Uses the same workspace-isolation pattern (jwt_workspace_id()).
-- ============================================================

-- ---------- tables ----------
create table if not exists goals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid references users(id) on delete set null,
  prompt text not null,
  skill text not null default 'custom',
  status text not null default 'active' check (status in ('active','paused','completed','cancelled')),
  plan jsonb not null default '{}'::jsonb,
  progress numeric(5,4) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists goal_steps (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references goals(id) on delete cascade,
  idx int not null,
  title text not null,
  squad text not null default 'Delta' check (squad in ('Alpha','Beta','Gamma','Delta','Epsilon')),
  tool_name text not null,
  tool_args jsonb not null default '{}'::jsonb,
  depends_on int[] not null default '{}'::int[],
  status text not null default 'pending' check (status in ('pending','ready','running','done','blocked','failed')),
  needs_approval boolean not null default false,
  result jsonb,
  attempts int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (goal_id, idx)
);

create table if not exists goal_events (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references goals(id) on delete cascade,
  kind text not null default 'info',
  text text not null,
  ts timestamptz not null default now()
);

create table if not exists skills (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade, -- null = built-in
  name text not null,
  description text,
  keywords text[] not null default '{}'::text[],
  steps jsonb not null default '[]'::jsonb, -- step templates [{title,squad,tool_name,tool_args,needs_approval}]
  builtin boolean not null default false,
  created_at timestamptz not null default now(),
  unique (workspace_id, name)
);

-- Built-in skill seed rows (workspace_id NULL, readable by all).
insert into skills (workspace_id, name, description, keywords, steps, builtin) values
  (null, 'market_research', 'Research a market, segment or competitor set and save the briefs to the knowledge base.',
   '{market,research,competitor,segment,industry,trend,oman,gcc}',
   '[{"title":"Research the target market","squad":"Gamma","tool_name":"web_search"},{"title":"Study the top competitors","squad":"Gamma","tool_name":"study_topic"},{"title":"Summarize findings into analytics","squad":"Gamma","tool_name":"query_analytics","tool_args":{"metric":"overview"}}]'::jsonb, true),
  (null, 'lead_generation', 'Find and log new leads for a segment, then queue outreach.',
   '{lead,leads,client,clients,prospect,pipeline,outreach,get me}',
   '[{"title":"Research lead sources","squad":"Gamma","tool_name":"web_search"},{"title":"Create leads in the pipeline","squad":"Alpha","tool_name":"create_lead"},{"title":"Prepare WhatsApp outreach","squad":"Alpha","tool_name":"send_whatsapp_message","needs_approval":true}]'::jsonb, true),
  (null, 'client_followup', 'Follow up with existing leads and move them forward in the pipeline.',
   '{follow up,follow-up,followup,nudge,warm lead,check in,re-engage}',
   '[{"title":"Review pipeline status","squad":"Alpha","tool_name":"query_analytics","tool_args":{"metric":"leads"}},{"title":"Send follow-up WhatsApp messages","squad":"Alpha","tool_name":"send_whatsapp_message","needs_approval":true}]'::jsonb, true),
  (null, 'financial_review', 'Review income, expenses and invoices; record any missing transactions.',
   '{finance,financial,money,revenue,expense,invoice,profit,omr,budget}',
   '[{"title":"Query finance analytics","squad":"Delta","tool_name":"query_analytics","tool_args":{"metric":"finance"}},{"title":"Record any missing transaction","squad":"Delta","tool_name":"record_transaction","needs_approval":true},{"title":"Draft outstanding invoice","squad":"Delta","tool_name":"create_invoice","needs_approval":true}]'::jsonb, true),
  (null, 'website_audit', 'Audit the website and online presence; create fix tasks for Squad Beta.',
   '{website,site,audit,seo,lighthouse,landing page,performance}',
   '[{"title":"Research SEO best practices","squad":"Beta","tool_name":"web_search"},{"title":"Study our website gaps","squad":"Beta","tool_name":"study_topic"},{"title":"Create fix tasks","squad":"Beta","tool_name":"create_task"}]'::jsonb, true),
  (null, 'content_campaign', 'Plan and draft a content campaign across channels.',
   '{content,campaign,post,posts,social,instagram,tiktok,calendar,blog}',
   '[{"title":"Research content angles","squad":"Gamma","tool_name":"web_search"},{"title":"Study the campaign theme","squad":"Gamma","tool_name":"study_topic"},{"title":"Create content production tasks","squad":"Beta","tool_name":"create_task"}]'::jsonb, true),
  (null, 'proposal_builder', 'Build a client proposal: research the client, draft the offer, create the invoice.',
   '{proposal,quote,offer,pitch,rfp,bid}',
   '[{"title":"Research the prospect","squad":"Gamma","tool_name":"web_search"},{"title":"Draft the proposal task","squad":"Beta","tool_name":"create_task"},{"title":"Draft the invoice","squad":"Delta","tool_name":"create_invoice","needs_approval":true}]'::jsonb, true),
  (null, 'ops_cleanup', 'Operations hygiene: clear stalled tasks, test connectors, propose fixes.',
   '{ops,cleanup,clean up,operations,hygiene,stalled,maintenance,fix}',
   '[{"title":"Review task backlog","squad":"Delta","tool_name":"query_analytics","tool_args":{"metric":"tasks"}},{"title":"Complete stalled tasks","squad":"Delta","tool_name":"complete_task"},{"title":"Test connectors","squad":"Delta","tool_name":"test_connector"},{"title":"Propose code fixes","squad":"Delta","tool_name":"self_edit_code","needs_approval":true}]'::jsonb, true)
on conflict do nothing;

create table if not exists knowledge_edges (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  from_study uuid references studies(id) on delete cascade,
  to_study uuid references studies(id) on delete cascade,
  relation text not null default 'related',
  created_at timestamptz not null default now(),
  unique (from_study, to_study, relation)
);

-- ---------- indexes ----------
create index if not exists idx_goals_ws on goals(workspace_id, status, created_at desc);
create index if not exists idx_goal_steps_goal on goal_steps(goal_id, idx);
create index if not exists idx_goal_steps_status on goal_steps(goal_id, status);
create index if not exists idx_goal_events_goal on goal_events(goal_id, ts desc);
create index if not exists idx_skills_ws on skills(workspace_id);
create index if not exists idx_knowledge_edges_ws on knowledge_edges(workspace_id);

-- ---------- RLS (same pattern as backend/schema.sql) ----------
alter table goals enable row level security;
alter table goal_steps enable row level security;
alter table goal_events enable row level security;
alter table skills enable row level security;
alter table knowledge_edges enable row level security;

drop policy if exists ws_isolation on goals;
create policy ws_isolation on goals for all
  using (workspace_id = jwt_workspace_id())
  with check (workspace_id = jwt_workspace_id());

-- goal_steps / goal_events link to workspaces through goals
drop policy if exists ws_isolation on goal_steps;
create policy ws_isolation on goal_steps for all
  using (exists (select 1 from goals g where g.id = goal_steps.goal_id and g.workspace_id = jwt_workspace_id()))
  with check (exists (select 1 from goals g where g.id = goal_steps.goal_id and g.workspace_id = jwt_workspace_id()));

drop policy if exists ws_isolation on goal_events;
create policy ws_isolation on goal_events for all
  using (exists (select 1 from goals g where g.id = goal_events.goal_id and g.workspace_id = jwt_workspace_id()))
  with check (exists (select 1 from goals g where g.id = goal_events.goal_id and g.workspace_id = jwt_workspace_id()));

-- skills: built-ins (workspace_id null) readable by everyone; custom rows workspace-isolated
drop policy if exists ws_isolation on skills;
create policy ws_isolation on skills for all
  using (workspace_id is null or workspace_id = jwt_workspace_id())
  with check (workspace_id = jwt_workspace_id());

drop policy if exists ws_isolation on knowledge_edges;
create policy ws_isolation on knowledge_edges for all
  using (workspace_id = jwt_workspace_id())
  with check (workspace_id = jwt_workspace_id());

-- ---------- realtime ----------
alter publication supabase_realtime add table goals;
alter publication supabase_realtime add table goal_steps;
