// Which project's campaigns a call is about, in which workspace. One spelling, because every door of
// this module asks the same question and a scope written twice drifts (B-17, R-SPINE-004).
export type CampaignScope = {
  readonly tenantId: string;
  readonly projectId: string;
};
