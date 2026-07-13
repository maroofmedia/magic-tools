/** @jsxImportSource preact */
import ToolProcessor from '@/components/tools/ToolProcessor';
import { imagesToPdf } from '@/lib/image/batch';
import type { ToolConfig } from '@/types/index';

interface Props { tool: ToolConfig }

export default function ImageToPdfTool({ tool }: Props) {
  return (
    <ToolProcessor
      tool={tool}
      processFiles={async (files, _options, onProgress) => imagesToPdf(files, onProgress)}
    />
  );
}
