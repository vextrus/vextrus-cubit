/**
 * The sheet a hand line is filed under (s-measure I-666, walk-2 BD-2): a ring traced on S-08 —
 * a paper sheet — is stated in model space (I-620), and its view's caption stands where no one sheet's
 * window shows it, so the view alone filed the line under model space ("model · 1" in the legend, the
 * Source column's sheet). The ring itself says the sheet, by the one window that holds it. Pure over
 * a record's standing.
 */
import { describe, expect, test } from "vitest";
import { sheetShowing, traceCitations, type RecordStanding } from "@/core/sheets/frames";

const WINDOWS = [
  { layoutName: "S-08 GRADE BEAM", model: [0, 0, 100, 100] as const },
  { layoutName: "S-10 COLUMN", model: [200, 0, 300, 100] as const },
  { layoutName: "S-11 BOTH", model: [0, 0, 300, 100] as const },
];

const STANDING: RecordStanding = {
  sheets: [
    { layoutName: "model", kind: "model" },
    { layoutName: "S-08 GRADE BEAM", kind: "paper" },
    { layoutName: "S-10 COLUMN", kind: "paper" },
  ],
  // The caption the view is anchored by stands in model space outside every window.
  spaces: new Map([["DXF_HANDLE:CAP", "model"]]),
  frames: { windows: [WINDOWS[0], WINDOWS[1]] as never, standing: new Map([["DXF_HANDLE:CAP", [500, 500] as const]]) },
  members: new Map(),
};

const RING = [
  [10, 10],
  [90, 10],
  [90, 90],
  [10, 90],
] as const;

describe("I-666: a hand ring files its line under the sheet it was traced on", () => {
  test("the one sheet whose windows hold every point of the ring", () => {
    expect(sheetShowing(RING, STANDING.frames)).toBe("S-08 GRADE BEAM");
  });

  test("a ring no window holds whole, or windows of two sheets hold, names no sheet", () => {
    expect(sheetShowing([...RING, [250, 50]], STANDING.frames)).toBeNull();
    expect(sheetShowing(RING, { ...STANDING.frames, windows: WINDOWS as never })).toBeNull();
    expect(sheetShowing([], STANDING.frames)).toBeNull();
  });

  test("the Trace of a hand line opens on S-08, where its view alone said model space", () => {
    const cited = { viewKey: "v:LAYOUT_PLAN:DXF_HANDLE:CAP", sources: ["act:66666666-6666-4666-8666-666666666666"] };
    expect(traceCitations(cited, STANDING).layoutName, "without the ring: the view's anchor stands on no one sheet").toBe("model");
    expect(traceCitations({ ...cited, points: RING }, STANDING).layoutName).toBe("S-08 GRADE BEAM");
  });

  test("a view that names its own sheet keeps it: the ring only speaks where the view says model space", () => {
    const standing: RecordStanding = { ...STANDING, spaces: new Map([["DXF_HANDLE:CAP", "S-10 COLUMN"]]) };
    expect(traceCitations({ viewKey: "v:LAYOUT_PLAN:DXF_HANDLE:CAP", sources: [], points: RING }, standing).layoutName).toBe("S-10 COLUMN");
  });
});
