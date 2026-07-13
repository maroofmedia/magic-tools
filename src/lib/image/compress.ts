/**
 * Image compression using browser-image-compression (lazy-loaded)
 */
import { formatBytes, fileToDataUrl } from '@/utils/helpers';
import type { ToolProcessResult } from '@/types/index';

export async function compressImage(
  file: File,
  onProgress: (pct: number) => void,
  targetSizeMB = 1,
  maxWidthOrHeight = 4096,
): Promise<ToolProcessResult> {
  onProgress(10);

  // Lazy-load the compression library
  const imageCompression = (await import('browser-image-compression')).default;

  onProgress(30);

  const options = {
    maxSizeMB: targetSizeMB,
    maxWidthOrHeight,
    useWebWorker: true,
    fileType: file.type as 'image/jpeg' | 'image/png' | 'image/webp',
    onProgress: (p: number) => onProgress(30 + p * 0.6),
  };

  const compressed = await imageCompression(file, options);
  onProgress(95);

  const preview = await fileToDataUrl(compressed);
  onProgress(100);

  const ext = file.name.split('.').pop() ?? 'jpg';
  const baseName = file.name.replace(/\.[^.]+$/, '');

  return {
    files: [
      {
        name: `${baseName}-compressed.${ext}`,
        blob: compressed,
        size: formatBytes(compressed.size),
        preview,
      },
    ],
    message: `Compressed from ${formatBytes(file.size)} to ${formatBytes(compressed.size)}`,
  };
}

export async function batchCompressImages(
  files: File[],
  onProgress: (pct: number) => void,
  targetSizeMB = 1,
): Promise<ToolProcessResult> {
  const imageCompression = (await import('browser-image-compression')).default;
  const results = [];
  const step = 100 / files.length;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    onProgress(i * step);

    const compressed = await imageCompression(file, {
      maxSizeMB: targetSizeMB,
      useWebWorker: true,
      fileType: file.type as 'image/jpeg' | 'image/png' | 'image/webp',
    });

    const preview = await fileToDataUrl(compressed);
    const baseName = file.name.replace(/\.[^.]+$/, '');
    const ext = file.name.split('.').pop() ?? 'jpg';

    results.push({
      name: `${baseName}-compressed.${ext}`,
      blob: compressed,
      size: formatBytes(compressed.size),
      preview,
    });
  }

  onProgress(100);
  return {
    files: results,
    message: `Compressed ${files.length} image${files.length !== 1 ? 's' : ''} successfully.`,
  };
}
