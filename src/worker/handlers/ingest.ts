// The composition root for SEAM-CAD's job kind (ARCH-01): the handler is written in
// src/modules/takeoff, the store it reads and writes is the spine's, and src/core — which may
// import neither — cannot name either of them. The worker is the layer that may hold both, so the
// wiring is made here and nowhere else (ARCH-02, B-17).
import { reportFault } from "../../core/faults/report";
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
/** How a refused chain is recorded: the chain is nobody's request, so it names itself (ARCH-03). */
const CHAIN_ACTOR = "ingest:thumbnails";
const CHAIN_ROUTE = "job/ingest";

export function registerIngestHandler(): void {
  registerJobHandler(INGEST_KIND, async (payload, progress) => {
    await runIngestJob(payload, progress, { storage: uploadStorage() });
    const chained = await requestThumbnails({ tenantId: payload.tenantId, drawingId: payload.drawingId, requestedBy: payload.requestedBy });
    // The chain has no person to refuse to: nobody is watching this call, so a refusal here is a
    // drawing left permanently short of its pictures with nothing anywhere saying why. It is not
    // the ingest's failure — the record landed and the job succeeded — so it is recorded through
    // the one fault seam rather than thrown, and the operator reads the code the seam answered
    // (ARCH-03, B-21).
    if ("refusal" in chained) {
      reportFault({
        requestId: payload.drawingId,
        actor: CHAIN_ACTOR,
        route: CHAIN_ROUTE,
        cause: new Error(`the thumbnails chained after ingest was refused ${chained.refusal} for drawing ${payload.drawingId}, which leaves the record without rasters (R-SPINE-022)`),
      });
    }
  });
}
