/** @jsxImportSource preact */
/**
 * PdfToImagesTool.tsx — PDF to Images with format and DPI options
 */
import ToolProcessor from '@/components/tools/ToolProcessor';
import { pdfToImages } from '@/lib/pdf/toImages';
import type { ToolConfig } from '@/types/index';

interface Props { tool: ToolConfig }

export default function PdfToImagesTool({ tool }: Props) {
  return (
    <ToolProcessor
      tool={tool}
      defaultOptions={{ format: 'image/jpeg', dpi: 150 }}
      optionsRenderer={(_files, options, setOptions) => (
        <div class="space-y-4">
          <div>
            <p class="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">Output format</p>
            <div class="flex gap-2">
              {(['image/jpeg', 'image/png'] as const).map(fmt => (
                <button
                  key={fmt}
                  type="button"
                  onClick={() => setOptions({ ...options, format: fmt })}
                  class={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${options.format === fmt ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/40 text-brand-600 dark:text-brand-400' : 'border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400'}`}
                >
                  {fmt === 'image/jpeg' ? 'JPEG' : 'PNG'}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label for="pdf-dpi" class="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
              Resolution: <strong>{options.dpi as number} DPI</strong>
            </label>
            <input
              id="pdf-dpi"
              type="range" min="72" max="300" step="36"
              value={options.dpi as number}
              onInput={(e) => setOptions({ ...options, dpi: parseInt((e.target as HTMLInputElement).value) })}
              class="w-full accent-brand-600"
            />
            <div class="flex justify-between text-xs text-neutral-400 mt-1">
              <span>72 DPI (web)</span><span>300 DPI (print)</span>
            </div>
            <p class="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
              Higher DPI = larger file size but sharper images.
            </p>
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
