// The FRAME rail's own refusals — L-MEA-08's rail-local codes, keyed (column × rcc.concrete) and,
// from the M3 leaf, (beam | tie_beam | lintel × rcc.concrete | rcc.formwork).
//
// M3 writes its frame rail here: a rail's refusals belong to the rail, so the file a rail is written
// in is the file its codes are registered in, and no two rails ever edit one list (AM-11).

import type { RefusalGroup } from "./law";

/** Every code this area registers. The barrel folds this union into `RefusalCode` (B-19). */
export type FrameRefusalCode =
  | "VIEW_SCALE_UNAFFIRMED"
  | "MEMBER_TYPE_UNKNOWN"
  | "SECTION_BAND_UNCOVERED"
  | "SECTION_UNIT_UNSTATED"
  | "RUN_UNREAD"
  | "SLAB_THICKNESS_UNSTATED"
  | "LINTEL_SOURCE_ABSENT";

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
  // A beam is measured clear between the faces that support it (L-MEA-09), and a run nobody read is
  // a run this rail will not replace with the grid-to-grid span: the member is reported, never
  // offered on a figure the drawing did not state.
  RUN_UNREAD: Object.freeze({
    code: "RUN_UNREAD",
    message: "The drawing states no clear run for this member, so there is no length to measure it along.",
    remedy: "Check that the member's edge lines and its supports are drawn on the plan, then rebuild the drawing's partition.",
    severity: "warning",
    surface: "inline",
  }),
  // The thicker adjoining slab governs a beam's `t` (L-MEA-09). Where the view states none for a
  // side, the row is KEPT with that component declared omitted — an unread thickness is never a zero
  // and never a guess (L-QTY-02).
  SLAB_THICKNESS_UNSTATED: Object.freeze({
    code: "SLAB_THICKNESS_UNSTATED",
    message: "The view states no slab thickness adjoining this side of the member, so its depth below the soffit is not measured.",
    remedy: "State the slab thickness on the plan that draws it — its caption or its slab note — then measure the campaign again.",
    severity: "warning",
    surface: "inline",
  }),
  // A lintel is measured from the opening schedule that states it and from nowhere else: a lintel
  // inferred from the wall it spans would be a member nobody scheduled (R-TO-032).
  LINTEL_SOURCE_ABSENT: Object.freeze({
    code: "LINTEL_SOURCE_ABSENT",
    message: "No scheduled opening stands behind this lintel, so there is nothing stating the span and section to measure it by.",
    remedy: "Read the drawing's opening schedule so the lintel's opening is registered, then measure the campaign again.",
    severity: "warning",
    surface: "inline",
  }),
});
