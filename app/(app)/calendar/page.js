"use client";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { useData } from "@/components/DataProvider";
import { PageHeader, Segmented } from "@/components/ui";
import ProjectTimeline from "@/components/ProjectTimeline";
import { STATUS, dayKey, fmtTime, isOverdue } from "@/lib/format";
import { summarizeProjects } from "@/lib/projects";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function CalendarPage() {
  const { profile: me } = useAuth();
  const { tasks, openTask, newTask } = useData();
  const [cursor, setCursor] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [onlyMine, setOnlyMine] = useState(false);
  const [view, setView] = useState("month");

  const days = useMemo(() => {
    const first = new Date(cursor);
    first.setDate(1 - ((first.getDay() + 6) % 7)); // back to Monday
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(first);
      d.setDate(first.getDate() + i);
      return d;
    });
  }, [cursor]);

  const visible = useMemo(() => tasks.filter((t) => !onlyMine || t.assigned_to === me.id), [tasks, onlyMine, me.id]);

  // Each day shows deadlines and deliveries (tasks completed that day)
  const byDay = useMemo(() => {
    const map = {};
    const put = (d, t, kind) => (map[dayKey(d)] ||= []).push({ t, kind, at: new Date(d) });
    for (const t of visible) {
      if (t.due_at) put(t.due_at, t, "due");
      if (t.status === "done" && t.completed_at && (!t.due_at || dayKey(t.due_at) !== dayKey(t.completed_at))) put(t.completed_at, t, "delivered");
    }
    Object.values(map).forEach((l) => l.sort((a, b) => a.at - b.at));
    return map;
  }, [visible]);

  const projects = useMemo(() => summarizeProjects(visible), [visible]);
  const openProject = (p) => openTask([...p.tasks].sort((a, b) => new Date(b.completed_at || b.created_at) - new Date(a.completed_at || a.created_at))[0]);

  const shift = (n) => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + n, 1));
  const today = dayKey(new Date());

  function addOn(d) {
    const due = new Date(d);
    due.setHours(17, 0, 0, 0);
    newTask({ due_at: due });
  }

  return (
    <>
      <PageHeader
        title="Calendar"
        subtitle={view === "month" ? "Deadlines and deliveries by day. Click + on a day to add a task due that day." : "Every project from start to delivery."}
      >
        <div className="w-48">
          <Segmented value={view} onChange={setView} options={[{ value: "month", label: "Month" }, { value: "timeline", label: "Timeline" }]} />
        </div>
        {me.role === "manager" && (
          <label className="btn-ghost cursor-pointer">
            <input type="checkbox" className="accent-violet-500" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} />
            Only mine
          </label>
        )}
        {view === "month" && (
          <>
            <div className="glass flex items-center gap-1 rounded-xl p-1">
              <button onClick={() => shift(-1)} className="rounded-lg p-2 hover:bg-white/10" aria-label="Previous month"><ChevronLeft className="h-4 w-4" /></button>
              <span className="min-w-36 text-center text-sm font-semibold">
                {cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
              </span>
              <button onClick={() => shift(1)} className="rounded-lg p-2 hover:bg-white/10" aria-label="Next month"><ChevronRight className="h-4 w-4" /></button>
            </div>
            <button onClick={() => setCursor(new Date(new Date().getFullYear(), new Date().getMonth(), 1))} className="btn-ghost">Today</button>
          </>
        )}
      </PageHeader>

      {view === "timeline" ? (
        <div className="glass overflow-hidden">
          <ProjectTimeline projects={projects} onOpen={openProject} />
        </div>
      ) : (
      <>
      <div className="glass overflow-hidden">
        <div className="grid grid-cols-7 border-b border-white/10 text-center text-xs font-medium uppercase tracking-wide text-slate-400">
          {WEEKDAYS.map((w) => <div key={w} className="py-2.5">{w}</div>)}
        </div>
        <div className="grid grid-cols-7">
          {days.map((d) => {
            const k = dayKey(d);
            const list = byDay[k] || [];
            const inMonth = d.getMonth() === cursor.getMonth();
            return (
              <div
                key={k}
                className={`group relative min-h-[92px] border-b border-r border-white/5 p-1.5 sm:min-h-[120px] ${inMonth ? "" : "bg-black/20 opacity-50"}`}
              >
                <div className="mb-1 flex items-center justify-between">
                  <span className={`grid h-6 w-6 place-items-center rounded-full text-xs ${k === today ? "bg-gradient-to-br from-violet-500 to-indigo-500 font-bold text-white" : "text-slate-400"}`}>
                    {d.getDate()}
                  </span>
                  <button onClick={() => addOn(d)} className="rounded-md p-0.5 text-slate-500 opacity-0 transition hover:bg-white/10 hover:text-white group-hover:opacity-100" aria-label={`Add task on ${k}`}>
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="space-y-1">
                  {list.slice(0, 3).map(({ t, kind, at }) => (
                    <button
                      key={`${t.id}-${kind}`}
                      onClick={() => openTask(t)}
                      className={`block w-full truncate rounded-md px-1.5 py-0.5 text-left text-[11px] transition hover:brightness-125 ${kind === "due" && isOverdue(t) ? "ring-1 ring-rose-400/60" : ""}`}
                      style={{ background: `${STATUS[t.status].hex}22`, color: STATUS[t.status].hex }}
                      title={`${kind === "delivered" ? "Delivered" : "Due"} ${fmtTime(at)} · ${t.project ? `${t.project} – ` : ""}${t.title}`}
                    >
                      {kind === "delivered" ? "✅ " : <span className="hidden sm:inline">{fmtTime(at)} · </span>}
                      {t.project || t.title}
                    </button>
                  ))}
                  {list.length > 3 && <p className="px-1 text-[10px] text-slate-400">+{list.length - 3} more</p>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-400">
        {Object.entries(STATUS).map(([k, s]) => (
          <span key={k} className="flex items-center gap-1.5"><span className={`h-2 w-2 rounded-full ${s.dot}`} />{s.label}</span>
        ))}
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full ring-1 ring-rose-400" />Overdue</span>
        <span className="flex items-center gap-1.5">✅ Delivered that day</span>
      </div>
      </>
      )}
    </>
  );
}
