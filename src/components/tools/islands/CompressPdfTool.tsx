/** @jsxImportSource preact */
import ToolProcessor from '@/components/tools/ToolProcessor';
import { compressPdf } from '@/lib/pdf/compress';
import type { ToolConfig } from '@/types/index';

interface Props { tool: ToolConfig }

export default function CompressPdfTool({ tool }: Props) {
  return (
    <ToolProcessor
      tool={tool}
      defaultOptions={{}}
      optionsRenderer={() => (
        <div class="space-y-3">
          <div class="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200/80 dark:border-neutral-700/60 text-xs sm:text-sm text-neutral-600 dark:text-neutral-400 space-y-2">
            <p class="font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
              <span>⚡</span>
              <span>Lossless In-Browser Optimization</span>
            </p>
            <p class="leading-relaxed">
              PDF compression strips unused font subsets, dead references, metadata streams, and packs object dictionaries using Flate stream compression without altering text clarity.
            </p>
          </div>
        </div>
      )}
      processFiles={async (files, _options, onProgress) => compressPdf(files[0], onProgress)}
    />
  );
}
