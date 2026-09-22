/**
 * A contested schedule row read by TypeSafe Jev System One, end to end through the seam's one public
 * path (L-AI-01, L-AI-02, L-AI-03): `createModelSeam` over an environment holding a TypeSafe key and
 * a fetch the test hands in, `proposeCellReading` over a table reconstructed the way the BNBC set
 * draws one, and a memory ledger.
 *
 * What is graded: that Jev's choices become a Proposal citing exactly the words it read and no
 * others; that a no-match answer supplies NOTHING and is the CALLER's to decide about, never the
 * seam's; that a citation the artifact does not carry is SOURCE_UNRESOLVED rather than a stored
 * reading; that every call is a ledger row attributed to the tenant; and that a row with nothing
 * contested reaches no network at all. AI proposes, code resolves, a human disposes.
 */
import { describe, expect, test, vi } from "vitest";
import { refusalCodeOf } from "@/core/faults/refusal-marker";
import { createModelSeam, sourceKeyResolver } from "@/core/model";
import { CELL_ATTRIBUTES, cellReadingCandidates, contestedRowsOf, proposeCellReading, type CellReadingState } from "@/modules/takeoff/partition/schedules/cell-reading";
import type { ScheduleCell, ScheduleTable } from "@/modules/takeoff/partition/schedules/reconstruct";
import { contextFor, memoryLedger, rejectionOf, rowsOf } from "./support/understanding-stage";

const TENANT = "d3e00000-0000-4000-8000-000000000011";
const PROJECT = "d3e00000-0000-4000-8000-000000000012";
const DIGEST = "sha256:rcc6-bnbc";

function cell(rowIndex: number, columnIndex: number, text: string, keys: readonly string[]): ScheduleCell {
  return { rowIndex, columnIndex, text, sourceKeys: [...keys] };
}

/** S-11's COLUMN SCHEDULE as the reconstructor answers it: T-SCHED-TWO-TEXTS in the third column. */
function columnSchedule(): ScheduleTable {
  const cells = [
    cell(0, 0, "MARK", ["DXF_HANDLE:H0"]),
    cell(0, 1, "GF TO 2ND", ["DXF_HANDLE:H1"]),
    cell(0, 2, "", []),
    cell(1, 0, "C-1", ["DXF_HANDLE:A0"]),
    cell(1, 1, "300X450", ["DXF_HANDLE:A1"]),
    cell(1, 2, "8-20%%C+TIES 10%%C@100/150", ["DXF_HANDLE:A2", "DXF_HANDLE:A3"]),
  ];
  return { viewKey: "DXF_HANDLE:V1", scheduleKey: "DXF_HANDLE:CAP", title: "COLUMN SCHEDULE", pitch: 2600, columns: [0, 1, 2], cells, unplaced: [] };
}

/** The one contested row of that table, as the partition would put it. */
function contestedRow(): CellReadingState {
  const [state] = contestedRowsOf(columnSchedule());
  expect(state, "the band header stands over a section and the third cell holds two texts: the row is contested").toBeDefined();
  return state as CellReadingState;
}

/** The artifact a citation resolves against: every key this drawing's texts were minted under. */
function artifact(keys: readonly string[] = ["DXF_HANDLE:A0", "DXF_HANDLE:A1", "DXF_HANDLE:A2", "DXF_HANDLE:A3"]) {
  return sourceKeyResolver(DIGEST, keys);
}

type JevAnswer = { model: string; answers: Record<string, unknown>; usage: { input_tokens: number; output_tokens: number } };

/** Jev, as a fetch: records what it was asked and answers what the test names. */
function jevAnswering(answers: Record<string, unknown>) {
  const asked: Record<string, unknown>[] = [];
  const fetch = vi.fn<typeof globalThis.fetch>(async (_input, init) => {
    asked.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
    const body: JevAnswer = { model: "jev-latest", answers, usage: { input_tokens: 420, output_tokens: 0 } };
    return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
  });
  return { fetch, asked };
}

function seamOver(fetch: typeof globalThis.fetch) {
  const { ledger, record } = memoryLedger();
  const seam = createModelSeam({ env: { TYPESAFE_API_KEY: "test-key", NODE_ENV: "production" }, fetch, ledger });
  return { seam, record };
}

describe("a contested schedule row read by Jev, through the seam", () => {
  const ctx = contextFor(TENANT, PROJECT, "user:qs");

  test("Jev's choices become a Proposal citing exactly the words it read, over the live transport", async () => {
    const { fetch, asked } = jevAnswering({
      row_is_header: { type: "noul", noul: 0.03 },
      cell_1: { type: "choice", choice: "cand_1", confidence: 0.9 },
      cell_2: { type: "choice", choice: "cand_1", confidence: 0.8 },
    });
    const { seam, record } = seamOver(fetch);

    const proposal = await proposeCellReading(ctx, { state: contestedRow(), attributes: CELL_ATTRIBUTES, artifact: artifact() }, { propose: seam.propose });

    expect(proposal.payload.header, "the row's standing is the noul's own probability, carried as it was stated").toBe(0.03);
    expect(proposal.payload.cells).toEqual([
      { column: 1, attribute: "section", text: "300X450", sourceKeys: ["DXF_HANDLE:A1"] },
      { column: 2, attribute: "main", text: "8-20%%C", sourceKeys: ["DXF_HANDLE:A2"] },
    ]);
    expect(proposal.sources, "the row's own keys, because its standing rests on them, and the chosen candidates'").toEqual([
      "DXF_HANDLE:A0",
      "DXF_HANDLE:A1",
      "DXF_HANDLE:A2",
      "DXF_HANDLE:A3",
    ]);
    expect(proposal.model, "the ledger's pinned id is the one the request carried").toBe("claude-opus-5");
    expect(proposal.callId).toBeTruthy();

    expect(asked, "one request was posted, carrying the row's whole question set").toHaveLength(1);
    const questions = asked[0]?.["questions"] as Record<string, { type: string; criteria: Record<string, string> }>;
    expect(Object.keys(questions).sort()).toEqual(["cell_1", "cell_2", "row_is_header"]);
    expect(Object.keys(questions["cell_2"]!.criteria), "the grammar's readings of the stacked cell, and the answer for a cell that states none").toEqual([
      "cand_1",
      "cand_2",
      "cand_3",
      "cand_4",
      "NOT_STATED",
    ]);
    expect(rowsOf(record)[0]).toMatchObject({ tenantId: TENANT, projectId: PROJECT, transport: "live", outcome: "proposed", question: "schedule-cell", inputTokens: 420 });
  });

  test("a cell Jev read nothing in supplies nothing, and the proposal still stands for the caller to decide about", async () => {
    const { fetch } = jevAnswering({ row_is_header: { type: "noul", noul: 0.88 }, cell_1: { type: "choice", choice: "NOT_STATED" }, cell_2: { type: "choice", choice: "NOT_STATED" } });
    const { seam, record } = seamOver(fetch);

    const proposal = await proposeCellReading(ctx, { state: contestedRow(), attributes: CELL_ATTRIBUTES, artifact: artifact() }, { propose: seam.propose });

    expect(proposal.payload.cells, "nothing is supplied where Jev supplied nothing (L-AI-02)").toEqual([]);
    expect(proposal.payload.header, "what it DID answer stands: this row reads as a heading band").toBe(0.88);
    expect(proposal.sources, "the row's texts are the evidence that judgment rests on").toEqual(["DXF_HANDLE:A0", "DXF_HANDLE:A1", "DXF_HANDLE:A2", "DXF_HANDLE:A3"]);
    expect(rowsOf(record)[0]).toMatchObject({ outcome: "proposed" });
  });

  test("a citation the artifact does not carry is SOURCE_UNRESOLVED, never a stored reading", async () => {
    const { fetch } = jevAnswering({ row_is_header: { type: "noul", noul: 0.03 }, cell_2: { type: "choice", choice: "cand_1" } });
    const { seam, record } = seamOver(fetch);

    const rejection = await rejectionOf(
      proposeCellReading(ctx, { state: contestedRow(), attributes: CELL_ATTRIBUTES, artifact: artifact(["DXF_HANDLE:ZZ"]) }, { propose: seam.propose }),
    );

    expect(refusalCodeOf(rejection)).toBe("SOURCE_UNRESOLVED");
    expect(rowsOf(record)[0], "a refusal is a ledger row too — the tokens were spent").toMatchObject({ outcome: "refused", refusalCode: "SOURCE_UNRESOLVED" });
  });

  test("an attribute outside the caller's closed roster is MALFORMED — the roster is the takeoff module's, not the wire's", async () => {
    const { fetch } = jevAnswering({ row_is_header: { type: "noul", noul: 0.03 }, cell_1: { type: "choice", choice: "cand_1" } });
    const { seam } = seamOver(fetch);
    const narrowed = ["main"] as const;

    const rejection = await rejectionOf(proposeCellReading(ctx, { state: contestedRow(), attributes: narrowed, artifact: artifact() }, { propose: seam.propose }));

    expect(refusalCodeOf(rejection), "a caller that will accept only the bars refuses a section rather than storing one").toBe("MALFORMED");
  });

  test("a row with nothing contested is refused before anything is posted: no question, no network", async () => {
    const { fetch } = jevAnswering({});
    const { seam, record } = seamOver(fetch);
    const settled: CellReadingState = { ...contestedRow(), cells: {} };

    const rejection = await rejectionOf(proposeCellReading(ctx, { state: settled, attributes: CELL_ATTRIBUTES, artifact: artifact() }, { propose: seam.propose }));

    // The arm throws, naming the fault, and the seam records it as one: a caller that composed a
    // question Jev has nothing to choose about is at fault, and a fault is not a refusal (B-14).
    expect(refusalCodeOf(rejection), "there is no refusal code for a question nobody should have composed").toBeNull();
    expect(String((rejection as Error).message)).toContain("was not answered");
    expect(fetch, "nothing was asked, so nothing was spent").not.toHaveBeenCalled();
    expect(rowsOf(record), "a fault is not a call: the ledger holds no row for a question nobody posted").toEqual([]);
  });

  test("the candidates a cell is asked about are the code's own: a model can only choose among readings the grammar found", async () => {
    const stacked = cell(1, 2, "8-20%%C+TIES 10%%C@100/150", ["DXF_HANDLE:A2", "DXF_HANDLE:A3"]);
    const state = contestedRow();
    expect(state.cells["2"]?.candidates, "the request carries exactly what the pure reader found in that cell").toEqual(cellReadingCandidates(stacked));
    for (const candidate of state.cells["2"]?.candidates ?? []) {
      expect(CELL_ATTRIBUTES, `${candidate.id} states one of the seven the module's law closes on`).toContain(candidate.attribute);
    }
  });
});
