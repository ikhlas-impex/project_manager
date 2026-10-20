"use client";
import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, ArrowRight, Lock, ShieldCheck, Workflow } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { Spinner } from "@/components/ui";

function LoginContent() {
  const { session, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [signingIn, setSigningIn] = useState(false);

  const errorParam = searchParams.get("error");
  const rejectedEmail = searchParams.get("email");

  useEffect(() => {
    if (!loading && session) {
      router.replace("/dashboard");
    }
  }, [session, loading, router]);

  function handleGoogleLogin() {
    setSigningIn(true);
    window.location.href = "/api/auth/google";
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <span className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-violet-500 to-sky-500 shadow-xl shadow-violet-600/30">
            <Workflow className="h-7 w-7 text-white" />
          </span>
          <h1 className="text-3xl font-bold tracking-tight text-white">Welcome to TeamFlow</h1>
          <p className="mt-2 text-sm text-slate-400">
            Assign work, track progress, share daily updates.
          </p>
        </div>

        <div className="glass space-y-6 p-6 sm:p-8">
          {/* Domain restriction notice */}
          <div className="flex items-center gap-2 rounded-xl border border-violet-500/30 bg-violet-500/10 p-3 text-xs text-violet-200">
            <ShieldCheck className="h-4 w-4 shrink-0 text-violet-400" />
            <span>
              Restricted to authorized <strong className="text-white">@impexappliances.com</strong> Google accounts.
            </span>
          </div>

          {/* Error alerts */}
          {errorParam === "domain_not_allowed" && (
            <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3.5 text-xs text-rose-200 space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-rose-100">
                <AlertCircle className="h-4 w-4 text-rose-400" />
                Access Restricted: Domain Not Allowed
              </div>
              <p>
                {rejectedEmail ? (
                  <>
                    The account <span className="font-mono text-white">{rejectedEmail}</span> is not part of the authorized workspace domain.
                  </>
                ) : (
                  "Your Google account does not belong to the allowed organization domain."
                )}
              </p>
              <p className="text-slate-400">
                Please switch to your company Google account ending in <strong>@impexappliances.com</strong>.
              </p>
            </div>
          )}

          {errorParam === "cancelled" && (
            <p className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-xs text-amber-200">
              Sign-in was cancelled. Please try again.
            </p>
          )}

          {errorParam === "not_configured" && (
            <p className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-xs text-amber-200">
              Google authentication credentials are not configured yet on the server.
            </p>
          )}

          {errorParam && !["domain_not_allowed", "cancelled", "not_configured"].includes(errorParam) && (
            <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200">
              Authentication failed. Please try signing in again.
            </p>
          )}

          {/* Google Login Button */}
          <button
            onClick={handleGoogleLogin}
            disabled={signingIn}
            className="btn w-full bg-white py-3 font-semibold text-slate-800 shadow-xl hover:bg-slate-100 transition active:scale-[0.99] flex items-center justify-center gap-3"
          >
            {signingIn ? (
              <Spinner className="h-5 w-5 text-slate-800" />
            ) : (
              <GoogleIcon />
            )}
            <span>Sign in with Google Workspace</span>
          </button>

          <p className="text-center text-[11px] text-slate-400">
            Employees inside the domain can sign in and select their role (Employee or Manager).
          </p>

          <div className="border-t border-white/10 pt-4 text-center">
            <a
              href="/admin"
              className="inline-flex items-center gap-1.5 text-xs text-violet-300 hover:text-violet-200 transition font-medium"
            >
              <Lock className="h-3 w-3" />
              <span>System Administrator? Go to Admin Portal</span>
              <ArrowRight className="h-3 w-3" />
            </a>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-slate-500">
          TeamFlow Project Manager · Internal Enterprise Workspace
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="grid min-h-screen place-items-center">
          <Spinner className="h-8 w-8 text-violet-400" />
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" className="h-5 w-5 shrink-0" aria-hidden>
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
