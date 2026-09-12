// ─────────────────────────────────────────────
// General helper utilities
// ─────────────────────────────────────────────

/**
 * Format bytes to a human-readable string.
 * e.g. 1234567 → "1.2 MB"
 */
export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`;
}

/**
 * Format a compression ratio as a percentage reduction.
 * e.g. (original=1000, compressed=600) → "-40%"
 */
export function formatReduction(original: number, compressed: number): string {
  if (original === 0) return '0%';
  const pct = ((original - compressed) / original) * 100;
  return pct > 0 ? `-${pct.toFixed(1)}%` : `+${Math.abs(pct).toFixed(1)}%`;
}

/**
 * Generate a short unique ID (not cryptographically secure).
 */
export function uid(): string {
  return Math.random().toString(36).slice(2, 9);
}

/**
 * Download a Blob as a file.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Strip the extension from a filename.
 */
export function stripExtension(filename: string): string {
  return filename.replace(/\.[^.]+$/, '');
}

/**
 * Clamp a number between min and max.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Debounce a function.
 */
export function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  delay: number,
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Validate file size against a limit in MB.
 */
export function validateFileSize(file: File, maxMB: number): string | null {
  if (file.size > maxMB * 1024 * 1024) {
    return `File "${file.name}" exceeds the ${maxMB} MB limit (${formatBytes(file.size)}).`;
  }
  return null;
}

/**
 * Validate MIME type and/or file extension against allowed lists.
 */
export function validateFileType(
  file: File,
  acceptedTypes: string[],
  acceptedExtensions?: string[],
): string | null {
  const fileType = (file.type || '').toLowerCase().trim();
  const fileName = (file.name || '').toLowerCase().trim();
  const fileExt = fileName.includes('.') ? `.${fileName.split('.').pop()}` : '';

  // 1. Check direct MIME type match
  if (fileType && acceptedTypes.some((t) => t.toLowerCase() === fileType)) {
    return null;
  }

  // 2. Check wildcard MIME type (e.g. "image/*")
  if (fileType && acceptedTypes.some((t) => t.endsWith('/*') && fileType.startsWith(t.slice(0, -1)))) {
    return null;
  }

  // 3. Check acceptedExtensions (e.g. [".jpg", ".jpeg", ".heic", ".heif", ...])
  if (acceptedExtensions && fileExt && acceptedExtensions.some((ext) => ext.toLowerCase() === fileExt)) {
    return null;
  }

  // 4. Common extension to MIME mapping fallback (handles empty/missing OS MIME types)
  const EXT_TO_MIMES: Record<string, string[]> = {
    '.heic': ['image/heic', 'image/heif'],
    '.heif': ['image/heic', 'image/heif'],
    '.hif': ['image/heic', 'image/heif'],
    '.jpg': ['image/jpeg'],
    '.jpeg': ['image/jpeg'],
    '.png': ['image/png'],
    '.webp': ['image/webp'],
    '.gif': ['image/gif'],
    '.svg': ['image/svg+xml'],
    '.avif': ['image/avif'],
    '.bmp': ['image/bmp'],
    '.tiff': ['image/tiff'],
    '.tif': ['image/tiff'],
    '.ico': ['image/x-icon', 'image/vnd.microsoft.icon', 'image/ico'],
    '.pdf': ['application/pdf'],
  };

  const candidateMimes = EXT_TO_MIMES[fileExt];
  if (candidateMimes && candidateMimes.some((m) => acceptedTypes.includes(m))) {
    return null;
  }

  return `File "${file.name}" is not a supported format.`;
}

/**
 * Create an object URL preview and clean it up after use.
 */
export function createPreview(file: File): string {
  return URL.createObjectURL(file);
}

/**
 * Convert a File to a base64 data URL.
 */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

/**
 * Convert a File to an ArrayBuffer.
 */
export function fileToArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Load an HTMLImageElement from a File.
 */
export function fileToImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };
    img.src = url;
  });
}

/**
 * Pack multiple Blobs into a ZIP using streaming compression.
 * Falls back to individual downloads if CompressionStream not available.
 */
export async function createZip(
  files: { name: string; blob: Blob }[],
): Promise<Blob> {
  // Use JSZip if available, otherwise dynamic import
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  for (const { name, blob } of files) {
    zip.file(name, blob);
  }
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
}

/**
 * Format target size into friendly units.
 * Shows in KB below 1024 KB, then shows in MB.
 */
export function formatTargetSize(sizeKB: number): string {
  if (sizeKB < 1024) {
    return `${Math.round(sizeKB)} KB`;
  }
  const mb = sizeKB / 1024;
  return `${Number.isInteger(mb) ? mb : parseFloat(mb.toFixed(1))} MB`;
}
