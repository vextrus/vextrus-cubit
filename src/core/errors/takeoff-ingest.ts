// SEAM-CAD's ingest and raster refusals (R-TO-001, R-SPINE-022, R-UI-043, R-TO-030): what is answered
// when a sheet yields no geometry, when a drawing has never been rendered or extracted, and when the
// bytes an ingest record names are not an EntityGraph the one mirror can parse.

import type { RefusalGroup } from "./law";

/** Every code this area registers. The barrel folds this union into `RefusalCode` (B-19). */
export type TakeoffIngestRefusalCode =
  | "SHEET_NOT_INGESTABLE"
  | "RASTER_NOT_AVAILABLE"
  | "MANIFEST_NOT_RENDERABLE"
  | "PARTITION_NOT_AVAILABLE";

/** This area's registered refusals, frozen entry by entry exactly as the one register holds them. */
export const TAKEOFF_INGEST_REFUSALS: RefusalGroup<TakeoffIngestRefusalCode> = Object.freeze({
  // SEAM-CAD's answer when the extractor took no geometry from a sheet (L-CAD-04): a sheet nothing
  // could be read from is an answer the operator acts on, never a fault of the product's.
  SHEET_NOT_INGESTABLE: Object.freeze({
    code: "SHEET_NOT_INGESTABLE",
    message: "The extractor could not read this sheet, so no geometry was taken from it.",
    remedy: "Export the drawing again as DXF (R2000 or later) and upload the new file.",
    severity: "error",
    surface: "inline",
  }),
  // R-SPINE-022's answer when a drawing's sheets have never been rendered: rasters are taken from an
  // ingest record's artifact, so a drawing nothing was ever extracted from has no sheets to render.
  RASTER_NOT_AVAILABLE: Object.freeze({
    code: "RASTER_NOT_AVAILABLE",
    message: "This drawing has no sheet rasters yet, because it has not been ingested.",
    remedy: "Ingest the drawing first, then ask for its rasters again.",
    severity: "error",
    surface: "inline",
  }),
  // R-UI-043's answer when a sheet cannot be drawn: the bytes an ingest record names are not an
  // EntityGraph the one mirror parses, so there is no geometry to build a manifest from. The reading
  // is what is damaged, not the drawing, so the remedy is another reading of it.
  MANIFEST_NOT_RENDERABLE: Object.freeze({
    code: "MANIFEST_NOT_RENDERABLE",
    message: "The reading of this drawing is damaged, so the sheet cannot be drawn.",
    remedy: "Upload the drawing again to have it read afresh.",
    severity: "error",
    surface: "banner",
  }),
  // R-TO-030's answer when a drawing has no partition to rebuild: the partition is a reading of an
  // ingest record, so a drawing nothing has ever been extracted from has nothing to classify.
  PARTITION_NOT_AVAILABLE: Object.freeze({
    code: "PARTITION_NOT_AVAILABLE",
    message: "This drawing has no stored partition, because it has not been ingested.",
    remedy: "Ingest the drawing first, then ask for its partition again.",
    severity: "error",
    surface: "inline",
  }),
});
