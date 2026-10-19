"use client";
import { useEffect, useState } from "react";
import { Check, Copy, Loader2, X } from "lucide-react";
import { STATUS, PRIORITY, profileName, initials } from "@/lib/format";

export const Spinner = ({ className = "h-5 w-5" }) => <Loader2 className={`${className} animate-spin text-violet-300`} />;

export function Avatar({ profile, size = 28 }) {
  const name = profileName(profile);
  return (
    <span
      title={name}
      className="inline-grid shrink-0 place-items-center rounded-full font-semibold text-white ring-2 ring-white/10"
      style={{ width: size, height: size, fontSize: size * 0.38, background: profile?.avatar_color || "#475569" }}
    >
      {profile ? initials(name) : "?"}
    </span>
  );
}

export const StatusChip = ({ status }) => (
  <span className={`chip ${STATUS[status].chip}`}>
    <span className={`h-1.5 w-1.5 rounded-full ${STATUS[status].dot}`} />
    {STATUS[status].label}
  </span>
);

export const PriorityChip = ({ priority }) => <span className={`chip ${PRIORITY[priority].chip}`}>{PRIORITY[priority].label}</span>;

export function PageHeader({ title, subtitle, children }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-400">{subtitle}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

export function Modal({ open, onClose, title, children, wide }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className={`glass-strong fade-in max-h-[92vh] w-full overflow-y-auto rounded-b-none sm:rounded-2xl ${wide ? "sm:max-w-4xl" : "sm:max-w-lg"}`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-[#17142e]/90 px-5 py-4 backdrop-blur-xl">
          <h2 className="font-semibold text-white">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function Segmented({ value, onChange, options, disabled }) {
  return (
    <div className="flex flex-wrap gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          disabled={disabled}
          onClick={() => onChange(o.value)}
          className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
            value === o.value ? "bg-white/15 text-white shadow" : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function StatCard({ icon: Icon, label, value, hint, tone = "from-violet-500/30 to-indigo-500/10" }) {
  return (
    <div className="glass relative overflow-hidden p-4">
      <div className={`absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br ${tone} blur-2xl`} />
      <div className="relative flex items-center gap-2 text-xs font-medium text-slate-400">
        {Icon && <Icon className="h-4 w-4" />}
        {label}
      </div>
      <div className="relative mt-2 text-3xl font-bold text-white">{value}</div>
      {hint && <div className="relative mt-1 text-xs text-slate-400">{hint}</div>}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, text, children }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      {Icon && (
        <div className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-white/5 ring-1 ring-white/10">
          <Icon className="h-5 w-5 text-slate-400" />
        </div>
      )}
      <p className="font-medium text-slate-200">{title}</p>
      {text && <p className="mt-1 max-w-sm text-sm text-slate-400">{text}</p>}
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}

export function CopyButton({ text, label = "Copy", className = "btn-ghost" }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setDone(true);
    setTimeout(() => setDone(false), 1800);
  };
  return (
    <button type="button" onClick={copy} className={className}>
      {done ? <Check className="h-4 w-4 text-emerald-300" /> : <Copy className="h-4 w-4" />}
      {done ? "Copied!" : label}
    </button>
  );
}

// Renders the plain-text output from Gemini with light formatting.
export function RichText({ text }) {
  return (
    <div className="space-y-1.5 text-sm leading-relaxed text-slate-200">
      {text.split("\n").map((line, i) => {
        const clean = line.replace(/\*\*(.+?)\*\*/g, "$1").replace(/^#+\s*/, "");
        if (!clean.trim()) return <div key={i} className="h-2" />;
        const heading = /^#+\s/.test(line) || /^\*\*.+\*\*:?$/.test(line.trim()) || /^\d+\.\s+[A-Z][^.]{0,60}$/.test(line.trim());
        return (
          <p key={i} className={heading ? "pt-2 font-semibold text-white" : ""}>
            {clean.replace(/^\s*[-*]\s+/, "• ")}
          </p>
        );
      })}
    </div>
  );
}
