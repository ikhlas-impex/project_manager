import { supabase } from "./supabase";
import { sendEmail } from "./api";
import { STATUS, PRIORITY, fmtDateTime, nameOf } from "./format";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "";

export function canEdit(task, me) {
  if (!task || !me) return false;
  return (
    me.role === "manager" ||
    task.created_by === me.id ||
    task.assigned_to === me.id ||
    task.waiting_on === me.id
  );
}

async function log(taskId, userId, kind, message) {
  await supabase.from("task_activity").insert({ task_id: taskId, user_id: userId, kind, message });
}

// Email notifications are best-effort: never block the UI if Gmail isn't set up.
function notify(profiles, userId, me, subject, text) {
  if (!userId || userId === me.id) return;
  const target = profiles.find((p) => p.id === userId);
  if (!target?.notify_email) return;
  sendEmail({ toUserIds: [userId], subject, text: `${text}\n\nOpen TeamFlow: ${APP_URL}/tasks` }).catch(() => {});
}

function taskText(t, profiles) {
  return [
    `Task: ${t.title}`,
    `Priority: ${PRIORITY[t.priority].label}`,
    `Status: ${STATUS[t.status].label}`,
    `Assigned to: ${nameOf(profiles, t.assigned_to)}`,
    t.due_at ? `Due: ${fmtDateTime(t.due_at)}` : null,
    t.description ? `\n${t.description}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

export async function createTask(fields, me, profiles) {
  const { data, error } = await supabase
    .from("tasks")
    .insert({ ...fields, created_by: me.id })
    .select()
    .single();
  if (error) throw error;

  await log(data.id, me.id, "created", `Created "${data.title}"`);
  if (data.assigned_to && data.assigned_to !== me.id) {
    await log(data.id, me.id, "assigned", `Assigned to ${nameOf(profiles, data.assigned_to)}`);
    notify(profiles, data.assigned_to, me, `New task from ${me.full_name}: ${data.title}`,
      `${me.full_name} assigned you a new task.\n\n${taskText(data, profiles)}`);
  }
  if (data.status === "waiting" && data.waiting_on) {
    notify(profiles, data.waiting_on, me, `${me.full_name} is waiting on you: ${data.title}`,
      `${me.full_name} is waiting on you.\nReason: ${data.waiting_reason || "-"}\n\n${taskText(data, profiles)}`);
  }
  return data;
}

export async function updateTask(task, patch, me, profiles) {
  const { data, error } = await supabase.from("tasks").update(patch).eq("id", task.id).select().single();
  if (error) throw error;

  if (patch.status && patch.status !== task.status) {
    let msg = `Status: ${STATUS[task.status].label} → ${STATUS[patch.status].label}`;
    if (patch.status === "waiting") {
      msg += ` (waiting on ${nameOf(profiles, patch.waiting_on)}${patch.waiting_reason ? `: ${patch.waiting_reason}` : ""})`;
    }
    await log(task.id, me.id, "status", msg);

    if (patch.status === "done") {
      notify(profiles, task.created_by, me, `✅ Completed: ${task.title}`,
        `${me.full_name} completed a task you created.\n\n${taskText(data, profiles)}`);
    }
    if (patch.status === "waiting" && patch.waiting_on) {
      notify(profiles, patch.waiting_on, me, `⏳ ${me.full_name} is waiting on you: ${task.title}`,
        `${me.full_name} is waiting on you.\nReason: ${patch.waiting_reason || "-"}\n\n${taskText(data, profiles)}`);
    }
  }
  if ("assigned_to" in patch && patch.assigned_to !== task.assigned_to) {
    await log(task.id, me.id, "assigned", `Assigned to ${nameOf(profiles, patch.assigned_to)}`);
    notify(profiles, patch.assigned_to, me, `New task from ${me.full_name}: ${data.title}`,
      `${me.full_name} assigned you a task.\n\n${taskText(data, profiles)}`);
  }
  const edited = ["project", "title", "description", "due_at", "priority"].filter(
    (k) => k in patch && (patch[k] ?? null) !== (task[k] ?? null) && !(k === "due_at" && sameTime(patch[k], task[k]))
  );
  if (edited.length) await log(task.id, me.id, "edited", `Updated ${edited.join(", ").replace("due_at", "deadline")}`);
  return data;
}

const sameTime = (a, b) => a && b && new Date(a).getTime() === new Date(b).getTime();

export async function addNote(task, text, me) {
  await log(task.id, me.id, "note", text);
}

export async function deleteTask(task) {
  const { error } = await supabase.from("tasks").delete().eq("id", task.id);
  if (error) throw error;
}
