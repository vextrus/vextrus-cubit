// The MASONRY shard's rail door: the three pure functions this area measures with, the rules they
// offer under, and the closed roster of codes they report (AM-11, L-MEA-08).
//
// One door, so the area's roster (`../masonry.ts`) and everything that drives these rails read the
// same three functions rather than reaching into the files that write them (ARCH-02).
export { brickworkRail, BRICK_WALL_VOLUME_RULE_ID } from "./brickwork";
export { paintRail, plasterRail, PAINT_RULE_ID, PLASTER_RULE_ID } from "./finishes";
export { MASONRY_RAIL_CODES } from "./read";
export type { MasonryRailCode } from "./read";
