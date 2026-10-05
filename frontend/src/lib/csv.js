import { saveFile } from './saveFile';

const cell = (v) => (typeof v === 'string' && /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/** Saves rows (arrays of values) under a header row as a CSV file (save dialog, lib/saveFile.js). */
export function downloadCsv(filename, header, rows) {
  const text = [header, ...rows].map((r) => r.map(cell).join(',')).join('\n');
  return saveFile(filename, new Blob([text], { type: 'text/csv;charset=utf-8' }));
}
