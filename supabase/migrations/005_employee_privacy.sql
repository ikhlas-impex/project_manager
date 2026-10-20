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
