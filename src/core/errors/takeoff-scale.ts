// L-MEA-05's scale refusals: membership is positive, never residual, and every one of these says why
// a view measures nothing rather than measuring at a scale nobody affirmed.

import type { RefusalGroup } from "./law";

/** Every code this area registers. The barrel folds this union into `RefusalCode` (B-19). */
export type TakeoffScaleRefusalCode =
  | "SCALE_NO_EVIDENCE"
  | "SCALE_UNIT_UNMAPPED"
  | "SCALE_OBSERVATION_UNCITED"
  | "SCALE_OBSERVATION_OBLIQUE"
  | "SCALE_OBSERVATION_UNVERIFIED";

/** This area's registered refusals, frozen entry by entry exactly as the one register holds them. */
export const TAKEOFF_SCALE_REFUSALS: RefusalGroup<TakeoffScaleRefusalCode> = Object.freeze({
  // L-MEA-05: scale membership is positive, never residual — a view no affirmation act names has no
  // scale and says so, rather than measuring at a scale nobody affirmed.
  SCALE_NO_EVIDENCE: Object.freeze({
    code: "SCALE_NO_EVIDENCE",
    message: "No affirmation names this view, so it has no scale and measures nothing.",
    remedy: "Affirm a scale for the view from a proposal or a two-point calibration, then measure it.",
    severity: "info",
    surface: "inline",
  }),
  // L-MEA-05's strict unit lane: an unmapped or unitless header yields no factor, never a guessed one,
  // so the machine can propose nothing for the view and only a two-point calibration can scale it.
  SCALE_UNIT_UNMAPPED: Object.freeze({
    code: "SCALE_UNIT_UNMAPPED",
    message: "The drawing's units header names no length unit, so no scale can be read from the file.",
    remedy: "Calibrate the view with two cited points and an entered distance, or set the units in the drawing and ingest it again.",
    severity: "info",
    surface: "inline",
  }),
  // L-MEA-05: "each point cites a source key + world coordinate quantised to 0.1 unit; a free click
  // refuses SCALE_OBSERVATION_UNCITED; the stated distance is ENTERED".
  SCALE_OBSERVATION_UNCITED: Object.freeze({
    code: "SCALE_OBSERVATION_UNCITED",
    message: "A calibration point does not cite a drawn entity at a quantised coordinate, or the distance was not entered, so the observation was not taken.",
    remedy: "Snap both points to drawn entities and enter the distance between them with its unit.",
    severity: "error",
    surface: "inline",
  }),
  // L-MEA-05: X and Y derive independently, so a pair of points that differ along both axes — or
  // along neither — observes no axis at all.
  SCALE_OBSERVATION_OBLIQUE: Object.freeze({
    code: "SCALE_OBSERVATION_OBLIQUE",
    message: "The two calibration points do not lie on one axis, so they observe neither the X nor the Y scale.",
    remedy: "Choose two points that differ along exactly one axis — horizontally or vertically.",
    severity: "error",
    surface: "inline",
  }),
  // L-MEA-05: "a single-observation scale is verified at ±1% or rejected".
  SCALE_OBSERVATION_UNVERIFIED: Object.freeze({
    code: "SCALE_OBSERVATION_UNVERIFIED",
    message: "The observed scale along this axis is not verified within tolerance by a second observation or by the drawing's own evidence, so it was not affirmed.",
    remedy: "Add a second observation along the same axis, or check the entered distance against the drawing.",
    severity: "error",
    surface: "inline",
  }),
});
