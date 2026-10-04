const cell = (v) => (typeof v === 'string' && /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/** Downloads rows (arrays of values) under a header row as a CSV file. */
export function downloadCsv(filename, header, rows) {
  const text = [header, ...rows].map((r) => r.map(cell).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  a.click();
  URL.revokeObjectURL(url);
}
