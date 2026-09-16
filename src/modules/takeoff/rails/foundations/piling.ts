// R-TO-032's piles: "piles (count × length)", keyed (pile × piling.bored) and (pile × piling.boring).
//
// Two rails because they are two kinds: a bill pays for the piles installed by the number and for the
// boring by the running metre, and a rail is selected per KIND (L-MEA-08, L-MEA-04). Neither derives
// anything from the other — the count is the register's own row, and the length is the pile
// schedule's (AM-06 §2: "pile length comes from the pile schedule").
import type { ElementType } from "@/core/catalogue/classes";
import type { Kind } from "@/core/catalogue/kinds";
import type { GeometryType, Measure, Offer, OmittedComponent, Rail, RailInput, RailObservation, RailSetup } from "@/core/offers/contract";
import { DIA, DIAMETER, LENGTH, PILE, PILE_LENGTH_UNSTATED, PRISM_POLY, countOf, dimensionOf, resolve, type Read } from "./read";

/** The rules these rails offer under. An offer names a rule and never a version (L-MEA-08). */
export const PILE_COUNT_RULE_ID = "piling.bored.count";
export const PILE_LENGTH_RULE_ID = "piling.bored.length";

/** The two kinds, one rail each (L-MEA-08). */
const PILING_BORED: Kind = "piling.bored";
const PILING_BORING: Kind = "piling.boring";

/** The variables the two rules declare, by the names their templates spell them under. */
const COUNT = "count";
const PILE_LENGTH = "length";

/** A pile's shaft is a prism over a circle — a plan that is no rectangle (L-FRM-01). */
const PILE_GEOMETRY: GeometryType = PRISM_POLY;

/** One offer about one pile, under the kind the rail measures (L-MEA-08's offer, whole). */
function offerOf(read: Read, kind: Kind, ruleId: string, bindings: Record<string, Measure>, omitted: OmittedComponent[], selectors: Record<string, Measure>): Offer {
  const { row, placement, calibration } = read;
  return {
    ruleId,
    kind,
    class: PILE,
    register: { setRevisionId: row.setRevisionId, objectKey: row.objectKey },
    drawing: { drawingId: placement.drawingId, viewKey: placement.viewKey },
    engine: placement.engine,
    geometry: { type: PILE_GEOMETRY, basis: row.standing, calibration },
    bindings: { [COUNT]: countOf(read), ...bindings },
    selectors,
    deductions: [],
    omitted,
    coverage: omitted.length === 0 ? "COMPLETE" : "PARTIAL_DECLARED",
  };
}

/**
 * A bore is priced by its diameter: two piles of different diameters are two items, however alike
 * their lengths (L-QTY-03's item-selecting attributes). Where the schedule states none, nothing is
 * selected by — and the selection basis rolls up to DEFAULTED at the gate (L-QTY-01).
 */
function boreOf(read: Read): Record<string, Measure> {
  const dia = dimensionOf(read, DIA);
  return dia === undefined ? {} : { [DIAMETER]: dia };
}

/** Every pile of the batch, resolved once for whichever of the two rails asked (L-MEA-08). */
function pilesOf(input: RailInput, kind: Kind, offerFor: (read: Read, setup: RailSetup) => Offer): { offers: Offer[]; observations: RailObservation[] } {
  const offers: Offer[] = [];
  const observations: RailObservation[] = [];
  for (const row of input.objects.filter((one) => (one.elementType as ElementType) === PILE)) {
    const resolution = resolve(row, input.setup, kind);
    if (!resolution.ok) {
      observations.push(resolution.observation);
      continue;
    }
    offers.push(offerFor(resolution.read, input.setup));
  }
  return { offers, observations };
}

/**
 * The pile-count rail: one pile, counted.
 *
 * It binds the count and nothing else, and it is COMPLETE whatever the schedule left unsaid — a pile
 * nobody scheduled a length for is still a pile that stands there, and the number of them is a
 * quantity in its own right (R-TO-032, L-QTY-02).
 */
export const pileCountRail: Rail = (input: RailInput) => pilesOf(input, PILING_BORED, (read) => offerOf(read, PILING_BORED, PILE_COUNT_RULE_ID, {}, [], boreOf(read)));

/**
 * The pile-boring rail: the length bored for one pile, as the pile schedule states it.
 *
 * A length the schedule does not state keeps its row with no quantity: the bore is not the depth of
 * the cap above it and not the length of the line somebody drew (AM-06 §2, L-QTY-02).
 */
export const pileLengthRail: Rail = (input: RailInput) =>
  pilesOf(input, PILING_BORING, (read) => {
    const length = dimensionOf(read, LENGTH);
    return length === undefined
      ? offerOf(read, PILING_BORING, PILE_LENGTH_RULE_ID, {}, [{ variable: PILE_LENGTH, code: PILE_LENGTH_UNSTATED }], boreOf(read))
      : offerOf(read, PILING_BORING, PILE_LENGTH_RULE_ID, { [PILE_LENGTH]: length }, [], boreOf(read));
  });
