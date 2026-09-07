// The composition root for R-TO-030's job kind (ARCH-01): the rebuild is written in
// src/modules/takeoff, the object store it reads is the spine's, the way to a model is core's, and
// none of those layers may name the others. The worker is the layer that may hold them all, so the
// wiring is made here and nowhere else (ARCH-02, B-17).
import { registerJobHandler } from "../../core/jobs";
import { proposeViewType } from "../../modules/ai/view-captions";
import { uploadStorage } from "../../modules/spine/uploads";
import { PARTITION_KIND } from "../../modules/takeoff/partition";
import { runPartitionJob } from "../../modules/takeoff/partition/rebuild";

/**
 * Say which function does a `partition` job's work, and what it reaches the world with.
 *
 * The way to a model is handed in rather than reached for (B-23): R-AI's door for a silent view
 * caption is `src/modules/ai/view-captions`, and the takeoff module may not name it (ARCH-01), so
 * this is where the two meet. A rebuild handed no port asks through the same seam anyway — the
 * production entry is the default — which is what lets the partition be run outside a worker.
 */
export function registerPartitionHandler(): void {
  registerJobHandler(PARTITION_KIND, async (payload, progress) => {
    await runPartitionJob(payload, progress, { storage: uploadStorage(), captions: { proposeViewType } });
  });
}
