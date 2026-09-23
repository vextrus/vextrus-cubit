// S-Measure's refusals (docs/design/s-measure.md §5): what the manual measurement act answers at
// preview, inside the card, where a hand measurement cannot stand. Each is a statement about the
// sheet, the view, the level or the ground already measured — never a fault — and each names what
// resolves it. The specifics (which measurement, which view, which point) travel in the refusal's
// own facts, which the act fills; the sentences here are static (R-SPINE-062).
//
// Every code is `warning` on `dialog`: it answers inside the card the QS is confirming (I-373).

import type { RefusalGroup } from "./law";

/** Every code this area registers. The barrel folds this union into `RefusalCode` (B-19). */
export type ManualRefusalCode =
  | "MANUAL_NO_CAMPAIGN"
  | "MANUAL_SHEET_NOT_PINNED"
  | "MANUAL_DISCIPLINE_UNCONFIRMED"
  | "MANUAL_KIND_NOT_THIS_DISCIPLINE"
  | "MANUAL_VIEW_DRAWS_NO_SCOPE"
  | "MANUAL_RING_OFF_VIEW"
  | "MANUAL_GEOMETRY_DEGENERATE"
  | "MANUAL_LEVEL_UNSTATED"
  | "MANUAL_UNIT_NOT_CONVERTIBLE"
  | "MANUAL_OVERLAP"
  | "MANUAL_CELL_OTHER_VIEW"
  | "MANUAL_CELL_MACHINE_MEASURED"
  | "MANUAL_PREDECESSOR_NOT_STANDING"
  | "MANUAL_CONDITION_NOT_STANDING";

/** This area's registered refusals, frozen entry by entry exactly as the one register holds them. */
export const MANUAL_REFUSALS: RefusalGroup<ManualRefusalCode> = Object.freeze({
  // L-REG-07: a campaign is what a pinned drawing-set revision opens, and a register row stands in
  // one revision. With none open there is nothing a measurement could stand in.
  MANUAL_NO_CAMPAIGN: Object.freeze({
    code: "MANUAL_NO_CAMPAIGN",
    message: "No campaign is open on this project, so a measurement has no drawing-set revision to stand in.",
    remedy: "Pin the drawing set in Takeoff to open a campaign, then measure.",
    severity: "warning",
    surface: "dialog",
  }),
  // L-REG-06, L-REG-07: only the pinned revision's drawings are measured in the campaign.
  MANUAL_SHEET_NOT_PINNED: Object.freeze({
    code: "MANUAL_SHEET_NOT_PINNED",
    message: "This sheet is not in the campaign's pinned drawing set, so a measurement on it could never be billed.",
    remedy: "Open the sheet from the pinned set, or pin a set that includes it.",
    severity: "warning",
    surface: "dialog",
  }),
  // L-REG-03, I-376: discipline is human-confirmed and fails closed — an unconfirmed sheet is not walked.
  MANUAL_DISCIPLINE_UNCONFIRMED: Object.freeze({
    code: "MANUAL_DISCIPLINE_UNCONFIRMED",
    message: "Nobody has confirmed this sheet's discipline, and a sheet whose discipline is unconfirmed is not measured.",
    remedy: "Confirm the sheet's discipline on the Drawings screen, then measure.",
    severity: "warning",
    surface: "dialog",
  }),
  // L-REG-03, I-376: each kind has exactly one authoritative discipline (`KIND_DISCIPLINE`).
  MANUAL_KIND_NOT_THIS_DISCIPLINE: Object.freeze({
    code: "MANUAL_KIND_NOT_THIS_DISCIPLINE",
    message: "This kind is measured off another discipline's drawings, so it cannot be measured on this sheet.",
    remedy: "Measure it on a sheet of the discipline that states it.",
    severity: "warning",
    surface: "dialog",
  }),
  // I-375: schedules, notes and title blocks draw no scope.
  MANUAL_VIEW_DRAWS_NO_SCOPE: Object.freeze({
    code: "MANUAL_VIEW_DRAWS_NO_SCOPE",
    message: "Schedules, notes and title blocks draw nothing that can be measured.",
    remedy: "Measure on a plan, section or detail of the scope.",
    severity: "warning",
    surface: "dialog",
  }),
  // I-375: every point stands in the one view the measurement names.
  MANUAL_RING_OFF_VIEW: Object.freeze({
    code: "MANUAL_RING_OFF_VIEW",
    message: "The outline's points stand in more than one view, or in none, so it has no single view to be measured on.",
    remedy: "Keep every point inside one view of the sheet.",
    severity: "warning",
    surface: "dialog",
  }),
  // L-QTY-04: a figure that would count some ground twice, or none at all, is no figure.
  MANUAL_GEOMETRY_DEGENERATE: Object.freeze({
    code: "MANUAL_GEOMETRY_DEGENERATE",
    message: "The outline encloses nothing measurable: it crosses itself, has too few distinct points, or a cut-out stands outside it or over another cut-out.",
    remedy: "Redraw it with points that enclose the scope once, and cut-outs inside it.",
    severity: "warning",
    surface: "dialog",
  }),
  // I-377, I-368: a hand measurement is never keyed into the UNRESOLVED slot.
  MANUAL_LEVEL_UNSTATED: Object.freeze({
    code: "MANUAL_LEVEL_UNSTATED",
    message: "This measurement stands on no level, and a quantity with no level cannot be billed by floor.",
    remedy: "Pick the level on the card, or add the level to the stack first.",
    severity: "warning",
    surface: "dialog",
  }),
  // I-386: the gate converts by named unit and multiplies no factor, so a view not drawn full size in
  // a unit it converts would bill a hand figure at the wrong size.
  MANUAL_UNIT_NOT_CONVERTIBLE: Object.freeze({
    code: "MANUAL_UNIT_NOT_CONVERTIBLE",
    message: "This view is not drawn full size in a length unit the bill converts yet, so a hand figure here would be billed at the wrong size.",
    remedy: "Measure on a sheet drawn full size in millimetres, metres or feet.",
    severity: "warning",
    surface: "dialog",
  }),
  // I-380: two hand measurements of one cell on one view never measure the same ground.
  MANUAL_OVERLAP: Object.freeze({
    code: "MANUAL_OVERLAP",
    message: "This outline overlaps a measurement already standing under this class and kind on this level.",
    remedy: "Trim the outline to the ground the other does not cover, or edit the other.",
    severity: "warning",
    surface: "dialog",
  }),
  // I-381: one cell is measured by hand on one view until two views are proven disjoint.
  MANUAL_CELL_OTHER_VIEW: Object.freeze({
    code: "MANUAL_CELL_OTHER_VIEW",
    message: "This class and kind on this level is already measured by hand on another view, and the two cannot be shown to cover different ground.",
    remedy: "Measure this class and kind on this level on one sheet only.",
    severity: "warning",
    surface: "dialog",
  }),
  // I-382: a cell holds machine lines or hand lines, never both.
  MANUAL_CELL_MACHINE_MEASURED: Object.freeze({
    code: "MANUAL_CELL_MACHINE_MEASURED",
    message: "The product already measures this class and kind on this level, so a hand measurement there would count the same scope twice.",
    remedy: "Measure a class, kind or level the product does not, or repudiate its objects here first.",
    severity: "warning",
    surface: "dialog",
  }),
  // I-379: an edit names the standing measurement it replaces; one already deleted or replaced is not there to replace.
  MANUAL_PREDECESSOR_NOT_STANDING: Object.freeze({
    code: "MANUAL_PREDECESSOR_NOT_STANDING",
    message: "The measurement this edit replaces no longer stands: it was deleted or already replaced.",
    remedy: "Open the measurement that stands now and edit that one.",
    severity: "warning",
    surface: "dialog",
  }),
  // I-374, R-TO-041: a recipe applied from the chest names a condition of THIS project that still
  // stands; one retired, or one the project's chest never held, is no condition to measure with.
  MANUAL_CONDITION_NOT_STANDING: Object.freeze({
    code: "MANUAL_CONDITION_NOT_STANDING",
    message: "The condition this measurement applies is not in this project's chest: it was retired, or it belongs to another project.",
    remedy: "Pick a condition that stands in this project's chest, then measure.",
    severity: "warning",
    surface: "dialog",
  }),
});
