// The codes a raster request can be refused with, drawn out of the closed taxonomy rather than
// re-spelled beside it (Q-07, R-SPINE-062): `Extract` keeps these bound to the register, so a code
// renamed there is a compile error here rather than a string that quietly means nothing.
import type { RefusalCode } from "../../../core/errors";

/** A drawing nothing was ever extracted from — there is no artifact to render sheets out of. */
export type RasterNotAvailable = Extract<RefusalCode, "RASTER_NOT_AVAILABLE">;

/** What the door answers with: nothing ingested, or a drawing this workspace cannot see. */
export type ThumbnailsRefusalCode = RasterNotAvailable | Extract<RefusalCode, "WORKSPACE_PERMISSION_NOT_HELD">;
