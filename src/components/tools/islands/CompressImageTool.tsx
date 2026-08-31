/** @jsxImportSource preact */
import ToolProcessor from '@/components/tools/ToolProcessor';
import { compressImage } from '@/lib/image/compress';
import type { ToolConfig } from '@/types/index';

interface Props { tool: ToolConfig }

const SIZE_PRESETS = [0.5, 1, 2, 5, 10];
const DIMENSION_PRESETS = [
  { label: 'Full (4K)', val: 4096 },
  { label: '2K (2048px)', val: 2048 },
  { label: 'FHD (1080px)', val: 1080 },
  { label: 'HD (720px)', val: 720 },
];

export default function CompressImageTool({ tool }: Props) {
  return (
    <ToolProcessor
      tool={tool}
      defaultOptions={{ targetSizeMB: 1, maxWidthOrHeight: 4096 }}
      optionsRenderer={(files, options, setOptions) => (
        <div class="space-y-5">
          {/* Target File Size */}
          <div>
            <div class="flex items-center justify-between mb-2">
              <label for="target-size" class="text-xs sm:text-sm font-semibold text-neutral-800 dark:text-neutral-200">
                Target Maximum Size: <span class="text-brand-600 dark:text-brand-400 font-mono font-bold">{options.targetSizeMB as number} MB</span>
              </label>
            </div>

            {/* Quick Presets */}
            <div class="flex flex-wrap gap-1.5 mb-3">
              {SIZE_PRESETS.map((sz) => (
                <button
                  key={sz}
                  type="button"
                  onClick={() => setOptions({ ...options, targetSizeMB: sz })}
                  class={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${options.targetSizeMB === sz ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400' : 'border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:border-neutral-300'}`}
                >
                  {sz} MB
                </button>
              ))}
            </div>

            <input
              id="target-size"
              type="range"
              min="0.1"
              max="20"
              step="0.1"
              value={options.targetSizeMB as number}
              onInput={(e) => setOptions({ ...options, targetSizeMB: parseFloat((e.target as HTMLInputElement).value) })}
              class="w-full accent-brand-600 cursor-pointer"
            />
            <div class="flex justify-between text-[11px] font-mono text-neutral-400 dark:text-neutral-500 mt-1">
              <span>0.1 MB (High compression)</span>
              <span>20 MB (Light compression)</span>
            </div>
          </div>

          {/* Max Resolution Dimension */}
          <div>
            <div class="flex items-center justify-between mb-2">
              <label for="max-dimension" class="text-xs sm:text-sm font-semibold text-neutral-800 dark:text-neutral-200">
                Max Dimension: <span class="text-brand-600 dark:text-brand-400 font-mono font-bold">{options.maxWidthOrHeight as number}px</span>
              </label>
            </div>

            {/* Dimension Presets */}
            <div class="flex flex-wrap gap-1.5 mb-3">
              {DIMENSION_PRESETS.map((p) => (
                <button
                  key={p.val}
                  type="button"
                  onClick={() => setOptions({ ...options, maxWidthOrHeight: p.val })}
                  class={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${options.maxWidthOrHeight === p.val ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400' : 'border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:border-neutral-300'}`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <input
              id="max-dimension"
              type="range"
              min="512"
              max="8192"
              step="256"
              value={options.maxWidthOrHeight as number}
              onInput={(e) => setOptions({ ...options, maxWidthOrHeight: parseInt((e.target as HTMLInputElement).value) })}
              class="w-full accent-brand-600 cursor-pointer"
            />
          </div>
        </div>
      )}
      processFiles={async (files, options, onProgress) => {
        return compressImage(
          files[0],
          onProgress,
          options.targetSizeMB as number,
          options.maxWidthOrHeight as number,
        );
      }}
    />
  );
}
