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
 * What each class bears. At M2 the takeoff measures concrete in columns (F-RCC6): every other class
 * of the roster bears nothing yet, and says so below rather than by being absent.
 */
export const BEARS: readonly BearsRow[] = Object.freeze([Object.freeze({ class: "column", kind: "rcc.concrete" })] as const);

/** The classes that bear at least one kind, as a set — read off the relation itself. */
const BORNE: ReadonlySet<ElementType> = new Set(BEARS.map((row) => row.class));

/**
 * The declared unborne set: every element class the relation names no kind for. Derived, so a class
 * that gains a kind leaves this set on the same edit and neither list can go stale (L-MEA-04, B-19).
 */
export const UNBORNE: readonly ElementType[] = Object.freeze(ELEMENT_TYPES.filter((elementType) => !BORNE.has(elementType)));
