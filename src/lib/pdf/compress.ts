/**
 * PDF compression using pdf-lib (lazy-loaded)
 * Reduces file size and strips unneeded metadata.
 */
import { formatBytes, fileToArrayBuffer } from '@/utils/helpers';
import { PDFDocument } from 'pdf-lib';
import type { ToolProcessResult } from '@/types/index';

export interface CompressPdfOptions {
  level?: 'standard' | 'high' | 'maximum';
  targetSizeKB?: number;
}

export async function compressPdf(
  file: File,
  onProgress: (pct: number) => void,
  _options: CompressPdfOptions = {},
  customFileName?: string,
): Promise<ToolProcessResult> {
  onProgress(10);

  const arrayBuffer = await fileToArrayBuffer(file);
  onProgress(45);

  const pdfDoc = await PDFDocument.load(arrayBuffer, {
    ignoreEncryption: true,
  });

  // Strip metadata to reduce file size
  pdfDoc.setTitle('');
  pdfDoc.setAuthor('');
  pdfDoc.setSubject('');
  pdfDoc.setKeywords([]);
  pdfDoc.setProducer('Magic Tools');
  pdfDoc.setCreator('Magic Tools');
  onProgress(70);

  // Save with object stream compression
  const pdfBytes = await pdfDoc.save({
    useObjectStreams: true,
    addDefaultPage: false,
    objectsPerTick: 50,
  });

  onProgress(95);
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  onProgress(100);

  const baseName = customFileName?.trim()
    ? customFileName.trim().replace(/\.pdf$/i, '')
    : `${file.name.replace(/\.[^.]+$/, '')}-compressed`;

  return {
    files: [
      {
        name: `${baseName}.pdf`,
        blob,
        size: formatBytes(blob.size),
      },
    ],
    message: `Compressed from ${formatBytes(file.size)} to ${formatBytes(blob.size)}`,
  };
}
