/**
 * thumbnail.ts — Generates and caches thumbnail preview URLs for images & PDFs
 */

const pdfThumbnailCache = new WeakMap<File, string>();
const heicThumbnailCache = new WeakMap<File, string>();

/**
 * Converts a Uint8Array byte buffer to a Base64 data URL
 */
function bytesToDataUrl(bytes: Uint8Array, mime = 'image/jpeg'): string {
  let binary = '';
  const len = bytes.byteLength;
  const chunkSize = 8192;
  for (let i = 0; i < len; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, len));
    binary += String.fromCharCode.apply(null, chunk as any);
  }
  return `data:${mime};base64,${btoa(binary)}`;
}

/**
 * Fast binary extraction of embedded JPEG thumbnail from HEIC or container buffer.
 * Apple iPhone, Samsung Galaxy, and smartphone HEIC files contain an embedded standard JPEG thumbnail.
 * Scanning and extracting it takes <1ms and works without WebAssembly overhead.
 */
function extractEmbeddedJpegThumbnail(bytes: Uint8Array): Uint8Array | null {
  const len = bytes.length;

  // Strategy 1: Scan for raw JPEG streams (0xFF 0xD8 0xFF ... 0xFF 0xD9)
  for (let i = 0; i < len - 4; i++) {
    if (bytes[i] === 0xff && bytes[i + 1] === 0xd8 && bytes[i + 2] === 0xff) {
      const marker = bytes[i + 3];
      if ((marker >= 0xe0 && marker <= 0xef) || marker === 0xdb || marker === 0xc0 || marker === 0xc2) {
        // Search forward for matching EOI marker (0xFF 0xD9)
        for (let j = i + 10; j < Math.min(len - 1, i + 2000000); j++) {
          if (bytes[j] === 0xff && bytes[j + 1] === 0xd9) {
            const slice = bytes.subarray(i, j + 2);
            if (slice.length >= 100) {
              return slice;
            }
          }
        }
      }
    }
  }

  // Strategy 2: TIFF / EXIF IFD1 / IFD0 pointer extraction
  for (let i = 0; i < len - 12; i++) {
    if (
      (bytes[i] === 0x49 && bytes[i + 1] === 0x49 && bytes[i + 2] === 0x2a && bytes[i + 3] === 0x00) ||
      (bytes[i] === 0x4d && bytes[i + 1] === 0x4d && bytes[i + 2] === 0x00 && bytes[i + 3] === 0x2a)
    ) {
      const isLE = bytes[i] === 0x49;
      const tiffStart = i;

      const readU16 = (pos: number) => {
        if (pos + 2 > len) return 0;
        return isLE ? bytes[pos] | (bytes[pos + 1] << 8) : (bytes[pos] << 8) | bytes[pos + 1];
      };
      const readU32 = (pos: number) => {
        if (pos + 4 > len) return 0;
        return isLE
          ? (bytes[pos] | (bytes[pos + 1] << 8) | (bytes[pos + 2] << 16) | (bytes[pos + 3] << 24)) >>> 0
          : ((bytes[pos] << 24) | (bytes[pos + 1] << 16) | (bytes[pos + 2] << 8) | bytes[pos + 3]) >>> 0;
      };

      const scanIFDForThumb = (ifdOffset: number) => {
        if (ifdOffset <= 0 || tiffStart + ifdOffset + 2 > len) return null;
        const numEntries = readU16(tiffStart + ifdOffset);
        let p = tiffStart + ifdOffset + 2;
        let thumbOffset = 0;
        let thumbLength = 0;

        for (let e = 0; e < numEntries; e++) {
          if (p + 12 > len) break;
          const tag = readU16(p);
          const val = readU32(p + 8);
          if (tag === 0x0201 || tag === 513 || tag === 0x0111 || tag === 273) thumbOffset = val;
          if (tag === 0x0202 || tag === 514 || tag === 0x0117 || tag === 279) thumbLength = val;
          p += 12;
        }

        const candidateOffsets = [
          tiffStart + thumbOffset,
          thumbOffset,
          tiffStart - 6 + thumbOffset,
        ];

        for (const off of candidateOffsets) {
          if (thumbOffset > 0 && thumbLength > 0 && off >= 0 && off + thumbLength <= len) {
            const slice = bytes.subarray(off, off + thumbLength);
            if (slice[0] === 0xff && slice[1] === 0xd8) {
              return slice;
            }
          }
        }
        return null;
      };

      const ifd0Offset = readU32(tiffStart + 4);
      if (ifd0Offset >= 8 && tiffStart + ifd0Offset + 2 <= len) {
        const numEntries0 = readU16(tiffStart + ifd0Offset);
        const ifd0End = tiffStart + ifd0Offset + 2 + numEntries0 * 12;

        // Check IFD1 first (standard thumbnail IFD)
        if (ifd0End + 4 <= len) {
          const ifd1Offset = readU32(ifd0End);
          if (ifd1Offset > 0) {
            const res = scanIFDForThumb(ifd1Offset);
            if (res) return res;
          }
        }

        // Check IFD0 as fallback
        const res0 = scanIFDForThumb(ifd0Offset);
        if (res0) return res0;
      }
    }
  }

  return null;
}

/**
 * Generate a thumbnail preview URL for an image or PDF file.
 * Returns null if thumbnail generation is in progress or not supported.
 */
export async function generateFileThumbnail(file: File): Promise<string | null> {
  if (!file) return null;

  // 1. HEIC / HEIF format handling
  const isHeic =
    file.type === 'image/heic' ||
    file.type === 'image/heif' ||
    /\.(heic|heif|hif)$/i.test(file.name);

  if (isHeic) {
    if (heicThumbnailCache.has(file)) {
      return heicThumbnailCache.get(file)!;
    }

    // Step A: Fast embedded JPEG thumbnail extraction (<1ms)
    try {
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      const thumbBytes = extractEmbeddedJpegThumbnail(bytes);
      if (thumbBytes && thumbBytes.length > 0) {
        const dataUrl = bytesToDataUrl(thumbBytes, 'image/jpeg');
        heicThumbnailCache.set(file, dataUrl);
        return dataUrl;
      }
    } catch (e) {
      console.warn('Fast HEIC thumbnail extraction error, trying fallback:', e);
    }

    // Step B: On-device WASM conversion via heic2any
    try {
      const mod = await import('heic2any');
      const heic2any = (mod as any).default || mod;
      const blob = await heic2any({
        blob: file,
        toType: 'image/jpeg',
        quality: 0.6,
        multiple: false,
      });
      const single: Blob = Array.isArray(blob) ? blob[0] : blob;
      const arrayBuf = await single.arrayBuffer();
      const dataUrl = bytesToDataUrl(new Uint8Array(arrayBuf), 'image/jpeg');
      heicThumbnailCache.set(file, dataUrl);
      return dataUrl;
    } catch (err) {
      console.warn('HEIC thumbnail conversion fallback to direct URL:', err);
      try {
        const url = URL.createObjectURL(file);
        return url;
      } catch {
        return null;
      }
    }
  }

  // 2. Direct Object URL for standard browser image formats
  if (file.type.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif|svg|avif|bmp|ico)$/i.test(file.name)) {
    return URL.createObjectURL(file);
  }

  // 3. PDF Page 1 rendering using pdfjs-dist
  if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
    if (pdfThumbnailCache.has(file)) {
      return pdfThumbnailCache.get(file)!;
    }

    try {
      const pdfjsLib = await import('pdfjs-dist');
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
