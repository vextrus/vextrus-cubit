// R-SPINE-041's one export seam: the door every consumer reaches for, and the reason no other file
// under `src/**` names a spreadsheet library at all (AC-2's committed scan says so, and `tests/
// lint-fixtures/export-seam/` is what it is proved on).
//
// What is behind it: the sheet spec both writers are driven by (`./contract`), the Excel spelling of
// the document's lakh/crore grouping (`./number-format`), the two writers themselves (`./workbook`,
// `./csv`) and the content-addressed storage and signed links a built artefact travels under
// (`./store`). A-BOQ-XLSX's own sheets are a WorkbookSpec a later rail composes out of these parts;
// this seam is the machinery, not the bill.
export { EXPORT_EPOCH, EXPORT_KINDS, MIME_OF_KIND } from "./contract";
export type { ExportCell, ExportColumn, ExportKind, SheetSpec, WorkbookSpec } from "./contract";
export { writeCsv } from "./csv";
export { lakhCroreNumberFormat } from "./number-format";
export { exportAddress, exportDownloadUrl, isExportKind, readSignedExport, storeExport, storedKindOf } from "./store";
export type { ExportAddress, ExportLink, ExportRefusal, PresentedLink, SignedExport } from "./store";
export { buildWorkbook } from "./workbook";
