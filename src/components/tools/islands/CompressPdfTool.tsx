/** @jsxImportSource preact */
import ToolProcessor from '@/components/tools/ToolProcessor';
import { compressPdf } from '@/lib/pdf/compress';
import type { ToolConfig } from '@/types/index';

interface Props { tool: ToolConfig }

export default function CompressPdfTool({ tool }: Props) {
  return (
    <ToolProcessor
      tool={tool}
      processFiles={async (files, _options, onProgress) => compressPdf(files[0], onProgress)}
    />
  );
}
