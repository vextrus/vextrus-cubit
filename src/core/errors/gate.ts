// SEAM-GATE's refusals (L-MEA-01, L-MEA-08, L-QTY-04, L-REG-07): what the gate answers when an offer
// is not to contract, when the pinned edition cites no method for it, when nothing implements the pair
// it does cite, when interpreted geometry stands uncorroborated, and when a campaign's pin is stale or
// names no campaign at all.

import type { RefusalGroup } from "./law";

/** Every code this area registers. The barrel folds this union into `RefusalCode` (B-19). */
export type GateRefusalCode =
  | "METHOD_NOT_IN_EDITION"
  | "METHOD_IMPLEMENTATION_MISSING"
  | "OFFER_NOT_TO_CONTRACT"
  | "INTERPRETED_UNCORROBORATED"
  | "PIN_STALE"
  | "CAMPAIGN_NOT_FOUND";

/** This area's registered refusals, frozen entry by entry exactly as the one register holds them. */
export const GATE_REFUSALS: RefusalGroup<GateRefusalCode> = Object.freeze({
  // L-MEA-08: the gate resolves an offer's method version from the project's pinned edition. An
  // edition that cites no version of the rule the offer names cannot say which method is in force,
  // so the offer is refused rather than measured under a version nobody pinned.
  METHOD_NOT_IN_EDITION: Object.freeze({
    code: "METHOD_NOT_IN_EDITION",
    message: "The rule-set edition this project is pinned to cites no version of the measurement rule this offer names.",
    remedy: "Pin an edition that cites this rule, or measure under a rule the pinned edition holds.",
    severity: "error",
    surface: "inline",
  }),
  // L-MEA-01: a method is versioned CODE, keyed (rule id, version). An edition citing a pair the
  // tree implements nothing for keys content nothing can compute, and the gate says so by name.
  METHOD_IMPLEMENTATION_MISSING: Object.freeze({
    code: "METHOD_IMPLEMENTATION_MISSING",
    message: "The version of this measurement rule the edition cites has no implementation in this release.",
    remedy: "Pin an edition citing a version this release implements, or upgrade to the release that carries it.",
    severity: "error",
    surface: "inline",
  }),
  // L-MEA-08: "the refused arm is for contract violations only" — an offer missing a binding the
  // method declares, or carrying a deduction candidate in a channel it does not, is not measurable.
  OFFER_NOT_TO_CONTRACT: Object.freeze({
    code: "OFFER_NOT_TO_CONTRACT",
    message: "This offer does not carry what the measurement rule declares, so nothing can be derived from it.",
    remedy: "Correct the rail so the offer binds every declared variable and deducts only through the channels the rule names.",
    severity: "error",
    surface: "inline",
  }),
  // L-QTY-04: "interpreted geometry uncorroborated → declared exclusion + queue item, never a line".
  // The same taxonomy serves machine refusals and human deferrals, so the queue item's cause is a
  // registered code and this is it.
  INTERPRETED_UNCORROBORATED: Object.freeze({
    code: "INTERPRETED_UNCORROBORATED",
    message: "This outline was interpreted rather than read, and nothing corroborates it, so it is excluded rather than measured.",
    remedy: "Corroborate the outline against the drawing and agree it, or measure the scope from geometry the drawing states.",
    severity: "warning",
    surface: "inline",
  }),
  // L-REG-07: a campaign's snapshot diverged from what is in force is stale, and stale blocks
  // SIGNING while measuring goes on — a signature over a measurement taken against something else.
  PIN_STALE: Object.freeze({
    code: "PIN_STALE",
    message: "What this campaign was opened against has moved since, so its measurements cannot be signed for.",
    remedy: "Open a campaign against what is in force now, then sign for the measurements it takes.",
    severity: "warning",
    surface: "banner",
  }),
  // The address named no campaign of this project — an answer, never a fault: a measure asked for a
  // campaign this workspace does not hold has nothing to measure (L-REG-07).
  CAMPAIGN_NOT_FOUND: Object.freeze({
    code: "CAMPAIGN_NOT_FOUND",
    message: "This project holds no measurement campaign at that address.",
    remedy: "Open the project's campaigns and choose one, or pin a drawing set to open a campaign.",
    severity: "error",
    surface: "inline",
  }),
});
