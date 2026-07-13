/**
 * Image crop using CropperJS (lazy-loaded)
 */
import { formatBytes } from '@/utils/helpers';
import type { ToolProcessResult } from '@/types/index';

export interface CropOptions {
  x: number;
  y: number;
  width: number;
  height: number;
  outputFormat: 'image/jpeg' | 'image/png';
  quality: number;
}

/**
 * Crop an image to the specified rectangle.
 * CropperJS is lazy-loaded — only downloaded when this function is called.
 */
export async function cropImage(
  file: File,
  cropData: CropOptions,
  onProgress: (pct: number) => void,
): Promise<ToolProcessResult> {
  onProgress(10);

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(cropData.width);
  canvas.height = Math.round(cropData.height);

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context not available.');

  if (cropData.outputFormat === 'image/jpeg') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  onProgress(30);

  // Load the image
  const objectUrl = URL.createObjectURL(file);
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error('Failed to load image for cropping.'));
    i.src = objectUrl;
  });

  onProgress(60);

  ctx.drawImage(
    img,
    cropData.x, cropData.y,
    cropData.width, cropData.height,
    0, 0,
    canvas.width, canvas.height,
  );
  URL.revokeObjectURL(objectUrl);

  onProgress(80);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Crop failed.'))),
      cropData.outputFormat,
      cropData.quality,
    );
  });

  onProgress(95);
  const preview = URL.createObjectURL(blob);
  const ext = cropData.outputFormat === 'image/jpeg' ? 'jpg' : 'png';
  const baseName = file.name.replace(/\.[^.]+$/, '');

  onProgress(100);

  return {
    files: [
      {
        name: `${baseName}-cropped.${ext}`,
        blob,
        size: formatBytes(blob.size),
        preview,
      },
    ],
    message: `Cropped to ${canvas.width}×${canvas.height}px`,
  };
}
