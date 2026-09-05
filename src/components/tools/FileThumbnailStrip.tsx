/** @jsxImportSource preact */
/**
 * FileThumbnailStrip.tsx — Line-by-line horizontal thumbnail cards for each upload:
 * [ #1 ] [ Thumbnail ]   Filename • Size • Extension   [ Move Up/Down ]   [ ✕ ]
 * [ #2 ] [ Thumbnail ]   Filename • Size • Extension   [ Move Up/Down ]   [ ✕ ]
 * [ #3 ] [ Thumbnail ]   Filename • Size • Extension   [ Move Up/Down ]   [ ✕ ]
 */
import { useState, useEffect, useRef } from 'preact/hooks';
import { formatBytes } from '@/utils/helpers';
import { generateFileThumbnail } from '@/utils/thumbnail';

interface Props {
  files: File[];
  onRemoveFile: (index: number) => void;
  onClearAll?: () => void;
  disabled?: boolean;
  allowReorder?: boolean;
  onReorder?: (newFiles: File[]) => void;
  title?: string;
  badgePrefix?: string; // e.g., "Page" or "#"
}

export default function FileThumbnailStrip({
  files,
  onRemoveFile,
  onClearAll,
  disabled = false,
  allowReorder = false,
  onReorder,
  title,
  badgePrefix = '#',
}: Props) {
  const [thumbnails, setThumbnails] = useState<Record<number, string | null>>({});
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const createdUrlsRef = useRef<string[]>([]);

  // Load and cache thumbnails whenever files change
  useEffect(() => {
    let isMounted = true;

    // Revoke previous object URLs
    createdUrlsRef.current.forEach((url) => {
      if (url.startsWith('blob:')) {
        URL.revokeObjectURL(url);
      }
    });
    createdUrlsRef.current = [];

    const newThumbnails: Record<number, string | null> = {};

    files.forEach((file, index) => {
      generateFileThumbnail(file).then((url) => {
        if (!isMounted) {
          if (url && url.startsWith('blob:')) URL.revokeObjectURL(url);
          return;
        }
        if (url) {
          if (url.startsWith('blob:')) {
            createdUrlsRef.current.push(url);
          }
          setThumbnails((prev) => ({ ...prev, [index]: url }));
        }
      });
    });

    setThumbnails(newThumbnails);

    return () => {
      isMounted = false;
      createdUrlsRef.current.forEach((url) => {
        if (url.startsWith('blob:')) URL.revokeObjectURL(url);
      });
      createdUrlsRef.current = [];
    };
  }, [files]);

  if (files.length === 0) return null;

  const totalBytes = files.reduce((acc, f) => acc + f.size, 0);

  // Drag-and-drop reorder handlers
  function handleDragStart(index: number) {
    if (!allowReorder || disabled) return;
    setDraggedIdx(index);
  }

  function handleDragOver(e: DragEvent, index: number) {
    if (!allowReorder || disabled) return;
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === index) return;
    setDragOverIdx(index);
  }

  function handleDrop(index: number) {
    if (!allowReorder || disabled || draggedIdx === null || draggedIdx === index) {
      setDraggedIdx(null);
      setDragOverIdx(null);
      return;
    }
    const updated = [...files];
    const [moved] = updated.splice(draggedIdx, 1);
    updated.splice(index, 0, moved);
    onReorder?.(updated);
    setDraggedIdx(null);
    setDragOverIdx(null);
  }

  function handleDragEnd() {
    setDraggedIdx(null);
    setDragOverIdx(null);
  }

  function moveItem(fromIdx: number, toIdx: number) {
    if (!allowReorder || disabled || toIdx < 0 || toIdx >= files.length) return;
    const updated = [...files];
    const [moved] = updated.splice(fromIdx, 1);
    updated.splice(toIdx, 0, moved);
    onReorder?.(updated);
  }

  return (
    <div class="space-y-3">
      {/* Header Info */}
      <div class="flex items-center justify-between px-1">
        <div class="flex items-center gap-2">
          <span class="font-display font-bold text-xs sm:text-sm text-neutral-900 dark:text-white">
            {title || (files.length === 1 ? 'Selected File' : `Selected Files (${files.length})`)}
          </span>
          <span class="text-[11px] font-mono text-neutral-500 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-800 px-2.5 py-0.5 rounded-full font-medium">
            {formatBytes(totalBytes)}
          </span>
          {allowReorder && files.length > 1 && (
            <span class="hidden sm:inline text-xs text-neutral-400 dark:text-neutral-500">
              • Drag or use buttons to rearrange order
            </span>
          )}
        </div>
        {onClearAll && (
          <button
            type="button"
            onClick={onClearAll}
            disabled={disabled}
            class="text-xs text-red-600 dark:text-red-400 hover:underline disabled:opacity-50 font-medium"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Stacked Horizontal Line Cards */}
      <div class="space-y-2 max-h-[480px] overflow-y-auto pr-1 scrollbar-thin">
        {files.map((file, index) => {
          const thumbUrl = thumbnails[index];
          const isImage = file.type.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif|svg|avif)$/i.test(file.name);
          const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
          const ext = file.name.split('.').pop()?.toUpperCase() || 'FILE';

          const isBeingDragged = draggedIdx === index;
          const isDragTarget = dragOverIdx === index;

          return (
            <div
              key={`${file.name}-${file.size}-${index}`}
              draggable={allowReorder && !disabled}
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={() => handleDrop(index)}
              onDragEnd={handleDragEnd}
              class={`group relative flex items-center justify-between gap-3 sm:gap-4 p-2.5 sm:p-3 rounded-2xl border transition-all duration-150 bg-white dark:bg-neutral-900 shadow-2xs ${
                allowReorder ? 'cursor-grab active:cursor-grabbing' : ''
              } ${
                isBeingDragged
                  ? 'opacity-40 scale-[0.98] border-brand-500 bg-brand-50/20'
                  : isDragTarget
                  ? 'border-brand-500 ring-2 ring-brand-500/20 scale-[1.01] bg-brand-50/40 dark:bg-brand-950/40'
                  : 'border-neutral-200/90 dark:border-neutral-800 hover:border-brand-300 dark:hover:border-neutral-700'
              }`}
            >
              {/* Left Column: Number Badge + Live Thumbnail */}
              <div class="flex items-center gap-2.5 sm:gap-3.5 min-w-0 flex-1">
                {/* Index / Page Badge */}
                <div class="w-8 sm:w-10 text-center flex-shrink-0">
                  <span class="inline-block px-1.5 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 font-mono text-[10px] sm:text-xs font-bold">
                    {badgePrefix === '#' ? `#${index + 1}` : `${badgePrefix} ${index + 1}`}
                  </span>
                </div>

                {/* Horizontal Live Thumbnail Box */}
                <div class="w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden bg-neutral-100 dark:bg-neutral-800/80 flex-shrink-0 flex items-center justify-center p-1 border border-neutral-200/70 dark:border-neutral-700/60 shadow-2xs">
                  {thumbUrl ? (
                    <img
                      src={thumbUrl}
                      alt={file.name}
                      class="w-full h-full object-contain rounded-lg"
                      loading="lazy"
                    />
                  ) : (
                    <div class="flex flex-col items-center justify-center gap-0.5 text-neutral-400 dark:text-neutral-500">
                      {isPdf ? (
                        <span class="text-xl">📄</span>
                      ) : isImage ? (
                        <span class="text-xl animate-pulse">🖼️</span>
                      ) : (
                        <span class="text-xl">📁</span>
                      )}
                    </div>
                  )}
                </div>

                {/* File Metadata Details */}
                <div class="min-w-0 flex-1 space-y-0.5">
                  <p
                    class="text-xs sm:text-sm font-semibold text-neutral-900 dark:text-neutral-100 truncate"
                    title={file.name}
                  >
                    {file.name}
                  </p>
                  <div class="flex items-center gap-2 text-[11px] font-mono text-neutral-500 dark:text-neutral-400">
                    <span>{formatBytes(file.size)}</span>
                    <span>•</span>
                    <span class="text-[10px] uppercase font-bold px-1.5 py-0.2 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
                      {ext}
                    </span>
                  </div>
                </div>
              </div>

              {/* Right Column: Reorder Arrows (if allowReorder) + Delete Action */}
              <div class="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                {/* Reorder Arrows */}
                {allowReorder && files.length > 1 && !disabled && (
                  <div class="flex items-center gap-0.5 bg-neutral-100 dark:bg-neutral-800 p-0.5 rounded-lg border border-neutral-200/60 dark:border-neutral-700/60">
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={(e) => {
                        e.stopPropagation();
                        moveItem(index, index - 1);
                      }}
                      class="p-1 sm:px-1.5 sm:py-0.5 rounded text-[11px] text-neutral-600 dark:text-neutral-300 hover:bg-white dark:hover:bg-neutral-700 hover:text-brand-600 dark:hover:text-brand-400 disabled:opacity-25 disabled:pointer-events-none transition-all font-medium"
                      title="Move up"
                      aria-label="Move up"
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      disabled={index === files.length - 1}
                      onClick={(e) => {
                        e.stopPropagation();
                        moveItem(index, index + 1);
                      }}
                      class="p-1 sm:px-1.5 sm:py-0.5 rounded text-[11px] text-neutral-600 dark:text-neutral-300 hover:bg-white dark:hover:bg-neutral-700 hover:text-brand-600 dark:hover:text-brand-400 disabled:opacity-25 disabled:pointer-events-none transition-all font-medium"
                      title="Move down"
                      aria-label="Move down"
                    >
                      ▼
                    </button>
                  </div>
                )}

                {/* Remove File Button */}
                {!disabled && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveFile(index);
                    }}
                    aria-label={`Remove ${file.name}`}
                    title="Remove file"
                    class="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/50 dark:hover:text-red-400 text-neutral-500 dark:text-neutral-400 flex items-center justify-center text-xs sm:text-sm font-bold transition-all hover:scale-105 active:scale-95 border border-transparent hover:border-red-200 dark:hover:border-red-800/40"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
