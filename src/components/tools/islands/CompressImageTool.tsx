/** @jsxImportSource preact */
import ToolProcessor from '@/components/tools/ToolProcessor';
import { compressImages } from '@/lib/image/compress';
import { formatTargetSize } from '@/utils/helpers';
import type { ToolConfig } from '@/types/index';

interface Props { tool: ToolConfig }

// Presets in KB (200 KB, 500 KB, 1 MB, 2 MB, 5 MB)
const SIZE_PRESETS_KB = [200, 500, 1024, 2048, 5120];

export default function CompressImageTool({ tool }: Props) {
  return (
    <ToolProcessor
      tool={tool}
      defaultOptions={{ targetSizeKB: 500 }}
      optionsRenderer={(_files, options, setOptions) => {
        const currentKB = (options.targetSizeKB as number) || 500;
        return (
          <div class="space-y-4">
            <div>
              <div class="flex items-center justify-between mb-2">
                <label for="target-size" class="text-xs sm:text-sm font-semibold text-neutral-800 dark:text-neutral-200">
                  Target Maximum Size: <span class="text-brand-600 dark:text-brand-400 font-mono font-bold">{formatTargetSize(currentKB)}</span>
                </label>
              </div>

              {/* Quick Presets */}
              <div class="flex flex-wrap gap-1.5 mb-3">
                {SIZE_PRESETS_KB.map((kb) => (
                  <button
                    key={kb}
                    type="button"
                    onClick={() => setOptions({ ...options, targetSizeKB: kb })}
                    class={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${currentKB === kb ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400' : 'border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:border-neutral-300'}`}
                  >
                    {formatTargetSize(kb)}
                  </button>
                ))}
              </div>

              <input
                id="target-size"
                type="range"
                min="50"
                max="10240"
                step="50"
                value={currentKB}
                onInput={(e) => setOptions({ ...options, targetSizeKB: parseInt((e.target as HTMLInputElement).value, 10) })}
                class="w-full accent-brand-600 cursor-pointer"
              />
              <div class="flex justify-between text-[11px] font-mono text-neutral-400 dark:text-neutral-500 mt-1">
                <span>50 KB (Smaller file)</span>
                <span>10 MB (Higher quality)</span>
              </div>
            </div>
          </div>
        );
      }}
      processFiles={async (files, options, onProgress) => {
        const targetSizeMB = ((options.targetSizeKB as number) || 500) / 1024;
        return compressImages(files, onProgress, targetSizeMB);
      }}
    />
  );
}
