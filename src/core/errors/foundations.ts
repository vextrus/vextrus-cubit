// The FOUNDATIONS rail's own refusals — L-MEA-08's rail-local codes, keyed
// (footing | pile_cap | pile × rcc.concrete | piling.* | earthwork.excavation | pcc.blinding), and
// the two a SITE-fact entry earns before it ever reaches the ledger (AM-06 §1).
//
// A rail's refusals belong to the rail, so the file a rail is written in is the file its codes are
// registered in, and no two rails ever edit one list (AM-11). The barrel `src/core/errors.ts` already
// enumerates this file.
//
// Every code below names ONE reading that was not stated. That is what makes a partial row DECLARED:
// "PARTIAL_DECLARED with every omitted component enumerated on the row; PARTIAL_UNDECLARED is
// unrepresentable" (L-QTY-02) — the row is kept, carries no quantity, and says by name which reading
// a person has to go and read.

import type { RefusalGroup } from "./law";

/** Every code this area registers. The barrel folds this union into `RefusalCode` (B-19). */
export type FoundationsRefusalCode =
  | "PILE_LENGTH_UNSTATED"
  | "PILE_DIAMETER_UNSTATED"
  | "FOUNDATION_DEPTH_UNSTATED"
  | "FOUNDATION_PLAN_UNSTATED"
  | "FOUNDING_LEVEL_UNSTATED"
  | "GROUND_LEVEL_UNSTATED"
  | "WATER_TABLE_UNSTATED"
  | "EARTHWORK_PARAMETER_UNSTATED"
  | "EARTHWORK_PLAN_DEFERRED"
  | "BLINDING_PLAN_DEFERRED"
  | "SITE_FACT_UNKNOWN"
  | "SITE_FACT_SOURCE_UNSTATED";

/** This area's registered refusals, frozen entry by entry exactly as the one register holds them. */
export const FOUNDATIONS_REFUSALS: RefusalGroup<FoundationsRefusalCode> = Object.freeze({
  // AM-06 §2: "pile length comes from the pile schedule" — never from the depth of the cap above it
  // and never from the length of the line somebody drew, so an unscheduled length is an absence.
  PILE_LENGTH_UNSTATED: Object.freeze({
    code: "PILE_LENGTH_UNSTATED",
    message: "The pile schedule states no length for this pile, so its bore and its concrete are not measured.",
    remedy: "Read the pile schedule's length column for this mark, then measure the campaign again.",
    severity: "error",
    surface: "inline",
  }),
  PILE_DIAMETER_UNSTATED: Object.freeze({
    code: "PILE_DIAMETER_UNSTATED",
    message: "The pile schedule states no diameter for this pile, so there is no section to measure its concrete by.",
    remedy: "Read the pile schedule's diameter column for this mark, then measure the campaign again.",
    severity: "error",
    surface: "inline",
  }),
  FOUNDATION_DEPTH_UNSTATED: Object.freeze({
    code: "FOUNDATION_DEPTH_UNSTATED",
    message: "The schedules state no depth for this foundation, so there is no thickness to measure its concrete through.",
    remedy: "Read the foundation schedule's depth column for this mark, then measure the campaign again.",
    severity: "error",
    surface: "inline",
  }),
  FOUNDATION_PLAN_UNSTATED: Object.freeze({
    code: "FOUNDATION_PLAN_UNSTATED",
    message: "Neither a scheduled section nor a read plan outline states this foundation's plan, so there is no area to measure it over.",
    remedy: "Read the foundation schedule's size column, or re-read the plan so the outline is registered, then measure again.",
    severity: "error",
    surface: "inline",
  }),
  // L-FRM-04 measures a pit from the existing ground down to the founding level, so the founding
  // level is a reading the pit needs and the drawing's own levels state.
  FOUNDING_LEVEL_UNSTATED: Object.freeze({
    code: "FOUNDING_LEVEL_UNSTATED",
    message: "The schedules state no founding level for this foundation, so there is no depth to excavate down to.",
    remedy: "Read the foundation schedule's top-of-foundation level for this mark, then measure the campaign again.",
    severity: "error",
    surface: "inline",
  }),
  // L-MEA-06's SITE attributes are "facts no drawing carries", so an absent one is a named deferral
  // and never a default — the sentence below is the clause's own.
  GROUND_LEVEL_UNSTATED: Object.freeze({
    code: "GROUND_LEVEL_UNSTATED",
    message: "No existing ground level has been entered for this project, so earthwork is structurally unpriceable from drawings alone until SITE facts are entered.",
    remedy: "Enter the site's existing ground level with the note it was read from, then measure the campaign again.",
    severity: "error",
    surface: "inline",
  }),
  // The other reading the ground carries and no drawing states (L-MEA-06): where the water stands.
  // Its own code beside the ground level's, because earthwork below the water table is a different
  // item from earthwork above it, and a reader told the ground level is unentered would go and look
  // at a ground level that is already there (Q-07).
  WATER_TABLE_UNSTATED: Object.freeze({
    code: "WATER_TABLE_UNSTATED",
    message: "No water table level has been entered for this project, so earthwork below it is unpriceable from drawings alone.",
    remedy: "Enter the water table level with the note it was read from, then measure the campaign again.",
    severity: "error",
    surface: "inline",
  }),
  // L-FRM-04's four lengths: the working allowance, the depth extra, the blinding's projection and
  // its thickness. Each is stated by the pinned edition or entered on site (L-MEA-06), and where
  // neither states one there is nothing to widen or to thicken by. Its own code, because a reader
  // told the ground level is unentered would go and look at a ground level that is already entered,
  // and a blinding's projection says nothing about a ground level at all (Q-07).
  EARTHWORK_PARAMETER_UNSTATED: Object.freeze({
    code: "EARTHWORK_PARAMETER_UNSTATED",
    message: "Neither this project's rule-set edition nor its site facts state this earthwork parameter, so there is no length to widen or thicken by.",
    remedy: "State the parameter in the project's pinned rule-set edition, or enter it as a site fact, then measure the campaign again.",
    severity: "error",
    surface: "inline",
  }),
  // L-FRM-04 states the pit and the blinding over a RECTANGULAR plan and defers the rest: a polygon
  // or a tapered plan has no (L + 2a) × (B + 2a) to widen, and a figure taken over one anyway would
  // be a guess published as a measurement (L-QTY-01).
  EARTHWORK_PLAN_DEFERRED: Object.freeze({
    code: "EARTHWORK_PLAN_DEFERRED",
    message: "This foundation's plan is not a rectangle, and the pit around a non-rectangular plan is not measured yet.",
    remedy: "Take the excavation for this foundation off separately until the non-rectangular pit rule lands.",
    severity: "warning",
    surface: "inline",
  }),
  BLINDING_PLAN_DEFERRED: Object.freeze({
    code: "BLINDING_PLAN_DEFERRED",
    message: "This foundation's plan is not a rectangle, and the blinding under a non-rectangular plan is not measured yet.",
    remedy: "Take the blinding for this foundation off separately until the non-rectangular rule lands.",
    severity: "warning",
    surface: "inline",
  }),
  // The two a SITE-fact entry earns at the write: the ledger's roster is closed (L-MEA-06) and every
  // entry says where it came from (AM-06 §1).
  SITE_FACT_UNKNOWN: Object.freeze({
    code: "SITE_FACT_UNKNOWN",
    message: "That is not a site fact this product records, so there is nowhere to enter it.",
    remedy: "Enter one of the site facts the project's site panel lists.",
    severity: "error",
    surface: "inline",
  }),
  SITE_FACT_SOURCE_UNSTATED: Object.freeze({
    code: "SITE_FACT_SOURCE_UNSTATED",
    message: "This entry says nothing about where the fact came from, and a site fact is only as good as its source.",
    remedy: "Write the note that says where the fact was read — the borelog, the survey or the drawing's general notes.",
    severity: "error",
    surface: "inline",
  }),
});
