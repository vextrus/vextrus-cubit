// L-CAD-07's expansion refusals: a typical plan that states no range at all, and a stated range whose
// endpoint the project's stack lacks. The closed list the store's CHECK is written from stands here
// too, beside the codes it is made of.

import type { MasonryRefusalCode } from "./masonry";
import type { RefusalGroup } from "./law";

/** Every code this area registers. The barrel folds this union into `RefusalCode` (B-19). */
export type TakeoffPlacementsRefusalCode =
  | "TYPICAL_RANGE_UNSTATED"
  | "LEVEL_RANGE_ENDPOINT_UNMAPPED"
  | "FRAMED_PAIR_UNNAMED"
  | "ROOM_OUTLINE_OUT_OF_BAND"
  | "ROOM_UNNAMED"
  | "ROOM_AREA_DISAGREES";

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
  // I-613: a pair of edge lines a plan draws at a width a framed member's schedule states, that
  // no mark names — its own, a chain's or another plan's at the same grid reference. Known scope, not
  // measured: L-QTY-04's declared exclusion, enumerated on the measurement boundary, never counted.
  FRAMED_PAIR_UNNAMED: Object.freeze({
    code: "FRAMED_PAIR_UNNAMED",
    message: "The plan draws this beam, but no mark on the drawings names it, so nothing of it is measured.",
    remedy: "Take it off by hand from the plan that draws it, or have the drawing lettered and ingest the revision.",
    severity: "info",
    surface: "inline",
  }),
  // The rooms an architect's plan encloses (s-takeoff I-643…d): a closed region the partition
  // read and did not register as a room, each by name, because L-MEA-01 drops out-of-band outlines
  // "listed, never silently" and every refusal carries a named reason.
  ROOM_OUTLINE_OUT_OF_BAND: Object.freeze({
    code: "ROOM_OUTLINE_OUT_OF_BAND",
    message: "This closed region is smaller or larger than any room outline the rule set admits, so it is listed and not registered as a room.",
    remedy: "Check the region on the plan; where it is a room, trace its outline with the area tool.",
    severity: "info",
    surface: "inline",
  }),
  ROOM_UNNAMED: Object.freeze({
    code: "ROOM_UNNAMED",
    message: "No room label stands in this closed region, so nothing says which room it is and it is not registered.",
    remedy: "Label the room on the plan with its name and size, or trace and name it with the area tool.",
    severity: "info",
    surface: "inline",
  }),
  // L-FRM-01: "a stored plan area disagreeing with its own polygon's shoelace by more than 0.5 % refuses".
  ROOM_AREA_DISAGREES: Object.freeze({
    code: "ROOM_AREA_DISAGREES",
    message: "This room's area and the shoelace of its own outline disagree by more than half a percent, so its outline is not registered.",
    remedy: "Redraw the room's curved edges with finer segments, or trace the room with the area tool.",
    severity: "warning",
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

/**
 * Why a closed region of an architect's plan is not registered as a room — the codes the rooms stage
 * stands a region under (s-takeoff I-643…d), and L-MEA-03's own `SURFACE_NOT_CLOSED` for a room
 * label standing in no closed region at all. One list, read by the store's CHECK and the overlay alike.
 */
export const ROOM_OUTLINE_REASONS = ["SURFACE_NOT_CLOSED", "ROOM_OUTLINE_OUT_OF_BAND", "ROOM_UNNAMED", "ROOM_AREA_DISAGREES"] as const satisfies readonly (TakeoffPlacementsRefusalCode | MasonryRefusalCode)[];

/** One of the four. */
export type RoomOutlineReason = (typeof ROOM_OUTLINE_REASONS)[number];
