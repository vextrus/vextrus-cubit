// The FRAME area's rails, whole: the six per-class rails of R-TO-032's frame — column, beam, tie
// beam and lintel — and the two compositions the roster publishes, one per kind this area measures.
//
// "Rail is selected per quantity kind, never per drawing" (L-MEA-08): what the measure job runs for
// `rcc.concrete` is ONE function, so the per-class rails compose into it here. A composition is
// itself a pure function — it asks each member of its list in turn and concatenates what they
// answered — so the order of the offers is the order of the classes, the column's first, and the
// same input twice still answers deep-equal batches.
//
// A class whose rows are not in the batch contributes nothing: each member rail measures only the
// rows of its own class, so composing them costs nothing on a batch that holds none of them.
import type { Offer, Rail, RailBatch, RailInput, RailObservation } from "@/core/offers/contract";
import { COLUMN_CONCRETE_RULE_ID, columnConcreteRail } from "../columns";
import { BEAM_CONCRETE_RULE_ID, BEAM_FORMWORK_RULE_ID, beamConcreteRail, beamFormworkRail } from "./beams";
import { LINTEL_CONCRETE_RULE_ID, LINTEL_FORMWORK_RULE_ID, lintelConcreteRail, lintelFormworkRail } from "./lintels";
import { TIE_BEAM_CONCRETE_RULE_ID, TIE_BEAM_FORMWORK_RULE_ID, tieBeamConcreteRail, tieBeamFormworkRail } from "./tie-beams";

export { beamConcreteRail, beamFormworkRail } from "./beams";
export { FRAME_RAIL_CODES, type FrameRailCode } from "./codes";
export { lintelConcreteRail, lintelFormworkRail } from "./lintels";
export { tieBeamConcreteRail, tieBeamFormworkRail } from "./tie-beams";

/** Every rule the area's rails offer under, by the class and kind each measures (L-MEA-01). */
export const FRAME_RULE_IDS = Object.freeze({
  "column.rcc.concrete": COLUMN_CONCRETE_RULE_ID,
  "beam.rcc.concrete": BEAM_CONCRETE_RULE_ID,
  "beam.rcc.formwork": BEAM_FORMWORK_RULE_ID,
  "tie_beam.rcc.concrete": TIE_BEAM_CONCRETE_RULE_ID,
  "tie_beam.rcc.formwork": TIE_BEAM_FORMWORK_RULE_ID,
  "lintel.rcc.concrete": LINTEL_CONCRETE_RULE_ID,
  "lintel.rcc.formwork": LINTEL_FORMWORK_RULE_ID,
});

/** The one composition: each member asked what it was handed, in the order the classes stand in. */
function composed(members: readonly Rail[]): Rail {
  return (input: RailInput): RailBatch => {
    const offers: Offer[] = [];
    const observations: RailObservation[] = [];
    for (const member of members) {
      const batch = member(input);
      offers.push(...batch.offers);
      observations.push(...batch.observations);
    }
    return { offers, observations };
  };
}

/**
 * The concrete a frame holds: the columns the M2 leaf measured first — those rows do not move — then
 * the beams, the tie beams and the lintels this leaf adds (L-MEA-09).
 */
export const frameConcreteRail: Rail = composed([columnConcreteRail, beamConcreteRail, tieBeamConcreteRail, lintelConcreteRail]);

/**
 * The formwork a frame is cast against: the contact area of the same beams, tie beams and lintels.
 * Column and shear-wall formwork arrives with the leaf that reads a storey's clear height, so no
 * vertical stands in this list yet — and a class with no rail is a class nothing measures.
 */
export const frameFormworkRail: Rail = composed([beamFormworkRail, tieBeamFormworkRail, lintelFormworkRail]);
