/** @jsxImportSource preact */
import ToolProcessor from '@/components/tools/ToolProcessor';
import { imagesToPdf } from '@/lib/image/batch';
import type { ToolConfig } from '@/types/index';

interface Props { tool: ToolConfig }

export default function ImageToPdfTool({ tool }: Props) {
  return (
    <ToolProcessor
      tool={tool}
      optionsRenderer={(files) => (
        <div class="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200/80 dark:border-neutral-700/60 text-xs sm:text-sm text-neutral-600 dark:text-neutral-400">
          <p class="font-semibold text-neutral-900 dark:text-neutral-100 mb-1">
            📄 Page Sequence
          </p>
          <p>
            {files.length} image{files.length === 1 ? '' : 's'} will be placed onto separate A4 pages in the order listed above.
          </p>
        </div>
      )}
      processFiles={async (files, _options, onProgress) => imagesToPdf(files, onProgress)}
    />
  );
}
