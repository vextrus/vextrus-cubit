/**
 * AC-5(g), AC-5(h) — what makes two texts one column, and what the pitch is read from.
 *
 * Rows cluster with a tolerance because a draughtsman's hand moves a cell off its line; columns are
 * deduped by EXACT insertion x (debt-src-modules-1euzl4x), so a header text nudged four tenths of a
 * millimetre starts a column of its own and every cell beneath it is split between two columns that
 * are one column. The same tolerance the rows already use — the taller of two texts' own heights —
 * settles it, and the column stands at the median x of the texts that made it.
 *
 * The pitch is the other half (debt-src-modules-mhj8w8): the step from the header to the band
 * beneath it, taken from the table's own bands and from nothing else on the sheet. A note above the
 * caption and a block of general notes stacked below the table are on the sheet and not in it.
 *
 * A pure function over an artifact: no database, no model, no sheet.
 */
import { expect, test } from "vitest";
import { reconstructDoor } from "../support/schedules-stage";
import { viewsResultOf } from "../support/conventions-stage";

const CAPTION = "COLUMN SCHEDULE";
const CAPTION_HEIGHT = 5;
const TEXT_HEIGHT = 2.5;

/** Where the two columns of the staged table stand, and the nudge that must not split one of them. */
const LEFT = 100;
const NUDGE = 100.4;
const RIGHT = 140;

/** The step the staged table stacks its rows at, and the header/row bands it stacks. */
const PITCH = 10;

type Drawn = { key: string; type: string; space: string; layer: string; text?: string; height?: number; points: number[][] };
type Cell = { rowIndex: number; columnIndex: number; text: string; sourceKeys: string[] };
type Table = { viewKey: string; pitch: number; columns: number[]; cells: Cell[] };

/**
 * One schedule: a caption, a header band whose left two texts stand within a text height of each
 * other, two rows beneath it at the table's pitch — and two things that are not the table, a note
 * standing above the caption and a block of notes stacked well below the last row.
 */
function sheet(): unknown {
  let ordinal = 0;
  const at = (text: string, x: number, y: number, height: number): Drawn => ({
    key: `DXF_HANDLE:${(ordinal += 1).toString(16).toUpperCase()}`,
    type: "TEXT",
    space: "Model",
    layer: "SCHEDULE",
    text,
    height,
    points: [[x, y]],
  });

  const entities: Drawn[] = [
    at(CAPTION, LEFT, 0, CAPTION_HEIGHT),
    // The header: MARK and SIZE are one column drawn a hair apart; REMARKS is the other.
    at("MARK", LEFT, -PITCH, TEXT_HEIGHT),
    at("SIZE", NUDGE, -PITCH, TEXT_HEIGHT),
    at("REMARKS", RIGHT, -PITCH, TEXT_HEIGHT),
    at("C1", LEFT, -2 * PITCH, TEXT_HEIGHT),
    at("300x450", NUDGE, -2 * PITCH, TEXT_HEIGHT),
    at("TYPICAL", RIGHT, -2 * PITCH, TEXT_HEIGHT),
    at("C2", LEFT, -3 * PITCH, TEXT_HEIGHT),
    at("300x600", NUDGE, -3 * PITCH, TEXT_HEIGHT),
    at("CORNER", RIGHT, -3 * PITCH, TEXT_HEIGHT),
    // Not the table: a note over the caption, and general notes stacked five pitches below the last row.
    at("REVISION B", LEFT, PITCH, TEXT_HEIGHT),
    at("GENERAL NOTES", LEFT, -8 * PITCH, TEXT_HEIGHT),
    at("ALL DIMENSIONS IN MM", LEFT, -9 * PITCH, TEXT_HEIGHT),
  ];

  return {
    entitygraph_version: 2,
    ingest: { scheme: "DXF_HANDLE", tool: "cubit-acceptance", tool_version: "0.0.0", parameter_set_hash: "0".repeat(64) },
    insunits: { code: 4, unit: "mm", unmapped: false },
    layouts: [{ name: "Model", kind: "model", bbox: { min: [0, -100], max: [200, 20] }, strays_rejected: 0 }],
    dropped_layouts: [],
    entities: entities.map((record) => ({ ...record, colour: { rgb: [0, 0, 0], source: "bylayer" } })),
    derived: [],
    block_attributes: [],
    counters: [],
  };
}

/** The one table the staged sheet reconstructs to. */
async function table(): Promise<Table> {
  const { reconstructSchedules } = await reconstructDoor();
  const graph = sheet();
  const partitioned = await viewsResultOf(graph);
  const reconstructed = reconstructSchedules({ graph, views: partitioned.views, assignments: (partitioned as unknown as { assignments: ReadonlyMap<string, string> }).assignments }) as unknown as {
    tables: Table[];
  };

  expect(reconstructed.tables.length, "the staged sheet carries one schedule").toBe(1);
  return reconstructed.tables[0] as Table;
}

test("AC-5(g): two header texts within a text height of each other are one column", async () => {
  const reconstructed = await table();

  expect(reconstructed.columns.length, "MARK and SIZE stand 0.4 apart with a height of 2.5 — one hand's wobble, one column").toBe(2);
});

test("AC-5(g): a column stands at the median x of the texts that made it", async () => {
  const reconstructed = await table();

  const median = (LEFT + NUDGE) / 2;
  expect(reconstructed.columns[0], "the clustered column stands where its texts stand, not at whichever was written first").toBeCloseTo(median, 6);
  expect(reconstructed.columns[1], "the column nothing clustered with is where it was drawn").toBeCloseTo(RIGHT, 6);
});

test("AC-5(h): the pitch is the step from the header to the band beneath it", async () => {
  const reconstructed = await table();

  expect(reconstructed.pitch, "the table's own step, declared where the table begins — not a statistic over the sheet").toBeCloseTo(PITCH, 6);
});

test("AC-5(h): a note above the caption and a note block below the table are in neither", async () => {
  const reconstructed = await table();

  const rows = new Set(reconstructed.cells.map((cell) => cell.rowIndex));
  expect(rows.size, "a header and two rows: the notes stacked more than 3.5 pitches below the last row ended the table").toBe(3);
  expect(
    reconstructed.cells.some((cell) => cell.text.includes("REVISION B") || cell.text.includes("GENERAL NOTES")),
    "nothing above the caption or beyond the stop is a cell of the table",
  ).toBe(false);
});
