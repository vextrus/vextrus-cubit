// The answers the scale engine gives instead of a factor (ARCH-03, B-21: a refusal is an answer, not
// a fault). Each travels as the settled core marker — an Error carrying a registered code, built and
// read by `faults/refusal-marker.ts` alone (B-17) — with the facts L-MEA-05 says the refusal names as
// readable properties. The codes belong to the closed taxonomy in `../errors` (R-SPINE-062).
import type { RefusalCode } from "../errors";
import { refusal } from "../faults/refusal-marker";

/** The codes this engine answers with, each read off the closed taxonomy rather than re-spelled (Q-07). */
export type ScaleRefusalCode = Extract<
  RefusalCode,
  "SCALE_NO_EVIDENCE" | "SCALE_UNIT_UNMAPPED" | "SCALE_OBSERVATION_UNCITED" | "SCALE_OBSERVATION_OBLIQUE" | "SCALE_OBSERVATION_UNVERIFIED"
>;

const SCALE_NO_EVIDENCE: ScaleRefusalCode = "SCALE_NO_EVIDENCE";
const SCALE_UNIT_UNMAPPED: ScaleRefusalCode = "SCALE_UNIT_UNMAPPED";
const SCALE_OBSERVATION_UNCITED: ScaleRefusalCode = "SCALE_OBSERVATION_UNCITED";
const SCALE_OBSERVATION_OBLIQUE: ScaleRefusalCode = "SCALE_OBSERVATION_OBLIQUE";
const SCALE_OBSERVATION_UNVERIFIED: ScaleRefusalCode = "SCALE_OBSERVATION_UNVERIFIED";

/** The two codes a view with no affirmed calibration answers under (L-MEA-05: declared, never silent). */
export type ScaleAbsenceCode = Extract<ScaleRefusalCode, "SCALE_NO_EVIDENCE" | "SCALE_UNIT_UNMAPPED">;

/** L-MEA-05: "a view no act names has no scale" — and a rank asked for that the view's evidence does not carry. */
export function scaleNoEvidence(detail: string, facts: { readonly viewKey?: string; readonly rank?: string; readonly axis?: string }): Error {
  return refusal(SCALE_NO_EVIDENCE, detail, facts);
}

/** L-MEA-05's strict unit lane: an unmapped or unitless header carries no factor for any machine rank. */
export function scaleUnitUnmapped(detail: string, facts: { readonly unit: string | null; readonly code?: number }): Error {
  return refusal(SCALE_UNIT_UNMAPPED, detail, facts);
}

/** L-MEA-05: "a free click refuses SCALE_OBSERVATION_UNCITED; the stated distance is ENTERED". */
export function scaleObservationUncited(detail: string, facts: { readonly sourceKey?: string; readonly field?: string }): Error {
  return refusal(SCALE_OBSERVATION_UNCITED, detail, facts);
}

/** L-MEA-05: X and Y derive independently, so a pair that differs along both axes or neither observes nothing. */
export function scaleObservationOblique(detail: string, facts: { readonly dx: string; readonly dy: string }): Error {
  return refusal(SCALE_OBSERVATION_OBLIQUE, detail, facts);
}

/** L-MEA-05: "a single-observation scale is verified at ±1% or rejected". */
export function scaleObservationUnverified(
  detail: string,
  facts: { readonly axis: string; readonly factor: string; readonly tolerance: string; readonly against: readonly string[] },
): Error {
  return refusal(SCALE_OBSERVATION_UNVERIFIED, detail, facts);
}
