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
  // The masonry leaf: a brick wall bears its brickwork, and a SURFACE bears the plaster and the paint
  // applied to it. The three cells that stay empty stay empty by rule — a brick wall bears no finish
  // here, because a finish is borne by the face applied to it and not by the member behind it
  // (L-MEA-03, AM-07).
  Object.freeze({ class: "brick_wall", kind: "masonry.brickwork" }),
  Object.freeze({ class: "surface", kind: "finish.plaster" }),
  Object.freeze({ class: "surface", kind: "finish.paint" }),
  // The rebar leaf: every reinforced class bears its steel (R-TO-032, L-FRM-05). What a class bears
  // is what it lawfully HOLDS, not what this tree can read a schedule for yet — a class whose
  // schedule nothing reads observes REBAR_SCHEDULE_UNREAD, which is a disclosure about the drawing
  // and would be unsayable if the relation denied the class its steel (L-QTY-02).
  Object.freeze({ class: "column", kind: "rcc.rebar" }),
  Object.freeze({ class: "beam", kind: "rcc.rebar" }),
  Object.freeze({ class: "tie_beam", kind: "rcc.rebar" }),
  Object.freeze({ class: "slab", kind: "rcc.rebar" }),
  Object.freeze({ class: "footing", kind: "rcc.rebar" }),
  Object.freeze({ class: "pile_cap", kind: "rcc.rebar" }),
  Object.freeze({ class: "pile", kind: "rcc.rebar" }),
  Object.freeze({ class: "shear_wall", kind: "rcc.rebar" }),
  Object.freeze({ class: "stair", kind: "rcc.rebar" }),
  Object.freeze({ class: "lintel", kind: "rcc.rebar" }),
  // The reconciliation (BEARS-1, I-336): what these classes lawfully hold that the relation did not
  // yet say, reconciled once so the catalogue digest moves once (L-REG-07). R-TO-032 forms and casts
  // every one of them and L-FRM-03 states each contact area — a foundation's and a cap's sides, a
  // vertical's four faces per storey — and L-FRM-04 lays a blinding under a slab cast on the ground
  // as surely as under a footing. The slab area's rails already measure a plate, a shear wall and a
  // stair for both kinds, so those six pairs are the relation catching up with what is published; a
  // pair no rail measures yet DECLARES — a borne pair nothing publishes stands in the residue as
  // NOT_ESTABLISHED, which is the disclosure, and is never billed (L-QTY-02, L-QTY-05). The four WALL
  // pairs a golden states wait for the WALL class: no row names a class the closed roster lacks.
  Object.freeze({ class: "pile_cap", kind: "rcc.formwork" }),
  Object.freeze({ class: "footing", kind: "rcc.formwork" }),
  Object.freeze({ class: "column", kind: "rcc.formwork" }),
  Object.freeze({ class: "slab", kind: "rcc.concrete" }),
  Object.freeze({ class: "slab", kind: "rcc.formwork" }),
  Object.freeze({ class: "shear_wall", kind: "rcc.concrete" }),
  Object.freeze({ class: "shear_wall", kind: "rcc.formwork" }),
  Object.freeze({ class: "stair", kind: "rcc.concrete" }),
  Object.freeze({ class: "stair", kind: "rcc.formwork" }),
  Object.freeze({ class: "slab", kind: "pcc.blinding" }),
] as const);

/** The classes that bear at least one kind, as a set — read off the relation itself. */
const BORNE: ReadonlySet<ElementType> = new Set(BEARS.map((row) => row.class));

/**
 * The declared unborne set: every element class the relation names no kind for. Derived, so a class
 * that gains a kind leaves this set on the same edit and neither list can go stale (L-MEA-04, B-19).
 */
export const UNBORNE: readonly ElementType[] = Object.freeze(ELEMENT_TYPES.filter((elementType) => !BORNE.has(elementType)));
