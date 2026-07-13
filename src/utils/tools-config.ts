// ─────────────────────────────────────────────
// BrowserTools — Master Tool Registry
// Add new tools here; pages are auto-generated.
// ─────────────────────────────────────────────

import type { ToolConfig, ToolCategory } from '@/types/index';

export const TOOLS: ToolConfig[] = [
  // ── IMAGE TOOLS ──────────────────────────────

  {
    slug: 'compress-image',
    name: 'Compress Image',
    description: 'Reduce image file size while preserving quality.',
    longDescription:
      'Compress JPEG, PNG, and WebP images directly in your browser. Choose your target quality level and get an optimised file in seconds — no upload, no cloud, no waiting.',
    category: 'image',
    icon: '🗜️',
    acceptedTypes: ['image/jpeg', 'image/png', 'image/webp'],
    acceptedExtensions: ['.jpg', '.jpeg', '.png', '.webp'],
    multiFile: false,
    maxSizeMB: 50,
    metaDescription:
      'Compress JPEG, PNG and WebP images in your browser for free. No upload required — 100% private.',
    featured: true,
  },
  {
    slug: 'batch-compress',
    name: 'Batch Image Compression',
    description: 'Compress multiple images at once with one click.',
    longDescription:
      'Upload up to 20 images and compress them all simultaneously. Perfect for optimising a photo gallery or website assets before shipping.',
    category: 'image',
    icon: '📦',
    acceptedTypes: ['image/jpeg', 'image/png', 'image/webp'],
    acceptedExtensions: ['.jpg', '.jpeg', '.png', '.webp'],
    multiFile: true,
    maxSizeMB: 50,
    maxTotalSizeMB: 500,
    metaDescription:
      'Batch compress multiple images at once — JPEG, PNG, WebP. Free, private, browser-only.',
    featured: true,
  },
  {
    slug: 'crop-image',
    name: 'Crop Image',
    description: 'Crop and resize images with an interactive canvas.',
    longDescription:
      'Drag the crop handles to select your desired region. Choose a free-form crop or lock to a preset aspect ratio (1:1, 16:9, 4:3, and more). Download the result as JPEG or PNG.',
    category: 'image',
    icon: '✂️',
    acceptedTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    acceptedExtensions: ['.jpg', '.jpeg', '.png', '.webp', '.gif'],
    multiFile: false,
    maxSizeMB: 20,
    metaDescription:
      'Crop and resize images online — free, no upload, fully private. Supports JPEG, PNG, WebP.',
  },
  {
    slug: 'jpg-to-png',
    name: 'JPG to PNG',
    description: 'Convert JPEG images to lossless PNG format.',
    longDescription:
      'Convert a JPEG photo to PNG without any quality loss from re-encoding. Ideal when you need a transparent-background version or a lossless archive copy.',
    category: 'image',
    icon: '🖼️',
    acceptedTypes: ['image/jpeg'],
    acceptedExtensions: ['.jpg', '.jpeg'],
    multiFile: false,
    maxSizeMB: 50,
    metaDescription:
      'Convert JPG to PNG online — free, instant, browser-only. No account, no upload.',
    featured: true,
  },
  {
    slug: 'png-to-jpg',
    name: 'PNG to JPG',
    description: 'Convert PNG images to JPEG to reduce file size.',
    longDescription:
      'Convert PNG images to JPEG in seconds. Set the quality level to balance file size and visual fidelity. Great for web photos that don\'t need transparency.',
    category: 'image',
    icon: '🔄',
    acceptedTypes: ['image/png'],
    acceptedExtensions: ['.png'],
    multiFile: false,
    maxSizeMB: 50,
    metaDescription:
      'Convert PNG to JPG online — free, private, no upload. Adjust quality and download instantly.',
  },
  {
    slug: 'convert-to-webp',
    name: 'Convert to WebP',
    description: 'Convert images to the modern WebP format.',
    longDescription:
      'WebP images are typically 25–35% smaller than equivalent JPEG or PNG files. Convert any JPEG, PNG, or GIF to WebP for faster page loads.',
    category: 'image',
    icon: '⚡',
    acceptedTypes: ['image/jpeg', 'image/png', 'image/gif'],
    acceptedExtensions: ['.jpg', '.jpeg', '.png', '.gif'],
    multiFile: false,
    maxSizeMB: 50,
    metaDescription:
      'Convert JPEG, PNG or GIF to WebP format free — browser-only, private, instant download.',
    featured: true,
  },
  {
    slug: 'webp-to-png',
    name: 'WebP to PNG',
    description: 'Convert WebP images to PNG format.',
    longDescription:
      'Need your WebP file as a PNG for compatibility with older apps or editors? Convert it here — instantly, in your browser, with no quality loss.',
    category: 'image',
    icon: '📷',
    acceptedTypes: ['image/webp'],
    acceptedExtensions: ['.webp'],
    multiFile: false,
    maxSizeMB: 50,
    metaDescription:
      'Convert WebP to PNG online free — instant, private, no upload required.',
  },
  {
    slug: 'webp-to-jpg',
    name: 'WebP to JPG',
    description: 'Convert WebP images to JPEG format.',
    longDescription:
      'Convert your WebP images to JPEG for maximum compatibility. Adjust quality to control the output file size.',
    category: 'image',
    icon: '🔃',
    acceptedTypes: ['image/webp'],
    acceptedExtensions: ['.webp'],
    multiFile: false,
    maxSizeMB: 50,
    metaDescription:
      'Convert WebP to JPG online free — browser-only, instant, no signup.',
  },
  {
    slug: 'convert-avif',
    name: 'Convert to AVIF',
    description: 'Convert images to the next-gen AVIF format.',
    longDescription:
      'AVIF offers superior compression compared to WebP and JPEG, typically 50% smaller. Convert your images to AVIF for the most efficient web delivery. Note: AVIF encoding requires a modern browser (Chrome 94+, Firefox 113+).',
    category: 'image',
    icon: '🚀',
    acceptedTypes: ['image/jpeg', 'image/png', 'image/webp'],
    acceptedExtensions: ['.jpg', '.jpeg', '.png', '.webp'],
    multiFile: false,
    maxSizeMB: 50,
    metaDescription:
      'Convert images to AVIF format free — browser-only, private, superior compression.',
  },
  {
    slug: 'image-to-pdf',
    name: 'Image to PDF',
    description: 'Convert one or more images into a single PDF.',
    longDescription:
      'Turn JPEG, PNG, or WebP images into a professional PDF document. Upload multiple images and they will be placed on separate pages in order.',
    category: 'image',
    icon: '📄',
    acceptedTypes: ['image/jpeg', 'image/png', 'image/webp'],
    acceptedExtensions: ['.jpg', '.jpeg', '.png', '.webp'],
    multiFile: true,
    maxSizeMB: 50,
    maxTotalSizeMB: 200,
    metaDescription:
      'Convert images to PDF online free — JPEG, PNG, WebP. Browser-only, no upload.',
    featured: true,
  },

  // ── PDF TOOLS ─────────────────────────────────

  {
    slug: 'merge-pdf',
    name: 'Merge PDF',
    description: 'Combine multiple PDFs into one document.',
    longDescription:
      'Drag and drop multiple PDF files and merge them into a single document. Reorder pages before merging. Everything happens locally — your files never leave your device.',
    category: 'pdf',
    icon: '📋',
    acceptedTypes: ['application/pdf'],
    acceptedExtensions: ['.pdf'],
    multiFile: true,
    maxSizeMB: 100,
    maxTotalSizeMB: 500,
    metaDescription:
      'Merge PDF files online free — combine multiple PDFs into one. No upload, 100% private.',
    featured: true,
  },
  {
    slug: 'split-pdf',
    name: 'Split PDF',
    description: 'Extract pages or split a PDF into separate files.',
    longDescription:
      'Split a PDF by page ranges or extract individual pages. You can download each split section separately or all at once as a ZIP. No page limits.',
    category: 'pdf',
    icon: '✂️',
    acceptedTypes: ['application/pdf'],
    acceptedExtensions: ['.pdf'],
    multiFile: false,
    maxSizeMB: 100,
    metaDescription:
      'Split PDF online free — extract pages or split into multiple files. Browser-only, private.',
    featured: true,
  },
  {
    slug: 'compress-pdf',
    name: 'Compress PDF',
    description: 'Reduce PDF file size without losing quality.',
    longDescription:
      'Optimise your PDF by removing redundant objects and compressing content streams. The result is a smaller, faster PDF that\'s easier to share.',
    category: 'pdf',
    icon: '🗜️',
    acceptedTypes: ['application/pdf'],
    acceptedExtensions: ['.pdf'],
    multiFile: false,
    maxSizeMB: 100,
    metaDescription:
      'Compress PDF online free — reduce PDF size browser-side. No upload, fully private.',
  },
  {
    slug: 'pdf-to-images',
    name: 'PDF to Images',
    description: 'Convert PDF pages to JPG or PNG images.',
    longDescription:
      'Render every page of a PDF as a high-quality image. Choose JPEG or PNG output, set the resolution (DPI), and download each page individually or as a ZIP.',
    category: 'pdf',
    icon: '🖼️',
    acceptedTypes: ['application/pdf'],
    acceptedExtensions: ['.pdf'],
    multiFile: false,
    maxSizeMB: 100,
    metaDescription:
      'Convert PDF to images online free — extract pages as JPEG or PNG. Browser-only, private.',
  },
];

/** Lookup a tool by slug */
export function getToolBySlug(slug: string): ToolConfig | undefined {
  return TOOLS.find((t) => t.slug === slug);
}

/** Get all tools in a category */
export function getToolsByCategory(category: ToolCategory): ToolConfig[] {
  return TOOLS.filter((t) => t.category === category);
}

/** Get featured tools */
export function getFeaturedTools(): ToolConfig[] {
  return TOOLS.filter((t) => t.featured);
}

/** All unique categories */
export const CATEGORIES: { id: ToolCategory; label: string; icon: string; description: string }[] = [
  {
    id: 'image',
    label: 'Image Tools',
    icon: '🖼️',
    description: 'Compress, convert, crop, and transform images — entirely in your browser.',
  },
  {
    id: 'pdf',
    label: 'PDF Tools',
    icon: '📄',
    description: 'Merge, split, compress, and convert PDF files — no upload required.',
  },
];
