// What a schedule's reconstruction does with a text that reaches no column of the table (L-CAD-08,
// L-QTY-04): it answers it, rather than letting it fall out of the reading in silence.
//
// The table is drawn here, so what is owed is read off the drawing rather than transcribed (B-19).
import { describe, expect, test } from "vitest";
import type { EntityGraph } from "@/core/entitygraph/schema";
import type { PartitionedView } from "../views/assign";
import { VIEW_TYPE } from "../views/law";
import { reconstructSchedules } from "./reconstruct";

/** One text of the drawing: what it says, and where the draughtsman put it. */
function text(key: string, said: string, x: number, y: number, height = 1): Record<string, unknown> {
  return { key, type: "TEXT", space: "Model", layer: "S-ANNO", colour: { rgb: [0, 0, 0], source: "explicit" }, text: said, height, points: [[x, y]] };
}

const VIEW_KEY = "SCHEDULE:1";
const CAPTION = text("e:1", "COLUMN SCHEDULE", 0, 100, 5);

/** A header of three columns 100 apart — so a column reaches 50 either side of its own insertion. */
const HEADER = [text("e:2", "MARK", 0, 90), text("e:3", "SIZE", 100, 90), text("e:4", "MAIN BARS", 200, 90)];
const ROW = [text("e:5", "C1", 0, 80), text("e:6", "300x450", 100, 80), text("e:7", "8-16Ø", 200, 80)];

/** The one table the drawn entities reconstruct to. */
function tableOf(entities: readonly Record<string, unknown>[]): { cells: { sourceKeys: string[] }[]; unplaced: readonly { key: string; text: string }[] } {
  const answer = reconstructSchedules({
    graph: { entities } as unknown as EntityGraph,
    views: [{ viewKey: VIEW_KEY, type: VIEW_TYPE.SCHEDULE, reason: null, caption: "COLUMN SCHEDULE", anchorKey: CAPTION["key"] as string } as PartitionedView],
    assignments: new Map(entities.map((entity) => [entity["key"] as string, VIEW_KEY])),
  });
  expect(answer.tables.length, "the drawn schedule reconstructs to one table").toBe(1);
  return answer.tables[0] as never;
}

/** A schedule that stacks a mark's whole statement — the section over the bars over the ties, with
 * the mark written once level with the third of them (F-RCC6-BNBC S-11's own shape). The marks stand
 * 26 apart, so a line further off than 13 is no line of any mark's row. */
const STACKED_CAPTION = text("s:1", "COLUMN SCHEDULE", 0, 100, 5);
const STACKED = [
  text("s:2", "MARK", 0, 90),
  text("s:3", "GF TO 2ND", 100, 90),
  text("s:4", "300x450", 100, 82),
  text("s:5", "8-16Ø", 100, 78),
  text("s:6", "C1", 0, 74),
  text("s:7", "10Ø@100/150 (TIES)", 100, 74),
  text("s:8", "300x600", 100, 56),
  text("s:9", "10-20Ø", 100, 52),
  text("s:10", "C2", 0, 48),
  text("s:11", "10Ø@100/150 (TIES)", 100, 48),
  text("s:12", "ALL COLUMNS 40 mm CLEAR COVER", 0, 30),
];

/** The one table those entities reconstruct to, read through the shipped stage. */
function stackedTableOf(entities: readonly Record<string, unknown>[]): { cells: { rowIndex: number; columnIndex: number; text: string; sourceKeys: string[] }[] } {
  const answer = reconstructSchedules({
    graph: { entities } as unknown as EntityGraph,
    views: [{ viewKey: VIEW_KEY, type: VIEW_TYPE.SCHEDULE, reason: null, caption: "COLUMN SCHEDULE", anchorKey: STACKED_CAPTION["key"] as string } as PartitionedView],
    assignments: new Map(entities.map((entity) => [entity["key"] as string, VIEW_KEY])),
  });
  expect(answer.tables.length, "the drawn schedule reconstructs to one table").toBe(1);
  return answer.tables[0] as never;
}

describe("L-CAD-08: a row is delimited by the mark cells, not by the bands", () => {
  test("the lines a mark's own row stacks are one cell per column, joined in reading order and citing every text", () => {
    const cells = stackedTableOf([STACKED_CAPTION, ...STACKED]).cells;
    const band = cells.find((cell) => cell.rowIndex === 1 && cell.columnIndex === 1);

    expect(
      cells.filter((cell) => cell.columnIndex === 0).map((cell) => cell.text),
      "a header and one row per mark: read band for band, C1's row would carry the ties string as its section and two rows of the table would name no member at all",
    ).toEqual(["MARK", "C1", "C2", "ALL COLUMNS 40 mm CLEAR COVER"]);
    expect(band?.text, "the three lines of the cell are one cell, joined by the sign two texts of one cell are joined with (AC-2)").toBe("300x450+8-16Ø+10Ø@100/150 (TIES)");
    expect(band?.sourceKeys, "and the cell cites every text it was read from, down the page (L-CAD-03)").toEqual(["s:4", "s:5", "s:7"]);
  });

  test("a note standing further off than half the marks' own spacing is a row of its own", () => {
    const cells = stackedTableOf([STACKED_CAPTION, ...STACKED]).cells;

    expect(
      cells.filter((cell) => cell.rowIndex === 3).map((cell) => cell.text),
      "the note stands 18 below the last mark where the marks stand 26 apart — past the half where one row stops being the nearest, so it is nobody's section (L-QTY-01)",
    ).toEqual(["ALL COLUMNS 40 mm CLEAR COVER"]);
  });

  test("a table no band of which names a member is read band for band, as it always was", () => {
    const noise = [
      text("n:2", "MARK", 0, 90),
      text("n:3", "SIZE", 100, 90),
      text("n:4", "SEE NOTE 3", 0, 82),
      text("n:5", "300x450", 100, 82),
      text("n:6", "-", 0, 78),
      text("n:7", "300x600", 100, 78),
    ];
    const cells = stackedTableOf([STACKED_CAPTION, ...noise]).cells;

    expect(
      [...new Set(cells.map((cell) => cell.rowIndex))],
      "with no mark cell there is no row extent to read, and a table read some other way would be a guess: the bands stand as they were drawn",
    ).toEqual([0, 1, 2]);
  });
});

describe("L-CAD-08: a schedule's texts beyond every column", () => {
  test("a text standing beyond every column's reach is answered in `unplaced`, and reaches no cell", () => {
    const margin = text("e:8", "REV B — SEE NOTE 4", 500, 80);
    const table = tableOf([CAPTION, ...HEADER, ...ROW, margin]);

    expect(
      new Set(table.cells.flatMap((cell) => cell.sourceKeys)).has("e:8"),
      "a note out in the margin is no cell of the row it stands level with: folding it into the nearest column would rewrite that cell (L-CAD-08)",
    ).toBe(false);
    expect(
      table.unplaced.map((one) => ({ key: one.key, text: one.text })),
      "and what the drawing said there is answered with the key it was read from — a reading the drawing carries is never discarded in silence (L-QTY-04)",
    ).toEqual([{ key: "e:8", text: "REV B — SEE NOTE 4" }]);
  });

  test("a table whose every text lands in a column answers an empty list", () => {
    expect(
      tableOf([CAPTION, ...HEADER, ...ROW]).unplaced,
      "an empty list, never an absence a reader has to guess at (R-UI-050)",
    ).toEqual([]);
  });

  test("unplaced texts are answered in reading order, down the page and then across", () => {
    const table = tableOf([CAPTION, ...HEADER, ...ROW, text("e:8", "(TYP)", -200, 70), text("e:9", "REV B", 500, 80)]);
    expect(
      table.unplaced.map((one) => one.text),
      "the page is read down first: the note level with the first row stands before the one beneath it, whatever order the artifact listed them in",
    ).toEqual(["REV B", "(TYP)"]);
  });
});
