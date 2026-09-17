// What a caller needs to ASK for a draft (ARCH-02): the kind the render runs under, and the key one
// campaign's render stands under.
//
// What is NOT here, on purpose: the run itself (`runBoqDraftJob`), which stands behind ./job for the
// worker's composition root alone. A bundler follows a barrel's every re-export, and the run reaches
// the document seam — which spawns the pinned renderer — so a screen that imported this barrel would
// pull a process boundary into its own module graph (ARCH-01, AS-01, the measure barrel's precedent).
import type { JobKind } from "@/core/jobs";

/** The kind this seam's work runs under, bound to SEAM-JOBS' roster rather than re-spelled (B-17). */
export const BOQ_RENDER_DRAFT_KIND = "boq-render-draft" satisfies JobKind;

/**
 * The key one campaign's draft render stands under. The work is OF a campaign — a draft states what
 * a campaign published (R-TO-053) — so the campaign keys it, and while one stands queued asking
 * again is the same ask (SEAM-JOBS: "every job idempotent on its key", I-270).
 */
export function boqDraftJobKey(tenantId: string, campaignId: string): string {
  return `boq-draft:${tenantId}:${campaignId}`;
}
