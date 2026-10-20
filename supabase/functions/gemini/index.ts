// TeamFlow AI gateway — Supabase Edge Function.
// Deploy: npx supabase functions deploy gemini --project-ref <ref>
//
// - API keys + model order live in the database (managed from /admin -> AI),
//   so keys/models can be changed without redeploying anything.
// - If a key hits its quota (HTTP 429) it is paused for that model until the
//   quota resets, and the next key is tried. If a model is gone / broken / slow,
//   the next model in the chain is tried.
// - Every call is logged to ai_usage, which powers the usage meter.
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const ATTEMPT_TIMEOUT_MS = 40_000; // give up on a slow model and move on
const TOTAL_BUDGET_MS = 110_000;   // stay under the edge function wall-clock limit

const SYSTEM = `You are TeamFlow's assistant for a small team (a manager and employees).
Be concise, practical and friendly. Use plain text with simple bullet points ("•") and short headings.
Never invent tasks or numbers that are not in the provided data.`;

// deno-lint-ignore no-explicit-any
const PROMPTS: Record<string, (b: any) => string> = {
  describe: ({ title, notes }) =>
    `Write a short task description (2-4 sentences) followed by a checklist of 3-6 concrete steps ("- [ ] step").
Task title: "${title}"${notes ? `\nExisting notes: ${notes}` : ""}
Return only the description and checklist.`,

  summary: ({ text }) =>
    `Rewrite this daily work update so it is clear and professional, ready to paste into chat or email.
Keep every task and fact, keep the emoji section headings, add a one-line "Highlights" at the top. Plain text only.

${text}`,

  report: ({ period, stats, tasks }) =>
    `Analyse this team performance data for ${period} and write a report with these sections:
1. Overview (2-3 sentences)
2. Key wins
3. Bottlenecks & waiting time (who/what is blocking)
4. Per-person notes
5. Recommendations for next period (3-5 actionable bullets)

Stats JSON: ${JSON.stringify(stats)}
Tasks JSON: ${JSON.stringify(tasks)}`,

  chat: ({ messages, context }) =>
    `Current team data (JSON): ${JSON.stringify(context)}

Conversation so far:
${(messages || []).map((m: { role: string; text: string }) => `${m.role === "user" ? "User" : "Assistant"}: ${m.text}`).join("\n")}

Reply to the user's last message as the Assistant.`,
};

// Gemini daily quotas reset at midnight Pacific time.
function pacificDay(now = new Date()) {
  const pt = new Date(now.toLocaleString("en-US", { timeZone: "America/Los_Angeles" }));
  const offset = now.getTime() - pt.getTime();
  const start = new Date(pt);
  start.setHours(0, 0, 0, 0);
  const next = new Date(start);
  next.setDate(next.getDate() + 1);
  return { dayStart: new Date(start.getTime() + offset), nextReset: new Date(next.getTime() + offset) };
}

// How long to pause a key for a model after a 429.
// deno-lint-ignore no-explicit-any
function cooldownUntil(error: any): Date {
  const details = error?.details || [];
  // deno-lint-ignore no-explicit-any
  const violations = details.find((d: any) => d["@type"]?.endsWith("QuotaFailure"))?.violations || [];
  // deno-lint-ignore no-explicit-any
  if (violations.some((v: any) => /PerDay/i.test(v.quotaId || ""))) return pacificDay().nextReset;
  // deno-lint-ignore no-explicit-any
  const retry = details.find((d: any) => d["@type"]?.endsWith("RetryInfo"))?.retryDelay;
  const secs = Math.min(Math.max(retry ? parseFloat(retry) : 60, 10), 3600);
  return new Date(Date.now() + secs * 1000);
}

const isKeyProblem = (status: number, msg: string) =>
  status === 401 || status === 403 || (status === 400 && /api key/i.test(msg));

// deno-lint-ignore no-explicit-any
async function generate(userId: string, body: any) {
  const build = PROMPTS[body.mode];
  if (!build) return reply({ error: "Unknown AI mode" }, 400);
  const prompt = build(body).slice(0, 120_000);

  const [{ data: models }, { data: keys }] = await Promise.all([
    db.from("ai_models").select("*").eq("enabled", true).order("position"),
    db.from("ai_keys").select("*").eq("is_active", true).order("priority").order("created_at"),
  ]);
  if (!keys?.length) return reply({ error: "AI isn't set up yet. The admin needs to add a Gemini API key in /admin → AI." }, 503);
  if (!models?.length) return reply({ error: "No AI model is enabled. The admin can enable one in /admin → AI." }, 503);

  const started = Date.now();
  const deadKeys = new Set<string>();
  const errors: string[] = [];
  const log = (row: Record<string, unknown>) => db.from("ai_usage").insert({ user_id: userId, mode: body.mode, ...row });

  for (const m of models) {
    for (const k of keys) {
      if (Date.now() - started > TOTAL_BUDGET_MS) break;
      if (deadKeys.has(k.id)) continue;
      const pausedUntil = k.cooldowns?.[m.model];
      if (pausedUntil && new Date(pausedUntil) > new Date()) continue;

      const t0 = Date.now();
      let res: Response;
      // deno-lint-ignore no-explicit-any
      let data: any;
      try {
        res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m.model}:generateContent`, {
          method: "POST",
          signal: AbortSignal.timeout(ATTEMPT_TIMEOUT_MS),
          headers: { "Content-Type": "application/json", "x-goog-api-key": k.api_key },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: SYSTEM }] },
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.4 },
          }),
        });
        data = await res.json().catch(() => ({}));
      } catch {
        // Too slow / network error: this model is struggling, try the next model
        await log({ key_id: k.id, model: m.model, ok: false, status: 0, error: "timeout", latency_ms: Date.now() - t0 });
        await db.from("ai_models").update({ last_error: `Timed out after ${ATTEMPT_TIMEOUT_MS / 1000}s`, last_error_at: new Date().toISOString() }).eq("model", m.model);
        errors.push(`${m.model}: timed out`);
        break;
      }
      const latency = Date.now() - t0;

      if (res.ok) {
        // deno-lint-ignore no-explicit-any
        const text = (data.candidates?.[0]?.content?.parts || []).map((p: any) => p.text || "").join("").trim();
        const u = data.usageMetadata || {};
        if (!text) {
          await log({ key_id: k.id, model: m.model, ok: false, status: 200, error: "empty response", latency_ms: latency });
          errors.push(`${m.model}: empty response`);
          break;
        }
        const now = new Date().toISOString();
        await Promise.all([
          log({
            key_id: k.id, model: m.model, ok: true, status: 200, latency_ms: latency,
            prompt_tokens: u.promptTokenCount || 0, output_tokens: u.candidatesTokenCount || 0, total_tokens: u.totalTokenCount || 0,
          }),
          db.from("ai_keys").update({ last_used_at: now }).eq("id", k.id),
          db.from("ai_models").update({
            last_ok_at: now, last_error: null,
            avg_latency_ms: m.avg_latency_ms ? Math.round(m.avg_latency_ms * 0.7 + latency * 0.3) : latency,
          }).eq("model", m.model),
        ]);
        return reply({ text, model: m.model, key: k.label });
      }

      const msg: string = data?.error?.message || `HTTP ${res.status}`;
      await log({ key_id: k.id, model: m.model, ok: false, status: res.status, error: msg.slice(0, 300), latency_ms: latency });

      if (res.status === 429) {
        // Quota hit for this key+model: pause it until it resets, try the next key
        k.cooldowns = { ...(k.cooldowns || {}), [m.model]: cooldownUntil(data.error).toISOString() };
        await db.from("ai_keys").update({ cooldowns: k.cooldowns, last_error: `${m.model}: limit reached`, last_error_at: new Date().toISOString() }).eq("id", k.id);
        errors.push(`${m.model} (${k.label}): limit reached`);
        continue;
      }
      if (isKeyProblem(res.status, msg)) {
        deadKeys.add(k.id);
        await db.from("ai_keys").update({ last_error: msg.slice(0, 300), last_error_at: new Date().toISOString() }).eq("id", k.id);
        errors.push(`${k.label}: ${msg}`);
        continue;
      }
      // Model retired (404), unsupported option (400) or overloaded (5xx): next model
      await db.from("ai_models").update({ last_error: msg.slice(0, 300), last_error_at: new Date().toISOString() }).eq("model", m.model);
      errors.push(`${m.model}: ${msg}`);
      break;
    }
  }

  const allLimited = errors.length > 0 && errors.every((e) => e.includes("limit reached"));
  return reply(
    {
      error: allLimited
        ? `Today's free AI limit is used up on all keys. It resets at ${pacificDay().nextReset.toISOString()} — or the admin can add another API key.`
        : `AI is unavailable right now. ${errors.slice(-3).join(" · ") || "No usable model/key (all paused)."}`,
      details: errors,
    },
    503
  );
}

async function usage() {
  const { dayStart, nextReset } = pacificDay();
  const [{ data: models }, { data: keys }, { data: rows }] = await Promise.all([
    db.from("ai_models").select("*").order("position"),
    db.from("ai_keys").select("id, label, is_active, cooldowns"),
    db.from("ai_usage").select("model, ok, total_tokens, created_at").gte("created_at", dayStart.toISOString()).limit(20000),
  ]);
  const active = (keys || []).filter((k) => k.is_active);
  const now = Date.now();

  const list = (models || []).map((m) => {
    const mine = (rows || []).filter((r) => r.model === m.model);
    const ok = mine.filter((r) => r.ok);
    return {
      model: m.model,
      enabled: m.enabled,
      rpm: m.rpm,
      rpd: m.rpd,
      // free-tier quota is per Google project; assumes each key is from a different project
      capacity: m.rpd ? m.rpd * active.length : null,
      usedToday: ok.length,
      failedToday: mine.length - ok.length,
      lastMinute: ok.filter((r) => now - new Date(r.created_at).getTime() < 60_000).length,
      tokensToday: ok.reduce((s, r) => s + (r.total_tokens || 0), 0),
      keysPaused: active.filter((k) => k.cooldowns?.[m.model] && new Date(k.cooldowns[m.model]).getTime() > now).length,
      lastError: m.last_error,
      lastErrorAt: m.last_error_at,
      lastOkAt: m.last_ok_at,
      avgLatencyMs: m.avg_latency_ms,
    };
  });

  return reply({ resetAt: nextReset.toISOString(), activeKeys: active.length, models: list });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return reply({ error: "Method not allowed" }, 405);

  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: auth } = await db.auth.getUser(token);
  if (!auth?.user) return reply({ error: "Please sign in again." }, 401);

  const body = await req.json().catch(() => ({}));
  try {
    if (body.action === "usage") return await usage();
    return await generate(auth.user.id, body);
  } catch (e) {
    console.error(e);
    return reply({ error: `AI gateway error: ${(e as Error).message}` }, 500);
  }
});
