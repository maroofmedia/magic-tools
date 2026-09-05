/** @jsxImportSource preact */
import { useState, useRef } from 'preact/hooks';
import DropZone from '@/components/tools/DropZone';
import ProgressBar from '@/components/tools/ProgressBar';
import FileThumbnailStrip from '@/components/tools/FileThumbnailStrip';
import { imagesToPdf } from '@/lib/image/batch';
import { downloadBlob, formatBytes, formatTargetSize } from '@/utils/helpers';
import type { ToolConfig, ProcessedFile } from '@/types/index';

interface Props {
  tool: ToolConfig;
}

const SIZE_PRESETS = [
  { label: 'Original Quality', val: 0 },
  { label: '500 KB', val: 500 },
  { label: '1 MB', val: 1024 },
  { label: '2 MB', val: 2048 },
  { label: '5 MB', val: 5120 },
];

export default function ImageToPdfTool({ tool }: Props) {
  const [files, setFiles] = useState<File[]>([]);
  const [sizeLimitKB, setSizeLimitKB] = useState<number>(0);
  const [customUnit, setCustomUnit] = useState<'KB' | 'MB'>('KB');
  const [customValue, setCustomValue] = useState<string>('');
  const [customName, setCustomName] = useState<string>('');
  const [status, setStatus] = useState<'idle' | 'processing' | 'done' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ProcessedFile | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const addInputRef = useRef<HTMLInputElement>(null);

  function addFiles(newFiles: File[]) {
    setFiles((prev) => [...prev, ...newFiles]);
    setStatus('idle');
    setResult(null);
    setErrorMessage('');
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    if (files.length <= 1) {
      reset();
    }
  }

  function updateSizeLimit(kb: number) {
    const clamped = Math.max(0, Math.min(51200, kb));
    setSizeLimitKB(clamped);
    if (clamped === 0) {
      setCustomValue('');
    } else if (customUnit === 'MB') {
      const mb = clamped / 1024;
      setCustomValue(Number.isInteger(mb) ? String(mb) : String(parseFloat(mb.toFixed(2))));
    } else {
      setCustomValue(String(Math.round(clamped)));
    }
  }

  function handleCustomValueChange(valStr: string, unit: 'KB' | 'MB') {
    setCustomValue(valStr);
    const num = parseFloat(valStr);
    if (!isNaN(num) && num > 0) {
      const kb = unit === 'MB' ? Math.round(num * 1024) : Math.round(num);
      setSizeLimitKB(Math.max(10, Math.min(51200, kb)));
    } else if (valStr.trim() === '') {
      setSizeLimitKB(0);
    }
  }

  function handleUnitChange(newUnit: 'KB' | 'MB') {
    setCustomUnit(newUnit);
    if (sizeLimitKB > 0) {
      if (newUnit === 'MB') {
        const mb = sizeLimitKB / 1024;
        setCustomValue(Number.isInteger(mb) ? String(mb) : String(parseFloat(mb.toFixed(2))));
      } else {
        setCustomValue(String(Math.round(sizeLimitKB)));
      }
    }
  }

  async function handleConvert() {
    if (files.length === 0) return;
    setStatus('processing');
    setProgress(0);
    setErrorMessage('');

    try {
      const quality = sizeLimitKB === 0 ? 'original' : sizeLimitKB <= 1024 ? 'small' : 'medium';
      const res = await imagesToPdf(
        files,
        setProgress,
        { sizeLimitKB, quality },
        customName,
      );
      setResult(res.files[0]);
      setStatus('done');
      (window as any).__magictools_toast?.({
        type: 'success',
        title: 'PDF Ready!',
        message: `Created PDF with ${files.length} page(s).`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create PDF.';
      setStatus('error');
      setErrorMessage(msg);
      (window as any).__magictools_toast?.({
        type: 'error',
        title: 'Conversion Failed',
        message: msg,
      });
    }
  }

  function reset() {
    setFiles([]);
    setResult(null);
    setStatus('idle');
    setErrorMessage('');
    setCustomName('');
    setSizeLimitKB(0);
    setCustomValue('');
  }

  const isProcessing = status === 'processing';
  const isDone = status === 'done';

  return (
    <div class="space-y-4 max-w-3xl mx-auto">
      {/* Drop Zone for initial upload */}
      {files.length === 0 && !isDone && (
        <DropZone
          acceptedTypes={tool.acceptedTypes}
          acceptedExtensions={tool.acceptedExtensions}
          maxSizeMB={tool.maxSizeMB}
          maxTotalSizeMB={tool.maxTotalSizeMB}
          multiFile={true}
          onFilesSelected={addFiles}
          disabled={isProcessing}
        />
      )}

      {/* Uploaded Images Horizontal Thumbnail Preview Strip (No nested container) */}
      {files.length > 0 && !isDone && (
        <div class="space-y-3">
          <FileThumbnailStrip
            files={files}
            onRemoveFile={removeFile}
            onClearAll={reset}
            disabled={isProcessing}
            allowReorder={true}
            onReorder={setFiles}
            badgePrefix="Page"
            title={`Page Order (${files.length} ${files.length === 1 ? 'image' : 'images'})`}
          />

          {/* Quick Add More Button */}
          <div class="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => addInputRef.current?.click()}
              disabled={isProcessing}
              class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-xs font-semibold text-neutral-700 dark:text-neutral-300 hover:border-brand-500 hover:text-brand-600 dark:hover:text-brand-400 transition-colors shadow-2xs"
            >
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
              </svg>
              <span>Add more images</span>
            </button>
            <input
              ref={addInputRef}
              type="file"
              multiple
              accept={tool.acceptedTypes.join(',')}
              class="sr-only"
              onChange={(e) => {
                const selected = (e.target as HTMLInputElement).files;
                if (selected && selected.length > 0) {
                  addFiles(Array.from(selected));
                  (e.target as HTMLInputElement).value = '';
                }
              }}
            />
          </div>
        </div>
      )}

      {/* PDF Settings Panel */}
      {files.length > 0 && !isDone && (
        <div class="p-4 sm:p-5 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-2xs space-y-4">
          <div class="flex items-center gap-1.5 pb-2 border-b border-neutral-100 dark:border-neutral-800">
            <svg class="w-4 h-4 text-brand-600 dark:text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"/>
            </svg>
            <h3 class="font-display font-bold text-xs sm:text-sm text-neutral-900 dark:text-white">PDF Settings</h3>
          </div>

          {/* Desired Output Size */}
          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <label class="text-xs sm:text-sm font-semibold text-neutral-800 dark:text-neutral-200">
                Desired Output Size: <span class="text-brand-600 dark:text-brand-400 font-mono font-bold">{sizeLimitKB === 0 ? 'Original (No limit)' : formatTargetSize(sizeLimitKB)}</span>
              </label>
            </div>

            {/* Quick Presets */}
            <div class="space-y-1.5">
              <span class="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                Quick Presets:
              </span>
              <div class="flex flex-wrap gap-1.5">
                {SIZE_PRESETS.map((p) => (
                  <button
                    key={p.val}
                    type="button"
                    onClick={() => updateSizeLimit(p.val)}
                    class={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                      (p.val === 0 && sizeLimitKB === 0) || (p.val > 0 && Math.abs(sizeLimitKB - p.val) < 5)
                        ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400 shadow-xs'
                        : 'border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:border-neutral-300'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Size Box */}
            <div class="p-3 sm:p-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200/80 dark:border-neutral-700/60 space-y-2">
              <label for="image-pdf-custom-size" class="block text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                Custom Desired Size <span class="text-neutral-400 font-normal">(optional, leave blank for original)</span>:
              </label>
              <div class="flex items-center gap-2">
                <input
                  id="image-pdf-custom-size"
                  type="number"
                  min="1"
                  step={customUnit === 'MB' ? '0.1' : '50'}
                  value={customValue}
                  onInput={(e) => handleCustomValueChange((e.target as HTMLInputElement).value, customUnit)}
                  placeholder={customUnit === 'MB' ? 'e.g. 2.5' : 'e.g. 1024'}
                  class="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-xs sm:text-sm font-mono placeholder-neutral-400 focus:border-brand-500 focus:outline-none"
                />

                {/* Unit Switcher: KB / MB */}
                <div class="flex rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 p-0.5 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => handleUnitChange('KB')}
                    class={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                      customUnit === 'KB'
                        ? 'bg-white dark:bg-neutral-700 text-brand-600 dark:text-brand-400 shadow-xs'
                        : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                    }`}
                  >
                    KB
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUnitChange('MB')}
                    class={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                      customUnit === 'MB'
                        ? 'bg-white dark:bg-neutral-700 text-brand-600 dark:text-brand-400 shadow-xs'
                        : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                    }`}
                  >
                    MB
                  </button>
                </div>
              </div>
            </div>

            {/* Slider */}
            <div class="space-y-1">
              <input
                id="pdf-custom-size-slider"
                type="range"
                min="0"
                max="10240"
                step="50"
                value={sizeLimitKB}
                onInput={(e) => updateSizeLimit(parseInt((e.target as HTMLInputElement).value, 10))}
                class="w-full accent-brand-600 cursor-pointer"
              />
              <div class="flex justify-between text-[11px] font-mono text-neutral-400 dark:text-neutral-500">
                <span>0 (Original Quality)</span>
                <span>1 MB</span>
                <span>5 MB</span>
                <span>10 MB</span>
              </div>
            </div>
          </div>

          {/* Optional Rename */}
          <div class="pt-2 border-t border-neutral-100 dark:border-neutral-800">
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
      {isProcessing && (
        <ProgressBar value={progress} label="Creating PDF document…" />
      )}

      {/* Error Banner */}
      {status === 'error' && errorMessage && (
        <div role="alert" class="flex items-start gap-2.5 p-3.5 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800/60">
          <p class="text-xs text-red-700 dark:text-red-400">{errorMessage}</p>
        </div>
      )}

      {/* Action Button */}
      {files.length > 0 && !isDone && (
        <div class="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleConvert}
            disabled={isProcessing}
            id="process-image-to-pdf"
            class="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:bg-neutral-300 dark:disabled:bg-neutral-800 text-white font-semibold text-sm shadow-md shadow-brand-500/20 hover:shadow-brand-500/30 transition-all duration-150 disabled:cursor-not-allowed hover:-translate-y-0.5 active:translate-y-0"
          >
            {isProcessing ? (
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
                <span>Create PDF ({files.length} {files.length === 1 ? 'Page' : 'Pages'})</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Done State */}
      {isDone && result && (
        <div class="space-y-4 animate-fade-in">
          <div class="flex items-center gap-3 p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/90 dark:border-emerald-800/60 shadow-2xs">
            <div class="w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-xs">✓</div>
            <div>
              <p class="font-display font-bold text-xs sm:text-sm text-emerald-950 dark:text-emerald-100">PDF Ready!</p>
              <p class="text-xs text-emerald-800 dark:text-emerald-300 mt-0.5">Created PDF with {files.length} page(s) • {result.size}</p>
            </div>
          </div>

          <div class="p-5 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm space-y-4 max-w-lg">
            <div class="flex items-center justify-between gap-3">
              <div class="min-w-0">
                <p class="text-sm font-semibold text-neutral-900 dark:text-white truncate">{result.name}</p>
                <p class="text-xs text-neutral-500 font-mono mt-0.5">{result.size}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => downloadBlob(result.blob, result.name)}
              class="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs sm:text-sm font-semibold shadow-md shadow-brand-500/20 transition-all hover:-translate-y-0.5"
            >
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
              </svg>
              <span>Download PDF</span>
            </button>
          </div>

          <div class="flex items-center gap-2.5 pt-1">
            <button
              type="button"
              onClick={reset}
              class="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 text-xs sm:text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            >
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
              </svg>
              <span>Convert more photos</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
