// The FRAME area's rails: the columns and beams a structural frame is made of.
//
// A kind is named here once, beside the rail that measures it: a roster naming a rail the tree does
// not hold would be a claim that a kind is measured when nothing measures it (B-19).
//
// M3 writes its frame rail HERE. The barrel `./index.ts` already enumerates this file, so a kind
// added to the roster below is a kind the measure job runs — with no shared roster to edit and no
// other area's file to touch (AM-11).

import type { RailRoster } from "./law";
import { columnConcreteRail } from "./columns";

/** Every kind this area measures, and the pure function that measures it (L-MEA-08). */
export const FRAME_RAILS: RailRoster = Object.freeze({
  "rcc.concrete": columnConcreteRail,
});
