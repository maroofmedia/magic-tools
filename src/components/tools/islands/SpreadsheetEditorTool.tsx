/** @jsxImportSource preact */
import { useState, useEffect, useRef, useCallback } from 'preact/hooks';
import * as XLSX from 'xlsx';
import DropZone from '@/components/tools/DropZone';
import { downloadBlob, formatBytes } from '@/utils/helpers';
import type { ToolConfig } from '@/types/index';

interface Props {
  tool: ToolConfig;
}

type CellValue = string | number | boolean;
type SheetGrid = CellValue[][];

interface HistoryState {
  sheets: Record<string, SheetGrid>;
  activeSheetName: string;
}

// Convert 0-indexed column number to Excel column letters (0 -> A, 25 -> Z, 26 -> AA)
function colIndexToLetter(index: number): string {
  let letter = '';
  let temp = index;
  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  return letter;
}

export default function SpreadsheetEditorTool({ tool }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [customFileName, setCustomFileName] = useState<string>('Spreadsheet.xlsx');
  const [isEditingFileName, setIsEditingFileName] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState(false);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [activeSheet, setActiveSheet] = useState<string>('');
  const [sheetsData, setSheetsData] = useState<Record<string, SheetGrid>>({});
  const [originalSheetsData, setOriginalSheetsData] = useState<Record<string, SheetGrid>>({});

  // History Stack for Global Undo / Redo
  const [history, setHistory] = useState<HistoryState[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  // Selection & Editing State
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>({ row: 0, col: 0 });
  const [editingCell, setEditingCell] = useState<{ row: number; col: number } | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [formulaValue, setFormulaValue] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [showExportMenu, setShowExportMenu] = useState<boolean>(false);
  const [showMobileRowColMenu, setShowMobileRowColMenu] = useState<boolean>(false);

  // Sheet tab renaming state
  const [editingSheetIndex, setEditingSheetIndex] = useState<number | null>(null);
  const [sheetRenameValue, setSheetRenameValue] = useState<string>('');

  const cellInputRef = useRef<HTMLInputElement>(null);
  const formulaInputRef = useRef<HTMLInputElement>(null);
  const fileNameInputRef = useRef<HTMLInputElement>(null);
  const sheetRenameInputRef = useRef<HTMLInputElement>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  // Load sample spreadsheet for instant testing
  function loadSampleData() {
    const sampleSheetName = 'Sales Report';
    const sampleGrid: SheetGrid = [
      ['Region', 'Product Category', 'Units Sold', 'Unit Price ($)', 'Total Revenue ($)', 'Quarter', 'Status'],
      ['North America', 'Electronics', 1420, 299.99, 425985.8, 'Q1 2026', 'Completed'],
      ['Europe', 'Home Appliances', 850, 189.5, 161075.0, 'Q1 2026', 'Completed'],
      ['Asia Pacific', 'Mobile Devices', 3100, 499.0, 1546900.0, 'Q1 2026', 'Completed'],
      ['Latin America', 'Accessories', 2400, 24.99, 59976.0, 'Q1 2026', 'Pending'],
      ['Middle East', 'Electronics', 620, 349.0, 216380.0, 'Q1 2026', 'Completed'],
      ['North America', 'Mobile Devices', 2150, 599.0, 1287850.0, 'Q1 2026', 'Completed'],
      ['Europe', 'Audio Gear', 1100, 129.99, 142989.0, 'Q1 2026', 'Completed'],
      ['Asia Pacific', 'Computers', 980, 899.0, 881020.0, 'Q1 2026', 'In Review'],
    ];

    const paddedGrid = padGrid(sampleGrid, 25, 12);
    const initialSheets = { [sampleSheetName]: paddedGrid };

    setCustomFileName('Sales-Report.xlsx');
    setSheetNames([sampleSheetName]);
    setActiveSheet(sampleSheetName);
    setSheetsData(initialSheets);
    setOriginalSheetsData(JSON.parse(JSON.stringify(initialSheets)));
    setHistory([{ sheets: initialSheets, activeSheetName: sampleSheetName }]);
    setHistoryIndex(0);
    setSelectedCell({ row: 0, col: 0 });
    setFormulaValue(String(paddedGrid[0]?.[0] ?? ''));

    (window as any).__magictools_toast?.({
      type: 'info',
      title: 'Sample Spreadsheet Loaded',
      message: 'Explore cell editing, sheet renaming, formula bar, and undo/redo.',
    });
  }

  // Pad grid to minimum row and column dimensions
  function padGrid(raw: SheetGrid, minRows = 30, minCols = 15): SheetGrid {
    const maxRowLen = raw.reduce((max, r) => Math.max(max, r.length), minCols);
    const targetCols = Math.max(minCols, maxRowLen);
    const targetRows = Math.max(minRows, raw.length);

    const result: SheetGrid = [];
    for (let r = 0; r < targetRows; r++) {
      const row: CellValue[] = [];
      const srcRow = raw[r] || [];
      for (let c = 0; c < targetCols; c++) {
        row.push(srcRow[c] !== undefined ? srcRow[c] : '');
      }
      result.push(row);
    }
    return result;
  }

  // Parse uploaded spreadsheet file
  async function handleFileSelected(files: File[]) {
    if (files.length === 0) return;
    const uploadedFile = files[0];
    setFile(uploadedFile);
    setCustomFileName(uploadedFile.name);
    setIsLoading(true);

    try {
      const buffer = await uploadedFile.arrayBuffer();
      const workbook = XLSX.read(buffer, {
        type: 'array',
        cellDates: true,
        cellNF: true,
      });

      if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        throw new Error('No readable sheets found in this file.');
      }

      const parsedSheets: Record<string, SheetGrid> = {};

      for (const name of workbook.SheetNames) {
        const worksheet = workbook.Sheets[name];
        const rawRows = XLSX.utils.sheet_to_json<CellValue[]>(worksheet, {
          header: 1,
          defval: '',
          raw: false,
        });
        parsedSheets[name] = padGrid(rawRows, 35, 16);
      }

      const firstSheet = workbook.SheetNames[0];
      setSheetNames(workbook.SheetNames);
      setActiveSheet(firstSheet);
      setSheetsData(parsedSheets);
      setOriginalSheetsData(JSON.parse(JSON.stringify(parsedSheets)));
      setHistory([{ sheets: parsedSheets, activeSheetName: firstSheet }]);
      setHistoryIndex(0);
      setSelectedCell({ row: 0, col: 0 });
      setFormulaValue(String(parsedSheets[firstSheet]?.[0]?.[0] ?? ''));

      (window as any).__magictools_toast?.({
        type: 'success',
        title: 'Spreadsheet Loaded',
        message: `Successfully loaded ${workbook.SheetNames.length} sheet${workbook.SheetNames.length > 1 ? 's' : ''} from ${uploadedFile.name}`,
      });
    } catch (err) {
      console.error('Spreadsheet parse error:', err);
      (window as any).__magictools_toast?.({
        type: 'error',
        title: 'Could Not Open Spreadsheet',
        message: err instanceof Error ? err.message : 'Invalid spreadsheet file format.',
      });
    } finally {
      setIsLoading(false);
    }
  }

  // Push new state to history stack
  const pushHistory = useCallback((newSheets: Record<string, SheetGrid>, newActiveSheet: string) => {
    setHistory((prev) => {
      const truncated = prev.slice(0, historyIndex + 1);
      const nextState: HistoryState = {
        sheets: JSON.parse(JSON.stringify(newSheets)),
        activeSheetName: newActiveSheet,
      };
      return [...truncated, nextState];
    });
    setHistoryIndex((prev) => prev + 1);
  }, [historyIndex]);

  // Global Undo
  function handleUndo() {
    if (historyIndex > 0) {
      const targetState = history[historyIndex - 1];
      setSheetsData(JSON.parse(JSON.stringify(targetState.sheets)));
      setActiveSheet(targetState.activeSheetName);
      setHistoryIndex(historyIndex - 1);
      if (selectedCell) {
        const val = targetState.sheets[targetState.activeSheetName]?.[selectedCell.row]?.[selectedCell.col] ?? '';
        setFormulaValue(String(val));
      }
      (window as any).__magictools_toast?.({
        type: 'info',
        title: 'Undo',
        message: 'Reverted last change',
      });
    }
  }

  // Global Redo
  function handleRedo() {
    if (historyIndex < history.length - 1) {
      const targetState = history[historyIndex + 1];
      setSheetsData(JSON.parse(JSON.stringify(targetState.sheets)));
      setActiveSheet(targetState.activeSheetName);
      setHistoryIndex(historyIndex + 1);
      if (selectedCell) {
        const val = targetState.sheets[targetState.activeSheetName]?.[selectedCell.row]?.[selectedCell.col] ?? '';
        setFormulaValue(String(val));
      }
      (window as any).__magictools_toast?.({
        type: 'info',
        title: 'Redo',
        message: 'Restored change',
      });
    }
  }

  // Check if a specific cell was modified from original
  function isCellModified(sheetName: string, row: number, col: number): boolean {
    const currentVal = sheetsData[sheetName]?.[row]?.[col] ?? '';
    const origVal = originalSheetsData[sheetName]?.[row]?.[col] ?? '';
    return String(currentVal) !== String(origVal);
  }

  // Get original value of a cell
  function getOriginalCellValue(sheetName: string, row: number, col: number): CellValue {
    return originalSheetsData[sheetName]?.[row]?.[col] ?? '';
  }

  // Count total modified cells across current sheet
  const currentSheetGrid = sheetsData[activeSheet] || [];
  const modifiedCellsCount = currentSheetGrid.reduce((count, row, r) => {
    return count + row.reduce((cCount, _, c) => cCount + (isCellModified(activeSheet, r, c) ? 1 : 0), 0);
  }, 0);

  // Commit edit to a cell
  function commitCellEdit(row: number, col: number, newValue: string) {
    const currentVal = currentSheetGrid[row]?.[col] ?? '';
    if (String(currentVal) === newValue) {
      setEditingCell(null);
      return;
    }

    const updatedGrid = currentSheetGrid.map((rArr, rIdx) => {
      if (rIdx !== row) return [...rArr];
      const newRow = [...rArr];
      const trimmed = newValue.trim();
      if (trimmed !== '' && !isNaN(Number(trimmed)) && !/^0\d+/.test(trimmed)) {
        newRow[col] = Number(trimmed);
      } else {
        newRow[col] = newValue;
      }
      return newRow;
    });

    const newSheets = { ...sheetsData, [activeSheet]: updatedGrid };
    setSheetsData(newSheets);
    pushHistory(newSheets, activeSheet);
    setFormulaValue(newValue);
    setEditingCell(null);
  }

  // Revert a single individual cell to its original value
  function revertSingleCell(row: number, col: number) {
    const origVal = getOriginalCellValue(activeSheet, row, col);
    const updatedGrid = currentSheetGrid.map((rArr, rIdx) => {
      if (rIdx !== row) return [...rArr];
      const newRow = [...rArr];
      newRow[col] = origVal;
      return newRow;
    });

    const newSheets = { ...sheetsData, [activeSheet]: updatedGrid };
    setSheetsData(newSheets);
    pushHistory(newSheets, activeSheet);
    setFormulaValue(String(origVal));
    setEditingCell(null);

    const cellRef = `${colIndexToLetter(col)}${row + 1}`;
    (window as any).__magictools_toast?.({
      type: 'info',
      title: 'Cell Reverted',
      message: `Cell ${cellRef} restored to original value "${origVal || '(empty)'}"`,
    });
  }

  // Revert all changes in current sheet
  function revertAllChanges() {
    if (!originalSheetsData[activeSheet]) return;
    const restoredSheet = JSON.parse(JSON.stringify(originalSheetsData[activeSheet]));
    const newSheets = { ...sheetsData, [activeSheet]: restoredSheet };
    setSheetsData(newSheets);
    pushHistory(newSheets, activeSheet);
    if (selectedCell) {
      setFormulaValue(String(restoredSheet[selectedCell.row]?.[selectedCell.col] ?? ''));
    }

    (window as any).__magictools_toast?.({
      type: 'success',
      title: 'Sheet Restored',
      message: `All changes in "${activeSheet}" were reverted to original uploaded state.`,
    });
  }

  // Row and Column operations
  function insertRow(above: boolean) {
    if (!selectedCell) return;
    const targetIdx = above ? selectedCell.row : selectedCell.row + 1;
    const colCount = currentSheetGrid[0]?.length || 15;
    const emptyRow: CellValue[] = new Array(colCount).fill('');
    const newGrid = [...currentSheetGrid];
    newGrid.splice(targetIdx, 0, emptyRow);

    const newSheets = { ...sheetsData, [activeSheet]: newGrid };
    setSheetsData(newSheets);
    pushHistory(newSheets, activeSheet);
    setSelectedCell({ row: targetIdx, col: selectedCell.col });
  }

  function deleteRow() {
    if (!selectedCell || currentSheetGrid.length <= 1) return;
    const newGrid = currentSheetGrid.filter((_, idx) => idx !== selectedCell.row);
    const newSheets = { ...sheetsData, [activeSheet]: newGrid };
    setSheetsData(newSheets);
    pushHistory(newSheets, activeSheet);
    const nextRow = Math.min(selectedCell.row, newGrid.length - 1);
    setSelectedCell({ row: nextRow, col: selectedCell.col });
    setFormulaValue(String(newGrid[nextRow]?.[selectedCell.col] ?? ''));
  }

  function insertColumn(left: boolean) {
    if (!selectedCell) return;
    const targetCol = left ? selectedCell.col : selectedCell.col + 1;
    const newGrid = currentSheetGrid.map((r) => {
      const copy = [...r];
      copy.splice(targetCol, 0, '');
      return copy;
    });

    const newSheets = { ...sheetsData, [activeSheet]: newGrid };
    setSheetsData(newSheets);
    pushHistory(newSheets, activeSheet);
    setSelectedCell({ row: selectedCell.row, col: targetCol });
  }

  function deleteColumn() {
    if (!selectedCell || (currentSheetGrid[0]?.length || 0) <= 1) return;
    const newGrid = currentSheetGrid.map((r) => r.filter((_, c) => c !== selectedCell.col));
    const newSheets = { ...sheetsData, [activeSheet]: newGrid };
    setSheetsData(newSheets);
    pushHistory(newSheets, activeSheet);
    const nextCol = Math.min(selectedCell.col, (newGrid[0]?.length || 1) - 1);
    setSelectedCell({ row: selectedCell.row, col: nextCol });
    setFormulaValue(String(newGrid[selectedCell.row]?.[nextCol] ?? ''));
  }

  function addNewSheet() {
    let counter = sheetNames.length + 1;
    let newName = `Sheet${counter}`;
    while (sheetNames.includes(newName)) {
      counter++;
      newName = `Sheet${counter}`;
    }
    const emptyGrid = padGrid([], 30, 15);
    const newSheets = { ...sheetsData, [newName]: emptyGrid };
    const newOriginals = { ...originalSheetsData, [newName]: JSON.parse(JSON.stringify(emptyGrid)) };

    setSheetNames([...sheetNames, newName]);
    setSheetsData(newSheets);
    setOriginalSheetsData(newOriginals);
    setActiveSheet(newName);
    pushHistory(newSheets, newName);
    setSelectedCell({ row: 0, col: 0 });
    setFormulaValue('');
  }

  // Rename individual sheet
  function startRenamingSheet(index: number, currentName: string) {
    setEditingSheetIndex(index);
    setSheetRenameValue(currentName);
    setTimeout(() => {
      sheetRenameInputRef.current?.focus();
      sheetRenameInputRef.current?.select();
    }, 20);
  }

  function commitRenameSheet(index: number) {
    const newName = sheetRenameValue.trim();
    const oldName = sheetNames[index];
    if (!newName || newName === oldName) {
      setEditingSheetIndex(null);
      return;
    }

    if (sheetNames.some((n, i) => i !== index && n.toLowerCase() === newName.toLowerCase())) {
      (window as any).__magictools_toast?.({
        type: 'error',
        title: 'Duplicate Sheet Name',
        message: `A sheet named "${newName}" already exists.`,
      });
      setEditingSheetIndex(null);
      return;
    }

    const newSheetNames = [...sheetNames];
    newSheetNames[index] = newName;

    const newSheetsData: Record<string, SheetGrid> = {};
    const newOriginalData: Record<string, SheetGrid> = {};

    for (const name of sheetNames) {
      const targetName = name === oldName ? newName : name;
      newSheetsData[targetName] = sheetsData[name];
      if (originalSheetsData[name]) {
        newOriginalData[targetName] = originalSheetsData[name];
      }
    }

    setSheetNames(newSheetNames);
    setSheetsData(newSheetsData);
    setOriginalSheetsData(newOriginalData);
    if (activeSheet === oldName) {
      setActiveSheet(newName);
    }
    pushHistory(newSheetsData, activeSheet === oldName ? newName : activeSheet);
    setEditingSheetIndex(null);

    (window as any).__magictools_toast?.({
      type: 'info',
      title: 'Sheet Renamed',
      message: `Renamed "${oldName}" to "${newName}"`,
    });
  }

  // Delete individual sheet
  function deleteSheet(sheetNameToDelete: string) {
    if (sheetNames.length <= 1) return;
    const newSheetNames = sheetNames.filter((n) => n !== sheetNameToDelete);
    const newSheetsData = { ...sheetsData };
    delete newSheetsData[sheetNameToDelete];
    const newOriginalData = { ...originalSheetsData };
    delete newOriginalData[sheetNameToDelete];

    const nextActive = activeSheet === sheetNameToDelete ? newSheetNames[0] : activeSheet;

    setSheetNames(newSheetNames);
    setSheetsData(newSheetsData);
    setOriginalSheetsData(newOriginalData);
    setActiveSheet(nextActive);
    pushHistory(newSheetsData, nextActive);
    if (selectedCell) {
      setFormulaValue(String(newSheetsData[nextActive]?.[selectedCell.row]?.[selectedCell.col] ?? ''));
    }

    (window as any).__magictools_toast?.({
      type: 'info',
      title: 'Sheet Deleted',
      message: `Removed sheet "${sheetNameToDelete}"`,
    });
  }

  // Keyboard navigation
  function handleKeyDown(e: KeyboardEvent) {
    // Global Undo / Redo Shortcuts
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      if (e.shiftKey) {
        handleRedo();
      } else {
        handleUndo();
      }
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
      e.preventDefault();
      handleRedo();
      return;
    }

    if (!selectedCell || editingCell !== null || isEditingFileName || editingSheetIndex !== null) return;

    const { row, col } = selectedCell;
    const maxRow = currentSheetGrid.length - 1;
    const maxCol = (currentSheetGrid[0]?.length || 1) - 1;

    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        if (row > 0) {
          const next = { row: row - 1, col };
          setSelectedCell(next);
          setFormulaValue(String(currentSheetGrid[next.row]?.[next.col] ?? ''));
        }
        break;
      case 'ArrowDown':
      case 'Enter':
        e.preventDefault();
        if (row < maxRow) {
          const next = { row: row + 1, col };
          setSelectedCell(next);
          setFormulaValue(String(currentSheetGrid[next.row]?.[next.col] ?? ''));
        }
        break;
      case 'ArrowLeft':
        e.preventDefault();
        if (col > 0) {
          const next = { row, col: col - 1 };
          setSelectedCell(next);
          setFormulaValue(String(currentSheetGrid[next.row]?.[next.col] ?? ''));
        }
        break;
      case 'ArrowRight':
      case 'Tab':
        e.preventDefault();
        if (col < maxCol) {
          const next = { row, col: col + 1 };
          setSelectedCell(next);
          setFormulaValue(String(currentSheetGrid[next.row]?.[next.col] ?? ''));
        }
        break;
      case 'F2':
        e.preventDefault();
        startEditing(row, col);
        break;
      case 'Delete':
      case 'Backspace':
        e.preventDefault();
        commitCellEdit(row, col, '');
        break;
      default:
        // Start typing directly to replace cell content
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault();
          setEditingCell({ row, col });
          setEditValue(e.key);
          setFormulaValue(e.key);
        }
        break;
    }
  }

  function startEditing(row: number, col: number) {
    const val = String(currentSheetGrid[row]?.[col] ?? '');
    setEditingCell({ row, col });
    setEditValue(val);
    setFormulaValue(val);
    setTimeout(() => {
      cellInputRef.current?.focus();
      cellInputRef.current?.select();
    }, 10);
  }

  // Export handlers
  function exportAs(format: 'xlsx' | 'csv' | 'json' | 'html') {
    setShowExportMenu(false);
    const baseName = (customFileName.replace(/\.[^.]+$/, '') || 'spreadsheet').trim();

    try {
      if (format === 'xlsx') {
        const wb = XLSX.utils.book_new();
        for (const sName of sheetNames) {
          const rawGrid = sheetsData[sName] || [];
          const trimmed = trimEmptyRowsCols(rawGrid);
          const ws = XLSX.utils.aoa_to_sheet(trimmed);
          XLSX.utils.book_append_sheet(wb, ws, sName);
        }
        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([wbout], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });
        downloadBlob(blob, `${baseName}.xlsx`);
      } else if (format === 'csv') {
        const rawGrid = sheetsData[activeSheet] || [];
        const trimmed = trimEmptyRowsCols(rawGrid);
        const ws = XLSX.utils.aoa_to_sheet(trimmed);
        const csvString = XLSX.utils.sheet_to_csv(ws);
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8' });
        downloadBlob(blob, `${baseName}-${activeSheet}.csv`);
      } else if (format === 'json') {
        const rawGrid = sheetsData[activeSheet] || [];
        const trimmed = trimEmptyRowsCols(rawGrid);
        const jsonContent = JSON.stringify(trimmed, null, 2);
        const blob = new Blob([jsonContent], { type: 'application/json' });
        downloadBlob(blob, `${baseName}-${activeSheet}.json`);
      } else if (format === 'html') {
        const rawGrid = sheetsData[activeSheet] || [];
        const trimmed = trimEmptyRowsCols(rawGrid);
        const ws = XLSX.utils.aoa_to_sheet(trimmed);
        const htmlStr = XLSX.utils.sheet_to_html(ws);
        const blob = new Blob([htmlStr], { type: 'text/html;charset=utf-8' });
        downloadBlob(blob, `${baseName}-${activeSheet}.html`);
      }

      (window as any).__magictools_toast?.({
        type: 'success',
        title: 'Export Complete',
        message: `Downloaded spreadsheet as .${format.toUpperCase()}`,
      });
    } catch (e) {
      console.error('Export error:', e);
      (window as any).__magictools_toast?.({
        type: 'error',
        title: 'Export Failed',
        message: e instanceof Error ? e.message : 'Could not export file',
      });
    }
  }

  function trimEmptyRowsCols(grid: SheetGrid): SheetGrid {
    let lastNonEmptyRow = 0;
    let lastNonEmptyCol = 0;

    for (let r = 0; r < grid.length; r++) {
      for (let c = 0; c < (grid[r]?.length || 0); c++) {
        const val = grid[r][c];
        if (val !== '' && val !== null && val !== undefined) {
          lastNonEmptyRow = Math.max(lastNonEmptyRow, r);
          lastNonEmptyCol = Math.max(lastNonEmptyCol, c);
        }
      }
    }

    const result: SheetGrid = [];
    for (let r = 0; r <= lastNonEmptyRow; r++) {
      const row: CellValue[] = [];
      for (let c = 0; c <= lastNonEmptyCol; c++) {
        row.push(grid[r]?.[c] ?? '');
      }
      result.push(row);
    }
    return result.length > 0 ? result : [['']];
  }

  // Active cell info for the formula bar
  const activeCellCoord = selectedCell
    ? `${colIndexToLetter(selectedCell.col)}${selectedCell.row + 1}`
    : 'A1';

  const isSelectedCellModified = selectedCell
    ? isCellModified(activeSheet, selectedCell.row, selectedCell.col)
    : false;

  const selectedCellOrigValue = selectedCell
    ? getOriginalCellValue(activeSheet, selectedCell.row, selectedCell.col)
    : '';

  const hasWorkbook = sheetNames.length > 0;

  return (
    <div
      class={`space-y-3 transition-all ${
        isExpanded
          ? 'fixed inset-0 z-50 bg-neutral-100 dark:bg-neutral-950 p-1 sm:p-3 overflow-hidden flex flex-col'
          : 'w-full max-w-6xl mx-auto'
      }`}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      {/* Upload DropZone when no file is active */}
      {!hasWorkbook && (
        <div class="space-y-4">
          <DropZone
            acceptedTypes={tool.acceptedTypes}
            acceptedExtensions={tool.acceptedExtensions}
            maxSizeMB={tool.maxSizeMB}
            multiFile={false}
            onFilesSelected={handleFileSelected}
            disabled={isLoading}
          />

          {/* Quick Sample File Button */}
          <div class="flex items-center justify-center gap-2 pt-2">
            <span class="text-xs text-neutral-400">or</span>
            <button
              type="button"
              onClick={loadSampleData}
              class="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-brand-300 dark:border-brand-800/80 bg-brand-50 dark:bg-brand-950/50 text-xs sm:text-sm font-bold text-brand-700 dark:text-brand-300 hover:bg-brand-100 dark:hover:bg-brand-900 transition-all shadow-2xs hover:scale-102 cursor-pointer"
            >
              <span>📊 Try with a Sample Spreadsheet</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Spreadsheet Studio Panel */}
      {hasWorkbook && (
        <div
          class={`rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-md flex flex-col overflow-hidden ${
            isExpanded ? 'h-full flex-1' : 'h-[82vh] sm:h-[78vh] min-h-[460px] sm:min-h-[560px]'
          }`}
        >
          {/* Top Control Bar — Fully Responsive on Mobile & Desktop */}
          <div class="p-2 sm:p-3 bg-neutral-50/90 dark:bg-neutral-900/90 border-b border-neutral-200 dark:border-neutral-800 flex flex-col gap-2">
            {/* Primary Action Row: File Name + Undo / Redo + Mobile Tools + Download */}
            <div class="flex items-center justify-between gap-1.5 sm:gap-2.5">
              {/* Editable File Name Container */}
              <div class="flex items-center gap-1 sm:gap-1.5 px-2 py-1 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200/80 dark:border-neutral-700 shadow-2xs min-w-0 max-w-[170px] sm:max-w-[280px]">
                <span class="text-sm sm:text-base flex-shrink-0">📊</span>
                {isEditingFileName ? (
                  <input
                    ref={fileNameInputRef}
                    type="text"
                    value={customFileName}
                    onInput={(e) => setCustomFileName((e.target as HTMLInputElement).value)}
                    onBlur={() => setIsEditingFileName(false)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === 'Escape') setIsEditingFileName(false);
                    }}
                    autoFocus
                    class="text-base sm:text-xs font-display font-bold px-1 py-0.5 rounded border border-brand-500 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white outline-none w-full"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingFileName(true);
                      setTimeout(() => {
                        fileNameInputRef.current?.focus();
                        fileNameInputRef.current?.select();
                      }, 20);
                    }}
                    class="group/fn flex items-center gap-1 font-display font-bold text-xs text-neutral-900 dark:text-white hover:text-brand-600 dark:hover:text-brand-400 min-w-0 text-left cursor-pointer truncate"
                    title="Tap to rename file"
                  >
                    <span class="truncate">{customFileName}</span>
                    <span class="opacity-80 sm:opacity-0 group-hover/fn:opacity-100 text-[10px] text-neutral-400 flex-shrink-0">✏️</span>
                  </button>
                )}
              </div>

              {/* Central Actions: Undo, Redo, Row/Col toggle, Expand */}
              <div class="flex items-center gap-1 sm:gap-1.5">
                {/* Undo & Redo Buttons */}
                <div class="flex items-center bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200/80 dark:border-neutral-700 p-0.5 shadow-2xs">
                  <button
                    type="button"
                    onClick={handleUndo}
                    disabled={historyIndex <= 0}
                    class="p-1.5 sm:px-2.5 sm:py-1 rounded-lg text-xs font-semibold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 disabled:opacity-30 disabled:pointer-events-none transition-all flex items-center gap-0.5 sm:gap-1"
                    title="Undo (Ctrl+Z)"
                    aria-label="Undo"
                  >
                    <span class="text-sm">↩</span>
                    <span class="hidden sm:inline">Undo</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleRedo}
                    disabled={historyIndex >= history.length - 1}
                    class="p-1.5 sm:px-2.5 sm:py-1 rounded-lg text-xs font-semibold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 disabled:opacity-30 disabled:pointer-events-none transition-all flex items-center gap-0.5 sm:gap-1"
                    title="Redo (Ctrl+Y)"
                    aria-label="Redo"
                  >
                    <span class="text-sm">↪</span>
                    <span class="hidden sm:inline">Redo</span>
                  </button>
                </div>

                {/* Mobile Row/Col Actions Drawer Toggle */}
                <div class="relative md:hidden">
                  <button
                    type="button"
                    onClick={() => setShowMobileRowColMenu(!showMobileRowColMenu)}
                    class={`p-1.5 rounded-xl border text-xs font-bold transition-all ${
                      showMobileRowColMenu
                        ? 'bg-brand-50 border-brand-500 text-brand-600 dark:bg-brand-950 dark:text-brand-300'
                        : 'bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300'
                    }`}
                    title="Row & Column Tools"
                  >
                    <span>📐</span>
                  </button>

                  {/* Backdrop dismiss */}
                  {showMobileRowColMenu && (
                    <div
                      class="fixed inset-0 z-40 bg-black/10 dark:bg-black/30"
                      onClick={() => setShowMobileRowColMenu(false)}
                    />
                  )}

                  {/* Mobile Row/Col Popover */}
                  {showMobileRowColMenu && (
                    <div class="absolute right-0 top-full mt-1 w-44 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 shadow-xl z-50 p-2 space-y-1 text-xs animate-fade-in">
                      <div class="font-bold text-[10px] uppercase text-neutral-400 px-1">Row Tools</div>
                      <div class="grid grid-cols-2 gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            insertRow(false);
                            setShowMobileRowColMenu(false);
                          }}
                          class="p-1.5 rounded-lg bg-neutral-50 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-200 font-medium text-center hover:bg-neutral-100 cursor-pointer"
                        >
                          + Row
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            deleteRow();
                            setShowMobileRowColMenu(false);
                          }}
                          class="p-1.5 rounded-lg bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 font-medium text-center hover:bg-red-100 cursor-pointer"
                        >
                          - Row
                        </button>
                      </div>

                      <div class="font-bold text-[10px] uppercase text-neutral-400 px-1 pt-1">Column Tools</div>
                      <div class="grid grid-cols-2 gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            insertColumn(false);
                            setShowMobileRowColMenu(false);
                          }}
                          class="p-1.5 rounded-lg bg-neutral-50 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-200 font-medium text-center hover:bg-neutral-100 cursor-pointer"
                        >
                          + Col
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            deleteColumn();
                            setShowMobileRowColMenu(false);
                          }}
                          class="p-1.5 rounded-lg bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 font-medium text-center hover:bg-red-100 cursor-pointer"
                        >
                          - Col
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Desktop Row & Column quick insert/delete */}
                <div class="hidden md:flex items-center gap-1 bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200/80 dark:border-neutral-700 p-0.5 shadow-2xs text-xs">
                  <button
                    type="button"
                    onClick={() => insertRow(false)}
                    class="px-2 py-1 rounded-lg text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors font-medium cursor-pointer"
                    title="Insert Row Below"
                  >
                    + Row
                  </button>
                  <button
                    type="button"
                    onClick={deleteRow}
                    class="px-2 py-1 rounded-lg text-neutral-700 dark:text-neutral-300 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 transition-colors font-medium cursor-pointer"
                    title="Delete Row"
                  >
                    - Row
                  </button>
                  <span class="text-neutral-300 dark:text-neutral-700">|</span>
                  <button
                    type="button"
                    onClick={() => insertColumn(false)}
                    class="px-2 py-1 rounded-lg text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors font-medium cursor-pointer"
                    title="Insert Column Right"
                  >
                    + Col
                  </button>
                  <button
                    type="button"
                    onClick={deleteColumn}
                    class="px-2 py-1 rounded-lg text-neutral-700 dark:text-neutral-300 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 transition-colors font-medium cursor-pointer"
                    title="Delete Column"
                  >
                    - Col
                  </button>
                </div>

                {/* Fullscreen Toggle */}
                <button
                  type="button"
                  onClick={() => setIsExpanded(!isExpanded)}
                  class="p-1.5 sm:px-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-xs font-bold transition-all shadow-2xs cursor-pointer flex items-center justify-center"
                  title={isExpanded ? 'Collapse View' : 'Expand Fullscreen'}
                  aria-label={isExpanded ? 'Collapse View' : 'Expand Fullscreen'}
                >
                  {isExpanded ? (
                    <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 4v4H5m0 0l5-5M9 20v-4H5m0 0l5 5m6-16v4h4m0 0l-5-5m5 16v-4h-4m0 0l5 5" />
                    </svg>
                  ) : (
                    <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-5h-4m4 0v4m0-4l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5h-4m4 0v-4m0 4l-5-5" />
                    </svg>
                  )}
                </button>

                {/* Export / Download Button */}
                <div class="relative">
                  <button
                    type="button"
                    onClick={() => setShowExportMenu(!showExportMenu)}
                    class="inline-flex items-center gap-1 sm:gap-1.5 px-3 sm:px-4 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-brand-500/20 transition-all hover:scale-102 cursor-pointer flex-shrink-0"
                  >
                    <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    <span class="hidden xs:inline">Save</span>
                    <span class="text-[10px]">▼</span>
                  </button>

                  {/* Backdrop dismiss */}
                  {showExportMenu && (
                    <div
                      class="fixed inset-0 z-40 bg-black/10 dark:bg-black/30"
                      onClick={() => setShowExportMenu(false)}
                    />
                  )}

                  {/* Dropdown Menu */}
                  {showExportMenu && (
                    <div class="absolute right-0 top-full mt-1.5 w-48 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 shadow-xl z-50 py-1 divide-y divide-neutral-100 dark:divide-neutral-700 animate-fade-in text-xs">
                      <button
                        type="button"
                        onClick={() => exportAs('xlsx')}
                        class="w-full px-3.5 py-2 text-left hover:bg-brand-50 dark:hover:bg-brand-950/50 text-neutral-800 dark:text-neutral-200 font-semibold flex items-center justify-between cursor-pointer"
                      >
                        <span>Excel (.xlsx)</span>
                        <span class="text-[10px] font-mono opacity-60">All Sheets</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => exportAs('csv')}
                        class="w-full px-3.5 py-2 text-left hover:bg-brand-50 dark:hover:bg-brand-950/50 text-neutral-800 dark:text-neutral-200 font-semibold flex items-center justify-between cursor-pointer"
                      >
                        <span>CSV (.csv)</span>
                        <span class="text-[10px] font-mono opacity-60">Active Sheet</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => exportAs('json')}
                        class="w-full px-3.5 py-2 text-left hover:bg-brand-50 dark:hover:bg-brand-950/50 text-neutral-800 dark:text-neutral-200 font-semibold flex items-center justify-between cursor-pointer"
                      >
                        <span>JSON Data (.json)</span>
                        <span class="text-[10px] font-mono opacity-60">Rows Array</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => exportAs('html')}
                        class="w-full px-3.5 py-2 text-left hover:bg-brand-50 dark:hover:bg-brand-950/50 text-neutral-800 dark:text-neutral-200 font-semibold flex items-center justify-between cursor-pointer"
                      >
                        <span>HTML Table (.html)</span>
                        <span class="text-[10px] font-mono opacity-60">Web Ready</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Secondary Row: Search Filter + Changes Tracker badge */}
            <div class="flex items-center justify-between gap-2 pt-0.5">
              {/* Search Filter Input */}
              <div class="relative flex-1 max-w-xs">
                <input
                  type="text"
                  placeholder="Find in sheet…"
                  value={searchQuery}
                  onInput={(e) => setSearchQuery((e.target as HTMLInputElement).value)}
                  class="w-full px-2.5 py-1 text-base sm:text-xs rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:border-brand-500 shadow-2xs"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    class="absolute right-2 top-1 text-neutral-400 hover:text-neutral-600 text-xs p-0.5 cursor-pointer"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Changes Badge & Revert All */}
              {modifiedCellsCount > 0 ? (
                <div class="flex items-center gap-1.5 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-800/60 text-[10px] sm:text-[11px] font-bold text-amber-900 dark:text-amber-200 flex-shrink-0">
                  <span>✏️ {modifiedCellsCount} change{modifiedCellsCount > 1 ? 's' : ''}</span>
                  <button
                    type="button"
                    onClick={revertAllChanges}
                    class="ml-0.5 sm:ml-1 text-[9px] sm:text-[10px] underline hover:text-amber-700 dark:hover:text-amber-300 font-semibold cursor-pointer"
                    title="Revert all changes in this sheet to original"
                  >
                    Revert all
                  </button>
                </div>
              ) : (
                <span class="text-[10px] sm:text-[11px] font-mono text-neutral-400 truncate">✓ All saved</span>
              )}
            </div>
          </div>

          {/* Formula & Active Cell Toolbar — Touch Friendly on Mobile */}
          <div class="px-2 sm:px-3 py-1.5 bg-white dark:bg-neutral-900 border-b border-neutral-200/80 dark:border-neutral-800 flex items-center gap-1.5 sm:gap-2 text-xs">
            {/* Cell Coordinate Badge */}
            <div class="px-2 py-1 rounded-lg bg-neutral-100 dark:bg-neutral-800 font-mono font-bold text-neutral-700 dark:text-neutral-300 min-w-[42px] sm:min-w-[50px] text-center border border-neutral-200/60 dark:border-neutral-700/60 text-xs flex-shrink-0">
              {activeCellCoord}
            </div>

            <span class="font-mono text-neutral-400 font-bold flex-shrink-0">fx</span>

            {/* Formula / Value Input Bar with iOS font-size 16px safety */}
            <div class="flex-1 flex items-center gap-1 min-w-0">
              <input
                ref={formulaInputRef}
                type="text"
                value={formulaValue}
                onInput={(e) => setFormulaValue((e.target as HTMLInputElement).value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && selectedCell) {
                    commitCellEdit(selectedCell.row, selectedCell.col, formulaValue);
                  }
                }}
                placeholder="Type cell value…"
                class="w-full px-2 py-1 text-base sm:text-xs rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50/50 dark:bg-neutral-800 text-neutral-900 dark:text-white focus:bg-white dark:focus:bg-neutral-900 focus:outline-none focus:border-brand-500 font-mono"
              />
              {selectedCell && (
                <button
                  type="button"
                  onClick={() => commitCellEdit(selectedCell.row, selectedCell.col, formulaValue)}
                  class="px-2.5 py-1 rounded-lg bg-brand-50 dark:bg-brand-950 text-brand-600 dark:text-brand-400 hover:bg-brand-100 font-bold cursor-pointer flex-shrink-0 text-sm sm:text-xs"
                  title="Apply Value (Enter)"
                >
                  ✓
                </button>
              )}
            </div>

            {/* Quick Edit in Place Button for Mobile */}
            {selectedCell && !editingCell && (
              <button
                type="button"
                onClick={() => startEditing(selectedCell.row, selectedCell.col)}
                class="p-1 sm:hidden rounded-lg bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-300 text-xs flex-shrink-0 cursor-pointer"
                title="Edit cell in place"
              >
                ✏️
              </button>
            )}

            {/* Individual Cell Modified Indicator & Revert Button */}
            {isSelectedCellModified && selectedCell && (
              <div class="flex items-center gap-1 px-1.5 sm:px-2.5 py-0.5 rounded-lg bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 text-[10px] sm:text-[11px] text-amber-900 dark:text-amber-200 animate-fade-in flex-shrink-0">
                <span class="hidden md:inline opacity-75">Was: "{String(selectedCellOrigValue)}"</span>
                <button
                  type="button"
                  onClick={() => revertSingleCell(selectedCell.row, selectedCell.col)}
                  class="px-1.5 py-0.5 rounded bg-amber-200 dark:bg-amber-900 hover:bg-amber-300 dark:hover:bg-amber-800 text-amber-950 dark:text-amber-100 font-bold transition-all shadow-2xs cursor-pointer text-[10px]"
                  title="Revert only this cell back to original"
                >
                  ↩ Revert
                </button>
              </div>
            )}
          </div>

          {/* Interactive Spreadsheet Grid Canvas — Touch Scrollable */}
          <div
            ref={tableContainerRef}
            class="flex-1 overflow-x-auto overflow-y-auto bg-neutral-50/30 dark:bg-neutral-950/40 relative select-none scrollbar-thin touch-pan-x touch-pan-y overscroll-contain"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            <table class="border-collapse table-fixed w-max min-w-full text-xs font-mono">
              <thead>
                <tr class="sticky top-0 z-20 bg-neutral-100 dark:bg-neutral-800/95 border-b border-neutral-300 dark:border-neutral-700 shadow-2xs">
                  {/* Top-left Corner Cell */}
                  <th class="w-11 min-w-[44px] max-w-[44px] p-2 text-center text-[10px] text-neutral-400 font-bold border-r border-neutral-300 dark:border-neutral-700 bg-neutral-200/80 dark:bg-neutral-800 sticky left-0 top-0 z-30">
                    #
                  </th>
                  {/* Column Header Letters — Generous Width on Mobile & Desktop */}
                  {(currentSheetGrid[0] || []).map((_, cIdx) => {
                    const isColSelected = selectedCell?.col === cIdx;
                    return (
                      <th
                        key={cIdx}
                        class={`w-36 min-w-[144px] max-w-[144px] sm:w-40 sm:min-w-[160px] sm:max-w-[160px] p-2 text-center text-xs font-bold border-r border-neutral-300 dark:border-neutral-700 cursor-pointer transition-colors ${
                          isColSelected
                            ? 'bg-brand-100 dark:bg-brand-950/80 text-brand-700 dark:text-brand-300'
                            : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200/70 dark:hover:bg-neutral-700/60'
                        }`}
                        onClick={() => {
                          setSelectedCell({ row: selectedCell?.row ?? 0, col: cIdx });
                          setFormulaValue(String(currentSheetGrid[selectedCell?.row ?? 0]?.[cIdx] ?? ''));
                        }}
                      >
                        {colIndexToLetter(cIdx)}
                      </th>
                    );
                  })}
                </tr>
              </thead>

              <tbody>
                {currentSheetGrid.map((row, rIdx) => {
                  const isRowSelected = selectedCell?.row === rIdx;

                  return (
                    <tr key={rIdx} class="hover:bg-neutral-50 dark:hover:bg-neutral-800/30">
                      {/* Sticky Row Number Index */}
                      <td
                        class={`w-11 min-w-[44px] max-w-[44px] p-2 text-center text-[11px] font-bold border-r border-b border-neutral-300 dark:border-neutral-700/80 sticky left-0 z-10 cursor-pointer transition-colors ${
                          isRowSelected
                            ? 'bg-brand-100 dark:bg-brand-950/80 text-brand-700 dark:text-brand-300'
                            : 'bg-neutral-100 dark:bg-neutral-800/95 text-neutral-500 dark:text-neutral-400'
                        }`}
                        onClick={() => {
                          setSelectedCell({ row: rIdx, col: selectedCell?.col ?? 0 });
                          setFormulaValue(String(currentSheetGrid[rIdx]?.[selectedCell?.col ?? 0] ?? ''));
                        }}
                      >
                        {rIdx + 1}
                      </td>

                      {/* Cell Columns with Generous Width & Touch Optimization */}
                      {row.map((val, cIdx) => {
                        const isSelected = selectedCell?.row === rIdx && selectedCell?.col === cIdx;
                        const isEditing = editingCell?.row === rIdx && editingCell?.col === cIdx;
                        const isModified = isCellModified(activeSheet, rIdx, cIdx);
                        const isSearchMatch =
                          searchQuery.trim() !== '' &&
                          String(val).toLowerCase().includes(searchQuery.toLowerCase());

                        return (
                          <td
                            key={cIdx}
                            onClick={() => {
                              setSelectedCell({ row: rIdx, col: cIdx });
                              setFormulaValue(String(val ?? ''));
                            }}
                            onDblClick={() => startEditing(rIdx, cIdx)}
                            class={`w-36 min-w-[144px] max-w-[144px] sm:w-40 sm:min-w-[160px] sm:max-w-[160px] relative px-3 py-2 border-r border-b border-neutral-200 dark:border-neutral-800 truncate cursor-cell transition-all text-xs h-10 sm:h-9 touch-manipulation ${
                              isSelected
                                ? 'ring-2 ring-brand-500 ring-inset bg-brand-50/60 dark:bg-brand-950/40 z-10 font-medium'
                                : isModified
                                ? 'bg-amber-50/70 dark:bg-amber-950/30 text-neutral-900 dark:text-amber-100'
                                : isSearchMatch
                                ? 'bg-yellow-200/80 dark:bg-yellow-900/60 font-bold'
                                : 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100'
                            }`}
                          >
                            {/* Modified Indicator Dogear */}
                            {isModified && (
                              <span
                                class="absolute top-0 right-0 w-2.5 h-2.5 bg-amber-500 rounded-bl-sm"
                                title={`Original: "${String(getOriginalCellValue(activeSheet, rIdx, cIdx))}"`}
                              />
                            )}

                            {isEditing ? (
                              <input
                                ref={cellInputRef}
                                type="text"
                                value={editValue}
                                onInput={(e) => {
                                  const newVal = (e.target as HTMLInputElement).value;
                                  setEditValue(newVal);
                                  setFormulaValue(newVal);
                                }}
                                onBlur={() => commitCellEdit(rIdx, cIdx, editValue)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    commitCellEdit(rIdx, cIdx, editValue);
                                  } else if (e.key === 'Escape') {
                                    setEditingCell(null);
                                    setFormulaValue(String(val ?? ''));
                                  }
                                }}
                                class="w-full h-full p-0 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white border-0 outline-none font-mono text-base sm:text-xs"
                              />
                            ) : (
                              <span class="block w-full truncate">{String(val ?? '')}</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Bottom Bar: Touch Scrollable Sheet Tabs & Stats */}
          <div class="p-1.5 sm:p-2 bg-neutral-100 dark:bg-neutral-800/90 border-t border-neutral-200 dark:border-neutral-700 flex items-center justify-between gap-2 text-xs">
            {/* Sheet Tabs with Inline Editing & Delete */}
            <div class="flex items-center gap-1 sm:gap-1.5 overflow-x-auto scrollbar-none py-0.5 flex-1 min-w-0">
              {sheetNames.map((sName, idx) => {
                const isActive = activeSheet === sName;
                const isEditingThis = editingSheetIndex === idx;

                return isEditingThis ? (
                  <input
                    key={sName}
                    ref={sheetRenameInputRef}
                    type="text"
                    value={sheetRenameValue}
                    onInput={(e) => setSheetRenameValue((e.target as HTMLInputElement).value)}
                    onBlur={() => commitRenameSheet(idx)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitRenameSheet(idx);
                      if (e.key === 'Escape') setEditingSheetIndex(null);
                    }}
                    autoFocus
                    class="w-20 sm:w-24 px-1.5 py-0.5 rounded-lg text-base sm:text-xs font-bold border border-brand-500 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white outline-none shadow-xs flex-shrink-0"
                  />
                ) : (
                  <div
                    key={sName}
                    class={`group/tab relative px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer flex-shrink-0 ${
                      isActive
                        ? 'bg-white dark:bg-neutral-900 text-brand-600 dark:text-brand-400 shadow-xs border border-neutral-200/80 dark:border-neutral-700'
                        : 'text-neutral-600 dark:text-neutral-400 hover:bg-white/60 dark:hover:bg-neutral-700/60'
                    }`}
                    onClick={() => {
                      setActiveSheet(sName);
                      setSelectedCell({ row: 0, col: 0 });
                      setFormulaValue(String(sheetsData[sName]?.[0]?.[0] ?? ''));
                    }}
                    onDblClick={(e) => {
                      e.stopPropagation();
                      startRenamingSheet(idx, sName);
                    }}
                  >
                    <span>📄</span>
                    <span class="max-w-[70px] sm:max-w-[100px] truncate">{sName}</span>

                    {/* Rename Sheet Icon Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        startRenamingSheet(idx, sName);
                      }}
                      class="opacity-80 sm:opacity-0 group-hover/tab:opacity-100 p-0.5 hover:text-brand-600 dark:hover:text-brand-400 text-neutral-400 text-[10px] transition-opacity cursor-pointer"
                      title="Rename sheet"
                    >
                      ✏️
                    </button>

                    {/* Delete Sheet Icon Button if multiple sheets */}
                    {sheetNames.length > 1 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteSheet(sName);
                        }}
                        class="opacity-80 sm:opacity-0 group-hover/tab:opacity-100 p-0.5 hover:text-red-600 dark:hover:text-red-400 text-neutral-400 text-[10px] transition-opacity font-bold cursor-pointer"
                        title="Delete sheet"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                );
              })}

              {/* Add New Sheet Button */}
              <button
                type="button"
                onClick={addNewSheet}
                class="px-2 py-1 rounded-lg text-xs font-bold text-neutral-600 dark:text-neutral-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-white dark:hover:bg-neutral-700 transition-colors shadow-2xs border border-dashed border-neutral-300 dark:border-neutral-700 flex-shrink-0 cursor-pointer"
                title="Add new sheet"
              >
                + Sheet
              </button>
            </div>

            {/* Quick Status / Cell Stats */}
            <div class="hidden xs:flex items-center gap-1.5 text-[10px] sm:text-[11px] font-mono text-neutral-500 dark:text-neutral-400 flex-shrink-0">
              <span>{currentSheetGrid.length}R × {currentSheetGrid[0]?.length || 0}C</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
