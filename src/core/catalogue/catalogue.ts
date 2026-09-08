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
});
