/**
 * The search's own fixture identities, declared once and imported by every lane that asserts them
 * (B-19): the jsdom frame beside this file, the live db suites and the held-out set all read the
 * kinds, the token and the naming from here rather than each spelling their own.
 *
 * Nothing here imports a renderer or a driver, so a node-lane suite may load it as safely as a
 * jsdom one.
 */

/** The four kinds R-SPINE-050 names for navigation, and the only kinds `spine.search` answers. */
export const SEARCH_KINDS: readonly string[] = Object.freeze(["project", "drawing", "sheet", "set"]);

/** The token every staged subject's name carries, and the query the acceptance types (AC-2). */
export const SEARCH_TOKEN = "keranig";

/** The same token as a person would type it — the match is case-insensitive (AC-2). */
export const SEARCH_TOKEN_TYPED = "KERANIG";

/** A query nothing in a staged workspace matches (AC-5's empty state). */
export const NO_HIT_QUERY = "zzzz-nothing-matches";

/** The two queries that ask for nothing at all, which answer no hits rather than everything (AC-2). */
export const BLANK_QUERIES: readonly string[] = Object.freeze(["", "   "]);

/**
 * The name a staged subject of one kind carries: the token, the kind and a marker that tells one
 * run's rows from another's (the lane's database outlives a run).
 */
export function searchName(kind: string, marker: string): string {
  return `Keraniganj ${kind} ${marker}`;
}
