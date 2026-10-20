"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (uid) => {
    if (!uid) {
      setProfile(null);
      return null;
    }
    const { data } = await supabase.from("profiles").select("*").eq("id", uid).single();
    if (data) setProfile(data);
    return data;
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!supabase) return null;
    try {
      // 1. Force refresh session tokens so user_metadata is fresh from the server
      const { data: refData } = await supabase.auth.refreshSession().catch(() => ({ data: {} }));
      const activeSession = refData?.session || (await supabase.auth.getSession()).data?.session;
      if (activeSession) {
        setSession(activeSession);
      }

      // 2. Fetch fresh profile record
      const uid = activeSession?.user?.id;
      let freshProf = null;
      if (uid) {
        freshProf = await loadProfile(uid);
      }

      // 3. Sync with authoritative /api/role/status
      try {
        const res = await fetch("/api/role/status");
        if (res.ok) {
          const status = await res.json();
          if (status.role && freshProf && freshProf.role !== status.role) {
            freshProf = { ...freshProf, role: status.role };
            setProfile(freshProf);
          }
        }
      } catch {
        // Fallback silently if offline or during build
      }

      return { session: activeSession, profile: freshProf };
    } catch (err) {
      console.warn("refreshProfile error:", err);
      return null;
    }
  }, [loadProfile]);

  useEffect(() => {
    if (!supabase) return setLoading(false);
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      await loadProfile(data.session?.user?.id);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      // defer: Supabase recommends not awaiting queries inside this callback
      setTimeout(() => loadProfile(s?.user?.id), 0);
    });

    return () => sub.subscription.unsubscribe();
  }, [loadProfile]);

  // Realtime subscription for profile updates
  useEffect(() => {
    if (!supabase || !session?.user?.id) return;
    const uid = session.user.id;

    const channel = supabase
      .channel(`user-profile-${uid}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${uid}`,
        },
        async (payload) => {
          if (payload.new) {
            setProfile(payload.new);
            await refreshProfile();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session?.user?.id, refreshProfile]);

  // Active role polling when awaiting manager approval
  useEffect(() => {
    if (!session?.user?.id) return;
    const isPending =
      session.user.user_metadata?.manager_request_status === "pending" ||
      profile?.manager_request_status === "pending";

    if (profile?.role === "manager" || !isPending) return;

    let mounted = true;
    const checkRole = async () => {
      try {
        const res = await fetch("/api/role/status");
        if (!res.ok) return;
        const status = await res.json();
        if (status.role === "manager" || status.is_manager) {
          if (mounted) {
            await refreshProfile();
            window.dispatchEvent(
              new CustomEvent("teamflow:role-approved", { detail: { role: "manager" } })
            );
          }
        }
      } catch {
        // ignore network error
      }
    };

    const interval = setInterval(checkRole, 4000);
    const onVisibility = () => {
      if (document.visibilityState === "visible") checkRole();
    };
    window.addEventListener("focus", checkRole);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      mounted = false;
      clearInterval(interval);
      window.removeEventListener("focus", checkRole);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [session, profile, refreshProfile]);

  const value = {
    session,
    user: session?.user || null,
    profile,
    loading,
    refreshProfile,
    signOut: () => supabase.auth.signOut(),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

