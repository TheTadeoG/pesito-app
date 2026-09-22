"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { CheckCircle2, TriangleAlert, X } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastTone = "success" | "warning";

interface ToastItem {
  id: number;
  tone: ToastTone;
  message: string;
  description?: string;
}

interface ToastContextValue {
  showSuccess: (message: string, description?: string) => void;
  showWarning: (message: string, description?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const DURATION_MS = 3200;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (tone: ToastTone, message: string, description?: string) => {
      const id = nextId.current++;
      setToasts((current) => [...current, { id, tone, message, description }]);
      window.setTimeout(() => dismiss(id), DURATION_MS);
    },
    [dismiss]
  );

  const showSuccess = useCallback(
    (message: string, description?: string) => show("success", message, description),
    [show]
  );
  const showWarning = useCallback(
    (message: string, description?: string) => show("warning", message, description),
    [show]
  );

  return (
    <ToastContext.Provider value={{ showSuccess, showWarning }}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 top-4 z-[100] flex flex-col items-center gap-2 px-4 sm:inset-x-auto sm:right-4 sm:items-end"
      >
        {toasts.map((toast) => (
          <ToastCard key={toast.id} toast={toast} onDismiss={() => dismiss(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastCard({ toast, onDismiss }: { toast: ToastItem; onDismiss: () => void }) {
  const isWarning = toast.tone === "warning";
  const borderClass = isWarning ? "border-warning/30" : "border-success/30";
  const iconBgClass = isWarning ? "bg-warning-bg text-warning" : "bg-success-bg text-success";
  const barBgClass = isWarning ? "bg-warning/20" : "bg-success/20";
  const barFillClass = isWarning ? "bg-warning" : "bg-success";
  const Icon = isWarning ? TriangleAlert : CheckCircle2;

  return (
    <div
      role="status"
      className={cn(
        "animate-toast-in pointer-events-auto relative flex w-full max-w-sm items-start gap-3 overflow-hidden rounded-2xl border bg-card p-3.5 pr-2 shadow-xl",
        borderClass
      )}
    >
      <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full", iconBgClass)}>
        <Icon className="animate-toast-check h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1 pt-0.5">
        <p className="text-sm font-semibold text-foreground">{toast.message}</p>
        {toast.description && (
          <p className="mt-0.5 text-xs text-muted-foreground">{toast.description}</p>
        )}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        aria-label="Cerrar"
      >
        <X className="h-3.5 w-3.5" />
      </button>
      <div className={cn("absolute inset-x-0 bottom-0 h-0.5", barBgClass)}>
        <div className={cn("animate-toast-progress h-full", barFillClass)} />
      </div>
    </div>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
