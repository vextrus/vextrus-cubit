// The sheet-revision-recency question's recorder (R-TO-004): every paper layout of one drawing that
// prints something about its own issue state, once each, put as the product itself composes it
// (`sheetRevisionRequest`). The drawing is this recorder's own flag — `--drawing <path>`, and
// `--limit N` for how many subjects are asked.
//
// The default is F-RCC6-BNBC, the M3/M4 yardstick: its twenty-seven sheets each carry the REV and
// DATE attributes of one title block and the two printed rows of its revision table, and every sheet
// is read against the other twenty-six, which is the benchmark the question exists for. No database
// is opened: the drawing is ingested into an artifact and the request is a pure function of it.
import { basename, resolve } from "node:path";
import { carriesRevisionEvidence, sheetRevisionRequest } from "../../src/modules/ai/sheet-revision";
import { ingestedGraph } from "./ingested";
import type { Asked, RecorderContext } from "./recorder";

/** The drawing whose sheets are asked when the command line names none (F-RCC6-BNBC). */
const YARDSTICK = ["..", "rcc6-bnbc", "rcc6-bnbc.dxf"] as const;

/** How many subjects are asked when the command line names no limit. */
const DEFAULT_LIMIT = "30";

/** Every sheet of a drawing that prints a revision, once each, as the product would ask it. */
export async function subjectsOf(ctx: RecorderContext): Promise<Asked[]> {
  const drawing = ctx.option("--drawing") ?? resolve(ctx.corpusRoot, ...YARDSTICK);
  const limit = Number(ctx.option("--limit") ?? DEFAULT_LIMIT);
  const graph = await ingestedGraph(drawing, ctx.fail);
  const paper = graph.layouts.filter((layout) => layout.kind === "paper");
  const asked: Asked[] = [];
  for (const layout of paper) {
    // A sheet that prints neither a mark nor a row is not asked at all: its only answer would cite
    // nothing, and a call spent on an answer the seam must refuse is a call nobody should make
    // (L-AI-01 attributes what it spends, L-AI-02 refuses an uncited reading).
    if (!carriesRevisionEvidence(graph, layout.name)) continue;
    asked.push({ request: sheetRevisionRequest(graph, layout.name), subject: `${basename(drawing)} · ${layout.name}`, artifact: drawing });
  }
  // The count before the spend: a person reading this line knows how many subjects a recording
  // would put, and how many sheets of the set print nothing, before a single token is spent.
  ctx.say(`${basename(drawing)}: ${paper.length} paper layouts, ${asked.length} printing a revision mark or a revision row`);
  return asked.slice(0, limit);
}
