/**
 * The stage A-BOQ-XLSX's composer, its door and its aside are judged over (inc-312: A-BOQ-XLSX,
 * R-TO-070, AM-14 §2, AM-16, L-FMT-01).
 *
 * MECHANICS ONLY — nothing here judges the product. It holds the loading of the modules the
 * increment's interfaces name, the loose shapes those surfaces answer in, the reading the
 * F-RCC6-BNBC golden roster makes, and the read-back of built bytes. Every judgement lives in the
 * suites beside it, so this file cannot be edited into agreement with a product that does not
 * satisfy a criterion.
 *
 * It stands in `tests/` rather than under the module's own `__tests__/` because R-SPINE-041's
 * committed scan bans the spreadsheet library from `src/**` outside `src/core/exports/**`
 * (`src/core/exports/__tests__/exceljs-import-scan.ts`), and AC-1 and AC-3 read a built workbook
 * BACK with exceljs. A suite under `src/modules/takeoff/export/boq-xlsx/__tests__/` that named the
 * library would break that shipped law; `tests/**` is not source the ban governs, and the root
 * vitest config collects it either way.
 *
 * Product modules are loaded by absolute path (`productModule`), so a file the Builder has not
 * written yet fails as an assertion naming it rather than as a collection death that would read as
 * a defect in the acceptance. Every type of a not-yet-written surface is a loose local shape, so
 * this file typechecks against today's tree and grades tomorrow's.
 *
 * Nothing here reads product SOURCE: every name below is one the increment's interfaces, its test
 * contract or docs/design/s-boq.md publishes.
 *
 * This file serves both lanes — the public suites beside it and the held-out set, which loads it
 * from the checkout by absolute path. Keep it free of judgement so neither lane can hide one here.
 */
import { readFileSync } from "node:fs";
import ExcelJS from "exceljs";
import { expect } from "vitest";
import { goldenRows } from "../../../golden/support/golden-fixture";
import {
  COMPLETE,
  GOLDEN_CLASS,
  GOLDEN_KIND,
  MEASURED,
  REPO_ROOT,
  attr,
  catalogue,
  cleanup,
  codeOf,
  fireEvent,
  hook,
  hooks,
  inTree,
  mountBoq,
  productModule,
  registeredRefusalOf,
  rejection,
  stackOf,
  textOf,
  waitFor,
  type LevelShape,
  type PayloadShape,
  type ReadingLineShape,
} from "../../boq/support/boq-stage";

/** Mechanics the suites of both lanes reach through this one file, re-published rather than re-made. */
export {
  COMPLETE,
  GOLDEN_CLASS,
  GOLDEN_KIND,
  MEASURED,
  REPO_ROOT,
  attr,
  catalogue,
  cleanup,
  codeOf,
  fireEvent,
  hook,
  hooks,
  inTree,
  mountBoq,
  productModule,
  registeredRefusalOf,
  rejection,
  stackOf,
  textOf,
  waitFor,
};
export type { LevelShape, PayloadShape, ReadingLineShape };

/* ----------------------------------------------------------- the modules the interfaces name */

/** The composer this increment lands, and the composition beside it (interfaces). */
export const SPEC_MODULE = "src/modules/takeoff/export/boq-xlsx/spec.ts";
export const SERVER_MODULE = "src/modules/takeoff/export/boq-xlsx/server.ts";
export const BOQ_XLSX_MODULE = "src/modules/takeoff/export/boq-xlsx/index.ts";

/** The door the aside presses, and the shipped route that serves what it addresses (test contract). */
export const BOQ_ROUTER_MODULE = "src/server/routers/takeoff-boq.ts";
export const EXPORTS_ROUTE_MODULE = "src/app/api/exports/[id]/route.ts";

/** Shipped ground this acceptance reads through, never re-declares. */
export const EXPORTS_SEAM_MODULE = "src/core/exports/index.ts";
export const STORAGE_APP_MODULE = "src/core/storage/app.ts";
export const FORMAT_MODULE = "src/core/format.ts";
export const BOQ_DRAFT_LAW_MODULE = "src/core/documents/kinds/boq-draft-law.ts";
export const EMISSION_MODULE = "src/modules/takeoff/boq/emission.ts";
export const NUMBERING_MODULE = "src/modules/takeoff/boq/numbering.ts";
export const TAXONOMY_MODULE = "src/modules/takeoff/boq/taxonomy.ts";

/* -------------------------------------------------------- the vocabulary, exactly as published */

/** The fixture the numeric proof runs over, and the model its level stack is built from (goal). */
export const BNBC_FIXTURE = "rcc6-bnbc";
export const BNBC_MODEL = "fixtures/rcc6-bnbc/model.json";

/** The two sheets every workbook carries by name (interfaces: `BOQ_XLSX_SHEETS`). */
export const SUMMARY_SHEET = "Summary";
export const QUANTITIES_SHEET = "Quantities";

/** A section sheet's header, in the order A-BOQ-XLSX names the columns. */
export const SECTION_HEADER: readonly string[] = Object.freeze(["Item", "Code", "Description", "Unit", "Quantity", "Rate", "Amount"]);

/** The two words the Summary stamps every unsigned page with (AM-05, A-BOQ-PDF). */
export const BOQ_DRAFT_TITLE = "Draft BOQ — unpriced";
export const DRAFT_BANNER = "DRAFT — UNSIGNED";

/** The kinds the door writes, and the permission it moves (R-TO-070, L-ACT-03). */
export const XLSX = "xlsx";
export const CSV = "csv";
export const MEASURE = "MEASURE";

/** The codes this lane answers by name, read back off the register in the suites themselves. */
export const PERMISSION_NOT_HELD = "PERMISSION_NOT_HELD";
export const BOQ_NO_CAMPAIGN = "BOQ_NO_CAMPAIGN";
export const BOQ_NO_PUBLISHED_LINE = "BOQ_NO_PUBLISHED_LINE";
export const REQUEST_MALFORMED = "REQUEST_MALFORMED";

/** The ids S-BOQ publishes for the export — exactly the closed test surface's spellings. */
export const TESTID = Object.freeze({
  screen: "boq-screen",
  answer: "boq-answer",
  jobs: "boq-jobs",
  export: "boq-export",
  exportXlsx: "boq-export-xlsx",
  exportCsv: "boq-export-csv",
  exportLink: "boq-export-link",
  refusalState: "refusal-state",
} as const);

/** The copy the link carries, verbatim from the amended docs/design/s-boq.md §3. */
export const SAVE_THE_FILE = "Save the file";

/* -------------------------------------------------------------------- the shapes, loosely held */

/** One cell of a sheet spec: text, nothing, or a live formula (shipped `ExportCell`). */
export type CellShape = string | null | { formula: string; result?: string };

export type ColumnShape = { key: string; header: string; kind: string; fractionDigits?: number };

export type SheetShape = { name: string; columns: ColumnShape[]; rows: CellShape[][]; freezeHeader: boolean };

export type WorkbookShape = { sheets: SheetShape[] };

/** The register's evidence for one line, joined by lineId (interfaces: `LineEvidence`). */
export type EvidenceShape = { lineId: string; formula: string; drawingId: string | null; layoutName: string | null };

/** What the composer is handed (interfaces: `BoqExportReading`). */
export type ExportViewShape = {
  campaignId: string | null;
  setRevisionId: string | null;
  taxonomyVersion: string;
  coverage: string;
  payload: PayloadShape;
  items: ReadonlyMap<string, string>;
};
export type ExportReadingShape = { view: ExportViewShape; evidence: EvidenceShape[] };

/** The composer, as this acceptance calls it (interfaces). */
export type SpecModule = {
  boqWorkbookSpecOf: (reading: ExportReadingShape) => WorkbookShape;
  boqQuantitiesSheetOf: (reading: ExportReadingShape) => SheetShape;
  sectionSheetName?: (bill: string, label: string) => string;
  amountFormula?: (row: number) => string;
  BOQ_XLSX_SHEETS?: Readonly<Record<string, string>>;
};

/** The composition beside it (interfaces). */
export type ServerModule = {
  buildBoqExport: (reading: ExportReadingShape, kind: string) => Promise<Uint8Array>;
  boqExportReadingOf: (scope: { tenantId: string; projectId: string }) => Promise<ExportReadingShape | null>;
};

/** The shipped export seam, read through its barrel (R-SPINE-041). */
export type ExportsSeam = {
  buildWorkbook: (spec: WorkbookShape) => Promise<Uint8Array>;
  writeCsv: (sheet: SheetShape) => Uint8Array;
  exportAddress: (bytes: Uint8Array) => string;
  exportDownloadUrl: (storage: unknown, link: { tenantId: string; sha256: string; kind: string; expiresInSeconds: number }) => string;
  storeExport: (storage: unknown, tenantId: string, bytes: Uint8Array) => Promise<{ sha256: string }>;
  lakhCroreNumberFormat: (fractionDigits: number) => string;
  MIME_OF_KIND: Record<string, string>;
  EXPORT_KINDS: readonly string[];
};

/** The draft's own law, which both faces of a draft already read (I-269). */
export type DraftLawModule = {
  BOQ_SECTIONS: readonly string[];
  numberItems: (sections: readonly unknown[]) => ReadonlyMap<string, string>;
  placesOf: (kind: string) => number;
  placesForUnit: (groups: readonly { kind: string; unit: string }[], unit: string) => number;
};

/* --------------------------------------------------------------- the shipped ground, loaded */

export const specModule = (): Promise<SpecModule> => productModule<SpecModule>(SPEC_MODULE);
export const serverModule = (): Promise<ServerModule> => productModule<ServerModule>(SERVER_MODULE);
export const exportsSeam = (): Promise<ExportsSeam> => productModule<ExportsSeam>(EXPORTS_SEAM_MODULE);
export const draftLaw = (): Promise<DraftLawModule> => productModule<DraftLawModule>(BOQ_DRAFT_LAW_MODULE);

/** The document convention's own money precision — read, never transcribed (L-FMT-01). */
export async function moneyFractionDigits(): Promise<number> {
  const format = await productModule<{ BD_DOCUMENT: { moneyFractionDigits: number } }>(FORMAT_MODULE);
  return format.BD_DOCUMENT.moneyFractionDigits;
}

/** The label a draft gives the block of lines the taxonomy could not place (L-BD-08). */
export async function unclassifiedLabel(): Promise<string> {
  const taxonomy = await productModule<{ UNCLASSIFIED_LABEL: string }>(TAXONOMY_MODULE);
  return taxonomy.UNCLASSIFIED_LABEL;
}

/* ------------------------------------------------------------------- a reading, assembled */

/** What a reading is made of before the emission places it (interfaces: `BoqReading`). */
export type ReadingDraft = {
  project?: string;
  campaignId?: string;
  setRevisionId?: string;
  levels: readonly LevelShape[];
  lines: readonly ReadingLineShape[];
  evidence: readonly EvidenceShape[];
  coverageComplete?: boolean;
};

/** Ids that stand for a campaign and a revision in a pure reading — never read, only carried. */
export const STAGE_CAMPAIGN = "33333333-3333-4333-8333-333333333333";
export const STAGE_REVISION = "44444444-4444-4444-8444-444444444444";
export const STAGE_DRAWING = "55555555-5555-4555-8555-555555555555";

/**
 * One `BoqExportReading` over the lines and levels a caller states: the payload is the EMISSION's
 * (never a shape spelled here) and the numbers are the DOCUMENT's own (I-269), so a suite grades
 * the composer against the draft the product itself would have emitted.
 */
export async function readingOf(draft: ReadingDraft): Promise<ExportReadingShape> {
  const emission = await productModule<{ boqDraftPayloadOf: (reading: unknown) => PayloadShape }>(EMISSION_MODULE);
  const numbering = await productModule<{ numberItems: (sections: readonly unknown[]) => ReadonlyMap<string, string> }>(NUMBERING_MODULE);
  const campaignId = draft.campaignId ?? STAGE_CAMPAIGN;
  const setRevisionId = draft.setRevisionId ?? STAGE_REVISION;
  const payload = emission.boqDraftPayloadOf({
    project: draft.project ?? "Sattva Heights",
    campaignId,
    setRevisionId,
    levels: draft.levels,
    lines: draft.lines,
    coverageComplete: draft.coverageComplete ?? true,
  });
  return {
    view: {
      campaignId,
      setRevisionId,
      taxonomyVersion: payload.taxonomyVersion,
      coverage: payload.coverage,
      payload,
      items: numbering.numberItems(payload.sections),
    },
    evidence: [...draft.evidence],
  };
}

/** The F-RCC6-BNBC golden's own rows, spelled the product's way, with the stack they stand on. */
export type RosterRow = { lineId: string; class: string; kind: string; level: string; quantity: string; formula: string };

export function rosterRows(): { rows: RosterRow[]; levels: LevelShape[] } {
  const golden = goldenRows(BNBC_FIXTURE);
  // The fixture's own model records each storey's elevation, so a fixture that gains a floor gains
  // an ordinal rather than breaking a suite (test contract: fixtures/rcc6-bnbc/model.json).
  const model = JSON.parse(readFileSync(inTree(BNBC_MODEL), "utf8")) as { levels?: Record<string, string> };
  const labels = [...new Set(golden.map((row) => row.level))];
  const levels = stackOf(labels, model.levels ?? {});
  const rows = golden.flatMap((row, index) => {
    const klass = GOLDEN_CLASS[row.class];
    const kind = GOLDEN_KIND[row.kind];
    // A golden word the maps do not carry is a row this increment does not run — REBAR until the
    // kind is in KINDS (inc-309's ground), and WALL, which is no element class of this roster.
    if (klass === undefined || kind === undefined) return [];
    return [{ lineId: `g-${index}`, class: klass, kind, level: row.level, quantity: row.quantity, formula: row.formula ?? "" }];
  });
  return { rows, levels };
}

/**
 * The reading the golden roster makes (AC-1): one published line per kept row, at the canonical
 * unit its kind is catalogued in, with the row's own formula, a drawing and its storey beside it as
 * the register's evidence.
 */
export async function rosterReading(): Promise<ExportReadingShape> {
  const { rows, levels } = rosterRows();
  const items = await catalogue();
  const levelIdOf = new Map(levels.map((level) => [level.label, level.levelId]));

  const lines: ReadingLineShape[] = [];
  const evidence: EvidenceShape[] = [];
  for (const row of rows) {
    const unit = items[row.kind]?.canonicalUnit;
    if (unit === undefined) continue;
    lines.push({
      lineId: row.lineId,
      objectKey: `${row.class}/${row.level}/${row.lineId}`,
      class: row.class,
      kind: row.kind,
      levelId: levelIdOf.get(row.level) ?? null,
      value: row.quantity,
      unit,
      quantityBasis: MEASURED,
      selectionBasis: MEASURED,
      coverage: COMPLETE,
    });
    evidence.push({ lineId: row.lineId, formula: row.formula, drawingId: STAGE_DRAWING, layoutName: row.level });
  }

  expect(lines.length, "the BNBC golden bears rows this product's rosters hold — a reading of nothing would grade nothing").toBeGreaterThan(0);
  return readingOf({ levels, lines, evidence });
}

/* ----------------------------------------------------------------- reading built bytes back */

/** A built workbook, opened as a reader's spreadsheet opens it (A-BOQ-XLSX, J-030). */
export async function openWorkbook(bytes: Uint8Array): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  const held = Buffer.from(bytes);
  await workbook.xlsx.load(held.buffer.slice(held.byteOffset, held.byteOffset + held.byteLength) as ArrayBuffer);
  return workbook;
}

/**
 * A number format code as the READER hands it back.
 *
 * The seam writes a conditional lakh/crore code whose separators are escaped, because Excel would
 * otherwise regroup them by threes — and exceljs renders a `formatCode` verbatim on the way out
 * (`lib/xlsx/xform/style/numfmt-xform.js:32`) but strips those escapes on the way back in (`:40`).
 * The escapes are therefore IN the artefact and can never be in the reader's model: a read-back is
 * compared to the same code unescaped. The seam's own `workbook-fidelity.test.ts` reads this exact
 * point the same way; what a clause requires of the product is the code, not the reader's rendering
 * of it (L-FMT-01, A-BOQ-XLSX).
 */
export function asRead(code: string): string {
  return code.replace(/\\(.)/gu, "$1");
}

/** The sheet names a workbook carries, in the order a reader meets them. */
export function sheetNames(workbook: ExcelJS.Workbook): string[] {
  return workbook.worksheets.map((sheet) => sheet.name);
}

/** One sheet by name, asserted to stand before it is read. */
export function sheetNamed(workbook: ExcelJS.Workbook, name: string): ExcelJS.Worksheet {
  const found = workbook.worksheets.find((sheet) => sheet.name === name);
  expect(found, `the workbook carries a sheet named ${JSON.stringify(name)}; it carries ${JSON.stringify(sheetNames(workbook))}`).toBeDefined();
  return found as ExcelJS.Worksheet;
}

/** What one cell holds as TEXT — a formula cell answers its own result's text, never its formula. */
export function cellText(sheet: ExcelJS.Worksheet, row: number, column: number): string {
  const value = sheet.getRow(row).getCell(column).value;
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return String((value as { result?: unknown }).result ?? "");
  return String(value);
}

/** The formula a cell carries, or `null` where it carries none (A-BOQ-XLSX: live formulas). */
export function cellFormula(sheet: ExcelJS.Worksheet, row: number, column: number): string | null {
  const cell = sheet.getRow(row).getCell(column);
  return typeof cell.formula === "string" && cell.formula.length > 0 ? cell.formula : null;
}

/** The row every sheet's header stands on, and the first row a line can stand on beneath it. */
export const HEADER_ROW = 1;
export const FIRST_BODY_ROW = 2;

/** A whole row as text, to the width of the columns a sheet declares. */
export function rowText(sheet: ExcelJS.Worksheet, row: number, width: number): string[] {
  return Array.from({ length: width }, (_unused, index) => cellText(sheet, row, index + 1));
}

/** The lines of a payload in the order the sections print them — groups then lines (AM-14 §2). */
export function sectionLines(payload: PayloadShape): { section: PayloadShape["sections"][number]; line: PayloadShape["sections"][number]["groups"][number]["lines"][number]; group: PayloadShape["sections"][number]["groups"][number] }[] {
  return payload.sections.flatMap((section) => section.groups.flatMap((group) => group.lines.map((line) => ({ section, group, line }))));
}

/** The text of a CSV artefact, as the reader on the far side of the link decodes it (RFC 4180). */
export function csvLines(bytes: Uint8Array): string[] {
  return Buffer.from(bytes).toString("utf8").split("\r\n");
}

/**
 * A CSV artefact as its fields, read the way RFC 4180 says to read one: a quoted field may hold a
 * comma, a newline and a doubled quote, so a split on `,` would tear a formula in half. Mechanics —
 * this is the reader every other program on the far side of the link has.
 */
export function csvRows(bytes: Uint8Array): string[][] {
  const text = Buffer.from(bytes).toString("utf8");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let at = 0;
  while (at < text.length) {
    const char = text[at] as string;
    if (quoted) {
      if (char === '"' && text[at + 1] === '"') {
        field += '"';
        at += 2;
        continue;
      }
      if (char === '"') {
        quoted = false;
        at += 1;
        continue;
      }
      field += char;
      at += 1;
      continue;
    }
    if (char === '"') {
      quoted = true;
      at += 1;
      continue;
    }
    if (char === ",") {
      row.push(field);
      field = "";
      at += 1;
      continue;
    }
    if (char === "\r" && text[at + 1] === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      at += 2;
      continue;
    }
    field += char;
    at += 1;
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** A sheet or an artefact read as a table: the header a reader sees, and the rows beneath it. */
export type Table = { header: string[]; rows: string[][] };

/** One worksheet of an opened workbook, as text — every cell the sheet declares a column for. */
export function sheetTable(sheet: ExcelJS.Worksheet): Table {
  const width = sheet.columnCount;
  return {
    header: rowText(sheet, HEADER_ROW, width),
    rows: Array.from({ length: Math.max(sheet.rowCount - HEADER_ROW, 0) }, (_unused, index) => rowText(sheet, FIRST_BODY_ROW + index, width)),
  };
}

/** A CSV artefact read as the same table, so one reading serves both kinds of the artefact. */
export function csvTable(bytes: Uint8Array): Table {
  const rows = csvRows(bytes);
  return { header: rows[0] ?? [], rows: rows.slice(1) };
}

/** The column a header names, asserted to stand on the artefact before it is read. */
export function columnAt(table: Table, header: string): number {
  const at = table.header.indexOf(header);
  expect(at, `the artefact heads a ${JSON.stringify(header)} column; it heads ${JSON.stringify(table.header)}`).toBeGreaterThanOrEqual(0);
  return at;
}

/** What one row says under one header. */
export function underHeader(table: Table, row: readonly string[], header: string): string {
  return row[columnAt(table, header)] ?? "";
}
