/** @jsxImportSource preact */
/**
 * ToolProcessor.tsx — Generic tool processing shell (Preact island)
 *
 * This component handles the full lifecycle for every tool:
 *   1. File selection (via DropZone)
 *   2. Options UI (passed via `optionsRenderer` prop)
 *   3. Processing with progress feedback
 *   4. Results display with download buttons
 *   5. Error handling & reset
 *
 * The actual processing logic is injected via the `processFiles` prop,
 * keeping this component decoupled from any specific tool.
 */
import { useState, useCallback } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import DropZone from './DropZone';
import ProgressBar from './ProgressBar';
import { downloadBlob, formatBytes, formatReduction, stripExtension } from '@/utils/helpers';
import type { ProcessedFile, ToolConfig, ToolProcessResult } from '@/types/index';

interface Props {
  tool: ToolConfig;
  /** Called with validated files; must resolve to ProcessedFile[] */
  processFiles: (
    files: File[],
    options: Record<string, unknown>,
    onProgress: (pct: number) => void,
  ) => Promise<ToolProcessResult>;
  /** Optional additional options UI rendered between drop zone and process button */
  optionsRenderer?: (
    files: File[],
    options: Record<string, unknown>,
    setOptions: (o: Record<string, unknown>) => void,
  ) => ComponentChildren;
  /** Default options values */
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
    setFiles(selected);
    setResults([]);
    setStatus('idle');
    setErrorMessage('');
  }, []);

  const handleProcess = useCallback(async () => {
    if (files.length === 0) return;
    setStatus('processing');
    setProgress(0);
    setErrorMessage('');

    try {
      const result = await processFiles(files, options, (pct) => setProgress(pct));
      setResults(result.files);
      setSuccessMessage(result.message ?? `Successfully processed ${result.files.length} file${result.files.length !== 1 ? 's' : ''}.`);
      setStatus('done');
      setProgress(100);
      // Fire toast
      (window as any).__browsertools_toast?.({ type: 'success', title: 'Done!', message: successMessage });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'An unexpected error occurred.';
      setErrorMessage(msg);
      setStatus('error');
      (window as any).__browsertools_toast?.({ type: 'error', title: 'Processing failed', message: msg });
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
    <div class="space-y-6 max-w-4xl">
      {/* ── Drop Zone ───────────────────────────────── */}
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

      {/* ── Selected files list ──────────────────────── */}
      {files.length > 0 && !isDone && (
        <div class="space-y-2">
          <p class="text-sm font-medium text-neutral-700 dark:text-neutral-300">
            {files.length} file{files.length !== 1 ? 's' : ''} selected
          </p>
          <ul class="space-y-1.5">
            {files.map((file, i) => (
              <li key={i} class="flex items-center gap-3 p-3 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-sm">
                <svg class="w-4 h-4 flex-shrink-0 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/>
                </svg>
                <span class="flex-1 truncate text-neutral-800 dark:text-neutral-200 font-medium">{file.name}</span>
                <span class="flex-shrink-0 text-neutral-500 dark:text-neutral-400 font-mono text-xs">{formatBytes(file.size)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Options UI (tool-specific) ─────────────── */}
      {files.length > 0 && !isDone && optionsRenderer && (
        <div class="p-5 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-4">
          <h3 class="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Options</h3>
          {optionsRenderer(files, options, setOptions)}
        </div>
      )}

      {/* ── Progress bar ─────────────────────────────── */}
      {isProcessing && (
        <ProgressBar value={progress} label="Processing…" />
      )}

      {/* ── Error message ────────────────────────────── */}
      {status === 'error' && errorMessage && (
        <div role="alert" class="flex items-start gap-3 p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/50 animate-fade-in">
          <svg class="w-5 h-5 flex-shrink-0 text-red-500 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <div>
            <p class="text-sm font-semibold text-red-700 dark:text-red-400">Processing failed</p>
            <p class="text-sm text-red-600 dark:text-red-400 mt-0.5">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* ── Process button ───────────────────────────── */}
      {files.length > 0 && !isDone && (
        <button
          type="button"
          onClick={handleProcess}
          disabled={isProcessing}
          id={`process-${tool.slug}`}
          class="inline-flex items-center gap-2.5 px-6 py-3 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:bg-neutral-300 dark:disabled:bg-neutral-700 text-white font-semibold text-sm shadow-lg shadow-brand-500/20 hover:shadow-brand-500/30 disabled:shadow-none transition-all duration-200 disabled:cursor-not-allowed"
        >
          {isProcessing ? (
            <>
              <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              Processing…
            </>
          ) : (
            <>
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
              </svg>
              {tool.name}
            </>
          )}
        </button>
      )}

      {/* ── Results ──────────────────────────────────── */}
      {isDone && results.length > 0 && (
        <div class="space-y-4 animate-fade-in">
          {/* Success banner */}
          <div class="flex items-center gap-3 p-4 rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800/50">
            <svg class="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            <p class="text-sm font-medium text-green-800 dark:text-green-300">{successMessage}</p>
          </div>

          {/* Results grid */}
          <div class={`grid gap-4 ${results.length > 1 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 max-w-md'}`}>
            {results.map((result, i) => (
              <div key={i} class="group p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-3">
                {/* Image preview */}
                {result.preview && (
                  <img
                    src={result.preview}
                    alt={`Preview of ${result.name}`}
                    class="w-full h-40 object-cover rounded-lg bg-neutral-100 dark:bg-neutral-800"
                    loading="lazy"
                  />
                )}

                {/* File info */}
                <div class="flex items-start justify-between gap-2">
                  <div class="min-w-0">
                    <p class="text-sm font-semibold text-neutral-900 dark:text-neutral-100 truncate">
                      {result.name}
                    </p>
                    <p class="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                      {result.size}
                      {files[i] && (
                        <span class={`ml-2 font-medium ${
                          result.blob.size < files[i].size
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-amber-600 dark:text-amber-400'
                        }`}>
                          {formatReduction(files[i].size, result.blob.size)}
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                {/* Download button */}
                <button
                  type="button"
                  onClick={() => downloadBlob(result.blob, result.name)}
                  class="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium transition-colors duration-150"
                >
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                  </svg>
                  Download
                </button>
              </div>
            ))}
          </div>

          {/* Download all (if multiple) */}
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
              class="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-sm font-medium transition-colors duration-150"
            >
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
              </svg>
              Download All as ZIP
            </button>
          )}

          {/* Start over */}
          <button
            type="button"
            onClick={reset}
            class="flex items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors"
          >
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
            </svg>
            Process another file
          </button>
        </div>
      )}

      {/* Empty state */}
      {files.length === 0 && status === 'idle' && (
        <div class="text-center py-4 text-sm text-neutral-400 dark:text-neutral-500">
          Drop a file above to get started.
        </div>
      )}
    </div>
  );
}
