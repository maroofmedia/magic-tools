/** @jsxImportSource preact */
import { useState, useEffect, useRef, useCallback } from 'preact/hooks';
import { marked } from 'marked';
import { downloadBlob } from '@/utils/helpers';
import type { ToolConfig } from '@/types/index';

interface Props {
  tool: ToolConfig;
}

type ViewMode = 'split' | 'edit' | 'preview';

export default function MarkdownEditorTool({ tool }: Props) {
  const [content, setContent] = useState<string>('');
  const [fileName, setFileName] = useState<string>('document.md');
  const [isEditingFileName, setIsEditingFileName] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('split');
  const [syncScroll, setSyncScroll] = useState<boolean>(true);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [renderedHtml, setRenderedHtml] = useState<string>('');
  const [isSaved, setIsSaved] = useState<boolean>(true);
  const [showExportMenu, setShowExportMenu] = useState<boolean>(false);
  const [stats, setStats] = useState({
    words: 0,
    characters: 0,
    charactersNoSpaces: 0,
    lines: 0,
    readingTime: 0,
  });

  // History stack for Undo / Redo
  const [history, setHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState<number>(-1);
  const isHistoryUpdate = useRef(false);

  const editorRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync scroll coordination refs
  const scrollingSource = useRef<'editor' | 'preview' | null>(null);
  const clearSourceTimer = useRef<number | null>(null);
  const syncScrollRaf = useRef<number | null>(null);

  // Initialize marked options
  useEffect(() => {
    marked.use({
      gfm: true,
      breaks: true,
    });
  }, []);

  // Responsive default view mode
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        if (viewMode === 'split') {
          setViewMode('edit');
        }
      }
    };

    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setViewMode('edit');
    }

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Load from local storage or start with empty editor
  useEffect(() => {
    try {
      const savedContent = localStorage.getItem('magictools_markdown_content');
      const savedName = localStorage.getItem('magictools_markdown_filename');
      const initialText = savedContent !== null ? savedContent : '';
      setContent(initialText);
      if (savedName) setFileName(savedName);
      setHistory([initialText]);
      setHistoryIdx(0);
    } catch {
      setContent('');
      setHistory(['']);
      setHistoryIdx(0);
    }
  }, []);

  // Update stats, rendered HTML, and auto-save
  useEffect(() => {
    // Render Markdown
    try {
      const res = marked.parse(content);
      if (typeof res === 'string') {
        setRenderedHtml(res);
      } else if (res && typeof (res as any).then === 'function') {
        (res as Promise<string>).then((html) => setRenderedHtml(html)).catch((err) => {
          console.error('Markdown async parse error', err);
        });
      }
    } catch (e) {
      console.error('Markdown parse error', e);
    }

    // Calculate stats
    const trimmed = content.trim();
    const words = trimmed ? trimmed.split(/\s+/).filter(Boolean).length : 0;
    const characters = content.length;
    const charactersNoSpaces = content.replace(/\s/g, '').length;
    const lines = content === '' ? 1 : content.split('\n').length;
    const readingTime = Math.max(1, Math.ceil(words / 200));

    setStats({
      words,
      characters,
      charactersNoSpaces,
      lines,
      readingTime,
    });

    // Auto-save to localStorage
    try {
      localStorage.setItem('magictools_markdown_content', content);
      setIsSaved(true);
    } catch (e) {
      console.warn('LocalStorage save error:', e);
    }

    // Manage undo/redo history
    if (!isHistoryUpdate.current) {
      setHistory((prev) => {
        const upToCurrent = prev.slice(0, historyIdx + 1);
        if (upToCurrent[upToCurrent.length - 1] === content) {
          return upToCurrent;
        }
        const updated = [...upToCurrent, content];
        if (updated.length > 50) updated.shift();
        return updated;
      });
      setHistoryIdx((prev) => Math.min(prev + 1, 49));
    }
    isHistoryUpdate.current = false;
  }, [content]);

  // Synchronize scrolling between editor and preview
  const handleEditorScroll = () => {
    // Synchronize line numbers gutter immediately
    if (lineNumbersRef.current && editorRef.current) {
      lineNumbersRef.current.scrollTop = editorRef.current.scrollTop;
    }

    // If sync scroll is off or preview is currently the active driver, ignore
    if (!syncScroll || scrollingSource.current === 'preview') {
      return;
    }

    if (scrollingSource.current === null) {
      scrollingSource.current = 'editor';
    }

    // Reset the active source lock after user stops scrolling
    if (clearSourceTimer.current) clearTimeout(clearSourceTimer.current);
    clearSourceTimer.current = window.setTimeout(() => {
      scrollingSource.current = null;
    }, 250);

    if (syncScrollRaf.current) cancelAnimationFrame(syncScrollRaf.current);
    syncScrollRaf.current = requestAnimationFrame(() => {
      const editor = editorRef.current;
      const preview = previewRef.current;
      if (!editor || !preview) return;

      const editorMax = editor.scrollHeight - editor.clientHeight;
      const previewMax = preview.scrollHeight - preview.clientHeight;

      if (editorMax > 0 && previewMax > 0) {
        const scrollRatio = editor.scrollTop / editorMax;
        preview.scrollTop = Math.round(scrollRatio * previewMax);
      }
    });
  };

  const handlePreviewScroll = () => {
    // If sync scroll is off or editor is currently the active driver, ignore
    if (!syncScroll || scrollingSource.current === 'editor') {
      return;
    }

    if (scrollingSource.current === null) {
      scrollingSource.current = 'preview';
    }

    // Reset the active source lock after user stops scrolling
    if (clearSourceTimer.current) clearTimeout(clearSourceTimer.current);
    clearSourceTimer.current = window.setTimeout(() => {
      scrollingSource.current = null;
    }, 250);

    if (syncScrollRaf.current) cancelAnimationFrame(syncScrollRaf.current);
    syncScrollRaf.current = requestAnimationFrame(() => {
      const editor = editorRef.current;
      const preview = previewRef.current;
      if (!editor || !preview) return;

      const editorMax = editor.scrollHeight - editor.clientHeight;
      const previewMax = preview.scrollHeight - preview.clientHeight;

      if (editorMax > 0 && previewMax > 0) {
        const scrollRatio = preview.scrollTop / previewMax;
        editor.scrollTop = Math.round(scrollRatio * editorMax);
        if (lineNumbersRef.current) {
          lineNumbersRef.current.scrollTop = editor.scrollTop;
        }
      }
    });
  };

  // Undo / Redo helpers
  const handleUndo = useCallback(() => {
    if (historyIdx > 0) {
      isHistoryUpdate.current = true;
      const nextIdx = historyIdx - 1;
      setHistoryIdx(nextIdx);
      setContent(history[nextIdx]);
    }
  }, [history, historyIdx]);

  const handleRedo = useCallback(() => {
    if (historyIdx < history.length - 1) {
      isHistoryUpdate.current = true;
      const nextIdx = historyIdx + 1;
      setHistoryIdx(nextIdx);
      setContent(history[nextIdx]);
    }
  }, [history, historyIdx]);

  // Toolbar Formatting helper
  const insertFormatting = (prefix: string, suffix: string = '', defaultPlaceholder: string = '') => {
    const textarea = editorRef.current;
    if (!textarea) return;

    scrollingSource.current = 'editor';
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.substring(start, end);
    const replacement = selectedText ? `${prefix}${selectedText}${suffix}` : `${prefix}${defaultPlaceholder}${suffix}`;

    const newContent = content.substring(0, start) + replacement + content.substring(end);
    setContent(newContent);

    // Keep cursor inside replacement
    setTimeout(() => {
      textarea.focus();
      const newCursorPos = selectedText ? start + replacement.length : start + prefix.length + defaultPlaceholder.length;
      textarea.setSelectionRange(
        selectedText ? start + prefix.length : start + prefix.length,
        newCursorPos
      );
    }, 0);
  };

  const insertLinePrefix = (prefix: string) => {
    const textarea = editorRef.current;
    if (!textarea) return;

    scrollingSource.current = 'editor';
    const start = textarea.selectionStart;
    const beforeCursor = content.substring(0, start);
    const lastNewline = beforeCursor.lastIndexOf('\n');
    const lineStart = lastNewline === -1 ? 0 : lastNewline + 1;

    const newContent = content.substring(0, lineStart) + prefix + content.substring(lineStart);
    setContent(newContent);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, start + prefix.length);
    }, 0);
  };

  const insertTable = () => {
    const tableTemplate = `\n| Column 1 | Column 2 | Column 3 |\n| :--- | :--- | :--- |\n| Data 1 | Data 2 | Data 3 |\n| Data 4 | Data 5 | Data 6 |\n\n`;
    insertFormatting(tableTemplate);
  };

  // Keyboard shortcut handlers
  const handleKeyDown = (e: KeyboardEvent) => {
    scrollingSource.current = 'editor';

    // Tab key support
    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = editorRef.current;
      if (!textarea) return;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newContent = content.substring(0, start) + '  ' + content.substring(end);
      setContent(newContent);
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 2;
      }, 0);
      return;
    }

    // Ctrl / Cmd shortcuts
    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'b' || e.key === 'B') {
        e.preventDefault();
        insertFormatting('**', '**', 'bold text');
      } else if (e.key === 'i' || e.key === 'I') {
        e.preventDefault();
        insertFormatting('*', '*', 'italic text');
      } else if (e.key === 'k' || e.key === 'K') {
        e.preventDefault();
        insertFormatting('[', '](https://example.com)', 'link text');
      } else if (e.key === 'z' || e.key === 'Z') {
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

  // File Upload / Drop handler
  const handleFileUpload = (e: Event) => {
    const target = e.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (typeof text === 'string') {
        setContent(text);
        setFileName(file.name);
        try {
          localStorage.setItem('magictools_markdown_filename', file.name);
        } catch {}
        (window as any).__magictools_toast?.({
          type: 'success',
          title: 'File Opened',
          message: `Loaded ${file.name} successfully!`,
        });
      }
    };
    reader.readAsText(file);
    target.value = '';
  };

  // Export as Markdown
  const exportMarkdown = () => {
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const name = fileName.endsWith('.md') ? fileName : `${fileName}.md`;
    downloadBlob(blob, name);
    setShowExportMenu(false);
    (window as any).__magictools_toast?.({
      type: 'success',
      title: 'Downloaded Markdown',
      message: `Saved as ${name}`,
    });
  };

  // Copy Markdown to Clipboard
  const copyMarkdown = async () => {
    try {
      await navigator.clipboard.writeText(content);
      (window as any).__magictools_toast?.({
        type: 'success',
        title: 'Markdown Copied',
        message: 'Raw Markdown copied to your clipboard!',
      });
    } catch {
      (window as any).__magictools_toast?.({
        type: 'error',
        title: 'Copy Failed',
        message: 'Please allow clipboard permissions.',
      });
    }
  };

  // Clear Document
  const handleClear = () => {
    if (content.trim().length > 0) {
      if (confirm('Are you sure you want to clear the editor? Unsaved text will be erased.')) {
        setContent('');
        (window as any).__magictools_toast?.({
          type: 'info',
          title: 'Editor Cleared',
          message: 'Started a fresh blank document.',
        });
      }
    }
  };

  // Fullscreen toggle
  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  return (
    <div
      ref={containerRef}
      class={`flex flex-col rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm transition-all duration-200 overflow-clip ${
        isFullscreen
          ? 'fixed inset-0 z-50 rounded-none border-none h-screen w-screen p-2 sm:p-4 bg-neutral-100/90 dark:bg-neutral-950/95 backdrop-blur-md'
          : 'w-full h-[760px] max-h-[85vh] min-h-[560px]'
      }`}
    >
      {/* ── Sticky Header & Formatting Tools Wrapper ── */}
      <div class={`sticky ${isFullscreen ? 'top-0' : 'top-14'} z-20 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md rounded-t-2xl border-b border-neutral-200 dark:border-neutral-800 shadow-2xs`}>
        
        {/* Top Header Bar: File name, View Mode Switcher & Global Actions */}
        <div class="px-3 sm:px-4 py-2 flex flex-col md:flex-row md:items-center md:justify-between gap-2 border-b border-neutral-100 dark:border-neutral-800/60">
          
          {/* Row 1 on mobile (Left side on desktop): File name & Actions on mobile */}
          <div class="flex items-center justify-between gap-2 w-full md:w-auto flex-nowrap">
            {/* File name & Saved status */}
            <div class="flex items-center gap-1.5 sm:gap-2 min-w-0">
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
                {isEditingFileName ? (
                  <input
                    type="text"
                    value={fileName}
                    onInput={(e) => setFileName((e.target as HTMLInputElement).value)}
                    onBlur={() => {
                      setIsEditingFileName(false);
                      try {
                        localStorage.setItem('magictools_markdown_filename', fileName);
                      } catch {}
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        setIsEditingFileName(false);
                        try {
                          localStorage.setItem('magictools_markdown_filename', fileName);
                        } catch {}
                      }
                    }}
                    autoFocus
                    class="px-2 py-0.5 text-xs sm:text-sm font-semibold rounded-md bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 text-neutral-900 dark:text-white outline-none w-28 sm:w-44 transition-colors"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsEditingFileName(true)}
                    class="text-xs sm:text-sm font-bold text-neutral-800 dark:text-neutral-200 hover:text-brand-600 dark:hover:text-brand-400 truncate max-w-[120px] sm:max-w-[200px] text-left flex items-center gap-1 group transition-colors min-w-0"
                    title="Click to rename document"
                  >
                    <span class="truncate">{fileName}</span>
                    <svg class="w-3 h-3 sm:w-3.5 sm:h-3.5 opacity-0 group-hover:opacity-100 text-neutral-400 transition-opacity flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/>
                    </svg>
                  </button>
                )}

                {/* Auto-saved badge (compact dot on mobile, pill on tablet/desktop) */}
                <span class="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex-shrink-0">
                  <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span>Saved locally</span>
                </span>
                <span class="sm:hidden w-2 h-2 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" title="Saved locally"></span>
              </div>
            </div>

            {/* Actions on Mobile (Pinned to top right row 1) */}
            <div class="flex md:hidden items-center gap-1 flex-shrink-0">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept=".md,.markdown,.txt"
                class="hidden"
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                class="p-1.5 rounded-lg text-xs font-semibold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors flex items-center justify-center"
                title="Open a Markdown (.md) or text file"
              >
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
                </svg>
              </button>

              <div class="relative">
                <button
                  type="button"
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  class="px-2.5 py-1 rounded-lg text-xs font-semibold bg-brand-600 hover:bg-brand-700 text-white shadow-xs flex items-center gap-1 transition-colors"
                >
                  <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                  </svg>
                  <span>Export</span>
                  <svg class="w-3 h-3 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
                  </svg>
                </button>

                {showExportMenu && (
                  <div
                    class="absolute right-0 mt-1 w-44 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-xl z-30 p-1.5 flex flex-col gap-1 text-xs font-medium animate-in fade-in zoom-in-95 duration-100"
                  >
                    <button
                      type="button"
                      onClick={exportMarkdown}
                      class="w-full px-2.5 py-1.5 rounded-lg text-left text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center gap-2"
                    >
                      <span class="text-indigo-500 font-mono font-bold">.md</span>
                      <span>Download Markdown</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        copyMarkdown();
                        setShowExportMenu(false);
                      }}
                      class="w-full px-2.5 py-1.5 rounded-lg text-left text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center gap-2"
                    >
                      <svg class="w-3.5 h-3.5 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"/>
                      </svg>
                      <span>Copy Markdown</span>
                    </button>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={toggleFullscreen}
                class="p-1.5 rounded-lg text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
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

          {/* Row 2 on mobile (Center on desktop): View Mode Segmented Switcher */}
          <div class="w-full md:w-auto flex items-center justify-center">
            <div class="w-full sm:w-auto flex items-center bg-neutral-100 dark:bg-neutral-800 p-0.5 rounded-xl border border-neutral-200/80 dark:border-neutral-700/80 text-xs font-semibold shadow-2xs">
              <button
                type="button"
                onClick={() => setViewMode('edit')}
                class={`flex-1 sm:flex-initial justify-center flex items-center gap-1 px-3 py-1.5 sm:py-1 rounded-lg transition-all ${
                  viewMode === 'edit'
                    ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-xs'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                }`}
                title="Edit mode only"
              >
                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                </svg>
                <span>Edit</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode('preview')}
                class={`flex-1 sm:flex-initial justify-center flex items-center gap-1 px-3 py-1.5 sm:py-1 rounded-lg transition-all ${
                  viewMode === 'preview'
                    ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-xs'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                }`}
                title="Preview mode only"
              >
                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                </svg>
                <span>Preview</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode('split')}
                class={`flex-1 sm:flex-initial justify-center flex items-center gap-1 px-3 py-1.5 sm:py-1 rounded-lg transition-all ${
                  viewMode === 'split'
                    ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-xs'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                }`}
                title="Side-by-side split screen"
              >
                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 3v18M3 9h18M3 15h18M4 3h16a1 1 0 011 1v16a1 1 0 01-1 1H4a1 1 0 01-1-1V4a1 1 0 011-1z"/>
                </svg>
                <span>Split</span>
              </button>
            </div>
          </div>

          {/* Right Actions on Desktop (Hidden on mobile) */}
          <div class="hidden md:flex items-center gap-1 sm:gap-1.5 flex-shrink-0">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              class="px-2.5 py-1 rounded-lg text-xs font-semibold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors flex items-center gap-1"
              title="Open a Markdown (.md) or text file"
            >
              <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
              </svg>
              <span>Open</span>
            </button>

            <div class="relative">
              <button
                type="button"
                onClick={() => setShowExportMenu(!showExportMenu)}
                class="px-3 py-1 rounded-lg text-xs font-semibold bg-brand-600 hover:bg-brand-700 text-white shadow-xs flex items-center gap-1.5 transition-colors"
              >
                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                </svg>
                <span>Export</span>
                <svg class="w-3 h-3 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
                </svg>
              </button>

              {showExportMenu && (
                <div
                  class="absolute right-0 mt-1 w-44 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-xl z-30 p-1.5 flex flex-col gap-1 text-xs font-medium animate-in fade-in zoom-in-95 duration-100"
                >
                  <button
                    type="button"
                    onClick={exportMarkdown}
                    class="w-full px-2.5 py-1.5 rounded-lg text-left text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center gap-2"
                  >
                    <span class="text-indigo-500 font-mono font-bold">.md</span>
                    <span>Download Markdown</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      copyMarkdown();
                      setShowExportMenu(false);
                    }}
                    class="w-full px-2.5 py-1.5 rounded-lg text-left text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center gap-2"
                  >
                    <svg class="w-3.5 h-3.5 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"/>
                    </svg>
                    <span>Copy Markdown</span>
                  </button>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={toggleFullscreen}
              class="p-1.5 rounded-lg text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
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

        {/* ── Formatting Toolbar (Heading Tools: H1, H2, H3, etc.) ── */}
        <div class="px-2 sm:px-3 py-1.5 flex items-center gap-1 overflow-x-auto no-scrollbar select-none">
          
          {/* Undo / Redo */}
          <button
            type="button"
            onClick={handleUndo}
            disabled={historyIdx <= 0}
            class="p-1.5 rounded-md text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-30 disabled:pointer-events-none transition-colors"
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
            class="p-1.5 rounded-md text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-30 disabled:pointer-events-none transition-colors"
            title="Redo (Ctrl+Y)"
          >
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 10H11a5 5 0 00-5 5v2m15-7l-6-6m6 6l-6 6"/>
            </svg>
          </button>

          <div class="h-4 w-px bg-neutral-200 dark:bg-neutral-700 mx-1 flex-shrink-0"></div>

          {/* Heading Tools: H1, H2, H3 */}
          <button
            type="button"
            onClick={() => insertLinePrefix('# ')}
            class="px-2 py-1 rounded-md text-xs font-bold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            title="Heading 1"
          >
            H1
          </button>
          <button
            type="button"
            onClick={() => insertLinePrefix('## ')}
            class="px-2 py-1 rounded-md text-xs font-bold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            title="Heading 2"
          >
            H2
          </button>
          <button
            type="button"
            onClick={() => insertLinePrefix('### ')}
            class="px-2 py-1 rounded-md text-xs font-bold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            title="Heading 3"
          >
            H3
          </button>

          <div class="h-4 w-px bg-neutral-200 dark:bg-neutral-700 mx-1 flex-shrink-0"></div>

          {/* Basic Text Formats: Bold, Italic, Strikethrough */}
          <button
            type="button"
            onClick={() => insertFormatting('**', '**', 'bold text')}
            class="p-1.5 rounded-md text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors font-bold"
            title="Bold (Ctrl+B)"
          >
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 4h8a4 4 0 014 4 4 4 0 01-4 4H6zM6 12h9a4 4 0 014 4 4 4 0 01-4 4H6z"/>
            </svg>
          </button>
          <button
            type="button"
            onClick={() => insertFormatting('*', '*', 'italic text')}
            class="p-1.5 rounded-md text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors italic"
            title="Italic (Ctrl+I)"
          >
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <line x1="19" y1="4" x2="10" y2="4" stroke-width="2"/>
              <line x1="14" y1="20" x2="5" y2="20" stroke-width="2"/>
              <line x1="15" y1="4" x2="9" y2="20" stroke-width="2"/>
            </svg>
          </button>
          <button
            type="button"
            onClick={() => insertFormatting('~~', '~~', 'strikethrough text')}
            class="p-1.5 rounded-md text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            title="Strikethrough"
          >
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 4H9a3 3 0 000 6h6a3 3 0 010 6H8M4 12h16"/>
            </svg>
          </button>

          <div class="h-4 w-px bg-neutral-200 dark:bg-neutral-700 mx-1 flex-shrink-0"></div>

          {/* Quotes & Code */}
          <button
            type="button"
            onClick={() => insertLinePrefix('> ')}
            class="p-1.5 rounded-md text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            title="Blockquote"
          >
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
            </svg>
          </button>
          <button
            type="button"
            onClick={() => insertFormatting('`', '`', 'code')}
            class="p-1.5 rounded-md text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors font-mono text-xs"
            title="Inline Code"
          >
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"/>
            </svg>
          </button>
          <button
            type="button"
            onClick={() => insertFormatting('```\n', '\n```', 'code block')}
            class="px-1.5 py-1 rounded-md text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors font-mono text-[11px]"
            title="Fenced Code Block"
          >
            &lt;/&gt;
          </button>

          <div class="h-4 w-px bg-neutral-200 dark:bg-neutral-700 mx-1 flex-shrink-0"></div>

          {/* Lists & Checklist */}
          <button
            type="button"
            onClick={() => insertLinePrefix('- ')}
            class="p-1.5 rounded-md text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            title="Bullet List"
          >
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16M2 6h.01M2 12h.01M2 18h.01"/>
            </svg>
          </button>
          <button
            type="button"
            onClick={() => insertLinePrefix('1. ')}
            class="p-1.5 rounded-md text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            title="Numbered List"
          >
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 6h13M7 12h13M7 18h13M3 6h1v4H3m0 8h2m-2-4h2"/>
            </svg>
          </button>
          <button
            type="button"
            onClick={() => insertLinePrefix('- [ ] ')}
            class="p-1.5 rounded-md text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            title="Task Checklist"
          >
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/>
            </svg>
          </button>

          <div class="h-4 w-px bg-neutral-200 dark:bg-neutral-700 mx-1 flex-shrink-0"></div>

          {/* Link, Table, Horizontal Rule */}
          <button
            type="button"
            onClick={() => insertFormatting('[', '](https://example.com)', 'link text')}
            class="p-1.5 rounded-md text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            title="Insert Link (Ctrl+K)"
          >
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/>
            </svg>
          </button>
          <button
            type="button"
            onClick={insertTable}
            class="p-1.5 rounded-md text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            title="Insert Table"
          >
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M3 14h18M10 3v18M14 3v18M4 3h16a1 1 0 011 1v16a1 1 0 01-1 1H4a1 1 0 01-1-1V4a1 1 0 011-1z"/>
            </svg>
          </button>
          <button
            type="button"
            onClick={() => insertLinePrefix('\n---\n\n')}
            class="p-1.5 rounded-md text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            title="Horizontal Rule"
          >
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h14"/>
            </svg>
          </button>

          {/* Right side of toolbar: Sync scroll switch & Clear */}
          <div class="ml-auto flex items-center gap-2 pl-2">
            {viewMode === 'split' && (
              <label class="hidden sm:flex items-center gap-1.5 text-[11px] text-neutral-600 dark:text-neutral-400 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={syncScroll}
                  onChange={(e) => setSyncScroll((e.target as HTMLInputElement).checked)}
                  class="w-3.5 h-3.5 rounded accent-brand-600"
                />
                <span class={syncScroll ? 'text-brand-600 dark:text-brand-400 font-semibold' : ''}>Sync Scroll</span>
              </label>
            )}

            <button
              type="button"
              onClick={handleClear}
              class="px-2 py-0.5 rounded text-[11px] font-medium text-neutral-500 hover:text-red-600 dark:text-neutral-400 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
              title="Clear editor"
            >
              Clear
            </button>
          </div>
        </div>
      </div>

      {/* ── Main Workspace: Split or Single View (Constrained & Flex Scrollable) ── */}
      <div class="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden">
        
        {/* ── Left Side: Markdown Text Editor ── */}
        {(viewMode === 'edit' || viewMode === 'split') && (
          <div
            onMouseEnter={() => { scrollingSource.current = 'editor'; }}
            onTouchStart={() => { scrollingSource.current = 'editor'; }}
            onWheel={() => { scrollingSource.current = 'editor'; }}
            class={`relative flex-1 min-h-0 flex flex-col h-full ${
              viewMode === 'split'
                ? 'w-full md:w-1/2 border-b md:border-b-0 md:border-r border-neutral-200 dark:border-neutral-800'
                : 'w-full'
            }`}
          >
            {/* Editor Pane Subheader */}
            <div class="px-3 py-1.5 bg-neutral-50/90 dark:bg-neutral-900/90 border-b border-neutral-200/60 dark:border-neutral-800/60 flex items-center justify-between text-[11px] font-medium text-neutral-500 dark:text-neutral-400 flex-shrink-0">
              <div class="flex items-center gap-1.5">
                <span class="w-2 h-2 rounded-full bg-brand-500"></span>
                <span class="font-semibold text-neutral-700 dark:text-neutral-300">Markdown Input</span>
              </div>
            </div>

            {/* Textarea + Line Numbers */}
            <div class="relative flex-1 min-h-0 flex h-full overflow-hidden bg-white dark:bg-neutral-950 font-mono text-xs sm:text-sm">
              {/* Line Numbers Gutter */}
              <div
                ref={lineNumbersRef}
                class="hidden sm:block select-none py-3 pl-2 pr-2.5 text-right font-mono text-xs text-neutral-300 dark:text-neutral-700 bg-neutral-50/50 dark:bg-neutral-950/50 border-r border-neutral-100 dark:border-neutral-900 overflow-hidden flex-shrink-0"
                style={{ width: '3rem' }}
                aria-hidden="true"
              >
                {Array.from({ length: Math.max(1, stats.lines) }).map((_, i) => (
                  <div key={i} class="leading-6">
                    {i + 1}
                  </div>
                ))}
              </div>

              {/* Textarea without rogue focus borders */}
              <textarea
                ref={editorRef}
                value={content}
                onInput={(e) => {
                  scrollingSource.current = 'editor';
                  setContent((e.target as HTMLTextAreaElement).value);
                }}
                onScroll={handleEditorScroll}
                onKeyDown={(e) => {
                  scrollingSource.current = 'editor';
                  handleKeyDown(e);
                }}
                placeholder="Type or paste your Markdown here... You can also drag and drop a .md file."
                class="markdown-editor-textarea flex-1 min-h-0 h-full p-3 leading-6 bg-transparent text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-600 resize-none border-0 outline-none focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 shadow-none focus:shadow-none overflow-y-auto"
                spellcheck={false}
              />
            </div>
          </div>
        )}

        {/* ── Right Side: Live Rendered Preview ── */}
        {(viewMode === 'preview' || viewMode === 'split') && (
          <div
            onMouseEnter={() => { scrollingSource.current = 'preview'; }}
            onTouchStart={() => { scrollingSource.current = 'preview'; }}
            onWheel={() => { scrollingSource.current = 'preview'; }}
            class={`relative flex-1 min-h-0 flex flex-col h-full ${
              viewMode === 'split' ? 'w-full md:w-1/2' : 'w-full'
            } bg-neutral-50/30 dark:bg-neutral-900/30`}
          >
            {/* Preview Pane Subheader */}
            <div class="px-3 py-1.5 bg-neutral-50/90 dark:bg-neutral-900/90 border-b border-neutral-200/60 dark:border-neutral-800/60 flex items-center gap-1.5 text-[11px] font-medium text-neutral-500 dark:text-neutral-400 flex-shrink-0">
              <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span class="font-semibold text-neutral-700 dark:text-neutral-300">Live Preview</span>
            </div>

            {/* Rendered HTML Container with synchronous scrolling */}
            <div
              ref={previewRef}
              onScroll={handlePreviewScroll}
              class="flex-1 min-h-0 h-full p-4 sm:p-6 overflow-y-auto markdown-preview"
            >
              {content.trim() ? (
                <div dangerouslySetInnerHTML={{ __html: renderedHtml }} />
              ) : (
                <div class="h-full flex flex-col items-center justify-center text-center text-neutral-400 dark:text-neutral-600 py-16">
                  <svg class="w-10 h-10 mb-2 opacity-50 stroke-current" fill="none" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                  </svg>
                  <p class="text-sm font-medium">Preview is empty</p>
                  <p class="text-xs mt-1">Start typing Markdown in the editor to see it formatted here.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Bottom Status & Live Statistics Bar ── */}
      <div class="px-3 sm:px-4 py-2 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50/80 dark:bg-neutral-900/80 rounded-b-2xl flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400 flex-shrink-0">
        
        {/* Statistics */}
        <div class="flex items-center gap-3 sm:gap-4 flex-wrap">
          <div class="flex items-center gap-1 font-mono">
            <span class="font-semibold text-neutral-800 dark:text-neutral-200">{stats.words}</span>
            <span class="text-[11px]">words</span>
          </div>
          <div class="flex items-center gap-1 font-mono">
            <span class="font-semibold text-neutral-800 dark:text-neutral-200">{stats.characters}</span>
            <span class="text-[11px]">chars</span>
          </div>
          <div class="flex items-center gap-1 font-mono">
            <span class="font-semibold text-neutral-800 dark:text-neutral-200">{stats.lines}</span>
            <span class="text-[11px]">lines</span>
          </div>
          <div class="hidden sm:flex items-center gap-1 font-mono">
            <span class="font-semibold text-neutral-800 dark:text-neutral-200">{stats.readingTime}</span>
            <span class="text-[11px]">min read</span>
          </div>
        </div>
      </div>
    </div>
  );
}
