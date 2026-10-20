"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, ExternalLink, Sparkles } from "lucide-react";
import { getAIUsage } from "@/lib/api";
import { fmtMinutes } from "@/lib/format";

const tone = (pct) => (pct >= 90 ? "bg-rose-400" : pct >= 65 ? "bg-amber-400" : "bg-emerald-400");

// Compact "AI used today" pill for the top of the app, with a per-model breakdown.
export default function AIUsageMeter() {
  const [u, setU] = useState(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const load = useCallback(() => {
    getAIUsage().then((d) => { setU(d); setFailed(false); }).catch(() => setFailed(true));
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    window.addEventListener("teamflow:ai-used", load);
    return () => {
      clearInterval(t);
      window.removeEventListener("teamflow:ai-used", load);
    };
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const close = (e) => !ref.current?.contains(e.target) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  if (failed && !u) return null; // edge function not deployed yet: stay out of the way

  const models = (u?.models || []).filter((m) => m.enabled);
  const used = models.reduce((s, m) => s + m.usedToday, 0);
  const known = models.filter((m) => m.capacity);
  const capacity = known.reduce((s, m) => s + m.capacity, 0);
  const pct = capacity ? Math.min(100, Math.round((used / capacity) * 100)) : 0;
  const resetIn = u ? fmtMinutes((new Date(u.resetAt) - Date.now()) / 60000) : "";
  const notSetUp = u && !u.activeKeys;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="glass flex items-center gap-2.5 rounded-xl px-3 py-1.5 text-xs transition hover:bg-white/10"
        aria-expanded={open}
        title="Gemini AI free-tier usage today"
      >
        <Sparkles className="h-3.5 w-3.5 text-fuchsia-300" />
        {!u ? (
          <span className="text-slate-400">AI…</span>
        ) : notSetUp ? (
          <span className="text-slate-400">AI not set up</span>
        ) : (
          <>
            <span className="text-slate-300">
              AI <span className="font-semibold text-white">{used}</span>
              {capacity ? <span className="text-slate-500"> / {capacity}</span> : null}
            </span>
            {capacity > 0 && (
              <span className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-white/10 sm:block">
                <span className={`block h-full rounded-full ${tone(pct)}`} style={{ width: `${pct}%` }} />
              </span>
            )}
          </>
        )}
        <ChevronDown className={`h-3 w-3 text-slate-500 transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open && u && (
        <div className="glass-strong fade-in absolute right-0 z-40 mt-2 w-80 space-y-3 p-4 text-xs">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-white">Gemini free tier · today</p>
            <p className="text-slate-400">resets in {resetIn}</p>
          </div>

          {notSetUp && <p className="text-slate-400">No API key yet. The admin can add one in /admin → AI.</p>}

          {models.map((m, i) => {
            const p = m.capacity ? Math.min(100, Math.round((m.usedToday / m.capacity) * 100)) : 0;
            const paused = m.keysPaused > 0 && m.keysPaused >= u.activeKeys;
            return (
              <div key={m.model} className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${paused ? "bg-rose-400" : m.lastError && !m.lastOkAt ? "bg-amber-400" : "bg-emerald-400"}`} />
                    <span className="truncate font-mono text-slate-200">{m.model}</span>
                    {i === 0 && <span className="rounded bg-violet-500/20 px-1 text-[9px] text-violet-200">main</span>}
                  </span>
                  <span className="shrink-0 text-slate-400">
                    {m.usedToday}{m.capacity ? ` / ${m.capacity}` : ""}
                  </span>
                </div>
                {m.capacity ? (
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div className={`h-full rounded-full ${paused ? "bg-rose-400" : tone(p)}`} style={{ width: `${paused ? 100 : p}%` }} />
                  </div>
                ) : null}
                <p className="text-[10px] text-slate-500">
                  {paused ? "Limit reached — using the next model" : `${m.lastMinute}${m.rpm ? `/${m.rpm}` : ""} this minute`}
                  {m.avgLatencyMs ? ` · ~${(m.avgLatencyMs / 1000).toFixed(1)}s` : ""}
                  {m.tokensToday ? ` · ${m.tokensToday.toLocaleString()} tokens` : ""}
                </p>
              </div>
            );
          })}

          <div className="space-y-1 border-t border-white/10 pt-3 text-[10px] text-slate-500">
            <p>
              {u.activeKeys} active key{u.activeKeys === 1 ? "" : "s"}. If a model hits its limit, TeamFlow switches to the next model or key automatically.
              Limits shown are the admin&apos;s configured estimates.
            </p>
            <a href="https://aistudio.google.com/rate-limit" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-violet-300 hover:underline">
              Exact limits in Google AI Studio <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
