// What an export IS, as a value: the kinds this seam writes, the media types they travel under, the
// one instant every .xlsx is stamped with, and the typed sheet spec both writers are driven by.
//
// The spec is deliberately flat and conventionless (L-FMT-01): a column says what KIND of figure its
// cells hold and a cell is the decimal string the caller's own format seam settled on. This seam
// decides how a workbook groups and freezes; it never decides what a figure is. A-BOQ-XLSX's own
// sheets — Summary, the bills by section, Quantities, Resources, Assumptions — are a WorkbookSpec a
// later rail composes; this is the shape it composes into.

/** The artefacts R-SPINE-041 names: a spreadsheet, and the interchange form beside it. */
export const EXPORT_KINDS = ["xlsx", "csv"] as const;

export type ExportKind = (typeof EXPORT_KINDS)[number];

/**
 * The one instant every timestamp inside an .xlsx carries — both `docProps/core.xml` dates and every
 * zip entry's own DOS time.
 *
 * A build is a pure function of its spec or it is not evidence: two builds of one spec must be byte
 * identical, so that a content address means "these bytes" and not "these bytes, this second"
 * (R-SPINE-021 addresses an artefact by the sha256 of its own bytes). A wall clock inside the
 * artefact would give one spec an unbounded family of addresses.
 */
export const EXPORT_EPOCH = "2000-01-01T00:00:00.000Z";

/** What each kind travels as. One table, read by the seam and by the door that serves its bytes. */
export const MIME_OF_KIND: Readonly<Record<ExportKind, string>> = Object.freeze({
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv; charset=utf-8",
});

/**
 * One cell: the text it holds, nothing at all, or a live formula.
 *
 * A formula carries its own `result` for the readers that cannot evaluate one — a CSV is data
 * interchange and has no calculation engine, so it prints what the formula was known to come to, or
 * nothing. The workbook writes the formula itself and lets Excel do the arithmetic, which is what
 * A-BOQ-XLSX means by "with live formulas": an Amount column of frozen numbers is a picture of a
 * bill, not a bill.
 */
export type ExportCell = string | null | { readonly formula: string; readonly result?: string };

/**
 * One column: its key, the header a reader sees, and the kind of figure its cells hold.
 *
 * `number` states its own precision because a quantity's precision is the measurement's (L-FMT-02);
 * `money` states none, because the document convention already fixes it and a second answer here
 * would be a second convention (L-FMT-01, B-07).
 */
export type ExportColumn =
  | { readonly key: string; readonly header: string; readonly kind: "text" }
  | { readonly key: string; readonly header: string; readonly kind: "number"; readonly fractionDigits: number }
  | { readonly key: string; readonly header: string; readonly kind: "money" };

/** One sheet: its name, its columns, its rows of cells, and whether the header row stays put. */
export type SheetSpec = {
  readonly name: string;
  readonly columns: readonly ExportColumn[];
  readonly rows: readonly (readonly ExportCell[])[];
  readonly freezeHeader: boolean;
};

/** A whole workbook: the sheets it carries, in the order a reader meets them. */
export type WorkbookSpec = { readonly sheets: readonly SheetSpec[] };
