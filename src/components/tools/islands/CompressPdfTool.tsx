/** @jsxImportSource preact */
import ToolProcessor from '@/components/tools/ToolProcessor';
import { compressPdf } from '@/lib/pdf/compress';
import { formatTargetSize } from '@/utils/helpers';
import type { ToolConfig } from '@/types/index';

interface Props { tool: ToolConfig }

const SIZE_PRESETS_KB = [500, 1024, 2048, 5120];

export default function CompressPdfTool({ tool }: Props) {
  return (
    <ToolProcessor
      tool={tool}
      defaultOptions={{ targetSizeKB: 1024, customName: '' }}
      optionsRenderer={(_files, options, setOptions) => {
        const currentKB = (options.targetSizeKB as number) || 1024;
        return (
          <div class="space-y-3.5">
            {/* Simple User-Friendly Explanation */}
            <div class="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200/80 dark:border-neutral-700/60 text-xs text-neutral-600 dark:text-neutral-400">
              <p class="font-semibold text-neutral-900 dark:text-neutral-100 mb-0.5">
                ⚡ Make PDF Smaller
              </p>
              <p class="leading-relaxed">
                Makes your PDF file smaller so it is easy to share, email, and upload.
              </p>
            </div>

            {/* Desired Output Size */}
            <div>
              <div class="flex items-center justify-between mb-1.5">
                <label for="pdf-target-size" class="text-xs sm:text-sm font-semibold text-neutral-800 dark:text-neutral-200">
                  Desired Maximum Size: <span class="text-brand-600 dark:text-brand-400 font-mono font-bold">{formatTargetSize(currentKB)}</span>
                </label>
              </div>

              {/* Quick Presets */}
              <div class="flex flex-wrap gap-1.5 mb-2.5">
                {SIZE_PRESETS_KB.map((kb) => (
                  <button
                    key={kb}
                    type="button"
                    onClick={() => setOptions({ ...options, targetSizeKB: kb })}
                    class={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${currentKB === kb ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400 shadow-xs' : 'border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:border-neutral-300'}`}
                  >
                    {formatTargetSize(kb)}
                  </button>
                ))}
              </div>

              <input
                id="pdf-target-size"
                type="range"
                min="200"
                max="10240"
                step="100"
                value={currentKB}
                onInput={(e) => setOptions({ ...options, targetSizeKB: parseInt((e.target as HTMLInputElement).value, 10) })}
                class="w-full accent-brand-600 cursor-pointer"
              />
              <div class="flex justify-between text-[11px] font-mono text-neutral-400 dark:text-neutral-500 mt-1">
                <span>200 KB (Smallest file)</span>
                <span>10 MB (Light compression)</span>
              </div>
            </div>

            {/* Optional Rename */}
            <div class="pt-1">
              <label for="pdf-rename" class="block text-xs font-semibold text-neutral-800 dark:text-neutral-200 mb-1">
                Rename File <span class="text-neutral-400 font-normal">(optional)</span>
              </label>
              <div class="flex items-center gap-2">
                <input
                  id="pdf-rename"
                  type="text"
                  value={(options.customName as string) || ''}
                  onInput={(e) => setOptions({ ...options, customName: (e.target as HTMLInputElement).value })}
                  placeholder="e.g. document-small"
                  class="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-xs sm:text-sm placeholder-neutral-400 focus:border-brand-500 focus:outline-none"
                />
                <span class="text-xs font-mono text-neutral-400 flex-shrink-0">.pdf</span>
              </div>
            </div>
          </div>
        );
      }}
      processFiles={async (files, options, onProgress) =>
        compressPdf(
          files[0],
          onProgress,
          { targetSizeKB: options.targetSizeKB as number },
          options.customName as string,
        )
      }
    />
  );
}
