/**
 * R-SPINE-041 names the library the export seam will use by name — Excel (.xlsx) and CSV through one
 * seam, "SheetJS-free: `exceljs`". M3 builds that seam; this file proves the dependency it is built
 * on is present, resolvable from the unit lane, and does the one thing the seam needs of it: a
 * workbook written here reads back here with the same cells (A-BOQ-XLSX, C-06).
 *
 * It is a smoke test of the dependency, not of the seam. It asserts nothing about sheet layout,
 * number formats or formulas — those belong to the increment that lands A-BOQ-XLSX and are stated by
 * the artifact spec, not by this file. What it does assert is the round trip, because a dependency
 * that writes a workbook nothing can read is a dependency that is not installed, whatever the
 * lockfile says.
 *
 * The trip is entirely in memory (`writeBuffer` → `load`): no scratch path, no temp file, nothing
 * left behind for the next lane to trip over.
 */
import ExcelJS from "exceljs";
import { expect, test } from "vitest";

/** Three rows, each a shape the export seam will carry: a text cell, a number, and a unit string. */
const ROWS = [
  { item: "Concrete, RCC, grade C25", quantity: 12.5, unit: "cum" },
  { item: "Reinforcement, deformed bar, 16 mm", quantity: 840, unit: "kg" },
  { item: "Formwork, vertical, plywood", quantity: 96.25, unit: "sqm" },
] as const;

const SHEET = "Quantities";
const HEADER = ["Item", "Quantity", "Unit"] as const;

test("a three-row workbook written by exceljs reads back with the same cells (R-SPINE-041)", async () => {
  const written = new ExcelJS.Workbook();
  const sheet = written.addWorksheet(SHEET);
  sheet.addRow([...HEADER]);
  for (const row of ROWS) sheet.addRow([row.item, row.quantity, row.unit]);

  const buffer = await written.xlsx.writeBuffer();
  // A workbook is a zip: the first two bytes are the local file header's signature. If this is not
  // 'PK' then what came back is not an xlsx, and every assertion below would be reading a ghost.
  const head = new Uint8Array(buffer as ArrayBuffer).subarray(0, 2);
  expect(Array.from(head), "writeBuffer did not return a zip container").toEqual([0x50, 0x4b]);

  const read = new ExcelJS.Workbook();
  await read.xlsx.load(buffer as ArrayBuffer);

  const back = read.getWorksheet(SHEET);
  expect(back, `the workbook read back has no '${SHEET}' sheet`).toBeDefined();
  // Header plus the three rows, and nothing the writer did not put there.
  expect(back?.rowCount, "the row count changed across the round trip").toBe(ROWS.length + 1);

  const cellsOf = (rowNumber: number): unknown[] =>
    HEADER.map((_, column) => back?.getRow(rowNumber).getCell(column + 1).value);

  expect(cellsOf(1), "the header row did not survive the round trip").toEqual([...HEADER]);
  for (const [index, row] of ROWS.entries()) {
    expect(cellsOf(index + 2), `row ${index + 1} did not survive the round trip`).toEqual([row.item, row.quantity, row.unit]);
  }

  // The numbers come back as numbers, not as the strings a lax reader would hand over — the export
  // seam's quantities are arithmetic, and a quantity that reads back as text is a broken export.
  for (const [index, row] of ROWS.entries()) {
    expect(typeof back?.getRow(index + 2).getCell(2).value, `row ${index + 1}'s quantity is not a number`).toBe("number");
    expect(back?.getRow(index + 2).getCell(2).value, `row ${index + 1}'s quantity changed value`).toBe(row.quantity);
  }
});

test("the installed exceljs is the version package.json pins (C-06)", async () => {
  const manifest = (await import("exceljs/package.json", { with: { type: "json" } })) as { default: { version: string } };
  expect(manifest.default.version, "the installed exceljs is not 4.4.x").toMatch(/^4\.4\./);
});
