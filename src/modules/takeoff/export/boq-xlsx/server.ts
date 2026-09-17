// The reading A-BOQ-XLSX is composed from, and the bytes it is built into (R-TO-070, A-BOQ-XLSX).
//
// IT COMPOSES AND NEVER COMPUTES (ARCH-02, B-17). The draft is `boqViewOf`'s — the very reading the
// screen paints and the PDF prints (I-269, I-271) — and the evidence is the REGISTER's own, joined by
// `lineId`. Nothing here re-measures, re-rounds or re-numbers: two faces of one campaign that read
// two drafts would be two answers to one question.
//
// THE BYTES ARE THE SEAM'S (R-SPINE-041). This file hands a `WorkbookSpec` to the one export seam and
// nothing under this module names a spreadsheet library; a build is a pure function of its spec, so
// the same campaign always addresses the same artefact (R-SPINE-021).
import { buildWorkbook, writeCsv, type ExportKind } from "@/core/exports";
import { boqViewOf, type BoqScope } from "@/modules/takeoff/boq/server";
import { registerViewOf } from "@/modules/takeoff/register-ui/server";
import { boqQuantitiesSheetOf, boqWorkbookSpecOf, type BoqExportReading, type LineEvidence } from "./spec";

/**
 * How long a quantities link is good for (Q-12). Long enough to reach a spreadsheet on the other side
 * of a slow connection, short enough that a link forwarded a day later is no longer a door.
 */
export const BOQ_EXPORT_LINK_SECONDS = 900;

/**
 * What one project's quantities export is composed from, or `null` where this campaign published no
 * line at all — an absence the door refuses by name rather than writing a workbook of nothing
 * (R-SPINE-062, B-21).
 */
export async function boqExportReadingOf(scope: BoqScope): Promise<BoqExportReading | null> {
  const view = await boqViewOf(scope);
  const payload = view.payload;
  if (payload === null) return null;

  // The register's own reading of the same campaign: the formula each figure was computed by and the
  // drawing and sheet it was measured off, which is what makes a published figure checkable by
  // somebody who was not there (L-QTY-03, R-TO-070).
  const register = await registerViewOf(scope);
  const evidence: LineEvidence[] = register.lines.map((line) => ({
    lineId: line.lineId,
    formula: line.formula,
    drawingId: line.drawingId,
    layoutName: line.layoutName,
  }));

  return { view: { ...view, payload }, evidence };
}

/** One reading as the artefact a person downloads: the workbook, or the Quantities sheet as CSV. */
export async function buildBoqExport(reading: BoqExportReading, kind: ExportKind): Promise<Uint8Array> {
  return kind === "xlsx" ? buildWorkbook(boqWorkbookSpecOf(reading)) : writeCsv(boqQuantitiesSheetOf(reading));
}
