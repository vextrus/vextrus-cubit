// The caller's policy over one corroboration proposal (L-AI-02: "abstention is the caller's
// decision"; L-AI-01: the seam routes on nothing).
//
// A Noul answers one probability and nothing else, so the words a reader is shown and the outcome a
// person's act files are decided HERE, by two named thresholds, and never by the seam or by the
// adapter. The band between them is the model's own statement that it could not tell: a proposal
// that lands in it is filed neither right nor wrong, because filing it either way would poison the
// calibration line the thresholds are set from (`../model-calibration`).
//
// The figures are the cookbook's own routing band (docs.typesafe.ai/cookbooks/consistency_noul,
// read 2026-09-21) rather than the 0.9 confidence-routing default, because NOTHING is automated by
// them: every outline this question is asked of already waits on a person (L-QTY-04's queue item),
// so the band decides only which sentence the inspector shows and which way an act's outcome is
// filed. Moving one is an increment quoting the recorded corpus (Q-08), never a hunch.
import type { ModelOutcome } from "../db";

/** At or above this probability, the model said the outline IS the member its mark names. */
export const CORROBORATION_YES = 0.7;

/** At or below this probability, the model said it is something else the plan drew there. */
export const CORROBORATION_NO = 0.3;

/** How a proposal reads to a person: the model said yes, said no, or could not tell. */
export type CorroborationReading = "YES" | "UNSURE" | "NO";

/** The two acts that judge one of these proposals — the doors the register's inspector already has. */
export type CorroborationAct = "CORROBORATE" | "REPUDIATE";

/**
 * What the model said, in words. A probability that is not a finite number is no reading at all —
 * nothing is supplied where the model supplied nothing (L-AI-02) — and answers null.
 */
export function corroborationReadingOf(probability: number | null): CorroborationReading | null {
  if (probability === null || !Number.isFinite(probability)) return null;
  if (probability >= CORROBORATION_YES) return "YES";
  if (probability <= CORROBORATION_NO) return "NO";
  return "UNSURE";
}

/**
 * How a person's act judges the proposal that stood beside it, or null where it judges nothing.
 *
 * Where the model said YES, corroborating the object AFFIRMS what it said and repudiating the object
 * REPUDIATES it. Where the model said NO, repudiating CONFIRMS the reading it pointed to and
 * corroborating OVERRULES it. In the band, the model stated it could not tell, so no outcome is
 * recorded at all: an act is still the person's, and it stands whether or not a model spoke.
 */
export function corroborationOutcomeOf(reading: CorroborationReading | null, act: CorroborationAct): ModelOutcome | null {
  if (reading === null || reading === "UNSURE") return null;
  if (reading === "YES") return act === "CORROBORATE" ? "AFFIRMED" : "REPUDIATED";
  return act === "CORROBORATE" ? "OVERRULED" : "CONFIRMED";
}
