"use client";
import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BarChart3, Bot, CalendarDays, ClipboardList, LayoutDashboard, LogOut, Plus, ScrollText, UserCog, Workflow } from "lucide-react";
import { useAuth } from "./AuthProvider";
import { DataProvider, useData } from "./DataProvider";
import { Avatar, Spinner } from "./ui";
import { profileName } from "@/lib/format";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/tasks", label: "Tasks", icon: ClipboardList },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/summary", label: "Daily Summary", icon: ScrollText },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/assistant", label: "AI Assistant", icon: Bot },
  { href: "/profile", label: "Profile", icon: UserCog },
];

export default function AppShell({ children }) {
  const { session, profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !session) router.replace("/login");
  }, [loading, session, router]);

  if (loading || !session || !profile) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Spinner className="h-7 w-7" />
      </div>
    );
  }
  return (
    <DataProvider>
      <Shell>{children}</Shell>
    </DataProvider>
  );
}

function Shell({ children }) {
  const { profile, signOut } = useAuth();
  const { newTask, loading } = useData();
  const path = usePathname();

  return (
    <div className="min-h-screen md:pl-64">
      {/* Sidebar (desktop) */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-white/10 bg-white/[0.03] p-4 backdrop-blur-2xl md:flex">
        <Link href="/dashboard" className="mb-6 flex items-center gap-2.5 px-2 pt-1">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-sky-500 shadow-lg shadow-violet-600/30">
            <Workflow className="h-5 w-5 text-white" />
          </span>
          <span className="text-lg font-bold tracking-tight text-white">TeamFlow</span>
        </Link>

        <button onClick={() => newTask()} className="btn-primary mb-5 w-full">
          <Plus className="h-4 w-4" /> New task
        </button>

        <nav className="flex flex-1 flex-col gap-1">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = path.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  active ? "bg-white/10 text-white shadow-inner ring-1 ring-white/10" : "text-slate-400 hover:bg-white/5 hover:text-slate-100"
                }`}
              >
                <Icon className={`h-[18px] w-[18px] ${active ? "text-violet-300" : ""}`} />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="glass mt-4 flex items-center gap-3 p-3">
          <Avatar profile={profile} size={36} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">{profileName(profile)}</p>
            <p className="text-xs capitalize text-slate-400">{profile.role}</p>
          </div>
          <button onClick={signOut} className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-rose-300" title="Sign out" aria-label="Sign out">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </aside>

      {/* Top bar (mobile) */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-white/10 bg-[#0a0918]/70 px-4 py-3 backdrop-blur-xl md:hidden">
        <span className="flex items-center gap-2 font-bold text-white">
          <Workflow className="h-5 w-5 text-violet-300" /> TeamFlow
        </span>
        <div className="flex items-center gap-2">
          <button onClick={() => newTask()} className="btn-primary btn-sm"><Plus className="h-4 w-4" /> Task</button>
          <Link href="/profile"><Avatar profile={profile} size={30} /></Link>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 pb-28 pt-6 sm:px-6 md:pb-10 lg:px-10 lg:pt-10">
        {loading ? (
          <div className="grid h-64 place-items-center"><Spinner className="h-7 w-7" /></div>
        ) : (
          <div className="fade-in">{children}</div>
        )}
      </main>

      {/* Bottom nav (mobile) */}
      <nav className="fixed inset-x-3 bottom-3 z-30 flex justify-around rounded-2xl border border-white/10 bg-[#17142e]/80 p-1.5 backdrop-blur-2xl md:hidden">
        {NAV.slice(0, 6).map(({ href, label, icon: Icon }) => {
          const active = path.startsWith(href);
          return (
            <Link key={href} href={href} aria-label={label} className={`rounded-xl p-2.5 transition ${active ? "bg-white/10 text-violet-300" : "text-slate-400"}`}>
              <Icon className="h-5 w-5" />
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
