"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDown, ArrowUp, CheckCircle2, ExternalLink, KeyRound, Plus, RefreshCw, RotateCcw, Save, Sparkles, Trash2, XCircle, Zap,
} from "lucide-react";
import { Spinner } from "./ui";
import { dayKey, fmtDateTime, fromDayKey } from "@/lib/format";

async function call(body) {
  const res = await fetch("/api/admin/ai", {
    method: body ? "POST" : "GET",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

const pausedModels = (k) => Object.entries(k.cooldowns || {}).filter(([, t]) => new Date(t) > new Date());

export default function AdminAI({ notify }) {
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [models, setModels] = useState([]); // editable copy
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(null);
  const [newKey, setNewKey] = useState({ label: "", api_key: "" });
  const [available, setAvailable] = useState(null);
  const [custom, setCustom] = useState("");
  const [tests, setTests] = useState({});

  const load = useCallback(async () => {
    try {
      const d = await call();
      setData(d);
      setModels(d.models.map((m) => ({ ...m, rpm: m.rpm ?? "", rpd: m.rpd ?? "" })));
      setDirty(false);
      setLoadError("");
    } catch (e) {
      setLoadError(e.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function run(id, body, success) {
    setBusy(id);
    try {
      const r = await call(body);
      if (success) notify(success);
      await load();
      return r;
    } catch (e) {
      notify(e.message, "error");
    } finally {
      setBusy(null);
    }
  }

  async function addKey(e) {
    e.preventDefault();
    const r = await run("addKey", { action: "addKey", ...newKey }, "Key verified and added");
    if (r) {
      setNewKey({ label: "", api_key: "" });
      setAvailable(r.available);
    }
  }

  async function loadAvailable() {
    setBusy("available");
    try {
      setAvailable((await call({ action: "available" })).available);
    } catch (e) {
      notify(e.message, "error");
    } finally {
      setBusy(null);
    }
  }

  async function test(model) {
    setTests((t) => ({ ...t, [model]: { running: true } }));
    try {
      const r = await call({ action: "testModel", model });
      setTests((t) => ({ ...t, [model]: r }));
      await load();
    } catch (e) {
      setTests((t) => ({ ...t, [model]: { ok: false, error: e.message } }));
    }
  }

  const edit = (i, patch) => {
    setModels((ms) => ms.map((m, j) => (j === i ? { ...m, ...patch } : m)));
    setDirty(true);
  };
  const move = (i, dir) => {
    setModels((ms) => {
      const next = [...ms];
      [next[i], next[i + dir]] = [next[i + dir], next[i]];
      return next;
    });
    setDirty(true);
  };

  // Usage: last 7 days, and today per model
  const usage = useMemo(() => {
    const rows = data?.usage || [];
    const days = Array.from({ length: 7 }, (_, i) => dayKey(new Date(Date.now() - (6 - i) * 864e5)));
    const perDay = Object.fromEntries(days.map((d) => [d, { ok: 0, failed: 0 }]));
    const today = dayKey(new Date());
    const perModel = {};
    const perKey = {};
    for (const r of rows) {
      const d = dayKey(r.created_at);
      if (perDay[d]) perDay[d][r.ok ? "ok" : "failed"]++;
      if (d === today) {
        const m = (perModel[r.model] ||= { ok: 0, failed: 0, tokens: 0 });
        m[r.ok ? "ok" : "failed"]++;
        m.tokens += r.total_tokens || 0;
        if (r.ok) perKey[r.key_id] = (perKey[r.key_id] || 0) + 1;
      }
    }
    return { days, perDay, perModel, perKey, max: Math.max(1, ...Object.values(perDay).map((v) => v.ok + v.failed)) };
  }, [data]);

  if (loadError) {
    return (
      <div className="glass mt-6 p-6 text-sm text-rose-200">
        <p className="font-semibold">Couldn&apos;t load AI settings</p>
        <p className="mt-1 text-xs text-slate-400">{loadError}</p>
      </div>
    );
  }
  if (!data) return <div className="grid h-40 place-items-center"><Spinner className="h-6 w-6" /></div>;

  const inChain = new Set(models.map((m) => m.model));

  return (
    <div className="mt-6 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-white">Gemini AI</h2>
          <p className="text-xs text-slate-400">
            Runs in the Supabase Edge Function <code className="font-mono text-violet-300">gemini</code>. Keys and models change instantly; no redeploy needed.
          </p>
        </div>
        <div className="flex gap-2">
          <a href="https://aistudio.google.com/rate-limit" target="_blank" rel="noreferrer" className="btn-ghost btn-sm">
            Limits in AI Studio <ExternalLink className="h-3.5 w-3.5" />
          </a>
          <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className="btn-ghost btn-sm">
            Get API key <ExternalLink className="h-3.5 w-3.5" />
          </a>
          <button onClick={load} className="btn-ghost btn-sm" aria-label="Refresh"><RefreshCw className="h-3.5 w-3.5" /></button>
        </div>
      </div>

      {/* ---------- API KEYS ---------- */}
      <section className="glass space-y-4 p-5">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-white"><KeyRound className="h-4 w-4 text-amber-300" /> API keys</h3>
        <p className="text-xs text-slate-400">
          Keys are tried top to bottom. When a key reaches its limit for a model it&apos;s paused until the quota resets and the next key is used.
          <strong className="text-slate-200"> Free-tier limits are per Google Cloud project</strong>, so extra keys only add quota if each comes from a different project.
        </p>

        <div className="space-y-2">
          {data.keys.map((k, i) => {
            const paused = pausedModels(k);
            return (
              <div key={k.id} className={`flex flex-wrap items-center gap-3 rounded-xl border p-3 ${k.is_active ? "border-white/10 bg-white/[0.03]" : "border-white/5 bg-black/20 opacity-60"}`}>
                <div className="flex flex-col">
                  <button disabled={i === 0 || busy} onClick={() => run(k.id, { action: "updateKey", id: k.id, priority: data.keys[i - 1].priority - 1 })} className="text-slate-500 hover:text-white disabled:opacity-20" aria-label="Move up"><ArrowUp className="h-3.5 w-3.5" /></button>
                  <button disabled={i === data.keys.length - 1 || busy} onClick={() => run(k.id, { action: "updateKey", id: k.id, priority: data.keys[i + 1].priority + 1 })} className="text-slate-500 hover:text-white disabled:opacity-20" aria-label="Move down"><ArrowDown className="h-3.5 w-3.5" /></button>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white">
                    {k.label} <span className="ml-1 font-mono text-xs text-slate-500">{k.masked}</span>
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {usage.perKey[k.id] || 0} requests today · last used {k.last_used_at ? fmtDateTime(k.last_used_at) : "never"}
                  </p>
                  {paused.length > 0 && (
                    <p className="text-[11px] text-amber-300">
                      Limit reached: {paused.map(([m, t]) => `${m} (until ${fmtDateTime(t)})`).join(", ")}
                    </p>
                  )}
                  {k.last_error && !paused.length && <p className="truncate text-[11px] text-rose-300" title={k.last_error}>{k.last_error}</p>}
                </div>
                <span className={`chip ${!k.is_active ? "bg-slate-400/10 text-slate-400 ring-slate-400/20" : paused.length ? "bg-amber-400/10 text-amber-300 ring-amber-400/30" : "bg-emerald-400/10 text-emerald-300 ring-emerald-400/30"}`}>
                  {!k.is_active ? "Disabled" : paused.length ? "Partly paused" : "Active"}
                </span>
                {paused.length > 0 && (
                  <button onClick={() => run(k.id, { action: "updateKey", id: k.id, clearPauses: true }, "Pauses cleared")} className="btn-ghost btn-sm" title="Retry this key now"><RotateCcw className="h-3.5 w-3.5" /></button>
                )}
                <button onClick={() => run(k.id, { action: "updateKey", id: k.id, is_active: !k.is_active })} className="btn-ghost btn-sm">
                  {k.is_active ? "Disable" : "Enable"}
                </button>
                <button onClick={() => run(k.id, { action: "deleteKey", id: k.id }, "Key deleted")} className="btn-danger btn-sm" aria-label="Delete key"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            );
          })}
          {!data.keys.length && <p className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-xs text-amber-200">No keys yet. AI features stay hidden until you add one.</p>}
        </div>

        <form onSubmit={addKey} className="flex flex-col gap-2 sm:flex-row">
          <input className="input sm:w-48" placeholder="Label (e.g. Project B)" value={newKey.label} onChange={(e) => setNewKey({ ...newKey, label: e.target.value })} />
          <input className="input font-mono" placeholder="Paste Gemini API key" value={newKey.api_key} onChange={(e) => setNewKey({ ...newKey, api_key: e.target.value })} autoComplete="off" spellCheck={false} required />
          <button disabled={busy === "addKey"} className="btn-primary">{busy === "addKey" ? <Spinner className="h-4 w-4 text-white" /> : <Plus className="h-4 w-4" />} Add &amp; verify</button>
        </form>
      </section>

      {/* ---------- MODEL CHAIN ---------- */}
      <section className="glass space-y-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-white"><Sparkles className="h-4 w-4 text-fuchsia-300" /> Models (tried in this order)</h3>
          <button disabled={!dirty || busy === "save"} onClick={() => run("save", { action: "saveModels", models }, "Models saved")} className="btn-primary btn-sm">
            <Save className="h-3.5 w-3.5" /> Save changes
          </button>
        </div>
        <p className="text-xs text-slate-400">
          The first enabled model is the main one. If it&apos;s retired, failing, too slow (40s) or out of quota, the next one answers automatically.
          RPM/RPD are your <em>free-tier</em> limits; Google no longer publishes them, so copy yours from AI Studio. They drive the usage meter.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-xs">
            <thead>
              <tr className="border-b border-white/10 text-left uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-2 font-medium">Order</th>
                <th className="py-2 pr-2 font-medium">Model</th>
                <th className="py-2 pr-2 font-medium">On</th>
                <th className="py-2 pr-2 font-medium">RPM</th>
                <th className="py-2 pr-2 font-medium">RPD</th>
                <th className="py-2 pr-2 font-medium">Today</th>
                <th className="py-2 pr-2 font-medium">Health</th>
                <th className="py-2 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {models.map((m, i) => {
                const t = tests[m.model];
                const today = usage.perModel[m.model];
                return (
                  <tr key={m.model} className={m.enabled ? "" : "opacity-50"}>
                    <td className="py-2 pr-2">
                      <div className="flex items-center gap-1">
                        <span className="w-4 text-slate-500">{i + 1}</span>
                        <button disabled={i === 0} onClick={() => move(i, -1)} className="text-slate-500 hover:text-white disabled:opacity-20" aria-label="Move up"><ArrowUp className="h-3.5 w-3.5" /></button>
                        <button disabled={i === models.length - 1} onClick={() => move(i, 1)} className="text-slate-500 hover:text-white disabled:opacity-20" aria-label="Move down"><ArrowDown className="h-3.5 w-3.5" /></button>
                      </div>
                    </td>
                    <td className="py-2 pr-2 font-mono text-slate-100">{m.model}</td>
                    <td className="py-2 pr-2">
                      <input type="checkbox" className="accent-violet-500" checked={m.enabled} onChange={(e) => edit(i, { enabled: e.target.checked })} aria-label={`Enable ${m.model}`} />
                    </td>
                    <td className="py-2 pr-2"><input type="number" min="0" className="input w-16 px-2 py-1 text-xs" value={m.rpm} onChange={(e) => edit(i, { rpm: e.target.value })} aria-label="Requests per minute" /></td>
                    <td className="py-2 pr-2"><input type="number" min="0" className="input w-20 px-2 py-1 text-xs" value={m.rpd} onChange={(e) => edit(i, { rpd: e.target.value })} aria-label="Requests per day" /></td>
                    <td className="py-2 pr-2 text-slate-300">
                      {today?.ok || 0}{m.rpd ? <span className="text-slate-500"> / {m.rpd * Math.max(1, data.keys.filter((k) => k.is_active).length)}</span> : ""}
                      {today?.failed ? <span className="ml-1 text-rose-300">({today.failed} failed)</span> : ""}
                    </td>
                    <td className="max-w-56 py-2 pr-2">
                      {t?.running ? (
                        <span className="flex items-center gap-1 text-slate-400"><Spinner className="h-3 w-3" /> testing…</span>
                      ) : t ? (
                        t.ok ? (
                          <span className="flex items-center gap-1 text-emerald-300"><CheckCircle2 className="h-3.5 w-3.5" /> OK in {(t.ms / 1000).toFixed(1)}s</span>
                        ) : (
                          <span className="flex items-start gap-1 text-rose-300" title={t.error}><XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /><span className="line-clamp-2">{t.error}</span></span>
                        )
                      ) : m.last_error && (!m.last_ok_at || new Date(m.last_error_at) > new Date(m.last_ok_at)) ? (
                        <span className="line-clamp-2 text-rose-300" title={m.last_error}>{m.last_error}</span>
                      ) : m.last_ok_at ? (
                        <span className="text-emerald-300">OK{m.avg_latency_ms ? ` · ~${(m.avg_latency_ms / 1000).toFixed(1)}s` : ""}</span>
                      ) : (
                        <span className="text-slate-500">not used yet</span>
                      )}
                    </td>
                    <td className="py-2">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => test(m.model)} disabled={t?.running || !data.keys.length} className="btn-ghost btn-sm"><Zap className="h-3.5 w-3.5" /> Test</button>
                        <button onClick={() => run(m.model, { action: "removeModel", model: m.model }, "Model removed")} className="btn-ghost btn-sm text-slate-400 hover:text-rose-300" aria-label={`Remove ${m.model}`}><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {dirty && <p className="text-xs text-amber-300">Unsaved changes. Click &quot;Save changes&quot;.</p>}

        <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.02] p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-medium text-slate-300">Add a model</p>
            <button onClick={loadAvailable} disabled={busy === "available" || !data.keys.length} className="btn-ghost btn-sm">
              {busy === "available" ? <Spinner className="h-3.5 w-3.5" /> : <RefreshCw className="h-3.5 w-3.5" />} Show models my key can use
            </button>
          </div>
          {available && (
            <div className="flex flex-wrap gap-1.5">
              {available.map((a) => (
                <button
                  key={a.model}
                  disabled={inChain.has(a.model)}
                  onClick={() => run(a.model, { action: "addModel", model: a.model }, `${a.model} added`)}
                  className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 font-mono text-[11px] text-slate-200 hover:border-violet-400/50 disabled:opacity-30"
                  title={`${a.label} · input ${a.input?.toLocaleString()} tokens`}
                >
                  {inChain.has(a.model) ? "✓ " : "+ "}{a.model}
                </button>
              ))}
            </div>
          )}
          <form onSubmit={(e) => { e.preventDefault(); run("custom", { action: "addModel", model: custom }, `${custom} added`).then(() => setCustom("")); }} className="flex gap-2">
            <input className="input py-1.5 font-mono text-xs" placeholder="or type a model name, e.g. gemini-3.5-flash" value={custom} onChange={(e) => setCustom(e.target.value)} />
            <button className="btn-ghost btn-sm" disabled={!custom.trim()}><Plus className="h-3.5 w-3.5" /> Add</button>
          </form>
        </div>
      </section>

      {/* ---------- USAGE ---------- */}
      <section className="glass p-5">
        <h3 className="mb-4 text-sm font-semibold text-white">AI requests, last 7 days</h3>
        <div className="flex h-32 items-end gap-2">
          {usage.days.map((d) => {
            const v = usage.perDay[d];
            return (
              <div key={d} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                <span className="text-[10px] text-slate-400">{v.ok}</span>
                <div className="flex w-full max-w-10 flex-col justify-end overflow-hidden rounded-t" style={{ height: `${((v.ok + v.failed) / usage.max) * 100}%` }}>
                  <div className="bg-rose-400/70" style={{ flex: v.failed }} />
                  <div className="bg-gradient-to-t from-violet-500 to-fuchsia-400" style={{ flex: v.ok }} />
                </div>
                <span className="text-[10px] text-slate-500">{fromDayKey(d).toLocaleDateString(undefined, { weekday: "short" })}</span>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-[11px] text-slate-500">
          Purple = answered, red = failed attempts (quota, timeout, retired model). Daily quotas reset at midnight Pacific time.
        </p>
      </section>
    </div>
  );
}
