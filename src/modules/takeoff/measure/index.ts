// The one door a campaign is measured through (ARCH-02): a request, keyed on the campaign, answered
// with the job that carries it or with a registered refusal.
//
// What is NOT here, on purpose: the run itself (`runMeasureJob`), which stands behind ./job for the
// worker's composition root alone. A bundler follows a barrel's every re-export, and the run reaches
// the rail roster and — through the deps it is handed — the gate, neither of which belongs in a
// screen's module graph (ARCH-01, and the same reason SEAM-CAD keeps its job behind its own file).
import { campaignOf } from "@/core/campaigns";
import { REFUSALS } from "@/core/errors";
import { enqueue, type JobKind, type JobPayloads } from "@/core/jobs";

/** The kind this seam's work runs under, bound to SEAM-JOBS' roster rather than re-spelled (B-17). */
export const MEASURE_KIND = "measure" satisfies JobKind;

/** Which project's campaign a request is about, in which workspace (R-SPINE-004). */
export type MeasureScope = { readonly tenantId: string; readonly projectId: string };

/** What the door answers when it accepted: the job holding the campaign's key. */
export type MeasureRequested = { readonly requested: true; readonly jobId: string; readonly deduplicated: boolean };

/** What the door answers when it did not: a registered code, and nothing enqueued (R-SPINE-062). */
export type MeasureRefused = { readonly requested: false; readonly refusal: typeof REFUSALS.CAMPAIGN_NOT_FOUND.code };

/**
 * The key one campaign's measurement stands under. The work is OF a campaign — a campaign is what a
 * pinned revision is measured under (L-REG-07) — so the campaign keys it, and while one stands
 * queued asking again is the same ask (SEAM-JOBS: "every job idempotent on its key").
 */
export function measureJobKey(tenantId: string, campaignId: string): string {
  return `${MEASURE_KIND}:${tenantId}:${campaignId}`;
}

/**
 * Ask for a campaign to be measured.
 *
 * A campaign this project does not hold is refused by name and enqueues nothing: there is nothing to
 * measure under, and asking again will not open one. The refusal is an answer in the closed taxonomy
 * rather than a fault, because the caller named an address and the address names nothing (ARCH-03).
 */
export async function requestMeasure(scope: MeasureScope, campaignId: string, requestedBy: string): Promise<MeasureRequested | MeasureRefused> {
  const campaign = await campaignOf(scope, campaignId);
  if (campaign === null) return { requested: false, refusal: REFUSALS.CAMPAIGN_NOT_FOUND.code };

  const payload: JobPayloads["measure"] = {
    tenantId: scope.tenantId,
    projectId: scope.projectId,
    campaignId: campaign.campaignId,
    requestedBy,
  };
  const enqueued = await enqueue(MEASURE_KIND, payload, { key: measureJobKey(scope.tenantId, campaign.campaignId) });
  return { requested: true, jobId: enqueued.jobId, deduplicated: enqueued.deduplicated };
}
