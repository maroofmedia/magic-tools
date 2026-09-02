/**
 * PDF merge using pdf-lib (lazy-loaded)
 */
import { formatBytes, fileToArrayBuffer } from '@/utils/helpers';
import { PDFDocument } from 'pdf-lib';
import type { ToolProcessResult } from '@/types/index';

export async function mergePdfs(
  files: File[],
  onProgress: (pct: number) => void,
): Promise<ToolProcessResult> {
  onProgress(10);

  const mergedPdf = await PDFDocument.create();
  const step = 75 / files.length;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    onProgress(15 + i * step);

    const arrayBuffer = await fileToArrayBuffer(file);
    const sourcePdf = await PDFDocument.load(arrayBuffer);
    const pageIndices = sourcePdf.getPageIndices();
    const copiedPages = await mergedPdf.copyPages(sourcePdf, pageIndices);
    copiedPages.forEach((page) => mergedPdf.addPage(page));
    onProgress(15 + (i + 1) * step);
  }

  onProgress(92);
  const pdfBytes = await mergedPdf.save();
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  onProgress(100);

  return {
    files: [
      {
        name: 'merged.pdf',
        blob,
        size: formatBytes(blob.size),
      },
    ],
    message: `Merged ${files.length} PDFs into one (${mergedPdf.getPageCount()} pages)`,
  };
}
