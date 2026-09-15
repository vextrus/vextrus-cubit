// The lawful half of the corpus: a consumer that wants a workbook asks the seam for one, so the
// scan must report nothing at all in this file.
//
// Judged at its layered address (`src/core/export-seam/good.ts`), `../exports` is the seam itself —
// the one module in the tree allowed to name the spreadsheet library. The word exceljs appears in
// this comment and nowhere in this file's code, because a comment is not code (Q-17).

export { buildWorkbook, writeCsv } from "../exports";
