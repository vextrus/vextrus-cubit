/**
 * M3's first precondition: the workbook writer is present, and a workbook it writes is a workbook it
 * reads back (C-06, SEAM-DOC).
 *
 * A smoke test, deliberately: what is being proved is that the dependency resolves, loads under this
 * runtime, and round-trips a sheet — not how the BOQ will be laid out, which is M3's to state. It
 * goes red the day the dependency is missing or its module shape moves, which is the only day a
 * precondition has anything to say.
 */
import ExcelJS from "exceljs";
import { describe, expect, test } from "vitest";

/** Three rows, the shape a bill's first three lines have: a mark, a description, a quantity. */
const ROWS: readonly (readonly [string, string, number])[] = [
  ["C-1", "RCC column, ground to 1st", 3.456],
  ["GB-1", "Grade beam", 12.5],
  ["F-1", "Isolated footing", 0.875],
];

describe("exceljs round-trips a workbook", () => {
  test("three rows written are the three rows read back", async () => {
    const written = new ExcelJS.Workbook();
    const sheet = written.addWorksheet("BOQ");
    sheet.addRow(["Mark", "Description", "Quantity"]);
    for (const row of ROWS) sheet.addRow([...row]);
    const buffer = await written.xlsx.writeBuffer();
    expect(buffer.byteLength, "a workbook is bytes").toBeGreaterThan(0);

    const read = new ExcelJS.Workbook();
    await read.xlsx.load(buffer as ArrayBuffer);
    const back = read.getWorksheet("BOQ");
    expect(back, "the sheet is found by the name it was written under").toBeDefined();
    expect(back?.rowCount, "a header and three rows").toBe(ROWS.length + 1);

    ROWS.forEach(([mark, description, quantity], index) => {
      const row = back?.getRow(index + 2);
      expect(row?.getCell(1).value, `row ${index + 1} keeps its mark`).toBe(mark);
      expect(row?.getCell(2).value, `row ${index + 1} keeps its description`).toBe(description);
      expect(row?.getCell(3).value, `row ${index + 1} keeps its quantity exactly`).toBe(quantity);
    });
  });
});
