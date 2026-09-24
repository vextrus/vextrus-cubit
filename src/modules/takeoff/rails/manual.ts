// The manual arm of each kind a hand measurement may be offered under (s-measure I-384, I-539).
//
// L-MEA-08 selects a rail per KIND, never per drawing and never per engine, so a hand measurement has
// no rail of its own: each kind's one rail gains a manual arm, and this area is where those arms are
// declared. The barrel composes an arm with the machine's rail for the same kind (`enumerateRails`),
// so `pcc.blinding` is still measured by one function — the foundations' machine reader and this arm,
// their batches concatenated.
//
// An arm reads `setup.manual` — the revision's standing hand measurements, read once by the run — and
// offers each through the one builder the act's preview asks the gate with (`manualOffersOf`), so what
// the card showed is what publishes. The machine's rails never see a hand row: the run hands them the
// machine's rows (`machineRowsOf`), keyed on the manual-origin fact rather than on a mark.
//
// A measurement the builder refuses is reported, by its registered code, as an observation of the
// kind's rail about that object — evidence beside the cell it leaves unmeasured (L-QTY-05). A kind the
// builder does not offer for this measurement's geometry and class reports nothing: no rule was asked.
import type { Kind } from "@/core/catalogue/kinds";
import { manualOffersOf } from "@/core/manual/offer";
import type { Offer, Rail, RailInput, RailObservation } from "@/core/offers/contract";
import { MANUAL_RULES } from "@/core/rulesets/methods/manual/rules";
import type { RailRoster } from "./law";

/** The manual arm of one kind: every standing hand measurement's offer under it, or its refusal. */
function manualArmOf(kind: Kind): Rail {
  return (input: RailInput) => {
    const offers: Offer[] = [];
    const observations: RailObservation[] = [];
    for (const measurement of input.setup.manual?.measurements ?? []) {
      if (!measurement.recipe.kinds.some((entry) => entry.kind === kind)) continue;
      for (const answer of manualOffersOf(measurement, input.setup.edition)) {
        if (answer.kind !== kind) continue;
        if (answer.state === "offered") offers.push(answer.offer);
        else if (answer.state === "refused") observations.push({ class: measurement.recipe.elementClass, kind, code: answer.code, objectKey: measurement.objectKey, detail: { ...answer.detail } });
      }
    }
    return { offers, observations };
  };
}

/** Every kind a hand measurement may be offered under today, each with its manual arm (I-539). */
export const MANUAL_RAILS: RailRoster = Object.freeze(Object.fromEntries([...new Set(MANUAL_RULES.map((rule) => rule.kind))].map((kind) => [kind, manualArmOf(kind)])));
