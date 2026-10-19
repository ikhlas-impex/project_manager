"use client";
import { useState } from "react";
import { Bot, Check, KeyRound, Mail, Save, UserRound } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { useData } from "@/components/DataProvider";
import { useToast } from "@/components/Toast";
import { Avatar, PageHeader, Spinner } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { sendEmail } from "@/lib/api";
import { AVATAR_COLORS } from "@/lib/format";

export default function ProfilePage() {
  const { profile, refreshProfile } = useAuth();
  const { integrations, reload } = useData();
  const toast = useToast();

  const [form, setForm] = useState({
    full_name: profile.full_name || "",
    notify_email: profile.notify_email || "",
    avatar_color: profile.avatar_color || AVATAR_COLORS[0],
  });
  const [saving, setSaving] = useState(false);
  const [pw, setPw] = useState({ next: "", confirm: "" });
  const [pwBusy, setPwBusy] = useState(false);
  const [testing, setTesting] = useState(false);

  async function saveProfile(e) {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: form.full_name.trim() || profile.username,
        notify_email: form.notify_email.trim() || null,
        avatar_color: form.avatar_color,
      })
      .eq("id", profile.id);
    setSaving(false);
    if (error) return toast(error.message, "error");
    await Promise.all([refreshProfile(), reload()]);
    toast("Profile saved");
  }

  async function changePassword(e) {
    e.preventDefault();
    if (pw.next.length < 6) return toast("Password must be at least 6 characters", "error");
    if (pw.next !== pw.confirm) return toast("Passwords don't match", "error");
    setPwBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw.next });
    setPwBusy(false);
    if (error) return toast(error.message, "error");
    setPw({ next: "", confirm: "" });
    toast("Password updated");
  }

  async function testEmail() {
    setTesting(true);
    try {
      await sendEmail({ to: form.notify_email, subject: "TeamFlow test email ✔", text: "Gmail is connected. You'll receive task notifications here." });
      toast("Test email sent — check your inbox");
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setTesting(false);
    }
  }

  const preview = { ...profile, ...form };

  return (
    <>
      <PageHeader title="Profile & settings" subtitle={`Signed in as @${profile.username} · ${profile.role}`} />

      <div className="grid gap-6 lg:grid-cols-2">
        <form onSubmit={saveProfile} className="glass space-y-5 p-5 sm:p-6">
          <h2 className="section-title flex items-center gap-2"><UserRound className="h-4 w-4 text-violet-300" /> Your details</h2>
          <div className="flex items-center gap-4">
            <Avatar profile={preview} size={56} />
            <div className="flex flex-wrap gap-2">
              {AVATAR_COLORS.map((c) => (
                <button key={c} type="button" onClick={() => setForm({ ...form, avatar_color: c })} className="grid h-7 w-7 place-items-center rounded-full ring-2 ring-white/10 transition hover:scale-110" style={{ background: c }} aria-label={`Colour ${c}`}>
                  {form.avatar_color === c && <Check className="h-3.5 w-3.5 text-white" />}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="label" htmlFor="p-name">Display name</label>
            <input id="p-name" className="input" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="Your full name" />
          </div>
          <div>
            <label className="label" htmlFor="p-email">Gmail for notifications</label>
            <input id="p-email" type="email" className="input" value={form.notify_email} onChange={(e) => setForm({ ...form, notify_email: e.target.value })} placeholder="you@gmail.com" />
            <p className="mt-1.5 text-xs text-slate-500">You&apos;ll get an email when a task is assigned to you, someone is waiting on you, or your task is completed.</p>
          </div>
          <div className="flex gap-2">
            <button disabled={saving} className="btn-primary">{saving ? <Spinner className="h-4 w-4 text-white" /> : <Save className="h-4 w-4" />} Save profile</button>
            {integrations.email && profile.notify_email && (
              <button type="button" onClick={testEmail} disabled={testing} className="btn-ghost">{testing ? <Spinner className="h-4 w-4" /> : <Mail className="h-4 w-4" />} Send test</button>
            )}
          </div>
        </form>

        <div className="space-y-6">
          <form onSubmit={changePassword} className="glass space-y-4 p-5 sm:p-6">
            <h2 className="section-title flex items-center gap-2"><KeyRound className="h-4 w-4 text-amber-300" /> Change password</h2>
            <div>
              <label className="label" htmlFor="pw1">New password</label>
              <input id="pw1" type="password" className="input" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} autoComplete="new-password" minLength={6} required />
            </div>
            <div>
              <label className="label" htmlFor="pw2">Confirm new password</label>
              <input id="pw2" type="password" className="input" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} autoComplete="new-password" required />
            </div>
            <button disabled={pwBusy} className="btn-primary">{pwBusy && <Spinner className="h-4 w-4 text-white" />} Update password</button>
          </form>

          <div className="glass space-y-3 p-5 sm:p-6">
            <h2 className="section-title">Integrations</h2>
            <Integration icon={Mail} name="Gmail" on={integrations.email} hint="Task notifications & emailing summaries/reports" />
            <Integration icon={Bot} name="Google Gemini" on={integrations.ai} hint="AI descriptions, summary polish, reports & assistant" />
          </div>
        </div>
      </div>
    </>
  );
}

function Integration({ icon: Icon, name, on, hint }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <Icon className="h-5 w-5 text-slate-300" />
      <div className="flex-1">
        <p className="text-sm font-medium">{name}</p>
        <p className="text-xs text-slate-500">{hint}</p>
      </div>
      <span className={`chip ${on ? "bg-emerald-400/10 text-emerald-300 ring-emerald-400/30" : "bg-slate-400/10 text-slate-400 ring-slate-400/20"}`}>
        {on ? "Connected" : "Not configured"}
      </span>
    </div>
  );
}
