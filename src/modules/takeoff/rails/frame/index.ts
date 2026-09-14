// R-TO-032's FRAME rails: the beams, tie/grade beams and lintels a structural frame is made of,
// measured for concrete and for the formwork they are cast against.
//
// Six PURE per-class rails, and two compositions — one per kind. "Rail is selected per quantity
// kind, never per drawing" (L-MEA-08), so what the roster answers for a kind is one function, and
// the classes that kind is borne by compose into it in a fixed order. The column rail stands first
// in the concrete composition, unchanged: the M2 rows it publishes do not move because a beam rail
// landed beside it.
import type { Kind } from "@/core/catalogue/kinds";
import type { Rail, RailInput } from "@/core/offers/contract";
import { columnConcreteRail } from "../columns";
import { lintelRail } from "./lintel";
import { runMemberRail } from "./run-member";

export { FRAME_RAIL_CODES } from "./read";
export type { FrameRailCode } from "./read";

/** The six rules this area offers under. An offer names a rule and never a version (L-MEA-08). */
export const FRAME_RULE_IDS = Object.freeze({
  beamConcrete: "rcc.beam.concrete",
  beamFormwork: "rcc.beam.formwork",
  tieBeamConcrete: "rcc.tie_beam.concrete",
  tieBeamFormwork: "rcc.tie_beam.formwork",
  lintelConcrete: "rcc.lintel.concrete",
  lintelFormwork: "rcc.lintel.formwork",
});

const RCC_CONCRETE: Kind = "rcc.concrete";
const RCC_FORMWORK: Kind = "rcc.formwork";

/** `b × (D − t) × clear`, the thicker adjoining slab governing `t` (L-MEA-09). */
export const beamConcreteRail: Rail = runMemberRail({ class: "beam", ruleId: FRAME_RULE_IDS.beamConcrete, kind: RCC_CONCRETE, sides: "thicker" });

/** `((D − t_left) + (D − t_right) + b) × clear` — two sides and a soffit, each side its own (L-FRM-03). */
export const beamFormworkRail: Rail = runMemberRail({ class: "beam", ruleId: FRAME_RULE_IDS.beamFormwork, kind: RCC_FORMWORK, sides: "each" });

/** `b × D × clear` — a tie beam adjoins no slab, so nothing comes off its depth (L-MEA-09). */
export const tieBeamConcreteRail: Rail = runMemberRail({ class: "tie_beam", ruleId: FRAME_RULE_IDS.tieBeamConcrete, kind: RCC_CONCRETE, sides: "none" });

/** `(2·D + b) × clear` — its two sides and its soffit (L-FRM-03). */
export const tieBeamFormworkRail: Rail = runMemberRail({ class: "tie_beam", ruleId: FRAME_RULE_IDS.tieBeamFormwork, kind: RCC_FORMWORK, sides: "none" });

/** `b × D × (w + 2·bearing)`, read from the opening schedule and from nowhere else (R-TO-032). */
export const lintelConcreteRail: Rail = lintelRail({ ruleId: FRAME_RULE_IDS.lintelConcrete, kind: RCC_CONCRETE });

/** `(2·D + b) × (w + 2·bearing)` — the same opening, read as contact area (L-FRM-03). */
export const lintelFormworkRail: Rail = lintelRail({ ruleId: FRAME_RULE_IDS.lintelFormwork, kind: RCC_FORMWORK });

/**
 * One rail over several member rails: each is asked the same question of the same batch, and what
 * they answer is concatenated in the order the members are named. A rail reads only the rows of its
 * own class, so the composition offers each row exactly once (L-MEA-08).
 */
function composed(members: readonly Rail[]): Rail {
  return (input: RailInput) => {
    // Each member is asked ONCE and its whole batch kept: a rail is pure, so asking twice would
    // answer the same thing at twice the cost, over every row of every campaign (L-MEA-08).
    const batches = members.map((rail) => rail(input));
    return {
      offers: batches.flatMap((batch) => batch.offers),
      observations: batches.flatMap((batch) => batch.observations),
    };
  };
}

/** Every class that bears `rcc.concrete` in this area, the column's first (AC-1's `BEARS` order). */
export const frameConcreteRail: Rail = composed([columnConcreteRail, beamConcreteRail, tieBeamConcreteRail, lintelConcreteRail]);

/** Every class that bears `rcc.formwork` in this area. */
export const frameFormworkRail: Rail = composed([beamFormworkRail, tieBeamFormworkRail, lintelFormworkRail]);
