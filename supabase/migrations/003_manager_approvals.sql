-- TeamFlow: Manager role requests and approval columns
-- Run in Supabase -> SQL Editor (safe to re-run).

alter table public.profiles add column if not exists role_selected boolean default false;
alter table public.profiles add column if not exists manager_request_status text default 'none' check (manager_request_status in ('none', 'pending', 'approved', 'rejected'));
alter table public.profiles add column if not exists manager_requested_at timestamptz;
