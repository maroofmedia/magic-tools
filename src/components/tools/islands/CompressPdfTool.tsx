/** @jsxImportSource preact */
import ToolProcessor from '@/components/tools/ToolProcessor';
import { compressPdf } from '@/lib/pdf/compress';
import type { ToolConfig } from '@/types/index';

interface Props { tool: ToolConfig }

export default function CompressPdfTool({ tool }: Props) {
  return (
    <ToolProcessor
      tool={tool}
      defaultOptions={{ targetSizeMB: 5 }}
      optionsRenderer={(files, options, setOptions) => (
        <div class="space-y-4">
          <div>
            <label for="target-size" class="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
              Target Size (MB): <strong>{options.targetSizeMB as number} MB</strong> (Best effort)
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
            <p class="text-xs text-neutral-500 mt-2">
              Note: PDF compression happens purely by removing redundant data and packing objects. The exact target size cannot be guaranteed locally without data loss.
            </p>
          </div>
        </div>
      )}
      processFiles={async (files, _options, onProgress) => compressPdf(files[0], onProgress)}
    />
  );
}
