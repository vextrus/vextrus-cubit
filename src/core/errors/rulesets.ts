// The rule-set editions area's refusals (L-MEA-01, R-SPINE-012): the ways authoring an edition is
// refused before a row is minted. Identity is (scope, name, version), so a version this project has
// already used names an edition that exists — minting a second one under it would put two editions
// behind one name.

import type { RefusalGroup } from "./law";

/** Every code this area registers. The barrel folds this union into `RefusalCode` (B-19). */
export type RulesetsRefusalCode = "EDITION_VERSION_TAKEN";

/** This area's registered refusals, frozen entry by entry exactly as the one register holds them. */
export const RULESETS_REFUSALS: RefusalGroup<RulesetsRefusalCode> = Object.freeze({
  EDITION_VERSION_TAKEN: Object.freeze({
    code: "EDITION_VERSION_TAKEN",
    message: "This project already holds an edition with that version, so nothing was minted.",
    remedy: "Give this edition a version the project has not used, then author it again.",
    severity: "error",
    surface: "inline",
  }),
});
