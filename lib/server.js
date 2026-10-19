import { createClient } from "@supabase/supabase-js";

// Verifies the bearer token sent by lib/api.js and returns a Supabase client
// that acts as that user (so Row Level Security still applies).
export async function requireUser(req) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!token || !url || !anon) return null;

  const sb = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data.user) return null;
  return { user: data.user, sb };
}

export const json = (data, status = 200) => Response.json(data, { status });
