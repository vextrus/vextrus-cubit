// The per-question calibration line (L-AI-01's ledger read against L-AI-02's outcomes): how well
// each closed question answers, derived from the rows the ledger and its outcome column hold and
// from nothing else. Pure — it names no store and no seam — so the same rows derive the same line
// wherever they are read (B-17), and the audit's panel, the handoff and a test all quote one figure.
//
// What a line states, per question: how many calls were proposed and how many refused; how many
// proposals a person has judged, and how — CONFIRMED, OVERRULED, REPUDIATED, AFFIRMED — reading the
// NEWEST outcome per call, because a later judgment supersedes an earlier one and both are kept;
// how many still await a person; and the mean of the model's own confidence over the calls a person
// confirmed or affirmed against the mean over the calls a person overruled or repudiated. A model
// whose confidence is higher where it was right than where it was wrong is one a threshold can be
// set on; one whose confidence does not separate the two is one no threshold should move for.
//
// Not every question HAS a confidence to average. A Noul states a probability and no confidence at
// all (`./model/typesafe`), so a question asked as one is judged, counted and still has no figure
// either mean can be taken over. `confidenceStated` is what keeps that from reading as silence: it
// says how many judged calls stated a confidence, so a reader can tell a question nobody has judged
// from a question whose answers state none. Nothing here invents a figure in its place — a mean of
// the probabilities would be a different instrument, calibrating the band a caller bands ON rather
// than the confidence a threshold is set from, and it is not this line's (L-AI-02).
import { UNNAMED_QUESTION, type ModelOutcome } from "./db";

/** How the ledger spells a call that answered. */
const PROPOSED = "proposed";

/** The one call of a ledger row this derivation reads. */
export type CalibrationCall = {
  readonly callId: string;
  readonly question: string | null;
  readonly outcome: string;
  readonly judgment: { readonly confidence: number | null } | null;
};

/** The one outcome of an outcome row this derivation reads — newest first, as the store answers them. */
export type CalibrationOutcome = {
  readonly callId: string;
  readonly outcome: ModelOutcome;
};

/** How a question answers, as the ledger and its outcomes show it. */
export type CalibrationLine = {
  readonly question: string;
  readonly proposed: number;
  readonly refused: number;
  readonly confirmed: number;
  readonly overruled: number;
  readonly repudiated: number;
  readonly affirmed: number;
  readonly awaiting: number;
  /**
   * How many of the judged calls stated a confidence at all — the population both means are taken
   * over. Zero beside a judged count above zero says this question's answers state no confidence (a
   * Noul), which is a different fact from nobody having judged it yet.
   */
  readonly confidenceStated: number;
  /** Mean confidence over the calls a person confirmed or affirmed, spelled to three places, or null where none carried one. */
  readonly meanConfidenceWhenRight: string | null;
  /** Mean confidence over the calls a person overruled or repudiated, the same way. */
  readonly meanConfidenceWhenWrong: string | null;
};

/** The two outcomes that say the model was right, and the two that say it was not. */
const RIGHT: ReadonlySet<ModelOutcome> = new Set(["CONFIRMED", "AFFIRMED"]);

/**
 * One line per question, in code-point order of the question's name. Outcomes arrive newest first
 * and the first seen per call is the one that stands.
 */
export function calibrationLinesOf(calls: readonly CalibrationCall[], outcomes: readonly CalibrationOutcome[]): CalibrationLine[] {
  const newest = new Map<string, ModelOutcome>();
  for (const outcome of outcomes) if (!newest.has(outcome.callId)) newest.set(outcome.callId, outcome.outcome);

  type Tally = { proposed: number; refused: number; counts: Record<ModelOutcome, number>; right: number[]; wrong: number[] };
  const byQuestion = new Map<string, Tally>();
  const tallyOf = (question: string): Tally => {
    const held = byQuestion.get(question);
    if (held !== undefined) return held;
    const fresh: Tally = { proposed: 0, refused: 0, counts: { CONFIRMED: 0, OVERRULED: 0, REPUDIATED: 0, AFFIRMED: 0 }, right: [], wrong: [] };
    byQuestion.set(question, fresh);
    return fresh;
  };

  for (const call of calls) {
    const tally = tallyOf(call.question ?? UNNAMED_QUESTION);
    if (call.outcome !== PROPOSED) {
      tally.refused += 1;
      continue;
    }
    tally.proposed += 1;
    const judged = newest.get(call.callId);
    if (judged === undefined) continue;
    tally.counts[judged] += 1;
    const confidence = call.judgment?.confidence ?? null;
    if (confidence === null) continue;
    (RIGHT.has(judged) ? tally.right : tally.wrong).push(confidence);
  }

  return [...byQuestion.entries()]
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([question, tally]) => {
      const judged = tally.counts.CONFIRMED + tally.counts.OVERRULED + tally.counts.REPUDIATED + tally.counts.AFFIRMED;
      return {
        question,
        proposed: tally.proposed,
        refused: tally.refused,
        confirmed: tally.counts.CONFIRMED,
        overruled: tally.counts.OVERRULED,
        repudiated: tally.counts.REPUDIATED,
        affirmed: tally.counts.AFFIRMED,
        awaiting: tally.proposed - judged,
        confidenceStated: tally.right.length + tally.wrong.length,
        meanConfidenceWhenRight: meanOf(tally.right),
        meanConfidenceWhenWrong: meanOf(tally.wrong),
      };
    });
}

/** The arithmetic mean to three places, or null over nothing — a mean of no figures is not 0. */
function meanOf(figures: readonly number[]): string | null {
  if (figures.length === 0) return null;
  const total = figures.reduce((sum, figure) => sum + figure, 0);
  return (total / figures.length).toFixed(3);
}
