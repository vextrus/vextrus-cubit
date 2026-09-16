// L-MEA-08: the gate "reads deduction thresholds from the edition and partitions strictly-greater".
//
// Strictly greater, in exact decimal, against the threshold as the edition states it — unit and all.
// A candidate exactly AT the threshold is KEPT: the clause says the deduction applies above the
// figure, and a comparison that deducted the boundary case would take material off a bill nobody
// asked to have taken off (L-QTY-04's "nothing lets a reader subtract").
//
// The candidate is carried to the threshold's own unit through the canon, so what is compared is two
// quantities rather than two numbers (B-07, B-17). A threshold stated in a unit the canon has no
// factor for is not something to guess at: the channel refuses `UNIT_UNMAPPED` until the canon holds
// the unit, which is the leaf that adds the member-end and embedded-duct channels.
import { REFUSALS, type RefusalCode } from "../errors";
import type { DeductionCandidate, DeductionChannel } from "../offers/contract";
import { DEDUCTION_CHANNELS } from "../offers/law";
import { isDecimalFigure } from "../projects";
import type { EditionParameter } from "../rulesets/editions/content";
import { CANONICAL_UNIT, convert, exact, isUnit, type Dimension, type Unit } from "../units/canon";
import { normaliseMeasure } from "./units";

/** What a partition answers: the two sides, or the registered code that stopped it. */
export type DeductionPartition =
  | { readonly ok: true; readonly deducted: DeductionCandidate[]; readonly kept: DeductionCandidate[] }
  | { readonly ok: false; readonly code: RefusalCode };

/**
 * Which edition parameter each channel is partitioned against (L-MEA-01's parameter roster). One
 * map, so the channel a rail offers and the threshold the edition states cannot drift apart.
 */
export const CHANNEL_THRESHOLD: Readonly<Record<DeductionChannel, string>> = Object.freeze({
  opening: "openingDeductionMinM2",
  // A finish is applied around the openings a wall is built around, and L-MEA-03 gives the surface
  // group its own figure: the two channels never borrow each other's threshold (L-MEA-01).
  finish_opening: "finishOpeningDeductionMinM2",
});

/**
 * Which declared variable each channel's DEDUCTED SUM is bound into (L-MEA-02: "deducted sum … in
 * the line's variables").
 *
 * The sum is the GATE's to bind and never a rail's: a rail enumerates candidates and computes
 * nothing (L-MEA-08), and which side of the threshold each one falls on is decided here. One map, so
 * the channel a method declares and the variable its tree subtracts cannot drift apart.
 */
export const CHANNEL_VARIABLE: Readonly<Record<DeductionChannel, string>> = Object.freeze({
  opening: "openings",
  finish_opening: "openings",
});

/** Is this spelling one of the channels the contract admits? */
function isChannel(channel: string): channel is DeductionChannel {
  return (DEDUCTION_CHANNELS as readonly string[]).includes(channel);
}

/**
 * Partition candidates into what is deducted and what is kept, against the edition's own thresholds.
 *
 * A candidate in a channel the contract does not admit is a violation of the rail↔gate contract and
 * not a measurement question, so it answers `OFFER_NOT_TO_CONTRACT`; a candidate or a threshold the
 * canon cannot carry answers `UNIT_UNMAPPED`. An edition that states no threshold for a channel it
 * admits is an inconsistency of the store rather than an answer anyone is owed (ARCH-03).
 */
export function partitionDeductions(candidates: readonly DeductionCandidate[], parameters: Readonly<Record<string, EditionParameter>>): DeductionPartition {
  const deducted: DeductionCandidate[] = [];
  const kept: DeductionCandidate[] = [];

  for (const candidate of candidates) {
    if (!isChannel(candidate.channel)) return { ok: false, code: REFUSALS.OFFER_NOT_TO_CONTRACT.code };
    // A candidate whose reading is not a decimal figure is not a quantity to compare at all — the
    // same answer the gate gives any unreadable reading, in the same grammar (B-07, B-17).
    if (!isDecimalFigure(candidate.measure.value)) return { ok: false, code: REFUSALS.OFFER_NOT_TO_CONTRACT.code };
    const named = CHANNEL_THRESHOLD[candidate.channel];
    const threshold = parameters[named];
    if (threshold === undefined) {
      throw new Error(`the rule-set edition states no ${named} — the ${candidate.channel} channel is partitioned against it, and a threshold nobody stated is not one to guess (L-MEA-01)`);
    }
    // A threshold is authored, versioned content and not a rail's reading: one that is not a figure
    // at all is an inconsistency of the store rather than an answer this offer is owed (ARCH-03).
    if (!isDecimalFigure(threshold.value)) {
      throw new Error(`the rule-set edition states ${named} as ${JSON.stringify(threshold.value)}, which is not a decimal figure — a parameter is a versioned VALUE (L-MEA-01, B-07)`);
    }
    // The threshold's unit before the candidate's: a channel whose threshold the canon cannot carry
    // is refused whatever the candidate says, rather than being compared in one of the two units.
    if (!isUnit(threshold.unit) || !isUnit(candidate.measure.unit)) return { ok: false, code: REFUSALS.UNIT_UNMAPPED.code };
    const carried = convert(candidate.measure.value, candidate.measure.unit, threshold.unit);
    if (!carried.ok) return { ok: false, code: carried.code };

    if (exact(carried.value).gt(exact(threshold.value))) deducted.push(candidate);
    else kept.push(candidate);
  }

  return { ok: true, deducted, kept };
}

/** What one channel's deducted sum comes to, or the registered code that stopped it. */
export type DeductedSum = { readonly ok: true; readonly value: string; readonly unit: Unit } | { readonly ok: false; readonly code: RefusalCode };

/**
 * The exact sum of what ONE channel deducted, in the canonical unit of the dimension the variable it
 * binds into stands in (L-MEA-02's "deducted sum", B-07).
 *
 * Every candidate is carried through the gate's one normalisation before it is added, so what is
 * summed is a set of quantities rather than a set of numbers — two openings written in different
 * units add up to what they are worth, and a unit the canon carries no factor for answers by name
 * rather than being counted as its own digits (B-17, L-FRM-06).
 */
export function deductedSum(deducted: readonly DeductionCandidate[], channel: DeductionChannel, dimension: Dimension): DeductedSum {
  let total = exact("0");
  for (const candidate of deducted) {
    if (candidate.channel !== channel) continue;
    const carried = normaliseMeasure(candidate.measure, dimension);
    if (!carried.ok) return { ok: false, code: carried.code };
    total = total.add(carried.value);
  }
  return { ok: true, value: total.toString(), unit: CANONICAL_UNIT[dimension] };
}
