// The composition root for R-SPINE-022's job kind (ARCH-01): the handler is written in
// src/modules/takeoff, the store it reads the artifact from and writes its rasters to is the app's,
// and src/core — which may import neither — cannot name either of them. The worker is the layer that
// may hold both, so the wiring is made here and nowhere else (ARCH-02, B-17).
import { registerJobHandler } from "../../core/jobs";
import { uploadStorage } from "../../modules/spine/uploads";
import { THUMBNAILS_KIND, runThumbnailsJob } from "../../modules/takeoff/thumbnails";

/** Say which function does a `thumbnails` job's work. Called before the runtime consumes the queue. */
export function registerThumbnailsHandler(): void {
  registerJobHandler(THUMBNAILS_KIND, (payload, progress) => runThumbnailsJob(payload, progress, { storage: uploadStorage() }));
}
