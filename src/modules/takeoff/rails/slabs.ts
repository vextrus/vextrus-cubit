// The SLABS area's rails: R-TO-032's slabs, shear walls and stairs, for both kinds they bear.
//
// The barrel `./index.ts` enumerates this file, so a kind named in the roster below is a kind the
// measure job runs — with no shared roster to edit and no other area's file to touch (B-19).
//
// A kind is named once, beside the rail that measures it: a roster naming a rail the tree does not
// hold would be a claim that a kind is measured when nothing measures it. That identity claim lives
// HERE rather than at the barrel, because both kinds below are borne by another area too — a beam is
// concreted and formed as surely as a plate is — and a kind several areas answer is answered by the
// COMPOSITION of their rails, never by whichever roster a merge kept (AM-11, L-MEA-08).

import type { RailRoster } from "./law";
import { slabWallStairConcreteRail, slabWallStairFormworkRail } from "./slab-wall-stair";

/** Every kind this area measures, and the pure function that measures it (L-MEA-08). */
export const SLABS_RAILS: RailRoster = Object.freeze({
  "rcc.concrete": slabWallStairConcreteRail,
  "rcc.formwork": slabWallStairFormworkRail,
});
