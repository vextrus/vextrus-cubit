// The typed sheet spec every export is written from, and the document conventions an artefact of
// this product carries (R-SPINE-041, A-BOQ-XLSX).
//
// A caller describes a sheet — columns with a kind, rows of cells, whether the header freezes — and
// the two writers beside this file turn that one description into a workbook or a CSV. Nothing here
// knows how a bill is composed: what the sheets of A-BOQ-XLSX are is a later rail's answer, and this
// is the shape it will answer in.
//
// Numbers travel as decimal STRINGS, never as JavaScript numbers: B-07 keeps a figure exact from the
// database's `numeric` to the document, and the one place a figure becomes a float is the write
// boundary inside the workbook writer, where Excel's own cell type leaves no choice.

import { BD_DOCUMENT, formatUserFigure } from "../format";

/** The two artefacts this seam writes. */
export const EXPORT_KINDS = ["xlsx", "csv"] as const;

export type ExportKind = (typeof EXPORT_KINDS)[number];

/**
 * The one instant every timestamp inside a built .xlsx carries — docProps and every zip entry alike.
 *
 * An export is a function of its spec and of nothing else: two builds of one spec are byte-identical,
 * so an artefact's content address (R-SPINE-021) is a property of what it SAYS rather than of when it
 * was written. A clock inside the archive would give the same bill two addresses a second apart.
 */
export const EXPORT_EPOCH = "2000-01-01T00:00:00.000Z";

/** What each kind is served as (Q-12: the door states the type; the browser never sniffs it). */
export const MIME_OF_KIND: Readonly<Record<ExportKind, string>> = Object.freeze({
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv; charset=utf-8",
});

/**
 * One cell: text (or a decimal string, for a number column), nothing at all, or a live formula with
 * an optional cached result. A formula is carried rather than computed — A-BOQ-XLSX asks for a bill
 * whose amounts recompute in the reader's own spreadsheet.
 */
export type ExportCell = string | null | { readonly formula: string; readonly result?: string };

/**
 * A column, by what it holds. `money` states no precision of its own: taka carry the document
 * convention's paisa digits, and a second answer for how many would be a second convention (L-FMT-01).
 */
export type ExportColumn =
  | { readonly key: string; readonly header: string; readonly kind: "text" }
  | { readonly key: string; readonly header: string; readonly kind: "number"; readonly fractionDigits: number }
  | { readonly key: string; readonly header: string; readonly kind: "money" };

/** One sheet, whole: what it is called, what its columns hold, its rows, and whether row 1 freezes. */
export type SheetSpec = {
  readonly name: string;
  readonly columns: readonly ExportColumn[];
  readonly rows: readonly (readonly ExportCell[])[];
  readonly freezeHeader: boolean;
};

/** A workbook, as a caller describes one: its sheets, in the order they are to stand in. */
export type WorkbookSpec = { readonly sheets: readonly SheetSpec[] };

/** The fraction digits a column's figures are written at, money's read from the document (L-FMT-01). */
export function fractionDigitsOf(column: Extract<ExportColumn, { kind: "number" | "money" }>): number {
  return column.kind === "money" ? BD_DOCUMENT.moneyFractionDigits : column.fractionDigits;
}

/** Is this a column whose cells are figures rather than text? */
export function isNumeric(column: ExportColumn): column is Extract<ExportColumn, { kind: "number" | "money" }> {
  return column.kind !== "text";
}

/**
 * The digit mask the document's grouping writes a figure of `digits` digits under, taken from the
 * format seam itself rather than spelled again here (L-FMT-01: one grouping rule, one home). The seam
 * groups `10,00,00,000`; every digit but the last is a placeholder, so the mask it yields is
 * `##,##,##,##0`.
 */
function groupingMask(digits: number): string {
  const grouped = documentGrouping(digits);
  const lastDigitAt = grouped.length - 1;
  return [...grouped].map((character, at) => (character === "," ? "," : at === lastDigitAt ? "0" : "#")).join("");
}

/**
 * A round figure of `digits` digits, grouped by the one seam that groups (L-FMT-01). It is asked for
 * a whole number, so the seam's free-precision reading applies its grouping and appends no fraction.
 */
function documentGrouping(digits: number): string {
  return formatUserFigure(`1${"0".repeat(digits - 1)}`);
}

/**
 * The one Excel spelling of BD_DOCUMENT's last-three-then-twos grouping, at a stated precision.
 *
 * Excel groups in thousands and has no locale-independent way to say otherwise, so lakh/crore is
 * written as three conditional sections — a crore and above, a lakh and above, and everything else —
 * each carrying enough placeholders to reach into the group its condition admits. The separators of
 * the two conditional sections are escaped, which is the spelling A-BOQ-XLSX's published format
 * carries; the default section spells the separator plain.
 *
 * `fractionDigits` is the caller's: a quantity states its own, money reads the document's. Zero
 * digits writes no decimal part at all rather than a bare point.
 */
export function lakhCroreNumberFormat(fractionDigits: number): string {
  if (!Number.isSafeInteger(fractionDigits) || fractionDigits < 0) {
    throw new TypeError("exports: fractionDigits must be a whole number of digits, zero or more");
  }
  const decimals = fractionDigits === 0 ? "" : `.${"0".repeat(fractionDigits)}`;
  const escaped = (digits: number): string => groupingMask(digits).split(",").join("\\,");
  return [`[>=10000000]${escaped(CRORE_DIGITS)}${decimals}`, `[>=100000]${escaped(LAKH_DIGITS)}${decimals}`, `${groupingMask(THOUSAND_DIGITS)}${decimals}`].join(";");
}

/** How far each section's placeholders reach: the widest figure its condition admits, in digits. */
const CRORE_DIGITS = 9;
const LAKH_DIGITS = 7;
const THOUSAND_DIGITS = 5;
