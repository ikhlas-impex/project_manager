"use client";
import { useState } from "react";
import { Sparkles } from "lucide-react";
import { useData } from "./DataProvider";
import { useToast } from "./Toast";
import { Spinner } from "./ui";
import { askAI } from "@/lib/api";
import { MIN_ENTRY_CHARS } from "@/lib/summary";

// Text box for logging work on a task. Entries must be at least MIN_ENTRY_CHARS long
// so every task in the daily update is properly described; AI can expand a short note.
export default function WorkNoteForm({ task, onSubmit, rows = 4, submitLabel = "Add to update", extraButton }) {
  const { integrations } = useData();
  const toast = useToast();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);

  const length = text.trim().length;
  const enough = length >= MIN_ENTRY_CHARS;

  async function elaborate() {
    if (!task) return toast("Choose the task first, so AI knows what the work was about", "info");
    if (!text.trim()) return toast("Write a few words about what you did first", "info");
    setAiBusy(true);
    try {
      const out = await askAI("elaborate", { note: text, title: task.title, project: task.project, description: task.description });
      // drop any heading line the model adds (the update already has 🔹 Project headings)
      const lines = out.split("\n").map((l) => l.trim()).filter((l) => l && !/^(project|task)\b[\s:–-]/i.test(l));
      setText(lines.join("\n"));
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setAiBusy(false);
    }
  }

  async function submit(e) {
    e.preventDefault();
    if (!task) return toast("Choose a task", "error");
    if (!enough) return toast(`Please describe the work in at least ${MIN_ENTRY_CHARS} characters (${MIN_ENTRY_CHARS - length} more)`, "error");
    setBusy(true);
    try {
      await onSubmit(text);
      setText("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <textarea
        rows={rows}
        className="input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={"Reviewed the new Azure server and checked its compatibility with PostgreSQL data integration.\nEvaluated the setup requirements for connecting PostgreSQL data to the Agentic AI system."}
        aria-label="What you did"
      />
      <div className="flex items-center justify-between gap-2 text-[11px]">
        <span className={enough ? "text-emerald-300" : "text-amber-300"}>
          {length}/{MIN_ENTRY_CHARS} characters{enough ? " ✓" : ` · ${MIN_ENTRY_CHARS - length} more to go`}
        </span>
        {integrations.ai && (
          <button type="button" onClick={elaborate} disabled={aiBusy || !text.trim()} className="btn-ghost btn-sm">
            {aiBusy ? <Spinner className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5 text-fuchsia-300" />} Elaborate with AI
          </button>
        )}
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-white/10">
        <div className={`h-full rounded-full transition-all ${enough ? "bg-emerald-400" : "bg-amber-400"}`} style={{ width: `${Math.min(100, (length / MIN_ENTRY_CHARS) * 100)}%` }} />
      </div>
      <div className="flex gap-2">
        <button className="btn-primary flex-1" disabled={busy || !enough}>
          {busy && <Spinner className="h-4 w-4 text-white" />} {submitLabel}
        </button>
        {extraButton}
      </div>
    </form>
  );
}
