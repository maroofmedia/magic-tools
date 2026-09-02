/** @jsxImportSource preact */
import { useState, useEffect } from 'preact/hooks';
import DropZone from '@/components/tools/DropZone';
import ProgressBar from '@/components/tools/ProgressBar';
import { imagesToPdf } from '@/lib/image/batch';
import { downloadBlob, formatBytes, formatTargetSize } from '@/utils/helpers';
import type { ToolConfig, ProcessedFile } from '@/types/index';

interface Props {
  tool: ToolConfig;
}

interface ImageItem {
  id: string;
  file: File;
  previewUrl: string;
}

const SIZE_PRESETS = [
  { label: 'Original Quality', val: 0 },
  { label: '500 KB (Compact)', val: 500 },
  { label: '1 MB (Standard)', val: 1024 },
  { label: '2 MB (High)', val: 2048 },
  { label: '5 MB (Large)', val: 5120 },
];

export default function ImageToPdfTool({ tool }: Props) {
  const [items, setItems] = useState<ImageItem[]>([]);
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [sizeLimitKB, setSizeLimitKB] = useState<number>(0);
  const [customName, setCustomName] = useState<string>('');
  const [status, setStatus] = useState<'idle' | 'processing' | 'done' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ProcessedFile | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  // Handle incoming files
  function addFiles(newFiles: File[]) {
    const newItems: ImageItem[] = newFiles.map((file) => ({
      id: Math.random().toString(36).substring(2, 9),
      file,
      previewUrl: URL.createObjectURL(file),
    }));
    setItems((prev) => [...prev, ...newItems]);
    setStatus('idle');
    setResult(null);
    setErrorMessage('');
  }

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      items.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    };
  }, []);

  function removeItem(index: number) {
    URL.revokeObjectURL(items[index].previewUrl);
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function moveItem(fromIndex: number, toIndex: number) {
    if (toIndex < 0 || toIndex >= items.length) return;
    setItems((prev) => {
      const updated = [...prev];
      const [moved] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, moved);
      return updated;
    });
  }

  // Drag and drop reordering
  function handleDragStart(index: number) {
    setDraggedIdx(index);
  }

  function handleDragOver(e: DragEvent, index: number) {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === index) return;
    moveItem(draggedIdx, index);
    setDraggedIdx(index);
  }

  function handleDragEnd() {
    setDraggedIdx(null);
  }

  async function handleConvert() {
    if (items.length === 0) return;
    setStatus('processing');
    setProgress(0);
    setErrorMessage('');

    try {
      const files = items.map((it) => it.file);
      const quality = sizeLimitKB === 0 ? 'original' : sizeLimitKB <= 1024 ? 'small' : 'medium';
      const res = await imagesToPdf(
        files,
        setProgress,
        { sizeLimitKB, quality },
        customName,
      );
      setResult(res.files[0]);
      setStatus('done');
    } catch (err) {
      setStatus('error');
      setErrorMessage(err instanceof Error ? err.message : 'Failed to create PDF.');
    }
  }

  function reset() {
    items.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    setItems([]);
    setResult(null);
    setStatus('idle');
    setErrorMessage('');
    setCustomName('');
  }

  return (
    <div class="space-y-4 max-w-3xl mx-auto">
      {/* Drop Zone when no files or to add more */}
      {status !== 'done' && (
        <DropZone
          acceptedTypes={tool.acceptedTypes}
          acceptedExtensions={tool.acceptedExtensions}
          maxSizeMB={tool.maxSizeMB}
          maxTotalSizeMB={tool.maxTotalSizeMB}
          multiFile={true}
          onFilesSelected={addFiles}
          disabled={status === 'processing'}
        />
      )}

      {/* Uploaded Images with Thumbnails & Drag Reordering */}
      {items.length > 0 && status !== 'done' && (
        <div class="p-4 sm:p-5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-2xs space-y-3">
          <div class="flex items-center justify-between">
            <span class="font-display font-bold text-xs sm:text-sm text-neutral-900 dark:text-white">
              Page Order ({items.length} {items.length === 1 ? 'image' : 'images'}) — <span class="text-neutral-500 dark:text-neutral-400 font-normal">drag or use arrows to rearrange</span>
            </span>
            <button
              type="button"
              onClick={reset}
              disabled={status === 'processing'}
              class="text-xs text-red-600 dark:text-red-400 hover:underline disabled:opacity-50"
            >
              Clear all
            </button>
          </div>

          {/* Thumbnail Grid */}
          <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 max-h-80 overflow-y-auto pr-1">
            {items.map((item, index) => (
              <div
                key={item.id}
                draggable={status !== 'processing'}
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                class={`group relative p-2 rounded-xl border transition-all duration-150 flex flex-col justify-between cursor-grab active:cursor-grabbing select-none bg-neutral-50 dark:bg-neutral-800/80 ${draggedIdx === index ? 'border-brand-500 scale-105 shadow-md bg-brand-50/50' : 'border-neutral-200/80 dark:border-neutral-700/80 hover:border-brand-400'}`}
              >
                {/* Page Number Badge */}
                <div class="absolute top-3 left-3 z-10 px-1.5 py-0.5 rounded-md bg-neutral-900/80 text-white font-mono text-[10px] font-bold shadow-xs">
                  #{index + 1}
                </div>

                {/* Delete Button */}
                {status !== 'processing' && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeItem(index);
                    }}
                    title="Remove image"
                    class="absolute top-3 right-3 z-10 w-5 h-5 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center text-[10px] font-bold shadow-xs transition-transform group-hover:scale-110"
                  >
                    ✕
                  </button>
                )}

                {/* Thumbnail Image */}
                <div class="h-24 w-full rounded-lg overflow-hidden bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center mb-2">
                  <img
                    src={item.previewUrl}
                    alt={item.file.name}
                    class="w-full h-full object-cover"
                  />
                </div>

                {/* File Details */}
                <div class="space-y-1">
                  <p class="text-[11px] font-medium text-neutral-800 dark:text-neutral-200 truncate" title={item.file.name}>
                    {item.file.name}
                  </p>
                  <p class="text-[10px] font-mono text-neutral-500 dark:text-neutral-400">
                    {formatBytes(item.file.size)}
                  </p>
                </div>

                {/* Arrow Reorder Controls */}
                {status !== 'processing' && items.length > 1 && (
                  <div class="flex items-center justify-between mt-2 pt-1 border-t border-neutral-200/60 dark:border-neutral-700/60 text-[10px]">
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={(e) => {
                        e.stopPropagation();
                        moveItem(index, index - 1);
                      }}
                      class="px-1.5 py-0.5 rounded text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 disabled:opacity-30"
                      title="Move earlier in PDF"
                    >
                      ◀ Prev
                    </button>
                    <button
                      type="button"
                      disabled={index === items.length - 1}
                      onClick={(e) => {
                        e.stopPropagation();
                        moveItem(index, index + 1);
                      }}
                      class="px-1.5 py-0.5 rounded text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 disabled:opacity-30"
                      title="Move later in PDF"
                    >
                      Next ▶
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PDF Output Options: Size Limit & Rename */}
      {items.length > 0 && status !== 'done' && (
        <div class="p-4 sm:p-5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-2xs space-y-3.5">
          <div class="flex items-center gap-1.5 pb-2 border-b border-neutral-100 dark:border-neutral-800">
            <svg class="w-4 h-4 text-brand-600 dark:text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"/>
            </svg>
            <h3 class="font-display font-bold text-xs sm:text-sm text-neutral-900 dark:text-white">PDF Settings</h3>
          </div>

          {/* Output Size / Quality Option */}
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <label for="pdf-custom-size-slider" class="text-xs sm:text-sm font-semibold text-neutral-800 dark:text-neutral-200">
                Desired Output Size: <span class="text-brand-600 dark:text-brand-400 font-mono font-bold">{sizeLimitKB === 0 ? 'Original (No limit)' : formatTargetSize(sizeLimitKB)}</span>
              </label>
            </div>

            {/* Quick Presets */}
            <div class="flex flex-wrap gap-1.5">
              {SIZE_PRESETS.map((p) => (
                <button
                  key={p.val}
                  type="button"
                  onClick={() => setSizeLimitKB(p.val)}
                  class={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${sizeLimitKB === p.val ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400 shadow-xs' : 'border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:border-neutral-300'}`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Custom Size Slider & Range */}
            <div class="pt-1 space-y-1">
              <input
                id="pdf-custom-size-slider"
                type="range"
                min="0"
                max="10240"
                step="50"
                value={sizeLimitKB}
                onInput={(e) => setSizeLimitKB(parseInt((e.target as HTMLInputElement).value, 10))}
                class="w-full accent-brand-600 cursor-pointer"
              />
              <div class="flex justify-between text-[10px] font-mono text-neutral-400 dark:text-neutral-500">
                <span>0 (Original)</span>
                <span>100 KB</span>
                <span>1 MB</span>
                <span>5 MB</span>
                <span>10 MB</span>
              </div>
            </div>
          </div>

          {/* Optional Rename */}
          <div class="pt-1">
            <label for="pdf-name" class="block text-xs font-semibold text-neutral-800 dark:text-neutral-200 mb-1">
              Rename File <span class="text-neutral-400 font-normal">(optional)</span>
            </label>
            <div class="flex items-center gap-2">
              <input
                id="pdf-name"
                type="text"
                value={customName}
                onInput={(e) => setCustomName((e.target as HTMLInputElement).value)}
                placeholder="e.g. my-scanned-document"
                class="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-xs sm:text-sm placeholder-neutral-400 focus:border-brand-500 focus:outline-none"
              />
              <span class="text-xs font-mono text-neutral-400 flex-shrink-0">.pdf</span>
            </div>
          </div>
        </div>
      )}

      {/* Progress Bar */}
      {status === 'processing' && (
        <ProgressBar value={progress} label="Creating PDF document…" />
      )}

      {/* Error Banner */}
      {status === 'error' && errorMessage && (
        <div role="alert" class="flex items-start gap-2.5 p-3.5 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800/60">
          <p class="text-xs text-red-700 dark:text-red-400">{errorMessage}</p>
        </div>
      )}

      {/* Action Button */}
      {items.length > 0 && status !== 'done' && (
        <div class="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleConvert}
            disabled={status === 'processing'}
            class="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:bg-neutral-300 text-white font-semibold text-sm shadow-md shadow-brand-500/20 transition-all duration-150 disabled:cursor-not-allowed hover:-translate-y-0.5"
          >
            {status === 'processing' ? (
              <>
                <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                <span>Creating PDF…</span>
              </>
            ) : (
              <>
                <span>📄</span>
                <span>Create PDF ({items.length} {items.length === 1 ? 'Page' : 'Pages'})</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Done State */}
      {status === 'done' && result && (
        <div class="space-y-4 animate-fade-in">
          <div class="flex items-center gap-3 p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/90 dark:border-emerald-800/60 shadow-2xs">
            <div class="w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-xs">✓</div>
            <div>
              <p class="font-display font-bold text-xs sm:text-sm text-emerald-950 dark:text-emerald-100">PDF Ready!</p>
              <p class="text-xs text-emerald-800 dark:text-emerald-300 mt-0.5">Created PDF with {items.length} page(s) • {result.size}</p>
            </div>
          </div>

          <div class="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-2xs space-y-3">
            <div class="flex items-center justify-between gap-3">
              <div class="min-w-0">
                <p class="text-sm font-semibold text-neutral-900 dark:text-white truncate">{result.name}</p>
                <p class="text-xs text-neutral-500 font-mono mt-0.5">{result.size}</p>
              </div>
              <button
                type="button"
                onClick={() => downloadBlob(result.blob, result.name)}
                class="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs sm:text-sm font-semibold shadow-md shadow-brand-500/20 transition-all hover:-translate-y-0.5"
              >
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                </svg>
                <span>Download PDF</span>
              </button>
            </div>
          </div>

          <div class="flex items-center gap-2.5 pt-1">
            <button
              type="button"
              onClick={reset}
              class="px-3.5 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 text-xs sm:text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            >
              Convert more photos
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
