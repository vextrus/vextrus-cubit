// The REBAR rail's own refusals — L-MEA-08's rail-local codes, keyed (class × rcc.rebar).
//
// M3's rebar rail registers its codes HERE. The barrel `src/core/errors.ts` already enumerates this
// file, so a code added to the group below is a code the closed taxonomy holds — with no shared list
// to edit and no other area's file to touch.
//
// Every one of them is a WARNING shown INLINE, and that is the law rather than a habit: an unread
// schedule, an unheld ℓd row and an unstated zone are DISCLOSURES (L-QTY-02) — the line is published
// with the component it could not derive declared missing, never refused and never quietly complete.

import type { RefusalGroup } from "./law";

/** Every code this area registers. The barrel folds this union into `RefusalCode` (B-19). */
export type RebarRefusalCode = "DETAILING_ROW_NOT_IN_EDITION" | "REBAR_SCHEDULE_UNREAD" | "REBAR_TIE_ZONE_UNSTATED" | "REBAR_STOREY_RUN_UNSTATED";

/** This area's registered refusals, frozen entry by entry exactly as the one register holds them. */
export const REBAR_REFUSALS: RefusalGroup<RebarRefusalCode> = Object.freeze({
  // AM-03(f): the ℓd table holds the rows it holds. A grade outside them is answered by name — a
  // multiplier scaled off a neighbouring row would be a lap length the code never states.
  DETAILING_ROW_NOT_IN_EDITION: Object.freeze({
    code: "DETAILING_ROW_NOT_IN_EDITION",
    message: "The applied detailing edition holds no development-length row for the steel grade this drawing states, so no lap can be derived for it.",
    remedy: "State the lap on the drawing's general notes, or apply an edition whose table holds the grade, then measure the campaign again.",
    severity: "warning",
    surface: "inline",
  }),
  // A class whose schedule nothing reads yet: the member is reported rather than measured off bars
  // nobody stated. Reinforcement is never inferred from a section (L-QTY-01).
  REBAR_SCHEDULE_UNREAD: Object.freeze({
    code: "REBAR_SCHEDULE_UNREAD",
    message: "Nothing has read a reinforcement schedule for this member, so there are no bars to bill for it.",
    remedy: "Read the member's reinforcement schedule into the drawing's registry, then measure the campaign again.",
    severity: "warning",
    surface: "inline",
  }),
  // A tie zone that states a spacing and no LENGTH: BNBC's confinement zone is a typical detail, and
  // a length derived here would be a figure the drawing never carried (L-QTY-01).
  REBAR_TIE_ZONE_UNSTATED: Object.freeze({
    code: "REBAR_TIE_ZONE_UNSTATED",
    message: "The schedule states the tie spacing for this member but no zone it runs over, so its ties cannot be counted.",
    remedy: "Read the typical detail's confinement and mid-height zone lengths into the member's schedule, then measure again.",
    severity: "warning",
    surface: "inline",
  }),
  // A vertical runs floor to floor: with no storey height standing for the level it stands on, the
  // run is unread and the member bills nothing rather than a length the machine invented.
  REBAR_STOREY_RUN_UNSTATED: Object.freeze({
    code: "REBAR_STOREY_RUN_UNSTATED",
    message: "No storey height stands for the level this member rises through, so its vertical bars have no run to be cut to.",
    remedy: "Author the level's storey height on the level stack, then measure the campaign again.",
    severity: "warning",
    surface: "inline",
  }),
});
