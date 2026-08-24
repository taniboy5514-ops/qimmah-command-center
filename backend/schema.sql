-- ============================================================
-- QIMMAH DIGITAL — CEO COMMAND CENTER
-- Supabase schema (15 tables) + RLS + realtime + provisioning
-- Run once in the Supabase SQL editor (or via `supabase db push`).
-- ============================================================

-- ---------- extensions ----------
create extension if not exists "pgcrypto";

-- ---------- tables ----------
create table if not exists workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  role text not null default 'CEO',
  pin_hash text not null,
  created_at timestamptz not null default now(),
  unique (workspace_id, name)
);

create table if not exists agents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  num int not null,
  code text not null,
  name text not null,
  squad text not null check (squad in ('Alpha','Beta','Gamma','Delta','Epsilon')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (workspace_id, num)
);

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  agent_id uuid references agents(id) on delete set null,
  title text not null,
  status text not null default 'open' check (status in ('open','in_progress','done','blocked')),
  priority text not null default 'normal',
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  company text,
  channel text,
  status text not null default 'new',
  value numeric(12,3),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  kind text not null check (kind in ('income','expense')),
  amount numeric(12,3) not null check (amount >= 0),
  category text,
  description text,
  tx_date date not null default current_date,
  created_at timestamptz not null default now()
);

create table if not exists invoices (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  client_name text not null,
  status text not null default 'draft' check (status in ('draft','sent','paid','overdue','cancelled')),
  currency text not null default 'OMR',
  issue_date date not null default current_date,
  due_date date,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists invoice_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  invoice_id uuid not null references invoices(id) on delete cascade,
  description text not null,
  qty numeric(10,2) not null default 1,
  unit_price numeric(12,3) not null default 0
);

create table if not exists contracts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  client_name text not null,
  title text not null,
  value numeric(12,3),
  status text not null default 'draft' check (status in ('draft','active','expired','terminated')),
  starts_on date,
  ends_on date,
  body text,
  created_at timestamptz not null default now()
);

create table if not exists feed_entries (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  kind text not null default 'info',
  text text not null,
  created_at timestamptz not null default now()
);

create table if not exists studies (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  topic text not null,
  brief text not null,
  model text,
  created_at timestamptz not null default now()
);

create table if not exists study_sources (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  study_id uuid not null references studies(id) on delete cascade,
  title text,
  url text not null
);

create table if not exists results (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  kind text not null default 'squad_cycle',
  squad text,
  summary text not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists squad_directives (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  squad text not null check (squad in ('Alpha','Beta','Gamma','Delta','Epsilon')),
  directive text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists settings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  key text not null,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique (workspace_id, key)
);

-- ---------- indexes ----------
create index if not exists idx_users_workspace on users(workspace_id);
create index if not exists idx_agents_workspace on agents(workspace_id, squad);
create index if not exists idx_tasks_workspace on tasks(workspace_id, status);
create index if not exists idx_leads_workspace on leads(workspace_id, status);
create index if not exists idx_transactions_workspace on transactions(workspace_id, tx_date desc);
create index if not exists idx_invoices_workspace on invoices(workspace_id, status);
create index if not exists idx_invoice_items_invoice on invoice_items(workspace_id, invoice_id);
create index if not exists idx_contracts_workspace on contracts(workspace_id, status);
create index if not exists idx_feed_workspace on feed_entries(workspace_id, created_at desc);
create index if not exists idx_studies_workspace on studies(workspace_id, created_at desc);
create index if not exists idx_study_sources_study on study_sources(workspace_id, study_id);
create index if not exists idx_results_workspace on results(workspace_id, created_at desc);
create index if not exists idx_directives_workspace on squad_directives(workspace_id, active);
create index if not exists idx_settings_workspace on settings(workspace_id, key);

-- ---------- RLS ----------
-- Policies read workspace_id from the JWT issued by api/auth/pin-login.
-- The backend uses the SERVICE ROLE key which bypasses RLS; these
-- policies protect any direct/anon client access via Supabase realtime/REST.

create or replace function jwt_workspace_id() returns uuid
language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'workspace_id', '')::uuid
$$;

alter table workspaces enable row level security;
alter table users enable row level security;
alter table agents enable row level security;
alter table tasks enable row level security;
alter table leads enable row level security;
alter table transactions enable row level security;
alter table invoices enable row level security;
alter table invoice_items enable row level security;
alter table contracts enable row level security;
alter table feed_entries enable row level security;
alter table studies enable row level security;
alter table study_sources enable row level security;
alter table results enable row level security;
alter table squad_directives enable row level security;
alter table settings enable row level security;

-- workspace-scoped select policy applied to every table
do $$
declare t text;
begin
  foreach t in array array['workspaces','users','agents','tasks','leads','transactions','invoices','invoice_items','contracts','feed_entries','studies','study_sources','results','squad_directives','settings']
  loop
    if t = 'workspaces' then
      execute format('drop policy if exists ws_isolation on %I; create policy ws_isolation on %I for all using (id = jwt_workspace_id()) with check (id = jwt_workspace_id());', t, t);
    else
      execute format('drop policy if exists ws_isolation on %I; create policy ws_isolation on %I for all using (workspace_id = jwt_workspace_id()) with check (workspace_id = jwt_workspace_id());', t, t);
    end if;
  end loop;
end $$;

-- ---------- realtime ----------
alter publication supabase_realtime add table feed_entries;
alter publication supabase_realtime add table squad_directives;

-- ---------- provisioning ----------
-- provision_workspace(user_name) -> { workspace_id, user_id }
-- Creates a workspace, the CEO user (placeholder pin_hash to be
-- replaced by the auth endpoint), and seeds the full 60-agent fleet.
create or replace function provision_workspace(p_user_name text, p_pin_hash text default '')
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_ws uuid;
  v_user uuid;
  v_names text[][] := array[
    array['Alpha', 'Cold Outreach,Instagram Lead Gen,Email Campaigns,Facebook Ads,Google Ads,WhatsApp Bot,Landing Pages,SEO Keywords,Content Strategy,Social Scheduler,Influencer Outreach,CRM Manager,Proposal Writer,Pricing Analyst,Sales Closer'],
    array['Beta', 'Web Developer,UI/UX Designer,E-commerce Specialist,Security Auditor,Content Writer,Video Editor,Graphic Designer,SEO On-Page,SEO Off-Page,Social Media Manager,Ad Copywriter,Analytics Specialist,QA Tester,Project Manager,Account Manager'],
    array['Gamma', 'Market Research,Financial Analyst,Competitor Tracker,Trend Forecaster,Customer Insights,Brand Strategist,Growth Hacker,Data Scientist,Arabic Content,Localization,Reputation Manager,Technical SEO,Backlink Analyst,Keyword Tracker,Content Gap Analyzer'],
    array['Delta', 'Process Automation,Chatbot Builder,Email Automation,CRM Automator,Invoice Generator,Appointment Scheduler,Document Processor,Social Listening,Report Generator,Quality Assurance'],
    array['Epsilon', 'AI Prompt Engineer,Tech Researcher,Integration Specialist,Training Coordinator,Innovation Lead']
  ];
  v_squad text[];
  v_name text;
  v_num int := 1;
begin
  insert into workspaces (name) values (p_user_name || '''s Workspace') returning id into v_ws;
  insert into users (workspace_id, name, role, pin_hash) values (v_ws, p_user_name, 'CEO', p_pin_hash) returning id into v_user;

  foreach v_squad slice 1 in array v_names loop
    foreach v_name in array string_to_array(v_squad[2], ',') loop
      insert into agents (workspace_id, num, code, name, squad)
      values (v_ws, v_num, 'Agent-' || lpad(v_num::text, 2, '0'), v_name, v_squad[1]);
      v_num := v_num + 1;
    end loop;
  end loop;

  insert into feed_entries (workspace_id, kind, text)
  values (v_ws, 'system', 'Workspace provisioned. 60 agents across 5 squads are online.');

  return jsonb_build_object('workspace_id', v_ws, 'user_id', v_user);
end;
$$;
