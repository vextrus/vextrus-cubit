// The FOUNDATIONS area's rails: the piles, the pits and the blinding a building stands on.
//
// A kind is named here once, beside the rail that measures it: a roster naming a rail the tree does
// not hold would be a claim that a kind is measured when nothing measures it (B-19).
//
// The barrel `./index.ts` already enumerates this file, so a kind added to the roster below is a kind
// the measure job runs — with no shared roster to edit and no other area's file to touch (AM-11).
//
// This area's CONCRETE reader is not keyed here. `rcc.concrete` is one kind measured by one rail
// (L-MEA-08), and a footing's concrete is that same kind as a column's (L-MEA-04's `bears`) — so the
// reader is composed into the frame's own roster line, where the kind already stands (riskNotes (1)).

import { blindingRail, excavationRail, pileCountRail, pileLengthRail } from "./foundations/index";
import type { RailRoster } from "./law";

/** Every kind this area measures, and the pure function that measures it (L-MEA-08). */
export const FOUNDATIONS_RAILS: RailRoster = Object.freeze({
  "piling.bored": pileCountRail,
  "piling.boring": pileLengthRail,
  "earthwork.excavation": excavationRail,
  "pcc.blinding": blindingRail,
});
