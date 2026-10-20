"use client";
import { useEffect, useState } from "react";
import { Building2, Check, Pencil, Users } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { useData } from "@/components/DataProvider";
import { useToast } from "@/components/Toast";
import { Avatar, EmptyState, PageHeader, Spinner } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { profileName } from "@/lib/format";

export default function TeamPage() {
  const { profile: me, refreshProfile } = useAuth();
  const { team, myDepartment, reload } = useData();
  const toast = useToast();
  const isManager = me.role === "manager";

  const [deptName, setDeptName] = useState(myDepartment?.name || "");
  const [renaming, setRenaming] = useState(false);
  const [titles, setTitles] = useState({});
  const [saving, setSaving] = useState(null);

  useEffect(() => setDeptName(myDepartment?.name || ""), [myDepartment?.name]);
  useEffect(() => setTitles(Object.fromEntries(team.map((p) => [p.id, p.role_title || ""]))), [team]);

  async function renameDept(e) {
    e.preventDefault();
    setSaving("dept");
    const { error } = await supabase.rpc("rename_my_department", { new_name: deptName });
    setSaving(null);
    if (error) return toast(error.message, "error");
    setRenaming(false);
    await reload();
    toast("Department renamed");
  }

  async function saveTitle(p) {
    setSaving(p.id);
    const { error } = await supabase.rpc("set_role_title", { member: p.id, title: titles[p.id] || "" });
    setSaving(null);
    if (error) return toast(error.message, "error");
    await reload();
    if (p.id === me.id) await refreshProfile();
    toast("Role name saved");
  }

  if (!myDepartment) {
    return (
      <>
        <PageHeader title="Team" />
        <div className="glass">
          <EmptyState icon={Building2} title="You're not in a department yet" text="Ask the admin to add you to a department from the admin portal." />
        </div>
      </>
    );
  }

  const managers = team.filter((p) => p.role === "manager");
  const ordered = [...managers, ...team.filter((p) => p.role !== "manager")];

  return (
    <>
      <PageHeader title="Team" subtitle={isManager ? "Your department and its members. You can see and manage their work." : "Your department and colleagues."} />

      <section className="glass relative mb-6 overflow-hidden p-5">
        <div className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-gradient-to-br from-violet-500/30 to-sky-500/10 blur-2xl" />
        <div className="relative flex flex-wrap items-center gap-4">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-500 shadow-lg shadow-violet-600/30">
            <Building2 className="h-6 w-6 text-white" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs uppercase tracking-wide text-slate-400">Department</p>
            {renaming ? (
              <form onSubmit={renameDept} className="mt-1 flex max-w-md gap-2">
                <input className="input py-1.5" value={deptName} onChange={(e) => setDeptName(e.target.value)} autoFocus aria-label="Department name" />
                <button className="btn-primary btn-sm" disabled={saving === "dept" || !deptName.trim()}>
                  {saving === "dept" ? <Spinner className="h-3.5 w-3.5 text-white" /> : <Check className="h-3.5 w-3.5" />} Save
                </button>
                <button type="button" className="btn-ghost btn-sm" onClick={() => { setRenaming(false); setDeptName(myDepartment.name); }}>Cancel</button>
              </form>
            ) : (
              <p className="flex items-center gap-2 text-2xl font-bold text-white">
                {myDepartment.name}
                {isManager && (
                  <button onClick={() => setRenaming(true)} className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white" aria-label="Rename department">
                    <Pencil className="h-4 w-4" />
                  </button>
                )}
              </p>
            )}
          </div>
          <div className="flex gap-4 text-center text-xs text-slate-400">
            <div><p className="text-xl font-bold text-white">{team.length}</p>members</div>
            <div><p className="text-xl font-bold text-white">{managers.length}</p>manager{managers.length === 1 ? "" : "s"}</div>
          </div>
        </div>
      </section>

      <section className="glass overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wide text-slate-400">
              <th className="px-4 py-3 font-medium"><span className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /> Member</span></th>
              <th className="px-4 py-3 font-medium">Access</th>
              <th className="px-4 py-3 font-medium">Role name</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {ordered.map((p) => {
              const editable = p.id === me.id || isManager;
              const changed = (titles[p.id] || "") !== (p.role_title || "");
              return (
                <tr key={p.id}>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-3">
                      <Avatar profile={p} size={32} />
                      <span>
                        <span className="block font-medium text-white">{profileName(p)}{p.id === me.id ? " (you)" : ""}</span>
                        <span className="block text-xs text-slate-500">{p.notify_email || p.gmail_address || `@${p.username}`}</span>
                      </span>
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`chip ${p.role === "manager" ? "bg-violet-400/10 text-violet-300 ring-violet-400/30" : "bg-sky-400/10 text-sky-300 ring-sky-400/30"}`}>
                      {p.role === "manager" ? "Manager" : "Employee"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {editable ? (
                      <form onSubmit={(e) => { e.preventDefault(); saveTitle(p); }} className="flex max-w-xs gap-2">
                        <input
                          className="input py-1.5 text-xs"
                          value={titles[p.id] ?? ""}
                          onChange={(e) => setTitles({ ...titles, [p.id]: e.target.value })}
                          placeholder={p.role === "manager" ? "e.g. Sales Manager" : "e.g. Sales Executive"}
                          aria-label={`Role name for ${profileName(p)}`}
                        />
                        {changed && (
                          <button className="btn-primary btn-sm" disabled={saving === p.id}>
                            {saving === p.id ? <Spinner className="h-3.5 w-3.5 text-white" /> : <Check className="h-3.5 w-3.5" />}
                          </button>
                        )}
                      </form>
                    ) : (
                      <span className="text-slate-300">{p.role_title || <span className="text-slate-500">—</span>}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
      <p className="mt-3 text-xs text-slate-500">
        Access level (manager/employee) and department changes are made by the admin. Manager access needs admin approval.
      </p>
    </>
  );
}
