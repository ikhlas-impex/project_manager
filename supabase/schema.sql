-- TeamFlow schema. Run once in Supabase -> SQL Editor (safe to re-run).

-- ========== PROFILES ==========
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  full_name text,
  role text not null default 'employee' check (role in ('manager','employee')),
  notify_email text,            -- Gmail / email address that receives notifications
  avatar_color text default '#8b5cf6',
  created_at timestamptz not null default now()
);

-- Auto-create a profile whenever an auth user is created
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'role', 'employee')
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ========== TASKS ==========
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  priority text not null default 'medium' check (priority in ('low','medium','high','urgent')),
  status text not null default 'todo' check (status in ('todo','in_progress','waiting','done')),
  created_by uuid not null references public.profiles(id) on delete cascade,
  assigned_to uuid references public.profiles(id) on delete set null,
  start_at timestamptz default now(),
  due_at timestamptz,
  waiting_on uuid references public.profiles(id) on delete set null,
  waiting_reason text,
  waiting_since timestamptz,
  waiting_total_minutes integer not null default 0,  -- accumulated time spent waiting
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists tasks_assigned_idx on public.tasks(assigned_to);
create index if not exists tasks_due_idx on public.tasks(due_at);

-- ========== ACTIVITY LOG (feeds the daily summary + reports) ==========
create table if not exists public.task_activity (
  id bigint generated always as identity primary key,
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  kind text not null,          -- created | status | note | assigned | edited
  message text,
  created_at timestamptz not null default now()
);
create index if not exists activity_created_idx on public.task_activity(created_at);

-- Keep updated_at, completed_at and waiting time in sync automatically
create or replace function public.tasks_before_update()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  if new.status = 'done' and old.status <> 'done' then
    new.completed_at = now();
  elsif new.status <> 'done' then
    new.completed_at = null;
  end if;
  if new.status = 'waiting' and old.status <> 'waiting' then
    new.waiting_since = now();
  elsif new.status <> 'waiting' and old.status = 'waiting' then
    new.waiting_total_minutes = old.waiting_total_minutes
      + greatest(0, floor(extract(epoch from (now() - coalesce(old.waiting_since, now()))) / 60))::int;
    new.waiting_since = null;
    new.waiting_on = null;
    new.waiting_reason = null;
  end if;
  return new;
end $$;

drop trigger if exists tasks_before_update on public.tasks;
create trigger tasks_before_update before update on public.tasks
  for each row execute function public.tasks_before_update();

create or replace function public.tasks_before_insert()
returns trigger language plpgsql as $$
begin
  if new.status = 'waiting' then new.waiting_since = now(); end if;
  if new.status = 'done' then new.completed_at = now(); end if;
  return new;
end $$;

drop trigger if exists tasks_before_insert on public.tasks;
create trigger tasks_before_insert before insert on public.tasks
  for each row execute function public.tasks_before_insert();

-- ========== ROW LEVEL SECURITY ==========
alter table public.profiles enable row level security;
alter table public.tasks enable row level security;
alter table public.task_activity enable row level security;

create or replace function public.is_manager() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'manager');
$$;

create or replace function public.my_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid();
$$;

drop policy if exists "profiles read" on public.profiles;
create policy "profiles read" on public.profiles for select to authenticated using (true);
drop policy if exists "profiles self update" on public.profiles;
-- users can edit their own profile but cannot change their own role
create policy "profiles self update" on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and role = public.my_role());

drop policy if exists "tasks read" on public.tasks;
create policy "tasks read" on public.tasks for select to authenticated using (true);
drop policy if exists "tasks insert" on public.tasks;
create policy "tasks insert" on public.tasks for insert to authenticated with check (created_by = auth.uid());
drop policy if exists "tasks update" on public.tasks;
create policy "tasks update" on public.tasks for update to authenticated
  using (created_by = auth.uid() or assigned_to = auth.uid() or waiting_on = auth.uid() or public.is_manager());
drop policy if exists "tasks delete" on public.tasks;
create policy "tasks delete" on public.tasks for delete to authenticated
  using (created_by = auth.uid() or public.is_manager());

drop policy if exists "activity read" on public.task_activity;
create policy "activity read" on public.task_activity for select to authenticated using (true);
drop policy if exists "activity insert" on public.task_activity;
create policy "activity insert" on public.task_activity for insert to authenticated with check (user_id = auth.uid());

-- ========== REALTIME (live updates between manager & employee) ==========
do $$ begin
  alter publication supabase_realtime add table public.tasks;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.task_activity;
exception when duplicate_object then null; end $$;

-- Google / Gmail connection. Run in Supabase -> SQL Editor (safe to re-run).

-- Address shown in the UI once a user has connected Gmail
alter table public.profiles add column if not exists gmail_address text;

-- OAuth refresh tokens. RLS is on with NO policies, so only the server
-- (service role key) can read them; browsers can never see the tokens.
create table if not exists public.google_accounts (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  email text not null,
  refresh_token text not null,
  updated_at timestamptz not null default now()
);
alter table public.google_accounts enable row level security;

-- Manager role approval tracking
alter table public.profiles add column if not exists role_selected boolean default false;
alter table public.profiles add column if not exists manager_request_status text default 'none' check (manager_request_status in ('none', 'pending', 'approved', 'rejected'));
alter table public.profiles add column if not exists manager_requested_at timestamptz;


-- TeamFlow: employees only see their own work; managers see everyone's.
-- Run in Supabase -> SQL Editor (safe to re-run).
--
-- An employee can see a task if they created it, it's assigned to them,
-- or someone is waiting on them for it. Managers (profiles.role = 'manager')
-- see every task. Realtime follows these rules automatically.

drop policy if exists "tasks read" on public.tasks;
create policy "tasks read" on public.tasks for select to authenticated
  using (
    public.is_manager()
    or created_by = auth.uid()
    or assigned_to = auth.uid()
    or waiting_on = auth.uid()
  );

-- Activity / progress notes are visible only if their task is visible
-- (the subquery on tasks is itself filtered by the policy above).
drop policy if exists "activity read" on public.task_activity;
create policy "activity read" on public.task_activity for select to authenticated
  using (exists (select 1 from public.tasks t where t.id = task_activity.task_id));

-- Can only add notes to tasks you can see
drop policy if exists "activity insert" on public.task_activity;
create policy "activity insert" on public.task_activity for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.tasks t where t.id = task_activity.task_id)
  );

-- TeamFlow: departments. Each person belongs to one department and has a
-- role (manager | employee) plus an editable role name (job title).
-- Managers see the work of their own department only.
-- Run in Supabase -> SQL Editor of the TeamFlow project (safe to re-run).

create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);
alter table public.departments enable row level security;
drop policy if exists "departments read" on public.departments;
create policy "departments read" on public.departments for select to authenticated using (true);
-- no write policies: the admin uses the service role; managers use rename_my_department()

alter table public.profiles add column if not exists department_id uuid references public.departments(id) on delete set null;
alter table public.profiles add column if not exists role_title text;

-- Existing people go into a default department (rename it in /admin or Team settings)
insert into public.departments (name)
select 'General' where not exists (select 1 from public.departments);
update public.profiles
set department_id = (select id from public.departments order by created_at limit 1)
where department_id is null;

-- ---------- helpers ----------
create or replace function public.my_department() returns uuid
language sql stable security definer set search_path = public as $$
  select department_id from public.profiles where id = auth.uid();
$$;

create or replace function public.in_my_department(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.id = uid and p.department_id is not null and p.department_id = public.my_department()
  );
$$;

-- A manager manages a task if its assignee or creator is in their department
create or replace function public.manages_task(t_created uuid, t_assigned uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_manager() and (public.in_my_department(t_assigned) or public.in_my_department(t_created));
$$;

-- ---------- tasks: own work, or your department's if you're its manager ----------
drop policy if exists "tasks read" on public.tasks;
create policy "tasks read" on public.tasks for select to authenticated
  using (
    created_by = auth.uid() or assigned_to = auth.uid() or waiting_on = auth.uid()
    or public.manages_task(created_by, assigned_to)
  );

drop policy if exists "tasks update" on public.tasks;
create policy "tasks update" on public.tasks for update to authenticated
  using (
    created_by = auth.uid() or assigned_to = auth.uid() or waiting_on = auth.uid()
    or public.manages_task(created_by, assigned_to)
  );

drop policy if exists "tasks delete" on public.tasks;
create policy "tasks delete" on public.tasks for delete to authenticated
  using (created_by = auth.uid() or public.manages_task(created_by, assigned_to));

-- ---------- profiles: people can't change their own role or department ----------
drop policy if exists "profiles self update" on public.profiles;
create policy "profiles self update" on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and role = public.my_role()
    and department_id is not distinct from public.my_department()
  );

-- ---------- actions with their own permission checks ----------
create or replace function public.rename_my_department(new_name text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_manager() or public.my_department() is null then
    raise exception 'Only a manager of this department can rename it';
  end if;
  if coalesce(trim(new_name), '') = '' then
    raise exception 'Department name cannot be empty';
  end if;
  update public.departments set name = trim(new_name) where id = public.my_department();
end $$;

-- Anyone can set their own role name; a manager can set it for their department's members
create or replace function public.set_role_title(member uuid, title text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if member <> auth.uid() and not (public.is_manager() and public.in_my_department(member)) then
    raise exception 'You can only edit role names in your own department';
  end if;
  update public.profiles set role_title = nullif(trim(title), '') where id = member;
end $$;

grant execute on function public.rename_my_department(text) to authenticated;
grant execute on function public.set_role_title(uuid, text) to authenticated;
