// The element classes an RCC building is drawn in (F-RCC6, R-TO-032): the member types a takeoff
// recognises, closed and code-owned. A class is what a thing IS; the kind it bears is what is
// measured of it (L-MEA-04), and the two rosters never borrow each other's words — which is why the
// kind law reads this one as a vocabulary a kind name may not spell.
// `brick_wall` is the wall a mason builds and `surface` is L-MEA-03's own word for a face a finish is
// applied to: a plaster is borne by the surface rather than by the wall behind it, so a face of a
// slab soffit and a face of a brick wall are one class measured one way (R-TO-032, L-MEA-03).
export const ELEMENT_TYPES = ["column", "beam", "slab", "footing", "pile_cap", "pile", "tie_beam", "shear_wall", "stair", "lintel", "brick_wall", "surface"] as const;

/** One element class, drawn from the closed roster above. */
export type ElementType = (typeof ELEMENT_TYPES)[number];

/** Is this value one of the element classes? Asked wherever a class arrives as text — a row, a wire. */
export function isElementType(value: unknown): value is ElementType {
  return typeof value === "string" && (ELEMENT_TYPES as readonly string[]).includes(value);
}
