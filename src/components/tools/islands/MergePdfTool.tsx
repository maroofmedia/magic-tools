/** @jsxImportSource preact */
import ToolProcessor from '@/components/tools/ToolProcessor';
import { mergePdfs } from '@/lib/pdf/merge';
import type { ToolConfig } from '@/types/index';

interface Props { tool: ToolConfig }

export default function MergePdfTool({ tool }: Props) {
  return (
    <ToolProcessor
      tool={tool}
      processFiles={async (files, _options, onProgress) => mergePdfs(files, onProgress)}
    />
  );
}
