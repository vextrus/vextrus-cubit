// R-TO-020's QS two-point tool, as the pure half a screen presses: two snapped picks and an entered
// distance read into the observation L-MEA-05 defines, and that observation judged.
//
// Nothing of the law is re-derived here (B-17, ARCH-02). `citeObservation` is what reads a raw
// observation into an axis, a lattice span and a 12-place factor, and `verifyAxis` is what decides
// whether a single observation is corroborated at the edition's tolerance — this file only turns the
// snap region's own picks into the shape core asks for, and turns core's thrown refusals into the
// answers a panel renders (ARCH-03, B-21: a refusal is an answer, never a swallowed fault).
//
// The picks are inc-206's `SnapPick`, whole: no second pick model exists (I-158).
import {
  DISTANCE_BASIS_ENTERED,
  citeObservation,
  isFactorString,
  verifyAxis,
  type ScaleAxis,
  type ScaleRefusalCode,
  type ScaleUnit,
  type TwoPointObservation,
} from "@/core/scale";
import { refusalCodeOf } from "@/core/faults/refusal-marker";
import type { SnapPick } from "@/modules/takeoff/viewer-snap/snap";

/** The refusal a pick standing on nothing the drawing records answers with (L-MEA-05). */
const SCALE_OBSERVATION_UNCITED = "SCALE_OBSERVATION_UNCITED" satisfies ScaleRefusalCode;

/** The refusal an observation nothing corroborates carries — a reading, and never a fault (I-155). */
const SCALE_OBSERVATION_UNVERIFIED = "SCALE_OBSERVATION_UNVERIFIED" satisfies ScaleRefusalCode;

/** The absence `verifyAxis` answers when an axis carries no observation at all (L-MEA-05). */
const SCALE_NO_EVIDENCE = "SCALE_NO_EVIDENCE" satisfies ScaleRefusalCode;

/** The distance a person entered between the two picks, in a unit of the closed lane. */
export type EnteredDistance = { readonly value: string; readonly unit: ScaleUnit };

/** What `observationOf` answers: the observation the two picks make, or the refusal that stops it. */
export type ObservationAnswer = { readonly observation: TwoPointObservation } | { readonly refusal: typeof SCALE_OBSERVATION_UNCITED };

/** What `judgeObservation` answers: what core read off the observation, or the refusal it named. */
export type ObservationJudgement =
  | { readonly axis: ScaleAxis; readonly drawn: string; readonly factor: string; readonly verified: boolean }
  | { readonly refusal: ScaleRefusalCode };

/**
 * The two picks and the entered distance as one observation (L-MEA-05: "each point cites a source
 * key + world coordinate quantised to 0.1 unit; a free click refuses SCALE_OBSERVATION_UNCITED; the
 * stated distance is ENTERED").
 *
 * A pick's citation is the FIRST source key it met: a crossing meets two, and the entity the mark
 * stands on is the one the overlay names first (the snap region's own order). Anything else the law
 * asks of a point — the lattice, the shape of a key — is `citeObservation`'s to judge, so this file
 * refuses only what it can see: a gesture that is not two cited marks.
 */
export function observationOf(picks: readonly SnapPick[], distance: EnteredDistance): ObservationAnswer {
  if (picks.length !== 2) return { refusal: SCALE_OBSERVATION_UNCITED };
  const [from, to] = [picks[0] as SnapPick, picks[1] as SnapPick];
  const cited = [from, to].map((pick) => ({ sourceKey: pick.sourceKeys[0] ?? "", x: pick.keyPoint[0], y: pick.keyPoint[1] }));
  if (cited.some((point) => point.sourceKey === "")) return { refusal: SCALE_OBSERVATION_UNCITED };
  return {
    observation: {
      points: [cited[0] as { sourceKey: string; x: string; y: string }, cited[1] as { sourceKey: string; x: string; y: string }],
      distance,
      distanceBasis: DISTANCE_BASIS_ENTERED,
    },
  };
}

/**
 * One observation judged by the engine's own law: the axis the two points differ along, the lattice
 * span between them and the entered distance in metres over that span, rendered to 12 places — then
 * the single-observation check of that factor against what the drawing's own evidence offers on the
 * same axis, at the edition's verification tolerance.
 *
 * An axis nothing corroborates is NOT a refusal (I-155): the observation was taken, and its span and
 * factor are facts, so the answer is a row that says it is not verified. What core refuses about the
 * observation ITSELF — an uncited point, an oblique pair, a factor the rendering cannot speak — is
 * carried back as the registered code, and anything that is not a registered refusal is a fault and
 * is re-thrown (ARCH-03).
 */
export function judgeObservation(observation: unknown, corroborating: readonly string[], tolerance: string): ObservationJudgement {
  let cited;
  try {
    cited = citeObservation(observation);
  } catch (thrown) {
    return { refusal: refused(thrown) };
  }

  // A factor the law cannot speak verifies nothing, and handing it on would raise a plain Error out
  // of `verifyAxis` — a fault where the law has an answer (B-21).
  const agreeing = corroborating.filter((factor) => isFactorString(factor));
  let verified = true;
  try {
    verifyAxis(cited.axis, [cited.factor], agreeing, tolerance);
  } catch (thrown) {
    const code = refused(thrown);
    if (code !== SCALE_OBSERVATION_UNVERIFIED && code !== SCALE_NO_EVIDENCE) return { refusal: code };
    verified = false;
  }
  return { axis: cited.axis, drawn: cited.drawn, factor: cited.factor, verified };
}

/** The registered scale code a failure travels with, or the failure itself (R-SPINE-062, ARCH-03). */
function refused(thrown: unknown): ScaleRefusalCode {
  const code = refusalCodeOf(thrown);
  if (code === null) throw thrown;
  return code as ScaleRefusalCode;
}
