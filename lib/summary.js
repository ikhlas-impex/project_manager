import { PRIORITY, dayKey, fmtLongDate, fmtTime, fmtDateTime, fmtMinutes, waitingMinutes, nameOf, profileName } from "./format";

// Builds the copy-paste daily update for one day.
// userId = null summarizes the whole team.
export function buildDailySummary({ date, tasks, activity, profiles, userId }) {
  const key = dayKey(date);
  const onDay = (d) => d && dayKey(d) === key;
  const mine = (t) => !userId || t.assigned_to === userId || (!t.assigned_to && t.created_by === userId);
  const who = (id) => nameOf(profiles, id);
  const team = !userId;

  const dayActivity = activity.filter((a) => onDay(a.created_at) && (!userId || a.user_id === userId));
  const notesByTask = {};
  for (const a of dayActivity) {
    if (a.kind !== "note") continue;
    (notesByTask[a.task_id] ||= []).push(a);
  }
  const touchedIds = new Set(dayActivity.map((a) => a.task_id));

  const completed = tasks.filter((t) => mine(t) && t.status === "done" && onDay(t.completed_at));
  const inProgress = tasks.filter((t) => mine(t) && t.status === "in_progress");
  const waiting = tasks.filter((t) => mine(t) && t.status === "waiting");
  const created = tasks.filter(
    (t) => onDay(t.created_at) && (!userId || t.created_by === userId || t.assigned_to === userId)
  );
  const tomorrow = new Date(date);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const upcoming = tasks.filter(
    (t) => mine(t) && t.status !== "done" && t.due_at && dayKey(t.due_at) <= dayKey(tomorrow)
  );

  const lines = [];
  const title = team ? "Team Daily Update" : `Daily Update — ${profileName(profiles.find((p) => p.id === userId))}`;
  lines.push(`📋 ${title}`, `📅 ${fmtLongDate(date)}`, "");

  const describe = (t, extra = "") => {
    const out = [`• ${t.title}${extra}`];
    if (t.description) out.push(`   ${t.description.split("\n")[0].slice(0, 220)}`);
    for (const n of notesByTask[t.id] || []) out.push(`   ↳ ${fmtTime(n.created_at)} — ${n.message}`);
    return out;
  };
  const owner = (t) => (team ? ` (${who(t.assigned_to)})` : "");

  section(lines, `✅ Completed (${completed.length})`, completed, (t) => {
    const took = t.start_at ? ` — took ${fmtMinutes((new Date(t.completed_at) - new Date(t.start_at)) / 60000)}` : "";
    const late = t.due_at && new Date(t.completed_at) > new Date(t.due_at) ? " ⚠️ late" : "";
    return describe(t, `${owner(t)} [${PRIORITY[t.priority].label}]${took}${late}`);
  });

  // Only list in-progress items that were worked on today (or everything if nothing was logged)
  const progressShown = inProgress.filter((t) => touchedIds.has(t.id));
  section(lines, `🔄 In Progress (${inProgress.length})`, progressShown.length ? progressShown : inProgress, (t) =>
    describe(t, `${owner(t)}${t.due_at ? ` — due ${fmtDateTime(t.due_at)}` : ""}`)
  );

  section(lines, `⏳ Waiting / Blocked (${waiting.length})`, waiting, (t) =>
    describe(
      t,
      `${owner(t)} — waiting on ${who(t.waiting_on)} for ${fmtMinutes(waitingMinutes(t))}${
        t.waiting_reason ? ` (${t.waiting_reason})` : ""
      }`
    )
  );

  section(lines, `🆕 New / Assigned today (${created.length})`, created, (t) => [
    `• ${t.title} — by ${who(t.created_by)} → ${who(t.assigned_to)}`,
  ]);

  const otherNotes = Object.keys(notesByTask).filter(
    (id) => ![...completed, ...progressShown, ...waiting].some((t) => t.id === id)
  );
  section(lines, "📝 Other updates", otherNotes, (id) => {
    const t = tasks.find((x) => x.id === id);
    return [`• ${t?.title ?? "Task"}`, ...notesByTask[id].map((n) => `   ↳ ${n.message}`)];
  });

  section(lines, "📌 Up next (due by tomorrow)", upcoming, (t) => [
    `• ${t.title}${owner(t)} — due ${fmtDateTime(t.due_at)}${new Date(t.due_at) < new Date() ? " (overdue)" : ""}`,
  ]);

  if (!completed.length && !inProgress.length && !waiting.length && !created.length) {
    lines.push("No task activity recorded for this day.");
  }
  return lines.join("\n").trim();
}

function section(lines, heading, items, render) {
  if (!items.length) return;
  lines.push(heading);
  for (const it of items) lines.push(...render(it));
  lines.push("");
}
