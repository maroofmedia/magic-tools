/**
 * Image to PDF conversion using pdf-lib (lazy-loaded)
 * Includes options to limit output PDF size & quality.
 */
import { formatBytes, fileToArrayBuffer } from '@/utils/helpers';
import { PDFDocument } from 'pdf-lib';
import type { ToolProcessResult } from '@/types/index';

export interface ImageToPdfOptions {
  sizeLimitKB?: number; // 0 or undefined for original
  quality?: 'original' | 'medium' | 'small';
}

export async function imagesToPdf(
  files: File[],
  onProgress: (pct: number) => void,
  options: ImageToPdfOptions = {},
  customFileName?: string,
): Promise<ToolProcessResult> {
  onProgress(10);

  const pdfDoc = await PDFDocument.create();
  const step = 80 / files.length;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    onProgress(15 + i * step);

    let image;
    // Check if compression / resize is needed
    if (options.quality === 'small' || options.quality === 'medium' || (options.sizeLimitKB && options.sizeLimitKB > 0)) {
      const maxDim = options.quality === 'small' ? 1280 : 1920;
      const q = options.quality === 'small' ? 0.65 : 0.85;
      const optimizedJpg = await optimizeImageToJpeg(file, maxDim, q);
      image = await pdfDoc.embedJpg(optimizedJpg);
    } else {
      if (file.type === 'image/jpeg') {
        const arrayBuffer = await fileToArrayBuffer(file);
        image = await pdfDoc.embedJpg(arrayBuffer);
      } else if (file.type === 'image/png') {
        const arrayBuffer = await fileToArrayBuffer(file);
        image = await pdfDoc.embedPng(arrayBuffer);
      } else {
        // WebP, GIF, AVIF -> convert via canvas to JPEG
        const optimizedJpg = await optimizeImageToJpeg(file, 2048, 0.9);
        image = await pdfDoc.embedJpg(optimizedJpg);
      }
    }

    // A4 page in points (72 DPI): 595 × 842
    const pageWidth = 595;
    const pageHeight = 842;
    const margin = 20;

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
  const pdfBytes = await pdfDoc.save({ useObjectStreams: true });
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  onProgress(100);

  const baseName = customFileName?.trim()
    ? customFileName.trim().replace(/\.pdf$/i, '')
    : `${files[0].name.replace(/\.[^.]+$/, '')}-combined`;

  return {
    files: [
      {
        name: `${baseName}.pdf`,
        blob,
        size: formatBytes(blob.size),
      },
    ],
    message: `Created PDF with ${files.length} page${files.length !== 1 ? 's' : ''}`,
  };
}

async function optimizeImageToJpeg(file: File, maxDim: number, quality: number): Promise<ArrayBuffer> {
  const url = URL.createObjectURL(file);
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error('Failed to load image'));
    i.src = url;
  });
  URL.revokeObjectURL(url);

  let w = img.naturalWidth;
  let h = img.naturalHeight;
  if (w > maxDim || h > maxDim) {
    if (w > h) {
      h = Math.round((h * maxDim) / w);
      w = maxDim;
    } else {
      w = Math.round((w * maxDim) / h);
      h = maxDim;
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  // White background for transparent PNGs
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Failed to encode JPEG'))),
      'image/jpeg',
      quality,
    );
  });

  return blob.arrayBuffer();
}
