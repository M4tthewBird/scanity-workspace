type Cell = string | number | boolean | null | undefined | string[];

function escapeCell(cell: Cell): string {
  const text = Array.isArray(cell) ? cell.join(', ') : cell === true ? 'ano' : cell === false ? 'ne' : String(cell ?? '');
  return /[";\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

// Středník a BOM, aby soubor rovnou správně otevřel český Excel.
export function downloadCsv(filename: string, header: string[], rows: Cell[][]) {
  const lines = [header, ...rows].map((row) => row.map(escapeCell).join(';'));
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}
