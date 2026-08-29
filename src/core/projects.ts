// R-SPINE-010's project domain facts that are law rather than storage: the closed set of building
// types, and whether a value presented for that field is one of them.
//
// They live here, apart from `./db`, because every layer needs them and only one of them may hold a
// driver (ARCH-01): the schema writes the column's CHECK from this list, the module seam types its
// draft by it, the server action judges a submission against it, and the screen renders one chip per
// member — and a screen that reached for `./db` would pull the database driver into the browser. One
// home, read by all four (ARCH-02, B-17); the same shape `EditionScope` already has beside its own
// table.
export const BUILDING_TYPES = ["residential", "commercial", "mixed", "industrial", "infrastructure"] as const;

/** One of the five R-SPINE-010 admits, as a type. */
export type BuildingType = (typeof BUILDING_TYPES)[number];

/**
 * Is this one of the five? Asked by every door that takes a building type from a caller, before the
 * column's CHECK is reached — a value the store refuses arrives as a constraint error carrying no
 * refusal marker, which would reach a person as a fault id for a field their door never judged
 * (ARCH-03, R-SPINE-062).
 */
export function isBuildingType(value: string): value is BuildingType {
  return (BUILDING_TYPES as readonly string[]).includes(value);
}
