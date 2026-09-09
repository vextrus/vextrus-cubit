// L-REG-07's campaign, at its door: what a pinned drawing-set revision is measured under, opened by
// the act that pinned it, snapshotting immutably what was in force at that moment, and read back by
// whoever needs to know what a measurement was taken against.
//
// The module composes rather than computes: what a stack digests to is the level model's, what the
// catalogue digests to is derived from `bears`, and the edition is the project's pin — this file
// adds the store around them and no second opinion of any of the three (B-17, ARCH-02).
import { and, asc, campaigns, eq, forTenant, isUuid } from "../db";
import type { CampaignScope } from "./scope";

export { catalogueDigest, campaignDigestsIfPinned, campaignDigestsOf } from "./digests";
export type { CampaignDigests } from "./digests";
export { freshnessOf } from "./freshness";
export type { CampaignDivergence, CampaignFreshness } from "./freshness";
export { CAMPAIGN_STATUSES } from "./law";
export type { CampaignStatus } from "./law";
export { openCampaign } from "./open";
export type { CampaignOpening } from "./open";
export { editionOf, pinnedEditionOf } from "./pin";
export type { PinnedEdition } from "./pin";
export type { CampaignScope } from "./scope";

/** One campaign row, whole, as the store holds it. */
export type CampaignRow = typeof campaigns.$inferSelect;

/** Every campaign this project holds, oldest first — the order they were opened in. */
export async function campaignsOf(scope: CampaignScope): Promise<CampaignRow[]> {
  if (!isUuid(scope.tenantId) || !isUuid(scope.projectId)) return [];
  return forTenant({ tenantId: scope.tenantId }).transaction((tx) =>
    tx
      .select()
      .from(campaigns)
      .where(and(eq(campaigns.tenantId, scope.tenantId), eq(campaigns.projectId, scope.projectId)))
      .orderBy(asc(campaigns.openedAt), asc(campaigns.campaignId)),
  );
}

/**
 * One campaign of this project, or nothing where the address names none. An answer, never a fault: a
 * segment that is not a uuid would reach the database as a cast error rather than as a row that is
 * not there, so it is judged here first (ARCH-02).
 */
export async function campaignOf(scope: CampaignScope, campaignId: string): Promise<CampaignRow | null> {
  if (!isUuid(scope.tenantId) || !isUuid(scope.projectId) || !isUuid(campaignId)) return null;
  const held = await forTenant({ tenantId: scope.tenantId }).transaction((tx) =>
    tx
      .select()
      .from(campaigns)
      .where(and(eq(campaigns.tenantId, scope.tenantId), eq(campaigns.projectId, scope.projectId), eq(campaigns.campaignId, campaignId)))
      .limit(1),
  );
  return held[0] ?? null;
}
