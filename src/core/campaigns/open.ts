// L-REG-07: "campaign creation copies onto the campaign, immutably: the rule-set edition key, the
// work-item catalogue digest and the level-stack digest".
//
// A campaign is opened by the act that pins the drawing-set revision it is about, on that act's own
// transaction — so the revision and the campaign are written together or neither is, and the
// campaign can cite the act that wrote both. One campaign per pinned revision: the store's unique
// key says so, and a re-pin writes another revision with another campaign beside this one.
import { campaigns, type TenantTx } from "../db";
import { campaignDigestsOf } from "./digests";
import type { CampaignStatus } from "./law";

/** What one campaign is opened over: which revision of which project, by which act. */
export type CampaignOpening = {
  readonly tenantId: string;
  readonly projectId: string;
  readonly setRevisionId: string;
  readonly actId: string;
};

/** The state a campaign is opened in — the only one it can stand in at this leaf. */
const OPENED: CampaignStatus = "OPEN";

/**
 * Open the campaign a pin's revision is measured under, and answer the id the store minted for it.
 * Everything it copies is read on the given transaction, so the snapshot is of the state the pin
 * itself landed in (L-REG-07, L-ACT-02).
 */
export async function openCampaign(tx: TenantTx, opening: CampaignOpening): Promise<{ campaignId: string }> {
  const digests = await campaignDigestsOf(tx, opening);
  const written = await tx
    .insert(campaigns)
    .values({
      tenantId: opening.tenantId,
      projectId: opening.projectId,
      setRevisionId: opening.setRevisionId,
      editionId: digests.editionId,
      editionDigest: digests.editionDigest,
      catalogueDigest: digests.catalogueDigest,
      levelStackDigest: digests.levelStackDigest,
      status: OPENED,
      actId: opening.actId,
    })
    .returning({ campaignId: campaigns.campaignId });
  const campaignId = written[0]?.campaignId;
  if (campaignId === undefined) {
    throw new Error(`the store minted no campaign for the pinned revision ${opening.setRevisionId} — a revision nothing is measured under is not a pin (L-REG-07)`);
  }
  return { campaignId };
}
