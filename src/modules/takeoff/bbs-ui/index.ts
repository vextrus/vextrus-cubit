// What a caller needs to ASK for a bar schedule (ARCH-02): the kind the render runs under, and the
// key one campaign's render stands under — the draft BOQ's shape (`../boq/index.ts`), one door over.
//
// What is NOT here, on purpose: the run itself (`runBbsRenderJob`), which stands behind ./job for the
// worker's composition root alone. A bundler follows a barrel's every re-export, and the run reaches
// the document seam — which spawns the pinned renderer — so a screen that imported this barrel would
// pull a process boundary into its own module graph (ARCH-01, AS-01, the measure barrel's precedent).
import type { JobKind } from "@/core/jobs";

/** The kind this seam's work runs under, bound to SEAM-JOBS' roster rather than re-spelled (B-17). */
export const BBS_RENDER_KIND = "bbs-render" satisfies JobKind;

/**
 * The key one campaign's schedule render stands under. The work is OF a campaign — a schedule states
 * the bars a campaign's measurement wrote (R-TO-054) — so the campaign keys it, and while one stands
 * queued asking again is the same ask (SEAM-JOBS: "every job idempotent on its key", I-270).
 */
export function bbsRenderJobKey(tenantId: string, campaignId: string): string {
  return `bbs-render:${tenantId}:${campaignId}`;
}
