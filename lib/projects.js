// Groups tasks into projects with start, delivery and on-time info.
// Tasks without a project are their own project (named by title), like the daily summary.
export function summarizeProjects(tasks, now = new Date()) {
  const groups = new Map();
  for (const t of tasks) {
    const name = t.project?.trim() || t.title;
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push(t);
  }

  return [...groups.entries()]
    .map(([name, list]) => {
      const time = (d) => (d ? new Date(d).getTime() : null);
      const max = (xs) => (xs.length ? new Date(Math.max(...xs)) : null);
      const starts = list.map((t) => time(t.start_at) ?? time(t.created_at));
      const start = new Date(Math.min(...starts));
      const done = list.filter((t) => t.status === "done");
      const allDone = done.length === list.length;
      const delivered = allDone ? max(done.map((t) => time(t.completed_at)).filter(Boolean)) : null;
      const due = max(list.map((t) => time(t.due_at)).filter(Boolean));

      let status, lateDays = 0;
      if (allDone) {
        status = due && delivered > due ? "late" : "delivered";
        if (status === "late") lateDays = Math.ceil((delivered - due) / 864e5);
      } else if (due && due < now) {
        status = "overdue";
        lateDays = Math.ceil((now - due) / 864e5);
      } else {
        status = "active";
      }

      return {
        name,
        tasks: list,
        total: list.length,
        done: done.length,
        start,
        delivered,
        due,
        status,
        lateDays,
        onTime: allDone && due ? delivered <= due : null,
        durationDays: Math.max(1, Math.round(((delivered || now) - start) / 864e5) + 1),
        assignees: [...new Set(list.map((t) => t.assigned_to).filter(Boolean))],
      };
    })
    .sort((a, b) => a.start - b.start);
}

// Human label + colours for a project's delivery state
export function deliveryInfo(p) {
  switch (p.status) {
    case "late":
      return { label: `Delivered ${p.lateDays}d late`, hex: "#fbbf24", chip: "bg-amber-400/10 text-amber-300 ring-amber-400/30" };
    case "overdue":
      return { label: `Overdue by ${p.lateDays}d`, hex: "#fb7185", chip: "bg-rose-500/15 text-rose-300 ring-rose-400/40" };
    case "active":
      return { label: p.due ? "In progress" : "In progress · no deadline", hex: "#a78bfa", chip: "bg-violet-400/10 text-violet-300 ring-violet-400/30" };
    default:
      return {
        label: p.due ? "Delivered on time" : "Delivered",
        hex: "#34d399",
        chip: "bg-emerald-400/10 text-emerald-300 ring-emerald-400/30",
      };
  }
}

export const fmtDays = (d) => (d >= 60 ? `${Math.round(d / 30.4)} months` : d >= 14 ? `${Math.round(d / 7)} weeks` : `${d} day${d === 1 ? "" : "s"}`);
