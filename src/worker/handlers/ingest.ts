// The composition root for SEAM-CAD's job kind (ARCH-01): the handler is written in
// src/modules/takeoff, the store it reads and writes is the spine's, and src/core — which may
// import neither — cannot name either of them. The worker is the layer that may hold both, so the
// wiring is made here and nowhere else (ARCH-02, B-17).
import { registerJobHandler } from "../../core/jobs";
import { uploadStorage } from "../../modules/spine/uploads";
import { INGEST_KIND, runIngestJob } from "../../modules/takeoff/ingest/job";

/** Say which function does an `ingest` job's work. Called before the runtime consumes the queue. */
export function registerIngestHandler(): void {
  registerJobHandler(INGEST_KIND, (payload, progress) => runIngestJob(payload, progress, { storage: uploadStorage() }));
}
