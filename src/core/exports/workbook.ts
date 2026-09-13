// The spreadsheet half of R-SPINE-041, and the only file in `src/**` that names exceljs (AC-2's scan
// proves it): a WorkbookSpec, written as .xlsx bytes.
//
// What A-BOQ-XLSX asks of the artefact is honoured cell by cell — a header row, LIVE formulas where
// the spec says a cell is one, the document's lakh/crore number format on every number and money
// cell, and a header row that stays put. A number is written as a NUMBER, not as the text of one:
// a bill Excel cannot total is a picture of a bill.
//
// And the bytes are a function of the spec alone (R-SPINE-021). Two things inside an .xlsx would
// otherwise carry the wall clock: `docProps/core.xml`, which takes the model's own created/modified
// dates, and every zip entry's DOS timestamp, which exceljs leaves to JSZip and JSZip fills with
// `new Date()`. The first is pinned on the model; the second is why the archive exceljs wrote is
// re-packed here through jszip — the very library exceljs packs with, so there is no second zip
// implementation in the tree (B-17) — with every entry dated at EXPORT_EPOCH. JSZip converts a date
// to DOS time through `getUTC*`, so the answer does not depend on the machine's timezone either.
import ExcelJS from "exceljs";
import JSZip from "jszip";
import { BD_DOCUMENT } from "../format";
import { EXPORT_EPOCH, type ExportCell, type ExportColumn, type SheetSpec, type WorkbookSpec } from "./contract";
import { lakhCroreNumberFormat } from "./number-format";

/** The one instant every timestamp in the artefact carries, as the value both libraries take. */
const EPOCH = new Date(EXPORT_EPOCH);

/** The row a sheet's headers stand on, and therefore the split a frozen header freezes below. */
const HEADER_ROW = 1;

/**
 * Who `docProps/core.xml` says built the artefact. The product itself, always: an export is the
 * workspace's evidence and not a person's document, and naming the operator who happened to press
 * the button would put an identity inside bytes that are addressed by their content (R-SPINE-021) —
 * two people building one bill would get two addresses. Left unset, exceljs writes "Unknown".
 */
const AUTHOR = "Vextrus Cubit";

/**
 * The Excel number format a column's cells carry, or none. A text column carries none — a number
 * format over text is a rule Excel applies to nothing. Money reads its precision from the document
 * convention and a quantity states its own, which is L-FMT-02's distinction and not this seam's.
 */
function numberFormatOf(column: ExportColumn): string | null {
  if (column.kind === "text") return null;
  return lakhCroreNumberFormat(column.kind === "money" ? BD_DOCUMENT.moneyFractionDigits : column.fractionDigits);
}

/**
 * One cell's value, as exceljs holds it: a live formula, a real number, the text as given, or
 * nothing. A number column's cell is the decimal string the caller's format seam settled on, and it
 * becomes a number here — the STRING is what precision was decided as, the NUMBER is what Excel
 * totals, and the number format above is what a reader sees.
 */
function valueOf(cell: ExportCell | undefined, column: ExportColumn): ExcelJS.CellValue {
  if (cell === undefined || cell === null) return null;
  if (typeof cell === "object") return { formula: cell.formula, result: undefined };
  if (column.kind === "text") return cell;
  const figure = Number(cell);
  // A figure this seam cannot read as a number is written as the text it is, rather than as the NaN
  // a coercion would leave in the bill. The caller's format seam decides precision (L-FMT-02); what
  // this seam owes is never to invent a figure nobody stated (B-21).
  return Number.isFinite(figure) ? figure : cell;
}

/** One sheet of the spec, laid into the workbook: the headers, the rows, and the frozen header. */
function writeSheet(workbook: ExcelJS.Workbook, sheet: SheetSpec): void {
  const worksheet = workbook.addWorksheet(sheet.name, sheet.freezeHeader ? { views: [{ state: "frozen", ySplit: HEADER_ROW }] } : undefined);

  const headers = worksheet.getRow(HEADER_ROW);
  sheet.columns.forEach((column, index) => {
    headers.getCell(index + 1).value = column.header;
  });

  sheet.rows.forEach((cells, offset) => {
    const row = worksheet.getRow(HEADER_ROW + 1 + offset);
    sheet.columns.forEach((column, index) => {
      const cell = row.getCell(index + 1);
      cell.value = valueOf(cells[index], column);
      // The format is the COLUMN's, so a formula cell in a money column is money too: what Excel
      // computes in it is a figure of that kind whatever wrote it (A-BOQ-XLSX).
      const numFmt = numberFormatOf(column);
      if (numFmt !== null) cell.numFmt = numFmt;
    });
  });
}

/**
 * The archive, re-packed with every entry dated at EXPORT_EPOCH — the second half of "two builds of
 * one spec are byte-identical" (R-SPINE-021). The entries keep the order and the content exceljs
 * wrote them in; only their timestamps move.
 */
async function datedArchive(written: ArrayBuffer): Promise<Uint8Array> {
  const zip = await JSZip.loadAsync(written);
  const repacked = new JSZip();
  for (const name of Object.keys(zip.files)) {
    const entry = zip.files[name];
    if (entry === undefined || entry.dir) continue;
    repacked.file(name, await entry.async("uint8array"), { date: EPOCH, createFolders: false });
  }
  return repacked.generateAsync({ type: "uint8array", compression: "DEFLATE", compressionOptions: { level: 9 } });
}

/**
 * A whole workbook as .xlsx bytes (R-SPINE-041, A-BOQ-XLSX). The same spec always answers the same
 * bytes, on any machine, in any timezone, at any hour: nothing of the moment it was built survives
 * into the artefact, which is what lets its content address mean "these bytes".
 */
export async function buildWorkbook(spec: WorkbookSpec): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  // The model's own dates and author are what `docProps/core.xml` is written from.
  workbook.created = EPOCH;
  workbook.modified = EPOCH;
  workbook.creator = AUTHOR;
  workbook.lastModifiedBy = AUTHOR;
  for (const sheet of spec.sheets) writeSheet(workbook, sheet);
  return datedArchive(await workbook.xlsx.writeBuffer());
}
