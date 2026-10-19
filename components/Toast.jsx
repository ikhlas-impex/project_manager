"use client";
import { createContext, useCallback, useContext, useState } from "react";
import { CheckCircle2, AlertTriangle, Info } from "lucide-react";

const ToastContext = createContext(() => {});
export const useToast = () => useContext(ToastContext);

const ICONS = {
  success: <CheckCircle2 className="h-4 w-4 text-emerald-300" />,
  error: <AlertTriangle className="h-4 w-4 text-rose-300" />,
  info: <Info className="h-4 w-4 text-sky-300" />,
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const toast = useCallback((message, type = "success") => {
    const id = Math.random();
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), type === "error" ? 6000 : 3000);
  }, []);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="pointer-events-none fixed bottom-20 right-4 z-[100] flex flex-col gap-2 md:bottom-6">
        {toasts.map((t) => (
          <div key={t.id} role="status" className="glass-strong fade-in flex max-w-sm items-start gap-2.5 px-4 py-3 text-sm">
            <span className="mt-0.5">{ICONS[t.type]}</span>
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
