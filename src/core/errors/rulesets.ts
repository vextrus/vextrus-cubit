// L-MEA-01's authoring refusal: an edition's identity is (scope, name, version), so a version this
// project's rule set has already been authored under names an edition that exists rather than the
// one being authored. Nothing is minted, and the reader is told which half of the identity collided.

import type { RefusalGroup } from "./law";

/** Every code this area registers. The barrel folds this union into `RefusalCode` (B-19). */
export type RulesetsRefusalCode = "EDITION_VERSION_TAKEN";

/** This area's registered refusals, frozen entry by entry exactly as the one register holds them. */
export const RULESETS_REFUSALS: RefusalGroup<RulesetsRefusalCode> = Object.freeze({
  // L-MEA-01: "edition identity is (scope, name, version)". Two project-scope editions of one
  // project under one version would be two rows claiming one identity — an answer to the author,
  // never a uniqueness fault raised out of the store.
  EDITION_VERSION_TAKEN: Object.freeze({
    code: "EDITION_VERSION_TAKEN",
    message: "An edition of this rule set already carries that version, so nothing was authored.",
    remedy: "State a version this project's rule set has not used, then try again.",
    severity: "error",
    surface: "inline",
  }),
});
