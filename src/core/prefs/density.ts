// R-UI-005's two modes, in one home. The roster sits beside the seam rather than inside its barrel
// so that the store's own column can be declared from it (src/core/db.ts) without the schema
// reaching back through SEAM-PREFS's entry point; consumers read every name here through the barrel.
//
// The union is spelled rather than derived from the array because it is the store's CHECK and the
// DataTable's `DataTableDensity` at once: a mode is lawful only if all three agree on it.
export type Density = "comfortable" | "compact";

/** Every mode a preference may hold, in the order a screen offers them — the default reads first. */
export const DENSITIES: readonly Density[] = ["comfortable", "compact"];

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
