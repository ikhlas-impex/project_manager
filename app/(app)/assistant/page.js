"use client";
import { useEffect, useRef, useState } from "react";
import { Bot, SendHorizonal, Sparkles } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { useData } from "@/components/DataProvider";
import { Avatar, CopyButton, EmptyState, PageHeader, RichText, Spinner } from "@/components/ui";
import { askAI } from "@/lib/api";
import { nameOf, profileName } from "@/lib/format";

const SUGGESTIONS = [
  "Plan my day: what should I work on first?",
  "Which tasks are at risk of missing their deadline?",
  "Who is blocking whom right now, and for how long?",
  "Draft a polite follow-up message for my waiting tasks.",
  "Suggest how to split my biggest task into smaller ones.",
];

export default function AssistantPage() {
  const { profile: me } = useAuth();
  const { tasks, profiles, integrations } = useData();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef(null);

  useEffect(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), [messages, busy]);

  async function ask(text) {
    const q = (text ?? input).trim();
    if (!q || busy) return;
    const next = [...messages, { role: "user", text: q }];
    setMessages(next);
    setInput("");
    setBusy(true);
    const context = {
      now: new Date().toString(),
      me: { name: profileName(me), role: me.role },
      people: profiles.map((p) => ({ name: profileName(p), role: p.role })),
      tasks: tasks.filter((t) => t.status !== "done" || Date.now() - new Date(t.completed_at) < 14 * 864e5).slice(0, 120).map((t) => ({
        title: t.title, description: t.description?.slice(0, 300), status: t.status, priority: t.priority,
        assignee: nameOf(profiles, t.assigned_to), createdBy: nameOf(profiles, t.created_by), due: t.due_at,
        completed: t.completed_at, waitingOn: t.waiting_on ? nameOf(profiles, t.waiting_on) : undefined,
        waitingSince: t.waiting_since || undefined, waitingReason: t.waiting_reason || undefined,
      })),
    };
    try {
      const reply = await askAI("chat", { messages: next.slice(-10), context });
      setMessages((m) => [...m, { role: "assistant", text: reply }]);
    } catch (err) {
      setMessages((m) => [...m, { role: "assistant", text: `⚠️ ${err.message}`, error: true }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title="AI Assistant" subtitle="Powered by Google Gemini. Knows your team's tasks, deadlines and waiting time." />

      <div className="glass flex h-[calc(100vh-15rem)] min-h-[420px] flex-col">
        <div className="flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
          {!integrations.ai ? (
            <EmptyState icon={Bot} title="Gemini isn't connected" text="Add GEMINI_API_KEY to the server environment (Vercel → Settings → Environment Variables) and redeploy." />
          ) : !messages.length ? (
            <EmptyState icon={Sparkles} title="Ask anything about your work" text="Try one of these:">
              <div className="flex max-w-xl flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((s) => (
                  <button key={s} onClick={() => ask(s)} className="btn-ghost btn-sm whitespace-normal text-left">{s}</button>
                ))}
              </div>
            </EmptyState>
          ) : (
            messages.map((m, i) => (
              <div key={i} className={`fade-in flex gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
                {m.role === "user" ? (
                  <Avatar profile={me} size={30} />
                ) : (
                  <span className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full bg-gradient-to-br from-fuchsia-500 to-violet-500"><Bot className="h-4 w-4 text-white" /></span>
                )}
                <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${m.role === "user" ? "bg-gradient-to-br from-violet-500/80 to-indigo-500/80 text-white" : m.error ? "bg-rose-500/10 text-rose-200" : "bg-white/[0.06] ring-1 ring-white/10"}`}>
                  {m.role === "user" ? <p className="whitespace-pre-wrap text-sm">{m.text}</p> : <RichText text={m.text} />}
                  {m.role === "assistant" && !m.error && (
                    <div className="mt-2 flex justify-end"><CopyButton text={m.text} className="btn-ghost btn-sm" /></div>
                  )}
                </div>
              </div>
            ))
          )}
          {busy && (
            <div className="flex items-center gap-2 text-sm text-slate-400"><Spinner className="h-4 w-4" /> Thinking…</div>
          )}
          <div ref={endRef} />
        </div>

        <form onSubmit={(e) => { e.preventDefault(); ask(); }} className="flex gap-2 border-t border-white/10 p-3">
          <input className="input" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask about tasks, deadlines, priorities…" disabled={!integrations.ai} />
          <button className="btn-primary px-3" disabled={busy || !input.trim()} aria-label="Send"><SendHorizonal className="h-4 w-4" /></button>
        </form>
      </div>
    </>
  );
}
