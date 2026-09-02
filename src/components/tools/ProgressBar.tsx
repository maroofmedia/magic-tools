/** @jsxImportSource preact */
/**
 * ProgressBar.tsx — Animated progress bar with percentage counter and stage label
 */
interface Props {
  value: number; // 0 to 100
  label?: string;
}

export default function ProgressBar({ value, label = 'Processing…' }: Props) {
  const clamped = Math.min(100, Math.max(0, Math.round(value)));

  return (
    <div class="space-y-2 p-3.5 sm:p-4 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-2xs animate-fade-in" role="status" aria-label={label}>
      <div class="flex items-center justify-between text-xs font-semibold">
        <span class="text-neutral-700 dark:text-neutral-300 flex items-center gap-2">
          <svg class="w-3.5 h-3.5 animate-spin text-brand-600 dark:text-brand-400" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
          {label}
        </span>
        <span class="font-mono text-brand-600 dark:text-brand-400 font-bold">{clamped}%</span>
      </div>

      <div class="w-full h-2.5 rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden relative">
        <div
          class="h-full rounded-full bg-gradient-to-r from-brand-600 via-indigo-500 to-purple-600 transition-all duration-300 ease-out"
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
