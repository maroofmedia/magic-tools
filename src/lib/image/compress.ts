/**
 * Image compression using browser-image-compression (lazy-loaded)
 * Supports single and multiple images seamlessly.
 */
import { formatBytes, fileToDataUrl } from '@/utils/helpers';
import type { ToolProcessResult } from '@/types/index';

export async function compressImages(
  files: File[],
  onProgress: (pct: number) => void,
  targetSizeMB = 1,
): Promise<ToolProcessResult> {
  onProgress(5);

  // Lazy-load the compression library
  const imageCompression = (await import('browser-image-compression')).default;
  onProgress(15);

  const results = [];
  const total = files.length;
  const progressPerFile = 80 / total;

  for (let i = 0; i < total; i++) {
    const file = files[i];
    const fileBaseProgress = 15 + i * progressPerFile;

    const options = {
      maxSizeMB: targetSizeMB,
      useWebWorker: true,
      fileType: (file.type as 'image/jpeg' | 'image/png' | 'image/webp') || 'image/jpeg',
      onProgress: (p: number) => {
        onProgress(Math.min(95, fileBaseProgress + (p / 100) * progressPerFile));
      },
    };

    let compressed: File | Blob;
    try {
      compressed = await imageCompression(file, options);
    } catch {
      // If compression fails for any reason, keep original file
      compressed = file;
    }

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

  if (files.length === 1) {
    return {
      files: results,
      message: `Compressed from ${formatBytes(files[0].size)} to ${formatBytes(results[0].blob.size)}`,
    };
  }

  return {
    files: results,
    message: `Compressed ${files.length} images successfully.`,
  };
}

/** Single file alias */
export async function compressImage(
  file: File,
  onProgress: (pct: number) => void,
  targetSizeMB = 1,
): Promise<ToolProcessResult> {
  return compressImages([file], onProgress, targetSizeMB);
}
