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
