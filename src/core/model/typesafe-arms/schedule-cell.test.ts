// @vitest-environment node
/**
 * The schedule-cell arm, at the wire (R-TO-031, L-AI-01, L-AI-02).
 *
 * What is graded: that a four-key content is recognised as this arm's task and nothing else is; that
 * one row is posted as ONE question set — the row's own noul beside one choice per contested cell,
 * each choice offering exactly the candidates the request carried plus the no-match outcome, every
 * instruction naming the state by its backticked field path; that NOTHING is supplied where Jev
 * supplied nothing (a no-match answer, an id this arm never offered and a missing answer each
 * contribute no cell); that the sources cited are the row's own keys and the chosen candidates' and
 * no others; and that a row with nothing contested is thrown before a question is posted.
 *
 * The content is spelled here rather than composed by the module that composes it in production:
 * core may not import a module (ARCH-01), and what an arm answers about is the canonical content of
 * a request, which is a string. `tests/ai/schedule-cell.acceptance.test.ts` drives the real builder
 * against the real seam over the same shape.
 */
import { describe, expect, test } from "vitest";
import { canonicalJson } from "../canonical";
import { structuredTaskOf } from "../typesafe";
import type { ModelRequest } from "../types";
import { scheduleCellArm, type CellTask } from "./schedule-cell";

/** The row this suite asks about: a column schedule's band row, two cells of it contested. */
const CONTENT = {
  title: "COLUMN SCHEDULE",
  columns: [
    { index: 0, header: "MARK" },
    { index: 2, header: "" },
    { index: 5, header: "" },
  ],
  row: { index: 3, texts: ["C-1", "300x450", "8-20Ø+TIES 10Ø@100/150"], sourceKeys: ["DXF_HANDLE:A1", "DXF_HANDLE:A2", "DXF_HANDLE:A3", "DXF_HANDLE:A4"] },
  cells: {
    "2": {
      columnIndex: 2,
      text: "300x450",
      header: "",
      candidates: [{ id: "cand_1", attribute: "section", means: "the member's section: its width by depth, or the size this schedule states for it", text: "300x450", sourceKeys: ["DXF_HANDLE:A2"] }],
    },
    "5": {
      columnIndex: 5,
      text: "8-20Ø+TIES 10Ø@100/150",
      header: "",
      candidates: [
        { id: "cand_1", attribute: "main", means: "the member's main reinforcement: the group of longitudinal bars", text: "8-20Ø", sourceKeys: ["DXF_HANDLE:A3"] },
        { id: "cand_2", attribute: "ties", means: "the member's ties or stirrups: the bar and the spacing it is set at", text: "TIES 10Ø@100/150", sourceKeys: ["DXF_HANDLE:A4"] },
      ],
    },
  },
} as const;

/** The request as the wire sees it: only the canonical user message ever reaches an arm. */
function cellRequest(content: unknown = CONTENT): ModelRequest {
  return { modelId: "claude-opus-5", system: "(the module's own system prompt — not read by any arm)", messages: [{ role: "user", content: canonicalJson(content as never) }] };
}

/** The task, recognised as the wire recognises it. */
function taskOf(content: unknown = CONTENT): CellTask {
  const task = scheduleCellArm.recognise(JSON.parse(canonicalJson(content as never)) as Record<string, unknown>);
  expect(task, "this content is a contested row").not.toBeNull();
  return task as CellTask;
}

describe("the schedule-cell arm", () => {
  test("the registry routes a contested row's four-key content to this arm, and reads the row out of it", () => {
    const task = structuredTaskOf(cellRequest());
    expect(task?.kind, "cells, columns, row and title is this arm's key set and no other's").toBe("cell");
    expect(scheduleCellArm.keys, "the key set is the one the request builder spells, sorted").toEqual(["cells", "columns", "row", "title"]);
    const read = task as CellTask;
    expect(read.row).toEqual({ index: 3, texts: [...CONTENT.row.texts], sourceKeys: [...CONTENT.row.sourceKeys] });
    expect(
      read.cells.map((cell) => cell.columnIndex),
      "the contested cells are read in ascending column order however the request spelled them",
    ).toEqual([2, 5]);
  });

  test("a content wearing the key set that is not a contested row is recognised as nothing at all", () => {
    expect(structuredTaskOf(cellRequest({ title: "COLUMN SCHEDULE", columns: [], row: "the third one", cells: {} })), "a row that is not a row is no task").toBeNull();
    expect(structuredTaskOf(cellRequest({ title: 7, columns: [], row: { index: 3, texts: [], sourceKeys: [] }, cells: {} })), "a title that is not a title is no task").toBeNull();
  });

  test("one row is posted as the row's own noul beside one choice per contested cell", () => {
    const body = scheduleCellArm.compose(taskOf()).body as { model: string; state: Record<string, unknown>; questions: Record<string, { type: string; instructions: string; criteria: Record<string, string> }> };
    expect(body.model).toBe("jev-latest");
    expect(Object.keys(body.questions).sort(), "one question set: the row's standing, and each contested cell").toEqual(["cell_2", "cell_5", "row_is_header"]);
    expect(body.questions["row_is_header"]?.type).toBe("noul");
    expect(Object.keys(body.questions["row_is_header"]?.criteria ?? {}).sort(), "a statement judged has two sides and no third").toEqual(["false", "true"]);
    expect(body.state["table_title"]).toBe("COLUMN SCHEDULE");
    expect(body.state["row"], "the row is shown by its texts; its keys are code's citation, not Jev's reading").toEqual({ index: 3, texts: [...CONTENT.row.texts] });
  });

  test("a cell's choice offers exactly the candidates the request carried, plus the no-match outcome", () => {
    const body = scheduleCellArm.compose(taskOf()).body as { questions: Record<string, { type: string; instructions: string; criteria: Record<string, string> }> };
    const asked = body.questions["cell_5"];
    expect(asked?.type).toBe("choice");
    expect(Object.keys(asked?.criteria ?? {}), "the grammar's own two readings, and the answer for a cell that states neither").toEqual(["cand_1", "cand_2", "NOT_STATED"]);
    expect(asked?.criteria["cand_1"], "a criterion is the cell's own words and the one thing that reading would state").toContain('"8-20Ø"');
    expect(asked?.criteria["cand_1"]).toContain("main reinforcement");
    expect(asked?.instructions, "the instructions name the state by the field path it is carried under").toContain("`cells.5.candidates`");
    expect(body.questions["cell_2"]?.instructions).toContain("`cells.2.text`");
    for (const question of Object.values(body.questions)) {
      expect(question.instructions, "a question carries its whole meaning; its id is never sent").toContain("schedule table");
    }
  });

  test("Jev's choices are read as the cells it named, in ascending column order, citing the words it read", () => {
    const wire = scheduleCellArm.compose(taskOf()).read({
      row_is_header: { type: "noul", noul: 0.04 },
      cell_2: { type: "choice", choice: "cand_1" },
      cell_5: { type: "choice", choice: "cand_2" },
    }) as { payload: { header: number | null; cells: { column: number; attribute: string; text: string; sourceKeys: string[] }[] }; sources: string[] };

    expect(wire.payload.header, "the row's standing is the noul's own probability").toBe(0.04);
    expect(wire.payload.cells).toEqual([
      { column: 2, attribute: "section", text: "300x450", sourceKeys: ["DXF_HANDLE:A2"] },
      { column: 5, attribute: "ties", text: "TIES 10Ø@100/150", sourceKeys: ["DXF_HANDLE:A4"] },
    ]);
    expect(wire.sources, "the row's own keys, because its standing rests on them, and the chosen candidates'").toEqual([
      "DXF_HANDLE:A1",
      "DXF_HANDLE:A2",
      "DXF_HANDLE:A3",
      "DXF_HANDLE:A4",
    ]);
  });

  test("nothing is supplied where Jev supplied nothing: the no-match outcome, an unoffered id and a missing answer each read as no cell", () => {
    const question = scheduleCellArm.compose(taskOf());
    const noMatch = question.read({ row_is_header: { type: "noul", noul: 0.9 }, cell_2: { type: "choice", choice: "NOT_STATED" }, cell_5: { type: "choice", choice: "cand_9" } }) as {
      payload: { header: number | null; cells: unknown[] };
      sources: string[];
    };
    expect(noMatch.payload.cells, "a cell that states no attribute, and an id this arm never offered, are both no reading").toEqual([]);
    expect(noMatch.payload.header).toBe(0.9);
    expect(noMatch.sources, "the row's keys still stand: the row's own judgment was answered").toEqual([...CONTENT.row.sourceKeys]);

    const silent = question.read({}) as { payload: { header: number | null; cells: unknown[] } };
    expect(silent.payload, "an answer nobody gave is null and empty, never a guess").toEqual({ header: null, cells: [] });
  });

  test("a row with nothing contested, and a row citing no text, are thrown before a question is posted", () => {
    const empty: CellTask = { ...taskOf(), cells: [] };
    expect(() => scheduleCellArm.guard?.(empty)).toThrow(/carries no contested cell/);
    const uncited: CellTask = { ...taskOf(), row: { index: 3, texts: ["C-1"], sourceKeys: [] } };
    expect(() => scheduleCellArm.guard?.(uncited)).toThrow(/cites no text of the drawing/);
    expect(() => scheduleCellArm.guard?.(taskOf()), "the row this suite asks about is asked").not.toThrow();
  });
});
