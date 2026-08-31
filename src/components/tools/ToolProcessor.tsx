/** @jsxImportSource preact */
/**
 * ToolProcessor.tsx — Generic tool lifecycle controller with queue management & results
 */
import { useState, useCallback } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import DropZone from './DropZone';
import ProgressBar from './ProgressBar';
import { downloadBlob, formatBytes, formatReduction } from '@/utils/helpers';
import type { ProcessedFile, ToolConfig, ToolProcessResult } from '@/types/index';

interface Props {
  tool: ToolConfig;
  processFiles: (
    files: File[],
    options: Record<string, unknown>,
    onProgress: (pct: number) => void,
  ) => Promise<ToolProcessResult>;
  optionsRenderer?: (
    files: File[],
    options: Record<string, unknown>,
    setOptions: (o: Record<string, unknown>) => void,
  ) => ComponentChildren;
  defaultOptions?: Record<string, unknown>;
}

export default function ToolProcessor({ tool, processFiles, optionsRenderer, defaultOptions = {} }: Props) {
  const [files, setFiles] = useState<File[]>([]);
  const [options, setOptions] = useState<Record<string, unknown>>(defaultOptions);
  const [status, setStatus] = useState<'idle' | 'processing' | 'done' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<ProcessedFile[]>([]);
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const onFilesSelected = useCallback((selected: File[]) => {
    setFiles((prev) => (tool.multiFile ? [...prev, ...selected] : selected));
    setResults([]);
    setStatus('idle');
    setErrorMessage('');
  }, [tool.multiFile]);

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    if (files.length <= 1) {
      reset();
    }
  }

  const handleProcess = useCallback(async () => {
    if (files.length === 0) return;
    setStatus('processing');
    setProgress(0);
    setErrorMessage('');

    try {
      const result = await processFiles(files, options, (pct) => setProgress(pct));
      setResults(result.files);
      const msg = result.message ?? `Successfully processed ${result.files.length} file${result.files.length !== 1 ? 's' : ''}.`;
      setSuccessMessage(msg);
      setStatus('done');
      setProgress(100);
      (window as any).__magictools_toast?.({
        type: 'success',
        title: 'Task Complete!',
        message: msg,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'An unexpected error occurred during processing.';
      setErrorMessage(msg);
      setStatus('error');
      (window as any).__magictools_toast?.({
        type: 'error',
        title: 'Processing Failed',
        message: msg,
      });
    }
  }, [files, options, processFiles]);

  function reset() {
    setFiles([]);
    setResults([]);
    setStatus('idle');
    setProgress(0);
    setErrorMessage('');
    setSuccessMessage('');
    setOptions(defaultOptions);
  }

  const isProcessing = status === 'processing';
  const isDone = status === 'done';

  return (
    <div class="space-y-6 max-w-4xl mx-auto">
      {/* Drop Zone */}
      {!isDone && (
        <DropZone
          acceptedTypes={tool.acceptedTypes}
          acceptedExtensions={tool.acceptedExtensions}
          maxSizeMB={tool.maxSizeMB}
          maxTotalSizeMB={tool.maxTotalSizeMB}
          multiFile={tool.multiFile}
          onFilesSelected={onFilesSelected}
          disabled={isProcessing}
        />
      )}

      {/* Selected File Queue */}
      {files.length > 0 && !isDone && (
        <div class="p-5 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-xs space-y-3">
          <div class="flex items-center justify-between">
            <span class="font-display font-bold text-sm text-neutral-900 dark:text-white">
              Selected {files.length === 1 ? 'File' : `Files (${files.length})`}
            </span>
            <button
              type="button"
              onClick={reset}
              disabled={isProcessing}
              class="text-xs text-red-600 dark:text-red-400 hover:underline disabled:opacity-50"
            >
              Clear all
            </button>
          </div>

          <div class="space-y-2 max-h-60 overflow-y-auto pr-1">
            {files.map((file, i) => (
              <div key={i} class="flex items-center justify-between gap-3 p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/80 border border-neutral-200/60 dark:border-neutral-700/60 text-xs sm:text-sm">
                <div class="flex items-center gap-2.5 min-w-0 flex-1">
                  <span class="w-8 h-8 rounded-lg bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center text-neutral-600 dark:text-neutral-300 font-mono text-[11px] uppercase flex-shrink-0 font-bold">
                    {file.name.split('.').pop() || 'file'}
                  </span>
                  <span class="truncate font-medium text-neutral-800 dark:text-neutral-200">{file.name}</span>
                </div>
                <div class="flex items-center gap-3 flex-shrink-0">
                  <span class="font-mono text-xs text-neutral-500 dark:text-neutral-400">{formatBytes(file.size)}</span>
                  {!isProcessing && (
                    <button
                      type="button"
                      onClick={() => removeFile(i)}
                      aria-label={`Remove ${file.name}`}
                      class="w-6 h-6 rounded-lg text-neutral-400 hover:text-red-500 hover:bg-neutral-200 dark:hover:bg-neutral-700 flex items-center justify-center transition-colors"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tool-Specific Options Panel */}
      {files.length > 0 && !isDone && optionsRenderer && (
        <div class="p-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-xs space-y-4">
          <div class="flex items-center gap-2 pb-2 border-b border-neutral-100 dark:border-neutral-800">
            <svg class="w-4 h-4 text-brand-600 dark:text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"/>
            </svg>
            <h3 class="font-display font-bold text-sm text-neutral-900 dark:text-white">Configuration Options</h3>
          </div>
          {optionsRenderer(files, options, setOptions)}
        </div>
      )}

      {/* Processing Progress Bar */}
      {isProcessing && (
        <ProgressBar value={progress} label="Executing client-side processing…" />
      )}

      {/* Error Banner */}
      {status === 'error' && errorMessage && (
        <div role="alert" class="flex items-start gap-3 p-4 rounded-2xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800/60 animate-fade-in">
          <svg class="w-5 h-5 flex-shrink-0 text-red-500 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <div>
            <p class="text-sm font-semibold text-red-800 dark:text-red-300">Processing Failed</p>
            <p class="text-xs sm:text-sm text-red-700 dark:text-red-400 mt-0.5 leading-relaxed">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Process Action Button */}
      {files.length > 0 && !isDone && (
        <div class="flex items-center gap-3">
          <button
            type="button"
            onClick={handleProcess}
            disabled={isProcessing}
            id={`process-${tool.slug}`}
            class="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2.5 px-8 py-3.5 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:bg-neutral-300 dark:disabled:bg-neutral-800 text-white font-semibold text-sm sm:text-base shadow-lg shadow-brand-500/25 hover:shadow-brand-500/35 disabled:shadow-none transition-all duration-200 disabled:cursor-not-allowed hover:-translate-y-0.5 active:translate-y-0"
          >
            {isProcessing ? (
              <>
                <svg class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                <span>Processing Files…</span>
              </>
            ) : (
              <>
                <span>{tool.icon}</span>
                <span>Process with {tool.name}</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Results Showcase */}
      {isDone && results.length > 0 && (
        <div class="space-y-6 animate-fade-in">
          {/* Success Banner */}
          <div class="flex items-center gap-3.5 p-4 sm:p-5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/90 dark:border-emerald-800/60 shadow-2xs">
            <div class="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center flex-shrink-0 font-bold text-sm">
              ✓
            </div>
            <div class="min-w-0 flex-1">
              <p class="font-display font-bold text-sm sm:text-base text-emerald-950 dark:text-emerald-100">
                Processing Completed Successfully!
              </p>
              <p class="text-xs sm:text-sm text-emerald-800 dark:text-emerald-300 mt-0.5 truncate">
                {successMessage}
              </p>
            </div>
          </div>

          {/* Results Grid */}
          <div class={`grid gap-4 ${results.length > 1 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 max-w-lg'}`}>
            {results.map((result, i) => (
              <div key={i} class="p-5 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm space-y-4 flex flex-col justify-between">
                {/* Preview Image if available */}
                {result.preview && (
                  <div class="relative overflow-hidden rounded-xl bg-neutral-100 dark:bg-neutral-800 h-44 flex items-center justify-center border border-neutral-200/60 dark:border-neutral-700/60">
                    <img
                      src={result.preview}
                      alt={`Preview of ${result.name}`}
                      class="w-full h-full object-contain"
                      loading="lazy"
                    />
                  </div>
                )}

                {/* Metadata */}
                <div class="space-y-1">
                  <p class="font-display font-semibold text-sm text-neutral-900 dark:text-white truncate" title={result.name}>
                    {result.name}
                  </p>
                  <div class="flex items-center justify-between text-xs">
                    <span class="font-mono text-neutral-500 dark:text-neutral-400 font-medium">{result.size}</span>
                    {files[i] && result.blob.size < files[i].size && (
                      <span class="font-mono font-bold text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/40">
                        {formatReduction(files[i].size, result.blob.size)} smaller
                      </span>
                    )}
                  </div>
                </div>

                {/* Download Button */}
                <button
                  type="button"
                  onClick={() => downloadBlob(result.blob, result.name)}
                  class="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs sm:text-sm font-semibold shadow-md shadow-brand-500/20 transition-all duration-150 hover:-translate-y-0.5"
                >
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                  </svg>
                  <span>Download File</span>
                </button>
              </div>
            ))}
          </div>

          {/* Multi-file ZIP download & Reset */}
          <div class="flex flex-wrap items-center gap-3 pt-2">
            {results.length > 1 && (
              <button
                type="button"
                onClick={async () => {
                  try {
                    const { createZip } = await import('@/utils/helpers');
                    const zipItems = results.map(r => ({ name: r.name, blob: r.blob }));
                    const zip = await createZip(zipItems);
                    downloadBlob(zip, `${tool.slug}-results.zip`);
                  } catch (e) {
                    console.error('ZIP creation failed', e);
                  }
                }}
                class="flex items-center gap-2 px-5 py-3 rounded-xl bg-neutral-900 hover:bg-neutral-800 dark:bg-neutral-100 dark:hover:bg-white text-white dark:text-neutral-900 text-xs sm:text-sm font-semibold shadow-md transition-all duration-150"
              >
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                </svg>
                <span>Download All ({results.length}) as .ZIP</span>
              </button>
            )}

            <button
              type="button"
              onClick={reset}
              class="inline-flex items-center gap-2 px-4 py-3 rounded-xl border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-xs sm:text-sm font-medium transition-colors"
            >
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
              </svg>
              <span>Process New Files</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
