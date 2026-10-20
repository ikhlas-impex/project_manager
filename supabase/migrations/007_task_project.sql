-- TeamFlow: project name on tasks (groups the daily WhatsApp update, e.g. "Elkitch – Sale Mela Application").
-- Run in Supabase -> SQL Editor of the TeamFlow project (safe to re-run).
alter table public.tasks add column if not exists project text;
create index if not exists tasks_project_idx on public.tasks(project);
