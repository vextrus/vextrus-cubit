// The composition root for the bar schedule's render kind (ARCH-01, ARCH-02).
//
// The run is `src/modules/takeoff/bbs-ui/job.ts`'s; what it writes bytes to is SEAM-STORAGE's app
// store, and a module may not reach the process's own storage configuration. So the wiring stands
// here, beside the draft's handler, exactly as that kind's does: the worker is the layer that may
// hold the module, the document seam and the store at once.
import { appStorage } from "../../core/storage/app";
import { registerJobHandler } from "../../core/jobs";
import { BBS_RENDER_KIND } from "../../modules/takeoff/bbs-ui";
import { runBbsRenderJob, type BbsRenderDeps } from "../../modules/takeoff/bbs-ui/job";

/**
 * What a render runs against in production: this installation's artefact store, and the pinned
 * renderer the document seam reaches for when a caller hands none (SEAM-DOC's `RenderDeps`).
 */
export function bbsRenderDeps(): BbsRenderDeps {
  return { storage: appStorage() };
}

/** Say which function does a `bbs-render` job's work, and what it writes its bytes with. */
export function registerBbsRenderHandler(): void {
  registerJobHandler(BBS_RENDER_KIND, async (payload, progress) => {
    await runBbsRenderJob(payload, progress, bbsRenderDeps());
  });
}
