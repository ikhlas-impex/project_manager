"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Briefcase,
  CheckCircle2,
  Clock,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  UserCheck,
  Workflow,
} from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { api } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { Avatar, Spinner } from "@/components/ui";

export default function ChooseRolePage() {
  const { session, profile, refreshProfile, loading } = useAuth();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [pendingState, setPendingState] = useState(false);
  const [approvedState, setApprovedState] = useState(false);
  const [checkingManual, setCheckingManual] = useState(false);
  const [error, setError] = useState("");
  const [statusNote, setStatusNote] = useState("");
  const [departments, setDepartments] = useState([]);
  const [departmentId, setDepartmentId] = useState("");
  const [roleTitle, setRoleTitle] = useState("");
  const pollTimerRef = useRef(null);

  // Departments to choose from (managed by the admin)
  useEffect(() => {
    if (!session) return;
    supabase.from("departments").select("id, name").order("name").then(({ data }) => {
      setDepartments(data || []);
      if (data?.length === 1) setDepartmentId(data[0].id);
    });
  }, [session]);

  useEffect(() => {
    if (profile?.department_id) setDepartmentId(profile.department_id);
    if (profile?.role_title) setRoleTitle(profile.role_title);
  }, [profile?.department_id, profile?.role_title]);

  // If already a manager, immediately go to dashboard
  useEffect(() => {
    if (!loading && session && profile?.role === "manager") {
      window.location.replace("/dashboard");
    }
  }, [loading, session, profile]);

  // Auth redirect
  useEffect(() => {
    if (!loading && !session) {
      router.replace("/login");
    }
  }, [loading, session, router]);

  // Check initial role status on mount to see if user has a pending request or is already approved
  const checkStatus = useCallback(async (isManual = false) => {
    if (isManual) setCheckingManual(true);
    try {
      const res = await fetch("/api/role/status");
      if (!res.ok) return;
      const data = await res.json();

      if (data.role === "manager" || data.is_manager) {
        // User is accepted as manager!
        setApprovedState(true);
        if (pollTimerRef.current) clearInterval(pollTimerRef.current);
        await refreshProfile();
        setTimeout(() => {
          window.location.replace("/dashboard");
        }, 1200);
      } else if (data.manager_request_status === "pending") {
        setPendingState(true);
        if (isManual) {
          setStatusNote("Your request is still awaiting administrator approval.");
          setTimeout(() => setStatusNote(""), 3500);
        }
      }
    } catch (err) {
      console.warn("Status check failed:", err);
    } finally {
      if (isManual) setCheckingManual(false);
    }
  }, [refreshProfile]);

  useEffect(() => {
    if (session) {
      const meta = session.user?.user_metadata || {};
      if (meta.manager_request_status === "pending") {
        setPendingState(true);
      }
      checkStatus(false);
    }
  }, [session, checkStatus]);

  // Live Auto-Polling while in pendingState
  useEffect(() => {
    if (!pendingState || approvedState) {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      return;
    }

    const runPoll = () => checkStatus(false);

    // Poll every 2 seconds for immediate reaction
    pollTimerRef.current = setInterval(runPoll, 2000);

    const onVisibility = () => {
      if (document.visibilityState === "visible") runPoll();
    };
    window.addEventListener("focus", runPoll);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      window.removeEventListener("focus", runPoll);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [pendingState, approvedState, checkStatus]);

  if (loading || !session) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Spinner className="h-8 w-8 text-violet-400" />
      </div>
    );
  }

  async function handleSelect(role) {
    setError("");
    if (departments.length && !departmentId) {
      setError("Please choose your department first.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await api("/api/role/select", { role, department_id: departmentId || null, role_title: roleTitle });
      await refreshProfile();
      if (role === "manager") {
        setPendingState(true);
        // Immediately kick off live check
        checkStatus(false);
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

        {/* State 1: Approved celebration & auto-redirect */}
        {approvedState ? (
          <div className="glass space-y-6 p-8 text-center border-emerald-500/40 bg-emerald-950/20 shadow-2xl shadow-emerald-900/30 animate-in fade-in zoom-in-95 duration-300">
            <div className="relative mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-400 text-white shadow-xl shadow-emerald-500/40">
              <Sparkles className="h-8 w-8 animate-pulse" />
            </div>
            <div>
              <span className="inline-block rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-300 border border-emerald-400/30 mb-2">
                Approval Confirmed
              </span>
              <h2 className="text-2xl font-bold text-white">Manager Access Approved!</h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-slate-300">
                Your manager privileges have been activated. Opening your Manager Dashboard now...
              </p>
            </div>
            <div className="mx-auto flex max-w-xs items-center justify-center gap-3 rounded-xl border border-emerald-400/20 bg-emerald-500/10 py-3 text-xs text-emerald-200">
              <Spinner className="h-4 w-4 text-emerald-300" />
              <span>Launching Workspace...</span>
            </div>
          </div>
        ) : pendingState ? (
          /* State 2: Waiting for admin approval with live poller */
          <div className="glass space-y-6 p-8 text-center border-amber-500/30">
            <div className="relative mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/10 text-amber-300 ring-2 ring-amber-400/30">
              <Clock className="h-8 w-8" />
              <span className="absolute -top-1 -right-1 flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-4 w-4 bg-amber-500"></span>
              </span>
            </div>

            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs font-medium text-amber-300 mb-2">
                <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                Live Status: Awaiting Administrator Approval
              </div>
              <h2 className="text-xl font-bold text-white">Manager Request Submitted</h2>
              <p className="mx-auto mt-2 max-w-lg text-sm text-slate-300">
                Your request to become a <strong className="text-amber-300">Manager</strong> is currently pending in the Master Admin Portal.
              </p>
            </div>

            {/* Live radar badge */}
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-xs text-slate-400 space-y-2">
              <div className="flex items-center justify-center gap-2 text-violet-300 font-medium">
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                <span>Auto-detecting approval live (this page will open automatically once approved)</span>
              </div>
              <p className="text-[11px] text-slate-400">
                In the meantime, you can explore TeamFlow with standard Employee access or keep this window open.
              </p>
            </div>

            {statusNote && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-200">
                {statusNote}
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <button
                type="button"
                disabled={checkingManual}
                onClick={() => checkStatus(true)}
                className="btn-ghost w-full sm:w-auto text-xs px-4 py-2 text-slate-300 hover:text-white border border-white/10"
              >
                {checkingManual ? (
                  <Spinner className="h-3.5 w-3.5" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
                Check Status Now
              </button>

              <button
                onClick={() => router.replace("/dashboard")}
                className="btn-primary w-full sm:w-auto px-5 py-2.5 text-xs font-medium"
              >
                Enter Dashboard as Employee
              </button>
            </div>
          </div>
        ) : (
          /* State 3: Selection cards */
          <>
          {departments.length > 0 && (
            <div className="glass mb-6 grid gap-4 p-5 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="cr-dept">Your department</label>
                <select id="cr-dept" className="input" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
                  <option value="">Select department…</option>
                  {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="cr-title">Role name (optional)</label>
                <input id="cr-title" className="input" value={roleTitle} onChange={(e) => setRoleTitle(e.target.value)} placeholder="e.g. Sales Executive" maxLength={60} />
              </div>
            </div>
          )}
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
          </>
        )}
      </div>
    </div>
  );
}
