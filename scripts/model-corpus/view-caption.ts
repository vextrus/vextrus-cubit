// The view-caption question's recorder (R-TO-030): the captions the product's own rebuild asks a model
// about, once each, put as the product itself composes them (`viewCaptionRequest`). WHICH captions is
// never this file's: it is `captionsAskedOf`, the one selection `partition/rebuild.ts` asks by, over
// the views the product's own `partitionArtifact` cuts — so a hash recorded here is a hash the product
// asks, and a corpus recorded before the partition moved stops answering where the product stops
// asking. The drawing is this recorder's own flag — `--drawing <path>`, and `--limit N` for how many
// subjects are asked.
import { basename } from "node:path";
import { requestHash } from "../../src/core/model";
import { viewCaptionRequest } from "../../src/core/view-captions";
import { ingestedGraph } from "./ingested";
import { captionsAskedOf } from "../../src/modules/takeoff/partition/views/asked-captions";
import { partitionArtifact, type PartitionedView } from "../../src/modules/takeoff/partition/views/assign";
import type { Asked, RecorderContext } from "./recorder";

/** How many subjects are asked when the command line names no limit. */
const DEFAULT_LIMIT = "200";

/**
 * The captions the product asks about over these views, as the product asks them: one subject per
 * distinct request, in the order the rebuild asks — two views carrying the same caption on the same
 * entity are one request, and a request is recorded once.
 */
export function captionSubjectsOf(views: readonly PartitionedView[], drawing: string): Asked[] {
  const seen = new Set<string>();
  const asked: Asked[] = [];
  for (const caption of captionsAskedOf(views)) {
    const request = viewCaptionRequest(caption.caption, caption.anchorKey);
    const hash = requestHash(request);
    if (seen.has(hash)) continue;
    seen.add(hash);
    asked.push({ request, subject: `${basename(drawing)} · ${caption.anchorKey} · ${caption.caption}`, artifact: drawing });
  }
  return asked;
}

/** Every caption the product would ask a model about on a drawing, once each. */
export async function subjectsOf(ctx: RecorderContext): Promise<Asked[]> {
  const drawing = ctx.option("--drawing") ?? ctx.fail("--drawing <path> names the drawing whose untyped captions are asked");
  const limit = Number(ctx.option("--limit") ?? DEFAULT_LIMIT);
  const graph = await ingestedGraph(drawing, ctx.fail);
  const partition = partitionArtifact(graph);
  const asked = captionSubjectsOf(partition.views, drawing);
  ctx.say(`${basename(drawing)}: ${partition.views.length} views, ${asked.length} captions the grammar could not read`);
  return asked.slice(0, limit);
}
