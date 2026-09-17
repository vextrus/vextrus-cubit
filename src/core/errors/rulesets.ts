// The rule-set area's refusals (L-MEA-01, R-SPINE-012): the ways authoring a new edition is
// declined before anything is minted. Identity is (scope, name, version), so a version this
// project's rule set already carries names an edition that exists — the author is asked for one
// that does not.

import type { RefusalGroup } from "./law";

/** Every code this area registers. The barrel folds this union into `RefusalCode` (B-19). */
export type RulesetsRefusalCode = "EDITION_VERSION_TAKEN";

/** This area's registered refusals, frozen entry by entry exactly as the one register holds them. */
export const RULESETS_REFUSALS: RefusalGroup<RulesetsRefusalCode> = Object.freeze({
  EDITION_VERSION_TAKEN: Object.freeze({
    code: "EDITION_VERSION_TAKEN",
    message: "An edition of this rule set already carries that version, so nothing was authored.",
    remedy: "State a version this project's rule set has not used, then try again.",
    severity: "error",
    surface: "inline",
  }),
});
