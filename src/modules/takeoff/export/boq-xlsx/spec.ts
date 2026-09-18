// A-BOQ-XLSX as a VALUE: the draft a campaign published, composed into the sheet spec the one export
// seam writes (A-BOQ-XLSX, R-TO-070, AM-05, AM-14 §2, AM-16, L-BD-08, L-FMT-01).
//
// PURE, AND IT RE-DERIVES NOTHING. The figures are the draft payload's — already rounded once, at the
// edge, by the emission (L-MEA-05) — and the item numbers are the document's own `numberItems`
// (I-269): a workbook that re-rounded a quantity or re-numbered a line would be a second draft of the
// same campaign. Nothing here names a spreadsheet library: the seam is the one caller (R-SPINE-041),
// and what this file answers is a `WorkbookSpec`, which is data.
//
// UNPRICED, AND IT SAYS SO (AM-05 §2, I-274). The Summary stamps `DRAFT — UNSIGNED` and the taxonomy
// the sections were resolved under; every Rate is empty and every Amount is the LIVE formula that
// stays empty until somebody prices the line, so no figure nobody stated ever appears in a cell.
//
// THE RESERVED WORD APPEARS NOWHERE A READER LOOKS (AM-05, I-265, I-273). A-BOQ-XLSX's "bill sheets"
// are SECTION sheets, named by the section's ordinal among L-BD-08's six and its own label.
import type { BoqDraftGroup, BoqDraftLine, BoqDraftPayload, BoqDraftSection } from "@/core/documents/kinds/boq-draft";
import { BOQ_DRAFT_TITLE, BOQ_SECTIONS, DRAFT_BANNER, MEASURED_SCOPE_SUBTOTAL, descriptionOf, placesOf } from "@/core/documents/kinds/boq-draft-law";
import type { ExportCell, ExportColumn, SheetSpec, WorkbookSpec } from "@/core/exports";
import type { BoqView } from "@/modules/takeoff/boq/view";
import { UNCLASSIFIED_LABEL } from "@/modules/takeoff/boq/taxonomy";

/* ------------------------------------------------------------------ what the composer is handed */

/**
 * One line's evidence, as the register holds it (R-TO-070, L-QTY-03): the formula the figure was
 * computed by, the drawing it was measured off and the sheet that drawing prints on.
 *
 * It is JOINED by `lineId` rather than carried on the draft payload, whose schema is strict and whose
 * subject is what a document prints: a payload that grew three evidence fields would be a second home
 * for a fact the register already holds (I-273).
 */
export type LineEvidence = {
  readonly lineId: string;
  readonly formula: string;
  readonly drawingId: string | null;
  readonly layoutName: string | null;
};

/** What the workbook is composed from: the draft screens and documents read, and that evidence. */
export type BoqExportReading = {
  readonly view: BoqView & { readonly payload: BoqDraftPayload };
  readonly evidence: readonly LineEvidence[];
};

/** The two sheets every workbook carries whatever the campaign published (A-BOQ-XLSX). */
export const BOQ_XLSX_SHEETS = Object.freeze({ summary: "Summary", quantities: "Quantities" });

/** The word a sheet cell states where the register holds nothing under that head. */
const NOTHING_HELD = "";

/* ------------------------------------------------------------------------- the sheets' shapes */

/** The header row stays put on every sheet: a reader who scrolls a bill keeps its columns. */
const FREEZE_HEADER = true;

/** The row a sheet's first line stands on — the header takes the first (the seam's own layout). */
const FIRST_LINE_ROW = 2;

/** A section sheet's seven columns, in A-BOQ-XLSX's own order. */
function sectionColumns(fractionDigits: number): readonly ExportColumn[] {
  return [
    { key: "item", header: "Item", kind: "text" },
    { key: "code", header: "Code", kind: "text" },
    { key: "description", header: "Description", kind: "text" },
    { key: "unit", header: "Unit", kind: "text" },
    { key: "quantity", header: "Quantity", kind: "number", fractionDigits },
    { key: "rate", header: "Rate", kind: "money" },
    { key: "amount", header: "Amount", kind: "money" },
  ];
}

/** The Summary's three: what the row names, what it says, and what it comes to (A-BOQ-XLSX). */
const SUMMARY_COLUMNS: readonly ExportColumn[] = [
  { key: "item", header: "Item", kind: "text" },
  { key: "description", header: "Description", kind: "text" },
  { key: "amount", header: "Amount", kind: "money" },
];

/** The Quantities sheet's columns: every line, with its bases, coverage, source sheet and formula. */
function quantitiesColumns(fractionDigits: number): readonly ExportColumn[] {
  return [
    { key: "item", header: "Item", kind: "text" },
    { key: "section", header: "Section", kind: "text" },
    { key: "line", header: "Line", kind: "text" },
    { key: "object", header: "Object", kind: "text" },
    { key: "class", header: "Class", kind: "text" },
    { key: "kind", header: "Kind", kind: "text" },
    { key: "description", header: "Description", kind: "text" },
    { key: "level", header: "Level", kind: "text" },
    { key: "quantity", header: "Quantity", kind: "number", fractionDigits },
    { key: "unit", header: "Unit", kind: "text" },
    { key: "quantityBasis", header: "Quantity basis", kind: "text" },
    { key: "selectionBasis", header: "Selection basis", kind: "text" },
    { key: "coverage", header: "Coverage", kind: "text" },
    { key: "drawing", header: "Drawing", kind: "text" },
    { key: "sourceSheet", header: "Source sheet", kind: "text" },
    { key: "formula", header: "Formula", kind: "text" },
    { key: "placedBy", header: "Placed by", kind: "text" },
    { key: "reason", header: "Reason", kind: "text" },
  ];
}

/* ------------------------------------------------------------------------- the pieces, named */

/**
 * The sheet one section is written on: its ordinal among L-BD-08's SIX, then its own label — the
 * number a reader can quote across two projects (AM-16 §1), and never the reserved word (AM-05).
 */
export function sectionSheetName(bill: string, label: string): string {
  return `${(BOQ_SECTIONS as readonly string[]).indexOf(bill) + 1} ${label}`;
}

/**
 * The Amount of an unpriced line: empty until a rate stands beside it, and the product of the two the
 * moment one does (A-BOQ-XLSX's live formulas, I-274).
 *
 * `E*F` alone would put `0.00` in every Amount of an unpriced draft — a figure nobody stated, on a
 * document that states it has no prices (B-21).
 */
export function amountFormula(row: number): string {
  return `IF(F${row}="","",E${row}*F${row})`;
}

/** The places one section is written to: the widest any kind standing in it is written to (I-275). */
function placesForSection(section: BoqDraftSection): number {
  return Math.max(...section.groups.map((group) => placesOf(group.kind)));
}

/** The lines of one section in the order the draft prints them — groups, then lines (AM-14 §2). */
function linesOf(section: BoqDraftSection): { readonly group: BoqDraftGroup; readonly line: BoqDraftLine }[] {
  return section.groups.flatMap((group) => group.lines.map((line) => ({ group, line })));
}

/** How a line reads across: what it is, and — where the stack knows — which storey it stands on. */
function descriptionOfLine(description: string, level: string): string {
  return level === NOTHING_HELD ? description : `${description} — ${level}`;
}

/** The (class, kind) pair a line is grouped under, as a reader quotes it back to this product. */
function codeOf(group: { readonly class: string; readonly kind: string }): string {
  return `${group.class}:${group.kind}`;
}

/* ---------------------------------------------------------------------------- the section sheet */

/**
 * One section as a sheet: a row per published line, numbered S.G.I, unpriced, with a live Amount, and
 * the section's own measured-scope feet under them (L-QTY-07's one lawful label).
 *
 * A foot is not an item and carries no number: an item number under a subtotal would be a line nobody
 * measured (AM-14 §2). Its own figures are SUMIFs over the unit column, so a reader who prices the
 * sheet sees the foot move with it rather than a frozen picture of what it once came to.
 */
function sectionSheetOf(section: BoqDraftSection, items: ReadonlyMap<string, string>): SheetSpec {
  const held = linesOf(section);
  const lastLine = FIRST_LINE_ROW + held.length - 1;

  const lines: ExportCell[][] = held.map(({ group, line }, index) => [
    items.get(line.lineId) ?? NOTHING_HELD,
    codeOf(group),
    descriptionOfLine(group.description, line.level),
    line.unit,
    line.quantity,
    null,
    { formula: amountFormula(FIRST_LINE_ROW + index) },
  ]);

  const feet: ExportCell[][] = section.subtotals.map((subtotal) => [
    null,
    null,
    MEASURED_SCOPE_SUBTOTAL,
    subtotal.unit,
    { formula: `SUMIF(D${FIRST_LINE_ROW}:D${lastLine},"${subtotal.unit}",E${FIRST_LINE_ROW}:E${lastLine})`, result: subtotal.value },
    null,
    { formula: `SUMIF(D${FIRST_LINE_ROW}:D${lastLine},"${subtotal.unit}",G${FIRST_LINE_ROW}:G${lastLine})` },
  ]);

  return {
    name: sectionSheetName(section.bill, section.label),
    columns: sectionColumns(placesForSection(section)),
    rows: [...lines, ...feet],
    freezeHeader: FREEZE_HEADER,
  };
}

/* --------------------------------------------------------------------------------- the summary */

/**
 * What the workbook says about itself before any figure: the draft's own title, the banner every page
 * of an unsigned working document carries (AM-05 §2), what it is a draft of, and the taxonomy the
 * sections were resolved under (L-BD-08) — then one live total per section sheet.
 *
 * There is no figure for the project. A draft that added its sections together would state a quantity
 * over a scope nobody covered (L-QTY-04, I-268), and the sums here are of PRICES, which nobody has
 * stated yet: each is a formula that comes to nothing until its sheet is priced.
 */
function summarySheetOf(reading: BoqExportReading): SheetSpec {
  const { payload } = reading.view;
  const rows: ExportCell[][] = [
    [null, BOQ_DRAFT_TITLE, null],
    [null, DRAFT_BANNER, null],
    [null, `Project: ${payload.project}`, null],
    [null, `Pinned revision: ${reading.view.setRevisionId ?? NOTHING_HELD}`, null],
    [null, `Taxonomy: ${payload.taxonomyVersion}`, null],
    [null, `Coverage: ${payload.coverage}`, null],
  ];

  for (const section of payload.sections) {
    const name = sectionSheetName(section.bill, section.label);
    const lastLine = FIRST_LINE_ROW + linesOf(section).length - 1;
    rows.push([`${(BOQ_SECTIONS as readonly string[]).indexOf(section.bill) + 1}`, section.label, { formula: `SUM('${name}'!G${FIRST_LINE_ROW}:G${lastLine})` }]);
  }

  return { name: BOQ_XLSX_SHEETS.summary, columns: SUMMARY_COLUMNS, rows, freezeHeader: FREEZE_HEADER };
}

/* ------------------------------------------------------------------------------ the quantities */

/**
 * Every published line of the campaign, placed or not, with what it was measured from beside it
 * (A-BOQ-XLSX, R-TO-070).
 *
 * It is the sheet the CSV is, which is why it is composed on its own: a line's bases, its coverage,
 * the drawing and sheet it came from and the formula it was computed by are what makes a figure
 * checkable by somebody who was not there (L-QTY-03).
 *
 * The unclassified stand at the end, labelled and carrying the reason the taxonomy could not place
 * them, with no item number: they are kept and visible, and they are not a seventh section
 * (L-BD-08, I-267).
 */
export function boqQuantitiesSheetOf(reading: BoqExportReading): SheetSpec {
  const { payload, items } = reading.view;
  const evidenceOf = new Map(reading.evidence.map((held) => [held.lineId, held]));

  const kinds = [...payload.sections.flatMap((section) => section.groups.map((group) => group.kind)), ...payload.unclassified.lines.map((line) => line.kind)];
  const places = kinds.length === 0 ? 0 : Math.max(...kinds.map((kind) => placesOf(kind)));

  const row = (
    cells: {
      readonly item: string | null;
      readonly section: string;
      readonly klass: string;
      readonly kind: string;
      readonly description: string;
      readonly reason: string | null;
    },
    line: BoqDraftLine,
  ): ExportCell[] => {
    const evidence = evidenceOf.get(line.lineId);
    return [
      cells.item,
      cells.section,
      line.lineId,
      line.objectKey,
      cells.klass,
      cells.kind,
      cells.description,
      line.level,
      line.quantity,
      line.unit,
      line.quantityBasis,
      line.selectionBasis,
      line.coverage,
      evidence?.drawingId ?? NOTHING_HELD,
      evidence?.layoutName ?? NOTHING_HELD,
      evidence?.formula ?? NOTHING_HELD,
      line.decidedBy,
      cells.reason,
    ];
  };

  const placed = payload.sections.flatMap((section) =>
    linesOf(section).map(({ group, line }) =>
      row(
        {
          item: items.get(line.lineId) ?? NOTHING_HELD,
          section: section.label,
          klass: group.class,
          kind: group.kind,
          description: group.description,
          reason: null,
        },
        line,
      ),
    ),
  );

  const unplaced = payload.unclassified.lines.map((line) =>
    row(
      {
        item: null,
        section: UNCLASSIFIED_LABEL,
        klass: line.class,
        kind: line.kind,
        description: descriptionOf(line.class, line.kind),
        reason: line.reason,
      },
      line,
    ),
  );

  return { name: BOQ_XLSX_SHEETS.quantities, columns: quantitiesColumns(places), rows: [...placed, ...unplaced], freezeHeader: FREEZE_HEADER };
}

/* ----------------------------------------------------------------------------- the workbook */

/**
 * The whole A-BOQ-XLSX workbook of one draft: the Summary, one sheet per section the draft emitted,
 * and the Quantities behind them.
 *
 * Resources and Assumptions/Exclusions are NOT written. Their sources are the resource outputs and
 * the certificate, and neither exists yet; an empty sheet under either name would be a claim this
 * product cannot support (A-BOQ-XLSX, AM-05, I-276).
 */
export function boqWorkbookSpecOf(reading: BoqExportReading): WorkbookSpec {
  const { payload, items } = reading.view;
  return {
    sheets: [summarySheetOf(reading), ...payload.sections.map((section) => sectionSheetOf(section, items)), boqQuantitiesSheetOf(reading)],
  };
}
