/** @jsxImportSource preact */
/**
 * DropZone.tsx — Drag & Drop file input with validation (Preact island)
 */
import { useState, useRef, useCallback } from 'preact/hooks';
import { validateFileSize, validateFileType, formatBytes } from '@/utils/helpers';

interface Props {
  acceptedTypes: string[];
  acceptedExtensions: string[];
  maxSizeMB: number;
  maxTotalSizeMB?: number;
  multiFile: boolean;
  onFilesSelected: (files: File[]) => void;
  disabled?: boolean;
}

export default function DropZone({
  acceptedTypes,
  acceptedExtensions,
  maxSizeMB,
  maxTotalSizeMB,
  multiFile,
  onFilesSelected,
  disabled = false,
}: Props) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const validate = useCallback((files: File[]): string | null => {
    for (const file of files) {
      const typeErr = validateFileType(file, acceptedTypes);
      if (typeErr) return typeErr;
      const sizeErr = validateFileSize(file, maxSizeMB);
      if (sizeErr) return sizeErr;
    }
    if (maxTotalSizeMB && files.length > 1) {
      const totalBytes = files.reduce((s, f) => s + f.size, 0);
      if (totalBytes > maxTotalSizeMB * 1024 * 1024) {
        return `Total size ${formatBytes(totalBytes)} exceeds the ${maxTotalSizeMB} MB limit.`;
      }
    }
    return null;
  }, [acceptedTypes, maxSizeMB, maxTotalSizeMB]);

  const handleFiles = useCallback((rawFiles: FileList | null) => {
    if (!rawFiles || rawFiles.length === 0) return;
    const files = Array.from(rawFiles);
    const err = validate(files);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    onFilesSelected(multiFile ? files : [files[0]]);
  }, [validate, multiFile, onFilesSelected]);

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;
    handleFiles(e.dataTransfer?.files ?? null);
  }

  function onDragOver(e: DragEvent) {
    e.preventDefault();
    if (!disabled) setIsDragging(true);
  }

  function onDragLeave() {
    setIsDragging(false);
  }

  function onClick() {
    if (!disabled) inputRef.current?.click();
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick();
    }
  }

  return (
    <div class="space-y-3">
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        aria-label={`Drop ${multiFile ? 'files' : 'a file'} here or click to browse`}
        onClick={onClick}
        onKeyDown={onKeyDown}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        class={[
          'relative flex flex-col items-center justify-center gap-4 p-8 sm:p-12',
          'rounded-2xl border-2 border-dashed transition-all duration-200 cursor-pointer',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
          isDragging
            ? 'dropzone-active scale-[1.01]'
            : 'border-neutral-300 dark:border-neutral-700 hover:border-brand-400 dark:hover:border-brand-500 hover:bg-neutral-50 dark:hover:bg-neutral-800/50',
          disabled && 'opacity-50 cursor-not-allowed',
        ].filter(Boolean).join(' ')}
      >
        {/* Upload icon */}
        <div class={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-200 ${isDragging ? 'bg-brand-100 dark:bg-brand-900/50 scale-110' : 'bg-neutral-100 dark:bg-neutral-800'}`}>
          <svg class={`w-7 h-7 transition-colors ${isDragging ? 'text-brand-600 dark:text-brand-400' : 'text-neutral-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/>
          </svg>
        </div>

        {/* Text */}
        <div class="text-center">
          <p class="text-base font-semibold text-neutral-900 dark:text-neutral-100">
            {isDragging ? 'Drop to upload' : `Drop ${multiFile ? 'files' : 'a file'} here`}
          </p>
          <p class="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            or{' '}
            <span class="text-brand-600 dark:text-brand-400 font-medium underline underline-offset-2">
              browse to choose
            </span>
          </p>
          <p class="mt-3 text-xs text-neutral-400 dark:text-neutral-500 font-mono">
            {acceptedExtensions.join(' · ')} · Max {maxSizeMB} MB
            {maxTotalSizeMB ? ` · Total max ${maxTotalSizeMB} MB` : ''}
          </p>
        </div>

        {/* Hidden input */}
        <input
          ref={inputRef}
          type="file"
          class="sr-only"
          accept={acceptedTypes.join(',')}
          multiple={multiFile}
          aria-hidden="true"
          tabIndex={-1}
          onChange={(e) => handleFiles((e.target as HTMLInputElement).files)}
        />
      </div>

      {/* Error message */}
      {error && (
        <div role="alert" class="flex items-start gap-2.5 p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/50 text-sm text-red-700 dark:text-red-400 animate-fade-in">
          <svg class="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} aria-label="Dismiss error" class="ml-auto text-red-400 hover:text-red-600 dark:hover:text-red-300">✕</button>
        </div>
      )}
    </div>
  );
}
