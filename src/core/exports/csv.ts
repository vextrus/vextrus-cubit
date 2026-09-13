// The CSV half of the one export seam (R-SPINE-041): RFC 4180 over the same sheet spec the workbook
// is written from.
//
// A CSV is data interchange, not a document: a figure is written as the decimal string the caller
// handed over, ungrouped and unrounded, so the reader on the other side parses what the database
// holds. Grouping is the workbook's — it is how a figure READS, and a reading belongs to an artefact
// a person looks at (B-07, L-FMT-01).
//
// No byte-order mark. A BOM is a hint to a spreadsheet about a file it is about to open by hand; it
// is a corruption to every parser that reads the first field by name.

import type { ExportCell, SheetSpec } from "./sheet";

/** RFC 4180's row terminator — after every row, the last one included. */
const CRLF = "\r\n";

/** The characters that oblige a field to be quoted: the separator, the quote, and either line break. */
const MUST_QUOTE = /[",\r\n]/u;

/** What one cell is written as: text and figures verbatim, an absence empty, a formula its result. */
function fieldOf(cell: ExportCell): string {
  if (cell === null) return "";
  if (typeof cell === "string") return cell;
  // A formula is a live instruction to a spreadsheet, and a CSV has nowhere to put one: what a reader
  // of this file is owed is the VALUE, so a formula cell writes the result it was built with and an
  // empty field where the caller cached none. Writing the formula's text would hand a parser `B2*C2`
  // where it expects a figure.
  return cell.result ?? "";
}

/** One field, quoted where RFC 4180 asks for it, with an inner quote doubled. */
function quoted(field: string): string {
  if (!MUST_QUOTE.test(field)) return field;
  return `"${field.split('"').join('""')}"`;
}

/**
 * One sheet as a CSV, in UTF-8 bytes.
 *
 * Bytes rather than a string, because that is what is stored and served: a caller that hands the
 * answer to storage or to a browser never has to decide an encoding, and no step in between can
 * re-encode it by accident (R-SPINE-021).
 */
export function writeCsv(sheet: SheetSpec): Uint8Array {
  const header = sheet.columns.map((column) => quoted(column.header)).join(",");
  const rows = sheet.rows.map((row) => sheet.columns.map((_column, at) => quoted(fieldOf(row[at] ?? null))).join(","));
  return new TextEncoder().encode([header, ...rows].map((row) => `${row}${CRLF}`).join(""));
}
