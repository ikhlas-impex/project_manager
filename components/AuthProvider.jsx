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
    if (!uid) return setProfile(null);
    const { data } = await supabase.from("profiles").select("*").eq("id", uid).single();
    setProfile(data);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!supabase) return;
    const { data } = await supabase.auth.getSession();
    setSession(data.session);
    if (data.session?.user?.id) {
      await loadProfile(data.session.user.id);
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
