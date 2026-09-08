// The element classes an RCC building is drawn in (F-RCC6, R-TO-032): the member types a takeoff
// recognises, closed and code-owned. A class is what a thing IS; the kind it bears is what is
// measured of it (L-MEA-04), and the two rosters never borrow each other's words — which is why the
// kind law reads this one as a vocabulary a kind name may not spell.
export const ELEMENT_TYPES = ["column", "beam", "slab", "footing", "pile_cap", "pile", "tie_beam", "shear_wall", "stair", "lintel"] as const;

/** One element class, drawn from the closed roster above. */
export type ElementType = (typeof ELEMENT_TYPES)[number];

/** Is this value one of the element classes? Asked wherever a class arrives as text — a row, a wire. */
export function isElementType(value: unknown): value is ElementType {
  return typeof value === "string" && (ELEMENT_TYPES as readonly string[]).includes(value);
}
