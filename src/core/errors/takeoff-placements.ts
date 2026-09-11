// L-CAD-07's expansion refusals: a typical plan that states no range at all, and a stated range whose
// endpoint the project's stack lacks. The closed list the store's CHECK is written from stands here
// too, beside the codes it is made of.

import type { RefusalGroup } from "./law";

/** Every code this area registers. The barrel folds this union into `RefusalCode` (B-19). */
export type TakeoffPlacementsRefusalCode =
  | "TYPICAL_RANGE_UNSTATED"
  | "LEVEL_RANGE_ENDPOINT_UNMAPPED";

/** This area's registered refusals, frozen entry by entry exactly as the one register holds them. */
export const TAKEOFF_PLACEMENTS_REFUSALS: RefusalGroup<TakeoffPlacementsRefusalCode> = Object.freeze({
  // L-CAD-07's answer where a typical plan states no range at all: "a bare typical caption states no
  // membership and registers UNRESOLVED rows with no line (`TYPICAL_RANGE_UNSTATED`)". The columns
  // are read and stand in the unresolved slot; which levels they repeat over is nobody's guess.
  TYPICAL_RANGE_UNSTATED: Object.freeze({
    code: "TYPICAL_RANGE_UNSTATED",
    message: "This typical plan does not say which floors it is typical of, so what stands on it is not spread over any of them.",
    remedy: "State the range of floors this plan is typical of, which registers the members on every floor of it.",
    severity: "info",
    surface: "inline",
  }),
  // L-CAD-07's other expansion answer: "a stated range whose endpoint the stack lacks refuses
  // `LEVEL_RANGE_ENDPOINT_UNMAPPED`". Answered by the expansion where a caption names the endpoint,
  // and by the authoring act where a person does.
  LEVEL_RANGE_ENDPOINT_UNMAPPED: Object.freeze({
    code: "LEVEL_RANGE_ENDPOINT_UNMAPPED",
    message: "The level stack carries no level at one end of this range, so the range reaches past the building that was authored.",
    remedy: "Author the level this range runs to, then state the range again.",
    severity: "error",
    surface: "inline",
  }),
});

/**
 * Why a view's vertical members expand over no level: the codes of this register the expansion stage
 * stands a view under (L-CAD-07). One list, read by the store's CHECK and published by the
 * partition's door alike — a vocabulary written twice drifts (B-17, Q-07).
 *
 * It stands with the codes for the reason the schedule list does: the seam is not a module's to
 * import (SEAM-TENANT), and a roster its readers cannot reach is a roster they would copy.
 */
export const EXPANSION_DEFERRAL_REASONS = ["TYPICAL_RANGE_UNSTATED", "LEVEL_RANGE_ENDPOINT_UNMAPPED"] as const satisfies readonly TakeoffPlacementsRefusalCode[];

/** One of the two. */
export type ExpansionDeferralReason = (typeof EXPANSION_DEFERRAL_REASONS)[number];
