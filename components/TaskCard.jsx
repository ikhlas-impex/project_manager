"use client";
import { CalendarClock, Hourglass } from "lucide-react";
import { useData } from "./DataProvider";
import { Avatar, PriorityChip, StatusChip } from "./ui";
import { STATUS, dueInfo, fmtMinutes, waitingMinutes, waitingName } from "@/lib/format";

export default function TaskCard({ task, showStatus = false }) {
  const { profiles, openTask } = useData();
  const due = dueInfo(task);
  const assignee = profiles.find((p) => p.id === task.assigned_to);

  return (
    <button
      onClick={() => openTask(task)}
      className={`glass card-hover group relative w-full overflow-hidden p-4 text-left ${task.status === "done" ? "opacity-75" : ""}`}
    >
      <span className="absolute inset-y-0 left-0 w-1" style={{ background: STATUS[task.status].hex }} />
      {task.project && <p className="mb-1 truncate text-[11px] font-medium text-violet-300/90">🔹 {task.project}</p>}
      <div className="flex items-start justify-between gap-3">
        <p className={`font-medium leading-snug text-slate-100 ${task.status === "done" ? "line-through decoration-slate-500" : ""}`}>
          {task.title}
        </p>
        <Avatar profile={assignee} size={26} />
      </div>
      {task.description && <p className="mt-1.5 line-clamp-2 text-xs text-slate-400">{task.description}</p>}

      {task.status === "waiting" && (
        <p className="mt-2.5 flex items-center gap-1.5 rounded-lg bg-amber-400/10 px-2 py-1 text-[11px] text-amber-200">
          <Hourglass className="h-3 w-3 shrink-0" />
          <span className="truncate" title={task.waiting_reason || ""}>
            Waiting on {waitingName(profiles, task)} · {fmtMinutes(waitingMinutes(task))}
          </span>
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {showStatus && <StatusChip status={task.status} />}
        <PriorityChip priority={task.priority} />
        {due && (
          <span className={`ml-auto flex items-center gap-1 text-[11px] ${due.tone}`}>
            <CalendarClock className="h-3 w-3" />
            {due.text}
          </span>
        )}
      </div>
    </button>
  );
}
