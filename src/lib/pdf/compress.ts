/**
 * PDF compression using pdf-lib (lazy-loaded)
 * Removes redundant objects, compresses streams, strips metadata.
 */
import { formatBytes, fileToArrayBuffer } from '@/utils/helpers';
import type { ToolProcessResult } from '@/types/index';

export async function compressPdf(
  file: File,
  onProgress: (pct: number) => void,
): Promise<ToolProcessResult> {
  onProgress(5);

  const { PDFDocument } = await import('pdf-lib');
  onProgress(20);

  const arrayBuffer = await fileToArrayBuffer(file);
  onProgress(40);

  const pdfDoc = await PDFDocument.load(arrayBuffer, {
    // Ignoring encryption errors for robustness
    ignoreEncryption: true,
  });

  // Strip metadata (reduces size and removes personal info)
  pdfDoc.setTitle('');
  pdfDoc.setAuthor('');
  pdfDoc.setSubject('');
  pdfDoc.setKeywords([]);
  pdfDoc.setProducer('Magic Tools');
  pdfDoc.setCreator('Magic Tools');
  onProgress(60);

  // Save with object stream compression
  const pdfBytes = await pdfDoc.save({
    useObjectStreams: true,
    addDefaultPage: false,
    objectsPerTick: 50,
  });

  onProgress(95);
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  onProgress(100);

  const baseName = file.name.replace(/\.[^.]+$/, '');

  return {
    files: [
      {
        name: `${baseName}-compressed.pdf`,
        blob,
        size: formatBytes(blob.size),
      },
    ],
    message: `Compressed from ${formatBytes(file.size)} to ${formatBytes(blob.size)}`,
  };
}
