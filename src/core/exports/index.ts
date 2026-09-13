// SEAM-EXPORTS (R-SPINE-041): the product's one export seam, and its only public door.
//
// Everything that wants a spreadsheet or a CSV asks here — `buildWorkbook` for .xlsx bytes,
// `writeCsv` for a CSV's, `storeExport` to lay an artefact down under its workspace and
// `exportDownloadUrl` to hand a browser an expiring link to it. The library that writes a workbook
// is this seam's alone and is named nowhere else in `src/**` (the committed scan in `__tests__`),
// so there is one answer in this tree to how an artefact is written, formatted and addressed.
//
// The seam composes nothing: which sheets a bill has, what its rows say and what its formulas are is
// the composing rail's answer, stated in the sheet spec below (A-BOQ-XLSX).

export { writeCsv } from "./csv";
export { EXPORT_EPOCH, EXPORT_KINDS, MIME_OF_KIND, lakhCroreNumberFormat } from "./sheet";
export type { ExportCell, ExportColumn, ExportKind, SheetSpec, WorkbookSpec } from "./sheet";
export { exportDownloadUrl, signedStorageUrl, storeExport } from "./store";
export type { ExportAddress } from "./store";
export { buildWorkbook } from "./workbook";
