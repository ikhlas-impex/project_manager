"use client";
import { useEffect, useState } from "react";
import { Bot, Check, Clock, KeyRound, Link2Off, Mail, Save, ShieldCheck, UserRound } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { useData } from "@/components/DataProvider";
import { useToast } from "@/components/Toast";
import { Avatar, PageHeader, Spinner } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { api, sendEmail } from "@/lib/api";
import { AVATAR_COLORS } from "@/lib/format";

const GMAIL_RESULTS = {
  connected: ["Gmail connected — emails will now be sent from your account", "success"],
  denied: ["Gmail connection was cancelled", "info"],
  scope: ["Please tick “Send email on your behalf” when connecting Gmail", "error"],
  expired: ["The Google sign-in link expired, please try again", "error"],
  error: ["Couldn't connect Gmail. Please try again.", "error"],
};

export default function ProfilePage() {
  const { profile, refreshProfile, session } = useAuth();
  const { integrations, reload } = useData();
  const toast = useToast();
  const [roleBusy, setRoleBusy] = useState(false);

  const [form, setForm] = useState({
    full_name: profile.full_name || "",
    notify_email: profile.notify_email || "",
    avatar_color: profile.avatar_color || AVATAR_COLORS[0],
  });
  const [saving, setSaving] = useState(false);
  const [pw, setPw] = useState({ next: "", confirm: "" });
  const [pwBusy, setPwBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [gBusy, setGBusy] = useState(false);

  // Result of the Google redirect: /profile?gmail=connected
  useEffect(() => {
    const result = new URLSearchParams(window.location.search).get("gmail");
    if (!result) return;
    const [msg, type] = GMAIL_RESULTS[result] || GMAIL_RESULTS.error;
    toast(msg, type);
    window.history.replaceState(null, "", "/profile");
  }, [toast]);

  async function connectGmail() {
    setGBusy(true);
    try {
      const { url } = await api("/api/google/connect", {});
      window.location.href = url;
    } catch (err) {
      toast(err.message, "error");
      setGBusy(false);
    }
  }

  async function disconnectGmail() {
    setGBusy(true);
    try {
      await api("/api/google/disconnect", {});
      await refreshProfile();
      toast("Gmail disconnected", "info");
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setGBusy(false);
    }
  }

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

  async function requestManagerRole() {
    setRoleBusy(true);
    try {
      await api("/api/role/select", { role: "manager" });
      await refreshProfile();
      toast("Manager request submitted to Admin for approval!", "info");
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setRoleBusy(false);
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
          {/* Workspace Role Card */}
          <div className="glass space-y-4 p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <h2 className="section-title flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-violet-300" /> Workspace Role
              </h2>
              <span className={`chip capitalize ${profile.role === "manager" ? "bg-violet-400/10 text-violet-300 ring-violet-400/30" : "bg-emerald-400/10 text-emerald-300 ring-emerald-400/30"}`}>
                {profile.role}
              </span>
            </div>

            {profile.role === "manager" ? (
              <p className="text-xs text-slate-400">
                You have administrative manager authority to assign tasks, supervise deadlines, and access team analytics.
              </p>
            ) : session?.user?.user_metadata?.manager_request_status === "pending" ? (
              <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-3.5 text-xs text-amber-200 space-y-1.5">
                <div className="flex items-center gap-2 font-semibold">
                  <Clock className="h-4 w-4 text-amber-400" />
                  Manager Request Pending Approval
                </div>
                <p className="text-slate-300">
                  Your upgrade request to become a Manager is awaiting review by the administrator on the Admin Portal.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-slate-400">
                  You are currently an <strong>Employee</strong>. If you need authority to manage projects and assign tasks to teammates, you can request manager access.
                </p>
                <button
                  type="button"
                  disabled={roleBusy}
                  onClick={requestManagerRole}
                  className="btn-ghost btn-sm text-violet-300 hover:text-violet-200 hover:bg-violet-500/10 gap-1.5"
                >
                  {roleBusy ? <Spinner className="h-3.5 w-3.5" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                  Request Upgrade to Manager
                </button>
              </div>
            )}
          </div>

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

          <div className="glass relative space-y-4 overflow-hidden p-5 sm:p-6">
            <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-br from-rose-500/30 via-amber-400/20 to-sky-500/20 blur-2xl" />
            <h2 className="section-title relative flex items-center gap-2"><GoogleIcon /> Gmail</h2>
            {profile.gmail_address ? (
              <div className="relative flex flex-wrap items-center gap-3 rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-3">
                <Check className="h-5 w-5 text-emerald-300" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{profile.gmail_address}</p>
                  <p className="text-xs text-slate-400">Emails you send from TeamFlow come from this account.</p>
                </div>
                <button onClick={disconnectGmail} disabled={gBusy} className="btn-ghost btn-sm"><Link2Off className="h-3.5 w-3.5" /> Disconnect</button>
              </div>
            ) : integrations.google ? (
              <div className="relative space-y-3">
                <p className="text-sm text-slate-400">Connect your Google account so task notifications, summaries and reports are sent <span className="text-slate-200">from your own Gmail</span>.</p>
                <button onClick={connectGmail} disabled={gBusy} className="btn w-full bg-white py-2.5 text-slate-800 shadow-lg hover:bg-slate-100">
                  {gBusy ? <Spinner className="h-4 w-4" /> : <GoogleIcon />} Connect with Google
                </button>
                <p className="text-[11px] text-slate-500">TeamFlow only asks for permission to <em>send</em> email. It can&apos;t read your inbox.</p>
              </div>
            ) : (
              <p className="relative text-xs text-slate-400">Google sign-in isn&apos;t configured on the server yet (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET).</p>
            )}
          </div>

          <div className="glass space-y-3 p-5 sm:p-6">
            <h2 className="section-title">Integrations</h2>
            <Integration icon={Mail} name="Email sending" on={integrations.email} hint={profile.gmail_address ? `From ${profile.gmail_address}` : "Connect Gmail above to send from your account"} />
            <Integration icon={Bot} name="Google Gemini" on={integrations.ai} hint="AI descriptions, summary polish, reports & assistant" />
          </div>
        </div>
      </div>
    </>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" className="h-4 w-4" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
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
