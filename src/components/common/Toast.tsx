/** @jsxImportSource preact */
/**
 * Toast.tsx — Global toast notification system with glassmorphism & sound/animation feedback
 */
import { useState, useCallback, useEffect } from 'preact/hooks';
import { createContext } from 'preact';
import { useContext } from 'preact/hooks';
import type { ToastEntry } from '@/types/index';
import { uid } from '@/utils/helpers';

interface ToastContextValue {
  toast: (entry: Omit<ToastEntry, 'id'>) => void;
  dismiss: (id: string) => void;
}

export const ToastContext = createContext<ToastContextValue>({
  toast: () => {},
  dismiss: () => {},
});

export function useToast() {
  return useContext(ToastContext);
}

function ToastItem({ entry, onDismiss }: { entry: ToastEntry; onDismiss: () => void }) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const duration = entry.duration ?? 4500;
    const leaveTimer = setTimeout(() => setLeaving(true), duration - 250);
    const dismissTimer = setTimeout(onDismiss, duration);
    return () => {
      clearTimeout(leaveTimer);
      clearTimeout(dismissTimer);
    };
  }, [entry.id, entry.duration, onDismiss]);

  const typeConfig: Record<ToastEntry['type'], { icon: string; border: string; bg: string; iconBg: string; text: string }> = {
    success: {
      icon: '✓',
      border: 'border-emerald-200 dark:border-emerald-800/80',
      bg: 'bg-white/95 dark:bg-neutral-900/95',
      iconBg: 'bg-emerald-500 text-white',
      text: 'text-emerald-950 dark:text-emerald-100',
    },
    error: {
      icon: '✕',
      border: 'border-red-200 dark:border-red-800/80',
      bg: 'bg-white/95 dark:bg-neutral-900/95',
      iconBg: 'bg-red-500 text-white',
      text: 'text-red-950 dark:text-red-100',
    },
    warning: {
      icon: '!',
      border: 'border-amber-200 dark:border-amber-800/80',
      bg: 'bg-white/95 dark:bg-neutral-900/95',
      iconBg: 'bg-amber-500 text-white',
      text: 'text-amber-950 dark:text-amber-100',
    },
    info: {
      icon: 'i',
      border: 'border-brand-200 dark:border-brand-800/80',
      bg: 'bg-white/95 dark:bg-neutral-900/95',
      iconBg: 'bg-brand-500 text-white',
      text: 'text-brand-950 dark:text-brand-100',
    },
  };

  const cfg = typeConfig[entry.type] || typeConfig.info;

  return (
    <div
      role="alert"
      aria-live="polite"
      class={`flex items-start gap-3 p-4 rounded-2xl border shadow-xl glass max-w-sm w-full pointer-events-auto transition-all duration-300 ${cfg.border} ${cfg.bg} ${leaving ? 'animate-toast-out' : 'animate-toast-in'}`}
    >
      <span class={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${cfg.iconBg}`} aria-hidden="true">
        {cfg.icon}
      </span>
      <div class="flex-1 min-w-0">
        <p class={`text-sm font-semibold tracking-tight ${cfg.text}`}>{entry.title}</p>
        {entry.message && (
          <p class="text-xs text-neutral-600 dark:text-neutral-300 mt-0.5 leading-relaxed">{entry.message}</p>
        )}
      </div>
      <button
        type="button"
        onClick={() => { setLeaving(true); setTimeout(onDismiss, 250); }}
        aria-label="Dismiss notification"
        class="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
      >
        ✕
      </button>
    </div>
  );
}

export default function ToastContainer() {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);

  const toast = useCallback((entry: Omit<ToastEntry, 'id'>) => {
    setToasts((prev) => [...prev, { ...entry, id: uid() }]);
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    (window as any).__magictools_toast = toast;
  }, [toast]);

  return (
    <ToastContext.Provider value={{ toast, dismiss }}>
      <div
        class="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-[9999] flex flex-col gap-2.5 pointer-events-none max-w-[calc(100vw-2rem)]"
        aria-live="polite"
        aria-label="Notifications"
      >
        {toasts.map((entry) => (
          <ToastItem key={entry.id} entry={entry} onDismiss={() => dismiss(entry.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function fireToast(entry: Omit<ToastEntry, 'id'>) {
  (window as any).__magictools_toast?.(entry);
}
