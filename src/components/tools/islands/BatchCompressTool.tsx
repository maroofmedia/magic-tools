/** @jsxImportSource preact */
import ToolProcessor from '@/components/tools/ToolProcessor';
import { batchCompressImages } from '@/lib/image/compress';
import type { ToolConfig } from '@/types/index';

interface Props { tool: ToolConfig }

const BATCH_SIZE_PRESETS = [0.5, 1, 2, 5];

export default function BatchCompressTool({ tool }: Props) {
  return (
    <ToolProcessor
      tool={tool}
      defaultOptions={{ targetSizeMB: 1 }}
      optionsRenderer={(_files, options, setOptions) => (
        <div class="space-y-4">
          <div>
            <div class="flex items-center justify-between mb-2">
              <label for="batch-target-size" class="text-xs sm:text-sm font-semibold text-neutral-800 dark:text-neutral-200">
                Target Max Size Per Image: <span class="text-brand-600 dark:text-brand-400 font-mono font-bold">{options.targetSizeMB as number} MB</span>
              </label>
            </div>

            {/* Presets */}
            <div class="flex flex-wrap gap-1.5 mb-3">
              {BATCH_SIZE_PRESETS.map((sz) => (
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
              id="batch-target-size"
              type="range"
              min="0.1"
              max="20"
              step="0.1"
              value={options.targetSizeMB as number}
              onInput={(e) => setOptions({ ...options, targetSizeMB: parseFloat((e.target as HTMLInputElement).value) })}
              class="w-full accent-brand-600 cursor-pointer"
            />
            <div class="flex justify-between text-[11px] font-mono text-neutral-400 dark:text-neutral-500 mt-1">
              <span>0.1 MB (Maximum reduction)</span>
              <span>20 MB (High fidelity)</span>
            </div>
          </div>
        </div>
      )}
      processFiles={async (files, options, onProgress) =>
        batchCompressImages(files, onProgress, options.targetSizeMB as number)
      }
    />
  );
}
