"use client";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, MessageSquarePlus, RotateCcw, Send, Sparkles } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { useData } from "@/components/DataProvider";
import { useToast } from "@/components/Toast";
import { CopyButton, PageHeader, Spinner } from "@/components/ui";
import { buildDailySummary } from "@/lib/summary";
import { askAI, sendEmail } from "@/lib/api";
import { addNote } from "@/lib/tasks";
import { dayKey, fromDayKey, profileName } from "@/lib/format";

export default function SummaryPage() {
  const { profile: me } = useAuth();
  const { tasks, activity, profiles, integrations } = useData();
  const toast = useToast();

  const [day, setDay] = useState(dayKey(new Date()));
  const [who, setWho] = useState(me.id); // user id or "team"
  const [text, setText] = useState("");
  const [edited, setEdited] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [mailTo, setMailTo] = useState("");
  const [sending, setSending] = useState(false);
  const [noteTask, setNoteTask] = useState("");
  const [note, setNote] = useState("");

  const generated = useMemo(
    () => buildDailySummary({ date: fromDayKey(day), tasks, activity, profiles, userId: who === "team" ? null : who }),
    [day, who, tasks, activity, profiles]
  );

  // Auto-regenerate whenever data changes, unless the user has edited the text
  useEffect(() => {
    if (!edited) setText(generated);
  }, [generated, edited]);

  useEffect(() => {
    const manager = profiles.find((p) => p.role === "manager" && p.id !== me.id);
    setMailTo(manager?.notify_email || "");
  }, [profiles, me.id]);

  const shift = (n) => {
    const d = fromDayKey(day);
    d.setDate(d.getDate() + n);
    setDay(dayKey(d));
    setEdited(false);
  };

  async function polish() {
    setAiBusy(true);
    try {
      setText(await askAI("summary", { text }));
      setEdited(true);
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setAiBusy(false);
    }
  }

  async function email() {
    setSending(true);
    try {
      const name = who === "team" ? "Team" : profileName(profiles.find((p) => p.id === who));
      await sendEmail({ to: mailTo, subject: `Daily update — ${name} — ${fromDayKey(day).toDateString()}`, text });
      toast("Summary emailed");
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setSending(false);
    }
  }

  async function postNote(e) {
    e.preventDefault();
    const task = tasks.find((t) => t.id === noteTask);
    if (!task || !note.trim()) return;
    await addNote(task, note.trim(), me);
    setNote("");
    toast("Update added to summary");
  }

  const myOpen = tasks.filter((t) => t.assigned_to === me.id && t.status !== "done");

  return (
    <>
      <PageHeader title="Daily Summary" subtitle="Auto-generated from today's tasks & updates — copy and paste it anywhere.">
        <div className="glass flex items-center gap-1 rounded-xl p-1">
          <button onClick={() => shift(-1)} className="rounded-lg p-2 hover:bg-white/10" aria-label="Previous day"><ChevronLeft className="h-4 w-4" /></button>
          <input type="date" value={day} max={dayKey(new Date())} onChange={(e) => { setDay(e.target.value); setEdited(false); }} className="rounded-lg bg-transparent px-2 py-1 text-sm outline-none" />
          <button onClick={() => shift(1)} disabled={day >= dayKey(new Date())} className="rounded-lg p-2 hover:bg-white/10 disabled:opacity-30" aria-label="Next day"><ChevronRight className="h-4 w-4" /></button>
        </div>
        <select className="input w-auto" value={who} onChange={(e) => { setWho(e.target.value); setEdited(false); }} aria-label="Summary for">
          {profiles.map((p) => <option key={p.id} value={p.id}>{profileName(p)}{p.id === me.id ? " (me)" : ""}</option>)}
          <option value="team">Whole team</option>
        </select>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <section className="glass p-4 sm:p-5">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <CopyButton text={text} label="Copy summary" className="btn-primary" />
            {integrations.ai && (
              <button onClick={polish} disabled={aiBusy} className="btn-ghost">
                {aiBusy ? <Spinner className="h-4 w-4" /> : <Sparkles className="h-4 w-4 text-fuchsia-300" />} Polish with AI
              </button>
            )}
            {edited && (
              <button onClick={() => setEdited(false)} className="btn-ghost"><RotateCcw className="h-4 w-4" /> Regenerate</button>
            )}
            <span className="ml-auto text-xs text-slate-500">{edited ? "Edited — auto-update paused" : "Live · updates automatically"}</span>
          </div>
          <textarea
            value={text}
            onChange={(e) => { setText(e.target.value); setEdited(true); }}
            className="input min-h-[460px] resize-y font-mono text-[13px] leading-relaxed"
            spellCheck={false}
          />
        </section>

        <aside className="space-y-4">
          <form onSubmit={postNote} className="glass space-y-3 p-4">
            <h2 className="section-title flex items-center gap-2"><MessageSquarePlus className="h-4 w-4 text-violet-300" /> Log what you did</h2>
            <p className="text-xs text-slate-400">Short progress notes on a task are added under that task in the summary.</p>
            <select className="input" value={noteTask} onChange={(e) => setNoteTask(e.target.value)} required aria-label="Task">
              <option value="">Choose a task…</option>
              {myOpen.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
            <textarea rows={3} className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Finished first draft, sent for review" required />
            <button className="btn-primary w-full">Add update</button>
          </form>

          <div className="glass space-y-3 p-4">
            <h2 className="section-title flex items-center gap-2"><Send className="h-4 w-4 text-sky-300" /> Email this summary</h2>
            {integrations.email ? (
              <>
                <input className="input" type="email" multiple value={mailTo} onChange={(e) => setMailTo(e.target.value)} placeholder="manager@gmail.com" aria-label="Recipient email" />
                <button onClick={email} disabled={sending || !mailTo} className="btn-ghost w-full">
                  {sending ? <Spinner className="h-4 w-4" /> : <Send className="h-4 w-4" />} Send via Gmail
                </button>
              </>
            ) : (
              <p className="text-xs text-slate-400">Gmail isn&apos;t configured on the server yet (GMAIL_USER / GMAIL_APP_PASSWORD).</p>
            )}
          </div>
        </aside>
      </div>
    </>
  );
}
