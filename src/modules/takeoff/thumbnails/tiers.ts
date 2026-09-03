// R-SPINE-022's three zoom tiers, as pixels. The roster itself is the store's (src/core/db), because
// the `sheet_rasters` CHECK is written from it — one list, read by the column and by the renderer
// alike (ARCH-02, B-17). What this file adds is what a tier means to a renderer: the long edge each
// one is fitted to, and how long a link to one of them stands.
import { RASTER_TIERS, type RasterTier } from "../../../core/db";

export { RASTER_TIERS, type RasterTier };

/**
 * The long edge each tier is rendered to, in pixels: the sheet index's thumbnail, the viewer's
 * preview, and the full-page raster a viewer background is drawn from (R-SPINE-022).
 */
export const RASTER_TIER_LONG_EDGE: Readonly<Record<RasterTier, number>> = Object.freeze({ thumb: 256, preview: 1024, full: 2048 });

/**
 * How long a minted download URL for a raster stands (Q-12). Fifteen minutes is long enough for a
 * sheet index to load every card it shows and short enough that a link copied out of one stops
 * working — a download URL that never expires is not signed evidence.
 */
export const RASTER_URL_LIFETIME_SECONDS = 900;
