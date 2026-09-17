// The SITE-fact ledger, at its door: the ONE place a standing fact is read (ARCH-02).
//
// The measure setup reads it here, the project's site panel reads it here, and the golden lane reads
// it here — so what "the ground level of this project" means is answered once and cannot part. The
// ledger itself is core's (`@/core/site-facts`): what an entry IS and what the rows stand at are
// law, and this file adds the transaction around them and no second opinion of either (B-17).
//
// It reads and never writes. A fact is entered by an act (AM-06 §1), which commits through
// `writeSiteFact` inside the transaction its act row is written in — core's store, not this door.
import { forTenant } from "@/core/db";
import { siteFactRowsOf, type SiteFactScope } from "@/core/site-facts/store";
import { standingSiteFacts, type SiteFact, type StandingSiteFact } from "@/core/site-facts/law";

// The roster and its guard are the law's, and handed out from here because this is the door a module
// and a screen meet the ledger at — re-exported, never re-spelled (B-17, ARCH-02).
export { SITE_FACTS, isSiteFact } from "@/core/site-facts/law";
export type { SiteFact, SiteFactWrite, StandingSiteFact } from "@/core/site-facts/law";
export type { SiteFactScope } from "@/core/site-facts/store";

/**
 * What each SITE fact of one project stands at: the latest entry of each, and an ABSENT KEY for a
 * fact nobody entered — "an absent fact is a named deferral, never a default" (AM-06 §1), so there is
 * no zero and no fallback for a caller to read out of this answer.
 */
export async function siteFactsOf(scope: SiteFactScope): Promise<Readonly<Partial<Record<SiteFact, StandingSiteFact>>>> {
  const rows = await forTenant({ tenantId: scope.tenantId }).transaction((tx) => siteFactRowsOf(tx, scope));
  return standingSiteFacts(rows);
}
