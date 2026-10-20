"use client";
import { useEffect, useState } from "react";
import { Bot, Check, Link2Off, Mail, Save, UserRound } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { useData } from "@/components/DataProvider";
import { useToast } from "@/components/Toast";
import { Avatar, PageHeader, Spinner } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { api } from "@/lib/api";
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

  const [form, setForm] = useState({
    full_name: profile?.full_name || "",
    avatar_color: profile?.avatar_color || AVATAR_COLORS[0],
  });
  const [saving, setSaving] = useState(false);
  const [gBusy, setGBusy] = useState(false);

  const notify = (msg, type = "success") => {
    if (typeof toast === "function") {
      toast(msg, type);
    }
  };

  useEffect(() => {
    if (profile) {
      setForm({
        full_name: profile.full_name || "",
        avatar_color: profile.avatar_color || AVATAR_COLORS[0],
      });
    }
  }, [profile]);

  // Result of the Google redirect: /profile?gmail=connected
  useEffect(() => {
    if (typeof window === "undefined") return;
    const result = new URLSearchParams(window.location.search).get("gmail");
    if (!result) return;
    const [msg, type] = GMAIL_RESULTS[result] || GMAIL_RESULTS.error;
    notify(msg, type);
    window.history.replaceState(null, "", "/profile");
  }, []);

  if (!profile) {
    return (
      <div className="grid h-64 place-items-center">
        <Spinner className="h-7 w-7" />
      </div>
    );
  }

  async function connectGmail() {
    setGBusy(true);
    try {
      const { url } = await api("/api/google/connect", {});
      if (url) {
        window.location.href = url;
      }
    } catch (err) {
      notify(err.message || "Failed to initiate Gmail connection", "error");
      setGBusy(false);
    }
  }

  async function disconnectGmail() {
    setGBusy(true);
    try {
      await api("/api/google/disconnect", {});
      if (typeof refreshProfile === "function") await refreshProfile();
      notify("Gmail disconnected", "info");
    } catch (err) {
      notify(err.message || "Failed to disconnect Gmail", "error");
    } finally {
      setGBusy(false);
    }
  }

  async function saveProfile(e) {
    e.preventDefault();
    if (!profile?.id) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: form.full_name.trim() || profile.username || "User",
          avatar_color: form.avatar_color,
        })
        .eq("id", profile.id);
      if (error) throw error;
      if (typeof refreshProfile === "function") await refreshProfile();
      if (typeof reload === "function") await reload();
      notify("Profile saved", "success");
    } catch (err) {
      notify(err.message || "Failed to save profile", "error");
    } finally {
      setSaving(false);
    }
  }

  const preview = { ...(profile || {}), ...form };
  const emailAddress =
    profile.notify_email || profile.gmail_address || session?.user?.email || "";

  return (
    <>
      <PageHeader
        title="Profile & settings"
        subtitle={`Signed in as @${profile?.username || "user"} · ${profile?.role || "employee"}`}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left Column: Personal details */}
        <form onSubmit={saveProfile} className="glass space-y-5 p-5 sm:p-6">
          <h2 className="section-title flex items-center gap-2">
            <UserRound className="h-4 w-4 text-violet-300" /> Your details
          </h2>

          <div className="flex items-center gap-4">
            <Avatar profile={preview} size={56} />
            <div className="flex flex-wrap gap-2">
              {AVATAR_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setForm({ ...form, avatar_color: c })}
                  className="grid h-7 w-7 place-items-center rounded-full ring-2 ring-white/10 transition hover:scale-110"
                  style={{ background: c }}
                  aria-label={`Colour ${c}`}
                >
                  {form.avatar_color === c && <Check className="h-3.5 w-3.5 text-white" />}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label" htmlFor="p-name">
              Display name
            </label>
            <input
              id="p-name"
              className="input"
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              placeholder="Your full name"
            />
          </div>

          <div>
            <label className="label">Google Workspace Account</label>
            <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-xs text-slate-300">
              <span className="font-mono text-slate-200">{emailAddress}</span>
              <span className="chip bg-emerald-400/10 text-emerald-300 ring-emerald-400/30">
                Verified
              </span>
            </div>
            <p className="mt-1.5 text-[11px] text-slate-500">
              Linked via Google Workspace login. Notifications are delivered to this email.
            </p>
          </div>

          <div className="flex gap-2 pt-2">
            <button disabled={saving} className="btn-primary">
              {saving ? <Spinner className="h-4 w-4 text-white" /> : <Save className="h-4 w-4" />}
              Save profile
            </button>
          </div>
        </form>

        {/* Right Column: Integrations */}
        <div className="space-y-6">
          {/* Gmail Sending Connection */}
          <div className="glass relative space-y-4 overflow-hidden p-5 sm:p-6">
            <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-br from-rose-500/30 via-amber-400/20 to-sky-500/20 blur-2xl" />
            <h2 className="section-title relative flex items-center gap-2">
              <GoogleIcon /> Gmail Integration
            </h2>
            {profile.gmail_address ? (
              <div className="relative flex flex-wrap items-center gap-3 rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-3">
                <Check className="h-5 w-5 text-emerald-300" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{profile.gmail_address}</p>
                  <p className="text-xs text-slate-400">
                    Emails and task updates you trigger are sent from this account.
                  </p>
                </div>
                <button
                  onClick={disconnectGmail}
                  disabled={gBusy}
                  className="btn-ghost btn-sm"
                >
                  <Link2Off className="h-3.5 w-3.5" /> Disconnect
                </button>
              </div>
            ) : integrations?.google ? (
              <div className="relative space-y-3">
                <p className="text-sm text-slate-400">
                  Connect your Google account so task notifications and summaries are sent{" "}
                  <span className="text-slate-200">from your corporate Gmail</span>.
                </p>
                <button
                  onClick={connectGmail}
                  disabled={gBusy}
                  className="btn w-full bg-white py-2.5 text-slate-800 shadow-lg hover:bg-slate-100"
                >
                  {gBusy ? <Spinner className="h-4 w-4" /> : <GoogleIcon />} Connect with Google
                </button>
                <p className="text-[11px] text-slate-500">
                  TeamFlow only asks for permission to <em>send</em> emails. It cannot read your inbox.
                </p>
              </div>
            ) : (
              <p className="relative text-xs text-slate-400">
                Google sign-in is not configured on the server yet.
              </p>
            )}
          </div>

          {/* System Integrations */}
          <div className="glass space-y-3 p-5 sm:p-6">
            <h2 className="section-title">Integrations</h2>
            <Integration
              icon={Mail}
              name="Email sending"
              on={integrations?.email}
              hint={
                profile.gmail_address
                  ? `From ${profile.gmail_address}`
                  : "Connect Gmail above to send from your account"
              }
            />
            <Integration
              icon={Bot}
              name="Google Gemini"
              on={integrations?.ai}
              hint="AI task descriptions, summary polish & assistant"
            />
          </div>
        </div>
      </div>
    </>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" className="h-4 w-4" aria-hidden>
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"
      />
    </svg>
  );
}

function Integration({ icon: Icon, name, on, hint }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
      {Icon && <Icon className="h-5 w-5 text-slate-300" />}
      <div className="flex-1">
        <p className="text-sm font-medium">{name}</p>
        <p className="text-xs text-slate-500">{hint}</p>
      </div>
      <span
        className={`chip ${
          on
            ? "bg-emerald-400/10 text-emerald-300 ring-emerald-400/30"
            : "bg-slate-400/10 text-slate-400 ring-slate-400/20"
        }`}
      >
        {on ? "Connected" : "Not configured"}
      </span>
    </div>
  );
}
