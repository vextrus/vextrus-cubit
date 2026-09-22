// @vitest-environment node
/**
 * The contested-cell question as the product composes it, and the answer as the product reads it
 * back (R-TO-031, L-AI-01, L-AI-02).
 *
 * What is graded: that the request is a pure, total function of the stored table and row — the same
 * table makes the same hash forever, which is what lets a recorded answer be replayed in every lane;
 * that it names its question and pins the id AS-05 bills the reading under; that its content wears
 * exactly the four keys the adapter recognises this question by; and that the answer is read back
 * OUT of the caller's own closed roster, so an attribute nobody may state is refused rather than
 * stored.
 */
import { describe, expect, test } from "vitest";
import { MODEL_QUESTIONS, requestHash } from "@/core/model";
import { cellReadingCandidates, readCellReadingProposal, scheduleCellRequest, CELL_ATTRIBUTES, CELL_READING_MODEL, type CellReadingState } from "..";

/** One contested row, as `contestedRowsOf` answers one. */
function state(): CellReadingState {
  const stored = { rowIndex: 1, columnIndex: 2, text: "8-20%%C+TIES 10%%C@100/150", sourceKeys: ["DXF_HANDLE:A2", "DXF_HANDLE:A3"] };
  return {
    title: "COLUMN SCHEDULE",
    columns: [
      { index: 0, header: "MARK" },
      { index: 2, header: "" },
    ],
    row: { index: 1, texts: ["C-1", stored.text], sourceKeys: ["DXF_HANDLE:A0", "DXF_HANDLE:A2", "DXF_HANDLE:A3"] },
    cells: { "2": { columnIndex: 2, text: stored.text, header: "", candidates: cellReadingCandidates(stored) } },
  };
}

/** The canonical content the request carries — what the adapter recognises and the hash is taken over. */
function contentOf(): Record<string, unknown> {
  const message = scheduleCellRequest(state()).messages.find((held) => held.role === "user");
  return JSON.parse(String(message?.content)) as Record<string, unknown>;
}

describe("the contested row's request", () => {
  test("is a fact about the drawing: the same table and row make the same request, hash for hash", () => {
    expect(requestHash(scheduleCellRequest(state())), "the same evidence asked twice is one recorded answer, not two").toBe(requestHash(scheduleCellRequest(state())));
  });

  test("names the question the ledger files it under and the id AS-05 bills the reading under", () => {
    const request = scheduleCellRequest(state());
    expect(request.question).toBe(MODEL_QUESTIONS.scheduleCell);
    expect(request.modelId, "Jev is billed under the pinned Claude id until the owner's amendment lands").toBe(CELL_READING_MODEL);
    expect(CELL_READING_MODEL).toBe("claude-opus-5");
  });

  test("wears exactly the key set the adapter recognises this question by, and carries the cells under their own column indices", () => {
    const content = contentOf();
    expect(Object.keys(content).sort(), "the arm is recognised by the sorted key set of this content and by nothing else").toEqual(["cells", "columns", "row", "title"]);
    const cells = content["cells"] as Record<string, { candidates: { text: string }[] }>;
    expect(Object.keys(cells), "keyed by the column index, so an instruction can name `cells.2.candidates`").toEqual(["2"]);
    expect(cells["2"]?.candidates.map((one) => one.text), "every reading the grammar found, in the order it found them").toEqual([
      "8-20%%C",
      "TIES 10%%C@100/150",
      "TIES 10%%C@100/150",
      "TIES 10%%C@100/150",
    ]);
  });

  test("reads an answer back out of the caller's roster: an attribute nobody may state is no reading", () => {
    const read = readCellReadingProposal(CELL_ATTRIBUTES);
    const taken = read({ header: 0.02, cells: [{ column: 2, attribute: "main", text: "8-20%%C", sourceKeys: ["DXF_HANDLE:A2"] }] });
    expect(taken).toEqual({ ok: true, value: { header: 0.02, cells: [{ column: 2, attribute: "main", text: "8-20%%C", sourceKeys: ["DXF_HANDLE:A2"] }] } });

    const outside = read({ header: null, cells: [{ column: 2, attribute: "grade", text: "M25", sourceKeys: ["DXF_HANDLE:A2"] }] });
    expect(outside.ok, "a schedule cell states one of the seven and nothing else").toBe(false);
    expect(outside.ok === false && outside.detail).toContain("is no attribute a schedule cell can state");
  });

  test("refuses an answer that is not a reading at all, and never supplies what was not answered", () => {
    const read = readCellReadingProposal(CELL_ATTRIBUTES);
    expect(read({ header: null, cells: [] }), "a row the model read no attribute in is a reading, not a failure").toEqual({ ok: true, value: { header: null, cells: [] } });
    expect(read({ cells: [] }).ok, "a reading names the row's standing, even as null").toBe(false);
    expect(read({ header: "very likely", cells: [] }).ok, "a standing that is no probability is no standing").toBe(false);
    expect(read({ header: null, cells: [{ column: 2, attribute: "main", text: "8-20%%C", sourceKeys: [] }] }).ok, "a reading of words nobody wrote is not one").toBe(false);
    expect(read({ header: null, cells: [{ column: -1, attribute: "main", text: "8-20%%C", sourceKeys: ["DXF_HANDLE:A2"] }] }).ok, "a cell stands in a column of the table").toBe(false);
    expect(read("NOT_STATED").ok, "a reading is an object, not a word").toBe(false);
  });
});
