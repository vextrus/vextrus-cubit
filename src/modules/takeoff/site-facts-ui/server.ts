// What the Site facts panel reads: one project's ledger, as the standing each fact now stands at.
//
// It composes rather than computes. The rows are the store's (`@/core/site-facts/store`) and what a
// set of rows STANDS AT is the law's (`standingSiteFacts`) — a fact is restated by entering it again
// and the standing is derived at read time, so there is no stored "current value" for this file to
// have an opinion about (L-ACT-01, R-TO-051, B-17).
import { forTenant } from "@/core/db";
import { projectRulesetView } from "@/core/rulesets/editions";
import { standingSiteFacts, type SiteFact, type StandingSiteFact } from "@/core/site-facts/law";
import { siteFactRowsOf, type SiteFactScope } from "@/core/site-facts/store";
import { editionStatedFacts, type EditionStatedFacts } from "./edition";

/** What each fact of the closed roster stands at, with an absent key per fact nobody entered. */
export type StandingSiteFacts = Readonly<Partial<Record<SiteFact, StandingSiteFact>>>;

/** One project's site facts, as the panel renders them. */
export async function siteFactsOf(scope: SiteFactScope): Promise<StandingSiteFacts> {
  const rows = await forTenant({ tenantId: scope.tenantId }).transaction((tx) => siteFactRowsOf(tx, scope));
  return standingSiteFacts(rows);
}

/**
 * What the project's pinned edition states of the site facts (I-327) — the edition the project reads
 * today, through the one view of it the Rule set screen reads too, so the two screens cannot disagree
 * about a figure. A view with no pin states nothing, and every fact nobody entered then defers.
 */
export async function editionStatedFactsOf(scope: SiteFactScope): Promise<EditionStatedFacts> {
  const view = await projectRulesetView({ tenantId: scope.tenantId, projectId: scope.projectId });
  return view.pinned ? editionStatedFacts(view.parameters) : {};
}
