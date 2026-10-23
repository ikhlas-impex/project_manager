export const STATUS = {
  todo: { label: "To do", dot: "bg-sky-400", chip: "bg-sky-400/10 text-sky-300 ring-sky-400/30", hex: "#38bdf8" },
  in_progress: { label: "In progress", dot: "bg-violet-400", chip: "bg-violet-400/10 text-violet-300 ring-violet-400/30", hex: "#a78bfa" },
  waiting: { label: "Waiting", dot: "bg-amber-400", chip: "bg-amber-400/10 text-amber-300 ring-amber-400/30", hex: "#fbbf24" },
  done: { label: "Done", dot: "bg-emerald-400", chip: "bg-emerald-400/10 text-emerald-300 ring-emerald-400/30", hex: "#34d399" },
};
export const STATUS_ORDER = ["todo", "in_progress", "waiting", "done"];

export const PRIORITY = {
  low: { label: "Low", chip: "bg-slate-400/10 text-slate-300 ring-slate-400/25", rank: 0 },
  medium: { label: "Medium", chip: "bg-sky-400/10 text-sky-300 ring-sky-400/25", rank: 1 },
  high: { label: "High", chip: "bg-orange-400/10 text-orange-300 ring-orange-400/30", rank: 2 },
  urgent: { label: "Urgent", chip: "bg-rose-500/15 text-rose-300 ring-rose-400/40", rank: 3 },
};
export const PRIORITY_ORDER = ["low", "medium", "high", "urgent"];

export const AVATAR_COLORS = ["#8b5cf6", "#6366f1", "#0ea5e9", "#14b8a6", "#22c55e", "#f59e0b", "#f43f5e", "#ec4899"];

const pad = (n) => String(n).padStart(2, "0");

// Local calendar day as YYYY-MM-DD
export const dayKey = (d) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
};
export const fromDayKey = (k) => {
  const [y, m, d] = k.split("-").map(Number);
  return new Date(y, m - 1, d);
};

export const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" }) : "";
export const fmtLongDate = (d) =>
  new Date(d).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
export const fmtTime = (d) => new Date(d).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
export const fmtDateTime = (d) => (d ? `${fmtDate(d)}, ${fmtTime(d)}` : "—");

export function fmtMinutes(m) {
  m = Math.max(0, Math.round(m));
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return m % 60 ? `${h}h ${m % 60}m` : `${h}h`;
  const d = Math.floor(h / 24);
  return h % 24 ? `${d}d ${h % 24}h` : `${d}d`;
}

export const minutesSince = (d) => (Date.now() - new Date(d).getTime()) / 60000;

export function waitingMinutes(task) {
  const live = task.status === "waiting" && task.waiting_since ? minutesSince(task.waiting_since) : 0;
  return (task.waiting_total_minutes || 0) + live;
}

export function isOverdue(task) {
  return task.status !== "done" && task.due_at && new Date(task.due_at) < new Date();
}

export function dueInfo(task) {
  if (!task.due_at) return null;
  if (task.status === "done") {
    const late = task.completed_at && new Date(task.completed_at) > new Date(task.due_at);
    return { text: late ? "Completed late" : "Completed on time", tone: late ? "text-amber-300" : "text-emerald-300" };
  }
  const mins = (new Date(task.due_at) - Date.now()) / 60000;
  if (mins < 0) return { text: `Overdue by ${fmtMinutes(-mins)}`, tone: "text-rose-300", overdue: true };
  if (mins < 24 * 60) return { text: `Due in ${fmtMinutes(mins)}`, tone: "text-amber-200" };
  return { text: `Due ${fmtDate(task.due_at)}`, tone: "text-slate-400" };
}

export const toLocalInput = (d) => {
  if (!d) return "";
  const x = new Date(d);
  return `${dayKey(x)}T${pad(x.getHours())}:${pad(x.getMinutes())}`;
};

export const profileName = (p) => p?.full_name || p?.username || "Unassigned";
export const nameOf = (profiles, id) => (id ? profileName(profiles.find((p) => p.id === id)) : "Unassigned");
// Who a waiting task is blocked on: an app user, or a typed name (someone outside the app)
export const waitingName = (profiles, t) =>
  t.waiting_on ? nameOf(profiles, t.waiting_on) : t.waiting_on_name?.trim() || "someone";

export const initials = (name = "?") =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("") || "?";

// Google Calendar "add event" link (no OAuth needed)
export function googleCalendarUrl(task) {
  const toG = (d) => new Date(d).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const end = task.due_at ? new Date(task.due_at) : new Date(Date.now() + 3600e3);
  const start = new Date(end.getTime() - 3600e3);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: task.title,
    details: task.description || "",
    dates: `${toG(start)}/${toG(end)}`,
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}
