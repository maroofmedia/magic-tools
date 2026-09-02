/**
 * PDF split using pdf-lib (lazy-loaded)
 */
import { formatBytes, fileToArrayBuffer } from '@/utils/helpers';
import { PDFDocument } from 'pdf-lib';
import type { ToolProcessResult, ProcessedFile } from '@/types/index';

export interface SplitRange {
  label: string;
  pages: number[]; // 0-indexed page numbers
}

/**
 * Split a PDF into multiple PDFs by page ranges.
 * Each range becomes one output file.
 */
export async function splitPdf(
  file: File,
  ranges: SplitRange[],
  onProgress: (pct: number) => void,
): Promise<ToolProcessResult> {
  onProgress(10);

  const arrayBuffer = await fileToArrayBuffer(file);
  const sourcePdf = await PDFDocument.load(arrayBuffer);
  onProgress(30);

  const totalPages = sourcePdf.getPageCount();
  const results: ProcessedFile[] = [];
  const step = 60 / ranges.length;
  const baseName = file.name.replace(/\.[^.]+$/, '');

  for (let i = 0; i < ranges.length; i++) {
    const range = ranges[i];
    onProgress(30 + i * step);

    const newPdf = await PDFDocument.create();
    // Filter out out-of-bounds page indices
    const validPages = range.pages.filter((p) => p >= 0 && p < totalPages);
    if (validPages.length === 0) continue;

    const copiedPages = await newPdf.copyPages(sourcePdf, validPages);
    copiedPages.forEach((page) => newPdf.addPage(page));

    const pdfBytes = await newPdf.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });

    results.push({
      name: `${baseName}-${range.label}.pdf`,
      blob,
      size: formatBytes(blob.size),
    });

    onProgress(30 + (i + 1) * step);
  }

  onProgress(100);

  return {
    files: results,
    message: `Split into ${results.length} PDF${results.length !== 1 ? 's' : ''}`,
  };
}

/**
 * Helper: build page ranges from a string like "1-3, 5, 7-9"
 * Returns 0-indexed SplitRange[]
 */
export function parsePageRanges(input: string, totalPages: number): SplitRange[] {
  const parts = input.split(',').map((s) => s.trim()).filter(Boolean);
  const ranges: SplitRange[] = [];

  for (const part of parts) {
    if (part.includes('-')) {
      const [startStr, endStr] = part.split('-');
      const start = parseInt(startStr, 10) - 1;
      const end = parseInt(endStr, 10) - 1;
      if (isNaN(start) || isNaN(end)) continue;
      const pages = [];
      for (let i = Math.max(0, start); i <= Math.min(totalPages - 1, end); i++) {
        pages.push(i);
      }
      ranges.push({ label: `pages-${start + 1}-${end + 1}`, pages });
    } else {
      const pg = parseInt(part, 10) - 1;
      if (!isNaN(pg) && pg >= 0 && pg < totalPages) {
        ranges.push({ label: `page-${pg + 1}`, pages: [pg] });
      }
    }
  }

  return ranges;
}
