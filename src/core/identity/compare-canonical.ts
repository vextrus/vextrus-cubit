// L-REG-05's one sort: rows of a mark family are ordered "by code units (`compareCanonical`)", and
// `localeCompare` is a lint error. This file is that comparison's one home (B-17, ARCH-02) — every
// sort in `src/core/identity` and `src/modules/takeoff/register` goes through it, so an ordinal
// frozen on one machine is the same ordinal on another.
//
// Code units, not collation: a locale would put `a` before `B` and `é` beside `e`, and an ordinal
// that moved when a server's locale changed would not be frozen at all. `<` and `>` on a JavaScript
// string are UTF-16 code-unit comparisons, which is the whole rule.

/**
 * Two strings in UTF-16 code-unit order: -1 when `a` stands first, 1 when `b` does, 0 when they are
 * the same string. The answer is the three values a comparator may take and nothing wider, so a
 * caller may read it as an ordering rather than as a difference.
 */
export function compareCanonical(a: string, b: string): -1 | 0 | 1 {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * A copy of `values` in that same order. A copy, because sorting in place would reorder a list its
 * owner still holds — a caller asking what the order IS has not asked for its own array to move.
 */
export function sortCanonical(values: readonly string[]): string[] {
  return [...values].sort(compareCanonical);
}
