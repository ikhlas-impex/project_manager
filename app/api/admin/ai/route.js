import { supabaseAdmin, json } from "@/lib/server";
import { verifyAdminRequest } from "@/lib/admin";
import { listTextModels, maskKey, testModel } from "@/lib/gemini";

export const runtime = "nodejs";
export const maxDuration = 60;

// Admin: Gemini keys, model chain and usage history
export async function GET(req) {
  if (!verifyAdminRequest(req)) return json({ error: "Unauthorized" }, 401);
  const db = supabaseAdmin();
  const since = new Date(Date.now() - 7 * 864e5).toISOString();

  const [keys, models, usage] = await Promise.all([
    db.from("ai_keys").select("*").order("priority").order("created_at"),
    db.from("ai_models").select("*").order("position"),
    db.from("ai_usage").select("created_at, model, key_id, ok, total_tokens").gte("created_at", since).limit(50000),
  ]);
  if (keys.error) return json({ error: "AI tables missing — run supabase/migrations/004_ai_gateway.sql first." }, 500);

  return json({
    keys: keys.data.map(({ api_key, ...k }) => ({ ...k, masked: maskKey(api_key) })),
    models: models.data,
    usage: usage.data || [],
  });
}

export async function POST(req) {
  if (!verifyAdminRequest(req)) return json({ error: "Unauthorized" }, 401);
  const db = supabaseAdmin();
  const body = await req.json().catch(() => ({}));

  const firstKey = async () => {
    const { data } = await db.from("ai_keys").select("api_key").eq("is_active", true).order("priority").order("created_at").limit(1);
    return data?.[0]?.api_key;
  };

  switch (body.action) {
    case "addKey": {
      const apiKey = String(body.api_key || "").trim();
      if (!apiKey) return json({ error: "Paste an API key" }, 400);
      let available;
      try {
        available = await listTextModels(apiKey); // also validates the key
      } catch (e) {
        return json({ error: e.message }, 400);
      }
      const { count } = await db.from("ai_keys").select("id", { count: "exact", head: true });
      const { error } = await db.from("ai_keys").insert({
        label: String(body.label || "").trim() || `Key ${(count || 0) + 1}`,
        api_key: apiKey,
        priority: count || 0,
      });
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true, available });
    }

    case "updateKey": {
      const patch = {};
      for (const f of ["label", "is_active", "priority"]) if (f in body) patch[f] = body[f];
      if (body.clearPauses) Object.assign(patch, { cooldowns: {}, last_error: null });
      const { error } = await db.from("ai_keys").update(patch).eq("id", body.id);
      return error ? json({ error: error.message }, 500) : json({ ok: true });
    }

    case "deleteKey": {
      const { error } = await db.from("ai_keys").delete().eq("id", body.id);
      return error ? json({ error: error.message }, 500) : json({ ok: true });
    }

    case "available": {
      const apiKey = await firstKey();
      if (!apiKey) return json({ error: "Add an API key first" }, 400);
      try {
        return json({ available: await listTextModels(apiKey) });
      } catch (e) {
        return json({ error: e.message }, 400);
      }
    }

    case "saveModels": {
      const rows = (body.models || []).map((m, i) => ({
        model: m.model,
        enabled: Boolean(m.enabled),
        position: i,
        rpm: m.rpm === "" || m.rpm == null ? null : Number(m.rpm),
        rpd: m.rpd === "" || m.rpd == null ? null : Number(m.rpd),
      }));
      const { error } = await db.from("ai_models").upsert(rows);
      return error ? json({ error: error.message }, 500) : json({ ok: true });
    }

    case "addModel": {
      const model = String(body.model || "").trim().replace(/^models\//, "");
      if (!model) return json({ error: "Model name required" }, 400);
      const { data } = await db.from("ai_models").select("position").order("position", { ascending: false }).limit(1);
      const { error } = await db.from("ai_models").insert({ model, position: (data?.[0]?.position ?? -1) + 1 });
      return error ? json({ error: error.message }, 500) : json({ ok: true });
    }

    case "removeModel": {
      const { error } = await db.from("ai_models").delete().eq("model", body.model);
      return error ? json({ error: error.message }, 500) : json({ ok: true });
    }

    case "testModel": {
      const apiKey = await firstKey();
      if (!apiKey) return json({ error: "Add an API key first" }, 400);
      const result = await testModel(apiKey, body.model, 50_000);
      const now = new Date().toISOString();
      await db
        .from("ai_models")
        .update(result.ok ? { last_ok_at: now, last_error: null, avg_latency_ms: result.ms } : { last_error: result.error.slice(0, 300), last_error_at: now })
        .eq("model", body.model);
      return json(result);
    }

    default:
      return json({ error: "Unknown action" }, 400);
  }
}
