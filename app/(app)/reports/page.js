"use client";
import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Clock, Download, FolderKanban, Hourglass, PlusCircle, Send, Sparkles, Target } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { useData } from "@/components/DataProvider";
import { useToast } from "@/components/Toast";
import { CopyButton, PageHeader, RichText, Segmented, Spinner, StatCard } from "@/components/ui";
import { computeReport, periodRange, toCSV } from "@/lib/reports";
import { deliveryInfo, fmtDays } from "@/lib/projects";
import ProjectTimeline from "@/components/ProjectTimeline";

const fmtShort = (d) => new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
import { askAI, sendEmail } from "@/lib/api";
import { PRIORITY, PRIORITY_ORDER, STATUS, STATUS_ORDER, fmtMinutes, fromDayKey, nameOf, profileName, waitingName } from "@/lib/format";

export default function ReportsPage() {
  const { profile: me } = useAuth();
  const { tasks, activity, profiles, team, myDepartment, integrations, openTask } = useData();
  const toast = useToast();
  const isManager = me.role === "manager";
  const [kind, setKind] = useState("week");
  const [offset, setOffset] = useState(0);
  const [who, setWho] = useState(isManager ? "" : me.id); // employees: always their own report
  const [ai, setAi] = useState("");
  const [busy, setBusy] = useState(false);
  const [mailTo, setMailTo] = useState("");

  const earliest = useMemo(
    () => tasks.reduce((min, t) => Math.min(min, new Date(t.start_at || t.created_at).getTime()), Date.now()),
    [tasks]
  );
  const { start, end, label } = periodRange(kind, offset, earliest);
  const r = useMemo(
    () => computeReport({ tasks, activity, profiles, members: team, start, end, userId: who || null }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tasks, activity, profiles, kind, offset, who, earliest]
  );
  const days = Object.entries(r.perDay);
  // chart keys are YYYY-MM-DD (days) or YYYY-MM (months)
  const keyLabel = (k, long) =>
    r.bucket === "month"
      ? fromDayKey(`${k}-01`).toLocaleDateString(undefined, { month: "short", year: "2-digit" })
      : fromDayKey(k).toLocaleDateString(undefined, long ? { weekday: "short", day: "numeric", month: "short" } : { day: "numeric", month: "short" });
  const delivered = r.projects.filter((p) => p.deliveredInPeriod);
  const openProject = (p) => openTask([...p.tasks].sort((a, b) => new Date(b.completed_at || b.created_at) - new Date(a.completed_at || a.created_at))[0]);
  const maxDay = Math.max(1, ...days.map(([, v]) => Math.max(v.completed, v.created)));
  const scopeName = who ? nameOf(profiles, who) : myDepartment?.name || "Team";

  const reset = (fn) => (v) => { fn(v); setAi(""); };

  async function analyse() {
    setBusy(true);
    try {
      const stats = {
        scope: scopeName, created: r.created, completed: r.completed, completionRatePct: r.completionRate,
        onTimePct: r.onTimeRate, overdueOpen: r.overdue, avgCompletionHours: +r.avgHours.toFixed(1),
        totalWaitingHours: +(r.waitMins / 60).toFixed(1), byPriority: r.byPriority, byStatus: r.byStatus, people: r.people,
        projects: r.projects.map((p) => ({
          name: p.name, started: p.start.toISOString().slice(0, 10), delivered: p.delivered?.toISOString().slice(0, 10) || null,
          durationDays: p.durationDays, delivery: deliveryInfo(p).label, tasksDone: `${p.done}/${p.total}`,
        })),
      };
      const slim = r.activeTasks.slice(0, 80).map((t) => ({
        title: t.title, status: t.status, priority: t.priority, assignee: nameOf(profiles, t.assigned_to),
        due: t.due_at, completed: t.completed_at, waitingMinutes: t.waiting_total_minutes,
        waitingOn: t.status === "waiting" ? waitingName(profiles, t) : undefined, waitingReason: t.waiting_reason || undefined,
      }));
      setAi(await askAI("report", { period: { week: "the week", month: "the month", year: "the year" }[kind] ? `${{ week: "the week", month: "the month", year: "the year" }[kind]} ${label}` : label, stats, tasks: slim }));
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setBusy(false);
    }
  }

  const reportText = () =>
    [
      `📊 ${scopeName} report — ${label}`,
      `Created: ${r.created} · Completed: ${r.completed} · Completion: ${r.completionRate}%`,
      `On-time: ${r.onTimeRate ?? "—"}% · Overdue: ${r.overdue} · Avg time to complete: ${r.avgHours.toFixed(1)}h · Waiting: ${fmtMinutes(r.waitMins)}`,
      "",
      ...r.people.map((p) => `• ${p.name}: ${p.completed} done, ${p.open} open, ${p.waiting} waiting, ${p.overdue} overdue`),
      "",
      "Projects:",
      ...r.projects.map(
        (p) => `🔹 ${p.name}: ${fmtShort(p.start)} → ${p.delivered ? fmtShort(p.delivered) : "ongoing"} (${fmtDays(p.durationDays)}) · ${deliveryInfo(p).label}`
      ),
      "",
      "Completed tasks:",
      ...r.completedTasks.map((t) => `✓ ${t.title} (${nameOf(profiles, t.assigned_to)})`),
      ai ? `\n— AI analysis —\n${ai}` : "",
    ].join("\n");

  function download() {
    const blob = new Blob([toCSV(r.activeTasks, profiles)], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `teamflow-${kind}-${start.toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function email() {
    try {
      await sendEmail({ to: mailTo, subject: `TeamFlow ${kind}ly report — ${label}`, text: reportText() });
      toast("Report emailed");
    } catch (err) {
      toast(err.message, "error");
    }
  }

  return (
    <>
      <PageHeader title="Reports" subtitle="Performance and project delivery by week, month, year or all time, with AI analysis.">
        <div className="w-80 max-w-full">
          <Segmented
            value={kind}
            onChange={(v) => { setKind(v); setOffset(0); setAi(""); }}
            options={[{ value: "week", label: "Weekly" }, { value: "month", label: "Monthly" }, { value: "year", label: "Yearly" }, { value: "all", label: "All time" }]}
          />
        </div>
        <div className="glass flex items-center gap-1 rounded-xl p-1">
          <button onClick={() => reset(setOffset)(offset - 1)} disabled={kind === "all"} className="rounded-lg p-2 hover:bg-white/10 disabled:opacity-30" aria-label="Previous period"><ChevronLeft className="h-4 w-4" /></button>
          <span className="min-w-40 text-center text-sm font-semibold">{label}</span>
          <button onClick={() => reset(setOffset)(offset + 1)} disabled={offset >= 0 || kind === "all"} className="rounded-lg p-2 hover:bg-white/10 disabled:opacity-30" aria-label="Next period"><ChevronRight className="h-4 w-4" /></button>
        </div>
        {isManager && (
          <select className="input w-auto" value={who} onChange={(e) => reset(setWho)(e.target.value)} aria-label="Report scope">
            <option value="">Whole department</option>
            {team.map((p) => <option key={p.id} value={p.id}>{profileName(p)}</option>)}
          </select>
        )}
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={CheckCircle2} label="Completed" value={r.completed} hint={`${r.completionRate}% of active work`} tone="from-emerald-500/40 to-teal-500/10" />
        <StatCard icon={PlusCircle} label="Created" value={r.created} tone="from-sky-500/40 to-cyan-500/10" />
        <StatCard icon={Target} label="On time" value={r.onTimeRate == null ? "—" : `${r.onTimeRate}%`} hint={`${r.overdue} overdue open`} tone="from-violet-500/40 to-indigo-500/10" />
        <StatCard icon={Hourglass} label="Waiting time" value={fmtMinutes(r.waitMins)} hint={`Avg ${r.avgHours.toFixed(1)}h to complete`} tone="from-amber-500/40 to-orange-500/10" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <section className="glass p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="section-title">{r.bucket === "month" ? "Monthly" : "Daily"} throughput</h2>
            <div className="flex gap-3 text-xs text-slate-400">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-emerald-400" />Completed</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-sky-400/60" />Created</span>
            </div>
          </div>
          <div className="flex h-48 items-end gap-1">
            {days.map(([k, v]) => (
              <div key={k} className="group relative flex h-full flex-1 flex-col justify-end">
                <div className="flex h-full items-end justify-center gap-[2px]">
                  <div className="w-full max-w-4 rounded-t bg-gradient-to-t from-emerald-500 to-emerald-300 transition-all" style={{ height: `${(v.completed / maxDay) * 100}%` }} />
                  <div className="w-full max-w-4 rounded-t bg-sky-400/50 transition-all" style={{ height: `${(v.created / maxDay) * 100}%` }} />
                </div>
                <span className="pointer-events-none absolute -top-8 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-black/80 px-2 py-1 text-[10px] group-hover:block">
                  {keyLabel(k, true)}: {v.completed} done · {v.created} new
                </span>
              </div>
            ))}
          </div>
          <div className="mt-2 flex justify-between text-[10px] text-slate-500">
            <span>{keyLabel(days[0][0])}</span>
            <span>{keyLabel(days[days.length - 1][0])}</span>
          </div>
        </section>

        <section className="glass space-y-5 p-5">
          <div>
            <h2 className="section-title mb-3">Current status mix</h2>
            <Bars items={STATUS_ORDER.map((s) => ({ label: STATUS[s].label, value: r.byStatus[s], color: STATUS[s].hex }))} />
          </div>
          <div>
            <h2 className="section-title mb-3">Completed by priority</h2>
            <Bars items={PRIORITY_ORDER.map((p) => ({ label: PRIORITY[p].label, value: r.byPriority[p], color: { low: "#94a3b8", medium: "#38bdf8", high: "#fb923c", urgent: "#fb7185" }[p] }))} />
          </div>
        </section>
      </div>

      {/* ---------- Projects: timeline + delivery per project ---------- */}
      <section className="glass mt-6 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 p-4">
          <h2 className="section-title flex items-center gap-2"><FolderKanban className="h-4 w-4 text-violet-300" /> Projects in this period</h2>
          <p className="text-xs text-slate-400">
            {r.projects.length} project{r.projects.length === 1 ? "" : "s"} · {delivered.length} delivered in period
          </p>
        </div>
        {r.projects.length ? (
          <>
            <ProjectTimeline projects={r.projects} from={kind === "all" ? undefined : start} to={kind === "all" ? undefined : new Date(end - 1)} onOpen={openProject} />
            <div className="overflow-x-auto border-t border-white/10">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wide text-slate-400">
                    <th className="px-4 py-3 font-medium">Project</th>
                    <th className="px-4 py-3 font-medium">Tasks</th>
                    <th className="px-4 py-3 font-medium">Started</th>
                    <th className="px-4 py-3 font-medium">Delivered</th>
                    <th className="px-4 py-3 font-medium">Time taken</th>
                    <th className="px-4 py-3 font-medium">Delivery</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {r.projects.map((p) => {
                    const info = deliveryInfo(p);
                    return (
                      <tr key={p.name} onClick={() => openProject(p)} className="cursor-pointer transition hover:bg-white/5">
                        <td className="max-w-xs px-4 py-3">
                          <span className="block truncate font-medium text-slate-100" title={p.name}>{p.name}</span>
                          <span className="block text-[11px] text-slate-500">{p.assignees.map((id) => nameOf(profiles, id)).join(", ")}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-slate-200">{p.done}/{p.total}</span>
                          <span className="mt-1 block h-1 w-16 overflow-hidden rounded-full bg-white/10">
                            <span className="block h-full rounded-full bg-emerald-400" style={{ width: `${(p.done / p.total) * 100}%` }} />
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-300">{fmtShort(p.start)}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-300">
                          {p.delivered ? fmtShort(p.delivered) : <span className="text-slate-500">—</span>}
                          {p.due && <span className="block text-[10px] text-slate-500">deadline {fmtShort(p.due)}</span>}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-300">{fmtDays(p.durationDays)}</td>
                        <td className="px-4 py-3"><span className={`chip ${info.chip}`}>{info.label}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p className="p-8 text-center text-sm text-slate-500">No project work in this period.</p>
        )}
      </section>

      <section className="glass mt-6 overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wide text-slate-400">
              <th className="px-4 py-3 font-medium">Person</th>
              <th className="px-4 py-3 font-medium">Completed</th>
              <th className="px-4 py-3 font-medium">Open</th>
              <th className="px-4 py-3 font-medium">Waiting</th>
              <th className="px-4 py-3 font-medium">Overdue</th>
              <th className="px-4 py-3 font-medium">Updates logged</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {r.people.map((p) => (
              <tr key={p.id}>
                <td className="px-4 py-3 font-medium">{p.name}</td>
                <td className="px-4 py-3 text-emerald-300">{p.completed}</td>
                <td className="px-4 py-3">{p.open}</td>
                <td className="px-4 py-3 text-amber-300">{p.waiting}</td>
                <td className={`px-4 py-3 ${p.overdue ? "text-rose-300" : ""}`}>{p.overdue}</td>
                <td className="px-4 py-3">{p.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="glass mt-6 p-5">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <h2 className="section-title mr-auto flex items-center gap-2"><Sparkles className="h-4 w-4 text-fuchsia-300" /> AI analysis</h2>
          <button onClick={download} className="btn-ghost btn-sm"><Download className="h-3.5 w-3.5" /> CSV</button>
          <CopyButton text={reportText()} label="Copy report" className="btn-ghost btn-sm" />
          {integrations.ai && (
            <button onClick={analyse} disabled={busy} className="btn-primary btn-sm">
              {busy ? <Spinner className="h-3.5 w-3.5 text-white" /> : <Sparkles className="h-3.5 w-3.5" />} {ai ? "Regenerate" : "Analyse with Gemini"}
            </button>
          )}
        </div>
        {ai ? (
          <RichText text={ai} />
        ) : (
          <p className="text-sm text-slate-400">
            {integrations.ai
              ? "Generate an AI-written report with wins, bottlenecks, waiting-time analysis and recommendations."
              : "Add GEMINI_API_KEY to the server environment to enable AI analysis."}
          </p>
        )}
        {integrations.email && (
          <div className="mt-5 flex flex-col gap-2 border-t border-white/10 pt-4 sm:flex-row">
            <input className="input" type="email" multiple value={mailTo} onChange={(e) => setMailTo(e.target.value)} placeholder="Send report to… (comma separated)" aria-label="Recipient email" />
            <button onClick={email} disabled={!mailTo} className="btn-ghost"><Send className="h-4 w-4" /> Email report</button>
          </div>
        )}
      </section>

      {r.overdue > 0 && (
        <p className="mt-4 flex items-center gap-2 text-xs text-rose-300"><AlertTriangle className="h-3.5 w-3.5" /> {r.overdue} open task(s) are past their deadline.</p>
      )}
      <p className="mt-2 flex items-center gap-2 text-xs text-slate-500"><Clock className="h-3.5 w-3.5" /> Waiting time is tracked automatically while a task is in the Waiting column.</p>
    </>
  );
}

function Bars({ items }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="space-y-2.5">
      {items.map((i) => (
        <div key={i.label} className="flex items-center gap-3 text-xs">
          <span className="w-20 text-slate-400">{i.label}</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/5">
            <div className="h-full rounded-full transition-all" style={{ width: `${(i.value / max) * 100}%`, background: i.color }} />
          </div>
          <span className="w-6 text-right font-semibold text-slate-200">{i.value}</span>
        </div>
      ))}
    </div>
  );
}
