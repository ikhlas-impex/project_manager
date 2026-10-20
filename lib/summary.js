import { dayKey, fmtMinutes, waitingMinutes, nameOf, profileName } from "./format";

// Builds the copy-paste daily update in the team's WhatsApp format:
//
//   📅 Today’s Work Update
//
//   🔹 Project: Elkitch – Sale Mela Application
//
//   Developed a Sale Mela web application with a data-entry form.
//   Added support for uploading images.
//
// Work lines come from the progress notes logged on tasks that day, plus
// completed / started tasks. userId = null builds it for the whole department.
export function buildDailySummary({ date, tasks, activity, profiles, userId, teamName }) {
  const key = dayKey(date);
  const isToday = key === dayKey(new Date());
  const heading = isToday
    ? "📅 Today’s Work Update"
    : `📅 Work Update – ${new Date(date).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short", year: "numeric" })}`;

  if (userId) {
    const body = personBlocks({ uid: userId, key, isToday, tasks, activity, profiles });
    return [heading, "", body || EMPTY].join("\n").trim();
  }

  // Whole department: one section per person who did something
  const people = [...new Set([...tasks.map((t) => t.assigned_to), ...activity.map((a) => a.user_id)].filter(Boolean))];
  const sections = people
    .map((uid) => ({ uid, body: personBlocks({ uid, key, isToday, tasks, activity, profiles }) }))
    .filter((s) => s.body)
    .sort((a, b) => nameOf(profiles, a.uid).localeCompare(nameOf(profiles, b.uid)))
    .map((s) => `👤 ${profileName(profiles.find((p) => p.id === s.uid))}\n\n${s.body}`);

  return [`${heading}${teamName ? ` – ${teamName}` : ""}`, "", sections.join("\n\n━━━━━━━━━━\n\n") || EMPTY].join("\n").trim();
}

const EMPTY = "No work logged for this day yet.\nAdd progress notes on your tasks and they will appear here, grouped by project.";

// "reviewed the server" -> "Reviewed the server."
function sentence(text) {
  const s = String(text).trim().replace(/\s+/g, " ");
  if (!s) return "";
  const cap = s[0].toUpperCase() + s.slice(1);
  return /[.!?…)]$/.test(cap) ? cap : `${cap}.`;
}

function personBlocks({ uid, key, isToday, tasks, activity, profiles }) {
  const onDay = (d) => d && dayKey(d) === key;
  const owns = (t) => t.assigned_to === uid || (!t.assigned_to && t.created_by === uid);
  const byId = new Map(tasks.map((t) => [t.id, t]));

  // project heading -> ordered list of work lines
  const groups = new Map();
  const add = (task, line) => {
    if (!line) return;
    const name = task.project?.trim() || task.title;
    if (!groups.has(name)) groups.set(name, []);
    const lines = groups.get(name);
    if (!lines.includes(line)) lines.push(line);
  };
  // when a task has its own heading (no project), refer to it as "this task"
  const ref = (t) => (t.project?.trim() ? `“${t.title}”` : "this task");

  const dayActivity = activity
    .filter((a) => onDay(a.created_at) && a.user_id === uid)
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  const noted = new Set();

  // 1) progress notes, in the order they were written
  for (const a of dayActivity) {
    const t = byId.get(a.task_id);
    if (!t) continue;
    if (a.kind === "note") {
      add(t, sentence(a.message));
      noted.add(t.id);
    } else if (a.kind === "status" && /→ In progress/.test(a.message || "") && !noted.has(t.id)) {
      add(t, sentence(`Started work on ${ref(t)}`));
    }
  }

  // 2) tasks completed that day
  for (const t of tasks) {
    if (!owns(t) || t.status !== "done" || !onDay(t.completed_at)) continue;
    add(t, sentence(`✅ Completed ${ref(t)}`));
  }

  // 3) still waiting on someone (only meaningful for today)
  if (isToday) {
    for (const t of tasks) {
      if (!owns(t) || t.status !== "waiting") continue;
      add(t, sentence(`⏳ Waiting on ${nameOf(profiles, t.waiting_on)} for ${fmtMinutes(waitingMinutes(t))}${t.waiting_reason ? ` – ${t.waiting_reason}` : ""}`));
    }
  }

  return [...groups.entries()].map(([name, lines]) => `🔹 Project: ${name}\n\n${lines.join("\n")}`).join("\n\n");
}
