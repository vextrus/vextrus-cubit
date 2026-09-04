// The composition root for SEAM-CAD's job kind (ARCH-01): the handler is written in
// src/modules/takeoff, the store it reads and writes is the spine's, and src/core — which may
// import neither — cannot name either of them. The worker is the layer that may hold both, so the
// wiring is made here and nowhere else (ARCH-02, B-17).
import { registerJobHandler } from "../../core/jobs";
import { uploadStorage } from "../../modules/spine/uploads";
import { INGEST_KIND, runIngestJob } from "../../modules/takeoff/ingest";
import { requestThumbnails } from "../../modules/takeoff/thumbnails";

/** The step an ingest records when the previews it chained were refused rather than asked for. */
const THUMBNAILS_REFUSED_STEP = "thumbnails-refused";

/**
 * Say which function does an `ingest` job's work, and what is asked for once it has recorded.
 *
 * The chain lives here because this is the layer that may hold both seams (X-1: the sheets fan out
 * with their previews drawn). It is asked for by the worker rather than by the browser on purpose: a
 * tab closed the moment an ingest finished would otherwise leave a record whose sheets nobody ever
 * rendered. `requestThumbnails` is idempotent per record, so a second asker finds the work already
 * done rather than drawing the same pictures twice.
 */
export function registerIngestHandler(): void {
  registerJobHandler(INGEST_KIND, async (payload, progress) => {
    await runIngestJob(payload, progress, { storage: uploadStorage() });
    const asked = await requestThumbnails({ tenantId: payload.tenantId, drawingId: payload.drawingId, requestedBy: payload.requestedBy });
    // A refused ask is recorded on the job that made it (ARCH-03): the ingest itself succeeded, so
    // the job does not fail, but the refusal is a fact of this job's life and the durable step log is
    // where a job's life is read. It is never retried here — the codes this door refuses with say the
    // work is not this scope's to do or has nothing to draw from, and neither changes by asking again.
    if ("refusal" in asked) await progress.step(THUMBNAILS_REFUSED_STEP, { refusal: asked.refusal, drawing_id: payload.drawingId });
  });
}
