// Server-only Gemini helpers used by the admin AI settings (/api/admin/ai).
// Text generation for users runs in the Supabase Edge Function (supabase/functions/gemini).

const API = "https://generativelanguage.googleapis.com/v1beta";

export const maskKey = (k) => (k.length > 12 ? `${k.slice(0, 6)}…${k.slice(-4)}` : "••••");

// Text models this key can call (skips image/tts/embedding/etc.)
export async function listTextModels(apiKey) {
  const res = await fetch(`${API}/models?pageSize=200`, { headers: { "x-goog-api-key": apiKey } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error?.message || `Google rejected the key (${res.status})`);
  return (data.models || [])
    .filter((m) => m.supportedGenerationMethods?.includes("generateContent"))
    .map((m) => ({ model: m.name.replace("models/", ""), label: m.displayName, input: m.inputTokenLimit, output: m.outputTokenLimit }))
    .filter((m) => /^gemini/.test(m.model) && !/tts|image|embed|robotics|computer-use|transcribe|customtools|banana/.test(m.model));
}

export async function testModel(apiKey, model, timeoutMs = 60_000) {
  const t0 = Date.now();
  try {
    const res = await fetch(`${API}/models/${model}:generateContent`, {
      method: "POST",
      signal: AbortSignal.timeout(timeoutMs),
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: "Reply with just: OK" }] }] }),
    });
    const data = await res.json().catch(() => ({}));
    const ms = Date.now() - t0;
    if (!res.ok) return { ok: false, ms, status: res.status, error: data.error?.message || `HTTP ${res.status}` };
    return { ok: true, ms, text: data.candidates?.[0]?.content?.parts?.map((p) => p.text).join("").trim() };
  } catch {
    return { ok: false, ms: Date.now() - t0, status: 0, error: `No answer within ${timeoutMs / 1000}s (model too slow or overloaded)` };
  }
}
