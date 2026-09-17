// The composition root for the draft's render kind (ARCH-01, ARCH-02).
//
// The run is `src/modules/takeoff/boq/job.ts`'s; what it writes bytes to is SEAM-STORAGE's app
// store, and a module may not reach the process's own storage configuration. So the wiring stands
// here, beside the measure handler, exactly as that kind's does: the worker is the layer that may
// hold the module, the document seam and the store at once.
import { appStorage } from "../../core/storage/app";
import { registerJobHandler } from "../../core/jobs";
import { BOQ_RENDER_DRAFT_KIND, runBoqDraftJob, type BoqDraftDeps } from "../../modules/takeoff/boq/job";

/**
 * What a render runs against in production: this installation's artefact store, and the pinned
 * renderer the document seam reaches for when a caller hands none (SEAM-DOC's `RenderDeps`).
 *
 * It is published rather than inlined because "the production wiring" is a fact worth being able to
 * name — the handler below and anything that runs a render outside a worker read the same one, so
 * the two cannot drift (ARCH-02).
 */
export function boqDraftDeps(): BoqDraftDeps {
  return { storage: appStorage() };
}

/** Say which function does a `boq-render-draft` job's work, and what it writes its bytes with. */
export function registerBoqDraftHandler(): void {
  registerJobHandler(BOQ_RENDER_DRAFT_KIND, async (payload, progress) => {
    await runBoqDraftJob(payload, progress, boqDraftDeps());
  });
}
