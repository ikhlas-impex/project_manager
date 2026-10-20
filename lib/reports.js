import { dayKey, waitingMinutes, nameOf, PRIORITY_ORDER, STATUS_ORDER } from "./format";
import { summarizeProjects } from "./projects";

// earliest: first date in the data, used by "all"
export function periodRange(kind, offset = 0, earliest) {
  const now = new Date();
  let start, end;
  if (kind === "all") {
    const first = earliest ? new Date(earliest) : new Date(now.getFullYear(), 0, 1);
    start = new Date(first.getFullYear(), first.getMonth(), 1);
    end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    return { start, end, label: `All time (since ${start.toLocaleDateString(undefined, { month: "short", year: "numeric" })})` };
  }
  if (kind === "year") {
    start = new Date(now.getFullYear() + offset, 0, 1);
    end = new Date(now.getFullYear() + offset + 1, 0, 1);
    return { start, end, label: String(start.getFullYear()) };
  }
  if (kind === "week") {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dow = (start.getDay() + 6) % 7; // Monday = 0
    start.setDate(start.getDate() - dow + offset * 7);
    end = new Date(start);
    end.setDate(end.getDate() + 7);
  } else {
    start = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    end = new Date(now.getFullYear(), now.getMonth() + offset + 1, 1);
  }
  const last = new Date(end.getTime() - 1);
  const opts = { day: "numeric", month: "short" };
  const label =
    kind === "week"
      ? `${start.toLocaleDateString(undefined, opts)} – ${last.toLocaleDateString(undefined, { ...opts, year: "numeric" })}`
      : start.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  return { start, end, label };
}

const within = (d, start, end) => d && new Date(d) >= start && new Date(d) < end;

// members: people to list per-person (defaults to everyone in profiles)
export function computeReport({ tasks, activity, profiles, members, start, end, userId }) {
  const mine = (t) => !userId || t.assigned_to === userId;
  const scoped = tasks.filter(mine);

  const created = scoped.filter((t) => within(t.created_at, start, end));
  const completed = scoped.filter((t) => t.status === "done" && within(t.completed_at, start, end));
  const withDue = completed.filter((t) => t.due_at);
  const onTime = withDue.filter((t) => new Date(t.completed_at) <= new Date(t.due_at));
  const now = new Date();
  const overdueOpen = scoped.filter(
    (t) => t.status !== "done" && t.due_at && new Date(t.due_at) < Math.min(now, end)
  );
  const active = scoped.filter(
    (t) => within(t.created_at, start, end) || within(t.completed_at, start, end) || (t.status !== "done" && new Date(t.created_at) < end)
  );

  const cycle = completed
    .filter((t) => t.start_at)
    .map((t) => (new Date(t.completed_at) - new Date(t.start_at)) / 3600e3);
  const avgHours = cycle.length ? cycle.reduce((a, b) => a + b, 0) / cycle.length : 0;
  const waitMins = active.reduce((sum, t) => sum + waitingMinutes(t), 0);

  // Completed/created per day for the chart (per month for long periods)
  const bucket = (end - start) / 864e5 > 62 ? "month" : "day";
  const keyOf = (d) => (bucket === "month" ? dayKey(d).slice(0, 7) : dayKey(d));
  const keys = [];
  for (let d = new Date(start); d < end; bucket === "month" ? d.setMonth(d.getMonth() + 1, 1) : d.setDate(d.getDate() + 1)) keys.push(keyOf(d));
  const perDay = Object.fromEntries(keys.map((k) => [k, { completed: 0, created: 0 }]));
  for (const t of completed) perDay[keyOf(t.completed_at)] && perDay[keyOf(t.completed_at)].completed++;
  for (const t of created) perDay[keyOf(t.created_at)] && perDay[keyOf(t.created_at)].created++;

  // Projects worked on in this period (started before the end, not finished before the start)
  const projects = summarizeProjects(
    scoped.filter((t) => new Date(t.start_at || t.created_at) < end && (t.status !== "done" || new Date(t.completed_at) >= start))
  ).map((p) => ({ ...p, deliveredInPeriod: Boolean(p.delivered && p.delivered >= start && p.delivered < end) }));

  const byPriority = Object.fromEntries(PRIORITY_ORDER.map((p) => [p, completed.filter((t) => t.priority === p).length]));
  const byStatus = Object.fromEntries(STATUS_ORDER.map((s) => [s, active.filter((t) => t.status === s).length]));

  const people = (members || profiles)
    .filter((p) => !userId || p.id === userId)
    .map((p) => {
      const assigned = tasks.filter((t) => t.assigned_to === p.id);
      const done = assigned.filter((t) => t.status === "done" && within(t.completed_at, start, end));
      return {
        id: p.id,
        name: nameOf(profiles, p.id),
        completed: done.length,
        open: assigned.filter((t) => t.status !== "done").length,
        waiting: assigned.filter((t) => t.status === "waiting").length,
        overdue: assigned.filter((t) => t.status !== "done" && t.due_at && new Date(t.due_at) < now).length,
        notes: activity.filter((a) => a.user_id === p.id && a.kind === "note" && within(a.created_at, start, end)).length,
      };
    });

  return {
    created: created.length,
    completed: completed.length,
    completionRate: active.length ? Math.round((completed.length / active.length) * 100) : 0,
    onTimeRate: withDue.length ? Math.round((onTime.length / withDue.length) * 100) : null,
    overdue: overdueOpen.length,
    avgHours,
    waitMins,
    perDay,
    bucket,
    projects,
    byPriority,
    byStatus,
    people,
    completedTasks: completed,
    activeTasks: active,
  };
}

export function toCSV(tasks, profiles) {
  const cols = ["project", "title", "status", "priority", "assigned_to", "created_by", "start_at", "due_at", "completed_at", "waiting_total_minutes", "description"];
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const rows = tasks.map((t) =>
    cols.map((c) => (c === "assigned_to" || c === "created_by" ? nameOf(profiles, t[c]) : t[c])).map(esc).join(",")
  );
  return [cols.join(","), ...rows].join("\n");
}
