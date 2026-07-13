/** @jsxImportSource preact */
import ToolProcessor from '@/components/tools/ToolProcessor';
import { batchCompressImages } from '@/lib/image/compress';
import type { ToolConfig } from '@/types/index';

interface Props { tool: ToolConfig }

export default function BatchCompressTool({ tool }: Props) {
  return (
    <ToolProcessor
      tool={tool}
      defaultOptions={{ targetSizeMB: 1 }}
      optionsRenderer={(_files, options, setOptions) => (
        <div>
          <label for="batch-target-size" class="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
            Target Size (MB): <strong>{options.targetSizeMB as number} MB</strong>
          </label>
          <input
            id="batch-target-size"
            type="range" min="0.1" max="20" step="0.1"
            value={options.targetSizeMB as number}
            onInput={(e) => setOptions({ ...options, targetSizeMB: parseFloat((e.target as HTMLInputElement).value) })}
            class="w-full accent-brand-600"
          />
          <div class="flex justify-between text-xs text-neutral-400 mt-1">
            <span>0.1 MB</span><span>20 MB</span>
          </div>
        </div>
      )}
      processFiles={async (files, options, onProgress) =>
        batchCompressImages(files, onProgress, options.targetSizeMB as number)
      }
    />
  );
}
