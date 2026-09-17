// What a caller needs to ASK for a campaign's quantities export (ARCH-02): the composer, the reading
// it is composed from, and the build beside it (A-BOQ-XLSX, R-TO-070).
//
// The composition reaches the database and the export seam, so a screen never imports this barrel —
// the door in `src/server/routers/takeoff-boq.ts` does, exactly as the draft render's does (ARCH-01).
export { BOQ_XLSX_SHEETS, amountFormula, boqQuantitiesSheetOf, boqWorkbookSpecOf, sectionSheetName } from "./spec";
export type { BoqExportReading, LineEvidence } from "./spec";
export { BOQ_EXPORT_LINK_SECONDS, boqExportReadingOf, buildBoqExport } from "./server";
