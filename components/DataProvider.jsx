"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "./AuthProvider";
import TaskModal from "./TaskModal";

const DataContext = createContext(null);
export const useData = () => useContext(DataContext);

const ACTIVITY_DAYS = 120;

export function DataProvider({ children }) {
  const { profile: me } = useAuth();
  const [profiles, setProfiles] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [activity, setActivity] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [integrations, setIntegrations] = useState({ google: false, ai: false });
  const [modal, setModal] = useState(null); // { task } | { defaults }
  const timer = useRef();

  const reload = useCallback(async () => {
    const since = new Date(Date.now() - ACTIVITY_DAYS * 864e5).toISOString();
    const [p, t, a, d] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at"),
      supabase.from("tasks").select("*").order("created_at", { ascending: false }),
      supabase.from("task_activity").select("*").gte("created_at", since).order("created_at", { ascending: false }),
      supabase.from("departments").select("*").order("name"),
    ]);
    if (p.data) setProfiles(p.data);
    if (t.data) setTasks(t.data);
    if (a.data) setActivity(a.data);
    if (d.data) setDepartments(d.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
    fetch("/api/status").then((r) => r.json()).then(setIntegrations).catch(() => {});

    // Live updates: whenever anyone changes a task, refresh (debounced)
    const refresh = () => {
      clearTimeout(timer.current);
      timer.current = setTimeout(reload, 300);
    };
    const channel = supabase
      .channel("teamflow-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "task_activity" }, refresh)
      .subscribe();
    return () => {
      clearTimeout(timer.current);
      supabase.removeChannel(channel);
    };
  }, [reload]);

  // People in my department (always includes me). Managers see this team's work.
  const team = profiles.filter((p) => p.id === me?.id || (me?.department_id && p.department_id === me.department_id));

  const value = {
    profiles,
    team,
    departments,
    myDepartment: departments.find((d) => d.id === me?.department_id) || null,
    tasks,
    activity,
    loading,
    // email is sent from the user's own connected Gmail
    integrations: { ...integrations, email: integrations.google && Boolean(me?.gmail_address) },
    reload,
    openTask: (task) => setModal({ task }),
    newTask: (defaults = {}) => setModal({ defaults }),
  };

  return (
    <DataContext.Provider value={value}>
      {children}
      {modal && <TaskModal {...modal} onClose={() => setModal(null)} />}
    </DataContext.Provider>
  );
}
