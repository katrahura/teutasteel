/**
 * One spreadsheet cell, written so a spreadsheet reads it as text.
 *
 * Two problems are solved here, and both have bitten a shop exporting a catalogue:
 *
 * - a code containing a comma or a quote shifts every column after it, so the cell is quoted and its
 *   quotes doubled;
 * - a text cell beginning with =, +, -, @, a tab or a carriage return is treated as a formula by
 *   Excel and LibreOffice. A product code is data, not something to execute, so such a cell is
 *   prefixed with an apostrophe - which is how a spreadsheet is told "this is text".
 *
 * A real number is left as a number: the point is to protect text, not to turn prices into strings.
 */
export function csvText(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) {
    text = "'" + text;
  }
  return /[",\r\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
}

/** A whole file: a header row and the rows below it, with CRLF line endings for Excel. */
export function csvDocument(header: unknown[], rows: unknown[][]): string {
  return [header, ...rows].map((row) => row.map(csvText).join(',')).join('\r\n');
}
