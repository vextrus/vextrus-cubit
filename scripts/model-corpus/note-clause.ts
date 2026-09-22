// The note-clause question's recorder (R-TO-034): every clause of a drawing's general notes that
// the deterministic grammar read nothing in, put as the product itself composes it
// (`noteClauseRequest`). The drawing is this recorder's own flag — `--drawing <path>` — with
// `--layouts S-01,S-02` for the sheets to record and `--limit N` for how many subjects are asked.
//
// No database. The clauses are read off the ingested artifact's own texts, sheet by sheet, exactly
// as `sheetTextsOn` reads them from a stored artifact — the same entities, the same order — so what
// is recorded is a fact about the drawing rather than about a workspace.
import { readFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { askedClausesOf, lapTableHeadingsOn } from "../../src/core/notes/clauses";
import type { SheetText } from "../../src/core/notes/grammar";
import { noteClauseRequest } from "../../src/core/notes/model";
import { ingestDrawing } from "../../src/modules/takeoff/ingest/job";
import type { Asked, RecorderContext } from "./recorder";

/** How many subjects are asked when the command line names no limit. */
const DEFAULT_LIMIT = "200";

/** How much of a clause a reader sees in the roster line. */
const SUBJECT_LENGTH = 60;

/**
 * The space a sheet's own words stand in. General notes are PRINTED: they stand on a paper layout,
 * beside the title block, and model space holds the views a drawing is cut into (L-CAD-05,
 * L-CAD-06). Asking about model space would put every bar call of every detail to a model.
 */
const PAPER = "paper";

/** Every clause of a drawing's notes the grammar could not read, as the product would ask it. */
export async function subjectsOf(ctx: RecorderContext): Promise<Asked[]> {
  const drawing = ctx.option("--drawing") ?? ctx.fail("--drawing <path> names the drawing whose silent note clauses are asked");
  const limit = Number(ctx.option("--limit") ?? DEFAULT_LIMIT);
  const bytes = new Uint8Array(readFileSync(drawing));
  const tempDir = mkdtempSync(join(tmpdir(), "cubit-model-corpus-ingest-"));
  const format = drawing.toLowerCase().endsWith(".dwg") ? "dwg" : "dxf";
  const outcome = await ingestDrawing(bytes, format as Parameters<typeof ingestDrawing>[1], { tempDir });
  if (!outcome.ok) ctx.fail(`the extractor refused ${drawing}: ${outcome.refusal} — ${outcome.detail}`);

  const said = new Map<string, SheetText[]>();
  for (const entity of outcome.graph.entities) {
    if (typeof entity.text !== "string") continue;
    const held = said.get(entity.space);
    if (held === undefined) said.set(entity.space, [{ sourceKey: entity.key, text: entity.text }]);
    else held.push({ sourceKey: entity.key, text: entity.text });
  }

  // `--layouts S-01,S-02` records the sheets a reader named and nothing else; with none named,
  // every PAPER layout of the drawing is recorded.
  const named = ctx.option("--layouts")?.split(",").map((one) => one.trim()).filter((one) => one !== "");

  const asked: Asked[] = [];
  for (const layout of outcome.graph.layouts) {
    if (layout.kind !== PAPER) continue;
    if (named !== undefined && !named.includes(layout.name)) continue;
    const texts = said.get(layout.name) ?? [];
    if (texts.length === 0) continue;
    const lapTable = lapTableHeadingsOn(texts);
    const clauses = askedClausesOf(texts);
    if (clauses.length > 0) ctx.say(`${basename(drawing)} · ${layout.name}: ${clauses.length} clauses the grammar read nothing in, ${lapTable.length} lap-table headings beside them`);
    for (const clause of clauses) {
      asked.push({
        request: noteClauseRequest({ clause: clause.clause, key: clause.sourceKey, layout: layout.name, figures: clause.figures, lapTable }),
        subject: `${basename(drawing)} · ${layout.name} · ${clause.sourceKey}#${clause.ordinal} · ${clause.clause.slice(0, SUBJECT_LENGTH)}`,
        artifact: drawing,
      });
    }
  }
  const sheets = outcome.graph.layouts.filter((layout) => layout.kind === PAPER && (named === undefined || named.includes(layout.name)));
  ctx.say(`${basename(drawing)}: ${asked.length} clauses asked over ${sheets.length} paper layout(s)`);
  return asked.slice(0, limit);
}
