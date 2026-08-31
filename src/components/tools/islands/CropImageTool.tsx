/** @jsxImportSource preact */
/**
 * CropImageTool.tsx — Interactive image cropper with aspect ratio presets & touch support
 */
import { useState, useRef } from 'preact/hooks';
import DropZone from '@/components/tools/DropZone';
import ProgressBar from '@/components/tools/ProgressBar';
import { cropImage } from '@/lib/image/crop';
import { downloadBlob } from '@/utils/helpers';
import type { ToolConfig, ProcessedFile } from '@/types/index';

interface Props { tool: ToolConfig }

const ASPECT_RATIOS: { label: string; value: number | null; icon?: string }[] = [
  { label: 'Freeform', value: null },
  { label: '1:1 Square', value: 1 },
  { label: '16:9 Landscape', value: 16 / 9 },
  { label: '4:3 Standard', value: 4 / 3 },
  { label: '3:2 Photo', value: 3 / 2 },
  { label: '9:16 Story', value: 9 / 16 },
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
    // Initial crop: 90% centered box
    const marginW = iw * 0.05;
    const marginH = ih * 0.05;
    setCrop({
      x: marginW,
      y: marginH,
      w: iw - marginW * 2,
      h: ih - marginH * 2,
    });
  }

  function applyAspectRatio(ar: number | null) {
    setAspectRatio(ar);
    if (!ar || naturalW === 0 || naturalH === 0) return;

    let newW = crop.w;
    let newH = newW / ar;

    if (newH > naturalH) {
      newH = naturalH * 0.9;
      newW = newH * ar;
    }
    if (newW > naturalW) {
      newW = naturalW * 0.9;
      newH = newW / ar;
    }

    const newX = Math.max(0, (naturalW - newW) / 2);
    const newY = Math.max(0, (naturalH - newH) / 2);

    setCrop({ x: newX, y: newY, w: newW, h: newH });
  }

  function getScale() {
    if (!imgRef.current || naturalW === 0) return 1;
    return imgRef.current.offsetWidth / naturalW;
  }

  function getDisplayCrop() {
    const s = getScale();
    return {
      x: Math.round(crop.x * s),
      y: Math.round(crop.y * s),
      w: Math.round(crop.w * s),
      h: Math.round(crop.h * s),
    };
  }

  async function handleCrop() {
    if (!file) return;
    setStatus('processing');
    setProgress(0);
    try {
      const res = await cropImage(
        file,
        {
          x: Math.max(0, Math.round(crop.x)),
          y: Math.max(0, Math.round(crop.y)),
          width: Math.max(1, Math.round(crop.w)),
          height: Math.max(1, Math.round(crop.h)),
          outputFormat,
          quality,
        },
        setProgress
      );
      setResult(res.files[0]);
      setStatus('done');
      (window as any).__magictools_toast?.({
        type: 'success',
        title: 'Crop Finished',
        message: 'Image cropped successfully!',
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Crop failed.';
      setErrorMsg(msg);
      setStatus('error');
      (window as any).__magictools_toast?.({
        type: 'error',
        title: 'Crop Failed',
        message: msg,
      });
    }
  }

  const dc = getDisplayCrop();

  return (
    <div class="space-y-6 max-w-4xl mx-auto">
      {!file && (
        <DropZone
          acceptedTypes={tool.acceptedTypes}
          acceptedExtensions={tool.acceptedExtensions}
          maxSizeMB={tool.maxSizeMB}
          multiFile={false}
          onFilesSelected={onFilesSelected}
        />
      )}

      {file && status !== 'done' && (
        <div class="space-y-6">
          {/* Crop Canvas Viewport */}
          <div class="p-4 rounded-3xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm space-y-4">
            <div class="flex items-center justify-between text-xs sm:text-sm font-semibold text-neutral-800 dark:text-neutral-200">
              <span>Interactive Crop Canvas</span>
              <span class="font-mono text-xs text-neutral-500">
                Original: {naturalW} × {naturalH} px
              </span>
            </div>

            <div
              ref={containerRef}
              class="relative overflow-hidden rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-950 flex items-center justify-center select-none max-h-[500px]"
            >
              <img
                ref={imgRef}
                src={imgSrc}
                alt="Image to crop"
                onLoad={onImageLoad}
                class="block w-full max-h-[480px] object-contain mx-auto"
                draggable={false}
              />

              {/* Highlight Crop Box */}
              {naturalW > 0 && (
                <div
                  class="absolute border-2 border-brand-500 bg-brand-500/15 shadow-[0_0_0_9999px_rgba(0,0,0,0.55)] pointer-events-none"
                  style={{
                    left: `${dc.x}px`,
                    top: `${dc.y}px`,
                    width: `${dc.w}px`,
                    height: `${dc.h}px`,
                  }}
                >
                  <div class="absolute -top-7 left-0 px-2 py-0.5 bg-brand-600 text-white font-mono text-[10px] font-bold rounded">
                    {Math.round(crop.w)} × {Math.round(crop.h)} px
                  </div>
                </div>
              )}
            </div>

            {/* Crop Dimension Sliders (Works on both Touch & Desktop!) */}
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label for="crop-width" class="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                  Crop Width: <span class="font-mono text-brand-600 font-bold">{Math.round(crop.w)} px</span>
                </label>
                <input
                  id="crop-width"
                  type="range"
                  min="50"
                  max={naturalW || 1000}
                  value={Math.round(crop.w)}
                  onInput={(e) => {
                    const val = parseInt((e.target as HTMLInputElement).value, 10);
                    const newH = aspectRatio ? val / aspectRatio : crop.h;
                    setCrop({ ...crop, w: val, h: Math.min(newH, naturalH) });
                  }}
                  class="w-full accent-brand-600 cursor-pointer"
                />
              </div>

              <div>
                <label for="crop-height" class="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                  Crop Height: <span class="font-mono text-brand-600 font-bold">{Math.round(crop.h)} px</span>
                </label>
                <input
                  id="crop-height"
                  type="range"
                  min="50"
                  max={naturalH || 1000}
                  value={Math.round(crop.h)}
                  onInput={(e) => {
                    const val = parseInt((e.target as HTMLInputElement).value, 10);
                    const newW = aspectRatio ? val * aspectRatio : crop.w;
                    setCrop({ ...crop, h: val, w: Math.min(newW, naturalW) });
                  }}
                  class="w-full accent-brand-600 cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Aspect Ratio & Format Controls */}
          <div class="p-6 rounded-3xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm space-y-5">
            {/* Aspect Ratio Pills */}
            <div>
              <p class="text-xs sm:text-sm font-semibold text-neutral-800 dark:text-neutral-200 mb-2.5">
                Aspect Ratio Preset
              </p>
              <div class="flex flex-wrap gap-2">
                {ASPECT_RATIOS.map((ar) => (
                  <button
                    key={ar.label}
                    type="button"
                    onClick={() => applyAspectRatio(ar.value)}
                    class={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${aspectRatio === ar.value ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400 shadow-xs' : 'border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:border-neutral-300'}`}
                  >
                    {ar.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Output Format & Quality */}
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-3 border-t border-neutral-100 dark:border-neutral-800">
              <div>
                <p class="text-xs sm:text-sm font-semibold text-neutral-800 dark:text-neutral-200 mb-2">
                  Output Format
                </p>
                <div class="flex gap-2">
                  {(['image/jpeg', 'image/png'] as const).map((fmt) => (
                    <button
                      key={fmt}
                      type="button"
                      onClick={() => setOutputFormat(fmt)}
                      class={`px-4 py-2 rounded-xl text-xs font-semibold border transition-all ${outputFormat === fmt ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400' : 'border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:border-neutral-300'}`}
                    >
                      {fmt === 'image/jpeg' ? 'JPEG' : 'PNG (Lossless)'}
                    </button>
                  ))}
                </div>
              </div>

              {outputFormat === 'image/jpeg' && (
                <div>
                  <div class="flex items-center justify-between mb-1.5">
                    <label for="crop-quality" class="text-xs sm:text-sm font-semibold text-neutral-800 dark:text-neutral-200">
                      JPEG Quality: <span class="font-mono text-brand-600 font-bold">{Math.round(quality * 100)}%</span>
                    </label>
                  </div>
                  <input
                    id="crop-quality"
                    type="range"
                    min="50"
                    max="100"
                    step="5"
                    value={Math.round(quality * 100)}
                    onInput={(e) => setQuality(parseInt((e.target as HTMLInputElement).value, 10) / 100)}
                    class="w-full accent-brand-600 cursor-pointer"
                  />
                </div>
              )}
            </div>
          </div>

          {status === 'processing' && <ProgressBar value={progress} label="Cropping image locally…" />}

          {status === 'error' && (
            <div role="alert" class="p-4 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 text-xs sm:text-sm text-red-700 dark:text-red-400">
              {errorMsg}
            </div>
          )}

          <div class="flex items-center gap-3">
            <button
              type="button"
              onClick={handleCrop}
              disabled={status === 'processing'}
              class="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:bg-neutral-300 text-white font-semibold text-sm shadow-lg shadow-brand-500/25 hover:shadow-brand-500/35 transition-all duration-200 hover:-translate-y-0.5"
            >
              <span>✂️</span>
              <span>Crop & Save Image</span>
            </button>
            <button
              type="button"
              onClick={() => { setFile(null); setImgSrc(''); }}
              class="px-4 py-3.5 rounded-xl border border-neutral-300 dark:border-neutral-700 text-xs sm:text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            >
              Choose different image
            </button>
          </div>
        </div>
      )}

      {/* Done State */}
      {status === 'done' && result && (
        <div class="space-y-5 animate-fade-in">
          <div class="flex items-center gap-3.5 p-4 sm:p-5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60">
            <div class="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-sm">✓</div>
            <div>
              <p class="font-display font-bold text-emerald-950 dark:text-emerald-100">Cropped Successfully!</p>
              <p class="text-xs text-emerald-800 dark:text-emerald-300 mt-0.5">Output file size: {result.size}</p>
            </div>
          </div>

          {result.preview && (
            <div class="p-4 rounded-3xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm flex items-center justify-center">
              <img src={result.preview} alt="Cropped result preview" class="max-w-full rounded-2xl max-h-96 object-contain" />
            </div>
          )}

          <div class="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => downloadBlob(result.blob, result.name)}
              class="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold text-sm shadow-md shadow-brand-500/20 transition-all hover:-translate-y-0.5"
            >
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
              </svg>
              <span>Download Cropped Image</span>
            </button>
            <button
              type="button"
              onClick={() => { setFile(null); setStatus('idle'); setResult(null); setImgSrc(''); }}
              class="px-4 py-3.5 rounded-xl border border-neutral-300 dark:border-neutral-700 text-xs sm:text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            >
              Process another photo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
