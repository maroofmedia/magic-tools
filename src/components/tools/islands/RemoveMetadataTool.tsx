/** @jsxImportSource preact */
import { useState, useEffect, useRef } from 'preact/hooks';
import DropZone from '@/components/tools/DropZone';
import ProgressBar from '@/components/tools/ProgressBar';
import FileThumbnailStrip from '@/components/tools/FileThumbnailStrip';
import {
  extractImageMetadata,
  stripImageMetadata,
  type ExtractedMetadata,
  type StrippedFileResult,
} from '@/lib/image/metadata';
import { downloadBlob, formatBytes, formatReduction } from '@/utils/helpers';
import type { ToolConfig } from '@/types/index';

interface Props {
  tool: ToolConfig;
}

export default function RemoveMetadataTool({ tool }: Props) {
  const [files, setFiles] = useState<File[]>([]);
  const [fileMetadata, setFileMetadata] = useState<Record<number, ExtractedMetadata>>({});
  const [isScanning, setIsScanning] = useState(false);
  const [keepColorProfile, setKeepColorProfile] = useState(false);
  const [status, setStatus] = useState<'idle' | 'processing' | 'done' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<StrippedFileResult[]>([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [selectedInspectIdx, setSelectedInspectIdx] = useState<number | null>(null);
  const [customNames, setCustomNames] = useState<Record<number, string>>({});
  const addInputRef = useRef<HTMLInputElement>(null);

  // Scan metadata whenever files change
  useEffect(() => {
    if (files.length === 0) {
      setFileMetadata({});
      return;
    }

    let isMounted = true;
    setIsScanning(true);

    Promise.all(files.map((f) => extractImageMetadata(f)))
      .then((metaList) => {
        if (!isMounted) return;
        const metaMap: Record<number, ExtractedMetadata> = {};
        metaList.forEach((m, idx) => {
          metaMap[idx] = m;
        });
        setFileMetadata(metaMap);
        setIsScanning(false);
      })
      .catch((err) => {
        console.error('Scan error:', err);
        if (isMounted) setIsScanning(false);
      });

    return () => {
      isMounted = false;
    };
  }, [files]);

  function handleFilesSelected(newFiles: File[]) {
    setFiles((prev) => (tool.multiFile ? [...prev, ...newFiles] : newFiles));
    setStatus('idle');
    setResults([]);
    setErrorMessage('');
    setCustomNames({});
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    if (files.length <= 1) {
      reset();
    }
  }

  function reset() {
    setFiles([]);
    setFileMetadata({});
    setResults([]);
    setStatus('idle');
    setProgress(0);
    setErrorMessage('');
    setCustomNames({});
    setSelectedInspectIdx(null);
  }

  async function handleStrip() {
    if (files.length === 0) return;
    setStatus('processing');
    setProgress(0);
    setErrorMessage('');

    try {
      const step = 90 / files.length;
      const strippedResults: StrippedFileResult[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const res = await stripImageMetadata(
          file,
          { stripAll: true, keepColorProfile },
          (p) => {
            const overall = Math.round(i * step + (p / 100) * step);
            setProgress(overall);
          },
        );
        strippedResults.push(res);
      }

      setProgress(100);
      setResults(strippedResults);
      setStatus('done');

      (window as any).__magictools_toast?.({
        type: 'success',
        title: 'Metadata Stripped!',
        message: `Successfully stripped all metadata from ${strippedResults.length} file${strippedResults.length > 1 ? 's' : ''} with 0% quality loss.`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'An unexpected error occurred.';
      setErrorMessage(msg);
      setStatus('error');
      (window as any).__magictools_toast?.({
        type: 'error',
        title: 'Stripping Failed',
        message: msg,
      });
    }
  }

  function getFinalFileName(originalName: string, index: number): string {
    const custom = customNames[index]?.trim();
    if (!custom) return originalName;
    const ext = originalName.split('.').pop();
    if (!ext) return custom;
    return custom.toLowerCase().endsWith(`.${ext.toLowerCase()}`) ? custom : `${custom}.${ext}`;
  }

  // Aggregate metadata statistics
  const totalTagsDetected = Object.values(fileMetadata).reduce((acc, m) => acc + (m.totalTagsCount || 0), 0);
  const filesWithGps = Object.values(fileMetadata).filter((m) => !!m.gps).length;
  const filesWithCamera = Object.values(fileMetadata).filter((m) => !!m.camera?.make || !!m.camera?.model).length;
  const filesWithTimestamp = Object.values(fileMetadata).filter((m) => !!m.shotDetails?.dateTime).length;

  const isProcessing = status === 'processing';
  const isDone = status === 'done';

  return (
    <div class="space-y-5 max-w-3xl mx-auto">
      {/* 100% Lossless Guarantee Banner */}
      <div class="flex items-center gap-3 p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-indigo-500/10 border border-emerald-500/20 dark:border-emerald-500/30 backdrop-blur-xs shadow-2xs">
        <div class="w-9 h-9 rounded-xl bg-emerald-500 text-white flex items-center justify-center text-lg flex-shrink-0 shadow-xs">
          🛡️
        </div>
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2">
            <span class="font-display font-bold text-xs sm:text-sm text-neutral-900 dark:text-white">
              100% On-Device & Lossless Guarantee
            </span>
            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              Zero Quality Loss
            </span>
          </div>
          <p class="text-xs text-neutral-600 dark:text-neutral-400 mt-0.5 leading-relaxed">
            Direct binary stream stripping preserves your image pixels bit-for-bit without re-encoding. No server uploads.
          </p>
        </div>
      </div>

      {/* Drop Zone when no files */}
      {files.length === 0 && !isDone && (
        <DropZone
          acceptedTypes={tool.acceptedTypes}
          acceptedExtensions={tool.acceptedExtensions}
          maxSizeMB={tool.maxSizeMB}
          maxTotalSizeMB={tool.maxTotalSizeMB}
          multiFile={tool.multiFile}
          onFilesSelected={handleFilesSelected}
          disabled={isProcessing}
        />
      )}

      {/* Selected Files Strip */}
      {files.length > 0 && !isDone && (
        <div class="space-y-3">
          <FileThumbnailStrip
            files={files}
            onRemoveFile={removeFile}
            onClearAll={reset}
            disabled={isProcessing}
            allowReorder={false}
          />

          {/* Add more files button */}
          {tool.multiFile && (
            <div class="flex items-center gap-2 pt-0.5">
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
                    handleFilesSelected(Array.from(selected));
                    (e.target as HTMLInputElement).value = '';
                  }
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* Privacy Audit & Metadata Inspector Panel */}
      {files.length > 0 && !isDone && (
        <div class="p-4 sm:p-5 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm space-y-4">
          <div class="flex items-center justify-between pb-3 border-b border-neutral-100 dark:border-neutral-800">
            <div class="flex items-center gap-2">
              <span class="text-base">🔍</span>
              <div>
                <h3 class="font-display font-bold text-xs sm:text-sm text-neutral-900 dark:text-white">
                  Privacy Audit & Detected Metadata
                </h3>
                <p class="text-[11px] text-neutral-500 dark:text-neutral-400">
                  {isScanning
                    ? 'Scanning image files for hidden tags…'
                    : totalTagsDetected > 0 || filesWithGps > 0
                    ? `Found ${totalTagsDetected} hidden metadata tags in uploaded images`
                    : 'Scanned image files — ready for safe stripping'}
                </p>
              </div>
            </div>

            {isScanning && (
              <div class="flex items-center gap-1.5 text-xs text-brand-600 dark:text-brand-400 font-medium">
                <svg class="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span>Scanning…</span>
              </div>
            )}
          </div>

          {/* Alert if GPS Geolocation is detected */}
          {filesWithGps > 0 && (
            <div class="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800/60 flex items-start gap-3 animate-fade-in">
              <div class="w-7 h-7 rounded-lg bg-amber-500 text-white flex items-center justify-center flex-shrink-0 text-sm font-bold mt-0.5">
                📍
              </div>
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2">
                  <p class="font-display font-bold text-xs sm:text-sm text-amber-900 dark:text-amber-200">
                    High Privacy Risk: GPS Location Exposed
                  </p>
                  <span class="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-200">
                    {filesWithGps} image{filesWithGps > 1 ? 's' : ''}
                  </span>
                </div>
                <p class="text-xs text-amber-800 dark:text-amber-300/90 mt-0.5 leading-relaxed">
                  Your photo contains exact GPS coordinates that reveal where it was taken. Stripping will permanently erase all location and map references.
                </p>
              </div>
            </div>
          )}

          {/* Privacy Badges Grid */}
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div class={`p-3 rounded-xl border ${filesWithGps > 0 ? 'border-amber-200 dark:border-amber-900/60 bg-amber-50/50 dark:bg-amber-950/20' : 'border-neutral-100 dark:border-neutral-800/80 bg-neutral-50/50 dark:bg-neutral-800/30'}`}>
              <div class="text-xs font-semibold text-neutral-500 dark:text-neutral-400">GPS Location</div>
              <div class={`text-sm font-display font-bold mt-0.5 ${filesWithGps > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-neutral-700 dark:text-neutral-300'}`}>
                {filesWithGps > 0 ? `📍 Exposed (${filesWithGps})` : '✓ None'}
              </div>
            </div>

            <div class={`p-3 rounded-xl border ${filesWithCamera > 0 ? 'border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/50 dark:bg-indigo-950/20' : 'border-neutral-100 dark:border-neutral-800/80 bg-neutral-50/50 dark:bg-neutral-800/30'}`}>
              <div class="text-xs font-semibold text-neutral-500 dark:text-neutral-400">Camera / Device</div>
              <div class="text-sm font-display font-bold mt-0.5 text-neutral-800 dark:text-neutral-200 truncate">
                {filesWithCamera > 0 ? `📷 ${filesWithCamera} Found` : '✓ None'}
              </div>
            </div>

            <div class={`p-3 rounded-xl border ${filesWithTimestamp > 0 ? 'border-purple-200 dark:border-purple-900/60 bg-purple-50/50 dark:bg-purple-950/20' : 'border-neutral-100 dark:border-neutral-800/80 bg-neutral-50/50 dark:bg-neutral-800/30'}`}>
              <div class="text-xs font-semibold text-neutral-500 dark:text-neutral-400">Date & Time</div>
              <div class="text-sm font-display font-bold mt-0.5 text-neutral-800 dark:text-neutral-200">
                {filesWithTimestamp > 0 ? `⏱️ Embedded` : '✓ None'}
              </div>
            </div>

            <div class="p-3 rounded-xl border border-neutral-100 dark:border-neutral-800/80 bg-neutral-50/50 dark:bg-neutral-800/30">
              <div class="text-xs font-semibold text-neutral-500 dark:text-neutral-400">Total Tags</div>
              <div class="text-sm font-display font-bold mt-0.5 text-brand-600 dark:text-brand-400">
                {totalTagsDetected} detected
              </div>
            </div>
          </div>

          {/* Inspect Details Accordion / Modal trigger per file */}
          <div class="space-y-2">
            <div class="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
              Detailed File Inspector:
            </div>
            <div class="flex flex-wrap gap-1.5">
              {files.map((file, idx) => {
                const meta = fileMetadata[idx];
                const hasGps = !!meta?.gps;
                const tagCount = meta?.totalTagsCount || 0;

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedInspectIdx(selectedInspectIdx === idx ? null : idx)}
                    class={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                      selectedInspectIdx === idx
                        ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300 font-semibold'
                        : 'border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:border-neutral-300'
                    }`}
                  >
                    <span>{hasGps ? '📍' : '📄'}</span>
                    <span class="max-w-[140px] truncate">{file.name}</span>
                    <span class="text-[10px] font-mono opacity-70">
                      ({tagCount} tag{tagCount !== 1 ? 's' : ''})
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected File Metadata Details Card */}
          {selectedInspectIdx !== null && fileMetadata[selectedInspectIdx] && (
            <div class="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 space-y-3 animate-fade-in text-xs">
              <div class="flex items-center justify-between pb-2 border-b border-neutral-200/60 dark:border-neutral-700/60">
                <span class="font-display font-bold text-neutral-900 dark:text-white">
                  Metadata Dump: {files[selectedInspectIdx]?.name}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedInspectIdx(null)}
                  class="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 font-bold"
                >
                  ✕ Close
                </button>
              </div>

              {/* GPS Info */}
              {fileMetadata[selectedInspectIdx].gps && (
                <div class="p-2.5 rounded-lg bg-amber-100/70 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/60 space-y-1">
                  <div class="font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                    <span>📍 GPS Coordinates</span>
                  </div>
                  <div class="font-mono text-[11px] text-amber-800 dark:text-amber-300">
                    {fileMetadata[selectedInspectIdx].gps?.formattedLat}, {fileMetadata[selectedInspectIdx].gps?.formattedLng}
                  </div>
                  <a
                    href={fileMetadata[selectedInspectIdx].gps?.mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="inline-block text-[11px] text-amber-700 dark:text-amber-400 underline font-semibold mt-0.5"
                  >
                    View on Google Maps ↗
                  </a>
                </div>
              )}

              {/* Detected Blocks */}
              {fileMetadata[selectedInspectIdx].detectedBlocks.length > 0 && (
                <div class="space-y-1">
                  <div class="font-semibold text-neutral-700 dark:text-neutral-300">Detected Metadata Streams:</div>
                  <div class="space-y-1">
                    {fileMetadata[selectedInspectIdx].detectedBlocks.map((b, i) => (
                      <div key={i} class="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-700/60">
                        <div>
                          <div class="font-medium text-neutral-900 dark:text-white">{b.name}</div>
                          <div class="text-[11px] text-neutral-500 dark:text-neutral-400">{b.description}</div>
                        </div>
                        {b.approxSize && (
                          <span class="font-mono text-[10px] text-neutral-400">{formatBytes(b.approxSize)}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Raw Tag Table */}
              {Object.keys(fileMetadata[selectedInspectIdx].rawTags).length > 0 ? (
                <div class="space-y-1 pt-1">
                  <div class="font-semibold text-neutral-700 dark:text-neutral-300">Individual Tags:</div>
                  <div class="max-h-48 overflow-y-auto rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 divide-y divide-neutral-100 dark:divide-neutral-800">
                    {Object.entries(fileMetadata[selectedInspectIdx].rawTags).map(([k, v]) => (
                      <div key={k} class="flex items-start justify-between p-2 gap-2">
                        <span class="font-mono text-neutral-500 dark:text-neutral-400 font-medium flex-shrink-0">{k}</span>
                        <span class="font-mono text-neutral-900 dark:text-white text-right break-all">{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p class="text-neutral-500 dark:text-neutral-400 italic">No standard textual tags found in this file.</p>
              )}
            </div>
          )}

          {/* Options */}
          <div class="pt-2 border-t border-neutral-100 dark:border-neutral-800 space-y-2">
            <div class="font-semibold text-xs text-neutral-800 dark:text-neutral-200">Stripping Options:</div>
            <div class="space-y-2">
              <label class="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={true}
                  disabled={true}
                  class="mt-0.5 rounded text-brand-600 accent-brand-600 cursor-not-allowed"
                />
                <div>
                  <span class="text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                    Strip All Metadata (EXIF, GPS, IPTC, XMP, Comments, Camera details)
                  </span>
                  <p class="text-[11px] text-neutral-500 dark:text-neutral-400">
                    Recommended for total privacy and anonymity.
                  </p>
                </div>
              </label>

              <label class="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={keepColorProfile}
                  onChange={(e) => setKeepColorProfile((e.target as HTMLInputElement).checked)}
                  class="mt-0.5 rounded text-brand-600 accent-brand-600 cursor-pointer"
                />
                <div>
                  <span class="text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                    Keep Color Profile (ICC / sRGB)
                  </span>
                  <p class="text-[11px] text-neutral-500 dark:text-neutral-400">
                    Preserves wide-gamut display color profiles while removing all camera, GPS, and personal info.
                  </p>
                </div>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Progress Bar */}
      {isProcessing && <ProgressBar value={progress} label="Stripping metadata losslessly…" />}

      {/* Error Message */}
      {status === 'error' && errorMessage && (
        <div role="alert" class="p-4 rounded-2xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-xs sm:text-sm text-red-700 dark:text-red-300">
          {errorMessage}
        </div>
      )}

      {/* Strip Button */}
      {files.length > 0 && !isDone && (
        <div class="flex items-center gap-3">
          <button
            type="button"
            onClick={handleStrip}
            disabled={isProcessing || isScanning}
            id="strip-metadata-button"
            class="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-7 py-3 rounded-2xl bg-brand-600 hover:bg-brand-700 disabled:bg-neutral-300 dark:disabled:bg-neutral-800 text-white font-bold text-sm sm:text-base shadow-lg shadow-brand-500/25 transition-all duration-150 hover:-translate-y-0.5 active:translate-y-0"
          >
            {isProcessing ? (
              <>
                <svg class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span>Stripping Metadata…</span>
              </>
            ) : (
              <>
                <span>🛡️</span>
                <span>Strip Metadata ({files.length} {files.length === 1 ? 'file' : 'files'})</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Done State & Results Showcase */}
      {isDone && results.length > 0 && (
        <div class="space-y-4 animate-fade-in">
          {/* Success Banner */}
          <div class="flex items-center gap-3.5 p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 shadow-2xs">
            <div class="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center flex-shrink-0 font-bold text-sm">
              ✓
            </div>
            <div class="min-w-0 flex-1">
              <p class="font-display font-bold text-sm sm:text-base text-emerald-950 dark:text-emerald-100">
                All Metadata Successfully Removed!
              </p>
              <p class="text-xs text-emerald-800 dark:text-emerald-300 mt-0.5">
                EXIF tags, GPS location, camera details, and timestamps were stripped with 100% lossless image quality.
              </p>
            </div>
          </div>

          {/* Results Grid */}
          <div class={`grid gap-4 ${results.length > 1 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 max-w-lg'}`}>
            {results.map((res, i) => {
              const savedBytes = res.originalSize - res.newSize;

              return (
                <div
                  key={i}
                  class="p-5 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm space-y-4 flex flex-col justify-between"
                >
                  {/* Preview Image */}
                  {res.preview && (
                    <div class="relative overflow-hidden rounded-xl bg-neutral-100 dark:bg-neutral-800 h-44 flex items-center justify-center border border-neutral-200/60 dark:border-neutral-700/60">
                      <img
                        src={res.preview}
                        alt={`Cleaned ${res.name}`}
                        class="w-full h-full object-contain"
                        loading="lazy"
                      />
                      <span class="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-emerald-500/90 backdrop-blur-xs text-white text-[10px] font-bold shadow-xs">
                        ✓ Cleaned
                      </span>
                    </div>
                  )}

                  {/* Metadata Summary */}
                  <div class="space-y-1.5">
                    <p class="font-display font-semibold text-sm text-neutral-900 dark:text-white truncate" title={res.name}>
                      {res.name}
                    </p>
                    <div class="flex items-center justify-between text-xs">
                      <span class="font-mono text-neutral-500 dark:text-neutral-400 font-medium">{res.size}</span>
                      {savedBytes > 0 && (
                        <span class="font-mono font-bold text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/40">
                          {formatReduction(res.originalSize, res.newSize)} smaller (-{formatBytes(savedBytes)})
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Rename Option */}
                  <div class="space-y-1">
                    <label for={`rename-cleaned-${i}`} class="block text-[11px] font-semibold text-neutral-600 dark:text-neutral-400">
                      Rename file <span class="font-normal text-neutral-400">(optional)</span>
                    </label>
                    <div class="flex items-center gap-1.5">
                      <input
                        id={`rename-cleaned-${i}`}
                        type="text"
                        placeholder={res.name.replace(/\.[^.]+$/, '')}
                        value={customNames[i] ?? ''}
                        onInput={(e) => setCustomNames({ ...customNames, [i]: (e.target as HTMLInputElement).value })}
                        class="w-full px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-xs text-neutral-900 dark:text-white placeholder-neutral-400 focus:border-brand-500 focus:outline-none"
                      />
                      <span class="text-[11px] font-mono text-neutral-400 flex-shrink-0">
                        .{res.name.split('.').pop()}
                      </span>
                    </div>
                  </div>

                  {/* Download Button */}
                  <button
                    type="button"
                    onClick={() => downloadBlob(res.blob, getFinalFileName(res.name, i))}
                    class="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs sm:text-sm font-semibold shadow-md shadow-brand-500/20 transition-all duration-150 hover:-translate-y-0.5"
                  >
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    <span>Download Cleaned Image</span>
                  </button>
                </div>
              );
            })}
          </div>

          {/* Action Row: ZIP & Reset */}
          <div class="flex flex-wrap items-center gap-3 pt-2">
            {results.length > 1 && (
              <button
                type="button"
                onClick={async () => {
                  try {
                    const { createZip } = await import('@/utils/helpers');
                    const zipItems = results.map((r, idx) => ({
                      name: getFinalFileName(r.name, idx),
                      blob: r.blob,
                    }));
                    const zip = await createZip(zipItems);
                    downloadBlob(zip, 'cleaned-images.zip');
                  } catch (e) {
                    console.error('ZIP download failed', e);
                  }
                }}
                class="flex items-center gap-2 px-5 py-3 rounded-xl bg-neutral-900 hover:bg-neutral-800 dark:bg-neutral-100 dark:hover:bg-white text-white dark:text-neutral-900 text-xs sm:text-sm font-bold shadow-md transition-all duration-150 hover:-translate-y-0.5"
              >
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
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
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>Process More Photos</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
