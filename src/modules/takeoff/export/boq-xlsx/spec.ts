// A-BOQ-XLSX as a VALUE: the draft a campaign published, composed into the sheet spec the one export
// seam writes (A-BOQ-XLSX, R-TO-070, AM-05, AM-14 §2, AM-16, L-BD-08, L-FMT-01).
//
// PURE, AND IT RE-DERIVES NOTHING. The figures are the draft payload's — each item the register's sum
// of its member lines rounded once, each member line its own register figure rounded once, both by
// the emission (L-MEA-05, s-boq I-528) — and the item numbers are the document's own
// `numberItems` (I-269): a workbook that re-rounded a quantity or re-numbered an item would be a second
// draft of the same campaign. Nothing here names a spreadsheet library: the seam is the one caller
// (R-SPINE-041), and what this file answers is a `WorkbookSpec`, which is data.
//
// THE SHAPE THE OWNER RULED. A section sheet reads like a bill: a group row naming each trade, then one
// priced ITEM per description under it, and no quantity added across descriptions — no foot, no
// group figure (I-529). The member lines behind each item stand on the Quantities sheet, each
// carrying the number of the item it is summed into, with the mark, grid, nos, dimensions and sheet a
// checker finds it by: the details of measurement, as rows a spreadsheet can filter.
//
// UNPRICED, AND IT SAYS SO (AM-05 §2, I-274). The Summary stamps `DRAFT — UNSIGNED` and states the
// project in words; every Rate is empty and every Amount is the LIVE formula that stays empty until
// somebody prices the item, so no figure nobody stated ever appears in a cell.
//
// THE RESERVED WORD APPEARS NOWHERE A READER LOOKS (AM-05, I-265, I-273). A-BOQ-XLSX's "bill sheets"
// are SECTION sheets, named by the section's ordinal among L-BD-08's six and its own label.
//
// WHERE NO FIGURE STANDS, THE ROW SAYS SO — AND THE QUANTITY CELL STAYS A NUMBER OR NOTHING (I-450,
// I-570). An item or a line that states no figure leaves its Quantity cell EMPTY and says
// `Not measured — <its reasons in words>` in a Remarks column beside it (the Quantities sheet's
// Reason) — the words the PDF prints, from the one spelling of them. Words in a number column were a
// trap: a rate typed against them made the Amount `#VALUE!`, and the Summary's section sum with it.
// The Amount is guarded the same way, computed only where both the quantity and the rate are
// numbers. What the draft published no line for stands on its own `Not measured` sheet, the PDF's
// closing page as rows (I-451).
import {
  draftLinesOf,
  itemQualifierOf,
  lineReasonsOf,
  notMeasuredScopeOf,
  type BoqDraftItem,
  type BoqDraftLine,
  type BoqDraftPayload,
  type BoqDraftSection,
} from "@/core/documents/kinds/boq-draft";
import {
  BOQ_DRAFT_TITLE,
  BOQ_SECTIONS,
  COVERAGE_WORDS,
  DRAFT_BANNER,
  FRONT_LABELS,
  LINE_REASONS_HEADING,
  NOT_MEASURED,
  NOT_MEASURED_SCOPE_HEADING,
  NOT_STATED,
  descriptionOf,
  inWords,
  notMeasuredWords,
  placesOf,
  taxonomyInWords,
  withLevel,
} from "@/core/documents/kinds/boq-draft-law";
import type { ExportCell, ExportColumn, SheetSpec, WorkbookSpec } from "@/core/exports";
import type { BoqView } from "@/modules/takeoff/boq/view";
import { UNCLASSIFIED_LABEL } from "@/modules/takeoff/boq/taxonomy";

/* ------------------------------------------------------------------ what the composer is handed */

/**
 * One line's evidence, as the register holds it (R-TO-070, L-QTY-03): the formula the figure was
 * computed by, the drawing it was measured off and the sheet that drawing prints on.
 *
 * It is JOINED by `lineId` rather than carried on the draft payload, whose schema is strict and whose
 * subject is what a document prints: a payload that grew the formula string would be a second home
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

/**
 * The two sheets every workbook carries whatever the campaign published (A-BOQ-XLSX), and the one it
 * carries where the draft left anything out (I-451).
 */
export const BOQ_XLSX_SHEETS = Object.freeze({ summary: "Summary", quantities: "Quantities", notMeasured: NOT_MEASURED });

/** The word a sheet cell states where the register holds nothing under that head. */
const NOTHING_HELD = "";

/* ------------------------------------------------------------------------- the sheets' shapes */

/** The header row stays put on every sheet: a reader who scrolls a bill keeps its columns. */
const FREEZE_HEADER = true;

/** The row a sheet's first body row stands on — the header takes the first (the seam's own layout). */
const FIRST_LINE_ROW = 2;

/** The column a section sheet says an unmeasured item's words in, beside its empty Quantity (I-570). */
export const REMARKS_HEADER = "Remarks";

/**
 * A section sheet's columns: A-BOQ-XLSX's seven in its own order, then the Remarks a row with no
 * figure says why in. Remarks stands LAST so the seven keep their letters — the Amount is G, which the
 * Summary's section sums read.
 */
function sectionColumns(fractionDigits: number): readonly ExportColumn[] {
  return [
    { key: "item", header: "Item", kind: "text" },
    { key: "code", header: "Code", kind: "text" },
    { key: "description", header: "Description", kind: "text" },
    { key: "unit", header: "Unit", kind: "text" },
    { key: "quantity", header: "Quantity", kind: "number", fractionDigits },
    { key: "rate", header: "Rate", kind: "money" },
    { key: "amount", header: "Amount", kind: "money" },
    { key: "remarks", header: REMARKS_HEADER, kind: "text" },
  ];
}

/** The Summary's three: what the row names, what it says, and what it comes to (A-BOQ-XLSX). */
const SUMMARY_COLUMNS: readonly ExportColumn[] = [
  { key: "item", header: "Item", kind: "text" },
  { key: "description", header: "Description", kind: "text" },
  { key: "amount", header: "Amount", kind: "money" },
];

/**
 * The Quantities sheet's columns: every member line, the item it is summed into, what a checker
 * finds it by, its bases, coverage, source sheet and formula (A-BOQ-XLSX, I-528).
 */
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
    { key: "mark", header: "Mark", kind: "text" },
    { key: "grid", header: "Grid", kind: "text" },
    { key: "nos", header: "Nos", kind: "text" },
    { key: "dimensions", header: "Dimensions", kind: "text" },
    { key: "sheetNumber", header: "Sheet number", kind: "text" },
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
 * The Amount of an unpriced item: empty until a rate stands beside a quantity, and the product of the
 * two the moment both are numbers (A-BOQ-XLSX's live formulas, I-274, I-570).
 *
 * `E*F` alone would put `0.00` in every Amount of an unpriced draft — a figure nobody stated, on a
 * document that states it has no prices (B-21). And a rate typed against an item with no quantity
 * must leave the Amount empty rather than `#VALUE!`, which would carry into the Summary's section sum
 * and blank the whole section's price: so both cells are asked `ISNUMBER` before they are multiplied.
 */
export function amountFormula(row: number): string {
  return `IF(AND(ISNUMBER(E${row}),ISNUMBER(F${row})),E${row}*F${row},"")`;
}

/** The places one section is written to: the widest any kind standing in it is written to (I-275). */
function placesForSection(section: BoqDraftSection): number {
  return Math.max(...section.groups.map((group) => placesOf(group.kind)));
}

/**
 * What an item's Remarks cell says: nothing where the payload settled a figure, and — where no member
 * states one — the words that say so and why (I-450). The Quantity cell beside it stays empty, so a
 * spreadsheet never meets words where it adds numbers (I-570).
 */
function itemRemarksOf(item: BoqDraftItem): string | null {
  return item.quantity === null ? notMeasuredWords(item.lines.flatMap((line) => line.omitted ?? [])) : null;
}

/** What a member line's Reason says about its figure: nothing where it states one, else the words and why. */
function lineRemarksOf(line: BoqDraftLine): string | null {
  return line.quantity === null ? notMeasuredWords(line.omitted ?? []) : null;
}

/**
 * How an item reads across a sheet with no Level column: its description, the storey it is priced
 * at, and — where not every member line states a figure — how much of it the figure covers (I-450).
 */
function itemDescriptionCellOf(item: BoqDraftItem): string {
  const qualifier = itemQualifierOf(item);
  const described = withLevel(item.description, item.level);
  return qualifier === "" ? described : `${described} (${qualifier})`;
}

/** The (class, kind) pair an item is grouped under, as a reader quotes it back to this product. */
function codeOf(group: { readonly class: string; readonly kind: string }): string {
  return `${group.class}:${group.kind}`;
}

/** Every item of a payload, keyed by the id of each member line summed into it. */
function itemOfLine(payload: BoqDraftPayload): ReadonlyMap<string, { readonly item: BoqDraftItem; readonly section: BoqDraftSection; readonly klass: string; readonly kind: string }> {
  const held = new Map<string, { item: BoqDraftItem; section: BoqDraftSection; klass: string; kind: string }>();
  for (const section of payload.sections) {
    for (const group of section.groups) {
      for (const item of group.items) for (const line of item.lines) held.set(line.lineId, { item, section, klass: group.class, kind: group.kind });
    }
  }
  return held;
}

/* ---------------------------------------------------------------------------- the section sheet */

/**
 * One section as a sheet, in the shape the owner ruled (I-528, I-529): for each group a
 * row naming the trade — no number, no figure — then one row per ITEM, numbered S.G.I, its quantity
 * the register's sum of its members rounded once, unpriced, with a live Amount.
 *
 * No quantity foot and no group figure: a group or a section holds unlike descriptions, and a
 * quantity added across descriptions is the volume of nothing that exists (walk-0's `509.358 m3`).
 * The section's Amounts are summed on the Summary, where money is commensurable.
 */
function sectionSheetOf(section: BoqDraftSection, items: ReadonlyMap<string, string>): SheetSpec {
  const rows: ExportCell[][] = [];
  for (const group of section.groups) {
    rows.push([null, null, descriptionOf(group.class, group.kind), null, null, null, null, null]);
    for (const item of group.items) {
      const row = FIRST_LINE_ROW + rows.length;
      rows.push([items.get(item.key) ?? NOTHING_HELD, codeOf(group), itemDescriptionCellOf(item), item.unit, item.quantity, null, { formula: amountFormula(row) }, itemRemarksOf(item)]);
    }
  }
  return {
    name: sectionSheetName(section.bill, section.label),
    columns: sectionColumns(placesForSection(section)),
    rows,
    freezeHeader: FREEZE_HEADER,
  };
}

/** How many body rows a section's sheet writes: a group row per group and a row per item. */
function bodyRowsOf(section: BoqDraftSection): number {
  return section.groups.reduce((held, group) => held + 1 + group.items.length, 0);
}

/* --------------------------------------------------------------------------------- the summary */

/**
 * What the workbook says about itself before any figure: the draft's own title, the banner every page
 * of an unsigned working document carries (AM-05 §2), the project in words — client, site, the
 * pinned drawing set, the day it was issued, the taxonomy the sections were resolved under (L-BD-08)
 * and whether the measurement is complete (I-530) — then one live total per section sheet.
 * No surrogate id stands anywhere on it.
 *
 * There is no figure for the project. A draft that added its sections together would state a quantity
 * over a scope nobody covered (L-QTY-04, I-268), and the sums here are of PRICES, which nobody has
 * stated yet: each is a formula that comes to nothing until its sheet is priced.
 */
function summarySheetOf(reading: BoqExportReading): SheetSpec {
  const { payload } = reading.view;
  const front = payload.front;
  const drawings = front?.drawings ?? [];
  const facts: readonly [string, string][] = [
    [FRONT_LABELS.project, payload.project],
    [FRONT_LABELS.client, front?.client ?? NOT_STATED],
    [FRONT_LABELS.site, front?.site ?? NOT_STATED],
    [FRONT_LABELS.drawingSet, front?.drawingSet ?? NOT_STATED],
    [FRONT_LABELS.drawings, drawings.length === 0 ? NOT_STATED : drawings.join(", ")],
    ...(front?.issued === null || front?.issued === undefined ? [] : [[FRONT_LABELS.issued, front.issued] as [string, string]]),
    [FRONT_LABELS.taxonomy, taxonomyInWords(payload.taxonomyVersion)],
    [FRONT_LABELS.measurement, payload.coverage === "COMPLETE" ? COVERAGE_WORDS.COMPLETE : COVERAGE_WORDS.INCOMPLETE],
  ];
  const rows: ExportCell[][] = [[null, BOQ_DRAFT_TITLE, null], [null, DRAFT_BANNER, null], ...facts.map(([label, value]): ExportCell[] => [null, `${label}: ${value}`, null])];

  for (const section of payload.sections) {
    const name = sectionSheetName(section.bill, section.label);
    const lastLine = FIRST_LINE_ROW + bodyRowsOf(section) - 1;
    rows.push([`${(BOQ_SECTIONS as readonly string[]).indexOf(section.bill) + 1}`, section.label, { formula: `SUM('${name}'!G${FIRST_LINE_ROW}:G${lastLine})` }]);
  }

  return { name: BOQ_XLSX_SHEETS.summary, columns: SUMMARY_COLUMNS, rows, freezeHeader: FREEZE_HEADER };
}

/* ------------------------------------------------------------------------------ the quantities */

/**
 * Every published member line of the campaign, placed or not, with the item it is summed into and
 * what it was measured from beside it (A-BOQ-XLSX, R-TO-070, I-528).
 *
 * It is the sheet the CSV is, which is why it is composed on its own: a line's item, its mark, grid,
 * nos and dimensions, its bases, its coverage, the drawing and sheet it came from and the formula it
 * was computed by are what makes a figure checkable by somebody who was not there (L-QTY-03) — the
 * details of measurement, one row per member.
 *
 * The unclassified stand at the end, labelled and carrying the reason the taxonomy could not place
 * them, with no item number: they are kept and visible, and they are not a seventh section
 * (L-BD-08, I-267).
 */
export function boqQuantitiesSheetOf(reading: BoqExportReading): SheetSpec {
  const { payload, items } = reading.view;
  const evidenceOf = new Map(reading.evidence.map((held) => [held.lineId, held]));
  const carried = itemOfLine(payload);

  const kinds = [...payload.sections.flatMap((section) => section.groups.map((group) => group.kind)), ...payload.unclassified.lines.map((line) => line.kind)];
  const places = kinds.length === 0 ? 0 : Math.max(...kinds.map((kind) => placesOf(kind)));

  const rowOf = (line: BoqDraftLine, cells: { readonly item: string | null; readonly section: string; readonly klass: string; readonly kind: string; readonly description: string; readonly reason: string | null }): ExportCell[] => {
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
      line.mark ?? NOTHING_HELD,
      line.grid ?? NOTHING_HELD,
      line.nos ?? NOTHING_HELD,
      line.dimensions ?? NOTHING_HELD,
      line.sheet ?? NOTHING_HELD,
      line.quantity,
      line.unit,
      line.quantityBasis,
      line.selectionBasis,
      line.coverage,
      evidence?.drawingId ?? NOTHING_HELD,
      evidence?.layoutName ?? NOTHING_HELD,
      evidence?.formula ?? NOTHING_HELD,
      line.decidedBy,
      // Why the line sits where it does and why it states no figure, where either needs saying: the
      // taxonomy's reason for an unplaced line, then the not-measured words (I-450, I-570).
      [cells.reason, lineRemarksOf(line)].filter((said): said is string => said !== null && said !== "").join("; ") || null,
    ];
  };

  const placed = draftLinesOf({ sections: payload.sections, unclassified: { label: payload.unclassified.label, lines: [] } }).map((line) => {
    const held = carried.get(line.lineId);
    return rowOf(line, {
      item: held === undefined ? NOTHING_HELD : (items.get(held.item.key) ?? NOTHING_HELD),
      section: held?.section.label ?? NOTHING_HELD,
      klass: held?.klass ?? NOTHING_HELD,
      kind: held?.kind ?? NOTHING_HELD,
      description: held === undefined ? NOTHING_HELD : withLevel(held.item.description, held.item.level),
      reason: null,
    });
  });

  const unplaced = payload.unclassified.lines.map((line) =>
    rowOf(line, { item: null, section: UNCLASSIFIED_LABEL, klass: line.class, kind: line.kind, description: descriptionOf(line.class, line.kind), reason: inWords(line.reason) }),
  );

  return { name: BOQ_XLSX_SHEETS.quantities, columns: quantitiesColumns(places), rows: [...placed, ...unplaced], freezeHeader: FREEZE_HEADER };
}

/* ---------------------------------------------------------------------------- the not measured */

/** The `Not measured` sheet's four columns: which part of the statement, what, over which levels, why. */
const NOT_MEASURED_COLUMNS: readonly ExportColumn[] = [
  { key: "part", header: "Part", kind: "text" },
  { key: "description", header: "Description", kind: "text" },
  { key: "levels", header: "Levels", kind: "text" },
  { key: "why", header: "Why", kind: "text" },
];

/**
 * What the draft leaves out, as a sheet (I-451): the PDF's closing page, row for row — the scope no
 * line was published for, then each reason a line states no figure beside the registry's own
 * sentence for it — under one header, so a reader can filter it like any other sheet. `null` where the
 * draft left nothing out: a sheet of that name with nothing on it would be a claim with no content.
 */
export function boqNotMeasuredSheetOf(payload: BoqDraftPayload): SheetSpec | null {
  const scope = notMeasuredScopeOf(payload).map((row): ExportCell[] => [NOT_MEASURED_SCOPE_HEADING, row.about, row.levels, row.why]);
  const reasons = lineReasonsOf(payload).map((row): ExportCell[] => [LINE_REASONS_HEADING, row.reason, NOTHING_HELD, row.meaning]);
  if (scope.length + reasons.length === 0) return null;
  return { name: BOQ_XLSX_SHEETS.notMeasured, columns: NOT_MEASURED_COLUMNS, rows: [...scope, ...reasons], freezeHeader: FREEZE_HEADER };
}

/* ----------------------------------------------------------------------------- the workbook */

/**
 * The whole A-BOQ-XLSX workbook of one draft: the Summary, one sheet per section the draft emitted,
 * the Quantities behind them, and — where the draft left anything out — the `Not measured` sheet
 * that says what (I-451).
 *
 * Resources and Assumptions/Exclusions are NOT written. Their sources are the resource outputs and
 * the certificate, and neither exists yet; an empty sheet under either name would be a claim this
 * product cannot support (A-BOQ-XLSX, AM-05, I-276). The `Not measured` sheet is neither: it states
 * the measurement boundary the residue computes, signs nothing and assumes nothing.
 */
export function boqWorkbookSpecOf(reading: BoqExportReading): WorkbookSpec {
  const { payload, items } = reading.view;
  const notMeasured = boqNotMeasuredSheetOf(payload);
  return {
    sheets: [
      summarySheetOf(reading),
      ...payload.sections.map((section) => sectionSheetOf(section, items)),
      boqQuantitiesSheetOf(reading),
      ...(notMeasured === null ? [] : [notMeasured]),
    ],
  };
}
