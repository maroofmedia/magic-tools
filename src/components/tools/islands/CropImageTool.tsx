/** @jsxImportSource preact */
/**
 * CropImageTool.tsx — Interactive crop tool with canvas preview
 */
import { useState, useRef, useEffect, useCallback } from 'preact/hooks';
import DropZone from '@/components/tools/DropZone';
import ProgressBar from '@/components/tools/ProgressBar';
import { cropImage } from '@/lib/image/crop';
import { downloadBlob, formatBytes } from '@/utils/helpers';
import type { ToolConfig, ProcessedFile } from '@/types/index';

interface Props { tool: ToolConfig }

const ASPECT_RATIOS: { label: string; value: number | null }[] = [
  { label: 'Free', value: null },
  { label: '1:1', value: 1 },
  { label: '4:3', value: 4 / 3 },
  { label: '16:9', value: 16 / 9 },
  { label: '3:4', value: 3 / 4 },
  { label: '9:16', value: 9 / 16 },
];

export default function CropImageTool({ tool }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [imgSrc, setImgSrc] = useState<string>('');
  const [naturalW, setNaturalW] = useState(0);
  const [naturalH, setNaturalH] = useState(0);
  const [crop, setCrop] = useState({ x: 0, y: 0, w: 0, h: 0 });
  const [aspectRatio, setAspectRatio] = useState<number | null>(null);
  const [outputFormat, setOutputFormat] = useState<'image/jpeg' | 'image/png'>('image/jpeg');
  const [quality, setQuality] = useState(0.92);
  const [status, setStatus] = useState<'idle' | 'processing' | 'done' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ProcessedFile | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0, cx: 0, cy: 0 });
  const isResizing = useRef(false);
  const resizeHandle = useRef('');

  function onFilesSelected(files: File[]) {
    const f = files[0];
    setFile(f);
    const url = URL.createObjectURL(f);
    setImgSrc(url);
    setResult(null);
    setStatus('idle');
    setErrorMsg('');
  }

  function onImageLoad() {
    const img = imgRef.current!;
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;
    setNaturalW(iw);
    setNaturalH(ih);
    // Default: full image crop
    setCrop({ x: 0, y: 0, w: iw, h: ih });
  }

  // Scale factor: rendered size / natural size
  function getScale() {
    if (!imgRef.current) return 1;
    return imgRef.current.offsetWidth / naturalW;
  }

  function getDisplayCrop() {
    const s = getScale();
    return { x: crop.x * s, y: crop.y * s, w: crop.w * s, h: crop.h * s };
  }

  async function handleCrop() {
    if (!file) return;
    setStatus('processing');
    setProgress(0);
    try {
      const res = await cropImage(file, { x: crop.x, y: crop.y, width: crop.w, height: crop.h, outputFormat, quality }, setProgress);
      setResult(res.files[0]);
      setStatus('done');
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Crop failed.');
      setStatus('error');
    }
  }

  const dc = getDisplayCrop();

  return (
    <div class="space-y-6 max-w-4xl">
      {!file && (
        <DropZone
          acceptedTypes={tool.acceptedTypes}
          acceptedExtensions={tool.acceptedExtensions}
          maxSizeMB={tool.maxSizeMB}
          maxTotalSizeMB={undefined}
          multiFile={false}
          onFilesSelected={onFilesSelected}
        />
      )}

      {file && status !== 'done' && (
        <>
          {/* Crop canvas area */}
          <div class="relative overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-800 select-none" ref={containerRef}>
            <img
              ref={imgRef}
              src={imgSrc}
              alt="Image to crop"
              onLoad={onImageLoad}
              class="block w-full"
              draggable={false}
            />
            {/* Crop overlay */}
            {naturalW > 0 && (
              <div
                class="absolute border-2 border-brand-500 bg-brand-500/10"
                style={{
                  left: `${dc.x}px`,
                  top: `${dc.y}px`,
                  width: `${dc.w}px`,
                  height: `${dc.h}px`,
                  cursor: 'move',
                }}
              >
                {/* Handles */}
                {['nw','ne','sw','se'].map(h => (
                  <div
                    key={h}
                    class="absolute w-3 h-3 bg-white border-2 border-brand-500 rounded-sm"
                    style={{
                      top: h.startsWith('n') ? '-6px' : 'auto',
                      bottom: h.startsWith('s') ? '-6px' : 'auto',
                      left: h.endsWith('w') ? '-6px' : 'auto',
                      right: h.endsWith('e') ? '-6px' : 'auto',
                      cursor: `${h}-resize`,
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Crop info */}
          <div class="flex flex-wrap gap-4 p-4 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-sm font-mono text-neutral-700 dark:text-neutral-300">
            <span>x: {Math.round(crop.x)}</span>
            <span>y: {Math.round(crop.y)}</span>
            <span>w: {Math.round(crop.w)}</span>
            <span>h: {Math.round(crop.h)}</span>
            <span class="text-neutral-500">({Math.round(crop.w)} × {Math.round(crop.h)} px)</span>
          </div>

          {/* Options */}
          <div class="p-5 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-4">
            <h3 class="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Options</h3>

            {/* Aspect ratio */}
            <div>
              <p class="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">Aspect ratio</p>
              <div class="flex flex-wrap gap-2">
                {ASPECT_RATIOS.map(ar => (
                  <button
                    key={ar.label}
                    type="button"
                    onClick={() => setAspectRatio(ar.value)}
                    class={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${aspectRatio === ar.value ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/40 text-brand-600 dark:text-brand-400' : 'border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:border-neutral-400'}`}
                  >
                    {ar.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Output format */}
            <div>
              <p class="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">Output format</p>
              <div class="flex gap-2">
                {(['image/jpeg', 'image/png'] as const).map(fmt => (
                  <button
                    key={fmt}
                    type="button"
                    onClick={() => setOutputFormat(fmt)}
                    class={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${outputFormat === fmt ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/40 text-brand-600 dark:text-brand-400' : 'border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400'}`}
                  >
                    {fmt === 'image/jpeg' ? 'JPEG' : 'PNG'}
                  </button>
                ))}
              </div>
            </div>

            {outputFormat === 'image/jpeg' && (
              <div>
                <label for="crop-quality" class="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                  Quality: <strong>{Math.round(quality * 100)}%</strong>
                </label>
                <input
                  id="crop-quality"
                  type="range" min="50" max="100" step="5"
                  value={Math.round(quality * 100)}
                  onInput={(e) => setQuality(parseInt((e.target as HTMLInputElement).value) / 100)}
                  class="w-full accent-brand-600"
                />
              </div>
            )}
          </div>

          {status === 'processing' && <ProgressBar value={progress} label="Cropping…" />}
          {status === 'error' && (
            <div role="alert" class="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/50 text-sm text-red-700 dark:text-red-400">
              {errorMsg}
            </div>
          )}

          <button
            type="button"
            onClick={handleCrop}
            disabled={status === 'processing'}
            class="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:bg-neutral-300 dark:disabled:bg-neutral-700 text-white font-semibold text-sm shadow-lg transition-all duration-200"
          >
            ✂️ Crop Image
          </button>
        </>
      )}

      {status === 'done' && result && (
        <div class="space-y-4 animate-fade-in">
          <div class="flex items-center gap-3 p-4 rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800/50">
            <span class="text-green-600 dark:text-green-400 text-lg">✓</span>
            <p class="text-sm font-medium text-green-800 dark:text-green-300">Cropped successfully! {result.size}</p>
          </div>
          {result.preview && (
            <img src={result.preview} alt="Cropped result" class="max-w-full rounded-xl border border-neutral-200 dark:border-neutral-800 max-h-96 object-contain" />
          )}
          <button
            type="button"
            onClick={() => downloadBlob(result.blob, result.name)}
            class="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold text-sm shadow-lg transition-all duration-200"
          >
            ⬇️ Download
          </button>
          <button type="button" onClick={() => { setFile(null); setStatus('idle'); setResult(null); setImgSrc(''); }}
            class="flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors ml-4">
            Process another file
          </button>
        </div>
      )}
    </div>
  );
}
