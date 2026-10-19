import { createClient } from "@supabase/supabase-js";

// Usernames like "manager" log in as manager@teamflow.local behind the scenes.
export const LOGIN_DOMAIN = "teamflow.local";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isConfigured = Boolean(url && anon);
export const supabase = isConfigured ? createClient(url, anon) : null;

export function toLoginEmail(id) {
  const v = id.trim().toLowerCase();
  return v.includes("@") ? v : `${v}@${LOGIN_DOMAIN}`;
}
