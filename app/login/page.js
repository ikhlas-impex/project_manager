"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Lock, User, Workflow } from "lucide-react";
import { supabase, isConfigured, toLoginEmail } from "@/lib/supabase";
import { useAuth } from "@/components/AuthProvider";
import { Spinner } from "@/components/ui";

export default function LoginPage() {
  const { session } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (session) router.replace("/dashboard");
  }, [session, router]);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: toLoginEmail(username), password });
    setBusy(false);
    if (error) setError(error.message === "Invalid login credentials" ? "Wrong username or password." : error.message);
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <span className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-violet-500 to-sky-500 shadow-xl shadow-violet-600/30">
            <Workflow className="h-7 w-7 text-white" />
          </span>
          <h1 className="text-3xl font-bold tracking-tight text-white">Welcome to TeamFlow</h1>
          <p className="mt-2 text-sm text-slate-400">Assign work, track progress, share daily updates.</p>
        </div>

        <form onSubmit={submit} className="glass space-y-4 p-6 sm:p-8">
          {!isConfigured && (
            <p className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-xs text-amber-200">
              Supabase isn&apos;t configured yet. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to your environment.
            </p>
          )}
          <div>
            <label className="label" htmlFor="username">Username</label>
            <div className="relative">
              <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input id="username" className="input pl-10" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="manager" autoComplete="username" autoFocus required />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="password">Password</label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input id="password" type={show ? "text" : "password"} className="input px-10" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" required />
              <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300" aria-label={show ? "Hide password" : "Show password"}>
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          {error && <p className="text-sm text-rose-300">{error}</p>}
          <button disabled={busy || !isConfigured} className="btn-primary w-full py-2.5">
            {busy && <Spinner className="h-4 w-4 text-white" />} Sign in
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-slate-500">
          Default accounts: <span className="text-slate-300">manager / manager@123</span> · <span className="text-slate-300">user / user@123</span>
          <br />Change your password from Profile after signing in.
        </p>
      </div>
    </div>
  );
}
