/** @jsxImportSource preact */
/**
 * SplitPdfTool.tsx — Split PDF into individual or grouped page ranges
 */
import { useState } from 'preact/hooks';
import DropZone from '@/components/tools/DropZone';
import ProgressBar from '@/components/tools/ProgressBar';
import { splitPdf, parsePageRanges } from '@/lib/pdf/split';
import { downloadBlob } from '@/utils/helpers';
import type { ToolConfig, ProcessedFile } from '@/types/index';

interface Props { tool: ToolConfig }

export default function SplitPdfTool({ tool }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [rangeInput, setRangeInput] = useState('');
  const [status, setStatus] = useState<'idle' | 'processing' | 'done' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<ProcessedFile[]>([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [totalPages, setTotalPages] = useState<number | null>(null);

  async function loadPdf(f: File) {
    setFile(f);
    setStatus('idle');
    setResults([]);
    setErrorMsg('');
    try {
      const { PDFDocument } = await import('pdf-lib');
      const buf = await f.arrayBuffer();
      const pdf = await PDFDocument.load(buf);
      setTotalPages(pdf.getPageCount());
    } catch {
      setTotalPages(null);
    }
  }

  async function handleSplit() {
    if (!file) return;
    const pages = totalPages ?? 9999;
    const ranges = parsePageRanges(rangeInput || `1-${pages}`, pages);
    if (ranges.length === 0) {
      setErrorMsg('Please enter valid page numbers or ranges, e.g. "1-3, 5, 7-9".');
      return;
    }
    setStatus('processing');
    setProgress(0);
    setErrorMsg('');
    try {
      const result = await splitPdf(file, ranges, setProgress);
      setResults(result.files);
      setStatus('done');
      (window as any).__magictools_toast?.({
        type: 'success',
        title: 'Split Complete',
        message: `PDF split into ${result.files.length} document(s).`,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Split failed.';
      setErrorMsg(msg);
      setStatus('error');
    }
  }

  function reset() {
    setFile(null);
    setStatus('idle');
    setResults([]);
    setErrorMsg('');
    setTotalPages(null);
    setRangeInput('');
  }

  return (
    <div class="space-y-6 max-w-4xl mx-auto">
      {!file && (
        <DropZone
          acceptedTypes={tool.acceptedTypes}
          acceptedExtensions={tool.acceptedExtensions}
          maxSizeMB={tool.maxSizeMB}
          multiFile={false}
          onFilesSelected={(files) => loadPdf(files[0])}
        />
      )}

      {file && status !== 'done' && (
        <div class="space-y-6">
          {/* File info banner */}
          <div class="flex items-center justify-between p-4 rounded-2xl bg-neutral-100 dark:bg-neutral-800 text-xs sm:text-sm">
            <div class="flex items-center gap-3 min-w-0">
              <span class="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center font-bold text-xs">
                PDF
              </span>
              <span class="font-semibold text-neutral-900 dark:text-white truncate">{file.name}</span>
            </div>
            {totalPages && (
              <span class="font-mono font-bold text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-950/60 px-2.5 py-1 rounded-md border border-brand-200/60 dark:border-brand-800/60 flex-shrink-0">
                {totalPages} {totalPages === 1 ? 'page' : 'pages'} total
              </span>
            )}
          </div>

          {/* Page Range Options */}
          <div class="p-6 rounded-3xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm space-y-4">
            <div class="flex items-center justify-between">
              <label for="page-ranges" class="font-display font-bold text-sm text-neutral-900 dark:text-white">
                Extraction Pattern & Ranges
              </label>
            </div>

            {/* Quick Presets */}
            {totalPages && totalPages > 1 && (
              <div class="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setRangeInput(Array.from({ length: totalPages }, (_, i) => `${i + 1}`).join(', '))}
                  class="px-2.5 py-1 rounded-lg text-xs font-semibold border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:border-brand-500"
                >
                  Extract Every Page Separately
                </button>
                <button
                  type="button"
                  onClick={() => setRangeInput(`1-${Math.ceil(totalPages / 2)}, ${Math.ceil(totalPages / 2) + 1}-${totalPages}`)}
                  class="px-2.5 py-1 rounded-lg text-xs font-semibold border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:border-brand-500"
                >
                  Split into 2 Halves
                </button>
              </div>
            )}

            <input
              id="page-ranges"
              type="text"
              value={rangeInput}
              onInput={(e) => setRangeInput((e.target as HTMLInputElement).value)}
              placeholder={totalPages ? `e.g. 1-3, 5, 7-${totalPages}` : 'e.g. 1-3, 5, 7-9'}
              class="w-full px-4 py-3 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 text-sm font-mono placeholder-neutral-400 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/10"
            />
            <p class="text-xs text-neutral-500 dark:text-neutral-400">
              Leave blank to extract all pages as individual PDFs. Use comma-separated numbers and ranges: <code class="font-mono text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 px-1 rounded">1-3, 5, 7-9</code>
            </p>
          </div>

          {status === 'processing' && <ProgressBar value={progress} label="Splitting document pages…" />}

          {status === 'error' && (
            <div role="alert" class="p-4 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 text-xs sm:text-sm text-red-700 dark:text-red-400">
              {errorMsg}
            </div>
          )}

          <div class="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSplit}
              disabled={status === 'processing'}
              class="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:bg-neutral-300 text-white font-semibold text-sm shadow-lg shadow-brand-500/25 transition-all duration-200 hover:-translate-y-0.5"
            >
              <span>✂️</span>
              <span>Split PDF Document</span>
            </button>
            <button
              type="button"
              onClick={reset}
              class="px-4 py-3.5 rounded-xl border border-neutral-300 dark:border-neutral-700 text-xs sm:text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            >
              Choose different PDF
            </button>
          </div>
        </div>
      )}

      {/* Done State */}
      {status === 'done' && results.length > 0 && (
        <div class="space-y-5 animate-fade-in">
          <div class="flex items-center gap-3.5 p-4 sm:p-5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60">
            <div class="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-sm">✓</div>
            <div>
              <p class="font-display font-bold text-emerald-950 dark:text-emerald-100">PDF Split Successfully!</p>
              <p class="text-xs text-emerald-800 dark:text-emerald-300 mt-0.5">Created {results.length} separate PDF file(s).</p>
            </div>
          </div>

          <div class="space-y-2.5">
            {results.map((r, i) => (
              <div key={i} class="flex items-center justify-between p-3.5 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-2xs">
                <div class="min-w-0 flex items-center gap-2.5">
                  <span class="text-red-500 font-bold text-xs font-mono">PDF</span>
                  <div>
                    <p class="text-sm font-semibold text-neutral-900 dark:text-white truncate">{r.name}</p>
                    <p class="text-xs text-neutral-500 font-mono">{r.size}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => downloadBlob(r.blob, r.name)}
                  class="flex-shrink-0 ml-4 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold shadow-xs transition-colors"
                >
                  Download
                </button>
              </div>
            ))}
          </div>

          <div class="flex flex-wrap items-center gap-3 pt-2">
            {results.length > 1 && (
              <button
                type="button"
                onClick={async () => {
                  try {
                    const { createZip } = await import('@/utils/helpers');
                    const zipItems = results.map(r => ({ name: r.name, blob: r.blob }));
                    const zip = await createZip(zipItems);
                    downloadBlob(zip, `${tool.slug}-split-results.zip`);
                  } catch (e) {
                    console.error('ZIP creation failed', e);
                  }
                }}
                class="flex items-center gap-2 px-5 py-3 rounded-xl bg-neutral-900 hover:bg-neutral-800 dark:bg-neutral-100 dark:hover:bg-white text-white dark:text-neutral-900 text-xs sm:text-sm font-semibold shadow-md transition-all"
              >
                <span>Download All as .ZIP</span>
              </button>
            )}

            <button type="button" onClick={reset} class="px-4 py-3 rounded-xl border border-neutral-300 dark:border-neutral-700 text-xs sm:text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors">
              Process another file
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
