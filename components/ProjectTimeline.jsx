"use client";
import { useMemo } from "react";
import { deliveryInfo, fmtDays } from "@/lib/projects";

const DAY = 864e5;
const fmt = (d) => d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

// Gantt-style timeline: one bar per project from start to delivery (or today).
// `from`/`to` optionally fix the visible range (e.g. a report period).
export default function ProjectTimeline({ projects, from, to, onOpen }) {
  const now = new Date();

  const range = useMemo(() => {
    if (!projects.length) return null;
    let min = from || new Date(Math.min(...projects.map((p) => p.start)));
    let max = to || new Date(Math.max(...projects.map((p) => Math.max(p.delivered || now, p.due || 0))));
    // snap to whole months so the month grid lines up
    min = new Date(min.getFullYear(), min.getMonth(), 1);
    max = new Date(max.getFullYear(), max.getMonth() + 1, 1);
    const months = [];
    for (let d = new Date(min); d < max; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) months.push(d);
    return { min, max, span: max - min, months };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects, from, to]);

  if (!range) return <p className="p-8 text-center text-sm text-slate-500">No projects in this range.</p>;

  const pct = (d) => Math.min(100, Math.max(0, ((d - range.min) / range.span) * 100));
  const step = range.months.length > 18 ? 3 : range.months.length > 9 ? 2 : 1;
  const todayPct = now >= range.min && now <= range.max ? pct(now) : null;

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[760px]">
        {/* month header */}
        <div className="flex border-b border-white/10 text-[10px] uppercase tracking-wide text-slate-500">
          <div className="w-60 shrink-0 px-4 py-2">Project</div>
          <div className="relative h-8 flex-1">
            {range.months.map((m, i) =>
              i % step === 0 ? (
                <span key={+m} className="absolute top-2 -translate-x-0 whitespace-nowrap pl-1" style={{ left: `${pct(m)}%` }}>
                  {m.toLocaleDateString(undefined, { month: "short", ...(m.getMonth() === 0 || i === 0 ? { year: "2-digit" } : {}) })}
                </span>
              ) : null
            )}
          </div>
        </div>

        <div className="relative">
          {/* month grid lines + today */}
          <div className="pointer-events-none absolute inset-y-0 left-60 right-0">
            {range.months.map((m) => (
              <span key={+m} className="absolute inset-y-0 w-px bg-white/5" style={{ left: `${pct(m)}%` }} />
            ))}
            {todayPct !== null && (
              <span className="absolute inset-y-0 w-px bg-fuchsia-400/60" style={{ left: `${todayPct}%` }} title="Today" />
            )}
          </div>

          {projects.map((p) => {
            const info = deliveryInfo(p);
            const end = p.delivered || now;
            const left = pct(p.start);
            const width = Math.max(0.8, pct(new Date(Math.max(end, +p.start + DAY))) - left);
            const tip = `${p.name}\n${fmt(p.start)} → ${p.delivered ? fmt(p.delivered) : "ongoing"} (${fmtDays(p.durationDays)})\n${info.label}${p.due ? ` · deadline ${fmt(p.due)}` : ""}\n${p.done}/${p.total} tasks done`;
            return (
              <div key={p.name} className="group flex items-center border-b border-white/5 last:border-0 hover:bg-white/[0.03]">
                <button onClick={() => onOpen?.(p)} className="w-60 shrink-0 truncate px-4 py-2.5 text-left text-xs text-slate-200 hover:text-white" title={p.name}>
                  {p.name}
                  <span className="block text-[10px] text-slate-500">{fmtDays(p.durationDays)} · {p.done}/{p.total} done</span>
                </button>
                <div className="relative h-10 flex-1">
                  <button
                    onClick={() => onOpen?.(p)}
                    title={tip}
                    className="absolute top-1/2 h-4 -translate-y-1/2 rounded-full shadow-lg transition group-hover:h-5 group-hover:brightness-125"
                    style={{
                      left: `${left}%`,
                      width: `${width}%`,
                      background: p.status === "active" ? `repeating-linear-gradient(135deg, ${info.hex}, ${info.hex} 6px, ${info.hex}bb 6px, ${info.hex}bb 12px)` : info.hex,
                    }}
                    aria-label={tip}
                  />
                  {p.due && (
                    <span className="absolute top-1/2 h-6 w-0.5 -translate-y-1/2 rounded bg-white/70" style={{ left: `${pct(p.due)}%` }} title={`Deadline ${fmt(p.due)}`} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap gap-4 border-t border-white/10 px-4 py-3 text-[11px] text-slate-400">
        <span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded-full bg-emerald-400" />Delivered</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded-full bg-amber-400" />Delivered late</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded-full bg-violet-400" />In progress</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded-full bg-rose-400" />Overdue</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-0.5 bg-white/70" />Deadline</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-px bg-fuchsia-400" />Today</span>
      </div>
    </div>
  );
}
