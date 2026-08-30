// L-MEA-04: the element classes — the member types a building is drawn and measured in.
//
// A class says *where* work sits; a kind says *what* the work is. Keeping them apart is what lets
// `bears` state, once, which kinds a class lawfully carries, and what makes a kind name that
// smuggles a class into itself a defect rather than a style choice.
//
// The roster is deliberately the structural and architectural members a takeoff walks; a class is
// here because something is measured against it, or because it is declared unborne in `bears.ts`.
export const ELEMENT_TYPES = [
  "footing",
  "pile",
  "pile-cap",
  "raft",
  "grade-beam",
  "column",
  "beam",
  "slab",
  "wall",
  "stair",
  "lintel",
  "parapet",
  "plinth",
  "door",
  "window",
] as const;

/** One of the element classes, as a type. */
export type ElementType = (typeof ELEMENT_TYPES)[number];

/** Is this one of the classes? Asked wherever a class arrives as text, before a keyed read. */
export function isElementType(value: string): value is ElementType {
  return (ELEMENT_TYPES as readonly string[]).includes(value);
}
