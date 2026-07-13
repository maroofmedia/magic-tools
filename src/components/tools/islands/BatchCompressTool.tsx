/** @jsxImportSource preact */
import ToolProcessor from '@/components/tools/ToolProcessor';
import { batchCompressImages } from '@/lib/image/compress';
import type { ToolConfig } from '@/types/index';

interface Props { tool: ToolConfig }

export default function BatchCompressTool({ tool }: Props) {
  return (
    <ToolProcessor
      tool={tool}
      defaultOptions={{ quality: 0.8 }}
      optionsRenderer={(_files, options, setOptions) => (
        <div>
          <label for="batch-quality" class="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
            Quality: <strong>{Math.round((options.quality as number) * 100)}%</strong>
          </label>
          <input
            id="batch-quality"
            type="range" min="10" max="100" step="5"
            value={Math.round((options.quality as number) * 100)}
            onInput={(e) => setOptions({ ...options, quality: parseInt((e.target as HTMLInputElement).value) / 100 })}
            class="w-full accent-brand-600"
          />
          <div class="flex justify-between text-xs text-neutral-400 mt-1">
            <span>Smaller file</span><span>Best quality</span>
          </div>
        </div>
      )}
      processFiles={async (files, options, onProgress) =>
        batchCompressImages(files, onProgress, options.quality as number)
      }
    />
  );
}
