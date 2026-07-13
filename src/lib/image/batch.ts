/**
 * Image to PDF conversion using pdf-lib (lazy-loaded)
 */
import { formatBytes, fileToArrayBuffer } from '@/utils/helpers';
import type { ToolProcessResult } from '@/types/index';

export async function imagesToPdf(
  files: File[],
  onProgress: (pct: number) => void,
  margin = 20, // points
): Promise<ToolProcessResult> {
  onProgress(5);

  // Lazy-load pdf-lib
  const { PDFDocument } = await import('pdf-lib');
  onProgress(15);

  const pdfDoc = await PDFDocument.create();
  const step = 80 / files.length;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const arrayBuffer = await fileToArrayBuffer(file);
    onProgress(15 + i * step);

    let image;
    if (file.type === 'image/jpeg') {
      image = await pdfDoc.embedJpg(arrayBuffer);
    } else if (file.type === 'image/png') {
      image = await pdfDoc.embedPng(arrayBuffer);
    } else {
      // For WebP: convert to PNG first via canvas
      const blob = await convertToPngBlob(file);
      const pngBuffer = await blob.arrayBuffer();
      image = await pdfDoc.embedPng(pngBuffer);
    }

    // A4 page in points (72 DPI): 595 × 842
    const pageWidth = 595;
    const pageHeight = 842;

    const { width: iw, height: ih } = image;
    const availW = pageWidth - margin * 2;
    const availH = pageHeight - margin * 2;
    const scale = Math.min(availW / iw, availH / ih);
    const drawW = iw * scale;
    const drawH = ih * scale;
    const x = margin + (availW - drawW) / 2;
    const y = margin + (availH - drawH) / 2;

    const page = pdfDoc.addPage([pageWidth, pageHeight]);
    page.drawImage(image, { x, y, width: drawW, height: drawH });

    onProgress(15 + (i + 1) * step);
  }

  onProgress(95);
  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  onProgress(100);

  const firstName = files[0].name.replace(/\.[^.]+$/, '');

  return {
    files: [
      {
        name: `${firstName}-converted.pdf`,
        blob,
        size: formatBytes(blob.size),
      },
    ],
    message: `Created PDF from ${files.length} image${files.length !== 1 ? 's' : ''}`,
  };
}

async function convertToPngBlob(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error('Failed to load image'));
    i.src = url;
  });
  URL.revokeObjectURL(url);

  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Canvas toBlob failed'))), 'image/png');
  });
}
