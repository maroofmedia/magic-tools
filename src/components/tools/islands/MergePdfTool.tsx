/** @jsxImportSource preact */
import ToolProcessor from '@/components/tools/ToolProcessor';
import { mergePdfs } from '@/lib/pdf/merge';
import type { ToolConfig } from '@/types/index';

interface Props { tool: ToolConfig }

export default function MergePdfTool({ tool }: Props) {
  return (
    <ToolProcessor
      tool={tool}
      optionsRenderer={(files) => (
        <div class="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200/80 dark:border-neutral-700/60 text-xs text-neutral-600 dark:text-neutral-400">
          <p class="font-semibold text-neutral-900 dark:text-neutral-100 mb-0.5">
            📋 Combine Files
          </p>
          <p>
            {files.length} PDF file{files.length === 1 ? '' : 's'} will be combined in the order listed above.
          </p>
        </div>
      )}
      processFiles={async (files, _options, onProgress) => mergePdfs(files, onProgress)}
    />
  );
}
