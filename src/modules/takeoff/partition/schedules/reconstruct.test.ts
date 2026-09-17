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
