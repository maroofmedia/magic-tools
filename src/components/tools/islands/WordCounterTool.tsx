/** @jsxImportSource preact */
import { useState, useEffect, useMemo, useRef, useCallback } from 'preact/hooks';
import { downloadBlob } from '@/utils/helpers';
import type { ToolConfig } from '@/types/index';

interface Props {
  tool: ToolConfig;
}

type FontSize = 'sm' | 'base' | 'lg';

export default function WordCounterTool({ tool: _tool }: Props) {
  const [text, setText] = useState<string>('');
  const [history, setHistory] = useState<string[]>(['']);
  const [historyIdx, setHistoryIdx] = useState<number>(0);
  const isHistoryUpdate = useRef<boolean>(false);
  const lastHistoryTime = useRef<number>(Date.now());

  const [fontSize, setFontSize] = useState<FontSize>('base');
  const [readingWpm, setReadingWpm] = useState<number>(250);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [showSavedToast, setShowSavedToast] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const saveTimeoutRef = useRef<number | null>(null);

  // Restore draft and reading speed from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('magictools_wordcounter_text');
      if (saved) {
        setText(saved);
        setHistory([saved]);
        setHistoryIdx(0);
      }
      const savedWpm = localStorage.getItem('magictools_wordcounter_wpm');
      if (savedWpm) {
        const parsed = parseInt(savedWpm, 10);
        if (!isNaN(parsed) && parsed > 0) {
          setReadingWpm(parsed);
        }
      }
    } catch {}
  }, []);

  // Lock background body scroll when in fullscreen
  useEffect(() => {
    if (isFullscreen) {
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    };
  }, [isFullscreen]);

  // Global keydown: ESC to exit fullscreen
  useEffect(() => {
    const handleGlobalKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleGlobalKey);
    return () => window.removeEventListener('keydown', handleGlobalKey);
  }, [isFullscreen]);


  // Update text with history recording and debounced auto-save
  const handleTextChange = useCallback(
    (newText: string, forceNewStep = false) => {
      setText(newText);

      if (!isHistoryUpdate.current) {
        const now = Date.now();
        const currentEntry = history[historyIdx] ?? '';
        const shouldCreateNewStep =
          forceNewStep ||
          history.length === 0 ||
          now - lastHistoryTime.current > 750 ||
          newText.endsWith(' ') ||
          newText.endsWith('\n') ||
          Math.abs(newText.length - currentEntry.length) > 10;

        lastHistoryTime.current = now;

        if (shouldCreateNewStep) {
          const newHistory = history.slice(0, historyIdx + 1);
          if (newHistory[newHistory.length - 1] !== newText) {
            newHistory.push(newText);
            if (newHistory.length > 50) newHistory.shift();
            setHistory(newHistory);
            setHistoryIdx(newHistory.length - 1);
          }
        } else {
          const newHistory = history.slice(0, historyIdx + 1);
          if (newHistory.length === 0) {
            newHistory.push(newText);
            setHistory(newHistory);
            setHistoryIdx(0);
          } else {
            newHistory[newHistory.length - 1] = newText;
            setHistory(newHistory);
          }
        }
      } else {
        isHistoryUpdate.current = false;
      }

      // Auto-save debounce
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = window.setTimeout(() => {
        try {
          localStorage.setItem('magictools_wordcounter_text', newText);
          setShowSavedToast(true);
          setTimeout(() => setShowSavedToast(false), 2000);
        } catch {}
      }, 400);
    },
    [history, historyIdx]
  );

  // Undo
  const handleUndo = useCallback(() => {
    if (historyIdx > 0) {
      isHistoryUpdate.current = true;
      const nextIdx = historyIdx - 1;
      setHistoryIdx(nextIdx);
      const prevText = history[nextIdx];
      setText(prevText);
      try {
        localStorage.setItem('magictools_wordcounter_text', prevText);
      } catch {}
    }
  }, [history, historyIdx]);

  // Redo
  const handleRedo = useCallback(() => {
    if (historyIdx < history.length - 1) {
      isHistoryUpdate.current = true;
      const nextIdx = historyIdx + 1;
      setHistoryIdx(nextIdx);
      const nextText = history[nextIdx];
      setText(nextText);
      try {
        localStorage.setItem('magictools_wordcounter_text', nextText);
      } catch {}
    }
  }, [history, historyIdx]);

  // Keyboard shortcuts (Ctrl+Z, Ctrl+Y, Ctrl+Shift+Z, Cmd+Z, Cmd+Y)
  const handleKeyDown = (e: KeyboardEvent) => {
    const isCtrlOrMeta = e.ctrlKey || e.metaKey;
    if (isCtrlOrMeta) {
      if (e.key === 'z' || e.key === 'Z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if (e.key === 'y' || e.key === 'Y') {
        e.preventDefault();
        handleRedo();
      }
    }
  };

  // Comprehensive Live Text Statistics
  const stats = useMemo(() => {
    const raw = text;
    const trimmed = raw.trim();

    // Characters
    const characters = raw.length;
    const charactersNoSpaces = raw.replace(/\s/g, '').length;

    // Words
    const wordTokens = trimmed ? trimmed.split(/\s+/).filter(Boolean) : [];
    const words = wordTokens.length;

    // Sentences
    const sentenceMatches = raw.match(/[^.!?]+[.!?]+(\s|$)/g);
    let sentences = sentenceMatches ? sentenceMatches.length : 0;
    if (sentences === 0 && trimmed.length > 0) {
      sentences = 1;
    }

    // Paragraphs
    const paragraphTokens = raw
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
    const paragraphs = paragraphTokens.length;

    // Lines
    const lines = raw.length > 0 ? raw.split('\n').length : 0;

    // Reading & Speaking times
    const readingMinutes = words / (readingWpm > 0 ? readingWpm : 250);
    const speakingMinutes = words / 130;
    const handwritingMinutes = words / 30;

    const formatDuration = (mins: number) => {
      if (mins <= 0) return '0 sec';
      const totalSecs = Math.round(mins * 60);
      if (totalSecs < 60) return `${totalSecs} sec`;
      const m = Math.floor(totalSecs / 60);
      const s = totalSecs % 60;
      return s > 0 ? `${m}m ${s}s` : `${m} min`;
    };

    // Averages
    const avgWordLength = words > 0 ? parseFloat((charactersNoSpaces / words).toFixed(1)) : 0;
    const avgSentenceLength = sentences > 0 ? parseFloat((words / sentences).toFixed(1)) : 0;

    return {
      words,
      characters,
      charactersNoSpaces,
      sentences,
      paragraphs,
      lines,
      pagesDouble: words > 0 ? (words / 250).toFixed(1) : '0',
      readingTime: formatDuration(readingMinutes),
      speakingTime: formatDuration(speakingMinutes),
      handwritingTime: formatDuration(handwritingMinutes),
      avgWordLength,
      avgSentenceLength,
    };
  }, [text, readingWpm]);

  // File Upload
  const handleFileUpload = (e: Event) => {
    const target = e.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result;
      if (typeof result === 'string') {
        handleTextChange(result, true);
        (window as any).__magictools_toast?.({
          type: 'success',
          title: 'File Loaded',
          message: `Imported ${file.name} successfully!`,
        });
      }
    };
    reader.readAsText(file);
    target.value = '';
  };

  // Drag and drop file onto textarea
  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result;
      if (typeof result === 'string') {
        handleTextChange(result, true);
        (window as any).__magictools_toast?.({
          type: 'success',
          title: 'File Loaded',
          message: `Imported ${file.name} successfully!`,
        });
      }
    };
    reader.readAsText(file);
  };

  // Copy to clipboard
  const handleCopy = async () => {
    if (!text.trim()) return;
    try {
      await navigator.clipboard.writeText(text);
      (window as any).__magictools_toast?.({
        type: 'success',
        title: 'Copied to Clipboard',
        message: `${stats.words.toLocaleString()} words copied!`,
      });
    } catch {
      (window as any).__magictools_toast?.({
        type: 'error',
        title: 'Copy Failed',
        message: 'Could not access clipboard.',
      });
    }
  };

  // Download as .txt file
  const handleDownload = () => {
    if (!text.trim()) return;
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    downloadBlob(blob, 'text-document.txt');
    (window as any).__magictools_toast?.({
      type: 'success',
      title: 'Downloaded File',
      message: 'Saved text-document.txt to your downloads.',
    });
  };

  // Clear text
  const handleClear = () => {
    if (!text.trim()) return;
    if (confirm('Are you sure you want to clear all text?')) {
      handleTextChange('', true);
      try {
        localStorage.removeItem('magictools_wordcounter_text');
      } catch {}
      (window as any).__magictools_toast?.({
        type: 'info',
        title: 'Cleared',
        message: 'Editor reset to blank.',
      });
    }
  };

  // Text Transformations (treated as distinct undo steps)
  const applyTransform = (type: 'upper' | 'lower' | 'title' | 'clean-spaces') => {
    if (!text) return;
    let result = text;

    switch (type) {
      case 'upper':
        result = text.toUpperCase();
        break;
      case 'lower':
        result = text.toLowerCase();
        break;
      case 'title':
        result = text.replace(/\b\w+/g, (txt) => txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase());
        break;
      case 'clean-spaces':
        result = text.replace(/[ \t]+/g, ' ').replace(/^ +| +$/gm, '');
        break;
    }

    handleTextChange(result, true);
    (window as any).__magictools_toast?.({
      type: 'success',
      title: 'Text Transformed',
      message: `Applied ${type} transform.`,
    });
  };

  return (
    <div
      class={`flex flex-col transition-all duration-200 ${
        isFullscreen
          ? 'fixed inset-0 z-[9999] w-full h-full h-[100dvh] min-h-screen p-0 m-0 rounded-none border-0 bg-white dark:bg-neutral-900 overflow-hidden'
          : 'w-full gap-3 sm:gap-5'
      }`}
    >
      {/* ── 1. Top Primary Metric Cards (Shown in both normal and fullscreen mode) ── */}
      <div
        class={`grid grid-cols-2 md:grid-cols-4 flex-shrink-0 ${
          isFullscreen
            ? 'gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 border-b border-neutral-200/80 dark:border-neutral-800/80 bg-neutral-50/95 dark:bg-neutral-950/95'
            : 'gap-2 sm:gap-3.5'
        }`}
      >
        {/* Words Card */}
        <div
          class={`border border-neutral-200/90 dark:border-neutral-800/90 bg-white/90 dark:bg-neutral-900/90 shadow-2xs relative overflow-hidden group hover:border-brand-500/40 transition-all ${
            isFullscreen ? 'rounded-lg p-2 sm:p-2.5' : 'rounded-xl sm:rounded-2xl p-3 sm:p-4'
          }`}
        >
          <div class="flex items-center justify-between mb-0.5 sm:mb-1">
            <span class="text-xs font-semibold text-neutral-500 dark:text-neutral-400">Words</span>
            <span class="w-2 h-2 rounded-full bg-brand-500 animate-pulse"></span>
          </div>
          <div class={`font-display font-extrabold text-neutral-900 dark:text-white tracking-tight ${isFullscreen ? 'text-lg sm:text-xl md:text-2xl' : 'text-xl sm:text-2xl md:text-3xl'}`}>
            {stats.words.toLocaleString()}
          </div>
          <div class="mt-0.5 sm:mt-1 text-[11px] text-neutral-500 dark:text-neutral-400 truncate">
            <span>Avg {stats.avgWordLength} chars/word</span>
          </div>
        </div>

        {/* Characters Card */}
        <div
          class={`border border-neutral-200/90 dark:border-neutral-800/90 bg-white/90 dark:bg-neutral-900/90 shadow-2xs relative overflow-hidden group hover:border-sky-500/40 transition-all ${
            isFullscreen ? 'rounded-lg p-2 sm:p-2.5' : 'rounded-xl sm:rounded-2xl p-3 sm:p-4'
          }`}
        >
          <div class="flex items-center justify-between mb-0.5 sm:mb-1">
            <span class="text-xs font-semibold text-neutral-500 dark:text-neutral-400">Characters</span>
            <span class="w-1.5 h-1.5 rounded-full bg-sky-500"></span>
          </div>
          <div class={`font-display font-extrabold text-neutral-900 dark:text-white tracking-tight ${isFullscreen ? 'text-lg sm:text-xl md:text-2xl' : 'text-xl sm:text-2xl md:text-3xl'}`}>
            {stats.characters.toLocaleString()}
          </div>
          <div class="mt-0.5 sm:mt-1 text-[11px] text-neutral-500 dark:text-neutral-400 truncate">
            <span>{stats.charactersNoSpaces.toLocaleString()} no spaces</span>
          </div>
        </div>

        {/* Sentences Card */}
        <div
          class={`border border-neutral-200/90 dark:border-neutral-800/90 bg-white/90 dark:bg-neutral-900/90 shadow-2xs relative overflow-hidden group hover:border-emerald-500/40 transition-all ${
            isFullscreen ? 'rounded-lg p-2 sm:p-2.5' : 'rounded-xl sm:rounded-2xl p-3 sm:p-4'
          }`}
        >
          <div class="flex items-center justify-between mb-0.5 sm:mb-1">
            <span class="text-xs font-semibold text-neutral-500 dark:text-neutral-400">Sentences</span>
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
          </div>
          <div class={`font-display font-extrabold text-neutral-900 dark:text-white tracking-tight ${isFullscreen ? 'text-lg sm:text-xl md:text-2xl' : 'text-xl sm:text-2xl md:text-3xl'}`}>
            {stats.sentences.toLocaleString()}
          </div>
          <div class="mt-0.5 sm:mt-1 text-[11px] text-neutral-500 dark:text-neutral-400 truncate">
            <span>Avg {stats.avgSentenceLength} words/sent</span>
          </div>
        </div>

        {/* Reading Time Card */}
        <div
          class={`border border-neutral-200/90 dark:border-neutral-800/90 bg-white/90 dark:bg-neutral-900/90 shadow-2xs relative overflow-hidden group hover:border-purple-500/40 transition-all ${
            isFullscreen ? 'rounded-lg p-2 sm:p-2.5' : 'rounded-xl sm:rounded-2xl p-3 sm:p-4'
          }`}
        >
          <div class="flex items-center justify-between mb-0.5 sm:mb-1 gap-1">
            <span class="text-xs font-semibold text-neutral-500 dark:text-neutral-400 truncate">Reading Time</span>
            <div
              class="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-md bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-200/60 dark:border-purple-800/40 text-[10px] font-mono flex-shrink-0"
              title="Click number to edit reading speed (words per minute)"
            >
              <input
                type="number"
                min="50"
                max="1000"
                step="10"
                value={readingWpm}
                onInput={(e) => {
                  const val = parseInt((e.target as HTMLInputElement).value, 10);
                  if (!isNaN(val) && val > 0) {
                    setReadingWpm(val);
                    try {
                      localStorage.setItem('magictools_wordcounter_wpm', String(val));
                    } catch {}
                  }
                }}
                class="w-7 sm:w-8 bg-transparent text-center font-bold text-purple-700 dark:text-purple-300 outline-none border-b border-purple-400/40 focus:border-purple-600 dark:focus:border-purple-400 p-0 text-[10px]"
              />
              <span class="text-[9px] font-semibold text-purple-600/80 dark:text-purple-400/80">wpm</span>
            </div>
          </div>
          <div class={`font-display font-extrabold text-neutral-900 dark:text-white tracking-tight ${isFullscreen ? 'text-lg sm:text-xl md:text-2xl' : 'text-xl sm:text-2xl md:text-3xl'}`}>
            {stats.readingTime}
          </div>
          <div class="mt-0.5 sm:mt-1 text-[11px] text-neutral-500 dark:text-neutral-400 truncate">
            <span>Speech: {stats.speakingTime}</span>
          </div>
        </div>
      </div>

      {/* ── 2. Text Input & Editor Container ── */}
      <div
        class={`flex flex-col bg-white dark:bg-neutral-900 overflow-hidden ${
          isFullscreen
            ? 'flex-1 min-h-0 h-full w-full border-0 rounded-none'
            : 'rounded-2xl border border-neutral-200/90 dark:border-neutral-800/90 shadow-sm'
        }`}
      >
        {/* Hidden File Input */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileUpload}
          accept=".txt,.md,.markdown,.text,.csv"
          class="hidden"
        />

        {/* ── Top Header Bar: Document identity on left, Global Actions pinned to FAR RIGHT (Matches Markdown Editor) ── */}
        <div class="px-3 sm:px-4 py-2 flex items-center justify-between gap-2 border-b border-neutral-200/80 dark:border-neutral-800/80 bg-neutral-50/80 dark:bg-neutral-900/80 flex-shrink-0">
          {/* Left: Document icon + Title + Status */}
          <div class="flex items-center gap-2 min-w-0">
            <div class="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400 flex items-center justify-center flex-shrink-0">
              <svg class="w-3.5 h-3.5 sm:w-4 sm:h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
                <polyline points="10 9 9 9 8 9"/>
              </svg>
            </div>

            <div class="flex items-center gap-1.5 min-w-0">
              <span class="text-xs sm:text-sm font-semibold text-neutral-900 dark:text-white truncate">
                {isFullscreen ? 'Distraction-Free Editor' : 'Word Counter Editor'}
              </span>
              <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" title="Live counting active"></span>
              {showSavedToast && (
                <span class="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium px-1.5 py-0.2 rounded bg-emerald-500/10 transition-opacity flex-shrink-0">
                  Saved
                </span>
              )}
            </div>
          </div>

          {/* Right: Actions pinned to far right (Upload, Copy, Download, Remove/Clear, Fullscreen) */}
          <div class="flex items-center gap-1 sm:gap-1.5 flex-shrink-0 ml-auto">
            {/* Remove / Clear */}
            <button
              type="button"
              onClick={handleClear}
              disabled={!text}
              class="px-2 sm:px-2.5 py-1 rounded-lg text-xs font-semibold text-neutral-500 hover:text-red-600 dark:text-neutral-400 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-30 transition-colors flex items-center gap-1"
              title="Clear editor text"
            >
              <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
              </svg>
              <span class="hidden sm:inline">Clear</span>
            </button>

            {/* Upload */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              class="px-2 sm:px-2.5 py-1 rounded-lg text-xs font-semibold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200/60 dark:hover:bg-neutral-800 transition-colors flex items-center gap-1"
              title="Upload a text or markdown file (.txt, .md)"
            >
              <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
              </svg>
              <span class="hidden sm:inline">Upload</span>
            </button>

            {/* Copy */}
            <button
              type="button"
              onClick={handleCopy}
              disabled={!text}
              class="px-2 sm:px-2.5 py-1 rounded-lg text-xs font-semibold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200/60 dark:hover:bg-neutral-800 disabled:opacity-40 transition-colors flex items-center gap-1"
              title="Copy text to clipboard"
            >
              <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"/>
              </svg>
              <span class="hidden sm:inline">Copy</span>
            </button>

            {/* Download */}
            <button
              type="button"
              onClick={handleDownload}
              disabled={!text}
              class="px-2 sm:px-2.5 py-1 rounded-lg text-xs font-semibold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200/60 dark:hover:bg-neutral-800 disabled:opacity-40 transition-colors flex items-center gap-1"
              title="Download as .txt file"
            >
              <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
              </svg>
              <span class="hidden sm:inline">Download</span>
            </button>

            {/* Fullscreen */}
            <button
              type="button"
              onClick={() => setIsFullscreen(!isFullscreen)}
              class="p-1.5 rounded-lg text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200/60 dark:hover:bg-neutral-800 transition-colors flex-shrink-0"
              title={isFullscreen ? 'Exit Fullscreen (Esc)' : 'Enter Fullscreen'}
            >
              {isFullscreen ? (
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                </svg>
              ) : (
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"/>
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* ── Toolbar Row (Formatting tools: Undo, Redo, Case transforms, Font size) ── */}
        <div class="px-2.5 sm:px-4 py-1.5 flex items-center justify-between gap-2 border-b border-neutral-200/60 dark:border-neutral-800/60 bg-neutral-50/50 dark:bg-neutral-900/50 select-none overflow-x-auto no-scrollbar flex-shrink-0">
          {/* Left tools */}
          <div class="flex items-center gap-1 sm:gap-1.5 flex-nowrap">
            {/* Undo / Redo */}
            <div class="flex items-center gap-0.5 bg-neutral-200/70 dark:bg-neutral-800 rounded-lg p-0.5 flex-shrink-0">
              <button
                type="button"
                onClick={handleUndo}
                disabled={historyIdx <= 0}
                class="p-1.5 rounded text-neutral-700 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white hover:bg-white dark:hover:bg-neutral-700 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                title="Undo (Ctrl+Z)"
              >
                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a5 5 0 015 5v2M3 10l6-6M3 10l6 6"/>
                </svg>
              </button>
              <button
                type="button"
                onClick={handleRedo}
                disabled={historyIdx >= history.length - 1}
                class="p-1.5 rounded text-neutral-700 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white hover:bg-white dark:hover:bg-neutral-700 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                title="Redo (Ctrl+Y)"
              >
                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 10H11a5 5 0 00-5 5v2m15-7l-6-6m6 6l-6 6"/>
                </svg>
              </button>
            </div>

            <div class="h-3.5 w-px bg-neutral-200 dark:bg-neutral-700 mx-1 flex-shrink-0"></div>

            {/* Case Transforms */}
            <div class="flex items-center gap-1 flex-shrink-0">
              <button
                type="button"
                onClick={() => applyTransform('upper')}
                class="px-2 py-0.5 rounded text-[11px] font-semibold text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-200/60 dark:hover:bg-neutral-800 transition-colors whitespace-nowrap"
                title="Transform to UPPERCASE"
              >
                UPPER
              </button>
              <button
                type="button"
                onClick={() => applyTransform('lower')}
                class="px-2 py-0.5 rounded text-[11px] font-semibold text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-200/60 dark:hover:bg-neutral-800 transition-colors whitespace-nowrap"
                title="Transform to lowercase"
              >
                lower
              </button>
              <button
                type="button"
                onClick={() => applyTransform('title')}
                class="px-2 py-0.5 rounded text-[11px] font-semibold text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-200/60 dark:hover:bg-neutral-800 transition-colors whitespace-nowrap"
                title="Transform to Title Case"
              >
                Title Case
              </button>
              <button
                type="button"
                onClick={() => applyTransform('clean-spaces')}
                class="px-2 py-0.5 rounded text-[11px] font-semibold text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-200/60 dark:hover:bg-neutral-800 transition-colors whitespace-nowrap"
                title="Clean duplicate spaces"
              >
                Clean Spaces
              </button>
            </div>

            <div class="h-3.5 w-px bg-neutral-200 dark:bg-neutral-700 mx-1 flex-shrink-0"></div>

            {/* Font size toggles */}
            <div class="flex items-center bg-neutral-200/70 dark:bg-neutral-800 rounded-lg p-0.5 text-[11px] font-semibold flex-shrink-0">
              <button
                type="button"
                onClick={() => setFontSize('sm')}
                class={`px-1.5 py-0.5 rounded ${fontSize === 'sm' ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-2xs' : 'text-neutral-500'}`}
                title="Small text"
              >
                A-
              </button>
              <button
                type="button"
                onClick={() => setFontSize('base')}
                class={`px-1.5 py-0.5 rounded ${fontSize === 'base' ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-2xs' : 'text-neutral-500'}`}
                title="Normal text"
              >
                A
              </button>
              <button
                type="button"
                onClick={() => setFontSize('lg')}
                class={`px-1.5 py-0.5 rounded ${fontSize === 'lg' ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-2xs' : 'text-neutral-500'}`}
                title="Large text"
              >
                A+
              </button>
            </div>
          </div>

          {/* Right word count indicator */}
          <div class="text-[11px] font-mono text-neutral-500 dark:text-neutral-400 flex items-center gap-1 flex-shrink-0 pl-2">
            <span class="font-semibold text-brand-600 dark:text-brand-400">{stats.words.toLocaleString()}</span>
            <span>words</span>
          </div>
        </div>

        {/* ── Textarea Workspace (Expands to 100% of remaining space with zero gap) ── */}
        <div class="relative flex-1 min-h-0 flex flex-col w-full h-full bg-white dark:bg-neutral-900 overflow-hidden">
          <textarea
            ref={textareaRef}
            value={text}
            onInput={(e) => handleTextChange((e.target as HTMLTextAreaElement).value)}
            onKeyDown={handleKeyDown}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            placeholder="Type or paste your text here (or drag and drop a .txt/.md file)..."
            class={`word-counter-textarea w-full p-3.5 sm:p-5 bg-transparent text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-500 border-0 outline-none focus:outline-none focus:ring-0 shadow-none leading-relaxed ${
              isFullscreen
                ? 'flex-1 h-full min-h-0 resize-none overflow-y-auto'
                : 'min-h-[360px] sm:min-h-[460px] resize-y'
            } ${
              fontSize === 'sm' ? 'text-xs sm:text-sm' : fontSize === 'lg' ? 'text-base sm:text-lg' : 'text-sm sm:text-base'
            }`}
          />
        </div>

        {/* ── Bottom Status Bar (Pinned to bottom without gap) ── */}
        {isFullscreen ? (
          <div class="px-3 sm:px-4 py-2 border-t border-neutral-200/80 dark:border-neutral-800/80 bg-neutral-50/90 dark:bg-neutral-900/90 flex flex-wrap items-center justify-between gap-2 text-[11px] sm:text-xs text-neutral-600 dark:text-neutral-400 font-mono flex-shrink-0">
            {/* Primary metrics in fullscreen status bar */}
            <div class="flex items-center gap-3 sm:gap-4 flex-wrap">
              <div>
                <span class="font-bold text-neutral-900 dark:text-white">{stats.words.toLocaleString()}</span>
                <span class="ml-1 text-neutral-500">words</span>
              </div>
              <div>
                <span class="font-bold text-neutral-900 dark:text-white">{stats.characters.toLocaleString()}</span>
                <span class="ml-1 text-neutral-500">chars</span>
                <span class="ml-1 text-[10px] text-neutral-400">({stats.charactersNoSpaces.toLocaleString()} no space)</span>
              </div>
              <div>
                <span class="font-bold text-neutral-900 dark:text-white">{stats.sentences}</span>
                <span class="ml-1 text-neutral-500">sentences</span>
              </div>
              <div>
                <span class="font-bold text-neutral-900 dark:text-white">{stats.paragraphs}</span>
                <span class="ml-1 text-neutral-500">paras</span>
              </div>
              <div>
                <span class="font-bold text-neutral-900 dark:text-white">{stats.lines}</span>
                <span class="ml-1 text-neutral-500">lines</span>
              </div>
              <div class="hidden sm:inline">
                <span class="font-bold text-neutral-900 dark:text-white">{stats.pagesDouble}</span>
                <span class="ml-1 text-neutral-500">pages</span>
              </div>
            </div>

            {/* Reading speed with editable badge in fullscreen */}
            <div class="flex items-center gap-2 text-[11px]">
              <div class="flex items-center gap-1">
                <span>Reading:</span>
                <span class="font-semibold text-neutral-900 dark:text-white">{stats.readingTime}</span>
                <div
                  class="inline-flex items-center gap-0.5 px-1 py-0.2 rounded bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-200/60 dark:border-purple-800/40 text-[10px]"
                  title="Edit words per minute"
                >
                  <input
                    type="number"
                    min="50"
                    max="1000"
                    step="10"
                    value={readingWpm}
                    onInput={(e) => {
                      const val = parseInt((e.target as HTMLInputElement).value, 10);
                      if (!isNaN(val) && val > 0) {
                        setReadingWpm(val);
                        try {
                          localStorage.setItem('magictools_wordcounter_wpm', String(val));
                        } catch {}
                      }
                    }}
                    class="w-7 bg-transparent text-center font-bold text-purple-700 dark:text-purple-300 outline-none border-b border-purple-400/40 focus:border-purple-600 dark:focus:border-purple-400 p-0 text-[10px]"
                  />
                  <span class="text-[9px]">wpm</span>
                </div>
              </div>
              <span class="hidden md:inline text-neutral-300 dark:text-neutral-700">•</span>
              <span class="hidden md:inline">Speech: {stats.speakingTime}</span>
            </div>
          </div>
        ) : (
          <div class="px-3 sm:px-4 py-2 border-t border-neutral-200/80 dark:border-neutral-800/80 bg-neutral-50/70 dark:bg-neutral-900/70 flex flex-wrap items-center justify-between gap-2 text-[11px] sm:text-xs text-neutral-500 dark:text-neutral-400 flex-shrink-0">
            <div class="flex items-center gap-2.5 sm:gap-4 flex-wrap font-mono">
              <div>
                <span class="font-semibold text-neutral-800 dark:text-neutral-200">{stats.paragraphs}</span>
                <span class="ml-1 text-[10px] text-neutral-500">{stats.paragraphs === 1 ? 'para' : 'paras'}</span>
              </div>
              <div>
                <span class="font-semibold text-neutral-800 dark:text-neutral-200">{stats.lines}</span>
                <span class="ml-1 text-[10px] text-neutral-500">lines</span>
              </div>
              <div>
                <span class="font-semibold text-neutral-800 dark:text-neutral-200">{stats.pagesDouble}</span>
                <span class="ml-1 text-[10px] text-neutral-500">pages</span>
              </div>
            </div>

            <div class="flex items-center gap-3 text-[11px]">
              <span>Speech: {stats.speakingTime}</span>
              <span class="hidden sm:inline">Handwriting: {stats.handwritingTime}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
