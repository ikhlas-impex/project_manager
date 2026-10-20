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
