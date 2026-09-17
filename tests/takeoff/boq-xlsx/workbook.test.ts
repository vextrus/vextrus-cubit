/**
 * AC-1 — the A-BOQ-XLSX workbook, composed from the F-RCC6-BNBC golden roster and read back as a
 * reader's spreadsheet reads it (A-BOQ-XLSX, R-TO-070, AM-14 §2, AM-16, L-FMT-01, J-030).
 *
 * The yardstick is the DRAFT the product itself emits: the roster reading is put through
 * `boqDraftPayloadOf` and `numberItems`, and every expectation below is derived from that payload —
 * which sections it emitted, which lines they hold, what each line's item number is, how many places
 * each section's kinds are written to. A fixture that grows a member grows the expectation with it
 * and nothing here is frozen (B-19).
 *
 * The bytes are BUILT through the shipped seam and opened with exceljs, because "XLSX export opens
 * with formulas" (J-030) is a claim about the artefact rather than about the value that composed it.
 *
 * Nothing here opens a database and nothing here measures time (AM-10 §3).
 */
import type ExcelJS from "exceljs";
import { describe, expect, test } from "vitest";
import {
  BOQ_DRAFT_TITLE,
  DRAFT_BANNER,
  FIRST_BODY_ROW,
  HEADER_ROW,
  QUANTITIES_SHEET,
  SECTION_HEADER,
  SPEC_MODULE,
  SUMMARY_SHEET,
  asRead,
  cellFormula,
  cellText,
  draftLaw,
  exportsSeam,
  moneyFractionDigits,
  openWorkbook,
  rosterReading,
  rowText,
  sheetNamed,
  sheetNames,
  specModule,
  type DraftLawModule,
  type ExportReadingShape,
  type ExportsSeam,
  type PayloadShape,
  type WorkbookShape,
} from "./support/boq-xlsx-stage";

/** The columns of a section sheet, by the position A-BOQ-XLSX gives them. */
const ITEM = 1;
const QUANTITY = 5;
const RATE = 6;
const AMOUNT = 7;

/** The Summary's own three columns (interfaces: `[Item, Description, Amount]`). */
const SUMMARY_DESCRIPTION = 2;
const SUMMARY_AMOUNT = 3;

let reading!: ExportReadingShape;
let payload!: PayloadShape;
let spec!: WorkbookShape;
let workbook!: ExcelJS.Workbook;
let seam!: ExportsSeam;
let law!: DraftLawModule;
let money!: number;

/** Lazy and memoised: a throwing hook would leave every case skipped, and judge nothing. */
let loading: Promise<void> | undefined;
const ready = (): Promise<void> => (loading ??= load());

async function load(): Promise<void> {
  reading = await rosterReading();
  payload = reading.view.payload;

  const composer = await specModule();
  expect(typeof composer.boqWorkbookSpecOf, `${SPEC_MODULE} publishes \`boqWorkbookSpecOf\` — the composer this increment lands (interfaces)`).toBe("function");
  spec = composer.boqWorkbookSpecOf(reading);

  seam = await exportsSeam();
  law = await draftLaw();
  money = await moneyFractionDigits();
  workbook = await openWorkbook(await seam.buildWorkbook(spec));
}

/** The sheet one emitted section is written on: its ordinal among the six, then its own label. */
function sectionSheetNameOf(section: PayloadShape["sections"][number]): string {
  return `${law.BOQ_SECTIONS.indexOf(section.bill) + 1} ${section.label}`;
}

/** The lines one section prints, in the order the payload prints them (groups, then lines). */
function linesOf(section: PayloadShape["sections"][number]): { group: PayloadShape["sections"][number]["groups"][number]; line: PayloadShape["sections"][number]["groups"][number]["lines"][number] }[] {
  return section.groups.flatMap((group) => group.lines.map((line) => ({ group, line })));
}

describe("AC-1: the roster's draft, composed as the A-BOQ-XLSX workbook", () => {
  test("AC-1: the sheets are Summary, one per emitted section named `<S> <label>`, then Quantities", async () => {
    await ready();
    expect(payload.sections.length, "the BNBC roster publishes lines into sections — a draft with none would grade nothing").toBeGreaterThan(0);

    const expected = [SUMMARY_SHEET, ...payload.sections.map(sectionSheetNameOf), QUANTITIES_SHEET];
    expect(sheetNames(workbook), "the sheet order A-BOQ-XLSX names: the summary, a sheet per section the payload emitted, and the quantities behind them").toEqual(
      expected,
    );

    for (const section of payload.sections) {
      const name = sectionSheetNameOf(section);
      expect(name.startsWith(`${law.BOQ_SECTIONS.indexOf(section.bill) + 1} `), `${name} opens with the section's ordinal among the six (AM-16 §1)`).toBe(true);
    }
  });

  test("AC-1: every sheet's header row stays put", async () => {
    await ready();
    for (const sheet of workbook.worksheets) {
      const view = sheet.views[0];
      expect(view, `${sheet.name} states the view its reader opens it in (A-BOQ-XLSX: frozen headers)`).toBeDefined();
      expect((view as { state?: string }).state, `${sheet.name}'s header row is frozen`).toBe("frozen");
      expect((view as { ySplit?: number }).ySplit, `${sheet.name} freezes below the header row itself`).toBe(HEADER_ROW);
    }
  });

  test("AC-1: every section sheet heads its seven columns in A-BOQ-XLSX's order", async () => {
    await ready();
    for (const section of payload.sections) {
      const sheet = sheetNamed(workbook, sectionSheetNameOf(section));
      expect(rowText(sheet, HEADER_ROW, SECTION_HEADER.length), `${sheet.name} heads Item, Code, Description, Unit, Quantity, Rate, Amount`).toEqual([...SECTION_HEADER]);
    }
  });

  test("AC-1: every published line stands on its section sheet, numbered S.G.I, unpriced, with a live Amount", async () => {
    await ready();
    const items = reading.view.items;
    expect(items.size, "the payload numbers the lines it emitted (AM-14 §2)").toBeGreaterThan(0);

    let written = 0;
    for (const section of payload.sections) {
      const sheet = sheetNamed(workbook, sectionSheetNameOf(section));
      const lines = linesOf(section);

      lines.forEach(({ line }, index) => {
        const row = FIRST_BODY_ROW + index;
        const where = `${sheet.name} row ${row} (${line.lineId})`;
        expect(cellText(sheet, row, ITEM), `${where} carries the item number the draft derived for it — S.G.I, in payload order (AM-14 §2)`).toBe(items.get(line.lineId));

        // Unpriced: the Rate is EMPTY and the Amount is the formula that stays empty until somebody
        // prices the line, so no figure nobody stated ever appears in the bill (I-274, B-21).
        expect(cellText(sheet, row, RATE), `${where} states no rate — the priced BOQ is M6`).toBe("");
        expect(cellFormula(sheet, row, RATE), `${where}'s Rate is a cell a person types in, never a formula`).toBeNull();
        expect(cellFormula(sheet, row, AMOUNT), `${where}'s Amount is LIVE: Excel computes it from the quantity and the rate beside it (A-BOQ-XLSX)`).toBe(
          `IF(F${row}="","",E${row}*F${row})`,
        );

        if (line.quantity !== null) {
          expect(Number(cellText(sheet, row, QUANTITY)), `${where} carries the figure the payload already settled, as a NUMBER Excel can total (I-275)`).toBe(
            Number(line.quantity),
          );
        }
        written += 1;
      });

      // Below the lines stand the section's own feet, and they are not items: an item number under a
      // subtotal would be a line nobody measured (AM-14 §2).
      for (let row = FIRST_BODY_ROW + lines.length; row <= sheet.rowCount; row += 1) {
        expect(cellText(sheet, row, ITEM), `${sheet.name} row ${row} stands below the section's lines and carries no item number`).toBe("");
      }
    }

    expect(written, "every numbered line of the draft is written on a section sheet, and nothing else is").toBe(items.size);
  });

  test("AC-1: a column carries one precision — the section's widest, and the document's for money", async () => {
    await ready();
    const moneyFormat = seam.lakhCroreNumberFormat(money);

    for (const section of payload.sections) {
      const sheet = sheetNamed(workbook, sectionSheetNameOf(section));
      const lines = linesOf(section);
      // One precision per column: the widest any kind standing in this section is written to, so a
      // section that mixes kinds never quietly loses a digit (I-275, L-FMT-02).
      const places = Math.max(...section.groups.map((group) => law.placesOf(group.kind)));
      const quantityFormat = seam.lakhCroreNumberFormat(places);

      lines.forEach((_held, index) => {
        const row = FIRST_BODY_ROW + index;
        // Read back through `asRead`: exceljs renders a format code verbatim on the way out
        // (numfmt-xform.js:32) and strips the backslash escapes on the way back in (:40), so the
        // escaped separators are in the artefact and can never be in the reader's model. What is
        // under judgement is the CODE the column carries, never the reader's rendering of it.
        expect(sheet.getRow(row).getCell(QUANTITY).numFmt, `${sheet.name} row ${row} groups its quantity as the document groups, at ${places} places (L-FMT-01)`).toBe(
          asRead(quantityFormat),
        );
        expect(sheet.getRow(row).getCell(RATE).numFmt, `${sheet.name} row ${row}'s Rate is money, at the document convention's own precision`).toBe(asRead(moneyFormat));
        expect(sheet.getRow(row).getCell(AMOUNT).numFmt, `${sheet.name} row ${row}'s Amount is money, at the document convention's own precision`).toBe(asRead(moneyFormat));
      });
    }
  });

  test("AC-1: the Summary stamps the draft and totals each section sheet live", async () => {
    await ready();
    const summary = sheetNamed(workbook, SUMMARY_SHEET);
    const said = Array.from({ length: summary.rowCount }, (_unused, index) => cellText(summary, index + 1, SUMMARY_DESCRIPTION));

    expect(said, "the summary says what this document is (AM-05: it is the draft BOQ, and never a bill)").toContain(BOQ_DRAFT_TITLE);
    expect(said, "and carries the banner every page of an unsigned working document carries (AM-05 §2)").toContain(DRAFT_BANNER);
    expect(said, "and the taxonomy the sections were resolved under (L-BD-08)").toContain(`Taxonomy: ${payload.taxonomyVersion}`);

    for (const section of payload.sections) {
      const name = sectionSheetNameOf(section);
      const last = FIRST_BODY_ROW + linesOf(section).length - 1;
      const at = said.indexOf(section.label);
      expect(at, `the summary carries a row for ${name}`).toBeGreaterThanOrEqual(0);
      expect(cellFormula(summary, at + 1, SUMMARY_AMOUNT), `${name}'s summary total is a LIVE sum over that sheet's own line rows (A-BOQ-XLSX)`).toBe(
        `SUM('${name}'!G${FIRST_BODY_ROW}:G${last})`,
      );
    }
  });
});
