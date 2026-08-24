-- ============================================================
-- QIMMAH DIGITAL — MCP TOOL SYSTEM
-- Tables for the 13-tool MCP registry: per-agent toolkit
-- overrides, execution log, and human approval queue.
-- Run AFTER backend/schema.sql in the Supabase SQL editor.
-- Uses the same workspace-isolation pattern (jwt_workspace_id()).
-- ============================================================

-- ---------- tables ----------
create table if not exists agent_toolkits (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references agents(id) on delete cascade,
  tool_name text not null,
  granted boolean not null default true,
  created_at timestamptz not null default now(),
  unique (agent_id, tool_name)
);

create table if not exists tool_executions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  agent_id uuid references agents(id) on delete set null,
  tool_name text not null,
  args jsonb not null default '{}'::jsonb,
  success boolean not null default false,
  result jsonb,
  error text,
  cost numeric(10,6) not null default 0,
  latency_ms int,
  cycle_id uuid,
  approval_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists tool_approvals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  agent_id uuid references agents(id) on delete set null,
  tool_name text not null,
  args jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  reason text,
  decided_by uuid references users(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------- indexes ----------
create index if not exists idx_agent_toolkits_agent on agent_toolkits(agent_id);
create index if not exists idx_tool_executions_ws on tool_executions(workspace_id, created_at desc);
create index if not exists idx_tool_executions_agent on tool_executions(agent_id, created_at desc);
create index if not exists idx_tool_approvals_ws on tool_approvals(workspace_id, status, created_at desc);

-- ---------- RLS (same pattern as backend/schema.sql) ----------
alter table agent_toolkits enable row level security;
alter table tool_executions enable row level security;
alter table tool_approvals enable row level security;

-- agent_toolkits links to workspaces through agents
drop policy if exists ws_isolation on agent_toolkits;
create policy ws_isolation on agent_toolkits for all
  using (exists (select 1 from agents a where a.id = agent_toolkits.agent_id and a.workspace_id = jwt_workspace_id()))
  with check (exists (select 1 from agents a where a.id = agent_toolkits.agent_id and a.workspace_id = jwt_workspace_id()));

drop policy if exists ws_isolation on tool_executions;
create policy ws_isolation on tool_executions for all
  using (workspace_id = jwt_workspace_id())
  with check (workspace_id = jwt_workspace_id());

drop policy if exists ws_isolation on tool_approvals;
create policy ws_isolation on tool_approvals for all
  using (workspace_id = jwt_workspace_id())
  with check (workspace_id = jwt_workspace_id());

-- ---------- realtime ----------
alter publication supabase_realtime add table tool_approvals;
alter publication supabase_realtime add table tool_executions;
