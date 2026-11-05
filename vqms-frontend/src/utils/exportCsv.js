/** Builds a CSV file from rows and starts the download. columns: [{ header, value(row) }] */
export function downloadCsv(filename, columns, rows) {
  const escape = (value) => {
    const text = value == null ? '' : String(value);
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const lines = [columns.map((column) => escape(column.header)).join(','), ...rows.map((row) => columns.map((column) => escape(column.value(row))).join(','))];
  // BOM so Excel opens UTF-8 (₹, accents) correctly.
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
