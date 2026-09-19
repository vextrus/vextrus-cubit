// What an ABSENT site fact is deferred UNDER (AM-06 §1: "an absent fact is a named deferral, never a
// default"), as one total map over the closed roster.
//
// I-279: this is a rendering decision of this panel and not a rule of the ledger, so it lives in the
// module rather than in `@/core/site-facts/law.ts`. The rule it renders is I-B's: an absent fact
// defers under the register entry the earthwork rail defers under when that fact is absent — the
// ground level and the water table each under their own code, and the four lengths the pinned
// edition may also state under the earthwork parameter's, because a reader told "the ground level is
// unentered" would go and look at a ground level that is already there (Q-07).
//
// The map is keyed by the roster itself, so a seventh site fact is a compile error here until
// somebody says what its absence is called (B-19).
import { REFUSALS, type RefusalCode } from "@/core/errors";
import type { SiteFact } from "@/core/site-facts/law";

export const SITE_FACT_DEFERRALS: Readonly<Record<SiteFact, RefusalCode>> = Object.freeze({
  GROUND_LEVEL: REFUSALS.GROUND_LEVEL_UNSTATED.code,
  WATER_TABLE: REFUSALS.WATER_TABLE_UNSTATED.code,
  WORKING_ALLOWANCE: REFUSALS.EARTHWORK_PARAMETER_UNSTATED.code,
  DEPTH_EXTRA: REFUSALS.EARTHWORK_PARAMETER_UNSTATED.code,
  BLINDING_PROJECTION: REFUSALS.EARTHWORK_PARAMETER_UNSTATED.code,
  BLINDING_THICKNESS: REFUSALS.EARTHWORK_PARAMETER_UNSTATED.code,
});

/**
 * Whether the pinned rule-set edition may also state this fact, which is what decides where its
 * deferral's evidence leads (I-B): the four earthwork lengths are stated by the edition or entered
 * on site, so their remedy is one place or the other; the ground level and the water table are read
 * on site and nowhere else, so the way to resolve them is this screen's own row.
 */
export function statedByEdition(fact: SiteFact): boolean {
  return SITE_FACT_DEFERRALS[fact] === REFUSALS.EARTHWORK_PARAMETER_UNSTATED.code;
}
