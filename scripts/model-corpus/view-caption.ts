// The view-caption question's recorder (R-TO-030): every caption the partition left untyped on a
// drawing, once each, put as the product itself composes it (`viewCaptionRequest`). The drawing is
// this recorder's own flag — `--drawing <path>`, and `--limit N` for how many subjects are asked.
import { readFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { viewCaptionRequest } from "../../src/core/view-captions";
import { ingestDrawing } from "../../src/modules/takeoff/ingest/job";
import { partitionArtifact } from "../../src/modules/takeoff/partition/views/assign";
import { VIEW_TYPE } from "../../src/modules/takeoff/partition/views/law";
import type { Asked, RecorderContext } from "./recorder";

/** How many subjects are asked when the command line names no limit. */
const DEFAULT_LIMIT = "200";

/** Every caption the partition left untyped on a drawing, once each, as the product would ask it. */
export async function subjectsOf(ctx: RecorderContext): Promise<Asked[]> {
  const drawing = ctx.option("--drawing") ?? ctx.fail("--drawing <path> names the drawing whose untyped captions are asked");
  const limit = Number(ctx.option("--limit") ?? DEFAULT_LIMIT);
  const bytes = new Uint8Array(readFileSync(drawing));
  const tempDir = mkdtempSync(join(tmpdir(), "cubit-model-corpus-ingest-"));
  const format = drawing.toLowerCase().endsWith(".dwg") ? "dwg" : "dxf";
  const outcome = await ingestDrawing(bytes, format as Parameters<typeof ingestDrawing>[1], { tempDir });
  if (!outcome.ok) ctx.fail(`the extractor refused ${drawing}: ${outcome.refusal} — ${outcome.detail}`);
  const partition = partitionArtifact(outcome.graph);
  const seen = new Set<string>();
  const asked: Asked[] = [];
  for (const view of partition.views) {
    if (view.type !== VIEW_TYPE.UNTYPED || view.anchorKey === null) continue;
    const key = `${view.caption}\u0000${view.anchorKey}`;
    if (seen.has(key)) continue;
    seen.add(key);
    asked.push({ request: viewCaptionRequest(view.caption, view.anchorKey), subject: `${basename(drawing)} · ${view.anchorKey} · ${view.caption}`, artifact: drawing });
  }
  ctx.say(`${basename(drawing)}: ${partition.views.length} views, ${asked.length} captions the grammar could not read`);
  return asked.slice(0, limit);
}
