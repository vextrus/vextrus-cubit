// L-REG-07's freshness gate: "the freshness gate diffs snapshot against what is in force: diverged
// and unsigned ⇒ stale, which blocks signing".
//
// It blocks SIGNING and nothing else. Measuring a stale campaign is lawful — what a campaign was
// opened against is exactly what it goes on measuring against — so this answers the signing gate's
// verdict and never a measurement's. (The "diverged and signed ⇒ voids whole" arm waits for signing
// to exist at all, M9.)
import { and, campaigns, eq, forTenant, isUuid, type TenantTx } from "../db";
import { REFUSALS } from "../errors";
import { refusal } from "../faults/refusal-marker";
import { campaignDigestsOf } from "./digests";
import type { CampaignScope } from "./scope";

/** Which of the three snapshots has moved since the campaign copied it. */
export type CampaignDivergence = "edition" | "catalogue" | "levelStack";

/** What the freshness gate answers: what moved, whether that is stale, and what signing may do. */
export type CampaignFreshness = {
  readonly stale: boolean;
  readonly diverged: readonly CampaignDivergence[];
  readonly signing: { readonly ok: true } | { readonly ok: false; readonly code: typeof REFUSALS.PIN_STALE.code };
};

/** The campaign this scope holds under that id, on the caller's transaction. */
async function campaignRow(tx: TenantTx, scope: CampaignScope, campaignId: string) {
  const held = await tx
    .select({
      editionDigest: campaigns.editionDigest,
      catalogueDigest: campaigns.catalogueDigest,
      levelStackDigest: campaigns.levelStackDigest,
    })
    .from(campaigns)
    .where(and(eq(campaigns.tenantId, scope.tenantId), eq(campaigns.projectId, scope.projectId), eq(campaigns.campaignId, campaignId)))
    .limit(1);
  return held[0] ?? null;
}

/**
 * Diff a campaign's snapshot against what is in force now.
 *
 * An address naming no campaign of this project is refused by name rather than answered with a
 * freshness nobody could act on: there is no snapshot to diff, and a "fresh" answer for a campaign
 * that is not there would be a lie the caller cannot tell from the truth (ARCH-03, B-21).
 */
export async function freshnessOf(scope: CampaignScope, campaignId: string): Promise<CampaignFreshness> {
  return forTenant({ tenantId: scope.tenantId }).transaction(async (tx) => {
    // The WHOLE address is judged before the store, as this core's other doors judge theirs: a
    // segment that is not a uuid would reach the database as a cast error rather than as a row that
    // is not there, and a fault carrying no registered code is one a caller cannot tell from a store
    // that is down (ARCH-02, ARCH-03, B-21).
    const addressed = isUuid(scope.tenantId) && isUuid(scope.projectId) && isUuid(campaignId);
    const snapshot = addressed ? await campaignRow(tx, scope, campaignId) : null;
    if (snapshot === null) {
      throw refusal(REFUSALS.CAMPAIGN_NOT_FOUND.code, "freshness was asked for a campaign this project does not hold", { projectId: scope.projectId, campaignId });
    }
    const inForce = await campaignDigestsOf(tx, scope);

    const diverged: CampaignDivergence[] = [];
    if (snapshot.editionDigest !== inForce.editionDigest) diverged.push("edition");
    if (snapshot.catalogueDigest !== inForce.catalogueDigest) diverged.push("catalogue");
    if (snapshot.levelStackDigest !== inForce.levelStackDigest) diverged.push("levelStack");

    const stale = diverged.length > 0;
    return {
      stale,
      diverged: Object.freeze(diverged),
      signing: stale ? { ok: false as const, code: REFUSALS.PIN_STALE.code } : { ok: true as const },
    };
  });
}
