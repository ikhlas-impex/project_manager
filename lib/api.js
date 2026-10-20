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
// Gemini runs in the Supabase Edge Function "gemini" (supabase/functions/gemini).
async function gemini(body) {
  const { data, error } = await supabase.functions.invoke("gemini", { body });
  if (error) {
    const detail = await error.context?.json?.().catch(() => null);
    throw new Error(detail?.error || error.message || "AI request failed");
  }
  return data;
}

export async function askAI(mode, payload) {
  try {
    return (await gemini({ action: "generate", mode, ...payload })).text;
  } finally {
    window.dispatchEvent(new Event("teamflow:ai-used")); // refresh the usage meter
  }
}

export const getAIUsage = () => gemini({ action: "usage" });
