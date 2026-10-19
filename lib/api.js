import { supabase } from "./supabase";

// Calls our own API routes with the user's Supabase access token.
export async function api(path, body) {
  const { data } = await supabase.auth.getSession();
  const res = await fetch(path, {
    method: body ? "POST" : "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${data.session?.access_token ?? ""}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
  return json;
}

export const sendEmail = (payload) => api("/api/email", payload);
export const askAI = (mode, payload) => api("/api/ai", { mode, ...payload }).then((r) => r.text);
