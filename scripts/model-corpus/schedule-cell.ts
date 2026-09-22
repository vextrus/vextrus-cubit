// The schedule-cell question's recorder (R-TO-031, L-CAD-08): every row of every schedule a drawing
// carries that the deterministic path leaves contested, once each, put as the product itself
// composes it (`scheduleCellRequest`). The drawing is this recorder's own flag — `--drawing <path>`,
// and `--limit N` for how many subjects are asked.
//
// NO DATABASE and no store: the subjects are found by the same three pure stages the partition's own
// rebuild runs — ingest the artifact, partition its views, reconstruct the schedules standing in them
// — so what is recorded is a fact about the drawing and about nothing else (L-AI-01 replays
// deterministically from the hash of the request this builds).
import { readFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { ingestDrawing } from "../../src/modules/takeoff/ingest/job";
import { contestedRowsOf, scheduleCellRequest } from "../../src/modules/takeoff/partition/schedules/cell-reading";
import { reconstructSchedules } from "../../src/modules/takeoff/partition/schedules/reconstruct";
import { partitionArtifact } from "../../src/modules/takeoff/partition/views/assign";
import type { Asked, RecorderContext } from "./recorder";

/** How many subjects are asked when the command line names no limit. */
const DEFAULT_LIMIT = "200";

/**
 * Every contested row of every schedule on a drawing, once each, as the product would ask it.
 *
 * A row the grammar and the column headers already settle is not here: `contestedRowsOf` offers only
 * the rows carrying a cell the deterministic path is silent or split about (L-AI-03 asks the grammar
 * first), so the corpus is recorded over exactly the questions the product would really put — never
 * over rows nobody would pay to ask.
 */
export async function subjectsOf(ctx: RecorderContext): Promise<Asked[]> {
  const drawing = ctx.option("--drawing") ?? ctx.fail("--drawing <path> names the drawing whose contested schedule cells are asked");
  const limit = Number(ctx.option("--limit") ?? DEFAULT_LIMIT);
  const bytes = new Uint8Array(readFileSync(drawing));
  const tempDir = mkdtempSync(join(tmpdir(), "cubit-model-corpus-ingest-"));
  const format = drawing.toLowerCase().endsWith(".dwg") ? "dwg" : "dxf";
  const outcome = await ingestDrawing(bytes, format as Parameters<typeof ingestDrawing>[1], { tempDir });
  if (!outcome.ok) ctx.fail(`the extractor refused ${drawing}: ${outcome.refusal} — ${outcome.detail}`);

  const partition = partitionArtifact(outcome.graph);
  const schedules = reconstructSchedules({ graph: outcome.graph, views: partition.views, assignments: partition.assignments });

  const asked: Asked[] = [];
  let rows = 0;
  for (const table of schedules.tables) {
    const dataRows = new Set(table.cells.filter((cell) => cell.rowIndex > 0).map((cell) => cell.rowIndex)).size;
    const contested = contestedRowsOf(table);
    rows += dataRows;
    for (const state of contested) {
      asked.push({ request: scheduleCellRequest(state), subject: `${basename(drawing)} · ${table.title} · row ${state.row.index}`, artifact: drawing });
    }
    ctx.say(`  ${table.title}: ${contested.length} contested row(s) of ${dataRows}`);
  }
  // A schedule view that reconstructed no table is said out loud rather than passed over: a corpus
  // that quietly covered four of five schedules would imply a coverage it does not have (Q-08).
  for (const deferral of schedules.deferrals) ctx.say(`  ${deferral.viewKey}: no table reconstructed (${deferral.reason}) — nothing to ask`);
  ctx.say(`${basename(drawing)}: ${schedules.views} schedule view(s), ${schedules.tables.length} table(s), ${rows} data row(s), ${asked.length} contested row(s) to ask`);
  return asked.slice(0, limit);
}
