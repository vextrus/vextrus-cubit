// What the Site facts panel reads: one project's ledger, as the standing each fact now stands at.
//
// It composes rather than computes. The rows are the store's (`@/core/site-facts/store`) and what a
// set of rows STANDS AT is the law's (`standingSiteFacts`) — a fact is restated by entering it again
// and the standing is derived at read time, so there is no stored "current value" for this file to
// have an opinion about (L-ACT-01, R-TO-051, B-17).
import { forTenant } from "@/core/db";
import { standingSiteFacts, type SiteFact, type StandingSiteFact } from "@/core/site-facts/law";
import { siteFactRowsOf, type SiteFactScope } from "@/core/site-facts/store";

/** What each fact of the closed roster stands at, with an absent key per fact nobody entered. */
export type StandingSiteFacts = Readonly<Partial<Record<SiteFact, StandingSiteFact>>>;

/** One project's site facts, as the panel renders them. */
export async function siteFactsOf(scope: SiteFactScope): Promise<StandingSiteFacts> {
  const rows = await forTenant({ tenantId: scope.tenantId }).transaction((tx) => siteFactRowsOf(tx, scope));
  return standingSiteFacts(rows);
}
