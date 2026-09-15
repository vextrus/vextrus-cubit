// The interchange half of R-SPINE-041: one sheet, written as RFC 4180 text.
//
// A CSV is data another program reads, not a document a person is handed, so nothing about it is
// formatted: a number cell travels as the decimal string the caller's own format seam settled on,
// ungrouped. Lakh/crore grouping is the WORKBOOK's number format (A-BOQ-XLSX, L-FMT-01) — a grouped
// figure here would be a thousands separator inside a comma-separated field, which is a corrupt file
// for every reader and a lie about precision for the one that survived it.
//
// The bytes are UTF-8 with no byte-order mark: a BOM is a Microsoft-era hint that turns the first
// header into an unreadable field name for every other reader, and the media type already says
// charset=utf-8 (MIME_OF_KIND).
import type { ExportCell, SheetSpec } from "./contract";

/** RFC 4180's row terminator. Every row carries one, the last one included. */
const CRLF = "\r\n";

/** The characters that make a field need quoting, as RFC 4180 names them. */
const NEEDS_QUOTES = /[",\r\n]/u;

/**
 * What one cell reads as in a CSV. A formula has no calculation engine on the far side, so it prints
 * the result the caller knew it came to, or nothing at all — never the formula's own text, which no
 * reader of a CSV would evaluate and every reader would mistake for a label.
 */
function textOf(cell: ExportCell | undefined): string {
  if (cell === undefined || cell === null) return "";
  if (typeof cell === "string") return cell;
  return cell.result ?? "";
}

/** One field, quoted where RFC 4180 asks for it, with an embedded quote doubled. */
function field(text: string): string {
  return NEEDS_QUOTES.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/** One row: a field per column the sheet declares, so a short row is padded rather than ragged. */
function row(columns: SheetSpec["columns"], cells: readonly ExportCell[] | undefined): string {
  return columns.map((_column, index) => field(textOf(cells?.[index]))).join(",");
}

/**
 * One sheet as CSV bytes (R-SPINE-041): the headers, then a row per row of the spec, each terminated
 * by CRLF. The answer is bytes rather than a string because what a caller stores and serves is bytes,
 * and a content address is over bytes — an encoding decided here, once, is one the door cannot get
 * wrong (R-SPINE-021).
 */
export function writeCsv(sheet: SheetSpec): Uint8Array {
  const header = sheet.columns.map((column) => field(column.header)).join(",");
  const lines = [header, ...sheet.rows.map((cells) => row(sheet.columns, cells))];
  return new Uint8Array(Buffer.from(lines.map((line) => `${line}${CRLF}`).join(""), "utf8"));
}
