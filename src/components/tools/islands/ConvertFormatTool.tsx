/** @jsxImportSource preact */
/**
 * ConvertFormatTool.tsx — Image format conversion island with quality presets
 */
import ToolProcessor from '@/components/tools/ToolProcessor';
import { convertImage } from '@/lib/image/convert';
import type { ToolConfig } from '@/types/index';

interface Props { tool: ToolConfig }

const SLUG_TO_FORMAT: Record<string, 'image/jpeg' | 'image/png' | 'image/webp' | 'image/avif'> = {
  'jpg-to-png':       'image/png',
  'png-to-jpg':       'image/jpeg',
  'convert-to-webp':  'image/webp',
  'webp-to-png':      'image/png',
  'webp-to-jpg':      'image/jpeg',
  'convert-avif':     'image/avif',
};

const QUALITY_PRESETS = [
  { label: '60% (Compact)', val: 0.60 },
  { label: '80% (Balanced)', val: 0.80 },
  { label: '92% (High Quality)', val: 0.92 },
  { label: '100% (Maximum)', val: 1.00 },
];

const NEEDS_QUALITY = new Set(['png-to-jpg', 'convert-to-webp', 'webp-to-jpg', 'convert-avif']);

export default function ConvertFormatTool({ tool }: Props) {
  const outputFormat = SLUG_TO_FORMAT[tool.slug] ?? 'image/png';
  const showQuality = NEEDS_QUALITY.has(tool.slug);

  return (
    <ToolProcessor
      tool={tool}
      defaultOptions={{ quality: 0.92 }}
      optionsRenderer={showQuality ? (_files, options, setOptions) => (
        <div class="space-y-3">
          <div class="flex items-center justify-between mb-2">
            <label for="convert-quality" class="text-xs sm:text-sm font-semibold text-neutral-800 dark:text-neutral-200">
              Output Compression Quality: <span class="text-brand-600 dark:text-brand-400 font-mono font-bold">{Math.round((options.quality as number) * 100)}%</span>
            </label>
          </div>

          {/* Quality Presets */}
          <div class="flex flex-wrap gap-1.5 mb-3">
            {QUALITY_PRESETS.map((qp) => (
              <button
                key={qp.val}
                type="button"
                onClick={() => setOptions({ ...options, quality: qp.val })}
                class={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${Math.abs((options.quality as number) - qp.val) < 0.02 ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400' : 'border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:border-neutral-300'}`}
              >
                {qp.label}
              </button>
            ))}
          </div>

          <input
            id="convert-quality"
            type="range"
            min="50"
            max="100"
            step="5"
            value={Math.round((options.quality as number) * 100)}
            onInput={(e) => setOptions({ ...options, quality: parseInt((e.target as HTMLInputElement).value) / 100 })}
            class="w-full accent-brand-600 cursor-pointer"
          />
          <div class="flex justify-between text-[11px] font-mono text-neutral-400 dark:text-neutral-500 mt-1">
            <span>50% (Smaller file size)</span>
            <span>100% (Maximum visual fidelity)</span>
          </div>
        </div>
      ) : undefined}
      processFiles={async (files, options, onProgress) =>
        convertImage(files[0], outputFormat, options.quality as number, onProgress)
      }
    />
  );
}
