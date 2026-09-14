// R-TO-031's schedule refusals (L-CAD-08): a schedule-titled view that yielded no table, and a table
// rebuilt whose rows name no member. The closed list the store's CHECK is written from stands here
// too, beside the codes it is made of.

import type { RefusalGroup } from "./law";

/** Every code this area registers. The barrel folds this union into `RefusalCode` (B-19). */
export type TakeoffSchedulesRefusalCode =
  | "NOTATION_UNREAD"
  | "SCHEDULE_NONE_RECONSTRUCTED"
  | "SCHEDULE_VIEW_CONTRIBUTED_NOTHING"
  | "NOTE_READING_CONTESTED"
  | "NOTE_SOURCE_NOT_ON_SHEET"
  | "NOTES_NONE_PROPOSED";

/** This area's registered refusals, frozen entry by entry exactly as the one register holds them. */
export const TAKEOFF_SCHEDULES_REFUSALS: RefusalGroup<TakeoffSchedulesRefusalCode> = Object.freeze({
  // L-CAD-08's answer where a schedule-titled view yielded no table at all — no band of it holds a
  // name or mark cell, so there is no header to take columns from and a table reconstructed without
  // one would be columns nobody drew (R-TO-031).

  // R-TO-031's answer when a cell is written in a notation no form of the grammar reads: the token
  // is named, because a person shown the glyphs can add the form and a person shown `null` cannot
  // (ARCH-03, L-QTY-04 — a cell read as nothing is a member that never reaches a bill).
  NOTATION_UNREAD: Object.freeze({
    code: "NOTATION_UNREAD",
    message: "This cell is written in a notation the drawing's grammar does not read, so nothing was taken from it.",
    remedy: "Read the cell on the sheet and state what it says, or add its form to the notation grammar.",
    severity: "info",
    surface: "inline",
  }),
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
  // R-TO-034's answer where two people read one general note differently. L-REG-03: "disagreement is
  // declared, never resolved silently" — the kind stands at NO figure, and the row says so where it
  // stands rather than printing the later reading as though it had won.
  NOTE_READING_CONTESTED: Object.freeze({
    code: "NOTE_READING_CONTESTED",
    message: "Two readings of this note disagree, so no figure stands.",
    remedy:
      "Read the figure again from the sheet to settle it — a later reading under the same source supersedes the earlier one, and precedence never clears a disagreement.",
    severity: "warning",
    surface: "inline",
  }),
  // L-CAD-03: a reading is kept only where its evidence is. A reading citing a text this sheet does
  // not carry could never be re-read, so the act refuses it before anything is written.
  NOTE_SOURCE_NOT_ON_SHEET: Object.freeze({
    code: "NOTE_SOURCE_NOT_ON_SHEET",
    message: "That reading cites text that is not on this sheet.",
    remedy: "Read the figure again from a note on this sheet — a reading is kept only where its evidence is.",
    severity: "error",
    surface: "inline",
  }),
  // L-MEA-01: nothing is assumed where a note is silent. A sheet whose texts state no reinforcement
  // figure offers none, and the panel says that rather than standing empty (R-UI-050).
  NOTES_NONE_PROPOSED: Object.freeze({
    code: "NOTES_NONE_PROPOSED",
    message: "No reinforcement figure was read from this sheet's notes.",
    remedy: "Open the sheet and read the figure from a note that states one — nothing is assumed where a note is silent.",
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
