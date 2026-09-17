// L-MEA-04's work-item catalogue: per kind, what is measured of it and how it is written down —
// a description, the dimension it stands in, that dimension's canonical SI unit, and the number of
// places a document rounds it to. It is total over `KINDS`, because a kind with no work item is a
// kind nothing can be measured for.
//
// The canonical unit is never spelled here: it is read from `CANONICAL_UNIT` by the entry's own
// dimension, so the canon stays the one home of "a volume is measured in m³" (B-17, L-FRM-06).
import { CANONICAL_UNIT, type Dimension, type Unit } from "../units/canon";
import { type Kind } from "./kinds";

/** One work item: what a kind is called, what it measures, and how a document writes it. */
export type WorkItem = {
  readonly description: string;
  readonly dimension: Dimension;
  readonly canonicalUnit: Unit;
  readonly documentPrecision: number;
};

/**
 * The catalogue, one entry per kind. At M2 the roster is the one kind the increment lands: concrete
 * cast in place, measured as a volume and written to three places, the precision a Bangladeshi bill
 * of quantities states a cubic-metre item to.
 */
export const WORK_ITEM_CATALOGUE: Readonly<Record<Kind, WorkItem>> = Object.freeze({
  "rcc.concrete": Object.freeze({
    description: "Reinforced cement concrete cast in place, measured net of its reinforcement",
    dimension: "VOLUME",
    canonicalUnit: CANONICAL_UNIT["VOLUME"],
    documentPrecision: 3,
  }),
  // Formwork is the contact AREA a member's concrete is cast against — the shuttering a bill pays
  // for by the square metre, never the volume it contains (L-FRM-03, R-TO-032).
  "rcc.formwork": Object.freeze({
    description: "Formwork to reinforced cement concrete, measured as the contact area of the cast face",
    dimension: "AREA",
    canonicalUnit: CANONICAL_UNIT["AREA"],
    documentPrecision: 2,
  }),
  // A bored pile is COUNTED and its bore is MEASURED: two work items of one member, because a bill
  // pays for the piles installed by the number and for the boring by the running metre (R-TO-032,
  // AM-06 §2). A count is written to no decimal place at all — there is no half a pile.
  "piling.bored": Object.freeze({
    description: "Bored cast-in-situ piles installed, counted as members",
    dimension: "COUNT",
    canonicalUnit: CANONICAL_UNIT["COUNT"],
    documentPrecision: 0,
  }),
  "piling.boring": Object.freeze({
    description: "Boring for cast-in-situ piles, measured along the bored length below cut-off",
    dimension: "LENGTH",
    canonicalUnit: CANONICAL_UNIT["LENGTH"],
    documentPrecision: 3,
  }),
  // The pit a foundation is cast in: the plan it occupies, widened by the working space and carried
  // from the existing ground down past the blinding under it (L-FRM-04).
  "earthwork.excavation": Object.freeze({
    description: "Excavation in earth for foundations, measured as the pit's volume including working space",
    dimension: "VOLUME",
    canonicalUnit: CANONICAL_UNIT["VOLUME"],
    documentPrecision: 3,
  }),
  // Plain cement concrete under a foundation, projecting past its plan (L-FRM-04). It is not
  // reinforced, so it is its own kind rather than a grade of `rcc.concrete` (L-MEA-04).
  "pcc.blinding": Object.freeze({
    description: "Plain cement concrete blinding under foundations, measured as the laid volume",
    dimension: "VOLUME",
    canonicalUnit: CANONICAL_UNIT["VOLUME"],
    documentPrecision: 3,
  }),
  // Brickwork is a VOLUME: the wall's face net of its scheduled openings, times the nominal thickness
  // the mason builds to — which is why the thickness selects the item as well as measuring it
  // (R-TO-032, L-MEA-02).
  "masonry.brickwork": Object.freeze({
    description: "Brickwork in walls, measured as the wall face net of scheduled openings by its nominal thickness",
    dimension: "VOLUME",
    canonicalUnit: CANONICAL_UNIT["VOLUME"],
    documentPrecision: 3,
  }),
  // A finish is an AREA: the face it covers, gross less the openings the schedule states (L-MEA-03).
  // Plaster and paint are two work items of one face — a bill pays for each by the square metre.
  "finish.plaster": Object.freeze({
    description: "Plaster to surfaces, measured as the finished face net of scheduled openings",
    dimension: "AREA",
    canonicalUnit: CANONICAL_UNIT["AREA"],
    documentPrecision: 2,
  }),
  "finish.paint": Object.freeze({
    description: "Paint to surfaces, measured as the painted face net of scheduled openings",
    dimension: "AREA",
    canonicalUnit: CANONICAL_UNIT["AREA"],
    documentPrecision: 2,
  }),
});
