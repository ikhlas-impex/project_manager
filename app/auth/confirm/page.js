"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { Spinner } from "@/components/ui";

export default function AuthConfirmPage() {
  const { session, profile, loading } = useAuth();
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (loading) return;

    if (!session) {
      // Give Supabase a short moment to parse tokens from URL hash if needed
      const timeout = setTimeout(() => {
        if (!session) router.replace("/login");
      }, 2000);
      return () => clearTimeout(timeout);
    }

    // Session exists! Check if role selection was already completed
    const meta = session.user?.user_metadata || {};
    const roleSelected = meta.role_selected || (profile && profile.role === "manager");

    if (roleSelected) {
      router.replace("/dashboard");
    } else {
      router.replace("/choose-role");
    }
    setChecking(false);
  }, [session, profile, loading, router]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="glass flex flex-col items-center gap-4 p-8 text-center">
        <Spinner className="h-8 w-8 text-violet-400" />
        <p className="text-sm text-slate-300">Signing you into TeamFlow...</p>
      </div>
    </div>
  );
}
