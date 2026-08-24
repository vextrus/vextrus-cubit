/**
 * R-SPINE-010's closed building-type enum, verbatim and in the clause's own order.
 *
 * It lives in a module of its own because both a Server Component and a `'use client'` form
 * read it, and an export of a client module reaches a server page as a client reference rather
 * than as the value it names. A third module is what both sides can share.
 *
 * The same five values are written a second time in `db/schema/spine/projects.ts`, as the
 * column's CHECK. That is not a duplicate to be removed: `cubit/db-seam-only` bans a schema
 * import anywhere above `src/core/db.ts`, and a closed set the database does not hold is a set
 * some other caller can widen. The clause is enforced at both ends on purpose.
 */
export const BUILDING_TYPES = Object.freeze([
  'residential',
  'commercial',
  'mixed',
  'industrial',
  'infrastructure',
] as const);

/** One of the five, as the module and the form both name one. */
export type BuildingType = (typeof BUILDING_TYPES)[number];
