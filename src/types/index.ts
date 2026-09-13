// ─────────────────────────────────────────────
// Magic Tools — Master Type Definitions
// ─────────────────────────────────────────────

/** Categories available for tools */
export type ToolCategory = 'image' | 'pdf' | 'spreadsheet';

/** Processing status */
export type ProcessStatus = 'idle' | 'loading' | 'processing' | 'done' | 'error';

/** A single processed result file */
export interface ProcessedFile {
  /** Display name for the output file */
  name: string;
  /** The generated Blob */
  blob: Blob;
  /** Human-readable size string, e.g. "1.2 MB" */
  size: string;
  /** Optional preview URL (for images) */
  preview?: string;
}

/** Input file wrapper */
export interface InputFile {
  file: File;
  preview?: string;
  id: string;
}

/** Tool configuration entry — drives all tool pages */
export interface ToolConfig {
  /** URL slug, e.g. "compress-image" */
  slug: string;
  /** Display name */
  name: string;
  /** Short description shown in cards */
  description: string;
  /** Long description shown on the tool page */
  longDescription: string;
  /** Category */
  category: ToolCategory;
  /** Emoji icon */
  icon: string;
  /** Accepted MIME types for the file picker */
  acceptedTypes: string[];
  /** Accepted file extensions for display */
  acceptedExtensions: string[];
  /** Whether multiple files can be uploaded at once */
  multiFile: boolean;
  /** Maximum file size in MB per file */
  maxSizeMB: number;
  /** Maximum total file size in MB (for multi) */
  maxTotalSizeMB?: number;
  /** SEO meta description */
  metaDescription: string;
  /** Whether this tool is featured on homepage */
  featured?: boolean;
  /** Whether it is coming soon */
  comingSoon?: boolean;
}

/** Options passed to each tool's processing function */
export interface ToolProcessOptions {
  files: File[];
  /** Tool-specific options object */
  options?: Record<string, unknown>;
  /** Callback to update progress (0–100) */
  onProgress: (pct: number) => void;
}

/** Result returned by a tool processing function */
export interface ToolProcessResult {
  files: ProcessedFile[];
  message?: string;
}

/** Toast notification entry */
export interface ToastEntry {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
}

/** SEO props for BaseLayout */
export interface SEOProps {
  title: string;
  description: string;
  canonical?: string;
  ogImage?: string;
  ogType?: 'website' | 'article';
  noindex?: boolean;
}
