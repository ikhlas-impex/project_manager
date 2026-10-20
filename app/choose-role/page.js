"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Briefcase, CheckCircle2, Clock, ShieldCheck, UserCheck, Workflow } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { api } from "@/lib/api";
import { Avatar, Spinner } from "@/components/ui";

export default function ChooseRolePage() {
  const { session, profile, refreshProfile, loading } = useAuth();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [pendingState, setPendingState] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!loading && !session) {
      router.replace("/login");
    }
  }, [loading, session, router]);

  if (loading || !session) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Spinner className="h-8 w-8 text-violet-400" />
      </div>
    );
  }

  async function handleSelect(role) {
    setError("");
    setSubmitting(true);
    try {
      const res = await api("/api/role/select", { role });
      await refreshProfile();
      if (role === "manager") {
        setPendingState(true);
      } else {
        router.replace("/dashboard");
      }
    } catch (err) {
      setError(err.message || "Failed to set role");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4 py-12">
      <div className="w-full max-w-3xl">
        <div className="mb-8 text-center">
          <span className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-violet-500 to-sky-500 shadow-xl shadow-violet-600/30">
            <Workflow className="h-7 w-7 text-white" />
          </span>
          <h1 className="text-3xl font-bold tracking-tight text-white">Select Your Workspace Role</h1>
          <p className="mt-2 text-sm text-slate-400">
            Welcome to TeamFlow. Choose how you will participate in the organization.
          </p>

          <div className="mt-4 inline-flex items-center gap-2.5 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-xs text-slate-300">
            {profile && <Avatar profile={profile} size={20} />}
            <span>Signed in as <strong className="text-white">{session.user.email}</strong></span>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-center text-sm text-rose-200">
            {error}
          </div>
        )}

        {pendingState ? (
          <div className="glass space-y-6 p-8 text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-amber-400/10 text-amber-300 ring-2 ring-amber-400/30">
              <Clock className="h-7 w-7" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Manager Request Submitted</h2>
              <p className="mx-auto mt-2 max-w-lg text-sm text-slate-300">
                Your request to become a <strong className="text-amber-300">Manager</strong> is now pending administrative approval from the admin portal.
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-xs text-slate-400">
              💡 In the meantime, you can explore and work on TeamFlow with standard <strong className="text-slate-200">Employee</strong> permissions. Your manager features will automatically activate once the admin approves your request.
            </div>
            <button
              onClick={() => router.replace("/dashboard")}
              className="btn-primary w-full max-w-xs py-2.5"
            >
              Enter Dashboard as Employee
            </button>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {/* Employee Card */}
            <div className="glass flex flex-col justify-between p-6 sm:p-7 transition-all duration-300 hover:border-emerald-500/40 hover:bg-white/[0.04]">
              <div>
                <div className="flex items-center justify-between">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/30">
                    <UserCheck className="h-5 w-5" />
                  </span>
                  <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-300">
                    Instant Access
                  </span>
                </div>
                <h2 className="mt-4 text-xl font-bold text-white">Employee</h2>
                <p className="mt-1 text-xs text-slate-400">
                  Ideal for team members completing tasks and sharing daily updates.
                </p>

                <ul className="mt-5 space-y-2.5 text-xs text-slate-300">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                    <span>Work on assigned tasks & update status</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                    <span>Post daily standup progress & summaries</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                    <span>Collaborate with teammates in real-time</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                    <span>No waiting for approval — start immediately</span>
                  </li>
                </ul>
              </div>

              <div className="mt-8 pt-4 border-t border-white/10">
                <button
                  disabled={submitting}
                  onClick={() => handleSelect("employee")}
                  className="btn w-full bg-emerald-600 text-white hover:bg-emerald-500 shadow-lg shadow-emerald-700/20 py-2.5 font-medium"
                >
                  {submitting ? <Spinner className="h-4 w-4 text-white" /> : <Briefcase className="h-4 w-4" />}
                  Select Employee (Instant)
                </button>
              </div>
            </div>

            {/* Manager Card */}
            <div className="glass flex flex-col justify-between p-6 sm:p-7 transition-all duration-300 hover:border-violet-500/40 hover:bg-white/[0.04]">
              <div>
                <div className="flex items-center justify-between">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-violet-500/10 text-violet-400 ring-1 ring-violet-500/30">
                    <ShieldCheck className="h-5 w-5" />
                  </span>
                  <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-0.5 text-[11px] font-semibold text-amber-300">
                    Admin Approval Required
                  </span>
                </div>
                <h2 className="mt-4 text-xl font-bold text-white">Manager</h2>
                <p className="mt-1 text-xs text-slate-400">
                  For project leads responsible for team workflow and oversight.
                </p>

                <ul className="mt-5 space-y-2.5 text-xs text-slate-300">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-violet-400" />
                    <span>Create & assign tasks across all team members</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-violet-400" />
                    <span>Oversee deadline calendar & team bottlenecks</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-violet-400" />
                    <span>Full access to team reports & AI productivity analysis</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Clock className="h-4 w-4 shrink-0 text-amber-400" />
                    <span>Requires master administrator approval to activate</span>
                  </li>
                </ul>
              </div>

              <div className="mt-8 pt-4 border-t border-white/10">
                <button
                  disabled={submitting}
                  onClick={() => handleSelect("manager")}
                  className="btn-primary w-full py-2.5"
                >
                  {submitting ? <Spinner className="h-4 w-4 text-white" /> : <ShieldCheck className="h-4 w-4" />}
                  Request Manager Access
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
