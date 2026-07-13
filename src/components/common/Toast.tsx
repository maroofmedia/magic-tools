/** @jsxImportSource preact */
/**
 * Toast.tsx — Toast notification system (Preact island)
 * Usage: import and use the `useToast` hook from anywhere within the island tree.
 * Mount <ToastContainer client:load /> once in a layout.
 */
import { useState, useCallback, useEffect } from 'preact/hooks';
import { createContext } from 'preact';
import { useContext } from 'preact/hooks';
import type { ToastEntry } from '@/types/index';
import { uid } from '@/utils/helpers';

// ── Context ──────────────────────────────────────────────────────────────────
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

// ── Individual Toast item ─────────────────────────────────────────────────────
function Toast({ entry, onDismiss }: { entry: ToastEntry; onDismiss: () => void }) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const duration = entry.duration ?? 4000;
    const leaveAt = duration - 300;
    const leaveTimer = setTimeout(() => setLeaving(true), leaveAt);
    const dismissTimer = setTimeout(onDismiss, duration);
    return () => {
      clearTimeout(leaveTimer);
      clearTimeout(dismissTimer);
    };
  }, [entry.id]);

  const iconMap: Record<ToastEntry['type'], string> = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ',
  };

  const colorMap: Record<ToastEntry['type'], string> = {
    success: 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/80',
    error:   'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/80',
    warning: 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/80',
    info:    'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/80',
  };

  const iconColorMap: Record<ToastEntry['type'], string> = {
    success: 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900',
    error:   'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900',
    warning: 'text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900',
    info:    'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900',
  };

  return (
    <div
      role="alert"
      aria-live="polite"
      class={`flex items-start gap-3 p-4 rounded-xl border shadow-lg max-w-sm w-full pointer-events-auto transition-all duration-300 ${colorMap[entry.type]} ${leaving ? 'animate-toast-out' : 'animate-toast-in'}`}
    >
      <span class={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold ${iconColorMap[entry.type]}`} aria-hidden="true">
        {iconMap[entry.type]}
      </span>
      <div class="flex-1 min-w-0">
        <p class="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{entry.title}</p>
        {entry.message && (
          <p class="text-xs text-neutral-600 dark:text-neutral-400 mt-0.5">{entry.message}</p>
        )}
      </div>
      <button
        type="button"
        onClick={() => { setLeaving(true); setTimeout(onDismiss, 300); }}
        aria-label="Dismiss notification"
        class="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors"
      >
        ✕
      </button>
    </div>
  );
}

// ── Toast Container ───────────────────────────────────────────────────────────
export default function ToastContainer() {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);

  const toast = useCallback((entry: Omit<ToastEntry, 'id'>) => {
    setToasts((prev) => [...prev, { ...entry, id: uid() }]);
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Expose to global window so non-Preact code can trigger toasts
  useEffect(() => {
    (window as any).__magictools_toast = toast;
  }, [toast]);

  return (
    <ToastContext.Provider value={{ toast, dismiss }}>
      <div
        class="fixed bottom-4 right-4 z-[9999] flex flex-col gap-3 pointer-events-none"
        aria-live="polite"
        aria-label="Notifications"
      >
        {toasts.map((entry) => (
          <Toast key={entry.id} entry={entry} onDismiss={() => dismiss(entry.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/** Convenience function to trigger a toast from non-Preact code */
export function fireToast(entry: Omit<ToastEntry, 'id'>) {
  (window as any).__magictools_toast?.(entry);
}
