// L-REG-07's campaign, as law: the states one can stand in. It stands apart from the campaign module
// because the store's CHECK is written from this roster too, and the module reaches the seam — a
// roster the schema could not import would be a roster spelled twice (B-17, ARCH-02).

/**
 * What a campaign can be. One value at this leaf: pinning a drawing set opens a campaign and nothing
 * yet closes one — a campaign is closed by a signature, and signing is M9's. A status nothing can
 * produce is not a value the store should admit.
 */
export const CAMPAIGN_STATUSES = ["OPEN"] as const;

/** One campaign status, drawn from the closed roster above. */
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];
