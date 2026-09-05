/** @jsxImportSource preact */
/**
 * DropZone.tsx — Drag & Drop file input with clipboard paste & validation
 */
import { useState, useRef, useCallback, useEffect } from 'preact/hooks';
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

  const handleFiles = useCallback((rawFiles: FileList | File[] | null) => {
    if (!rawFiles || (rawFiles as any).length === 0) return;
    const files = Array.from(rawFiles as any) as File[];
    const err = validate(files);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    onFilesSelected(multiFile ? files : [files[0]]);
  }, [validate, multiFile, onFilesSelected]);

  // Support pasting image files directly from clipboard
  useEffect(() => {
    function handlePaste(e: ClipboardEvent) {
      if (disabled) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      const pastedFiles: File[] = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].kind === 'file') {
          const f = items[i].getAsFile();
          if (f) pastedFiles.push(f);
        }
      }
      if (pastedFiles.length > 0) {
        handleFiles(pastedFiles);
      }
    }
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [disabled, handleFiles]);

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
        aria-label={`Drop ${multiFile ? 'files' : 'a file'} here or browse`}
        onClick={onClick}
        onKeyDown={onKeyDown}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        class={[
          'group relative flex flex-col items-center justify-center gap-3 p-6 sm:p-10',
          'rounded-3xl border-2 border-dashed transition-all duration-200 cursor-pointer text-center',
          'bg-white/90 dark:bg-neutral-900/90 shadow-sm',
          isDragging
            ? 'dropzone-active scale-[1.01] border-brand-500'
            : 'border-neutral-300 dark:border-neutral-700 hover:border-brand-500 dark:hover:border-brand-400 hover:bg-brand-50/10 dark:hover:bg-brand-950/10',
          disabled && 'opacity-50 cursor-not-allowed',
        ].filter(Boolean).join(' ')}
      >
        {/* Prominent iLovePDF-style Select Button */}
        <button
          type="button"
          tabIndex={-1}
          class="inline-flex items-center gap-2.5 px-8 py-3.5 sm:py-4 rounded-2xl bg-brand-600 group-hover:bg-brand-700 text-white text-base sm:text-lg font-bold shadow-lg shadow-brand-500/25 group-hover:scale-105 transition-all pointer-events-none"
        >
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4" />
          </svg>
          <span>Select {multiFile ? 'Files' : 'File'}</span>
        </button>

        {/* Drop subtitle */}
        <p class="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 font-medium">
          {isDragging ? 'Drop your files now' : 'or drop files here'}
        </p>

        {/* Formats & Limit */}
        <div class="pt-1 flex flex-wrap items-center justify-center gap-2 text-[11px] text-neutral-400 dark:text-neutral-500 font-mono">
          <span>{acceptedExtensions.join(' · ')}</span>
          <span>•</span>
          <span>Max {maxSizeMB} MB</span>
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

      {/* Error Alert */}
      {error && (
        <div role="alert" class="flex items-start gap-3 p-4 rounded-2xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800/60 text-xs sm:text-sm text-red-700 dark:text-red-300 animate-fade-in">
          <svg class="w-4.5 h-4.5 flex-shrink-0 text-red-500 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <span class="flex-1 font-medium">{error}</span>
          <button type="button" onClick={() => setError(null)} aria-label="Dismiss error" class="text-red-400 hover:text-red-700 dark:hover:text-red-200">✕</button>
        </div>
      )}
    </div>
  );
}
