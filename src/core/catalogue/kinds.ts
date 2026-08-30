// L-MEA-04: the quantity kinds, closed and code-owned (ARCH-02, B-17).
//
// A kind is `chapter × dimension, named for the trade`. It says what work is being done and in what
// material — excavation, formwork, plastering — and it never says how the work is measured, what
// member it happens to sit on, or what a price book calls it. Those are all different questions:
//
//   - a dimension or a unit abbreviation (AREA, CUM, SFT, NR…) names the measure, and a matcher
//     keyed on the measure alone prices pile-cap excavation at the casting rate;
//   - an element class (column, slab, wall) names where the work is, which the `bears` relation
//     already says, and saying it twice makes one of the two wrong;
//   - a book or chapter code names a document, which changes with the book.
//
// The names are lower-case and hyphenated, as this tree's other closed domain enums are
// (`BUILDING_TYPES`, `DENSITIES`): a kind is data the store holds and the document quotes, never a
// code answered to anyone. `src/core/catalogue/__tests__/kinds.test.ts` enforces the ban above by
// tokenising these names against the dimension set, the unit abbreviations and the element classes.
export const KINDS = [
  "excavation",
  "backfilling",
  "sand-filling",
  "brick-soling",
  "lean-concrete",
  "concrete-casting",
  "reinforcement",
  "formwork",
  "brickwork",
  "plastering",
  "tiling",
  "painting",
  "waterproofing",
  "false-ceiling",
  "skirting",
  "railing",
  "pipework",
  "sanitary-ware",
  "electrical-point",
  "structural-steel",
] as const;

/** One of the closed kinds, as a type. The enum is the type's only source. */
export type Kind = (typeof KINDS)[number];

/**
 * Is this one of the kinds? Asked wherever a kind arrives as text — a line read from a document, a
 * row read from the store — before anything keyed on the enum is reached.
 */
export function isKind(value: string): value is Kind {
  return (KINDS as readonly string[]).includes(value);
}
