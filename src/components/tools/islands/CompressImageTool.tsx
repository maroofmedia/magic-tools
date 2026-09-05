/** @jsxImportSource preact */
import { useState, useEffect } from 'preact/hooks';
import ToolProcessor from '@/components/tools/ToolProcessor';
import { compressImages } from '@/lib/image/compress';
import { formatTargetSize } from '@/utils/helpers';
import type { ToolConfig } from '@/types/index';

interface Props { tool: ToolConfig }

// Quick Presets in KB (200 KB, 500 KB, 1 MB, 2 MB, 5 MB)
const SIZE_PRESETS_KB = [200, 500, 1024, 2048, 5120];

export default function CompressImageTool({ tool }: Props) {
  const [customUnit, setCustomUnit] = useState<'KB' | 'MB'>('KB');
  const [customValue, setCustomValue] = useState<string>('500');

  return (
    <ToolProcessor
      tool={tool}
      defaultOptions={{ targetSizeKB: 500 }}
      optionsRenderer={(_files, options, setOptions) => {
        const currentKB = (options.targetSizeKB as number) || 500;

        // Keep customValue in sync when changed via presets or slider
        function updateTargetSize(newKB: number) {
          const clamped = Math.max(10, Math.min(51200, newKB));
          setOptions({ ...options, targetSizeKB: clamped });
          if (customUnit === 'MB') {
            const mb = clamped / 1024;
            setCustomValue(Number.isInteger(mb) ? String(mb) : String(parseFloat(mb.toFixed(2))));
          } else {
            setCustomValue(String(Math.round(clamped)));
          }
        }

        function handleCustomValueChange(valStr: string, unit: 'KB' | 'MB') {
          setCustomValue(valStr);
          const num = parseFloat(valStr);
          if (!isNaN(num) && num > 0) {
            const kb = unit === 'MB' ? Math.round(num * 1024) : Math.round(num);
            setOptions({ ...options, targetSizeKB: Math.max(10, Math.min(51200, kb)) });
          }
        }

        function handleUnitChange(newUnit: 'KB' | 'MB') {
          setCustomUnit(newUnit);
          if (newUnit === 'MB') {
            const mb = currentKB / 1024;
            setCustomValue(Number.isInteger(mb) ? String(mb) : String(parseFloat(mb.toFixed(2))));
          } else {
            setCustomValue(String(Math.round(currentKB)));
          }
        }

        return (
          <div class="space-y-4">
            {/* Header / Target indicator */}
            <div class="flex items-center justify-between">
              <label class="text-xs sm:text-sm font-semibold text-neutral-800 dark:text-neutral-200">
                Target Maximum Size: <span class="text-brand-600 dark:text-brand-400 font-mono font-bold">{formatTargetSize(currentKB)}</span>
              </label>
            </div>

            {/* Quick Preset Buttons */}
            <div class="space-y-1.5">
              <span class="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                Quick Presets:
              </span>
              <div class="flex flex-wrap gap-1.5">
                {SIZE_PRESETS_KB.map((kb) => (
                  <button
                    key={kb}
                    type="button"
                    onClick={() => updateTargetSize(kb)}
                    class={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                      Math.abs(currentKB - kb) < 5
                        ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400 shadow-xs'
                        : 'border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:border-neutral-300'
                    }`}
                  >
                    {formatTargetSize(kb)}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Target Size Box */}
            <div class="p-3 sm:p-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200/80 dark:border-neutral-700/60 space-y-2">
              <label for="custom-size-input" class="block text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                Custom Target Size:
              </label>
              <div class="flex items-center gap-2">
                <input
                  id="custom-size-input"
                  type="number"
                  min="1"
                  step={customUnit === 'MB' ? '0.1' : '10'}
                  value={customValue}
                  onInput={(e) => handleCustomValueChange((e.target as HTMLInputElement).value, customUnit)}
                  placeholder={customUnit === 'MB' ? 'e.g. 1.5' : 'e.g. 500'}
                  class="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-xs sm:text-sm font-mono placeholder-neutral-400 focus:border-brand-500 focus:outline-none"
                />

                {/* Unit Switcher: KB / MB */}
                <div class="flex rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 p-0.5 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => handleUnitChange('KB')}
                    class={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                      customUnit === 'KB'
                        ? 'bg-white dark:bg-neutral-700 text-brand-600 dark:text-brand-400 shadow-xs'
                        : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                    }`}
                  >
                    KB
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUnitChange('MB')}
                    class={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                      customUnit === 'MB'
                        ? 'bg-white dark:bg-neutral-700 text-brand-600 dark:text-brand-400 shadow-xs'
                        : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                    }`}
                  >
                    MB
                  </button>
                </div>
              </div>
            </div>

            {/* Range Slider */}
            <div class="space-y-1">
              <input
                id="target-size-slider"
                type="range"
                min="50"
                max="10240"
                step="25"
                value={currentKB}
                onInput={(e) => updateTargetSize(parseInt((e.target as HTMLInputElement).value, 10))}
                class="w-full accent-brand-600 cursor-pointer"
              />
              <div class="flex justify-between text-[11px] font-mono text-neutral-400 dark:text-neutral-500">
                <span>50 KB (Smaller file)</span>
                <span>10 MB (Higher quality)</span>
              </div>
            </div>
          </div>
        );
      }}
      processFiles={async (files, options, onProgress) => {
        const targetSizeMB = ((options.targetSizeKB as number) || 500) / 1024;
        return compressImages(files, onProgress, targetSizeMB);
      }}
    />
  );
}
