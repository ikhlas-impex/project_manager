-- TeamFlow: wait on someone outside the app (e.g. "Nasrudeen Sir", "Saudi team", a vendor).
-- A waiting task has either waiting_on (an app user) or waiting_on_name (free text).
-- Run in Supabase -> SQL Editor of the TeamFlow project (safe to re-run).
alter table public.tasks add column if not exists waiting_on_name text;

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
    new.waiting_on_name = null;
    new.waiting_reason = null;
  end if;
  return new;
end $$;
