// The SLABS area's rails — empty until M3 writes it (AM-11).
//
// M3's slabs rail writes its rails HERE. The barrel `./index.ts` already enumerates this file, so a kind
// added to the roster below is a kind the measure job runs — with no shared roster to edit and no
// other area's file to touch (B-19).
//
// A kind is named once, beside the rail that measures it: a roster naming a rail the tree does not
// hold would be a claim that a kind is measured when nothing measures it.

import type { RailRoster } from "./law";

/** Every kind this area measures, and the pure function that measures it (L-MEA-08). */
export const SLABS_RAILS: RailRoster = Object.freeze({});
