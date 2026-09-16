// L-MEA-04's `bears` relation: class × kind, what an element class lawfully bears. A column bears
// concrete; a class that bears no kind at M2 is not forgotten but DECLARED, in the unborne set, so
// the coverage certificate can later say which classes were measured and which were never in scope.
//
// The unborne set is derived from the roster and the relation rather than written beside them
// (B-19): the two together exhaust `ELEMENT_TYPES`, and they cannot drift apart because there is
// only one of them.
import { ELEMENT_TYPES, type ElementType } from "./classes";
import { type Kind } from "./kinds";

/** One row of the relation: a class, and a kind it lawfully bears. */
export type BearsRow = { readonly class: ElementType; readonly kind: Kind };

/**
 * What each class bears. The column's concrete stands first, as the column leaf landed it; the frame
 * leaf adds the three horizontal members it measures, each bearing both of the kinds the frame area
 * measures — concrete and the formwork it is cast against (R-TO-032, L-FRM-03). Every other class of
 * the roster bears nothing yet, and says so below rather than by being absent.
 */
export const BEARS: readonly BearsRow[] = Object.freeze([
  Object.freeze({ class: "column", kind: "rcc.concrete" }),
  Object.freeze({ class: "beam", kind: "rcc.concrete" }),
  Object.freeze({ class: "beam", kind: "rcc.formwork" }),
  Object.freeze({ class: "tie_beam", kind: "rcc.concrete" }),
  Object.freeze({ class: "tie_beam", kind: "rcc.formwork" }),
  Object.freeze({ class: "lintel", kind: "rcc.concrete" }),
  Object.freeze({ class: "lintel", kind: "rcc.formwork" }),
  // The foundations leaf: what a footing, a pile cap and a pile lawfully bear (R-TO-032, L-FRM-04).
  // All three hold concrete; only the pile is bored, and only the two spread foundations are dug for
  // and blinded under — a pile is bored rather than excavated, and nothing is blinded beneath it.
  Object.freeze({ class: "footing", kind: "rcc.concrete" }),
  Object.freeze({ class: "pile_cap", kind: "rcc.concrete" }),
  Object.freeze({ class: "pile", kind: "rcc.concrete" }),
  Object.freeze({ class: "pile", kind: "piling.bored" }),
  Object.freeze({ class: "pile", kind: "piling.boring" }),
  Object.freeze({ class: "footing", kind: "earthwork.excavation" }),
  Object.freeze({ class: "pile_cap", kind: "earthwork.excavation" }),
  Object.freeze({ class: "footing", kind: "pcc.blinding" }),
  Object.freeze({ class: "pile_cap", kind: "pcc.blinding" }),
] as const);

/** The classes that bear at least one kind, as a set — read off the relation itself. */
const BORNE: ReadonlySet<ElementType> = new Set(BEARS.map((row) => row.class));

/**
 * The declared unborne set: every element class the relation names no kind for. Derived, so a class
 * that gains a kind leaves this set on the same edit and neither list can go stale (L-MEA-04, B-19).
 */
export const UNBORNE: readonly ElementType[] = Object.freeze(ELEMENT_TYPES.filter((elementType) => !BORNE.has(elementType)));
