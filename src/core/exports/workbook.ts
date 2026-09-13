// The .xlsx half of the one export seam (R-SPINE-041, A-BOQ-XLSX), and the ONE module in the tree
// that names the spreadsheet library. Every other consumer asks `@/core/exports` for an artefact;
// the committed scan beside this file (`__tests__/exceljs-import-scan.ts`) is what keeps that true.
//
// What a built workbook carries: the columns' headers in row 1, figures as Excel numbers under the
// document's lakh/crore number format, amounts as LIVE formulas so a bill recomputes in the reader's
// own spreadsheet, and a frozen header where the sheet asks for one.
//
// DETERMINISM. An export is a function of its spec alone: the same bill built twice has the same
// bytes, and therefore the same content address (R-SPINE-021). Two clocks stand in the way and both
// are stopped at EXPORT_EPOCH — the workbook's own created/modified dates, which docProps/core.xml
// takes, and the DOS timestamp the zip writer stamps every entry with. exceljs offers no per-entry
// date, so the archive it writes is unpacked and re-packed here with every entry dated, in name
// order. The re-pack is jszip, which is the very library exceljs writes its archive with: a second
// zip implementation beside a shipped one would be two answers to one question (B-17).

import ExcelJS from "exceljs";
import JSZip from "jszip";
import { EXPORT_EPOCH, fractionDigitsOf, isNumeric, lakhCroreNumberFormat, type ExportCell, type ExportColumn, type SheetSpec, type WorkbookSpec } from "./sheet";

/** Who the artefact says built it. A person, a date and a machine would all be a clock (Q-12, B-23). */
const AUTHOR = "Vextrus Cubit";

/** The compression every entry is written under, so the re-pack is the archive's only difference. */
const COMPRESSION = "DEFLATE";

/** What a cell is written into the sheet as, given the column it stands in. */
function valueOf(column: ExportColumn, cell: ExportCell): ExcelJS.CellValue {
  if (cell === null) return null;
  if (typeof cell === "object") {
    // A live formula, carried rather than computed: A-BOQ-XLSX asks for a bill whose amounts
    // recompute in the reader's spreadsheet. A cached result is written where the caller has one,
    // and a reader with no formula engine sees the figure instead of an empty cell.
    const cached = cell.result === undefined ? null : figureOrText(column, cell.result);
    return cached === null ? { formula: cell.formula } : { formula: cell.formula, result: cached };
  }
  return figureOrText(column, cell);
}

/**
 * A written figure, or the text it is. The decimal string becomes a float exactly here and nowhere
 * else: a spreadsheet cell holds an IEEE double, so this is the write boundary B-07 allows one at —
 * everything upstream of it, storage and seam alike, carries the exact decimal the caller wrote.
 */
function figureOrText(column: ExportColumn, written: string): number | string | null {
  if (!isNumeric(column)) return written;
  // An empty string in a figure column is an empty cell, not zero: `Number("")` is 0, and a bill
  // stating zero where nothing was measured is a figure nobody wrote (B-21).
  if (written === "") return null;
  const figure = Number(written);
  if (!Number.isFinite(figure)) {
    throw new TypeError(`exports: "${written}" is not a decimal figure, so column ${column.key} has nothing to write`);
  }
  return figure;
}

/** One sheet of the spec, written into the workbook as Excel holds one. */
function addSheet(workbook: ExcelJS.Workbook, sheet: SheetSpec): void {
  const worksheet = workbook.addWorksheet(sheet.name);
  // The header stays put while a long bill scrolls under it (A-BOQ-XLSX: frozen headers).
  if (sheet.freezeHeader) worksheet.views = [{ state: "frozen", ySplit: 1 }];

  worksheet.addRow(sheet.columns.map((column) => column.header));
  for (const row of sheet.rows) {
    const written = worksheet.addRow(sheet.columns.map((column, at) => valueOf(column, row[at] ?? null)));
    for (const [at, column] of sheet.columns.entries()) {
      // Every figure of a numeric column reads under the document's grouping, the amounts among them:
      // a formula cell holds a figure once the reader computes it, and an ungrouped one would be the
      // one number on the page in Western thousands (B-07, L-FMT-01).
      if (isNumeric(column)) written.getCell(at + 1).numFmt = lakhCroreNumberFormat(fractionDigitsOf(column));
    }
  }
}

/**
 * The archive again, with every entry dated at the epoch and written in name order.
 *
 * The entries' bytes are carried across untouched — this changes when an entry says it was written,
 * and nothing about what it says.
 */
async function repacked(written: Uint8Array, at: Date): Promise<Uint8Array> {
  const archive = await JSZip.loadAsync(written);
  const repack = new JSZip();
  for (const name of Object.keys(archive.files).sort()) {
    const entry = archive.files[name];
    if (entry === undefined || entry.dir) continue;
    repack.file(name, await entry.async("uint8array"), { date: at, binary: true, createFolders: false, compression: COMPRESSION });
  }
  return await repack.generateAsync({ type: "uint8array", compression: COMPRESSION, platform: "DOS" });
}

/**
 * The workbook the spec describes, as .xlsx bytes — byte-identical for two builds of one spec.
 */
export async function buildWorkbook(spec: WorkbookSpec): Promise<Uint8Array> {
  const epoch = new Date(EXPORT_EPOCH);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = AUTHOR;
  workbook.lastModifiedBy = AUTHOR;
  workbook.created = epoch;
  workbook.modified = epoch;

  for (const sheet of spec.sheets) addSheet(workbook, sheet);

  const buffer = await workbook.xlsx.writeBuffer();
  return await repacked(new Uint8Array(buffer as ArrayBuffer), epoch);
}
