/** @jsxImportSource preact */
/**
 * SplitPdfTool.tsx — Split PDF with page-range input
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
    // Try to get page count for UX
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
      setErrorMsg('Please enter valid page ranges, e.g. "1-3, 5, 7-9".');
      return;
    }
    setStatus('processing');
    setProgress(0);
    setErrorMsg('');
    try {
      const result = await splitPdf(file, ranges, setProgress);
      setResults(result.files);
      setStatus('done');
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Split failed.');
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
    <div class="space-y-6 max-w-4xl">
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
        <>
          <div class="flex items-center gap-3 p-4 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-sm">
            <svg class="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
            </svg>
            <span class="font-medium text-neutral-800 dark:text-neutral-200">{file.name}</span>
            {totalPages && <span class="text-neutral-500">· {totalPages} pages</span>}
          </div>

          <div class="p-5 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-3">
            <label for="page-ranges" class="block text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              Page ranges to extract
            </label>
            <input
              id="page-ranges"
              type="text"
              value={rangeInput}
              onInput={(e) => setRangeInput((e.target as HTMLInputElement).value)}
              placeholder={totalPages ? `e.g. 1-3, 5, 7-${totalPages}` : 'e.g. 1-3, 5, 7-9'}
              class="w-full px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 text-sm font-mono placeholder-neutral-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
            <p class="text-xs text-neutral-500 dark:text-neutral-400">
              Leave blank to extract all pages individually. Use commas and dashes: <code class="font-mono">1-3, 5, 7-9</code>
            </p>
          </div>

          {status === 'processing' && <ProgressBar value={progress} label="Splitting PDF…" />}
          {status === 'error' && (
            <div role="alert" class="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 text-sm text-red-700 dark:text-red-400">{errorMsg}</div>
          )}

          <button
            type="button"
            onClick={handleSplit}
            disabled={status === 'processing'}
            class="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:bg-neutral-300 dark:disabled:bg-neutral-700 text-white font-semibold text-sm shadow-lg transition-all duration-200"
          >
            ✂️ Split PDF
          </button>
        </>
      )}

      {status === 'done' && results.length > 0 && (
        <div class="space-y-4 animate-fade-in">
          <div class="flex items-center gap-3 p-4 rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800/50">
            <span class="text-green-600 dark:text-green-400 text-lg">✓</span>
            <p class="text-sm font-medium text-green-800 dark:text-green-300">
              Split into {results.length} PDF{results.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div class="space-y-2">
            {results.map((r, i) => (
              <div key={i} class="flex items-center justify-between p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
                <div class="min-w-0">
                  <p class="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">{r.name}</p>
                  <p class="text-xs text-neutral-500">{r.size}</p>
                </div>
                <button
                  type="button"
                  onClick={() => downloadBlob(r.blob, r.name)}
                  class="flex-shrink-0 ml-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-medium transition-colors"
                >
                  ⬇ Download
                </button>
              </div>
            ))}
          </div>
          <button type="button" onClick={reset} class="text-sm text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors">
            Process another file
          </button>
        </div>
      )}
    </div>
  );
}
