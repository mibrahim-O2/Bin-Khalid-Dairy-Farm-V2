/**
 * Builds a CSV string from a header row + data rows and triggers a browser
 * download. Client-side only (uses document/Blob) — no server round trip
 * needed since the data is already on the page.
 */
export function downloadCsv(fileName: string, headers: string[], rows: (string | number)[][]): void {
  const escapeCell = (cell: string | number) => {
    const text = String(cell);
    // Quote any cell containing a comma, quote, or newline — and double up
    // internal quotes, per the standard CSV escaping rule.
    if (/[",\n]/.test(text)) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  };

  const lines = [headers, ...rows].map((row) => row.map(escapeCell).join(","));
  // Leading BOM so Excel opens UTF-8 (Urdu, currency symbols, etc.)
  // correctly instead of guessing a legacy codepage.
  const csv = "﻿" + lines.join("\r\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
