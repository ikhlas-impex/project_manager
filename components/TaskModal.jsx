"use client";
import { useMemo, useState } from "react";
import { CalendarPlus, Clock, Hourglass, Mail, MessageSquarePlus, Send, Sparkles, Trash2 } from "lucide-react";
import { useAuth } from "./AuthProvider";
import { useData } from "./DataProvider";
import { useToast } from "./Toast";
import { Avatar, Modal, Segmented, Spinner } from "./ui";
import { askAI, sendEmail } from "@/lib/api";
import { canEdit, createTask, updateTask, addNote, deleteTask } from "@/lib/tasks";
import {
  STATUS, STATUS_ORDER, PRIORITY, PRIORITY_ORDER, toLocalInput, fmtDateTime, fmtMinutes, waitingMinutes,
  googleCalendarUrl, nameOf, profileName,
} from "@/lib/format";

const toISO = (local) => (local ? new Date(local).toISOString() : null);

export default function TaskModal({ task: initial, defaults = {}, onClose }) {
  const { profile: me } = useAuth();
  const { profiles, tasks, activity, integrations } = useData();
  const toast = useToast();

  // Keep the live version so timers / waiting info update via realtime
  const task = initial ? tasks.find((t) => t.id === initial.id) || initial : null;
  const isNew = !task;
  const editable = isNew || canEdit(task, me);

  // Form starts from what the caller passed (it may preset a status, e.g. drag to "Waiting")
  const [form, setForm] = useState(() => ({
    title: initial?.title ?? "",
    description: initial?.description ?? "",
    assigned_to: initial?.assigned_to ?? defaults.assigned_to ?? me.id,
    priority: initial?.priority ?? "medium",
    status: initial?.status ?? "todo",
    start_at: toLocalInput(initial?.start_at ?? new Date()),
    due_at: toLocalInput(initial?.due_at ?? defaults.due_at),
    waiting_on: initial?.waiting_on ?? "",
    waiting_reason: initial?.waiting_reason ?? "",
  }));
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e }));

  const [saving, setSaving] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [note, setNote] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [mail, setMail] = useState(null); // { to, text }

  const history = useMemo(
    () => (task ? activity.filter((a) => a.task_id === task.id) : []),
    [activity, task]
  );

  async function save(e) {
    e.preventDefault();
    if (!form.title.trim()) return toast("Please add a title", "error");
    if (form.status === "waiting" && !form.waiting_on) return toast("Choose who you are waiting on", "error");

    const fields = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      assigned_to: form.assigned_to || null,
      priority: form.priority,
      status: form.status,
      start_at: toISO(form.start_at),
      due_at: toISO(form.due_at),
    };
    if (form.status === "waiting") {
      fields.waiting_on = form.waiting_on;
      fields.waiting_reason = form.waiting_reason.trim() || null;
    }

    setSaving(true);
    try {
      if (isNew) {
        await createTask(fields, me, profiles);
        toast("Task created");
      } else {
        const patch = Object.fromEntries(
          Object.entries(fields).filter(([k, v]) => {
            if (k === "start_at" || k === "due_at") return (v && new Date(v).getTime()) !== (task[k] && new Date(task[k]).getTime());
            return v !== (task[k] ?? null);
          })
        );
        if (Object.keys(patch).length) await updateTask(task, patch, me, profiles);
        toast("Task saved");
      }
      onClose();
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function writeWithAI() {
    if (!form.title.trim()) return toast("Add a title first, then let AI describe it", "info");
    setAiBusy(true);
    try {
      const text = await askAI("describe", { title: form.title, notes: form.description });
      setForm((f) => ({ ...f, description: text }));
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setAiBusy(false);
    }
  }

  async function postNote(e) {
    e.preventDefault();
    if (!note.trim()) return;
    await addNote(task, note.trim(), me);
    setNote("");
    toast("Update added — it will appear in today's summary");
  }

  async function remove() {
    if (!confirmDelete) return setConfirmDelete(true);
    try {
      await deleteTask(task);
      toast("Task deleted");
      onClose();
    } catch (err) {
      toast(err.message, "error");
    }
  }

  function openMail() {
    const other = task.assigned_to === me.id ? task.created_by : task.assigned_to;
    setMail({
      to: other && other !== me.id ? other : profiles.find((p) => p.id !== me.id)?.id || "",
      text: `Hi,\n\nRegarding "${task.title}" (${STATUS[task.status].label}${task.due_at ? `, due ${fmtDateTime(task.due_at)}` : ""}):\n\n\n\nThanks,\n${profileName(me)}`,
    });
  }

  async function send() {
    try {
      await sendEmail({ toUserIds: [mail.to], subject: `TeamFlow: ${task.title}`, text: mail.text });
      toast("Email sent");
      setMail(null);
    } catch (err) {
      toast(err.message, "error");
    }
  }

  const others = profiles.filter((p) => p.id !== me.id);

  return (
    <Modal open onClose={onClose} title={isNew ? "New task" : editable ? "Edit task" : "Task details"} wide={!isNew}>
      <div className={isNew ? "" : "grid gap-6 lg:grid-cols-[1fr_320px]"}>
        <form onSubmit={save} className="space-y-4">
          <fieldset disabled={!editable} className="space-y-4">
            <div>
              <label className="label" htmlFor="t-title">Title</label>
              <input id="t-title" className="input text-base" value={form.title} onChange={set("title")} placeholder="e.g. Prepare product catalogue for client" autoFocus={isNew} />
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="label mb-0" htmlFor="t-desc">Description</label>
                {integrations.ai && editable && (
                  <button type="button" onClick={writeWithAI} disabled={aiBusy} className="btn-ghost btn-sm">
                    {aiBusy ? <Spinner className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5 text-fuchsia-300" />}
                    Write with AI
                  </button>
                )}
              </div>
              <textarea id="t-desc" rows={isNew ? 4 : 6} className="input resize-y" value={form.description} onChange={set("description")} placeholder="What needs to be done? Steps, links, acceptance criteria…" />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="t-assign">Assign to</label>
                <select id="t-assign" className="input" value={form.assigned_to || ""} onChange={set("assigned_to")}>
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {profileName(p)}{p.id === me.id ? " (me)" : ""} · {p.role}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <span className="label">Priority</span>
                <Segmented value={form.priority} onChange={set("priority")} options={PRIORITY_ORDER.map((p) => ({ value: p, label: PRIORITY[p].label }))} />
              </div>
            </div>

            <div>
              <span className="label">Status</span>
              <Segmented value={form.status} onChange={set("status")} options={STATUS_ORDER.map((s) => ({ value: s, label: STATUS[s].label }))} />
            </div>

            {form.status === "waiting" && (
              <div className="fade-in grid gap-4 rounded-xl border border-amber-400/20 bg-amber-400/5 p-4 sm:grid-cols-2">
                <div>
                  <label className="label text-amber-200/80" htmlFor="t-wait">Waiting on</label>
                  <select id="t-wait" className="input" value={form.waiting_on} onChange={set("waiting_on")}>
                    <option value="">Select person…</option>
                    {profiles.map((p) => (
                      <option key={p.id} value={p.id}>{profileName(p)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label text-amber-200/80" htmlFor="t-reason">Reason</label>
                  <input id="t-reason" className="input" value={form.waiting_reason} onChange={set("waiting_reason")} placeholder="e.g. Need approval / files" />
                </div>
                {task?.status === "waiting" && (
                  <p className="flex items-center gap-1.5 text-xs text-amber-200 sm:col-span-2">
                    <Hourglass className="h-3.5 w-3.5" /> Waiting for {fmtMinutes(waitingMinutes(task))} so far
                  </p>
                )}
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="t-start">Start</label>
                <input id="t-start" type="datetime-local" className="input" value={form.start_at} onChange={set("start_at")} />
              </div>
              <div>
                <label className="label" htmlFor="t-due">Deadline (time to end)</label>
                <input id="t-due" type="datetime-local" className="input" value={form.due_at} onChange={set("due_at")} />
              </div>
            </div>
          </fieldset>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-4">
            <div>
              {!isNew && (me.role === "manager" || task.created_by === me.id) && (
                <button type="button" onClick={remove} className="btn-danger btn-sm">
                  <Trash2 className="h-3.5 w-3.5" /> {confirmDelete ? "Click again to delete" : "Delete"}
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
              {editable && (
                <button type="submit" disabled={saving} className="btn-primary">
                  {saving && <Spinner className="h-4 w-4 text-white" />}
                  {isNew ? "Create task" : "Save changes"}
                </button>
              )}
            </div>
          </div>
        </form>

        {!isNew && (
          <aside className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <a href={googleCalendarUrl(task)} target="_blank" rel="noreferrer" className="btn-ghost btn-sm">
                <CalendarPlus className="h-3.5 w-3.5" /> Google Calendar
              </a>
              <button type="button" onClick={openMail} disabled={!integrations.email || !others.length} title={integrations.email ? "" : "Gmail not configured"} className="btn-ghost btn-sm">
                <Mail className="h-3.5 w-3.5" /> Email
              </button>
            </div>

            {mail && (
              <div className="fade-in space-y-2 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <select className="input" value={mail.to} onChange={(e) => setMail({ ...mail, to: e.target.value })}>
                  {others.map((p) => (
                    <option key={p.id} value={p.id}>
                      {profileName(p)} {p.notify_email ? `<${p.notify_email}>` : "(no email set)"}
                    </option>
                  ))}
                </select>
                <textarea rows={6} className="input text-xs" value={mail.text} onChange={(e) => setMail({ ...mail, text: e.target.value })} />
                <div className="flex justify-end gap-2">
                  <button type="button" className="btn-ghost btn-sm" onClick={() => setMail(null)}>Cancel</button>
                  <button type="button" className="btn-primary btn-sm" onClick={send}><Send className="h-3.5 w-3.5" /> Send</button>
                </div>
              </div>
            )}

            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs text-slate-400">
              <div className="flex items-center gap-2"><Avatar profile={profiles.find((p) => p.id === task.created_by)} size={20} /> Created by {nameOf(profiles, task.created_by)}</div>
              <div className="mt-1.5 flex items-center gap-2"><Clock className="h-3.5 w-3.5" /> {fmtDateTime(task.created_at)}</div>
              {task.waiting_total_minutes > 0 && (
                <div className="mt-1.5 flex items-center gap-2"><Hourglass className="h-3.5 w-3.5" /> Total waiting: {fmtMinutes(waitingMinutes(task))}</div>
              )}
            </div>

            <div>
              <h3 className="section-title mb-2">Progress updates</h3>
              <form onSubmit={postNote} className="mb-3 flex gap-2">
                <input className="input py-2 text-xs" value={note} onChange={(e) => setNote(e.target.value)} placeholder="What did you do on this today?" />
                <button className="btn-primary btn-sm px-2.5" aria-label="Add update"><MessageSquarePlus className="h-4 w-4" /></button>
              </form>
              <ol className="max-h-72 space-y-3 overflow-y-auto pr-1">
                {history.map((a) => (
                  <li key={a.id} className="flex gap-2.5">
                    <Avatar profile={profiles.find((p) => p.id === a.user_id)} size={22} />
                    <div className="min-w-0">
                      <p className={`text-xs ${a.kind === "note" ? "text-slate-100" : "text-slate-400"}`}>{a.message}</p>
                      <p className="text-[10px] text-slate-500">{fmtDateTime(a.created_at)}</p>
                    </div>
                  </li>
                ))}
                {!history.length && <li className="text-xs text-slate-500">No activity yet.</li>}
              </ol>
            </div>
          </aside>
        )}
      </div>
    </Modal>
  );
}
