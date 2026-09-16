// The FRAME area's rails: the columns and beams a structural frame is made of.
//
// A kind is named here once, beside the rail that measures it: a roster naming a rail the tree does
// not hold would be a claim that a kind is measured when nothing measures it (B-19).
//
// M3 writes its frame rail HERE. The barrel `./index.ts` already enumerates this file, so a kind
// added to the roster below is a kind the measure job runs — with no shared roster to edit and no
// other area's file to touch (AM-11).
//
// `rcc.concrete` is measured by ONE rail (L-MEA-08) and borne by classes of two areas — a column, a
// beam, a tie beam and a lintel here, and a footing, a pile cap and a pile in the foundations
// (L-MEA-04's `bears`). So the kind's roster line is where their readers are composed: each reads the
// rows of its own class and the batch is theirs concatenated, in the order the areas landed
// (riskNotes (1)). A second `rcc.concrete` key in another area's roster would be a second rail for one
// kind, which the barrel's own proof refuses.

import { foundationConcreteRail } from "./foundations/concrete";
import { frameConcreteRail, frameFormworkRail } from "./frame/index";
import { composeRails, type RailRoster } from "./law";

/** Every kind this area measures, and the pure function that measures it (L-MEA-08). */
export const FRAME_RAILS: RailRoster = Object.freeze({
  "rcc.concrete": composeRails(frameConcreteRail, foundationConcreteRail),
  "rcc.formwork": frameFormworkRail,
});
