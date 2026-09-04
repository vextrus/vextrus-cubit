// The composition root for SEAM-CAD's job kind (ARCH-01): the handler is written in
// src/modules/takeoff, the store it reads and writes is the spine's, and src/core — which may
// import neither — cannot name either of them. The worker is the layer that may hold both, so the
// wiring is made here and nowhere else (ARCH-02, B-17).
import { registerJobHandler } from "../../core/jobs";
import { uploadStorage } from "../../modules/spine/uploads";
import { INGEST_KIND, runIngestJob } from "../../modules/takeoff/ingest";
import { requestThumbnails } from "../../modules/takeoff/thumbnails";

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
    await requestThumbnails({ tenantId: payload.tenantId, drawingId: payload.drawingId, requestedBy: payload.requestedBy });
  });
}
