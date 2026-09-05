/** @jsxImportSource preact */
import { useState } from 'preact/hooks';
import ToolProcessor from '@/components/tools/ToolProcessor';
import { compressPdf } from '@/lib/pdf/compress';
import { formatTargetSize } from '@/utils/helpers';
import type { ToolConfig } from '@/types/index';

interface Props { tool: ToolConfig }

const SIZE_PRESETS_KB = [500, 1024, 2048, 5120];

export default function CompressPdfTool({ tool }: Props) {
  const [customUnit, setCustomUnit] = useState<'KB' | 'MB'>('KB');
  const [customValue, setCustomValue] = useState<string>('1024');

  return (
    <ToolProcessor
      tool={tool}
      defaultOptions={{ targetSizeKB: 1024, customName: '' }}
      optionsRenderer={(_files, options, setOptions) => {
        const currentKB = (options.targetSizeKB as number) || 1024;

        function updateTargetSize(newKB: number) {
          const clamped = Math.max(50, Math.min(51200, newKB));
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
            setOptions({ ...options, targetSizeKB: Math.max(50, Math.min(51200, kb)) });
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
                Desired Maximum Size: <span class="text-brand-600 dark:text-brand-400 font-mono font-bold">{formatTargetSize(currentKB)}</span>
              </label>
            </div>

            {/* Quick Presets */}
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
              <label for="pdf-custom-size" class="block text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                Custom Desired Size:
              </label>
              <div class="flex items-center gap-2">
                <input
                  id="pdf-custom-size"
                  type="number"
                  min="1"
                  step={customUnit === 'MB' ? '0.1' : '50'}
                  value={customValue}
                  onInput={(e) => handleCustomValueChange((e.target as HTMLInputElement).value, customUnit)}
                  placeholder={customUnit === 'MB' ? 'e.g. 2.0' : 'e.g. 1024'}
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

            {/* Slider */}
            <div class="space-y-1">
              <input
                id="pdf-target-size"
                type="range"
                min="100"
                max="10240"
                step="50"
                value={currentKB}
                onInput={(e) => updateTargetSize(parseInt((e.target as HTMLInputElement).value, 10))}
                class="w-full accent-brand-600 cursor-pointer"
              />
              <div class="flex justify-between text-[11px] font-mono text-neutral-400 dark:text-neutral-500">
                <span>100 KB (Smallest file)</span>
                <span>10 MB (Light compression)</span>
              </div>
            </div>

            {/* Optional Rename */}
            <div class="pt-2 border-t border-neutral-100 dark:border-neutral-800">
              <label for="pdf-rename" class="block text-xs font-semibold text-neutral-800 dark:text-neutral-200 mb-1">
                Rename File <span class="text-neutral-400 font-normal">(optional)</span>
              </label>
              <div class="flex items-center gap-2">
                <input
                  id="pdf-rename"
                  type="text"
                  value={(options.customName as string) || ''}
                  onInput={(e) => setOptions({ ...options, customName: (e.target as HTMLInputElement).value })}
                  placeholder="e.g. document-compressed"
                  class="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-xs sm:text-sm placeholder-neutral-400 focus:border-brand-500 focus:outline-none"
                />
                <span class="text-xs font-mono text-neutral-400 flex-shrink-0">.pdf</span>
              </div>
            </div>
          </div>
        );
      }}
      processFiles={async (files, options, onProgress) =>
        compressPdf(
          files[0],
          onProgress,
          { targetSizeKB: options.targetSizeKB as number },
          options.customName as string,
        )
      }
    />
  );
}
