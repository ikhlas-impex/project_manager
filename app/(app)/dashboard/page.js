"use client";
import { useMemo } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, CheckCircle2, ClipboardList, Hourglass, PartyPopper, Timer } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { useData } from "@/components/DataProvider";
import TaskCard from "@/components/TaskCard";
import { Avatar, EmptyState, PageHeader, StatCard } from "@/components/ui";
import { dayKey, fmtDateTime, fmtLongDate, isOverdue, nameOf, profileName, PRIORITY } from "@/lib/format";

const byUrgency = (a, b) =>
  (a.due_at ? new Date(a.due_at) : Infinity) - (b.due_at ? new Date(b.due_at) : Infinity) ||
  PRIORITY[b.priority].rank - PRIORITY[a.priority].rank;

export default function Dashboard() {
  const { profile: me } = useAuth();
  const { tasks, activity, profiles, openTask } = useData();

  const d = useMemo(() => {
    const today = dayKey(new Date());
    const mine = tasks.filter((t) => t.assigned_to === me.id);
    const open = mine.filter((t) => t.status !== "done").sort(byUrgency);
    return {
      open,
      overdue: open.filter(isOverdue),
      doneToday: mine.filter((t) => t.completed_at && dayKey(t.completed_at) === today),
      waitingOnMe: tasks.filter((t) => t.status === "waiting" && t.waiting_on === me.id),
      iAmWaiting: mine.filter((t) => t.status === "waiting"),
      assignedByMe: tasks.filter((t) => t.created_by === me.id && t.assigned_to !== me.id && t.status !== "done").sort(byUrgency),
      recent: activity.slice(0, 8),
    };
  }, [tasks, activity, me.id]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <>
      <PageHeader title={`${greeting}, ${profileName(me).split(" ")[0]} 👋`} subtitle={fmtLongDate(new Date())}>
        <Link href="/summary" className="btn-ghost">Today&apos;s summary <ArrowRight className="h-4 w-4" /></Link>
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={ClipboardList} label="My open tasks" value={d.open.length} tone="from-violet-500/40 to-indigo-500/10" />
        <StatCard icon={CheckCircle2} label="Done today" value={d.doneToday.length} tone="from-emerald-500/40 to-teal-500/10" />
        <StatCard icon={Hourglass} label="Waiting on me" value={d.waitingOnMe.length} tone="from-amber-500/40 to-orange-500/10" hint={d.iAmWaiting.length ? `I'm waiting on ${d.iAmWaiting.length}` : null} />
        <StatCard icon={AlertTriangle} label="Overdue" value={d.overdue.length} tone="from-rose-500/40 to-pink-500/10" />
      </div>

      {d.waitingOnMe.length > 0 && (
        <section className="mt-6 rounded-2xl border border-amber-400/25 bg-amber-400/[0.06] p-4 backdrop-blur-xl">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-amber-200">
            <Timer className="h-4 w-4" /> Someone is waiting on you
          </h2>
          <div className="grid gap-3 md:grid-cols-2">
            {d.waitingOnMe.map((t) => <TaskCard key={t.id} task={t} />)}
          </div>
        </section>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="section-title">My focus list</h2>
            <Link href="/tasks" className="text-xs text-violet-300 hover:underline">View all</Link>
          </div>
          {d.open.length ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {d.open.slice(0, 8).map((t) => <TaskCard key={t.id} task={t} showStatus />)}
            </div>
          ) : (
            <div className="glass"><EmptyState icon={PartyPopper} title="All clear!" text="You have no open tasks. Create one or ask your manager for the next priority." /></div>
          )}

          {d.assignedByMe.length > 0 && (
            <>
              <h2 className="section-title mb-3 mt-8">Assigned by me</h2>
              <div className="glass divide-y divide-white/5">
                {d.assignedByMe.map((t) => (
                  <button key={t.id} onClick={() => openTask(t)} className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-white/5">
                    <Avatar profile={profiles.find((p) => p.id === t.assigned_to)} size={26} />
                    <span className="min-w-0 flex-1 truncate text-sm">{t.title}</span>
                    <span className={`text-xs ${isOverdue(t) ? "text-rose-300" : "text-slate-400"}`}>{t.due_at ? fmtDateTime(t.due_at) : "No deadline"}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </section>

        <section>
          <h2 className="section-title mb-3">Team activity</h2>
          <div className="glass p-4">
            {d.recent.length ? (
              <ol className="space-y-4">
                {d.recent.map((a) => {
                  const t = tasks.find((x) => x.id === a.task_id);
                  return (
                    <li key={a.id} className="flex gap-3">
                      <Avatar profile={profiles.find((p) => p.id === a.user_id)} size={28} />
                      <div className="min-w-0 text-xs">
                        <p className="text-slate-300">
                          <span className="font-semibold text-white">{nameOf(profiles, a.user_id)}</span> · {a.message}
                        </p>
                        {t && <button onClick={() => openTask(t)} className="truncate text-violet-300 hover:underline">{t.title}</button>}
                        <p className="text-[10px] text-slate-500">{fmtDateTime(a.created_at)}</p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className="text-sm text-slate-500">No activity yet.</p>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
