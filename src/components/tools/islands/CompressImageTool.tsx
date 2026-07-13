/** @jsxImportSource preact */
import ToolProcessor from '@/components/tools/ToolProcessor';
import { compressImage } from '@/lib/image/compress';
import type { ToolConfig } from '@/types/index';

interface Props { tool: ToolConfig }

export default function CompressImageTool({ tool }: Props) {
  return (
    <ToolProcessor
      tool={tool}
      defaultOptions={{ quality: 0.8, maxWidthOrHeight: 4096 }}
      optionsRenderer={(files, options, setOptions) => (
        <div class="space-y-4">
          <div>
            <label for="quality-slider" class="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
              Quality: <strong>{Math.round((options.quality as number) * 100)}%</strong>
            </label>
            <input
              id="quality-slider"
              type="range"
              min="10"
              max="100"
              step="5"
              value={Math.round((options.quality as number) * 100)}
              onInput={(e) => setOptions({ ...options, quality: parseInt((e.target as HTMLInputElement).value) / 100 })}
              class="w-full accent-brand-600"
            />
            <div class="flex justify-between text-xs text-neutral-400 mt-1">
              <span>Smaller file</span>
              <span>Best quality</span>
            </div>
          </div>
          <div>
            <label for="max-dimension" class="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
              Max dimension: <strong>{options.maxWidthOrHeight as number}px</strong>
            </label>
            <input
              id="max-dimension"
              type="range"
              min="512"
              max="8192"
              step="256"
              value={options.maxWidthOrHeight as number}
              onInput={(e) => setOptions({ ...options, maxWidthOrHeight: parseInt((e.target as HTMLInputElement).value) })}
              class="w-full accent-brand-600"
            />
            <div class="flex justify-between text-xs text-neutral-400 mt-1">
              <span>512px</span>
              <span>8192px</span>
            </div>
          </div>
        </div>
      )}
      processFiles={async (files, options, onProgress) => {
        return compressImage(
          files[0],
          onProgress,
          options.quality as number,
          options.maxWidthOrHeight as number,
        );
      }}
    />
  );
}
