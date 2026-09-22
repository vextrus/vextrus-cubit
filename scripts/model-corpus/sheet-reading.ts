// The sheet-reading question's recorder (R-AI-001): the committed silent sheet's paper layout, put
// as the product itself composes it (`sheetUnderstandingRequest`). One subject, always the same one,
// so the recording is a fact about the committed artifact rather than about the run.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { entityGraphSchema, type EntityGraph } from "../../src/core/entitygraph/schema";
import { sheetUnderstandingRequest } from "../../src/modules/ai/sheet-understanding";
import type { Asked, RecorderContext } from "./recorder";

/** The committed silent sheet the sheet-reading question is recorded over (F-MODEL). */
const SILENT_SHEET = ["sheet-understanding", "artifacts", "silent-title-block.graph.json"] as const;

/** The silent sheet's reading: the committed artifact's paper layout, as the product composes it. */
export function subjectsOf(ctx: RecorderContext): Asked[] {
  const path = join(ctx.corpusRoot, ...SILENT_SHEET);
  const graph = graphAt(path, ctx);
  const layout = graph.layouts.find((held) => held.kind === "paper");
  if (layout === undefined) ctx.fail(`${path} carries no paper layout`);
  return [{ request: sheetUnderstandingRequest(graph, layout.name), subject: `silent-title-block.graph.json · ${layout.name}`, artifact: path }];
}

function graphAt(path: string, ctx: RecorderContext): EntityGraph {
  const parsed = entityGraphSchema.safeParse(JSON.parse(readFileSync(path, "utf8")));
  if (!parsed.success) ctx.fail(`${path} is no EntityGraph this product can read`);
  return parsed.data;
}
