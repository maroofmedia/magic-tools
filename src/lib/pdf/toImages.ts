/**
 * PDF to Images using pdfjs-dist (lazy-loaded)
 * Renders each page to a canvas and exports as JPEG or PNG.
 */
import { formatBytes } from '@/utils/helpers';
import type { ToolProcessResult, ProcessedFile } from '@/types/index';

export async function pdfToImages(
  file: File,
  outputFormat: 'image/jpeg' | 'image/png' = 'image/jpeg',
  dpi: number = 150,
  onProgress: (pct: number) => void,
): Promise<ToolProcessResult> {
  onProgress(5);

  // Lazy-load pdfjs-dist
  const pdfjsLib = await import('pdfjs-dist');

  // Set worker source — use the bundled fake worker for SSG compatibility
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString();

  onProgress(10);

  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdfDocument = await loadingTask.promise;
  const totalPages = pdfDocument.numPages;

  onProgress(20);

  const results: ProcessedFile[] = [];
  const baseName = file.name.replace(/\.[^.]+$/, '');
  const ext = outputFormat === 'image/jpeg' ? 'jpg' : 'png';
  const quality = outputFormat === 'image/jpeg' ? 0.92 : 1.0;
  const scale = dpi / 72; // PDF is 72 DPI by default

  const step = 75 / totalPages;

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    onProgress(20 + (pageNum - 1) * step);

    const page = await pdfDocument.getPage(pageNum);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context not available.');

    // White background for JPEG
    if (outputFormat === 'image/jpeg') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    const renderContext = {
      canvasContext: ctx,
      viewport,
    };

    await page.render(renderContext).promise;

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error(`Failed to export page ${pageNum}`))),
        outputFormat,
        quality,
      );
    });

    const preview = URL.createObjectURL(blob);

    results.push({
      name: `${baseName}-page-${String(pageNum).padStart(3, '0')}.${ext}`,
      blob,
      size: formatBytes(blob.size),
      preview,
    });

    onProgress(20 + pageNum * step);
  }

  onProgress(100);

  return {
    files: results,
    message: `Exported ${totalPages} page${totalPages !== 1 ? 's' : ''} as ${ext.toUpperCase()}`,
  };
}
