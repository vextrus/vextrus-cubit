// SEAM-ACT's refusals (R-SPINE-003, L-ACT-01, L-ACT-02): the ways an act is refused before it is
// written down — permission, authorship, a consequence that could not be carried, an act that would
// change nothing, and a bulk group the machine is not offering.

import type { RefusalGroup } from "./law";

/** Every code this area registers. The barrel folds this union into `RefusalCode` (B-19). */
export type ActsRefusalCode =
  | "CONSEQUENCES_NOT_CARRIED"
  | "PERMISSION_NOT_HELD"
  | "ACTOR_NOT_HUMAN"
  | "ACT_CHANGES_NOTHING"
  | "PROJECT_WOULD_HAVE_NO_PRINCIPAL"
  | "GROUP_NOT_OFFERED";

/** This area's registered refusals, frozen entry by entry exactly as the one register holds them. */
export const ACTS_REFUSALS: RefusalGroup<ActsRefusalCode> = Object.freeze({
  CONSEQUENCES_NOT_CARRIED: Object.freeze({
    code: "CONSEQUENCES_NOT_CARRIED",
    message: "This change was reviewed against an earlier state of the project, which has moved since.",
    remedy: "Review the change again — what it would do now is not what was shown.",
    severity: "warning",
    surface: "dialog",
  }),
  PERMISSION_NOT_HELD: Object.freeze({
    code: "PERMISSION_NOT_HELD",
    message: "Your roles on this project do not carry the permission this action needs.",
    remedy: "Ask a principal of the project to give you a role that carries it.",
    severity: "error",
    surface: "banner",
  }),
  ACTOR_NOT_HUMAN: Object.freeze({
    code: "ACTOR_NOT_HUMAN",
    message: "This action is recorded as a human act, so only a person may perform it.",
    remedy: "Perform the action as a signed-in person.",
    severity: "error",
    surface: "banner",
  }),
  ACT_CHANGES_NOTHING: Object.freeze({
    code: "ACT_CHANGES_NOTHING",
    message: "This action would leave the project exactly as it is, so nothing was recorded.",
    remedy: "Choose a change that moves something — what you asked for is already the case.",
    severity: "info",
    surface: "dialog",
  }),
  PROJECT_WOULD_HAVE_NO_PRINCIPAL: Object.freeze({
    code: "PROJECT_WOULD_HAVE_NO_PRINCIPAL",
    message: "This withdrawal would leave the project with no principal, so it was not carried out.",
    remedy: "Make another member a principal first, then withdraw this one.",
    severity: "error",
    surface: "inline",
  }),
  // L-ACT-02's answer when a caller names a group the machine is not offering: "bulk is offered,
  // never assembled", so the membership a commit would move is the machine's own — a key whose
  // membership resolves empty names nothing this project is waiting to have confirmed.
  GROUP_NOT_OFFERED: Object.freeze({
    code: "GROUP_NOT_OFFERED",
    message: "This group is not one the project offers now, so nothing was confirmed.",
    remedy: "Reload the sheet index and confirm from a group it offers.",
    severity: "error",
    surface: "inline",
  }),
});
