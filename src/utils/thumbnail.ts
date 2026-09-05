/**
 * thumbnail.ts — Generates and caches thumbnail preview URLs for images & PDFs
 */

const pdfThumbnailCache = new WeakMap<File, string>();

/**
 * Generate a thumbnail preview URL for an image or PDF file.
 * Returns null if thumbnail generation is in progress or not supported.
 */
export async function generateFileThumbnail(file: File): Promise<string | null> {
  if (!file) return null;

  // 1. Direct Object URL for standard browser image formats
  if (file.type.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif|svg|avif|bmp|ico)$/i.test(file.name)) {
    return URL.createObjectURL(file);
  }

  // 2. PDF Page 1 rendering using pdfjs-dist
  if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
    if (pdfThumbnailCache.has(file)) {
      return pdfThumbnailCache.get(file)!;
    }

    try {
      const pdfjsLib = await import('pdfjs-dist');
      // Set worker source
      try {
        pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
          'pdfjs-dist/build/pdf.worker.min.mjs',
          import.meta.url,
        ).toString();
      } catch {
        // Fallback worker configuration if URL constructor fails in some bundler environments
      }

      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      const page = await pdf.getPage(1);

      // Render at a sensible thumbnail scale (width ~200-300px)
      const unscaledViewport = page.getViewport({ scale: 1.0 });
      const targetWidth = 240;
      const scale = Math.min(2.0, Math.max(0.3, targetWidth / unscaledViewport.width));
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement('canvas');
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);

      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      // Clean white background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      await page.render({
        canvasContext: ctx,
        viewport,
      }).promise;

      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      pdfThumbnailCache.set(file, dataUrl);
      return dataUrl;
    } catch (err) {
      console.warn('Could not generate PDF thumbnail:', err);
      return null;
    }
  }

  return null;
}
