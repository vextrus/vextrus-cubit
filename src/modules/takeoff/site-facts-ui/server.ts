// What the Site facts panel reads: one project's ledger, as the standing each fact now stands at.
//
// It composes rather than computes. The rows are the store's (`@/core/site-facts/store`) and what a
// set of rows STANDS AT is the law's (`standingSiteFacts`) — a fact is restated by entering it again
// and the standing is derived at read time, so there is no stored "current value" for this file to
// have an opinion about (L-ACT-01, R-TO-051, B-17).
import { acts, and, eq, forTenant, inArray, isUuid } from "@/core/db";
import { projectRulesetView } from "@/core/rulesets/editions";
import { standingSiteFacts, type SiteFact, type StandingSiteFact } from "@/core/site-facts/law";
import { siteFactRowsOf, type SiteFactScope } from "@/core/site-facts/store";
import { editionStatedFacts, type EditionStatedFacts } from "./edition";

/** What each fact of the closed roster stands at, with an absent key per fact nobody entered. */
export type StandingSiteFacts = Readonly<Partial<Record<SiteFact, StandingSiteFact>>>;

/** The act that entered a standing fact → the account that performed it (`acts.actor_id`). */
export type SiteFactActors = Readonly<Record<string, string>>;

/** One project's site facts, as the panel renders them. */
export async function siteFactsOf(scope: SiteFactScope): Promise<StandingSiteFacts> {
  const rows = await forTenant({ tenantId: scope.tenantId }).transaction((tx) => siteFactRowsOf(tx, scope));
  return standingSiteFacts(rows);
}

/**
 * Who entered each standing fact: the actor the act log recorded for the act each entry cites
 * (s-settings-site-facts I-527). A ledger row names its act and nothing else — who performed an act
 * is the act's own column, written once by the one act seam (L-ACT-01) — so it is read from there,
 * on the tenant's own handle and bounded to the project, never copied onto the ledger. The answer is
 * account ids; the NAME a reader sees is the project roster's, resolved by the page that may ask it
 * (participants I-51, s-documents I-348), and an act the log does not hold names nobody.
 */
export async function siteFactActorsOf(scope: SiteFactScope, standing: StandingSiteFacts): Promise<SiteFactActors> {
  const actIds = [...new Set(Object.values(standing).flatMap((fact) => (fact === undefined ? [] : [fact.actId])))].filter(isUuid);
  if (actIds.length === 0 || !isUuid(scope.projectId)) return {};
  const rows = await forTenant({ tenantId: scope.tenantId }).transaction((tx) =>
    tx
      .select({ actId: acts.actId, actorId: acts.actorId })
      .from(acts)
      .where(and(eq(acts.tenantId, scope.tenantId), eq(acts.projectId, scope.projectId), inArray(acts.actId, actIds))),
  );
  return Object.freeze(Object.fromEntries(rows.map((row) => [row.actId, row.actorId])));
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
