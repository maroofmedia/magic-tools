/**
 * Image format conversion using Canvas API
 * Supports: JPG↔PNG, WebP, AVIF (where browser supports encoding)
 */
import { formatBytes, fileToImage, fileToDataUrl } from '@/utils/helpers';
import type { ToolProcessResult } from '@/types/index';

type OutputFormat = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/avif';

const FORMAT_EXT: Record<OutputFormat, string> = {
  'image/jpeg': 'jpg',
  'image/png':  'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
};

/**
 * Convert a single image to a target format using the Canvas API.
 */
export async function convertImage(
  file: File,
  outputFormat: OutputFormat,
  quality: number = 0.92,
  onProgress: (pct: number) => void,
): Promise<ToolProcessResult> {
  onProgress(10);

  // Check AVIF encode support
  if (outputFormat === 'image/avif') {
    const canvas = document.createElement('canvas');
    canvas.width = 1; canvas.height = 1;
    const testUrl = canvas.toDataURL('image/avif');
    if (!testUrl.startsWith('data:image/avif')) {
      throw new Error(
        'AVIF encoding is not supported in your browser. Try Chrome 94+, Firefox 113+, or Safari 16+.',
      );
    }
  }

  const img = await fileToImage(file);
  onProgress(40);

  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context not available.');

  // Fill white background for JPEG output (no transparency)
  if (outputFormat === 'image/jpeg') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.drawImage(img, 0, 0);
  onProgress(70);

  const blob = await canvasToBlob(canvas, outputFormat, quality);
  onProgress(95);

  const preview = URL.createObjectURL(blob);
  const baseName = file.name.replace(/\.[^.]+$/, '');
  const ext = FORMAT_EXT[outputFormat];

  onProgress(100);

  return {
    files: [
      {
        name: `${baseName}.${ext}`,
        blob,
        size: formatBytes(blob.size),
        preview,
      },
    ],
    message: `Converted to ${ext.toUpperCase()} (${formatBytes(blob.size)})`,
  };
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Canvas toBlob failed — the output format may not be supported.'));
      },
      type,
      quality,
    );
  });
}
