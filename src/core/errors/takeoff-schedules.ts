// R-TO-031's schedule refusals (L-CAD-08): a schedule-titled view that yielded no table, and a table
// rebuilt whose rows name no member. The closed list the store's CHECK is written from stands here
// too, beside the codes it is made of.

import type { RefusalGroup } from "./law";

/** Every code this area registers. The barrel folds this union into `RefusalCode` (B-19). */
export type TakeoffSchedulesRefusalCode =
  | "SCHEDULE_NONE_RECONSTRUCTED"
  | "SCHEDULE_VIEW_CONTRIBUTED_NOTHING";

/** This area's registered refusals, frozen entry by entry exactly as the one register holds them. */
export const TAKEOFF_SCHEDULES_REFUSALS: RefusalGroup<TakeoffSchedulesRefusalCode> = Object.freeze({
  // L-CAD-08's answer where a schedule-titled view yielded no table at all — no band of it holds a
  // name or mark cell, so there is no header to take columns from and a table reconstructed without
  // one would be columns nobody drew (R-TO-031).
  SCHEDULE_NONE_RECONSTRUCTED: Object.freeze({
    code: "SCHEDULE_NONE_RECONSTRUCTED",
    message: "This schedule shows no header row naming its members, so no table was rebuilt from it.",
    remedy: "Add a heading such as MARK over the column of member names, then ingest the drawing again.",
    severity: "info",
    surface: "inline",
  }),
  // R-TO-031's other answer: the table rebuilt, and not one of its rows names a member — a schedule
  // of notes and dashes registers no member type rather than a family invented from noise (L-QTY-04).
  SCHEDULE_VIEW_CONTRIBUTED_NOTHING: Object.freeze({
    code: "SCHEDULE_VIEW_CONTRIBUTED_NOTHING",
    message: "This schedule's rows name no member, so it added no member types.",
    remedy: "Check that the mark column holds member names such as C1, then ingest the drawing again.",
    severity: "info",
    surface: "inline",
  }),
});

/**
 * Why a schedule view defers: the codes of this register a SCHEDULE view stands under when it yielded
 * no table, or a table naming no member. One list, read by the store's CHECK and published by the
 * partition's door alike — a vocabulary written twice drifts (B-17, Q-07).
 *
 * It stands with the codes rather than with the table because the seam is not a module's to import
 * (SEAM-TENANT), and a roster its readers cannot reach is a roster they would copy.
 */
export const SCHEDULE_DEFERRAL_REASONS = ["SCHEDULE_NONE_RECONSTRUCTED", "SCHEDULE_VIEW_CONTRIBUTED_NOTHING"] as const satisfies readonly TakeoffSchedulesRefusalCode[];

/** One of the two. */
export type ScheduleDeferralReason = (typeof SCHEDULE_DEFERRAL_REASONS)[number];
