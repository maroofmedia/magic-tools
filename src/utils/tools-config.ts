// ─────────────────────────────────────────────
// Magic Tools — Master Tool Registry
// Add new tools here; pages are auto-generated.
// ─────────────────────────────────────────────

import type { ToolConfig, ToolCategory } from '@/types/index';

export const TOOLS: ToolConfig[] = [
  // ── IMAGE TOOLS ──────────────────────────────

  {
    slug: 'remove-metadata',
    name: 'Remove Metadata',
    description: 'Strip EXIF, GPS location, and camera tags with 0% quality loss.',
    longDescription:
      'Securely remove EXIF data, GPS location, camera settings, timestamps, and personal metadata from your photos 100% locally on your device. Zero quality loss, no server uploads, supporting all image formats.',
    category: 'image',
    icon: '🛡️',
    acceptedTypes: [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
      'image/svg+xml',
      'image/avif',
      'image/bmp',
      'image/tiff',
      'image/x-icon',
      'image/heic',
      'image/heif',
    ],
    acceptedExtensions: [
      '.jpg',
      '.jpeg',
      '.png',
      '.webp',
      '.gif',
      '.svg',
      '.avif',
      '.bmp',
      '.tiff',
      '.tif',
      '.ico',
      '.heic',
    ],
    multiFile: true,
    maxSizeMB: 50,
    maxTotalSizeMB: 500,
    metaDescription:
      'Remove EXIF data, GPS coordinates, and camera metadata from images online for free without losing quality. 100% private and on-device.',
    featured: true,
  },
  {
    slug: 'compress-image',
    name: 'Compress Image',
    description: 'Reduce image file size while keeping good quality.',
    longDescription:
      'Shrink single or multiple JPEG, PNG, or WebP images in seconds. Pick your target size and save storage easily.',
    category: 'image',
    icon: '🗜️',
    acceptedTypes: ['image/jpeg', 'image/png', 'image/webp'],
    acceptedExtensions: ['.jpg', '.jpeg', '.png', '.webp'],
    multiFile: true,
    maxSizeMB: 50,
    maxTotalSizeMB: 500,
    metaDescription:
      'Compress JPEG, PNG, and WebP images online for free without losing quality.',
    featured: true,
  },
  {
    slug: 'jpg-to-png',
    name: 'JPG to PNG',
    description: 'Convert JPG photos to PNG format.',
    longDescription:
      'Convert JPG images into high quality PNG files instantly.',
    category: 'image',
    icon: '🖼️',
    acceptedTypes: ['image/jpeg'],
    acceptedExtensions: ['.jpg', '.jpeg'],
    multiFile: false,
    maxSizeMB: 50,
    metaDescription:
      'Convert JPG pictures to PNG format online for free.',
    featured: true,
  },
  {
    slug: 'png-to-jpg',
    name: 'PNG to JPG',
    description: 'Convert PNG images to JPG to reduce file size.',
    longDescription:
      'Convert PNG images to JPG format and adjust quality to save storage space.',
    category: 'image',
    icon: '🔄',
    acceptedTypes: ['image/png'],
    acceptedExtensions: ['.png'],
    multiFile: false,
    maxSizeMB: 50,
    metaDescription:
      'Convert PNG images to JPG format online for free with adjustable quality.',
  },
  {
    slug: 'convert-to-webp',
    name: 'Convert to WebP',
    description: 'Convert images to the lightweight WebP format.',
    longDescription:
      'WebP images are smaller and faster to load. Convert your JPG, PNG, or GIF files to WebP easily.',
    category: 'image',
    icon: '⚡',
    acceptedTypes: ['image/jpeg', 'image/png', 'image/gif'],
    acceptedExtensions: ['.jpg', '.jpeg', '.png', '.gif'],
    multiFile: false,
    maxSizeMB: 50,
    metaDescription:
      'Convert JPG, PNG, or GIF pictures to modern WebP format online for free.',
    featured: true,
  },
  {
    slug: 'webp-to-png',
    name: 'WebP to PNG',
    description: 'Convert WebP images to PNG format.',
    longDescription:
      'Convert WebP images back to PNG format so they can be opened in any photo viewer or editor.',
    category: 'image',
    icon: '📷',
    acceptedTypes: ['image/webp'],
    acceptedExtensions: ['.webp'],
    multiFile: false,
    maxSizeMB: 50,
    metaDescription:
      'Convert WebP files to PNG images online for free with full quality.',
  },
  {
    slug: 'webp-to-jpg',
    name: 'WebP to JPG',
    description: 'Convert WebP images to JPG format.',
    longDescription:
      'Convert WebP files to JPG photos for easy sharing and broad device compatibility.',
    category: 'image',
    icon: '🔃',
    acceptedTypes: ['image/webp'],
    acceptedExtensions: ['.webp'],
    multiFile: false,
    maxSizeMB: 50,
    metaDescription:
      'Convert WebP files to JPG photos online for free.',
  },
  {
    slug: 'convert-avif',
    name: 'Convert to AVIF',
    description: 'Convert images to the ultra-efficient AVIF format.',
    longDescription:
      'AVIF offers very small file sizes with crisp image quality. Convert your photos to AVIF easily.',
    category: 'image',
    icon: '🚀',
    acceptedTypes: ['image/jpeg', 'image/png', 'image/webp'],
    acceptedExtensions: ['.jpg', '.jpeg', '.png', '.webp'],
    multiFile: false,
    maxSizeMB: 50,
    metaDescription:
      'Convert images to next-generation AVIF format online for free.',
  },
  {
    slug: 'image-to-pdf',
    name: 'Image to PDF',
    description: 'Turn one or more photos into a PDF document.',
    longDescription:
      'Combine multiple photos into a single, organized PDF document ready for printing or sharing.',
    category: 'image',
    icon: '📄',
    acceptedTypes: ['image/jpeg', 'image/png', 'image/webp'],
    acceptedExtensions: ['.jpg', '.jpeg', '.png', '.webp'],
    multiFile: true,
    maxSizeMB: 50,
    maxTotalSizeMB: 200,
    metaDescription:
      'Convert JPG and PNG photos into a clean PDF document online for free.',
    featured: true,
  },

  // ── PDF TOOLS ─────────────────────────────────

  {
    slug: 'merge-pdf',
    name: 'Merge PDF',
    description: 'Combine multiple PDF files into one document.',
    longDescription:
      'Add multiple PDF documents and combine them into a single file. You can rearrange the order before merging.',
    category: 'pdf',
    icon: '📋',
    acceptedTypes: ['application/pdf'],
    acceptedExtensions: ['.pdf'],
    multiFile: true,
    maxSizeMB: 100,
    maxTotalSizeMB: 500,
    metaDescription:
      'Combine and merge multiple PDF documents into one file online for free.',
    featured: true,
  },
  {
    slug: 'split-pdf',
    name: 'Split PDF',
    description: 'Separate pages or split a PDF into parts.',
    longDescription:
      'Extract individual pages or divide your PDF file into separate documents with ease.',
    category: 'pdf',
    icon: '✂️',
    acceptedTypes: ['application/pdf'],
    acceptedExtensions: ['.pdf'],
    multiFile: false,
    maxSizeMB: 100,
    metaDescription:
      'Split PDF documents and extract specific pages online for free.',
    featured: true,
  },
  {
    slug: 'compress-pdf',
    name: 'Compress PDF',
    description: 'Reduce PDF file size for easier sharing.',
    longDescription:
      'Make your PDF files smaller so they are easier to send via email or upload to websites.',
    category: 'pdf',
    icon: '🗜️',
    acceptedTypes: ['application/pdf'],
    acceptedExtensions: ['.pdf'],
    multiFile: false,
    maxSizeMB: 100,
    metaDescription:
      'Reduce PDF file size online for free while keeping text and images clear.',
  },
  {
    slug: 'pdf-to-images',
    name: 'PDF to Images',
    description: 'Convert PDF pages into JPG or PNG images.',
    longDescription:
      'Turn every page of your PDF into clear photos. Download individual pages or all pages together.',
    category: 'pdf',
    icon: '🖼️',
    acceptedTypes: ['application/pdf'],
    acceptedExtensions: ['.pdf'],
    multiFile: false,
    maxSizeMB: 100,
    metaDescription:
      'Convert PDF pages to high-quality JPG or PNG images online for free.',
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
    description: 'Compress and convert your photos easily.',
  },
  {
    id: 'pdf',
    label: 'PDF Tools',
    icon: '📄',
    description: 'Merge, split, compress, and convert PDF documents.',
  },
];
