// R-UI-005's two modes, in one home. The roster sits beside the seam rather than inside its barrel
// so that the store's own column can be declared from it (src/core/db.ts) without the schema
// reaching back through SEAM-PREFS's entry point; consumers read every name here through the barrel.
//
// The roster is the one home and the union is read off it (B-17, ARCH-02): the store's CHECK, the
// seam's column type and the DataTable's `DataTableDensity` all rest on this list, and a union
// spelled beside it would be a second home kept in step only by an acceptance file noticing a drift.

/** Every mode a preference may hold, in the order a screen offers them — the default reads first. */
export const DENSITIES = ["comfortable", "compact"] as const;

/** One of the modes the roster names, as a type — derived from it, never spelled again. */
export type Density = (typeof DENSITIES)[number];

/** What a person who never chose is shown: R-UI-005's comfortable rows, and the column's DEFAULT. */
export const DEFAULT_DENSITY: Density = "comfortable";

/**
 * Is this a mode the store can hold? Asked before a write, so a value from outside the roster is
 * refused where it was presented instead of reaching the column's CHECK as an unmarked 23514
 * (R-SPINE-007) — and asked of a value read back, so a store widened underneath us still answers a
 * density rather than a string a table cannot draw.
 */
export function isDensity(value: string): value is Density {
  return (DENSITIES as readonly string[]).includes(value);
}
