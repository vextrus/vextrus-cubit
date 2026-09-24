/**
 * s-coverage I-613, the pure half: the measurement boundary's fourth enumeration names every
 * pair a plan draws as a beam and no mark names, each under the one registered reason, in the
 * certificate's order — and never counts them (L-QTY-04, L-QTY-07). The screen that prints it is
 * graded in tests/takeoff/coverage/unnamed-pairs-statement.test.tsx.
 */
import { describe, expect, test } from "vitest";
import { unnamedStatementOf, type UnnamedPair } from "@/core/residue";

const pair = (over: Partial<UnnamedPair>): UnnamedPair => ({
  drawingId: "drawing-1",
  viewKey: "v:LAYOUT_PLAN:DXF_HANDLE:2073",
  caption: "GRADE BEAM LAYOUT & GF SLAB ON GRADE  SCALE 1:100",
  layoutName: "S-12",
  edgeKeys: ["DXF_HANDLE:7BA", "DXF_HANDLE:7BB"],
  width: "300.0",
  gridLetter: "B",
  gridNumeral: "1",
  ...over,
});

/** Three pairs on two sheets, handed out of order. */
const PAIRS: readonly UnnamedPair[] = [
  pair({ viewKey: "v:LAYOUT_PLAN:DXF_HANDLE:F31", caption: "TYPICAL FLOOR BEAM LAYOUT", layoutName: "S-14", edgeKeys: ["DXF_HANDLE:EEE", "DXF_HANDLE:EEF"], width: "250.0", gridLetter: "A", gridNumeral: "5" }),
  pair({ edgeKeys: ["DXF_HANDLE:7C8", "DXF_HANDLE:7C9"], gridLetter: "A", gridNumeral: "1" }),
  pair({}),
];

describe("I-613: the unnamed pairs, enumerated", () => {
  test("each pair under FRAMED_PAIR_UNNAMED, in the certificate's order: sheet, caption, grid reference, edge line", () => {
    const rows = unnamedStatementOf(PAIRS);
    expect(rows.map((row) => `${row.layoutName} ${row.gridLetter ?? ""}${row.gridNumeral ?? ""} ${row.edgeKeys[0]}`)).toEqual([
      "S-12 A1 DXF_HANDLE:7C8",
      "S-12 B1 DXF_HANDLE:7BA",
      "S-14 A5 DXF_HANDLE:EEE",
    ]);
    expect(new Set(rows.map((row) => row.code)), "the one registered reason (Q-07)").toEqual(new Set(["FRAMED_PAIR_UNNAMED"]));
  });

  test("nothing unnamed is an empty enumeration, never a row saying so", () => {
    expect(unnamedStatementOf([])).toEqual([]);
  });
});
