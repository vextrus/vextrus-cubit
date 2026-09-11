// The FRAME rail's own refusals — L-MEA-08's rail-local codes, keyed (column × rcc.concrete).
//
// M3 writes its frame rail here: a rail's refusals belong to the rail, so the file a rail is written
// in is the file its codes are registered in, and no two rails ever edit one list (AM-11).

import type { RefusalGroup } from "./law";

/** Every code this area registers. The barrel folds this union into `RefusalCode` (B-19). */
export type FrameRefusalCode =
  | "VIEW_SCALE_UNAFFIRMED"
  | "MEMBER_TYPE_UNKNOWN"
  | "SECTION_BAND_UNCOVERED"
  | "SECTION_UNIT_UNSTATED";

/** This area's registered refusals, frozen entry by entry exactly as the one register holds them. */
export const FRAME_REFUSALS: RefusalGroup<FrameRefusalCode> = Object.freeze({
  // L-MEA-08's rail-local codes, keyed (column × rcc.concrete). A rail cannot mint a calibration
  // reference it does not hold and never invents a section, so what it could not read is REPORTED
  // as an observation — evidence in the residue — rather than offered and refused (riskNotes (3)).
  VIEW_SCALE_UNAFFIRMED: Object.freeze({
    code: "VIEW_SCALE_UNAFFIRMED",
    message: "Nobody has affirmed the scale of the view these members were placed in, so their measurements cannot stand on one.",
    remedy: "Open the drawing's scale panel and affirm the view's scale, then measure the campaign again.",
    severity: "warning",
    surface: "inline",
  }),
  MEMBER_TYPE_UNKNOWN: Object.freeze({
    code: "MEMBER_TYPE_UNKNOWN",
    message: "The schedules hold no member type for this mark, so there is no section to measure it by.",
    remedy: "Check the drawing's schedules for the mark, then rebuild the drawing's partition.",
    severity: "warning",
    surface: "inline",
  }),
  SECTION_BAND_UNCOVERED: Object.freeze({
    code: "SECTION_BAND_UNCOVERED",
    message: "No band of this member's schedule covers the level it stands on, so no section applies there.",
    remedy: "Extend the schedule's floor bands over the level, or state the level's own band, then measure again.",
    severity: "warning",
    surface: "inline",
  }),
  SECTION_UNIT_UNSTATED: Object.freeze({
    code: "SECTION_UNIT_UNSTATED",
    message: "This member's section was read without the unit it was written in, so its size cannot be carried.",
    remedy: "Re-read the schedule's section cell so it states its unit, then measure again.",
    severity: "warning",
    surface: "inline",
  }),
});
