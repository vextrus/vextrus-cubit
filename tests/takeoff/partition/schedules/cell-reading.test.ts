/**
 * R-TO-031's contested cells: which cells of a reconstructed schedule the deterministic path leaves
 * open, and what the notation grammar could read each of them as (L-CAD-08, L-AI-03).
 *
 * CODE finds every candidate and a model only ever SELECTS one, so what is graded here is the whole
 * of what a model could ever answer: the coverage check the design owes. (a) Every candidate cites
 * words of its own cell and nothing else. (b) For each of the three traps the BNBC set draws —
 * T-SCHED-TWO-TEXTS (two texts stacked in one cell), T-SCHED-MERGED (a band header over sectionless
 * lines) and T-SCHED-NORULES (an un-ruled table whose columns are headed with nothing) — the reading
 * a reader would take stands AMONG the candidates offered, because a model cannot choose a value the
 * code omitted. (c) A cell nothing can be read in offers no candidate and is therefore never asked:
 * a question whose only answer is the no-match outcome is a question nobody can answer. (d) A cell
 * the grammar and the column headers already settle is not contested at all — no request, no ledger
 * row, no cost (L-AI-03 asks the deterministic reading first).
 *
 * The tables are drawn HERE at the shapes the BNBC sheets draw them in, never read out of a fixture:
 * what is graded is a table shaped this way, and a fixture is not a test's input (B-19). Nothing
 * here opens a database, a model or a clock.
 */
import { describe, expect, test } from "vitest";
import { cellReadingCandidates, columnsOfTable, contestedRowsOf } from "@/modules/takeoff/partition/schedules/cell-reading";
import type { ScheduleCell, ScheduleTable } from "@/modules/takeoff/partition/schedules/reconstruct";

/** One cell as the reconstructor stores one: where it stands, what it says, what it was read from. */
function cell(rowIndex: number, columnIndex: number, text: string, keys: readonly string[]): ScheduleCell {
  return { rowIndex, columnIndex, text, sourceKeys: [...keys] };
}

/** One table as the reconstructor answers one. The pitch and the x's play no part in this reading. */
function table(title: string, cells: readonly ScheduleCell[]): ScheduleTable {
  const columns = [...new Set(cells.map((held) => held.columnIndex))].sort((left, right) => left - right);
  return { viewKey: "DXF_HANDLE:V1", scheduleKey: "DXF_HANDLE:CAP", title, pitch: 2600, columns, cells: [...cells], unplaced: [] };
}

/**
 * S-11's COLUMN SCHEDULE, the shape T-SCHED-MERGED and T-SCHED-TWO-TEXTS are drawn in: a mark
 * column, a band header over a column of sections, and a column whose cells carry the bars and the
 * ties as two stacked texts joined by the notation's own sign.
 */
function columnSchedule(): ScheduleTable {
  return table("COLUMN SCHEDULE", [
    cell(0, 0, "MARK", ["DXF_HANDLE:H0"]),
    cell(0, 1, "GF TO 2ND", ["DXF_HANDLE:H1"]),
    cell(0, 2, "", []),
    cell(1, 0, "C-1", ["DXF_HANDLE:A0"]),
    cell(1, 1, "300X450", ["DXF_HANDLE:A1"]),
    cell(1, 2, "8-20%%C+TIES 10%%C@100/150", ["DXF_HANDLE:A2", "DXF_HANDLE:A3"]),
    cell(2, 0, "C-2", ["DXF_HANDLE:B0"]),
    cell(2, 1, "375X375", ["DXF_HANDLE:B1"]),
    cell(2, 2, "6-16%%C+TIES 10%%C@150", ["DXF_HANDLE:B2", "DXF_HANDLE:B3"]),
  ]);
}

/**
 * S-06's PILE CAP SCHEDULE, the shape T-SCHED-NORULES is drawn in: no rules, no column headings at
 * all, a size in one column, a level in another and a remark in a third.
 */
function pileCapSchedule(): ScheduleTable {
  return table("PILE CAP SCHEDULE", [
    cell(0, 0, "MARK", ["DXF_HANDLE:P0"]),
    cell(0, 1, "", []),
    cell(0, 2, "", []),
    cell(0, 3, "", []),
    cell(1, 0, "PC-3", ["DXF_HANDLE:C0"]),
    cell(1, 1, "2500X2500", ["DXF_HANDLE:C1"]),
    cell(1, 2, "GF TO 3RD", ["DXF_HANDLE:C2"]),
    cell(1, 3, "SEE DETAIL 3/S-03", ["DXF_HANDLE:C3"]),
  ]);
}

describe("the cells of a schedule a model is put to", () => {
  test("every candidate cites words of its own cell and of nothing else", () => {
    for (const held of [columnSchedule(), pileCapSchedule()]) {
      for (const stored of held.cells) {
        for (const candidate of cellReadingCandidates(stored)) {
          expect(candidate.sourceKeys.length, `${candidate.id} of "${stored.text}" cites the words it was read from`).toBeGreaterThan(0);
          for (const key of candidate.sourceKeys) {
            expect(stored.sourceKeys, `${candidate.id} of "${stored.text}" cites ${key}, which that cell was not read from`).toContain(key);
          }
          expect(stored.text, `${candidate.id} is a span of its own cell's words`).toContain(candidate.text);
        }
      }
    }
  });

  test("T-SCHED-TWO-TEXTS: the bars and the ties a draughtsman stacked in one cell are both offered, each citing its own text", () => {
    const stored = cell(1, 2, "8-20%%C+TIES 10%%C@100/150", ["DXF_HANDLE:A2", "DXF_HANDLE:A3"]);
    const candidates = cellReadingCandidates(stored);
    const bars = candidates.find((one) => one.text === "8-20%%C");
    const ties = candidates.filter((one) => one.text === "TIES 10%%C@100/150");

    expect(bars?.attribute, "the first text states the main reinforcement").toBe("main");
    expect(bars?.sourceKeys, "and cites the one text it was written as").toEqual(["DXF_HANDLE:A2"]);
    expect(
      ties.map((one) => one.attribute),
      "the second states the ties, and — because it states two centres — the end zone and the middle as well",
    ).toEqual(["ties", "ties-end", "ties-mid"]);
    expect(ties[0]?.sourceKeys).toEqual(["DXF_HANDLE:A3"]);
    expect(
      candidates.some((one) => one.text === stored.text),
      "the whole cell states two things, so it is offered as neither: a reading is of the words it names",
    ).toBe(false);
  });

  test("T-SCHED-MERGED and T-SCHED-NORULES: the section a schedule writes as a pair is offered, though the grammar reads no kind in it", () => {
    const merged = cellReadingCandidates(cell(1, 1, "300X450", ["DXF_HANDLE:A1"]));
    expect(merged.map((one) => ({ attribute: one.attribute, text: one.text, sourceKeys: one.sourceKeys }))).toEqual([
      { attribute: "section", text: "300X450", sourceKeys: ["DXF_HANDLE:A1"] },
    ]);
    const norules = cellReadingCandidates(cell(1, 1, "2500X2500", ["DXF_HANDLE:C1"]));
    expect(norules.map((one) => one.attribute), "an un-ruled pile-cap table states its size the same way").toEqual(["section"]);
  });

  test("a cell nothing can be read in offers no candidate, and is therefore never asked", () => {
    expect(cellReadingCandidates(cell(1, 3, "PROVIDE AS PER DRAWING", ["DXF_HANDLE:C9"])), "words a schedule carries for a reader state no attribute").toEqual([]);
    expect(cellReadingCandidates(cell(1, 3, "SEE DETAIL 3/S-03", ["DXF_HANDLE:C3"])), "a cross-reference points at a sheet and states nothing about the member").toEqual([]);
  });

  test("the deterministic path's own cells are not contested: an un-ruled table the columns resolve asks nothing", () => {
    // PC-3's mark is read by its headed column, the table takes the column its sizes stand in as its
    // sections and the column its bands stand in as its levels, and the remark in the fourth states
    // nothing — so the row carries no question a model could answer, and none is put (L-AI-03).
    expect(contestedRowsOf(pileCapSchedule())).toEqual([]);
  });

  test("a row whose every cell the grammar and the headers settle asks nothing at all", () => {
    const settled = table("BEAM SCHEDULE", [
      cell(0, 0, "MARK", ["DXF_HANDLE:H0"]),
      cell(0, 1, "TIES", ["DXF_HANDLE:H1"]),
      cell(1, 0, "GB-1", ["DXF_HANDLE:D0"]),
      cell(1, 1, "10%%C@150", ["DXF_HANDLE:D1"]),
    ]);
    expect(contestedRowsOf(settled), "a headed column whose cell the grammar reads is no question for a model").toEqual([]);
  });

  test("a contested row is asked as one state: the table's title, its columns, the row's own texts and the cells left open", () => {
    const asked = contestedRowsOf(columnSchedule());
    expect(asked.map((state) => state.row.index), "one state per contested row, in row order").toEqual([1, 2]);
    const state = asked[0]!;
    expect(state.title).toBe("COLUMN SCHEDULE");
    expect(state.columns).toEqual(columnsOfTable(columnSchedule()));
    expect(state.row.texts, "the row is shown whole, in column order").toEqual(["C-1", "300X450", "8-20%%C+TIES 10%%C@100/150"]);
    expect(state.row.sourceKeys, "and cites every text it was read from, once each").toEqual(["DXF_HANDLE:A0", "DXF_HANDLE:A1", "DXF_HANDLE:A2", "DXF_HANDLE:A3"]);
    // T-SCHED-MERGED: the band header stands over lines that state sections, so what the cell under
    // it states is open — and the stacked cell beside it is open for its own reason. The mark column
    // is headed MARK and reads as a mark, so it is nobody's question but the grammar's.
    expect(Object.keys(state.cells)).toEqual(["1", "2"]);
    expect(state.cells["1"]?.header, "the column the section stands under is headed with a band of floors").toBe("GF TO 2ND");
    expect(state.cells["1"]?.candidates.map((one) => one.attribute)).toEqual(["section"]);
    expect(state.cells["2"]?.header, "a cell headed with nothing says so, rather than borrowing a neighbour's heading").toBe("");
  });
});
