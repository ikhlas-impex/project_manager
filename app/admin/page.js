"use client";
import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Briefcase,
  Building2,
  Check,
  CheckCircle2,
  Clock,
  ExternalLink,
  Eye,
  EyeOff,
  Globe,
  Lock,
  LogOut,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  Sparkles,
  ShieldCheck,
  UserCheck,
  Users,
  Workflow,
  XCircle,
  Trash2,
} from "lucide-react";
import { Avatar, Spinner } from "@/components/ui";
import AdminAI from "@/components/AdminAI";
import AdminDepartments from "@/components/AdminDepartments";
import { formatDate } from "@/lib/format";

export default function AdminPage() {
  const [authChecked, setAuthChecked] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [loginBusy, setLoginBusy] = useState(false);

  const [data, setData] = useState(null);
  const [loadingData, setLoadingData] = useState(false);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("requests");
  const [actionBusy, setActionBusy] = useState(null); // id of item being processed
  const [toastMsg, setToastMsg] = useState(null);

  function showToast(msg, type = "success") {
    setToastMsg({ msg, type });
    setTimeout(() => setToastMsg(null), 4000);
  }

  // Check if admin session cookie exists
  async function checkAdminAuth() {
    try {
      const res = await fetch("/api/admin/auth");
      const d = await res.json();
      setAuthenticated(Boolean(d.authenticated));
      if (d.authenticated) {
        fetchAdminData();
      }
    } catch {
      setAuthenticated(false);
    } finally {
      setAuthChecked(true);
    }
  }

  useEffect(() => {
    checkAdminAuth();
  }, []);

  async function handleLogin(e) {
    e.preventDefault();
    setLoginError("");
    setLoginBusy(true);

    try {
      const res = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const d = await res.json();
      if (!res.ok) {
        throw new Error(d.error || "Incorrect admin password.");
      }
      setAuthenticated(true);
      fetchAdminData();
    } catch (err) {
      setLoginError(err.message);
    } finally {
      setLoginBusy(false);
    }
  }

  async function handleLogout() {
    await fetch("/api/admin/auth", { method: "DELETE" });
    setAuthenticated(false);
    setData(null);
    setPassword("");
  }

  async function fetchAdminData() {
    setLoadingData(true);
    try {
      const res = await fetch("/api/admin/data");
      if (!res.ok) {
        if (res.status === 401) {
          setAuthenticated(false);
          return;
        }
        throw new Error("Failed to load admin data");
      }
      const d = await res.json();
      setData(d);
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setLoadingData(false);
    }
  }

  async function approveManager(userId, name) {
    setActionBusy(userId);
    try {
      const res = await fetch("/api/admin/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Approval failed");
      showToast(`Approved ${name} as Manager!`, "success");
      fetchAdminData();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setActionBusy(null);
    }
  }

  async function rejectManager(userId, name) {
    setActionBusy(userId);
    try {
      const res = await fetch("/api/admin/reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Decline failed");
      showToast(`Manager request for ${name} declined. Retained as Employee.`, "info");
      fetchAdminData();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setActionBusy(null);
    }
  }

  async function switchRole(userId, newRole, name) {
    setActionBusy(userId);
    try {
      const res = await fetch("/api/admin/role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role: newRole }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Role update failed");
      showToast(`Updated role for ${name} to ${newRole}.`, "success");
      fetchAdminData();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setActionBusy(null);
    }
  }

  async function removeUser(userId, name) {
    if (!window.confirm(`Are you sure you want to remove ${name}? This will delete their account.`)) {
      return;
    }
    setActionBusy(userId);
    try {
      const res = await fetch("/api/admin/delete-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed to remove user");
      showToast(`User ${name} removed.`, "info");
      fetchAdminData();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setActionBusy(null);
    }
  }

  if (!authChecked) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Spinner className="h-8 w-8 text-violet-400" />
      </div>
    );
  }

  // --- 1. UN-AUTHENTICATED ADMIN LOGIN FORM ---
  if (!authenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <span className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-xl shadow-indigo-600/30">
              <Shield className="h-7 w-7 text-white" />
            </span>
            <h1 className="text-3xl font-bold tracking-tight text-white">Admin Portal</h1>
            <p className="mt-2 text-sm text-slate-400">
              Master administrative login for role approvals and security settings.
            </p>
          </div>

          <form onSubmit={handleLogin} className="glass space-y-4 p-6 sm:p-8">
            <div>
              <label className="label" htmlFor="admin-pw">
                Admin Password
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  id="admin-pw"
                  type={showPassword ? "text" : "password"}
                  className="input px-10"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter admin password"
                  autoComplete="current-password"
                  autoFocus
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {loginError && <p className="text-sm text-rose-300">{loginError}</p>}

            <button disabled={loginBusy} className="btn-primary w-full py-2.5">
              {loginBusy && <Spinner className="h-4 w-4 text-white" />} Access Admin Console
            </button>

            <div className="pt-2 text-center">
              <a
                href="/login"
                className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition"
              >
                <ArrowLeft className="h-3 w-3" /> Return to Employee Login
              </a>
            </div>
          </form>

          <p className="mt-6 text-center text-xs text-slate-500">
            Protected area. All actions and role approvals are recorded.
          </p>
        </div>
      </div>
    );
  }

  // --- 2. AUTHENTICATED ADMIN DASHBOARD ---
  const pendingRequests = data?.pendingRequests || [];
  const allUsers = data?.users || [];
  const stats = data?.stats || { totalUsers: 0, totalManagers: 0, totalEmployees: 0, pendingCount: 0 };
  const allowedDomains = data?.allowedDomains || ["impexappliances.com"];

  const filteredUsers = allUsers.filter(
    (u) =>
      u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase()) ||
      u.username?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#070612] text-slate-100 pb-20">
      {/* Toast Alert */}
      {toastMsg && (
        <div
          className={`fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-xl border px-4 py-3 text-sm shadow-2xl backdrop-blur-xl ${
            toastMsg.type === "error"
              ? "border-rose-500/40 bg-rose-950/90 text-rose-200"
              : toastMsg.type === "info"
              ? "border-sky-500/40 bg-sky-950/90 text-sky-200"
              : "border-emerald-500/40 bg-emerald-950/90 text-emerald-200"
          }`}
        >
          {toastMsg.type === "error" ? (
            <XCircle className="h-4 w-4" />
          ) : (
            <CheckCircle2 className="h-4 w-4" />
          )}
          <span>{toastMsg.msg}</span>
        </div>
      )}

      {/* Admin Top Navigation Bar */}
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#0c0a1f]/80 px-4 py-3.5 backdrop-blur-xl sm:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-md shadow-indigo-600/30">
              <Shield className="h-5 w-5 text-white" />
            </span>
            <div>
              <span className="font-bold text-white tracking-tight flex items-center gap-2">
                TeamFlow <span className="text-violet-400">Admin Console</span>
              </span>
              <p className="text-[11px] text-slate-400 hidden sm:block">Role Approvals & Domain Management</p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <a
              href="/dashboard"
              target="_blank"
              rel="noreferrer"
              className="btn-ghost btn-sm text-xs gap-1.5 hidden sm:inline-flex"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Open App
            </a>
            <button
              onClick={fetchAdminData}
              disabled={loadingData}
              className="btn-ghost btn-sm p-2"
              title="Refresh data"
            >
              <RefreshCw className={`h-4 w-4 ${loadingData ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={handleLogout}
              className="btn-ghost btn-sm text-rose-300 hover:text-rose-200 gap-1.5"
            >
              <LogOut className="h-3.5 w-3.5" /> Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 pt-8 sm:px-8">
        {/* Metric Cards */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div className="glass p-5">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-medium">Pending Approvals</span>
              <Clock className="h-4 w-4 text-amber-400" />
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-white">{stats.pendingCount}</span>
              {stats.pendingCount > 0 && (
                <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                  Needs Review
                </span>
              )}
            </div>
          </div>

          <div className="glass p-5">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-medium">Total Team Members</span>
              <Users className="h-4 w-4 text-sky-400" />
            </div>
            <p className="mt-3 text-3xl font-extrabold text-white">{stats.totalUsers}</p>
          </div>

          <div className="glass p-5">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-medium">Active Managers</span>
              <ShieldCheck className="h-4 w-4 text-violet-400" />
            </div>
            <p className="mt-3 text-3xl font-extrabold text-white">{stats.totalManagers}</p>
          </div>

          <div className="glass p-5">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-medium">Active Employees</span>
              <UserCheck className="h-4 w-4 text-emerald-400" />
            </div>
            <p className="mt-3 text-3xl font-extrabold text-white">{stats.totalEmployees}</p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="mt-8 flex flex-wrap gap-2 border-b border-white/10 pb-2">
          <button
            onClick={() => setActiveTab("requests")}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition ${
              activeTab === "requests"
                ? "bg-white/10 text-white shadow-inner ring-1 ring-white/10"
                : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
            }`}
          >
            <ShieldAlert className="h-4 w-4 text-amber-400" />
            <span>Manager Requests</span>
            {pendingRequests.length > 0 && (
              <span className="rounded-full bg-amber-500/30 px-2 py-0.2 text-[10px] font-bold text-amber-300">
                {pendingRequests.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("users")}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition ${
              activeTab === "users"
                ? "bg-white/10 text-white shadow-inner ring-1 ring-white/10"
                : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
            }`}
          >
            <Users className="h-4 w-4 text-violet-400" />
            <span>All Members ({allUsers.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("security")}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition ${
              activeTab === "security"
                ? "bg-white/10 text-white shadow-inner ring-1 ring-white/10"
                : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
            }`}
          >
            <Globe className="h-4 w-4 text-emerald-400" />
            <span>Domain & Security</span>
          </button>

          <button
            onClick={() => setActiveTab("departments")}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition ${
              activeTab === "departments"
                ? "bg-white/10 text-white shadow-inner ring-1 ring-white/10"
                : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
            }`}
          >
            <Building2 className="h-4 w-4 text-sky-400" />
            <span>Departments</span>
          </button>

          <button
            onClick={() => setActiveTab("ai")}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition ${
              activeTab === "ai"
                ? "bg-white/10 text-white shadow-inner ring-1 ring-white/10"
                : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
            }`}
          >
            <Sparkles className="h-4 w-4 text-fuchsia-400" />
            <span>AI (Gemini)</span>
          </button>
        </div>

        {/* Tab: DEPARTMENTS, MEMBERS, ACCESS & ROLE NAMES */}
        {activeTab === "departments" && <AdminDepartments notify={showToast} onChanged={fetchAdminData} />}

        {/* Tab 4: GEMINI KEYS, MODELS & USAGE */}
        {activeTab === "ai" && <AdminAI notify={showToast} />}

        {/* Tab 1: MANAGER APPROVAL REQUESTS */}
        {activeTab === "requests" && (
          <div className="mt-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">Pending Manager Requests</h2>
                <p className="text-xs text-slate-400">
                  Employees who requested the Manager role require your administrative approval.
                </p>
              </div>
            </div>

            {loadingData && !data ? (
              <div className="glass p-12 text-center">
                <Spinner className="mx-auto h-7 w-7 text-violet-400" />
                <p className="mt-3 text-xs text-slate-400">Loading requests...</p>
              </div>
            ) : pendingRequests.length === 0 ? (
              <div className="glass p-12 text-center">
                <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-400/60" />
                <h3 className="mt-3 text-base font-semibold text-white">No pending requests</h3>
                <p className="mt-1 text-xs text-slate-400 max-w-sm mx-auto">
                  All employee role selections are up to date. When an employee requests manager access, it will show up here.
                </p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {pendingRequests.map((u) => {
                  const busy = actionBusy === u.id;
                  return (
                    <div
                      key={u.id}
                      className="glass flex flex-col justify-between p-5 border-amber-500/30 bg-amber-500/[0.02]"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <Avatar profile={u} size={42} />
                            <div>
                              <p className="font-semibold text-white text-sm">{u.full_name}</p>
                              <p className="text-xs text-slate-400">{u.email}</p>
                            </div>
                          </div>
                          <span className="rounded-full bg-amber-400/10 px-2.5 py-0.5 text-[11px] font-medium text-amber-300 border border-amber-400/20">
                            Requested Manager
                          </span>
                        </div>

                        {u.manager_requested_at && (
                          <p className="mt-3 text-[11px] text-slate-400 flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5 text-slate-500" />
                            Requested on: {new Date(u.manager_requested_at).toLocaleString()}
                          </p>
                        )}
                      </div>

                      <div className="mt-6 flex gap-2 border-t border-white/10 pt-4">
                        <button
                          disabled={busy}
                          onClick={() => approveManager(u.id, u.full_name)}
                          className="btn flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-2 text-xs font-semibold shadow-lg shadow-emerald-700/20"
                        >
                          {busy ? <Spinner className="h-3.5 w-3.5 text-white" /> : <Check className="h-3.5 w-3.5" />}
                          Approve Manager
                        </button>
                        <button
                          disabled={busy}
                          onClick={() => rejectManager(u.id, u.full_name)}
                          className="btn flex-1 bg-white/5 hover:bg-white/10 text-rose-300 py-2 text-xs font-semibold border border-rose-500/30"
                        >
                          <XCircle className="h-3.5 w-3.5" /> Decline
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: ALL TEAM MEMBERS & ROLES */}
        {activeTab === "users" && (
          <div className="mt-6 space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-white">Team Directory & Roles</h2>
                <p className="text-xs text-slate-400">
                  Manage individual roles for any employee or manager in the organization.
                </p>
              </div>

              <div className="relative w-full sm:w-72">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  className="input pl-9 text-xs"
                  placeholder="Search by name, email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="glass overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-white/10 bg-white/[0.02] text-slate-400">
                    <tr>
                      <th className="px-5 py-3 font-semibold">User</th>
                      <th className="px-5 py-3 font-semibold">Email</th>
                      <th className="px-5 py-3 font-semibold">Current Role</th>
                      <th className="px-5 py-3 font-semibold">Approval Status</th>
                      <th className="px-5 py-3 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-5 py-8 text-center text-slate-400">
                          No users found matching your search.
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map((u) => {
                        const busy = actionBusy === u.id;
                        const isManager = u.role === "manager";
                        return (
                          <tr key={u.id} className="hover:bg-white/[0.02] transition">
                            <td className="px-5 py-3.5">
                              <div className="flex items-center gap-3">
                                <Avatar profile={u} size={32} />
                                <div>
                                  <p className="font-semibold text-white">{u.full_name}</p>
                                  <p className="text-[11px] text-slate-500">@{u.username}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-5 py-3.5 text-slate-300 font-mono text-[11px]">
                              {u.email}
                            </td>
                            <td className="px-5 py-3.5">
                              <span
                                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                                  isManager
                                    ? "bg-violet-400/10 text-violet-300 ring-1 ring-violet-400/30"
                                    : "bg-emerald-400/10 text-emerald-300 ring-1 ring-emerald-400/30"
                                }`}
                              >
                                {isManager ? (
                                  <ShieldCheck className="h-3 w-3" />
                                ) : (
                                  <Briefcase className="h-3 w-3" />
                                )}
                                {u.role}
                              </span>
                            </td>
                            <td className="px-5 py-3.5">
                              {u.manager_request_status === "pending" ? (
                                <span className="rounded-md bg-amber-400/10 px-2 py-0.5 text-[10px] font-semibold text-amber-300 border border-amber-400/20">
                                  Pending Approval
                                </span>
                              ) : u.manager_request_status === "approved" ? (
                                <span className="text-[10px] text-emerald-400">Approved</span>
                              ) : (
                                <span className="text-[10px] text-slate-500">Standard</span>
                              )}
                            </td>
                            <td className="px-5 py-3.5 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {isManager ? (
                                  <button
                                    disabled={busy}
                                    onClick={() => switchRole(u.id, "employee", u.full_name)}
                                    className="btn-ghost btn-sm text-[11px] hover:text-amber-300"
                                  >
                                    {busy ? <Spinner className="h-3 w-3" /> : "Demote to Employee"}
                                  </button>
                                ) : (
                                  <button
                                    disabled={busy}
                                    onClick={() => switchRole(u.id, "manager", u.full_name)}
                                    className="btn-ghost btn-sm text-[11px] text-violet-300 hover:text-violet-200 hover:bg-violet-500/10"
                                  >
                                    {busy ? <Spinner className="h-3 w-3" /> : "Promote to Manager"}
                                  </button>
                                )}
                                <button
                                  disabled={busy}
                                  onClick={() => removeUser(u.id, u.full_name)}
                                  className="btn-ghost btn-sm p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10"
                                  title={`Remove ${u.full_name}`}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: DOMAIN & SECURITY SETTINGS */}
        {activeTab === "security" && (
          <div className="mt-6 space-y-6 max-w-4xl">
            <div>
              <h2 className="text-lg font-bold text-white">Google Workspace Domain & Security</h2>
              <p className="text-xs text-slate-400">
                Configuration enforcing that only employees inside your domain can log in.
              </p>
            </div>

            <div className="glass p-6 space-y-4">
              <div className="flex items-start gap-4">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/30">
                  <Globe className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-white">Authorized Google Domains</h3>
                  <p className="mt-1 text-xs text-slate-400">
                    Employees signing in through the Google login portal must possess an email ending with these domains:
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {allowedDomains.map((dom) => (
                      <span
                        key={dom}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 font-mono text-xs font-semibold text-emerald-300"
                      >
                        <Check className="h-3.5 w-3.5" /> @{dom}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-xs text-slate-300 space-y-2">
                <p>
                  🔒 <strong>Domain Enforcement Rule:</strong> When someone signs in via Google, their email domain is strictly verified before access is granted. Any account outside the permitted domain is rejected with a clear explanation.
                </p>
                <p className="text-slate-400">
                  To modify or add domains, you can update the <code className="text-violet-300 font-mono">ALLOWED_EMAIL_DOMAIN</code> variable in your server environment (or Vercel settings).
                </p>
              </div>
            </div>

            <div className="glass p-6 space-y-4">
              <div className="flex items-start gap-4">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-violet-500/10 text-violet-400 ring-1 ring-violet-500/30">
                  <Lock className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-white">Admin Master Password</h3>
                  <p className="mt-1 text-xs text-slate-400">
                    This separate Admin page is protected by the master password <code className="text-violet-300 font-mono">Ikhlas@123</code>.
                  </p>
                  <p className="mt-2 text-xs text-slate-500">
                    You can override this in production by setting the <code className="text-violet-300 font-mono">ADMIN_PASSWORD</code> environment variable.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
