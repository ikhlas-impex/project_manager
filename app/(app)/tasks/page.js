"use client";
import { useMemo, useState } from "react";
import { LayoutGrid, List, Plus, Search } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { useData } from "@/components/DataProvider";
import { useToast } from "@/components/Toast";
import TaskCard from "@/components/TaskCard";
import { Avatar, PageHeader, PriorityChip, Segmented, StatusChip } from "@/components/ui";
import { canEdit, updateTask } from "@/lib/tasks";
import { STATUS, STATUS_ORDER, PRIORITY, PRIORITY_ORDER, dueInfo, profileName } from "@/lib/format";

export default function TasksPage() {
  const { profile: me } = useAuth();
  const { tasks, profiles, openTask, newTask } = useData();
  const toast = useToast();
  const [scope, setScope] = useState("all");
  const [priority, setPriority] = useState("");
  const [q, setQ] = useState("");
  const [view, setView] = useState("board");
  const [dragOver, setDragOver] = useState(null);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return tasks.filter((t) => {
      if (scope === "mine" && t.assigned_to !== me.id) return false;
      if (scope === "byme" && t.created_by !== me.id) return false;
      if (scope.startsWith("u:") && t.assigned_to !== scope.slice(2)) return false;
      if (priority && t.priority !== priority) return false;
      if (needle && !`${t.title} ${t.description ?? ""}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [tasks, scope, priority, q, me.id]);

  async function drop(status, e) {
    e.preventDefault();
    setDragOver(null);
    const task = tasks.find((t) => t.id === e.dataTransfer.getData("text/task"));
    if (!task || task.status === status) return;
    if (!canEdit(task, me)) return toast("You can't change this task", "error");
    // moving to "waiting" needs a person + reason, so open the editor
    if (status === "waiting") return openTask({ ...task, status: "waiting" });
    try {
      await updateTask(task, { status }, me, profiles);
      toast(`Moved to ${STATUS[status].label}`);
    } catch (err) {
      toast(err.message, "error");
    }
  }

  return (
    <>
      <PageHeader title="Tasks" subtitle={`${filtered.length} task${filtered.length === 1 ? "" : "s"} · drag cards between columns to update status`}>
        <button onClick={() => newTask()} className="btn-primary"><Plus className="h-4 w-4" /> New task</button>
      </PageHeader>

      <div className="glass mb-5 flex flex-col gap-3 p-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input className="input pl-10" placeholder="Search tasks…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="input lg:w-48" value={scope} onChange={(e) => setScope(e.target.value)} aria-label="Whose tasks">
          <option value="all">Everyone</option>
          <option value="mine">Assigned to me</option>
          <option value="byme">Created by me</option>
          {profiles.filter((p) => p.id !== me.id).map((p) => (
            <option key={p.id} value={`u:${p.id}`}>{profileName(p)}</option>
          ))}
        </select>
        <select className="input lg:w-40" value={priority} onChange={(e) => setPriority(e.target.value)} aria-label="Priority">
          <option value="">Any priority</option>
          {PRIORITY_ORDER.map((p) => <option key={p} value={p}>{PRIORITY[p].label}</option>)}
        </select>
        <div className="lg:w-36">
          <Segmented
            value={view}
            onChange={setView}
            options={[
              { value: "board", label: <span className="flex items-center justify-center gap-1"><LayoutGrid className="h-3.5 w-3.5" /> Board</span> },
              { value: "list", label: <span className="flex items-center justify-center gap-1"><List className="h-3.5 w-3.5" /> List</span> },
            ]}
          />
        </div>
      </div>

      {view === "board" ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {STATUS_ORDER.map((s) => {
            const col = filtered.filter((t) => t.status === s);
            return (
              <section
                key={s}
                onDragOver={(e) => { e.preventDefault(); setDragOver(s); }}
                onDragLeave={() => setDragOver(null)}
                onDrop={(e) => drop(s, e)}
                className={`rounded-2xl border p-3 transition ${dragOver === s ? "border-violet-400/50 bg-violet-500/10" : "border-white/5 bg-white/[0.02]"}`}
              >
                <h2 className="mb-3 flex items-center gap-2 px-1 text-sm font-semibold text-slate-200">
                  <span className={`h-2 w-2 rounded-full ${STATUS[s].dot}`} />
                  {STATUS[s].label}
                  <span className="ml-auto rounded-full bg-white/10 px-2 py-0.5 text-xs text-slate-400">{col.length}</span>
                </h2>
                <div className="flex min-h-24 flex-col gap-3">
                  {col.map((t) => (
                    <div key={t.id} draggable onDragStart={(e) => e.dataTransfer.setData("text/task", t.id)}>
                      <TaskCard task={t} />
                    </div>
                  ))}
                  {!col.length && <p className="py-6 text-center text-xs text-slate-500">Drop tasks here</p>}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <div className="glass overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="px-4 py-3 font-medium">Task</th>
                <th className="px-4 py-3 font-medium">Assignee</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Priority</th>
                <th className="px-4 py-3 font-medium">Deadline</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtered.map((t) => {
                const due = dueInfo(t);
                const who = profiles.find((p) => p.id === t.assigned_to);
                return (
                  <tr key={t.id} onClick={() => openTask(t)} className="cursor-pointer transition hover:bg-white/5">
                    <td className="max-w-xs truncate px-4 py-3 font-medium text-slate-100">{t.title}</td>
                    <td className="px-4 py-3"><span className="flex items-center gap-2"><Avatar profile={who} size={22} />{profileName(who)}</span></td>
                    <td className="px-4 py-3"><StatusChip status={t.status} /></td>
                    <td className="px-4 py-3"><PriorityChip priority={t.priority} /></td>
                    <td className={`px-4 py-3 text-xs ${due?.tone ?? "text-slate-500"}`}>{due?.text ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!filtered.length && <p className="p-8 text-center text-sm text-slate-500">No tasks match your filters.</p>}
        </div>
      )}
    </>
  );
}
