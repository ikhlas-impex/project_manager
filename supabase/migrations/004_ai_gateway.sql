-- TeamFlow: Gemini AI gateway (Supabase Edge Function "gemini").
-- Run in Supabase -> SQL Editor (safe to re-run).
--
-- All three tables have RLS ON and NO policies: only the service role
-- (the edge function and the /admin API) can read them. Browsers never see API keys.

-- API keys. Add several (from DIFFERENT Google Cloud projects — free-tier quota
-- is per project, not per key). When one hits its limit the next one is used.
create table if not exists public.ai_keys (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  api_key text not null,
  is_active boolean not null default true,
  priority integer not null default 0,           -- lower = tried first
  cooldowns jsonb not null default '{}'::jsonb,  -- { "<model>": "<retry-after ISO time>" }
  last_error text,
  last_error_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.ai_keys enable row level security;

-- Models to try, in order. Free-tier limits are editable because Google changes them
-- (check https://aistudio.google.com/rate-limit for the numbers on your project).
create table if not exists public.ai_models (
  model text primary key,
  enabled boolean not null default true,
  position integer not null default 0,           -- lower = tried first
  rpm integer,                                    -- requests per minute (free tier)
  rpd integer,                                    -- requests per day (free tier, resets midnight Pacific)
  last_error text,
  last_error_at timestamptz,
  last_ok_at timestamptz,
  avg_latency_ms integer
);
alter table public.ai_models enable row level security;

-- One row per Gemini call (successful or not)
create table if not exists public.ai_usage (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  user_id uuid references public.profiles(id) on delete set null,
  key_id uuid references public.ai_keys(id) on delete set null,
  model text,
  mode text,
  ok boolean not null default true,
  status integer,
  error text,
  prompt_tokens integer default 0,
  output_tokens integer default 0,
  total_tokens integer default 0,
  latency_ms integer
);
create index if not exists ai_usage_created_idx on public.ai_usage(created_at);
alter table public.ai_usage enable row level security;

-- Default chain (tested Oct 2026: fast + working on the free tier).
-- rpm/rpd are ESTIMATES (Google doesn't publish free-tier numbers any more);
-- correct them in /admin -> AI using https://aistudio.google.com/rate-limit
-- gemini-3.8-flash works but often takes 60s+, so it's added disabled.
insert into public.ai_models (model, position, enabled, rpm, rpd) values
  ('gemini-3.5-flash',         0, true,  5,  20),
  ('gemini-3.5-flash-lite',    1, true,  10, 200),
  ('gemini-flash-lite-latest', 2, true,  10, 200),
  ('gemini-3.1-flash-lite',    3, true,  15, 500),
  ('gemini-3.8-flash',         4, false, 5,  20)
on conflict (model) do nothing;
