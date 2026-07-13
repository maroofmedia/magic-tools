/** @jsxImportSource preact */
/**
 * SearchBar.tsx — Live tool search (Preact island)
 * Filters tools client-side without any backend.
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
    const lower = q.toLowerCase();
    const filtered = TOOLS.filter(
      (t) =>
        t.name.toLowerCase().includes(lower) ||
        t.description.toLowerCase().includes(lower) ||
        t.category.toLowerCase().includes(lower) ||
        t.acceptedExtensions.some((e) => e.includes(lower))
    );
    setResults(filtered);
    setIsOpen(true);
    setActiveIdx(-1);
  }, 180);

  useEffect(() => {
    search(query);
  }, [query]);

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
      <div class="relative">
        {/* Search icon */}
        <svg
          class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400"
          fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
        </svg>

        <input
          ref={inputRef}
          type="search"
          id="tool-search"
          value={query}
          onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
          onKeyDown={handleKeyDown}
          onFocus={() => query && setIsOpen(true)}
          onBlur={() => setTimeout(() => setIsOpen(false), 150)}
          placeholder="Search tools — compress, PDF, convert..."
          autocomplete="off"
          aria-label="Search tools"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-activedescendant={activeIdx >= 0 ? `result-${activeIdx}` : undefined}
          class="w-full pl-12 pr-4 py-4 rounded-2xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 focus:border-brand-500 dark:focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20 focus:outline-none shadow-lg shadow-neutral-900/5 dark:shadow-neutral-900/30 text-base transition-all duration-200"
        />

        {query && (
          <button
            type="button"
            onClick={() => { setQuery(''); setIsOpen(false); inputRef.current?.focus(); }}
            aria-label="Clear search"
            class="absolute right-4 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-full text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            ✕
          </button>
        )}
      </div>

      {/* Dropdown results */}
      {isOpen && (
        <ul
          ref={listRef}
          id="search-results"
          role="listbox"
          aria-label="Search results"
          class="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-2xl shadow-xl overflow-hidden z-50 animate-scale-in"
        >
          {results.length === 0 ? (
            <li class="px-4 py-6 text-center text-neutral-500 dark:text-neutral-400 text-sm">
              No tools found for "<strong>{query}</strong>"
            </li>
          ) : (
            results.map((tool, idx) => (
              <li
                key={tool.slug}
                id={`result-${idx}`}
                role="option"
                aria-selected={activeIdx === idx}
              >
                <a
                  href={`/tools/${tool.slug}`}
                  class={`flex items-center gap-3 px-4 py-3 transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800 ${activeIdx === idx ? 'bg-brand-50 dark:bg-brand-950/40' : ''}`}
                >
                  <span class="text-2xl flex-shrink-0" aria-hidden="true">{tool.icon}</span>
                  <div class="min-w-0">
                    <p class="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{tool.name}</p>
                    <p class="text-xs text-neutral-500 dark:text-neutral-400 truncate">{tool.description}</p>
                  </div>
                  <span class={`ml-auto flex-shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${tool.category === 'image' ? 'bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400' : 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400'}`}>
                    {tool.category}
                  </span>
                </a>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
