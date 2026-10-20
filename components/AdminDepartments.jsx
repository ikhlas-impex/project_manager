"use client";
import { useCallback, useEffect, useState } from "react";
import { Building2, Check, Pencil, Plus, Trash2, Users, X } from "lucide-react";
import { Avatar, Spinner } from "./ui";
import { profileName } from "@/lib/format";

async function call(path, body) {
  const res = await fetch(path, {
    method: body ? "POST" : "GET",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export default function AdminDepartments({ notify, onChanged }) {
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [newName, setNewName] = useState("");
  const [editing, setEditing] = useState(null); // { id, name }
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [titles, setTitles] = useState({});
  const [busy, setBusy] = useState(null);
  const [filter, setFilter] = useState("all");

  const load = useCallback(async () => {
    try {
      const d = await call("/api/admin/departments");
      setData(d);
      setTitles(Object.fromEntries(d.members.map((m) => [m.id, m.role_title || ""])));
      setLoadError("");
    } catch (e) {
      setLoadError(e.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function run(id, path, body, success) {
    setBusy(id);
    try {
      await call(path, body);
      if (success) notify(success);
      await load();
      onChanged?.();
      return true;
    } catch (e) {
      notify(e.message, "error");
      return false;
    } finally {
      setBusy(null);
    }
  }

  if (loadError) return <div className="glass mt-6 p-6 text-sm text-rose-200">{loadError}</div>;
  if (!data) return <div className="grid h-40 place-items-center"><Spinner className="h-6 w-6" /></div>;

  const countIn = (id) => data.members.filter((m) => m.department_id === id).length;
  const managersIn = (id) => data.members.filter((m) => m.department_id === id && m.role === "manager");
  const unassigned = data.members.filter((m) => !m.department_id);
  const shown = data.members.filter((m) => filter === "all" || (filter === "none" ? !m.department_id : m.department_id === filter));

  return (
    <div className="mt-6 space-y-6">
      <div>
        <h2 className="text-lg font-bold text-white">Departments</h2>
        <p className="text-xs text-slate-400">
          Each person belongs to one department. Managers see and manage the work of their own department only; employees see only their own work.
        </p>
      </div>

      {/* ---------- department cards ---------- */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {data.departments.map((d) => {
          const mgrs = managersIn(d.id);
          return (
            <div key={d.id} className="glass space-y-3 p-4">
              <div className="flex items-start gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-violet-500/15 text-violet-300 ring-1 ring-violet-500/30">
                  <Building2 className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  {editing?.id === d.id ? (
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        if (await run(d.id, "/api/admin/departments", { action: "rename", id: d.id, name: editing.name }, "Department renamed")) setEditing(null);
                      }}
                      className="flex gap-1.5"
                    >
                      <input className="input py-1 text-sm" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} autoFocus aria-label="Department name" />
                      <button className="btn-primary btn-sm px-2" aria-label="Save"><Check className="h-3.5 w-3.5" /></button>
                      <button type="button" onClick={() => setEditing(null)} className="btn-ghost btn-sm px-2" aria-label="Cancel"><X className="h-3.5 w-3.5" /></button>
                    </form>
                  ) : (
                    <p className="truncate font-semibold text-white">{d.name}</p>
                  )}
                  <p className="text-xs text-slate-400">
                    {countIn(d.id)} member{countIn(d.id) === 1 ? "" : "s"} · {mgrs.length ? `Manager: ${mgrs.map(profileName).join(", ")}` : <span className="text-amber-300">no manager yet</span>}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setEditing({ id: d.id, name: d.name })} className="btn-ghost btn-sm"><Pencil className="h-3.5 w-3.5" /> Rename</button>
                <button onClick={() => setFilter(d.id)} className="btn-ghost btn-sm"><Users className="h-3.5 w-3.5" /> Members</button>
                <button
                  onClick={async () => {
                    if (confirmDelete !== d.id) return setConfirmDelete(d.id);
                    await run(d.id, "/api/admin/departments", { action: "delete", id: d.id }, "Department deleted");
                    setConfirmDelete(null);
                  }}
                  className="btn-danger btn-sm ml-auto"
                >
                  <Trash2 className="h-3.5 w-3.5" /> {confirmDelete === d.id ? "Confirm" : ""}
                </button>
              </div>
            </div>
          );
        })}

        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (await run("create", "/api/admin/departments", { action: "create", name: newName }, "Department created")) setNewName("");
          }}
          className="glass flex flex-col justify-center gap-2 border-dashed p-4"
        >
          <p className="text-sm font-semibold text-white">New department</p>
          <div className="flex gap-2">
            <input className="input py-1.5 text-sm" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Sales" aria-label="New department name" />
            <button className="btn-primary btn-sm" disabled={!newName.trim() || busy === "create"}><Plus className="h-3.5 w-3.5" /> Add</button>
          </div>
        </form>
      </div>

      {unassigned.length > 0 && (
        <p className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-xs text-amber-200">
          {unassigned.length} member{unassigned.length === 1 ? " is" : "s are"} not in a department. Their manager can&apos;t see their work until you assign one below.
        </p>
      )}

      {/* ---------- members ---------- */}
      <section className="glass overflow-x-auto">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 p-4">
          <h3 className="text-sm font-semibold text-white">Members</h3>
          <select className="input w-auto py-1.5 text-xs" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter by department">
            <option value="all">All departments</option>
            {data.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            <option value="none">Not in a department</option>
          </select>
        </div>
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wide text-slate-400">
              <th className="px-4 py-3 font-medium">Member</th>
              <th className="px-4 py-3 font-medium">Department</th>
              <th className="px-4 py-3 font-medium">Access</th>
              <th className="px-4 py-3 font-medium">Role name</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {shown.map((m) => {
              const changed = (titles[m.id] || "") !== (m.role_title || "");
              return (
                <tr key={m.id}>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-3">
                      <Avatar profile={m} size={30} />
                      <span>
                        <span className="block font-medium text-white">{profileName(m)}</span>
                        <span className="block text-xs text-slate-500">{m.notify_email || m.gmail_address || `@${m.username}`}</span>
                      </span>
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      className="input py-1.5 text-xs"
                      value={m.department_id || ""}
                      disabled={busy === m.id}
                      onChange={(e) => run(m.id, "/api/admin/departments", { action: "assign", userId: m.id, departmentId: e.target.value }, "Department updated")}
                      aria-label={`Department of ${profileName(m)}`}
                    >
                      <option value="">— none —</option>
                      {data.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      className="input py-1.5 text-xs"
                      value={m.role}
                      disabled={busy === m.id}
                      onChange={(e) => run(m.id, "/api/admin/role", { userId: m.id, role: e.target.value }, `${profileName(m)} is now ${e.target.value === "manager" ? "a manager" : "an employee"}`)}
                      aria-label={`Access of ${profileName(m)}`}
                    >
                      <option value="employee">Employee</option>
                      <option value="manager">Manager</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        run(m.id, "/api/admin/departments", { action: "title", userId: m.id, title: titles[m.id] }, "Role name saved");
                      }}
                      className="flex gap-2"
                    >
                      <input
                        className="input py-1.5 text-xs"
                        value={titles[m.id] ?? ""}
                        onChange={(e) => setTitles({ ...titles, [m.id]: e.target.value })}
                        placeholder={m.role === "manager" ? "e.g. Sales Manager" : "e.g. Sales Executive"}
                        aria-label={`Role name of ${profileName(m)}`}
                      />
                      {changed && <button className="btn-primary btn-sm px-2" aria-label="Save role name"><Check className="h-3.5 w-3.5" /></button>}
                    </form>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!shown.length && <p className="p-6 text-center text-sm text-slate-500">No members here.</p>}
      </section>
    </div>
  );
}
