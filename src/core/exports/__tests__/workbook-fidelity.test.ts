// AC-1's acceptance: what the one export seam actually writes (R-SPINE-041, A-BOQ-XLSX).
//
// The seam is driven and its artefacts are read back — the .xlsx through exceljs, the .csv as the
// bytes a caller receives. exceljs is imported HERE and nowhere else outside `src/core/exports/**`,
// which is the law AC-2's scan proves; this file sits inside the seam's own `__tests__`, the one
// address the scan exempts.
//
// The seam is reached through a dynamic import so a module the Builder has not written yet fails
// inside the case that needs it, naming what is missing, rather than killing the collection.
import { describe, expect, it } from "vitest";

/** The spec AC-1 publishes, verbatim — the one workbook every assertion below is about. */
const SAMPLE = {
  name: "Bill",
  freezeHeader: true,
  columns: [
    { key: "item", header: "Item", kind: "text" },
    { key: "quantity", header: "Quantity", kind: "number", fractionDigits: 3 },
    { key: "rate", header: "Rate", kind: "money" },
    { key: "amount", header: "Amount", kind: "money" },
  ],
  rows: [
    ["Concrete M25", "12345.678", "8500.00", { formula: "B2*C2" }],
    ['Rebar Fe500, "TMT"', "1.500", "95000.00", { formula: "B3*C3" }],
  ],
} as const;

/** The CSV AC-1 spells out, byte for byte: CRLF after every row, RFC 4180 quoting, no BOM. */
const SAMPLE_CSV = 'Item,Quantity,Rate,Amount\r\nConcrete M25,12345.678,8500.00,\r\n"Rebar Fe500, ""TMT""",1.500,95000.00,\r\n';

/** The one Excel spelling of BD_DOCUMENT's lakh/crore grouping at two fraction digits (AC-1). */
const LAKH_CRORE_TWO = "[>=10000000]##\\,##\\,##\\,##0.00;[>=100000]##\\,##\\,##0.00;##,##0.00";

/** The seam's public door, as this suite uses it. Structural, so nothing here needs the module to typecheck. */
type Seam = {
  buildWorkbook: (spec: { sheets: readonly unknown[] }) => Promise<Uint8Array>;
  writeCsv: (sheet: unknown) => Uint8Array;
  lakhCroreNumberFormat: (fractionDigits: number) => string;
};

const seam = async (): Promise<Seam> => (await import("@/core/exports")) as unknown as Seam;

/** The document convention money's precision is read from — never a second grouping rule (L-FMT-01). */
const moneyDigits = async (): Promise<number> => {
  const { BD_DOCUMENT } = (await import("@/core/format")) as unknown as { BD_DOCUMENT: { moneyFractionDigits: number } };
  return BD_DOCUMENT.moneyFractionDigits;
};

describe("AC-1: the export seam writes the workbook and the CSV the spec describes", () => {
  it("AC-1: buildWorkbook writes one sheet with headers, live formulas, lakh/crore formats and a frozen header", async () => {
    const { buildWorkbook, lakhCroreNumberFormat } = await seam();
    const { Workbook } = await import("exceljs");

    const bytes = await buildWorkbook({ sheets: [SAMPLE] });
    expect(bytes, "buildWorkbook answers the .xlsx bytes").toBeInstanceOf(Uint8Array);

    const read = new Workbook();
    // The bytes are handed to the reader as the buffer they are. Copying them into Node's pool and
    // then slicing that pool at the ORIGINAL view's offset reads an unrelated window of the pool —
    // green or red by where the allocator happened to land, which pins nothing (ruling, count 1).
    // The cast is the library's own `Buffer` against this tree's newer, generic one — the value is
    // exactly the buffer the reader asks for.
    await read.xlsx.load(Buffer.from(bytes) as unknown as Parameters<typeof read.xlsx.load>[0]);

    expect(read.worksheets.map((sheet) => sheet.name), "the workbook carries exactly the sheets the spec named").toEqual([SAMPLE.name]);
    const bill = read.getWorksheet(SAMPLE.name);
    expect(bill, `the workbook has a worksheet named ${SAMPLE.name}`).toBeDefined();
    if (bill === undefined) return;

    // Row 1 is the header row: the columns' headers, in the spec's own order.
    const headerRow = bill.getRow(1);
    expect(
      SAMPLE.columns.map((_column, index) => headerRow.getCell(index + 1).value),
      "row 1 is the columns' headers",
    ).toEqual(SAMPLE.columns.map((column) => column.header));

    // The two data rows: text verbatim, numbers as Excel numbers, the amount a LIVE formula.
    expect(bill.getCell("A2").value).toBe(SAMPLE.rows[0][0]);
    expect(bill.getCell("A3").value).toBe(SAMPLE.rows[1][0]);
    expect(bill.getCell("B2").value).toBe(12345.678);
    expect(bill.getCell("B3").value).toBe(1.5);
    expect((bill.getCell("D2").value as { formula?: string } | null)?.formula, "D2 is a formula cell, not a computed number").toBe("B2*C2");
    expect((bill.getCell("D3").value as { formula?: string } | null)?.formula).toBe("B3*C3");

    // The number formats: the quantity column at its own precision, money at the document's.
    expect(lakhCroreNumberFormat(2), "the two-digit lakh/crore format is the one Excel spelling AC-1 publishes").toBe(LAKH_CRORE_TWO);
    const quantityFormat = lakhCroreNumberFormat(SAMPLE.columns[1].fractionDigits);
    const money = lakhCroreNumberFormat(await moneyDigits());

    // Which cell carries which format is read back through exceljs, whose reader strips the escapes
    // it wrote verbatim (numfmt-xform.js:40 against :32), so the read-back is compared to the same
    // code unescaped. What EXCEL opens is graded below, off the artefact itself (ruling, count 2).
    const asRead = (code: string): string => code.replace(/\\(.)/gu, "$1");
    expect(bill.getCell("B2").numFmt).toBe(asRead(quantityFormat));
    expect(bill.getCell("B3").numFmt).toBe(asRead(quantityFormat));
    for (const cell of ["C2", "C3", "D2", "D3"]) {
      expect(bill.getCell(cell).numFmt, `${cell} is money, formatted by the document convention's own precision`).toBe(asRead(money));
    }

    // The artefact's own styles part: the number formats Excel will read are the seam's published
    // codes, escapes and all — the .xlsx is a zip, and this is what is inside it.
    const { default: JSZip } = await import("jszip");
    const styles = await (await JSZip.loadAsync(Buffer.from(bytes))).file("xl/styles.xml")?.async("string");
    const unentitied = (styles ?? "").replace(/&gt;/gu, ">").replace(/&lt;/gu, "<").replace(/&amp;/gu, "&");
    expect(styles, "an .xlsx carries its number formats in xl/styles.xml").toBeDefined();
    expect(unentitied, "the money format Excel opens is the published lakh/crore code, verbatim").toContain(money);
    expect(unentitied, "and the quantity column's own precision likewise").toContain(quantityFormat);

    // freezeHeader: the header row stays put.
    expect(bill.views[0], "freezeHeader freezes exactly the header row").toMatchObject({ state: "frozen", ySplit: 1 });
  });

  it("AC-1: writeCsv answers UTF-8 bytes with no BOM, CRLF rows and RFC 4180 quoting", async () => {
    const { writeCsv } = await seam();

    const bytes = writeCsv(SAMPLE);
    expect(bytes, "writeCsv answers bytes, not a string").toBeInstanceOf(Uint8Array);
    expect([bytes[0], bytes[1], bytes[2]], "a CSV this seam writes carries no byte-order mark").not.toEqual([0xef, 0xbb, 0xbf]);
    expect(Buffer.from(bytes).toString("utf8")).toBe(SAMPLE_CSV);
  });
});
