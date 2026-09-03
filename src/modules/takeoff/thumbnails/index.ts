// R-SPINE-022's one door (ARCH-02): the request that asks for a drawing's sheets to be rendered,
// the job that renders them, the tiers they are rendered at, the records they leave and the read
// door a sheet card is drawn from. A caller — a screen's server action, a route, the worker's
// composition root — speaks to this seam through this file and never reaches past it.
export { RASTER_TIERS, RASTER_TIER_LONG_EDGE, RASTER_URL_LIFETIME_SECONDS, type RasterTier } from "./tiers";
export { renderSheet, type SheetRaster } from "./raster";
export { sheetRasterRecords, type SheetRasterRecord, type SheetRasterScope } from "./records";
export {
  THUMBNAILS_KIND,
  requestThumbnails,
  runThumbnailsJob,
  sheetRastersOf,
  thumbnailsJobKey,
  type SheetRasters,
  type SheetTier,
  type ThumbnailsRefused,
  type ThumbnailsRequest,
  type ThumbnailsRequested,
} from "./pipeline";
export type { RasterNotAvailable, ThumbnailsRefusalCode } from "./refusals";
