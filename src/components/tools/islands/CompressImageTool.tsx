/** @jsxImportSource preact */
import ToolProcessor from '@/components/tools/ToolProcessor';
import { compressImage } from '@/lib/image/compress';
import type { ToolConfig } from '@/types/index';

interface Props { tool: ToolConfig }

export default function CompressImageTool({ tool }: Props) {
  return (
    <ToolProcessor
      tool={tool}
      defaultOptions={{ targetSizeMB: 1, maxWidthOrHeight: 4096 }}
      optionsRenderer={(files, options, setOptions) => (
        <div class="space-y-4">
          <div>
            <label for="target-size" class="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
              Target Size (MB): <strong>{options.targetSizeMB as number} MB</strong>
            </label>
            <input
              id="target-size"
              type="range"
              min="0.1"
              max="20"
              step="0.1"
              value={options.targetSizeMB as number}
              onInput={(e) => setOptions({ ...options, targetSizeMB: parseFloat((e.target as HTMLInputElement).value) })}
              class="w-full accent-brand-600"
            />
            <div class="flex justify-between text-xs text-neutral-400 mt-1">
              <span>0.1 MB</span>
              <span>20 MB</span>
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
          options.targetSizeMB as number,
          options.maxWidthOrHeight as number,
        );
      }}
    />
  );
}
