/** @jsxImportSource preact */
/**
 * PdfToImagesTool.tsx — PDF to Images with format and DPI presets
 */
import ToolProcessor from '@/components/tools/ToolProcessor';
import { pdfToImages } from '@/lib/pdf/toImages';
import type { ToolConfig } from '@/types/index';

interface Props { tool: ToolConfig }

const DPI_PRESETS = [
  { label: '72 DPI (Web)', val: 72 },
  { label: '150 DPI (Standard)', val: 150 },
  { label: '300 DPI (High Print)', val: 300 },
];

export default function PdfToImagesTool({ tool }: Props) {
  return (
    <ToolProcessor
      tool={tool}
      defaultOptions={{ format: 'image/jpeg', dpi: 150 }}
      optionsRenderer={(_files, options, setOptions) => (
        <div class="space-y-5">
          {/* Output Format */}
          <div>
            <p class="text-xs sm:text-sm font-semibold text-neutral-800 dark:text-neutral-200 mb-2">
              Image Format
            </p>
            <div class="flex gap-2">
              {(['image/jpeg', 'image/png'] as const).map((fmt) => (
                <button
                  key={fmt}
                  type="button"
                  onClick={() => setOptions({ ...options, format: fmt })}
                  class={`px-4 py-2 rounded-xl text-xs font-semibold border transition-all ${options.format === fmt ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400 shadow-xs' : 'border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:border-neutral-300'}`}
                >
                  {fmt === 'image/jpeg' ? 'JPEG' : 'PNG (Lossless)'}
                </button>
              ))}
            </div>
          </div>

          {/* Resolution DPI */}
          <div>
            <div class="flex items-center justify-between mb-2">
              <label for="pdf-dpi" class="text-xs sm:text-sm font-semibold text-neutral-800 dark:text-neutral-200">
                Render Resolution: <span class="text-brand-600 dark:text-brand-400 font-mono font-bold">{options.dpi as number} DPI</span>
              </label>
            </div>

            {/* DPI Presets */}
            <div class="flex flex-wrap gap-1.5 mb-3">
              {DPI_PRESETS.map((dp) => (
                <button
                  key={dp.val}
                  type="button"
                  onClick={() => setOptions({ ...options, dpi: dp.val })}
                  class={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${options.dpi === dp.val ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400' : 'border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:border-neutral-300'}`}
                >
                  {dp.label}
                </button>
              ))}
            </div>

            <input
              id="pdf-dpi"
              type="range"
              min="72"
              max="300"
              step="36"
              value={options.dpi as number}
              onInput={(e) => setOptions({ ...options, dpi: parseInt((e.target as HTMLInputElement).value, 10) })}
              class="w-full accent-brand-600 cursor-pointer"
            />
          </div>
        </div>
      )}
      processFiles={async (files, options, onProgress) =>
        pdfToImages(
          files[0],
          options.format as 'image/jpeg' | 'image/png',
          options.dpi as number,
          onProgress,
        )
      }
    />
  );
}
