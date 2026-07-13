/** @jsxImportSource preact */
/**
 * ConvertFormatTool.tsx — Handles all format conversion tools:
 * jpg-to-png, png-to-jpg, convert-to-webp, webp-to-png, webp-to-jpg, convert-avif
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

const NEEDS_QUALITY = new Set(['png-to-jpg', 'convert-to-webp', 'webp-to-jpg', 'convert-avif']);

export default function ConvertFormatTool({ tool }: Props) {
  const outputFormat = SLUG_TO_FORMAT[tool.slug] ?? 'image/png';
  const showQuality = NEEDS_QUALITY.has(tool.slug);

  return (
    <ToolProcessor
      tool={tool}
      defaultOptions={{ quality: 0.92 }}
      optionsRenderer={showQuality ? (_files, options, setOptions) => (
        <div>
          <label for="convert-quality" class="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
            Quality: <strong>{Math.round((options.quality as number) * 100)}%</strong>
          </label>
          <input
            id="convert-quality"
            type="range" min="50" max="100" step="5"
            value={Math.round((options.quality as number) * 100)}
            onInput={(e) => setOptions({ ...options, quality: parseInt((e.target as HTMLInputElement).value) / 100 })}
            class="w-full accent-brand-600"
          />
          <div class="flex justify-between text-xs text-neutral-400 mt-1">
            <span>Smaller</span><span>Best quality</span>
          </div>
        </div>
      ) : undefined}
      processFiles={async (files, options, onProgress) =>
        convertImage(files[0], outputFormat, options.quality as number, onProgress)
      }
    />
  );
}
