/** @jsxImportSource preact */
import { useState, useEffect, useRef, useCallback, useMemo } from 'preact/hooks';
import { PDFDocument } from 'pdf-lib';
import { downloadBlob, formatBytes, clamp, uid } from '@/utils/helpers';
import type { ToolConfig } from '@/types/index';

interface Props {
  tool: ToolConfig;
}

// ─────────────────────────────────────────────
// Types & Presets
// ─────────────────────────────────────────────

export type PageUnit = 'mm' | 'cm' | 'in';

export interface PageFormatPreset {
  id: string;
  name: string;
  type: 'paper' | 'ratio';
  widthMm: number;
  heightMm: number;
  aspectRatio?: string;
  description: string;
}

export const PAGE_PRESETS: PageFormatPreset[] = [
  // Standard Paper Sizes
  { id: 'a4', name: 'A4', type: 'paper', widthMm: 210, heightMm: 297, description: '210 × 297 mm — Standard Document' },
  { id: 'a5', name: 'A5', type: 'paper', widthMm: 148, heightMm: 210, description: '148 × 210 mm — Half A4 / Booklet' },
  { id: 'a3', name: 'A3', type: 'paper', widthMm: 297, heightMm: 420, description: '297 × 420 mm — Poster / Ledger' },
  { id: 'letter', name: 'US Letter', type: 'paper', widthMm: 215.9, heightMm: 279.4, description: '8.5 × 11 in — US Standard' },

  // Aspect Ratios
  { id: 'ratio-3-4', name: '3:4 Portrait', type: 'ratio', widthMm: 150, heightMm: 200, aspectRatio: '3:4', description: 'Standard Photo Portrait' },
  { id: 'ratio-4-3', name: '4:3 Landscape', type: 'ratio', widthMm: 200, heightMm: 150, aspectRatio: '4:3', description: 'Standard Photo Landscape' },
  { id: 'ratio-9-16', name: '9:16 Portrait', type: 'ratio', widthMm: 108, heightMm: 192, aspectRatio: '9:16', description: 'Story / Mobile Screen' },
  { id: 'ratio-16-9', name: '16:9 Landscape', type: 'ratio', widthMm: 192, heightMm: 108, aspectRatio: '16:9', description: 'Widescreen / HD Video' },
  { id: 'ratio-1-1', name: '1:1 Square', type: 'ratio', widthMm: 150, heightMm: 150, aspectRatio: '1:1', description: 'Square Post / Avatar' },
];

export const MM_TO_PT = 72 / 25.4;
export const PT_TO_MM = 25.4 / 72;

export interface PageConfig {
  presetId: string;
  name: string;
  widthMm: number;
  heightMm: number;
  orientation: 'portrait' | 'landscape';
  bgColor: string;
  marginMm: number;
  showMargins: boolean;
  showSnapGuides: boolean;
}

export type FitMode = 'contain' | 'cover' | 'stretch' | 'original';

export interface CropInsets {
  left: number;   // 0 to 0.85
  top: number;    // 0 to 0.85
  right: number;  // 0 to 0.85
  bottom: number; // 0 to 0.85
}

export interface CanvasObject {
  id: string;
  name: string;
  src: string;
  dataUrl?: string;
  naturalWidth: number;
  naturalHeight: number;
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
  rotation: number;
  opacity: number;
  aspectLocked: boolean;
  fitMode: FitMode;
  crop: CropInsets;
  zIndex: number;
  visible: boolean;
  locked: boolean;
}

interface HistoryStep {
  objects: CanvasObject[];
  pageConfig: PageConfig;
  description: string;
}

interface StoredProject {
  version: number;
  savedAt: string;
  pageConfig: PageConfig;
  objects: CanvasObject[];
}

// ─────────────────────────────────────────────
// LocalStorage Auto-Save Helpers
// ─────────────────────────────────────────────
const STORAGE_KEY = 'magictools_pagedesigner_project';

function saveProjectToStorage(project: StoredProject): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
  } catch {
    // Ignore quota or private browsing errors
  }
}

function loadProjectFromStorage(): StoredProject | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function clearProjectStorage(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore
  }
}

// ─────────────────────────────────────────────
// Main Page Designer Island Component
// ─────────────────────────────────────────────

export default function PageDesignerTool({ tool: _tool }: Props) {
  // Page Configuration
  const [pageConfig, setPageConfig] = useState<PageConfig>({
    presetId: 'a4',
    name: 'A4',
    widthMm: 210,
    heightMm: 297,
    orientation: 'portrait',
    bgColor: '#ffffff',
    marginMm: 10,
    showMargins: true,
    showSnapGuides: true,
  });

  const pageWidthMm = useMemo(() => {
    return pageConfig.orientation === 'portrait'
      ? Math.min(pageConfig.widthMm, pageConfig.heightMm)
      : Math.max(pageConfig.widthMm, pageConfig.heightMm);
  }, [pageConfig.widthMm, pageConfig.heightMm, pageConfig.orientation]);

  const pageHeightMm = useMemo(() => {
    return pageConfig.orientation === 'portrait'
      ? Math.max(pageConfig.widthMm, pageConfig.heightMm)
      : Math.min(pageConfig.widthMm, pageConfig.heightMm);
  }, [pageConfig.widthMm, pageConfig.heightMm, pageConfig.orientation]);

  // Objects & Selection
  const [objects, setObjects] = useState<CanvasObject[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Direct 4-Side Crop Mode State
  const [isCropping, setIsCropping] = useState<boolean>(false);
  const [cropHandle, setCropHandle] = useState<
    'none' | 'crop-top' | 'crop-bottom' | 'crop-left' | 'crop-right' |
    'crop-nw' | 'crop-ne' | 'crop-sw' | 'crop-se'
  >('none');

  const cropDragRef = useRef<{
    startX: number;
    startY: number;
    initXMm: number;
    initYMm: number;
    initWidthMm: number;
    initHeightMm: number;
    initCrop: CropInsets;
    virtualWidthMm: number;
    virtualHeightMm: number;
  } | null>(null);

  // Layer Drag & Drop Reordering State (Left Sidebar)
  const [draggedLayerIdx, setDraggedLayerIdx] = useState<number | null>(null);
  const [dragOverLayerIdx, setDragOverLayerIdx] = useState<number | null>(null);

  // Mobile Bottom Drawer State ('none' | 'layers' | 'properties')
  const [mobileDrawer, setMobileDrawer] = useState<'none' | 'layers' | 'properties'>('none');

  // Workspace Viewport (Pan & Zoom)
  const [zoom, setZoom] = useState<number>(0.85);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Alignment Guidelines State
  const [activeSnapGuides, setActiveSnapGuides] = useState<{ x?: number; y?: number }>({});

  // History for Undo / Redo
  const [history, setHistory] = useState<HistoryStep[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const isHistoryAction = useRef(false);

  // Modals & Popups
  const [showPageSetupModal, setShowPageSetupModal] = useState(false);
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState('');
  const lastDoneTimeRef = useRef<number>(0);

  // Transform State (Resize & Move & Rotate)
  const [transformMode, setTransformMode] = useState<
    'none' | 'move' | 'nw-resize' | 'ne-resize' | 'se-resize' | 'sw-resize' |
    'n-resize' | 'e-resize' | 's-resize' | 'w-resize' | 'rotate'
  >('none');

  const transformStartRef = useRef<{
    startX: number;
    startY: number;
    objX: number;
    objY: number;
    objW: number;
    objH: number;
    objRotation: number;
    aspectRatio: number;
  } | null>(null);

  const imageCache = useRef<Map<string, HTMLImageElement>>(new Map());
  const workspaceRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceFileInputRef = useRef<HTMLInputElement>(null);
  const projectFileInputRef = useRef<HTMLInputElement>(null);
  const downloadMenuRef = useRef<HTMLDivElement>(null);
  const lastClickRef = useRef<{ id: string; time: number } | null>(null);

  const selectedObject = useMemo(() => {
    return objects.find((obj) => obj.id === selectedId) || null;
  }, [objects, selectedId]);

  // Close download menu on click outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (downloadMenuRef.current && !downloadMenuRef.current.contains(e.target as Node)) {
        setShowDownloadMenu(false);
      }
    };
    if (showDownloadMenu) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [showDownloadMenu]);

  // ─────────────────────────────────────────────
  // Push to Undo History
  // ─────────────────────────────────────────────
  const pushHistory = useCallback(
    (description: string, newObjects = objects, newConfig = pageConfig) => {
      if (isHistoryAction.current) return;
      const step: HistoryStep = {
        objects: JSON.parse(JSON.stringify(newObjects)),
        pageConfig: { ...newConfig },
        description,
      };
      setHistory((prev) => {
        const sliced = prev.slice(0, historyIndex + 1);
        return [...sliced, step].slice(-50);
      });
      setHistoryIndex((prev) => Math.min(prev + 1, 49));
    },
    [historyIndex, objects, pageConfig]
  );

  useEffect(() => {
    if (history.length === 0) {
      pushHistory('Initial state', objects, pageConfig);
    }
  }, []);

  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      setIsCropping(false);
      isHistoryAction.current = true;
      const targetStep = history[historyIndex - 1];
      setObjects(JSON.parse(JSON.stringify(targetStep.objects)));
      setPageConfig({ ...targetStep.pageConfig });
      setHistoryIndex(historyIndex - 1);
      setTimeout(() => {
        isHistoryAction.current = false;
      }, 50);
    }
  }, [history, historyIndex]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      setIsCropping(false);
      isHistoryAction.current = true;
      const targetStep = history[historyIndex + 1];
      setObjects(JSON.parse(JSON.stringify(targetStep.objects)));
      setPageConfig({ ...targetStep.pageConfig });
      setHistoryIndex(historyIndex + 1);
      setTimeout(() => {
        isHistoryAction.current = false;
      }, 50);
    }
  }, [history, historyIndex]);

  // ─────────────────────────────────────────────
  // Auto-Save Draft to LocalStorage (Silently saves & restores last project)
  // ─────────────────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => {
      if (objects.length > 0) {
        saveProjectToStorage({
          version: 1,
          savedAt: new Date().toISOString(),
          pageConfig,
          objects,
        });
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [objects, pageConfig]);

  useEffect(() => {
    const saved = loadProjectFromStorage();
    if (saved && saved.pageConfig && Array.isArray(saved.objects) && saved.objects.length > 0) {
      setPageConfig(saved.pageConfig);
      setObjects(saved.objects);
      pushHistory('Restored saved project', saved.objects, saved.pageConfig);
    }
  }, []);

  // ─────────────────────────────────────────────
  // Fit Page to Screen
  // ─────────────────────────────────────────────
  const fitToScreen = useCallback(() => {
    if (!workspaceRef.current) return;
    const { clientWidth, clientHeight } = workspaceRef.current;
    if (clientWidth <= 0 || clientHeight <= 0) return;

    const pagePxW = pageWidthMm * 3.78;
    const pagePxH = pageHeightMm * 3.78;

    const pad = 48;
    const availW = Math.max(100, clientWidth - pad);
    const availH = Math.max(100, clientHeight - pad);

    const fitScale = Math.min(availW / pagePxW, availH / pagePxH, 1.2);
    setZoom(parseFloat(fitScale.toFixed(2)));
    setPan({ x: 0, y: 0 });
  }, [pageWidthMm, pageHeightMm]);

  useEffect(() => {
    fitToScreen();
    window.addEventListener('resize', fitToScreen);
    return () => window.removeEventListener('resize', fitToScreen);
  }, [pageWidthMm, pageHeightMm, fitToScreen]);

  // ─────────────────────────────────────────────
  // Image Loading
  // ─────────────────────────────────────────────
  const loadImage = useCallback((src: string): Promise<HTMLImageElement> => {
    if (imageCache.current.has(src)) {
      return Promise.resolve(imageCache.current.get(src)!);
    }
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        imageCache.current.set(src, img);
        resolve(img);
      };
      img.onerror = reject;
      img.src = src;
    });
  }, []);

  useEffect(() => {
    objects.forEach((obj) => {
      if (!imageCache.current.has(obj.src)) {
        loadImage(obj.src).catch(() => {});
      }
    });
  }, [objects, loadImage]);

  // Upload / Add Images
  const handleAddFiles = async (files: File[]) => {
    const validFiles = files.filter((f) => f.type.startsWith('image/'));
    if (validFiles.length === 0) return;

    const newObjs: CanvasObject[] = [];

    for (let i = 0; i < validFiles.length; i++) {
      const file = validFiles[i];
      try {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        const img = await loadImage(dataUrl);
        const naturalW = img.naturalWidth || 800;
        const naturalH = img.naturalHeight || 600;
        const aspect = naturalW / naturalH;

        const targetW = Math.min(pageWidthMm * 0.45, 120);
        const targetH = targetW / aspect;

        const offsetX = (i * 8) % 40;
        const offsetY = (i * 8) % 40;
        const posX = Math.max(5, (pageWidthMm - targetW) / 2 + offsetX);
        const posY = Math.max(5, (pageHeightMm - targetH) / 2 + offsetY);

        const newObj: CanvasObject[] = {
          id: uid(),
          name: file.name.replace(/\.[^/.]+$/, ''),
          src: dataUrl,
          dataUrl,
          naturalWidth: naturalW,
          naturalHeight: naturalH,
          xMm: parseFloat(posX.toFixed(1)),
          yMm: parseFloat(posY.toFixed(1)),
          widthMm: parseFloat(targetW.toFixed(1)),
          heightMm: parseFloat(targetH.toFixed(1)),
          rotation: 0,
          opacity: 1,
          aspectLocked: true,
          fitMode: 'contain',
          crop: { top: 0, right: 0, bottom: 0, left: 0 },
          zIndex: objects.length + i + 1,
          visible: true,
          locked: false,
        };

        newObjs.push(newObj);
      } catch (err) {
        console.error('Failed to load image', err);
      }
    }

    if (newObjs.length > 0) {
      const updated = [...objects, ...newObjs];
      setObjects(updated);
      setSelectedId(newObjs[newObjs.length - 1].id);
      pushHistory(`Added ${newObjs.length} image(s)`, updated);
    }
  };

  const handleReplaceImage = async (file: File) => {
    if (!selectedObject || !file.type.startsWith('image/')) return;
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const img = await loadImage(dataUrl);
      const updated = objects.map((obj) => {
        if (obj.id === selectedObject.id) {
          return {
            ...obj,
            src: dataUrl,
            dataUrl,
            naturalWidth: img.naturalWidth,
            naturalHeight: img.naturalHeight,
            name: file.name.replace(/\.[^/.]+$/, ''),
          };
        }
        return obj;
      });

      setObjects(updated);
      pushHistory(`Replaced image for ${selectedObject.name}`, updated);
    } catch (err) {
      console.error('Failed to replace image', err);
    }
  };

  // ─────────────────────────────────────────────
  // Layer Drag & Drop Handlers (Left Sidebar)
  // ─────────────────────────────────────────────
  const sortedLayersDescending = useMemo(() => {
    // Top layer on canvas has highest zIndex; display at index 0 in sidebar
    return [...objects].sort((a, b) => b.zIndex - a.zIndex);
  }, [objects]);

  const handleLayerDragStart = (e: DragEvent, index: number) => {
    setDraggedLayerIdx(index);
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(index));
    }
  };

  const handleLayerDragOver = (e: DragEvent, index: number) => {
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'move';
    }
    if (dragOverLayerIdx !== index) {
      setDragOverLayerIdx(index);
    }
  };

  const handleLayerDrop = (e: DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedLayerIdx === null || draggedLayerIdx === dropIndex) {
      setDraggedLayerIdx(null);
      setDragOverLayerIdx(null);
      return;
    }

    const list = [...sortedLayersDescending];
    const [movedItem] = list.splice(draggedLayerIdx, 1);
    list.splice(dropIndex, 0, movedItem);

    // Reassign zIndex: index 0 gets highest zIndex
    const total = list.length;
    list.forEach((obj, idx) => {
      obj.zIndex = total - idx;
    });

    setObjects([...list]);
    setSelectedId(movedItem.id);
    setDraggedLayerIdx(null);
    setDragOverLayerIdx(null);
    pushHistory('Reordered layers', list);
  };

  const handleLayerDragEnd = () => {
    setDraggedLayerIdx(null);
    setDragOverLayerIdx(null);
  };

  const handleMoveLayerStep = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= sortedLayersDescending.length) return;

    const list = [...sortedLayersDescending];
    const [movedItem] = list.splice(index, 1);
    list.splice(targetIndex, 0, movedItem);

    const total = list.length;
    list.forEach((obj, idx) => {
      obj.zIndex = total - idx;
    });

    setObjects([...list]);
    setSelectedId(movedItem.id);
    pushHistory('Reordered layers', list);
  };

  // ─────────────────────────────────────────────
  // Canvas Rendering
  // ─────────────────────────────────────────────
  const basePpm = 3.779528;

  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const canvasW = Math.round(pageWidthMm * basePpm);
    const canvasH = Math.round(pageHeightMm * basePpm);

    if (canvas.width !== canvasW || canvas.height !== canvasH) {
      canvas.width = canvasW;
      canvas.height = canvasH;
    }

    ctx.clearRect(0, 0, canvasW, canvasH);

    // 1. Draw Page Background
    if (pageConfig.bgColor === 'transparent') {
      const patSize = 16;
      for (let y = 0; y < canvasH; y += patSize) {
        for (let x = 0; x < canvasW; x += patSize) {
          ctx.fillStyle = ((x / patSize + y / patSize) % 2 === 0) ? '#f8fafc' : '#e2e8f0';
          ctx.fillRect(x, y, patSize, patSize);
        }
      }
    } else {
      ctx.fillStyle = pageConfig.bgColor;
      ctx.fillRect(0, 0, canvasW, canvasH);
    }

    // 2. Draw Margins Guide
    if (pageConfig.showMargins && pageConfig.marginMm > 0) {
      const marginPx = pageConfig.marginMm * basePpm;
      ctx.save();
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(marginPx, marginPx, canvasW - marginPx * 2, canvasH - marginPx * 2);
      ctx.restore();
    }

    // 3. Render Objects
    const sortedObjects = [...objects].sort((a, b) => a.zIndex - b.zIndex);

    sortedObjects.forEach((obj) => {
      if (!obj.visible) return;

      const img = imageCache.current.get(obj.src);
      if (!img || !img.complete) return;

      ctx.save();

      const objPxX = obj.xMm * basePpm;
      const objPxY = obj.yMm * basePpm;
      const objPxW = obj.widthMm * basePpm;
      const objPxH = obj.heightMm * basePpm;

      ctx.globalAlpha = obj.opacity;

      const centerX = objPxX + objPxW / 2;
      const centerY = objPxY + objPxH / 2;
      ctx.translate(centerX, centerY);
      if (obj.rotation !== 0) {
        ctx.rotate((obj.rotation * Math.PI) / 180);
      }

      const drawX = -objPxW / 2;
      const drawY = -objPxH / 2;

      // 4-Side Crop Insets Math
      const cropLeft = obj.crop?.left || 0;
      const cropTop = obj.crop?.top || 0;
      const cropRight = obj.crop?.right || 0;
      const cropBottom = obj.crop?.bottom || 0;

      const sx = cropLeft * obj.naturalWidth;
      const sy = cropTop * obj.naturalHeight;
      const sw = Math.max(1, (1 - cropLeft - cropRight) * obj.naturalWidth);
      const sh = Math.max(1, (1 - cropTop - cropBottom) * obj.naturalHeight);

      ctx.drawImage(img, sx, sy, sw, sh, drawX, drawY, objPxW, objPxH);

      ctx.restore();
    });

    // 4. Snap Guidelines
    if (pageConfig.showSnapGuides) {
      ctx.save();
      ctx.strokeStyle = '#6366f1';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 3]);

      if (activeSnapGuides.x !== undefined) {
        const guidePxX = activeSnapGuides.x * basePpm;
        ctx.beginPath();
        ctx.moveTo(guidePxX, 0);
        ctx.lineTo(guidePxX, canvasH);
        ctx.stroke();
      }

      if (activeSnapGuides.y !== undefined) {
        const guidePxY = activeSnapGuides.y * basePpm;
        ctx.beginPath();
        ctx.moveTo(0, guidePxY);
        ctx.lineTo(canvasW, guidePxY);
        ctx.stroke();
      }
      ctx.restore();
    }
  }, [pageWidthMm, pageHeightMm, pageConfig, objects, activeSnapGuides]);

  useEffect(() => {
    let animId = requestAnimationFrame(renderCanvas);
    return () => cancelAnimationFrame(animId);
  }, [renderCanvas]);

  // ─────────────────────────────────────────────
  // Pointer & Drag Interactions
  // ─────────────────────────────────────────────
  const clientToPageMm = useCallback(
    (clientX: number, clientY: number) => {
      if (!canvasRef.current) return { x: 0, y: 0 };
      const rect = canvasRef.current.getBoundingClientRect();
      const canvasPxX = (clientX - rect.left) / zoom;
      const canvasPxY = (clientY - rect.top) / zoom;
      return {
        x: canvasPxX / basePpm,
        y: canvasPxY / basePpm,
      };
    },
    [zoom]
  );

  const rotatePoint = (x: number, y: number, cx: number, cy: number, rad: number) => {
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const dx = x - cx;
    const dy = y - cy;
    return {
      x: cx + dx * cos - dy * sin,
      y: cy + dx * sin + dy * cos,
    };
  };

  const hitTestObject = useCallback((pointMm: { x: number; y: number }, obj: CanvasObject) => {
    const centerX = obj.xMm + obj.widthMm / 2;
    const centerY = obj.yMm + obj.heightMm / 2;
    const rad = (-obj.rotation * Math.PI) / 180;
    const unrotated = rotatePoint(pointMm.x, pointMm.y, centerX, centerY, rad);

    return (
      unrotated.x >= obj.xMm &&
      unrotated.x <= obj.xMm + obj.widthMm &&
      unrotated.y >= obj.yMm &&
      unrotated.y <= obj.yMm + obj.heightMm
    );
  }, []);

  const handlePointerDown = (e: MouseEvent | TouchEvent) => {
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;

    if (('button' in e && (e as MouseEvent).button === 1) || (e as KeyboardEvent).spaceKey) {
      setIsPanning(true);
      setPanStart({ x: clientX - pan.x, y: clientY - pan.y });
      return;
    }

    const clickPt = clientToPageMm(clientX, clientY);
    if (transformMode !== 'none' || cropHandle !== 'none') return;

    const sorted = [...objects].sort((a, b) => b.zIndex - a.zIndex);
    const clickedObj = sorted.find((obj) => obj.visible && !obj.locked && hitTestObject(clickPt, obj));

    if (clickedObj) {
      const now = Date.now();
      const isDouble =
        ('detail' in e && (e as MouseEvent).detail >= 2) ||
        (lastClickRef.current &&
          lastClickRef.current.id === clickedObj.id &&
          now - lastClickRef.current.time < 350);

      lastClickRef.current = { id: clickedObj.id, time: now };

      // Double-click/double-tap opens crop tool directly
      if (isDouble) {
        setSelectedId(clickedObj.id);
        setIsCropping(true);
        setTransformMode('none');
        return;
      }

      if (selectedId !== clickedObj.id) {
        setIsCropping(false);
      }
      setSelectedId(clickedObj.id);

      if (!isCropping) {
        setTransformMode('move');
        transformStartRef.current = {
          startX: clickPt.x,
          startY: clickPt.y,
          objX: clickedObj.xMm,
          objY: clickedObj.yMm,
          objW: clickedObj.widthMm,
          objH: clickedObj.heightMm,
          objRotation: clickedObj.rotation,
          aspectRatio: clickedObj.widthMm / clickedObj.heightMm,
        };
      }
    } else {
      setSelectedId(null);
      setIsCropping(false);
      // On mobile / touch, NEVER start canvas panning — keep canvas static so normal webpage scrolling is undisturbed
      const isTouch = 'touches' in e;
      if (!isTouch && typeof window !== 'undefined' && window.innerWidth >= 1024) {
        setIsPanning(true);
        setPanStart({ x: clientX - pan.x, y: clientY - pan.y });
      }
    }
  };

  const handleDoubleClick = (e: MouseEvent) => {
    const clickPt = clientToPageMm(e.clientX, e.clientY);
    const sorted = [...objects].sort((a, b) => b.zIndex - a.zIndex);
    const clickedObj = sorted.find((obj) => obj.visible && !obj.locked && hitTestObject(clickPt, obj));
    if (clickedObj) {
      setSelectedId(clickedObj.id);
      setIsCropping(true);
      setTransformMode('none');
    }
  };

  const handlePointerMove = useCallback(
    (e: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;

      if (isPanning) {
        setPan({
          x: clientX - panStart.x,
          y: clientY - panStart.y,
        });
        return;
      }

      // 1. Direct 4-Side Cropping
      if (isCropping && cropHandle !== 'none' && cropDragRef.current && selectedObject) {
        const ref = cropDragRef.current;
        const currentPt = clientToPageMm(clientX, clientY);
        const dx = currentPt.x - ref.startX;
        const dy = currentPt.y - ref.startY;

        const rotRad = (-selectedObject.rotation * Math.PI) / 180;
        const localDx = dx * Math.cos(rotRad) - dy * Math.sin(rotRad);
        const localDy = dx * Math.sin(rotRad) + dy * Math.cos(rotRad);

        let newLeft = ref.initCrop.left;
        let newRight = ref.initCrop.right;
        let newTop = ref.initCrop.top;
        let newBottom = ref.initCrop.bottom;

        let newXMm = ref.initXMm;
        let newYMm = ref.initYMm;
        let newWidthMm = ref.initWidthMm;
        let newHeightMm = ref.initHeightMm;

        // Crop Left
        if (cropHandle === 'crop-left' || cropHandle === 'crop-nw' || cropHandle === 'crop-sw') {
          const deltaFraction = localDx / ref.virtualWidthMm;
          newLeft = clamp(ref.initCrop.left + deltaFraction, 0, 1 - ref.initCrop.right - 0.05);
          newWidthMm = ref.virtualWidthMm * (1 - newLeft - ref.initCrop.right);
          newXMm = ref.initXMm + ref.virtualWidthMm * (newLeft - ref.initCrop.left);
        }

        // Crop Right
        if (cropHandle === 'crop-right' || cropHandle === 'crop-ne' || cropHandle === 'crop-se') {
          const deltaFraction = localDx / ref.virtualWidthMm;
          newRight = clamp(ref.initCrop.right - deltaFraction, 0, 1 - ref.initCrop.left - 0.05);
          newWidthMm = ref.virtualWidthMm * (1 - ref.initCrop.left - newRight);
        }

        // Crop Top
        if (cropHandle === 'crop-top' || cropHandle === 'crop-nw' || cropHandle === 'crop-ne') {
          const deltaFraction = localDy / ref.virtualHeightMm;
          newTop = clamp(ref.initCrop.top + deltaFraction, 0, 1 - ref.initCrop.bottom - 0.05);
          newHeightMm = ref.virtualHeightMm * (1 - newTop - ref.initCrop.bottom);
          newYMm = ref.initYMm + ref.virtualHeightMm * (newTop - ref.initCrop.top);
        }

        // Crop Bottom
        if (cropHandle === 'crop-bottom' || cropHandle === 'crop-sw' || cropHandle === 'crop-se') {
          const deltaFraction = localDy / ref.virtualHeightMm;
          newBottom = clamp(ref.initCrop.bottom - deltaFraction, 0, 1 - ref.initCrop.top - 0.05);
          newHeightMm = ref.virtualHeightMm * (1 - ref.initCrop.top - newBottom);
        }

        setObjects((prev) =>
          prev.map((obj) =>
            obj.id === selectedObject.id
              ? {
                  ...obj,
                  xMm: parseFloat(newXMm.toFixed(1)),
                  yMm: parseFloat(newYMm.toFixed(1)),
                  widthMm: parseFloat(newWidthMm.toFixed(1)),
                  heightMm: parseFloat(newHeightMm.toFixed(1)),
                  crop: {
                    left: parseFloat(newLeft.toFixed(3)),
                    right: parseFloat(newRight.toFixed(3)),
                    top: parseFloat(newTop.toFixed(3)),
                    bottom: parseFloat(newBottom.toFixed(3)),
                  },
                }
              : obj
          )
        );
        return;
      }

      // 2. Normal Transform / Move Mode
      if (transformMode === 'none' || !selectedObject || !transformStartRef.current) return;

      const currentPt = clientToPageMm(clientX, clientY);
      const start = transformStartRef.current;
      const dx = currentPt.x - start.startX;
      const dy = currentPt.y - start.startY;

      if (transformMode === 'move') {
        let newX = start.objX + dx;
        let newY = start.objY + dy;

        const snapTol = 2.5;
        const guides: { x?: number; y?: number } = {};

        if (pageConfig.showSnapGuides) {
          const pageCenterX = pageWidthMm / 2;
          const objCenterX = newX + selectedObject.widthMm / 2;
          if (Math.abs(objCenterX - pageCenterX) < snapTol) {
            newX = pageCenterX - selectedObject.widthMm / 2;
            guides.x = pageCenterX;
          }

          const pageCenterY = pageHeightMm / 2;
          const objCenterY = newY + selectedObject.heightMm / 2;
          if (Math.abs(objCenterY - pageCenterY) < snapTol) {
            newY = pageCenterY - selectedObject.heightMm / 2;
            guides.y = pageCenterY;
          }

          if (pageConfig.showMargins && pageConfig.marginMm > 0) {
            const m = pageConfig.marginMm;
            if (Math.abs(newX - m) < snapTol) {
              newX = m;
              guides.x = m;
            }
            if (Math.abs(newX + selectedObject.widthMm - (pageWidthMm - m)) < snapTol) {
              newX = pageWidthMm - m - selectedObject.widthMm;
              guides.x = pageWidthMm - m;
            }
            if (Math.abs(newY - m) < snapTol) {
              newY = m;
              guides.y = m;
            }
            if (Math.abs(newY + selectedObject.heightMm - (pageHeightMm - m)) < snapTol) {
              newY = pageHeightMm - m - selectedObject.heightMm;
              guides.y = pageHeightMm - m;
            }
          }
        }

        setActiveSnapGuides(guides);

        setObjects((prev) =>
          prev.map((obj) =>
            obj.id === selectedObject.id
              ? { ...obj, xMm: parseFloat(newX.toFixed(1)), yMm: parseFloat(newY.toFixed(1)) }
              : obj
          )
        );
      } else if (transformMode === 'rotate') {
        const centerX = selectedObject.xMm + selectedObject.widthMm / 2;
        const centerY = selectedObject.yMm + selectedObject.heightMm / 2;
        const rad = Math.atan2(currentPt.y - centerY, currentPt.x - centerX);
        let deg = (rad * 180) / Math.PI + 90;
        if (deg < 0) deg += 360;

        if ((e as MouseEvent).shiftKey) {
          deg = Math.round(deg / 15) * 15;
        }

        setObjects((prev) =>
          prev.map((obj) => (obj.id === selectedObject.id ? { ...obj, rotation: Math.round(deg) % 360 } : obj))
        );
      } else {
        const rotRad = (-selectedObject.rotation * Math.PI) / 180;
        const localDx = dx * Math.cos(rotRad) - dy * Math.sin(rotRad);
        const localDy = dx * Math.sin(rotRad) + dy * Math.cos(rotRad);

        let newW = start.objW;
        let newH = start.objH;
        let newX = start.objX;
        let newY = start.objY;
        const lockAspect = selectedObject.aspectLocked;

        if (transformMode === 'se-resize') {
          newW = Math.max(10, start.objW + localDx);
          newH = lockAspect ? newW / start.aspectRatio : Math.max(10, start.objH + localDy);
        } else if (transformMode === 'sw-resize') {
          newW = Math.max(10, start.objW - localDx);
          newH = lockAspect ? newW / start.aspectRatio : Math.max(10, start.objH + localDy);
          newX = start.objX + (start.objW - newW);
        } else if (transformMode === 'ne-resize') {
          newW = Math.max(10, start.objW + localDx);
          newH = lockAspect ? newW / start.aspectRatio : Math.max(10, start.objH - localDy);
          newY = start.objY + (start.objH - newH);
        } else if (transformMode === 'nw-resize') {
          newW = Math.max(10, start.objW - localDx);
          newH = lockAspect ? newW / start.aspectRatio : Math.max(10, start.objH - localDy);
          newX = start.objX + (start.objW - newW);
          newY = start.objY + (start.objH - newH);
        }

        setObjects((prev) =>
          prev.map((obj) =>
            obj.id === selectedObject.id
              ? {
                  ...obj,
                  xMm: parseFloat(newX.toFixed(1)),
                  yMm: parseFloat(newY.toFixed(1)),
                  widthMm: parseFloat(newW.toFixed(1)),
                  heightMm: parseFloat(newH.toFixed(1)),
                }
              : obj
          )
        );
      }
    },
    [isPanning, isCropping, cropHandle, selectedObject, transformMode, clientToPageMm, pageConfig, pageWidthMm, pageHeightMm]
  );

  const handlePointerUp = useCallback(() => {
    if (isPanning) {
      setIsPanning(false);
    }
    if (cropHandle !== 'none') {
      setCropHandle('none');
      cropDragRef.current = null;
      pushHistory('Cropped image', objects);
    }
    if (transformMode !== 'none') {
      setTransformMode('none');
      setActiveSnapGuides({});
      transformStartRef.current = null;
      pushHistory('Transform object', objects);
    }
  }, [isPanning, cropHandle, transformMode, objects, pushHistory]);

  useEffect(() => {
    const onMove = (e: MouseEvent | TouchEvent) => {
      // Only prevent native page scroll when actively manipulating an object or crop/resize handle
      if (transformMode !== 'none' || cropHandle !== 'none') {
        if ('touches' in e && e.cancelable) {
          e.preventDefault();
        }
      }
      handlePointerMove(e);
    };
    const onUp = () => handlePointerUp();

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onUp);
    window.addEventListener('touchcancel', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
      window.removeEventListener('touchcancel', onUp);
    };
  }, [handlePointerMove, handlePointerUp, transformMode, cropHandle, isPanning]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
        return;
      }

      if (isCropping) {
        if (e.key === 'Enter' || e.key === 'Escape') {
          e.preventDefault();
          setIsCropping(false);
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        handleUndo();
      } else if (
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'z') ||
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y')
      ) {
        e.preventDefault();
        handleRedo();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedId) {
          e.preventDefault();
          handleDeleteObject(selectedId);
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        if (selectedId) {
          e.preventDefault();
          handleDuplicateObject(selectedId);
        }
      } else if (e.key === 'Escape') {
        setSelectedId(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedId, isCropping, handleUndo, handleRedo]);

  // Clipboard Paste Support
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      const items = e.clipboardData?.items;
      if (!items) return;

      const files: File[] = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const file = items[i].getAsFile();
          if (file) files.push(file);
        }
      }
      if (files.length > 0) {
        handleAddFiles(files);
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [objects]);

  // Object Operations
  const handleDeleteObject = (id: string) => {
    setIsCropping(false);
    const updated = objects.filter((o) => o.id !== id);
    setObjects(updated);
    if (selectedId === id) setSelectedId(null);
    pushHistory('Deleted object', updated);
  };

  const handleDuplicateObject = (id: string) => {
    const target = objects.find((o) => o.id === id);
    if (!target) return;
    const duplicated: CanvasObject = {
      ...JSON.parse(JSON.stringify(target)),
      id: uid(),
      name: `${target.name} (Copy)`,
      xMm: Math.min(pageWidthMm - target.widthMm, target.xMm + 10),
      yMm: Math.min(pageHeightMm - target.heightMm, target.yMm + 10),
      zIndex: objects.length + 1,
    };
    const updated = [...objects, duplicated];
    setObjects(updated);
    setSelectedId(duplicated.id);
    pushHistory('Duplicated object', updated);
  };

  const handleAlign = (type: 'left' | 'center-h' | 'right' | 'top' | 'center-v' | 'bottom') => {
    if (!selectedObject) return;
    let newX = selectedObject.xMm;
    let newY = selectedObject.yMm;
    const m = pageConfig.showMargins ? pageConfig.marginMm : 0;

    switch (type) {
      case 'left':
        newX = m;
        break;
      case 'center-h':
        newX = (pageWidthMm - selectedObject.widthMm) / 2;
        break;
      case 'right':
        newX = pageWidthMm - m - selectedObject.widthMm;
        break;
      case 'top':
        newY = m;
        break;
      case 'center-v':
        newY = (pageHeightMm - selectedObject.heightMm) / 2;
        break;
      case 'bottom':
        newY = pageHeightMm - m - selectedObject.heightMm;
        break;
    }

    const updated = objects.map((obj) =>
      obj.id === selectedObject.id ? { ...obj, xMm: parseFloat(newX.toFixed(1)), yMm: parseFloat(newY.toFixed(1)) } : obj
    );
    setObjects(updated);
    pushHistory(`Aligned object ${type}`, updated);
  };

  // ─────────────────────────────────────────────
  // High-Resolution Export Engine
  // ─────────────────────────────────────────────
  const renderHighResCanvas = async (targetDpi = 300): Promise<HTMLCanvasElement> => {
    const offscreen = document.createElement('canvas');
    const ctx = offscreen.getContext('2d');
    if (!ctx) throw new Error('Could not create offscreen context');

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const dpmm = targetDpi / 25.4;
    const outW = Math.round(pageWidthMm * dpmm);
    const outH = Math.round(pageHeightMm * dpmm);

    offscreen.width = outW;
    offscreen.height = outH;

    if (pageConfig.bgColor !== 'transparent') {
      ctx.fillStyle = pageConfig.bgColor;
      ctx.fillRect(0, 0, outW, outH);
    }

    const sorted = [...objects].sort((a, b) => a.zIndex - b.zIndex);

    for (const obj of sorted) {
      if (!obj.visible) continue;
      const img = await loadImage(obj.src);

      ctx.save();
      const objPxX = obj.xMm * dpmm;
      const objPxY = obj.yMm * dpmm;
      const objPxW = obj.widthMm * dpmm;
      const objPxH = obj.heightMm * dpmm;

      ctx.globalAlpha = obj.opacity;

      const cx = objPxX + objPxW / 2;
      const cy = objPxY + objPxH / 2;
      ctx.translate(cx, cy);
      if (obj.rotation !== 0) {
        ctx.rotate((obj.rotation * Math.PI) / 180);
      }

      const drawX = -objPxW / 2;
      const drawY = -objPxH / 2;

      const cropLeft = obj.crop?.left || 0;
      const cropTop = obj.crop?.top || 0;
      const cropRight = obj.crop?.right || 0;
      const cropBottom = obj.crop?.bottom || 0;

      const sx = cropLeft * obj.naturalWidth;
      const sy = cropTop * obj.naturalHeight;
      const sw = Math.max(1, (1 - cropLeft - cropRight) * obj.naturalWidth);
      const sh = Math.max(1, (1 - cropTop - cropBottom) * obj.naturalHeight);

      ctx.drawImage(img, sx, sy, sw, sh, drawX, drawY, objPxW, objPxH);

      ctx.restore();
    }

    return offscreen;
  };

  const handleExportPdf = async () => {
    setShowDownloadMenu(false);
    try {
      setIsExporting(true);
      setExportMessage('Generating print-ready PDF...');

      const highResCanvas = await renderHighResCanvas(300);
      const blob = await new Promise<Blob>((resolve) => highResCanvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.95));
      const arrayBuffer = await blob.arrayBuffer();

      const pdfDoc = await PDFDocument.create();
      const pagePtW = pageWidthMm * MM_TO_PT;
      const pagePtH = pageHeightMm * MM_TO_PT;

      const page = pdfDoc.addPage([pagePtW, pagePtH]);
      const embeddedImg = await pdfDoc.embedJpg(arrayBuffer);

      page.drawImage(embeddedImg, {
        x: 0,
        y: 0,
        width: pagePtW,
        height: pagePtH,
      });

      const pdfBytes = await pdfDoc.save();
      const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });
      const filename = `${pageConfig.name.toLowerCase().replace(/\s+/g, '-')}-layout.pdf`;
      downloadBlob(pdfBlob, filename);
    } catch (err) {
      console.error('Failed to export PDF', err);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setIsExporting(false);
      setExportMessage('');
    }
  };

  const handleExportPng = async () => {
    setShowDownloadMenu(false);
    try {
      setIsExporting(true);
      setExportMessage('Generating crisp PNG (optimized < 1 MB)...');

      const MAX_BYTES = 1000 * 1024; // Strict limit: below 1 MB
      const TARGET_BYTES = 900 * 1024; // Safe target ~900 KB

      // Start with high resolution (150 DPI = 1240x1754 px for A4, razor-sharp on all screens & prints)
      let currentDpi = 150;
      let canvas = await renderHighResCanvas(currentDpi);
      let blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), 'image/png'));

      // If file size exceeds 1MB, adaptively adjust DPI to guarantee < 1MB without noticeable loss
      if (blob.size > MAX_BYTES) {
        const scaleFactor = Math.min(0.92, Math.sqrt(TARGET_BYTES / blob.size));
        currentDpi = Math.max(96, Math.floor(currentDpi * scaleFactor));
        canvas = await renderHighResCanvas(currentDpi);
        blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), 'image/png'));

        // Failsafe pass for exceptionally dense photos
        if (blob.size > MAX_BYTES) {
          const secondScale = Math.min(0.88, Math.sqrt(TARGET_BYTES / blob.size));
          currentDpi = Math.max(72, Math.floor(currentDpi * secondScale));
          canvas = await renderHighResCanvas(currentDpi);
          blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), 'image/png'));
        }
      }

      const filename = `${pageConfig.name.toLowerCase().replace(/\s+/g, '-')}-layout.png`;
      downloadBlob(blob, filename);
    } catch (err) {
      console.error('Failed to export PNG', err);
      alert('Failed to export PNG. Please try again.');
    } finally {
      setIsExporting(false);
      setExportMessage('');
    }
  };

  const handleExportJpeg = async () => {
    setShowDownloadMenu(false);
    try {
      setIsExporting(true);
      setExportMessage('Generating high-resolution JPEG image...');
      const canvas = await renderHighResCanvas(300);
      const blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.95));
      const filename = `${pageConfig.name.toLowerCase().replace(/\s+/g, '-')}-layout.jpg`;
      downloadBlob(blob, filename);
    } catch (err) {
      console.error('Failed to export JPEG', err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleSaveProjectFile = () => {
    setShowDownloadMenu(false);
    const project: StoredProject = {
      version: 1,
      savedAt: new Date().toISOString(),
      pageConfig,
      objects,
    };
    const jsonStr = JSON.stringify(project, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    downloadBlob(blob, `${pageConfig.name.toLowerCase().replace(/\s+/g, '-')}-project.pagedesign`);
  };

  const handleOpenProjectFile = (file: File) => {
    setShowDownloadMenu(false);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const project: StoredProject = JSON.parse(content);
        if (project.pageConfig && project.objects) {
          setPageConfig(project.pageConfig);
          setObjects(project.objects);
          setSelectedId(null);
          pushHistory('Opened project file', project.objects, project.pageConfig);
        }
      } catch {
        alert('Invalid or corrupted project file.');
      }
    };
    reader.readAsText(file);
  };

  // Helper to initiate 4-side crop drag (Mouse & Touch)
  const startCropDrag = (e: MouseEvent | TouchEvent, handle: typeof cropHandle) => {
    e.stopPropagation();
    if (!selectedObject) return;
    setCropHandle(handle);

    const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;
    const clientPt = clientToPageMm(clientX, clientY);

    const initCrop = {
      left: selectedObject.crop?.left || 0,
      right: selectedObject.crop?.right || 0,
      top: selectedObject.crop?.top || 0,
      bottom: selectedObject.crop?.bottom || 0,
    };

    const virtualW = selectedObject.widthMm / (1 - initCrop.left - initCrop.right);
    const virtualH = selectedObject.heightMm / (1 - initCrop.top - initCrop.bottom);

    cropDragRef.current = {
      startX: clientPt.x,
      startY: clientPt.y,
      initXMm: selectedObject.xMm,
      initYMm: selectedObject.yMm,
      initWidthMm: selectedObject.widthMm,
      initHeightMm: selectedObject.heightMm,
      initCrop,
      virtualWidthMm: virtualW,
      virtualHeightMm: virtualH,
    };
  };

  // Helper to initiate Resize or Rotate (Mouse & Touch)
  const startTransformHandle = (e: MouseEvent | TouchEvent, handle: typeof transformMode) => {
    e.stopPropagation();
    if (!selectedObject) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;
    setTransformMode(handle);
    transformStartRef.current = {
      startX: clientToPageMm(clientX, clientY).x,
      startY: clientToPageMm(clientX, clientY).y,
      objX: selectedObject.xMm,
      objY: selectedObject.yMm,
      objW: selectedObject.widthMm,
      objH: selectedObject.heightMm,
      objRotation: selectedObject.rotation,
      aspectRatio: selectedObject.widthMm / selectedObject.heightMm,
    };
  };

  // Safe toolbar actions to prevent mobile ghost clicks between overlapping buttons
  const handleDoneCropping = (e: MouseEvent | TouchEvent) => {
    e.stopPropagation();
    if ('cancelable' in e && e.cancelable) {
      e.preventDefault();
    }
    lastDoneTimeRef.current = Date.now();
    setIsCropping(false);
  };

  const handleOpenMobileProperties = (e: MouseEvent | TouchEvent) => {
    e.stopPropagation();
    if ('cancelable' in e && e.cancelable) {
      e.preventDefault();
    }
    // Suppress ghost clicks immediately after tapping "Done" on crop
    if (Date.now() - lastDoneTimeRef.current < 500) {
      return;
    }
    setMobileDrawer('properties');
  };

  const handleEnterCrop = (e: MouseEvent | TouchEvent) => {
    e.stopPropagation();
    if ('cancelable' in e && e.cancelable) {
      e.preventDefault();
    }
    if (Date.now() - lastDoneTimeRef.current < 500) {
      return;
    }
    setIsCropping(true);
  };

  // ─────────────────────────────────────────────
  // Reusable Layers Component (Sidebar & Mobile Drawer)
  // ─────────────────────────────────────────────
  const renderLayersContent = () => (
    <div className="flex flex-col h-full text-xs">
      {/* Upload Button */}
      <div className="p-3 border-b border-neutral-200/80 dark:border-neutral-800/80">
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold shadow-xs transition active:scale-[0.98]"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span>Upload Images</span>
        </button>
        <p className="mt-1 text-[11px] text-center text-neutral-500 dark:text-neutral-400">
          Paste (Ctrl+V), drag & drop or select files
        </p>
      </div>

      {/* Layers Header & Clear All */}
      <div className="px-3 py-2 border-b border-neutral-200/80 dark:border-neutral-800/80 flex items-center justify-between text-xs text-neutral-600 dark:text-neutral-400 font-medium">
        <div className="flex items-center gap-1.5">
          <span>📑</span>
          <span className="font-semibold text-neutral-800 dark:text-neutral-200">Layers ({objects.length})</span>
        </div>
        {objects.length > 0 && (
          <button
            onClick={() => {
              if (confirm('Clear all images from the page?')) {
                setObjects([]);
                setSelectedId(null);
                setIsCropping(false);
                clearProjectStorage();
                pushHistory('Cleared all objects', []);
              }
            }}
            className="text-[11px] text-red-500 hover:text-red-600 font-medium"
          >
            Clear All
          </button>
        )}
      </div>
      <div className="px-3 py-1 bg-neutral-100/60 dark:bg-neutral-900/60 text-[10px] text-neutral-500 border-b border-neutral-200/40 dark:border-neutral-800/40">
        Drag or tap ▲ / ▼ to reorder layers
      </div>

      {/* Reorderable Layers List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5 custom-scrollbar">
        {sortedLayersDescending.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-44 text-center px-4 text-neutral-400 dark:text-neutral-500">
            <svg className="w-10 h-10 mb-2 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <rect width="18" height="18" x="3" y="3" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="m21 15-5-5L5 21" />
            </svg>
            <p className="text-xs font-medium text-neutral-600 dark:text-neutral-400">No layers yet</p>
            <p className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-0.5">
              Uploaded images will appear here as reorderable layers.
            </p>
          </div>
        ) : (
          sortedLayersDescending.map((obj, idx) => (
            <div
              key={obj.id}
              draggable={true}
              onDragStart={(e) => handleLayerDragStart(e, idx)}
              onDragOver={(e) => handleLayerDragOver(e, idx)}
              onDrop={(e) => handleLayerDrop(e, idx)}
              onDragEnd={handleLayerDragEnd}
              onClick={() => {
                setSelectedId(obj.id);
              }}
              className={`flex items-center gap-1.5 sm:gap-2 p-2 rounded-xl border text-xs cursor-pointer transition select-none group ${
                draggedLayerIdx === idx ? 'opacity-40 ring-2 ring-brand-500' : ''
              } ${
                dragOverLayerIdx === idx && draggedLayerIdx !== idx
                  ? 'border-t-2 border-brand-500 bg-brand-50/50 dark:bg-brand-950/50'
                  : ''
              } ${
                selectedId === obj.id
                  ? 'bg-brand-50/70 dark:bg-brand-950/40 border-brand-500 text-neutral-900 dark:text-white shadow-2xs'
                  : 'bg-white dark:bg-neutral-900/60 border-neutral-200/80 dark:border-neutral-800 hover:bg-neutral-100/60 dark:hover:bg-neutral-800/60 text-neutral-700 dark:text-neutral-300'
              }`}
            >
              {/* Drag Handle */}
              <div
                className="cursor-grab active:cursor-grabbing text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 px-0.5 font-mono text-sm leading-none"
                title="Drag to change layer order"
              >
                ⋮⋮
              </div>

              {/* Up/Down Arrow Buttons (super useful on mobile touch screens) */}
              <div className="flex flex-col gap-0.5">
                <button
                  type="button"
                  disabled={idx === 0}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleMoveLayerStep(idx, 'up');
                  }}
                  className={`w-4 h-4 flex items-center justify-center rounded text-[10px] ${
                    idx === 0
                      ? 'opacity-20 cursor-not-allowed text-neutral-400'
                      : 'hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-300'
                  }`}
                  title="Move Up"
                >
                  ▲
                </button>
                <button
                  type="button"
                  disabled={idx === sortedLayersDescending.length - 1}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleMoveLayerStep(idx, 'down');
                  }}
                  className={`w-4 h-4 flex items-center justify-center rounded text-[10px] ${
                    idx === sortedLayersDescending.length - 1
                      ? 'opacity-20 cursor-not-allowed text-neutral-400'
                      : 'hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-300'
                  }`}
                  title="Move Down"
                >
                  ▼
                </button>
              </div>

              {/* Thumbnail */}
              <div className="w-9 h-9 rounded-lg bg-neutral-100 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 overflow-hidden flex items-center justify-center flex-shrink-0">
                <img src={obj.src} alt={obj.name} className="w-full h-full object-contain" />
              </div>

              {/* Name & Layer Depth Info */}
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate text-neutral-900 dark:text-neutral-100">{obj.name}</div>
                <div className="text-[10px] text-neutral-500 flex items-center gap-1.5 font-mono">
                  <span>
                    {idx === 0
                      ? 'Top layer'
                      : idx === sortedLayersDescending.length - 1
                      ? 'Bottom layer'
                      : `Layer ${sortedLayersDescending.length - idx}`}
                  </span>
                </div>
              </div>

              {/* Visibility & Delete */}
              <div className="flex items-center gap-1 opacity-70 hover:opacity-100">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setObjects((prev) =>
                      prev.map((o) => (o.id === obj.id ? { ...o, visible: !o.visible } : o))
                    );
                  }}
                  className="p-1 hover:text-neutral-900 dark:hover:text-white"
                  title={obj.visible ? 'Hide' : 'Show'}
                >
                  {obj.visible ? '👁️' : '🕶️'}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteObject(obj.id);
                  }}
                  className="p-1 text-neutral-400 hover:text-red-500"
                  title="Delete layer"
                >
                  ✕
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Privacy Note */}
      <div className="p-3 border-t border-neutral-200/80 dark:border-neutral-800/80 bg-neutral-50 dark:bg-neutral-950/80 text-[10px] text-neutral-500 flex items-center gap-1.5">
        <span className="text-emerald-500">🔒</span>
        <span>100% Client-Side. Images stay on your device.</span>
      </div>
    </div>
  );

  // ─────────────────────────────────────────────
  // Reusable Properties Component (Sidebar & Mobile Drawer)
  // ─────────────────────────────────────────────
  const renderPropertiesContent = () => {
    if (selectedObject) {
      return (
        <div className="p-4 space-y-4 text-xs">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-neutral-200 dark:border-neutral-800">
            <div className="min-w-0">
              <span className="text-[10px] text-brand-600 dark:text-brand-400 font-bold uppercase tracking-wider">Image Settings</span>
              <h4 className="font-semibold text-neutral-900 dark:text-neutral-100 truncate">{selectedObject.name}</h4>
            </div>
            <button
              onClick={() => {
                setIsCropping(false);
                setSelectedId(null);
              }}
              className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 p-1"
              title="Deselect"
            >
              ✕
            </button>
          </div>

          {/* Quick Crop Button */}
          <button
            onClick={() => {
              setIsCropping(true);
              setMobileDrawer('none');
            }}
            className="w-full py-2 px-3 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold flex items-center justify-center gap-2 shadow-xs transition"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M6 2v14a2 2 0 0 0 2 2h14" />
              <path d="M18 22V8a2 2 0 0 0-2-2H2" />
            </svg>
            <span>Crop on Canvas (4-Side)</span>
          </button>

          {/* Dimensions */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-medium text-neutral-700 dark:text-neutral-300">Dimensions (mm)</span>
              <button
                onClick={() => {
                  const newLock = !selectedObject.aspectLocked;
                  setObjects((prev) =>
                    prev.map((o) => (o.id === selectedObject.id ? { ...o, aspectLocked: newLock } : o))
                  );
                }}
                className={`flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded ${
                  selectedObject.aspectLocked
                    ? 'bg-brand-50 dark:bg-brand-950/40 text-brand-700 dark:text-brand-300 border border-brand-200 dark:border-brand-800'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500'
                }`}
                title="Lock Aspect Ratio"
              >
                {selectedObject.aspectLocked ? '🔒 Locked' : '🔓 Unlocked'}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-2 py-1.5 flex items-center justify-between">
                <span className="text-neutral-400 font-mono">W:</span>
                <input
                  type="number"
                  value={Math.round(selectedObject.widthMm)}
                  onChange={(e) => {
                    const val = Math.max(5, parseFloat(e.currentTarget.value) || 10);
                    const newH = selectedObject.aspectLocked
                      ? val / (selectedObject.widthMm / selectedObject.heightMm)
                      : selectedObject.heightMm;
                    setObjects((prev) =>
                      prev.map((o) => (o.id === selectedObject.id ? { ...o, widthMm: val, heightMm: newH } : o))
                    );
                  }}
                  className="w-16 bg-transparent text-right font-mono font-medium focus:outline-none text-neutral-900 dark:text-white"
                />
              </div>
              <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-2 py-1.5 flex items-center justify-between">
                <span className="text-neutral-400 font-mono">H:</span>
                <input
                  type="number"
                  value={Math.round(selectedObject.heightMm)}
                  onChange={(e) => {
                    const val = Math.max(5, parseFloat(e.currentTarget.value) || 10);
                    const newW = selectedObject.aspectLocked
                      ? val * (selectedObject.widthMm / selectedObject.heightMm)
                      : selectedObject.widthMm;
                    setObjects((prev) =>
                      prev.map((o) => (o.id === selectedObject.id ? { ...o, widthMm: newW, heightMm: val } : o))
                    );
                  }}
                  className="w-16 bg-transparent text-right font-mono font-medium focus:outline-none text-neutral-900 dark:text-white"
                />
              </div>
            </div>
          </div>

          {/* Position */}
          <div>
            <span className="font-medium text-neutral-700 dark:text-neutral-300 mb-1.5 block">Position (mm)</span>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-2 py-1.5 flex items-center justify-between">
                <span className="text-neutral-400 font-mono">X:</span>
                <input
                  type="number"
                  value={Math.round(selectedObject.xMm)}
                  onChange={(e) => {
                    const val = parseFloat(e.currentTarget.value) || 0;
                    setObjects((prev) =>
                      prev.map((o) => (o.id === selectedObject.id ? { ...o, xMm: val } : o))
                    );
                  }}
                  className="w-16 bg-transparent text-right font-mono font-medium focus:outline-none text-neutral-900 dark:text-white"
                />
              </div>
              <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-2 py-1.5 flex items-center justify-between">
                <span className="text-neutral-400 font-mono">Y:</span>
                <input
                  type="number"
                  value={Math.round(selectedObject.yMm)}
                  onChange={(e) => {
                    const val = parseFloat(e.currentTarget.value) || 0;
                    setObjects((prev) =>
                      prev.map((o) => (o.id === selectedObject.id ? { ...o, yMm: val } : o))
                    );
                  }}
                  className="w-16 bg-transparent text-right font-mono font-medium focus:outline-none text-neutral-900 dark:text-white"
                />
              </div>
            </div>
          </div>

          {/* Alignment */}
          <div>
            <span className="font-medium text-neutral-700 dark:text-neutral-300 mb-1.5 block">Align to Page</span>
            <div className="grid grid-cols-3 gap-1 bg-white dark:bg-neutral-900 p-1 border border-neutral-200 dark:border-neutral-800 rounded-lg text-center">
              <button onClick={() => handleAlign('left')} className="py-1 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded text-neutral-600 dark:text-neutral-300">Left</button>
              <button onClick={() => handleAlign('center-h')} className="py-1 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded text-brand-600 dark:text-brand-400 font-semibold">Center H</button>
              <button onClick={() => handleAlign('right')} className="py-1 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded text-neutral-600 dark:text-neutral-300">Right</button>
              <button onClick={() => handleAlign('top')} className="py-1 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded text-neutral-600 dark:text-neutral-300">Top</button>
              <button onClick={() => handleAlign('center-v')} className="py-1 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded text-brand-600 dark:text-brand-400 font-semibold">Center V</button>
              <button onClick={() => handleAlign('bottom')} className="py-1 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded text-neutral-600 dark:text-neutral-300">Bottom</button>
            </div>
          </div>

          {/* Rotation */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-medium text-neutral-700 dark:text-neutral-300">Rotation</span>
              <span className="font-mono text-neutral-500">{selectedObject.rotation}°</span>
            </div>
            <input
              type="range"
              min="0"
              max="360"
              value={selectedObject.rotation}
              onChange={(e) => {
                const val = parseInt(e.currentTarget.value, 10);
                setObjects((prev) =>
                  prev.map((o) => (o.id === selectedObject.id ? { ...o, rotation: val } : o))
                );
              }}
              className="w-full accent-brand-600 cursor-pointer"
            />
            <div className="flex items-center justify-between mt-1 text-[11px] text-neutral-500">
              <button onClick={() => setObjects((prev) => prev.map((o) => (o.id === selectedObject.id ? { ...o, rotation: (o.rotation - 90 + 360) % 360 } : o)))} className="hover:text-neutral-800 dark:hover:text-neutral-200">↺ -90°</button>
              <button onClick={() => setObjects((prev) => prev.map((o) => (o.id === selectedObject.id ? { ...o, rotation: 0 } : o)))} className="hover:text-neutral-800 dark:hover:text-neutral-200">0°</button>
              <button onClick={() => setObjects((prev) => prev.map((o) => (o.id === selectedObject.id ? { ...o, rotation: (o.rotation + 90) % 360 } : o)))} className="hover:text-neutral-800 dark:hover:text-neutral-200">↻ +90°</button>
            </div>
          </div>

          {/* Opacity */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-medium text-neutral-700 dark:text-neutral-300">Opacity</span>
              <span className="font-mono text-neutral-500">{Math.round(selectedObject.opacity * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={selectedObject.opacity}
              onChange={(e) => {
                const val = parseFloat(e.currentTarget.value);
                setObjects((prev) =>
                  prev.map((o) => (o.id === selectedObject.id ? { ...o, opacity: val } : o))
                );
              }}
              className="w-full accent-brand-600 cursor-pointer"
            />
          </div>

          {/* Fit Modes */}
          <div>
            <span className="font-medium text-neutral-700 dark:text-neutral-300 mb-1.5 block">Fit Mode</span>
            <div className="grid grid-cols-2 gap-1.5">
              {(['contain', 'cover', 'stretch', 'original'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => {
                    setObjects((prev) =>
                      prev.map((o) => {
                        if (o.id !== selectedObject.id) return o;
                        if (mode === 'original') {
                          const aspect = o.naturalWidth / o.naturalHeight;
                          return { ...o, fitMode: 'contain', heightMm: o.widthMm / aspect, aspectLocked: true };
                        }
                        return { ...o, fitMode: mode };
                      })
                    );
                  }}
                  className={`py-1.5 px-2 rounded-lg border text-center capitalize transition ${
                    selectedObject.fitMode === mode
                      ? 'bg-brand-50 dark:bg-brand-950/40 border-brand-500 text-brand-700 dark:text-brand-300 font-medium'
                      : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          {/* Replace, Duplicate & Delete */}
          <div className="pt-2 border-t border-neutral-200 dark:border-neutral-800 space-y-2">
            <button
              onClick={() => replaceFileInputRef.current?.click()}
              className="w-full py-2 rounded-lg bg-white dark:bg-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 font-medium flex items-center justify-center gap-1.5"
            >
              🔄 Replace Image (Keep Size)
            </button>
            
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleDuplicateObject(selectedObject.id)}
                className="py-2 rounded-lg bg-white dark:bg-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-800 border border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 font-medium"
              >
                Duplicate
              </button>
              <button
                onClick={() => handleDeleteObject(selectedObject.id)}
                className="py-2 rounded-lg bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/60 border border-red-200 dark:border-red-800/60 text-red-600 dark:text-red-400 font-medium"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      );
    }

    /* Page Settings */
    return (
      <div className="p-4 space-y-4 text-xs">
        <div className="pb-3 border-b border-neutral-200 dark:border-neutral-800">
          <span className="text-[10px] text-brand-600 dark:text-brand-400 font-bold uppercase tracking-wider">Page Setup</span>
          <h4 className="font-semibold text-neutral-900 dark:text-neutral-100">{pageConfig.name} Document</h4>
          <p className="text-[11px] text-neutral-500 mt-0.5">
            {pageWidthMm} × {pageHeightMm} mm ({pageConfig.orientation})
          </p>
        </div>

        {/* Printable Margins */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="font-medium text-neutral-700 dark:text-neutral-300">Margin Guide</span>
            <input
              type="checkbox"
              checked={pageConfig.showMargins}
              onChange={(e) =>
                setPageConfig((c) => ({ ...c, showMargins: e.currentTarget.checked }))
              }
              className="accent-brand-600 rounded cursor-pointer"
            />
          </div>
          {pageConfig.showMargins && (
            <div className="flex items-center gap-2 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-2 py-1.5">
              <span className="text-neutral-400 font-mono">Margin:</span>
              <input
                type="number"
                min="0"
                max="50"
                value={pageConfig.marginMm}
                onChange={(e) => {
                  const val = Math.max(0, parseFloat(e.currentTarget.value) || 0);
                  setPageConfig((c) => ({ ...c, marginMm: val }));
                }}
                className="w-16 bg-transparent text-right font-mono font-medium focus:outline-none text-neutral-900 dark:text-white"
              />
              <span className="text-neutral-500">mm</span>
            </div>
          )}
        </div>

        {/* Smart Snapping */}
        <div className="flex items-center justify-between py-2 border-t border-neutral-200 dark:border-neutral-800">
          <div>
            <span className="font-medium text-neutral-700 dark:text-neutral-300 block">Smart Snapping</span>
            <span className="text-[11px] text-neutral-500">Snap to page center & margins</span>
          </div>
          <input
            type="checkbox"
            checked={pageConfig.showSnapGuides}
            onChange={(e) =>
              setPageConfig((c) => ({ ...c, showSnapGuides: e.currentTarget.checked }))
            }
            className="accent-brand-600 rounded cursor-pointer"
          />
        </div>

        <button
          onClick={() => setShowPageSetupModal(true)}
          className="w-full py-2.5 rounded-xl bg-brand-50 hover:bg-brand-100 dark:bg-brand-950/40 dark:hover:bg-brand-900/60 border border-brand-200 dark:border-brand-800 text-brand-700 dark:text-brand-300 font-medium transition"
        >
          Change Document Size...
        </button>
      </div>
    );
  };

  // ─────────────────────────────────────────────
  // UI Render with Magic Tools Aesthetic
  // ─────────────────────────────────────────────
  return (
    <div className="flex flex-col h-[calc(100dvh-90px)] sm:h-[calc(100vh-140px)] min-h-[520px] sm:min-h-[640px] max-h-[1050px] bg-white dark:bg-neutral-900 border border-neutral-200/90 dark:border-neutral-800/90 rounded-xl sm:rounded-2xl overflow-hidden shadow-2xs relative select-none font-sans text-neutral-800 dark:text-neutral-200">
      
      {/* ── HIDDEN GLOBAL FILE INPUTS ── */}
      <input
        type="file"
        ref={fileInputRef}
        multiple
        accept="image/jpeg,image/png,image/webp,image/avif,image/bmp"
        onChange={(e) => {
          const files = Array.from(e.currentTarget.files || []);
          handleAddFiles(files);
          e.currentTarget.value = '';
        }}
        className="hidden"
      />
      <input
        type="file"
        ref={replaceFileInputRef}
        accept="image/jpeg,image/png,image/webp,image/avif"
        onChange={(e) => {
          const file = e.currentTarget.files?.[0];
          if (file) handleReplaceImage(file);
          e.currentTarget.value = '';
        }}
        className="hidden"
      />
      <input
        type="file"
        ref={projectFileInputRef}
        accept=".pagedesign,.json"
        onChange={(e) => {
          const file = e.currentTarget.files?.[0];
          if (file) handleOpenProjectFile(file);
          e.currentTarget.value = '';
        }}
        className="hidden"
      />

      {/* ── TOP ACTION TOOLBAR ── */}
      <header className="flex items-center justify-between gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 sm:py-2.5 bg-neutral-50/90 dark:bg-neutral-950/90 border-b border-neutral-200/80 dark:border-neutral-800/80 text-xs sm:text-sm z-30 flex-shrink-0">
        
        {/* Left Toolbar: Size, Orientation, Undo/Redo */}
        <div className="flex items-center gap-1 sm:gap-1.5 min-w-0">
          {/* Page Size Preset Selector */}
          <button
            onClick={() => setShowPageSetupModal(true)}
            className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-lg bg-white dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700/80 border border-neutral-200/80 dark:border-neutral-700/80 text-neutral-800 dark:text-neutral-200 transition font-medium shadow-2xs text-xs sm:text-sm truncate"
            title="Change Document Size & Presets"
          >
            <span>📄</span>
            <span className="font-semibold">{pageConfig.name}</span>
            <span className="hidden sm:inline text-[11px] text-neutral-500 dark:text-neutral-400">
              ({pageWidthMm}×{pageHeightMm} mm)
            </span>
            <svg className="w-3.5 h-3.5 text-neutral-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>

          {/* Orientation Toggle */}
          <button
            onClick={() => {
              const newOrientation = pageConfig.orientation === 'portrait' ? 'landscape' : 'portrait';
              const newConfig = { ...pageConfig, orientation: newOrientation as 'portrait' | 'landscape' };
              setPageConfig(newConfig);
              pushHistory(`Changed to ${newOrientation}`, objects, newConfig);
            }}
            className="flex items-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-lg bg-white dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700/80 border border-neutral-200/80 dark:border-neutral-700/80 text-neutral-700 dark:text-neutral-300 transition shadow-2xs"
            title={`Switch to ${pageConfig.orientation === 'portrait' ? 'Landscape' : 'Portrait'}`}
          >
            {pageConfig.orientation === 'portrait' ? (
              <>
                <svg className="w-4 h-4 text-brand-600 dark:text-brand-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="5" y="3" width="14" height="18" rx="2" />
                </svg>
                <span className="hidden md:inline text-xs">Portrait</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4 text-brand-600 dark:text-brand-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="5" width="18" height="14" rx="2" />
                </svg>
                <span className="hidden md:inline text-xs">Landscape</span>
              </>
            )}
          </button>

          <div className="w-px h-5 bg-neutral-200 dark:bg-neutral-800 mx-0.5 hidden xs:block" />

          {/* Undo / Redo */}
          <div className="flex items-center gap-0.5 bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 rounded-lg p-0.5 shadow-2xs">
            <button
              onClick={handleUndo}
              disabled={historyIndex <= 0}
              className={`p-1 sm:p-1.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 transition ${
                historyIndex <= 0 ? 'opacity-30 cursor-not-allowed text-neutral-400' : 'text-neutral-700 dark:text-neutral-200'
              }`}
              title="Undo (Ctrl+Z)"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 7v6h6" />
                <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
              </svg>
            </button>
            <button
              onClick={handleRedo}
              disabled={historyIndex >= history.length - 1}
              className={`p-1 sm:p-1.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 transition ${
                historyIndex >= history.length - 1 ? 'opacity-30 cursor-not-allowed text-neutral-400' : 'text-neutral-700 dark:text-neutral-200'
              }`}
              title="Redo (Ctrl+Shift+Z / Ctrl+Y)"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 7v6h-6" />
                <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13" />
              </svg>
            </button>
          </div>
        </div>

        {/* Right Toolbar: Zoom, Background Color & Download Options */}
        <div className="flex items-center gap-1 sm:gap-1.5">
          
          {/* Zoom Controls */}
          <div className="hidden sm:flex items-center gap-1 bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 rounded-lg p-0.5 text-xs shadow-2xs">
            <button
              onClick={() => setZoom((z) => Math.max(0.2, parseFloat((z - 0.1).toFixed(2))))}
              className="p-1 sm:p-1.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-300"
              title="Zoom Out"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
            <span className="w-9 sm:w-11 text-center font-mono font-medium text-neutral-700 dark:text-neutral-300 text-[11px] sm:text-xs">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom((z) => Math.min(3.0, parseFloat((z + 0.1).toFixed(2))))}
              className="p-1 sm:p-1.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-300"
              title="Zoom In"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
            <button
              onClick={fitToScreen}
              className="px-1.5 py-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 text-[11px] text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200 transition font-medium"
              title="Fit Page to Screen"
            >
              Fit
            </button>
          </div>

          {/* Background Color Picker */}
          <div className="flex items-center gap-1 px-1.5 sm:px-2 py-1 bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 rounded-lg text-xs shadow-2xs" title="Page Background Color">
            <span className="text-[11px] text-neutral-500 hidden sm:inline">Bg:</span>
            <input
              type="color"
              value={pageConfig.bgColor === 'transparent' ? '#ffffff' : pageConfig.bgColor}
              onChange={(e) => {
                const newBg = (e.target as HTMLInputElement).value;
                setPageConfig((c) => ({ ...c, bgColor: newBg }));
              }}
              className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent"
            />
            <button
              onClick={() =>
                setPageConfig((c) => ({
                  ...c,
                  bgColor: c.bgColor === 'transparent' ? '#ffffff' : 'transparent',
                }))
              }
              className={`text-[10px] px-1.5 py-0.5 rounded font-mono hidden sm:inline-block ${
                pageConfig.bgColor === 'transparent'
                  ? 'bg-brand-500/10 text-brand-700 dark:text-brand-300 border border-brand-500/30'
                  : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500'
              }`}
              title="Transparent background for PNG"
            >
              Alpha
            </button>
          </div>

          {/* Unified Download Button with Dropdown Menu */}
          <div className="relative" ref={downloadMenuRef}>
            <button
              onClick={() => setShowDownloadMenu((prev) => !prev)}
              disabled={isExporting}
              className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white font-medium shadow-xs transition active:scale-95 disabled:opacity-50 text-xs sm:text-sm"
              title="Download Options"
            >
              <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span className="font-semibold">Download</span>
              <svg className="w-3.5 h-3.5 text-white/80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>

            {/* Dropdown Options */}
            {showDownloadMenu && (
              <div className="absolute right-0 mt-1.5 w-52 max-w-[calc(100vw-24px)] bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl shadow-xl py-1.5 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                <button
                  onClick={handleExportPdf}
                  className="w-full text-left px-3.5 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-xs text-neutral-800 dark:text-neutral-200 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-red-500 font-semibold">PDF</span>
                    <span>Download as PDF</span>
                  </div>
                  <span className="text-[10px] text-neutral-400 font-mono">300 DPI</span>
                </button>

                <button
                  onClick={handleExportPng}
                  className="w-full text-left px-3.5 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-xs text-neutral-800 dark:text-neutral-200 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sky-500 font-semibold">PNG</span>
                    <span>Download as Image (PNG)</span>
                  </div>
                  <span className="text-[10px] text-neutral-400 font-mono">&lt; 1 MB</span>
                </button>

                <button
                  onClick={handleExportJpeg}
                  className="w-full text-left px-3.5 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-xs text-neutral-800 dark:text-neutral-200 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-amber-500 font-semibold">JPG</span>
                    <span>Download as Image (JPG)</span>
                  </div>
                  <span className="text-[10px] text-neutral-400 font-mono">95%</span>
                </button>

                <div className="h-px bg-neutral-200 dark:bg-neutral-800 my-1" />

                <button
                  onClick={handleSaveProjectFile}
                  className="w-full text-left px-3.5 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-xs text-brand-600 dark:text-brand-400 flex items-center gap-2"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                  </svg>
                  <span>Save Project File</span>
                </button>

                <button
                  onClick={() => projectFileInputRef.current?.click()}
                  className="w-full text-left px-3.5 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-xs text-neutral-700 dark:text-neutral-300 flex items-center gap-2"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  </svg>
                  <span>Open Project File</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── MAIN WORKSPACE BODY ── */}
      <div className="flex-1 flex overflow-hidden relative">

        {/* ── DESKTOP LEFT SIDEBAR (HIDDEN ON MOBILE/TABLET) ── */}
        <aside className="hidden lg:flex w-64 border-r border-neutral-200/80 dark:border-neutral-800/80 bg-neutral-50/70 dark:bg-neutral-950/70 flex-col z-10 flex-shrink-0">
          {renderLayersContent()}
        </aside>

        {/* ── CENTRAL WORKSPACE (FULL WIDTH ON MOBILE) ── */}
        <main
          ref={workspaceRef}
          onMouseDown={handlePointerDown}
          onTouchStart={handlePointerDown}
          onDoubleClick={handleDoubleClick}
          onWheel={(e) => {
            if (e.ctrlKey || e.metaKey || e.altKey) {
              e.preventDefault();
              const delta = e.deltaY < 0 ? 0.08 : -0.08;
              setZoom((z) => clamp(parseFloat((z + delta).toFixed(2)), 0.2, 3.0));
            }
          }}
          className="flex-1 bg-neutral-100/90 dark:bg-neutral-900/90 relative overflow-hidden flex items-center justify-center cursor-default touch-pan-y lg:touch-none"
          style={{
            backgroundImage: `radial-gradient(currentColor 1px, transparent 1px)`,
            backgroundSize: '24px 24px',
            color: 'rgba(148, 163, 184, 0.25)',
          }}
        >
          {/* Zoomable / Pannable Document Wrapper */}
          <div
            className="transition-transform duration-75 relative"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: 'center center',
            }}
          >
            {/* Sheet Page */}
            <div
              className="relative shadow-[0_20px_50px_-10px_rgba(0,0,0,0.15)] dark:shadow-[0_25px_60px_-15px_rgba(0,0,0,0.7)] border border-neutral-300/80 dark:border-neutral-700/60"
              style={{
                width: `${pageWidthMm * basePpm}px`,
                height: `${pageHeightMm * basePpm}px`,
              }}
            >
              {/* HTML5 Canvas */}
              <canvas
                ref={canvasRef}
                className="w-full h-full block rounded-sm pointer-events-none"
              />

              {/* ── SELECTION BORDER & ON-IMAGE CONTROLS ── */}
              {selectedObject && selectedObject.visible && (
                <div
                  className="absolute pointer-events-none"
                  style={{
                    left: `${selectedObject.xMm * basePpm}px`,
                    top: `${selectedObject.yMm * basePpm}px`,
                    width: `${selectedObject.widthMm * basePpm}px`,
                    height: `${selectedObject.heightMm * basePpm}px`,
                    transform: `rotate(${selectedObject.rotation}deg)`,
                    transformOrigin: 'center center',
                  }}
                >
                  {/* Bounding box outline */}
                  <div
                    className={`absolute inset-0 border-2 shadow-2xs pointer-events-none ${
                      isCropping ? 'border-neutral-900 dark:border-white border-dashed' : 'border-brand-500'
                    }`}
                  />

                  {/* ── FLOATING QUICK ACTION BAR (ON THE IMAGE) ── */}
                  <div
                    className="absolute -top-11 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-full px-2.5 py-1 shadow-lg pointer-events-auto z-40 text-xs whitespace-nowrap animate-in fade-in zoom-in-95 duration-100"
                    onMouseDown={(e) => e.stopPropagation()}
                    onTouchStart={(e) => e.stopPropagation()}
                    onDoubleClick={(e) => e.stopPropagation()}
                  >
                    {!isCropping ? (
                      <>
                        <button
                          onClick={handleEnterCrop}
                          onTouchEnd={handleEnterCrop}
                          className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-600 hover:bg-brand-500 text-white font-semibold shadow-xs transition active:scale-95 touch-none"
                          title="Click or double-click image to crop from 4 sides"
                        >
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                            <path d="M6 2v14a2 2 0 0 0 2 2h14" />
                            <path d="M18 22V8a2 2 0 0 0-2-2H2" />
                          </svg>
                          <span>Crop</span>
                        </button>

                        <button
                          onClick={handleOpenMobileProperties}
                          onTouchEnd={handleOpenMobileProperties}
                          className="lg:hidden flex items-center gap-1 px-2.5 py-1 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 font-medium hover:bg-neutral-200 transition touch-none"
                          title="Open Settings"
                        >
                          <span>⚙️</span>
                          <span>Edit</span>
                        </button>

                        <div className="w-px h-4 bg-neutral-200 dark:bg-neutral-700 mx-0.5" />

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteObject(selectedObject.id);
                          }}
                          onTouchStart={(e) => {
                            e.stopPropagation();
                            handleDeleteObject(selectedObject.id);
                          }}
                          className="p-1 px-1.5 rounded-full hover:bg-red-50 dark:hover:bg-red-950/50 text-neutral-400 hover:text-red-500 text-xs touch-none"
                          title="Delete (Del)"
                        >
                          ✕
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="text-amber-500 dark:text-amber-400 font-semibold flex items-center gap-1 text-[11px]">
                          <span>✂️</span> Drag any side to crop
                        </span>
                        <div className="w-px h-4 bg-neutral-200 dark:bg-neutral-700 mx-0.5" />
                        <button
                          onClick={handleDoneCropping}
                          onTouchEnd={handleDoneCropping}
                          className="px-2.5 py-0.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition active:scale-95 touch-none"
                        >
                          ✓ Done
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setObjects((prev) =>
                              prev.map((o) =>
                                o.id === selectedObject.id
                                  ? { ...o, crop: { top: 0, right: 0, bottom: 0, left: 0 } }
                                  : o
                              )
                            );
                            pushHistory('Reset crop', objects);
                          }}
                          onTouchStart={(e) => {
                            e.stopPropagation();
                            setObjects((prev) =>
                              prev.map((o) =>
                                o.id === selectedObject.id
                                  ? { ...o, crop: { top: 0, right: 0, bottom: 0, left: 0 } }
                                  : o
                              )
                            );
                            pushHistory('Reset crop', objects);
                          }}
                          className="px-2 py-0.5 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500 dark:text-neutral-300 touch-none"
                        >
                          Reset
                        </button>
                      </>
                    )}
                  </div>

                  {/* ── NORMAL RESIZE & ROTATE HANDLES (When not in crop mode) ── */}
                  {!isCropping && (
                    <>
                      {/* Rotation Stalk & Handle */}
                      <div
                        className="absolute left-1/2 -top-7 -translate-x-1/2 flex flex-col items-center pointer-events-auto cursor-grab active:cursor-grabbing group touch-none"
                        onMouseDown={(e) => startTransformHandle(e, 'rotate')}
                        onTouchStart={(e) => startTransformHandle(e, 'rotate')}
                      >
                        <div className="w-5 h-5 sm:w-4 sm:h-4 rounded-full bg-brand-600 border-2 border-white shadow-md flex items-center justify-center">
                          <div className="w-1.5 h-1.5 rounded-full bg-white" />
                        </div>
                        <div className="w-0.5 h-3 bg-brand-500" />
                      </div>

                      {/* 4 Corner Resize Handles with touch padding */}
                      {(['nw-resize', 'ne-resize', 'se-resize', 'sw-resize'] as const).map((handle) => {
                        const posClasses =
                          handle === 'nw-resize'
                            ? '-left-2.5 -top-2.5'
                            : handle === 'ne-resize'
                            ? '-right-2.5 -top-2.5'
                            : handle === 'se-resize'
                            ? '-right-2.5 -bottom-2.5'
                            : '-left-2.5 -bottom-2.5';

                        return (
                          <div
                            key={handle}
                            className={`absolute ${posClasses} w-5 h-5 sm:w-4 sm:h-4 rounded-full bg-white border-2 border-brand-600 shadow-md pointer-events-auto cursor-${handle} active:scale-125 transition-transform touch-none`}
                            onMouseDown={(e) => startTransformHandle(e, handle)}
                            onTouchStart={(e) => startTransformHandle(e, handle)}
                          />
                        );
                      })}
                    </>
                  )}

                  {/* ── 4-SIDE CLEAN DIRECT CROP HANDLES (When in crop mode) ── */}
                  {isCropping && (
                    <div className="absolute inset-0 pointer-events-auto">
                      {/* Top Crop Bar */}
                      <div
                        className="absolute left-1/2 -top-3 -translate-x-1/2 w-12 h-4 sm:w-10 sm:h-3 bg-neutral-900 dark:bg-white border-2 border-white dark:border-neutral-900 rounded-sm cursor-ns-resize shadow-md hover:scale-110 active:scale-125 transition-transform touch-none"
                        onMouseDown={(e) => startCropDrag(e, 'crop-top')}
                        onTouchStart={(e) => startCropDrag(e, 'crop-top')}
                        title="Drag to crop top edge"
                      />

                      {/* Bottom Crop Bar */}
                      <div
                        className="absolute left-1/2 -bottom-3 -translate-x-1/2 w-12 h-4 sm:w-10 sm:h-3 bg-neutral-900 dark:bg-white border-2 border-white dark:border-neutral-900 rounded-sm cursor-ns-resize shadow-md hover:scale-110 active:scale-125 transition-transform touch-none"
                        onMouseDown={(e) => startCropDrag(e, 'crop-bottom')}
                        onTouchStart={(e) => startCropDrag(e, 'crop-bottom')}
                        title="Drag to crop bottom edge"
                      />

                      {/* Left Crop Bar */}
                      <div
                        className="absolute -left-3 top-1/2 -translate-y-1/2 w-4 h-12 sm:w-3 sm:h-10 bg-neutral-900 dark:bg-white border-2 border-white dark:border-neutral-900 rounded-sm cursor-ew-resize shadow-md hover:scale-110 active:scale-125 transition-transform touch-none"
                        onMouseDown={(e) => startCropDrag(e, 'crop-left')}
                        onTouchStart={(e) => startCropDrag(e, 'crop-left')}
                        title="Drag to crop left edge"
                      />

                      {/* Right Crop Bar */}
                      <div
                        className="absolute -right-3 top-1/2 -translate-y-1/2 w-4 h-12 sm:w-3 sm:h-10 bg-neutral-900 dark:bg-white border-2 border-white dark:border-neutral-900 rounded-sm cursor-ew-resize shadow-md hover:scale-110 active:scale-125 transition-transform touch-none"
                        onMouseDown={(e) => startCropDrag(e, 'crop-right')}
                        onTouchStart={(e) => startCropDrag(e, 'crop-right')}
                        title="Drag to crop right edge"
                      />

                      {/* 4 Corner Crop Brackets */}
                      <div
                        className="absolute -left-2.5 -top-2.5 w-5 h-5 border-t-4 border-l-4 border-neutral-900 dark:border-white cursor-nwse-resize bg-white dark:bg-neutral-900 shadow-md touch-none"
                        onMouseDown={(e) => startCropDrag(e, 'crop-nw')}
                        onTouchStart={(e) => startCropDrag(e, 'crop-nw')}
                      />
                      <div
                        className="absolute -right-2.5 -top-2.5 w-5 h-5 border-t-4 border-r-4 border-neutral-900 dark:border-white cursor-nesw-resize bg-white dark:bg-neutral-900 shadow-md touch-none"
                        onMouseDown={(e) => startCropDrag(e, 'crop-ne')}
                        onTouchStart={(e) => startCropDrag(e, 'crop-ne')}
                      />
                      <div
                        className="absolute -left-2.5 -bottom-2.5 w-5 h-5 border-b-4 border-l-4 border-neutral-900 dark:border-white cursor-nesw-resize bg-white dark:bg-neutral-900 shadow-md touch-none"
                        onMouseDown={(e) => startCropDrag(e, 'crop-sw')}
                        onTouchStart={(e) => startCropDrag(e, 'crop-sw')}
                      />
                      <div
                        className="absolute -right-2.5 -bottom-2.5 w-5 h-5 border-b-4 border-r-4 border-neutral-900 dark:border-white cursor-nwse-resize bg-white dark:bg-neutral-900 shadow-md touch-none"
                        onMouseDown={(e) => startCropDrag(e, 'crop-se')}
                        onTouchStart={(e) => startCropDrag(e, 'crop-se')}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </main>

        {/* ── DESKTOP RIGHT PROPERTIES PANEL (HIDDEN ON MOBILE/TABLET) ── */}
        <aside className="hidden lg:flex w-72 border-l border-neutral-200/80 dark:border-neutral-800/80 bg-neutral-50/70 dark:bg-neutral-950/70 flex-col z-10 flex-shrink-0 text-xs overflow-y-auto custom-scrollbar">
          {renderPropertiesContent()}
        </aside>
      </div>

      {/* ── MOBILE SLIDE-UP DRAWER SHEET ── */}
      {mobileDrawer !== 'none' && (
        <div className="lg:hidden fixed inset-0 z-40 flex flex-col justify-end">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-neutral-950/60 backdrop-blur-2xs transition-opacity"
            onClick={() => setMobileDrawer('none')}
          />

          {/* Sheet Container */}
          <div className="relative bg-white dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-800 rounded-t-2xl shadow-2xl max-h-[75vh] flex flex-col z-10 animate-in slide-in-from-bottom duration-200 pb-2">
            <div className="w-12 h-1.5 bg-neutral-300 dark:bg-neutral-700 rounded-full mx-auto my-2.5" />

            {/* Drawer Header */}
            <div className="px-4 py-2 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
              <div className="font-semibold text-sm text-neutral-900 dark:text-white flex items-center gap-2">
                {mobileDrawer === 'layers' ? (
                  <>
                    <span>📑</span>
                    <span>Layers ({objects.length})</span>
                  </>
                ) : selectedObject ? (
                  <>
                    <span>🖼️</span>
                    <span className="truncate max-w-[200px]">{selectedObject.name}</span>
                  </>
                ) : (
                  <>
                    <span>📄</span>
                    <span>Page Setup</span>
                  </>
                )}
              </div>
              <button
                onClick={() => setMobileDrawer('none')}
                className="px-3 py-1 text-xs rounded-lg bg-brand-50 hover:bg-brand-100 dark:bg-brand-950/50 text-brand-700 dark:text-brand-300 font-semibold"
              >
                Done ✓
              </button>
            </div>

            {/* Drawer Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {mobileDrawer === 'layers' ? renderLayersContent() : renderPropertiesContent()}
            </div>
          </div>
        </div>
      )}

      {/* ── MOBILE BOTTOM NAVIGATION BAR ── */}
      <nav className="lg:hidden flex items-center justify-around bg-white/95 dark:bg-neutral-950/95 backdrop-blur-md border-t border-neutral-200/90 dark:border-neutral-800/90 py-1.5 px-2 z-30 flex-shrink-0 text-[11px] font-medium shadow-md">
        {/* Canvas View Tab */}
        <button
          onClick={() => setMobileDrawer('none')}
          className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition ${
            mobileDrawer === 'none'
              ? 'text-brand-600 dark:text-brand-400 font-semibold bg-brand-50 dark:bg-brand-950/50'
              : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
          }`}
        >
          <span className="text-base leading-none">🎨</span>
          <span>Canvas</span>
        </button>

        {/* Layers Tab */}
        <button
          onClick={() => setMobileDrawer((prev) => (prev === 'layers' ? 'none' : 'layers'))}
          className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl relative transition ${
            mobileDrawer === 'layers'
              ? 'text-brand-600 dark:text-brand-400 font-semibold bg-brand-50 dark:bg-brand-950/50'
              : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
          }`}
        >
          <div className="relative">
            <span className="text-base leading-none">📑</span>
            {objects.length > 0 && (
              <span className="absolute -top-1 -right-2 bg-brand-600 text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-mono font-bold">
                {objects.length}
              </span>
            )}
          </div>
          <span>Layers</span>
        </button>

        {/* Properties / Settings Tab */}
        <button
          onClick={() => setMobileDrawer((prev) => (prev === 'properties' ? 'none' : 'properties'))}
          className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl relative transition ${
            mobileDrawer === 'properties'
              ? 'text-brand-600 dark:text-brand-400 font-semibold bg-brand-50 dark:bg-brand-950/50'
              : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
          }`}
        >
          <div className="relative">
            <span className="text-base leading-none">⚙️</span>
            {selectedObject && (
              <span className="absolute -top-0.5 -right-1 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-neutral-900" />
            )}
          </div>
          <span>{selectedObject ? 'Image' : 'Page'}</span>
        </button>

        {/* Add Photo Tab */}
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl text-brand-600 dark:text-brand-400 hover:bg-brand-50/50 dark:hover:bg-brand-950/30 transition active:scale-95"
        >
          <span className="text-base leading-none">➕</span>
          <span>Add Photo</span>
        </button>
      </nav>

      {/* ── PAGE SETUP MODAL ── */}
      {showPageSetupModal && (
        <PageSetupDialog
          currentConfig={pageConfig}
          onApply={(newConfig) => {
            setPageConfig(newConfig);
            setShowPageSetupModal(false);
            pushHistory(`Changed page size to ${newConfig.name}`, objects, newConfig);
          }}
          onClose={() => setShowPageSetupModal(false)}
        />
      )}

      {/* ── EXPORTING OVERLAY SPINNER ── */}
      {isExporting && (
        <div className="absolute inset-0 bg-white/80 dark:bg-neutral-950/80 backdrop-blur-xs z-50 flex flex-col items-center justify-center gap-3">
          <div className="w-12 h-12 rounded-full border-4 border-brand-500/30 border-t-brand-600 animate-spin" />
          <p className="text-sm font-semibold text-neutral-900 dark:text-white">{exportMessage || 'Exporting document...'}</p>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// SUB-COMPONENT: Page Setup Dialog
// ─────────────────────────────────────────────
function PageSetupDialog({
  currentConfig,
  onApply,
  onClose,
}: {
  currentConfig: PageConfig;
  onApply: (config: PageConfig) => void;
  onClose: () => void;
}) {
  const [selectedPresetId, setSelectedPresetId] = useState(currentConfig.presetId);
  const [customW, setCustomW] = useState(currentConfig.widthMm);
  const [customH, setCustomH] = useState(currentConfig.heightMm);
  const [customUnit, setCustomUnit] = useState<PageUnit>('mm');
  const [orientation, setOrientation] = useState(currentConfig.orientation);

  const selectedPreset = PAGE_PRESETS.find((p) => p.id === selectedPresetId);

  const effectiveW = selectedPreset ? selectedPreset.widthMm : customW;
  const effectiveH = selectedPreset ? selectedPreset.heightMm : customH;

  const previewW = orientation === 'portrait' ? Math.min(effectiveW, effectiveH) : Math.max(effectiveW, effectiveH);
  const previewH = orientation === 'portrait' ? Math.max(effectiveW, effectiveH) : Math.min(effectiveW, effectiveH);

  return (
    <div className="fixed inset-0 bg-neutral-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh] text-neutral-800 dark:text-neutral-200">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-lg text-neutral-900 dark:text-white">Document Size & Setup</h3>
            <p className="text-xs text-neutral-500">Choose standard paper presets or specify custom dimensions</p>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600 dark:hover:text-white p-1">✕</button>
        </div>

        {/* Content */}
        <div className="p-5 flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-3 gap-6">
          
          <div className="md:col-span-2 space-y-4">
            {/* Standard Paper */}
            <div>
              <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider block mb-2">
                Standard Paper Sizes
              </span>
              <div className="grid grid-cols-2 gap-2">
                {PAGE_PRESETS.filter((p) => p.type === 'paper').map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedPresetId(p.id)}
                    className={`p-3 rounded-xl border text-left transition ${
                      selectedPresetId === p.id
                        ? 'bg-brand-50 dark:bg-brand-950/60 border-brand-500 text-brand-900 dark:text-white ring-1 ring-brand-500'
                        : 'bg-neutral-50 dark:bg-neutral-800/60 border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300'
                    }`}
                  >
                    <div className="font-semibold text-sm">{p.name}</div>
                    <div className="text-[11px] text-neutral-500 mt-0.5">{p.widthMm} × {p.heightMm} mm</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Aspect Ratios */}
            <div>
              <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider block mb-2">
                Common Aspect Ratios
              </span>
              <div className="grid grid-cols-3 gap-2">
                {PAGE_PRESETS.filter((p) => p.type === 'ratio').map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedPresetId(p.id)}
                    className={`p-2.5 rounded-xl border text-left transition ${
                      selectedPresetId === p.id
                        ? 'bg-brand-50 dark:bg-brand-950/60 border-brand-500 text-brand-900 dark:text-white ring-1 ring-brand-500'
                        : 'bg-neutral-50 dark:bg-neutral-800/60 border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300'
                    }`}
                  >
                    <div className="font-semibold text-xs">{p.name}</div>
                    <div className="text-[10px] text-neutral-500 mt-0.5">{p.aspectRatio}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Custom */}
            <div>
              <button
                onClick={() => setSelectedPresetId('custom')}
                className={`w-full p-2.5 rounded-xl border text-left transition mb-2 ${
                  selectedPresetId === 'custom'
                    ? 'bg-brand-50 dark:bg-brand-950/60 border-brand-500 text-brand-900 dark:text-white ring-1 ring-brand-500'
                    : 'bg-neutral-50 dark:bg-neutral-800/60 border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300'
                }`}
              >
                <div className="font-semibold text-xs">Custom Dimensions</div>
                <div className="text-[11px] text-neutral-500">Specify width and height in mm, cm, or inches</div>
              </button>

              {selectedPresetId === 'custom' && (
                <div className="grid grid-cols-3 gap-2 p-3 bg-neutral-50 dark:bg-neutral-950/60 border border-neutral-200 dark:border-neutral-800 rounded-xl">
                  <div>
                    <span className="text-[10px] text-neutral-500 block mb-1">Width</span>
                    <input
                      type="number"
                      value={customW}
                      onChange={(e) => setCustomW(Math.max(20, Math.min(2000, parseFloat(e.currentTarget.value) || 100)))}
                      className="w-full bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-lg px-2 py-1.5 text-xs text-neutral-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-neutral-500 block mb-1">Height</span>
                    <input
                      type="number"
                      value={customH}
                      onChange={(e) => setCustomH(Math.max(20, Math.min(2000, parseFloat(e.currentTarget.value) || 100)))}
                      className="w-full bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-lg px-2 py-1.5 text-xs text-neutral-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-neutral-500 block mb-1">Unit</span>
                    <select
                      value={customUnit}
                      onChange={(e) => setCustomUnit(e.currentTarget.value as PageUnit)}
                      className="w-full bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-lg px-2 py-1.5 text-xs text-neutral-900 dark:text-white"
                    >
                      <option value="mm">mm</option>
                      <option value="cm">cm</option>
                      <option value="in">in</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* Orientation */}
            <div className="flex items-center gap-3 pt-2 border-t border-neutral-200 dark:border-neutral-800">
              <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300">Orientation:</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setOrientation('portrait')}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition ${
                    orientation === 'portrait'
                      ? 'bg-brand-600 text-white border-brand-500'
                      : 'bg-neutral-100 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400'
                  }`}
                >
                  Portrait
                </button>
                <button
                  onClick={() => setOrientation('landscape')}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition ${
                    orientation === 'landscape'
                      ? 'bg-brand-600 text-white border-brand-500'
                      : 'bg-neutral-100 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400'
                  }`}
                >
                  Landscape
                </button>
              </div>
            </div>
          </div>

          {/* Proportional Preview */}
          <div className="flex flex-col items-center justify-center p-4 bg-neutral-50 dark:bg-neutral-950/70 border border-neutral-200 dark:border-neutral-800 rounded-xl">
            <span className="text-xs text-neutral-500 font-medium mb-3">Proportional Preview</span>
            
            <div className="w-full h-44 flex items-center justify-center">
              <div
                className="bg-white rounded-sm shadow-md border border-neutral-300 flex items-center justify-center transition-all duration-300"
                style={{
                  width: `${Math.min(130, (previewW / Math.max(previewW, previewH)) * 130)}px`,
                  height: `${Math.min(170, (previewH / Math.max(previewW, previewH)) * 170)}px`,
                }}
              >
                <span className="text-[10px] text-neutral-400 font-mono">
                  {Math.round(previewW)}×{Math.round(previewH)}
                </span>
              </div>
            </div>

            <p className="mt-3 text-center text-xs text-neutral-700 dark:text-neutral-300 font-semibold">
              {selectedPreset ? selectedPreset.name : 'Custom Page'}
            </p>
            <p className="text-[11px] text-neutral-500 font-mono">
              {Math.round(previewW)} × {Math.round(previewH)} mm
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-950/70 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-300 text-xs font-medium transition"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onApply({
                ...currentConfig,
                presetId: selectedPresetId,
                name: selectedPreset ? selectedPreset.name : 'Custom Page',
                widthMm: effectiveW,
                heightMm: effectiveH,
                orientation,
              });
            }}
            className="px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold shadow-xs transition active:scale-95"
          >
            Apply Page Size
          </button>
        </div>
      </div>
    </div>
  );
}
