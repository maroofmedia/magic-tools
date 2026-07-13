/** @jsxImportSource preact */
/**
 * ProgressBar.tsx — Accessible animated progress bar (Preact island)
 */

interface Props {
  value: number; // 0–100
  label?: string;
  showPercentage?: boolean;
}

export default function ProgressBar({ value, label = 'Processing…', showPercentage = true }: Props) {
  const pct = Math.min(Math.max(value, 0), 100);

  return (
    <div class="space-y-2 animate-fade-in">
      <div class="flex items-center justify-between">
        <span class="text-sm font-medium text-neutral-700 dark:text-neutral-300">{label}</span>
        {showPercentage && (
          <span class="text-sm font-mono text-neutral-500 dark:text-neutral-400">
            {Math.round(pct)}%
          </span>
        )}
      </div>
      <div
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
        class="w-full h-2 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden"
      >
        <div
          class="h-full progress-bar-fill rounded-full"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
