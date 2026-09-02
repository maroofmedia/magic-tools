/** @jsxImportSource preact */
/**
 * SearchBar.tsx — Instant live tool search with keyboard navigation
 */
import { useState, useEffect, useRef } from 'preact/hooks';
import { TOOLS } from '@/utils/tools-config';
import { debounce } from '@/utils/helpers';
import type { ToolConfig } from '@/types/index';

export default function SearchBar() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ToolConfig[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const search = debounce((q: string) => {
    if (!q.trim()) {
      setResults([]);
      setIsOpen(false);
      return;
    }
    const lower = q.toLowerCase().trim();
    const filtered = TOOLS.filter(
      (t) =>
        t.name.toLowerCase().includes(lower) ||
        t.description.toLowerCase().includes(lower) ||
        t.category.toLowerCase().includes(lower) ||
        t.acceptedExtensions.some((e) => e.toLowerCase().includes(lower))
    );
    setResults(filtered);
    setIsOpen(true);
    setActiveIdx(-1);
  }, 150);

  useEffect(() => {
    search(query);
  }, [query]);

  // Global hotkey: press '/' or 'Ctrl+K' to focus search
  useEffect(() => {
    function onGlobalKey(e: KeyboardEvent) {
      if (
        (e.key === '/' || ((e.ctrlKey || e.metaKey) && e.key === 'k')) &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    }
    window.addEventListener('keydown', onGlobalKey);
    return () => window.removeEventListener('keydown', onGlobalKey);
  }, []);

  function handleKeyDown(e: KeyboardEvent) {
    if (!isOpen) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, -1));
    } else if (e.key === 'Enter' && activeIdx >= 0 && results[activeIdx]) {
      window.location.href = `/tools/${results[activeIdx].slug}`;
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      inputRef.current?.blur();
    }
  }

  return (
    <div class="relative w-full max-w-2xl mx-auto" role="search">
      <div class="relative flex items-center">
        {/* Search icon */}
        <div class="absolute left-4.5 text-neutral-400 pointer-events-none flex items-center">
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
        </div>

        <input
          ref={inputRef}
          type="search"
          id="tool-search"
          value={query}
          onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
          onKeyDown={handleKeyDown}
          onFocus={() => query.trim() && setIsOpen(true)}
          onBlur={() => setTimeout(() => setIsOpen(false), 200)}
          placeholder="Search tools (e.g. compress, convert, merge PDF, image to PDF)..."
          autocomplete="off"
          aria-label="Search tools"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-activedescendant={activeIdx >= 0 ? `result-${activeIdx}` : undefined}
          class="w-full pl-11 pr-16 py-2.5 sm:py-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-500 focus:border-brand-500 dark:focus:border-brand-400 focus:ring-3 focus:ring-brand-500/10 focus:outline-none shadow-2xs dark:shadow-neutral-950/40 text-sm transition-all duration-150"
        />

        {/* Right action pills (Clear & Keyboard Shortcut) */}
        <div class="absolute right-2.5 flex items-center gap-1.5">
          {query ? (
            <button
              type="button"
              onClick={() => { setQuery(''); setIsOpen(false); inputRef.current?.focus(); }}
              aria-label="Clear search query"
              class="w-5 h-5 flex items-center justify-center rounded-md text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors text-xs"
            >
              ✕
            </button>
          ) : (
            <kbd class="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono font-medium text-neutral-400 dark:text-neutral-500 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200/80 dark:border-neutral-700/60 rounded">
              /
            </kbd>
          )}
        </div>
      </div>

      {/* Dropdown results */}
      {isOpen && (
        <ul
          ref={listRef}
          id="search-results"
          role="listbox"
          aria-label="Search results"
          class="absolute top-full left-0 right-0 mt-1.5 bg-white/95 dark:bg-neutral-900/95 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-xl glass overflow-hidden z-50 animate-scale-in max-h-80 overflow-y-auto"
        >
          {results.length === 0 ? (
            <li class="px-4 py-6 text-center text-neutral-500 dark:text-neutral-400 text-xs">
              <p class="font-medium text-neutral-700 dark:text-neutral-300 mb-0.5">No tools found for "{query}"</p>
              <p class="text-neutral-400">Try searching for "PDF", "image", "compress", or "convert".</p>
            </li>
          ) : (
            results.map((tool, idx) => (
              <li
                key={tool.slug}
                id={`result-${idx}`}
                role="option"
                aria-selected={activeIdx === idx}
                class="border-b last:border-b-0 border-neutral-100 dark:border-neutral-800/60"
              >
                <a
                  href={`/tools/${tool.slug}`}
                  class={`flex items-center gap-3 px-3.5 py-2.5 transition-colors ${activeIdx === idx ? 'bg-brand-50 dark:bg-brand-950/60' : 'hover:bg-neutral-50 dark:hover:bg-neutral-800/60'}`}
                >
                  <span class="text-lg flex-shrink-0 w-8 h-8 rounded-lg bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center" aria-hidden="true">
                    {tool.icon}
                  </span>
                  <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-1.5">
                      <p class="text-xs font-semibold text-neutral-900 dark:text-neutral-100 truncate">{tool.name}</p>
                      <span class={`text-[9px] font-semibold px-1.5 py-0.2 rounded uppercase tracking-wider ${tool.category === 'image' ? 'bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 border border-purple-200/50 dark:border-purple-800/40' : 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-200/50 dark:border-blue-800/40'}`}>
                        {tool.category}
                      </span>
                    </div>
                    <p class="text-[11px] text-neutral-500 dark:text-neutral-400 truncate">{tool.description}</p>
                  </div>
                  <div class="flex items-center gap-1 flex-shrink-0">
                    {tool.acceptedExtensions.slice(0, 2).map(ext => (
                      <span class="text-[10px] font-mono text-neutral-400 dark:text-neutral-500 bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded">
                        {ext}
                      </span>
                    ))}
                    <svg class="w-4 h-4 text-neutral-400 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </a>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
