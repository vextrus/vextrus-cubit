/**
 * I-555 — what the Trace selects for an entity a row NAMES rather than a line cites: a sighting, a
 * queue item, a storey-height reading's note (`entitySelectionOf`).
 *
 * Asked over a hand-built record — one model space framed by one paper sheet, one placement read off
 * an outline and a mark — so what is judged is the reading alone: a placement opens on the sheet its
 * outline stands on and selects the outline and the mark, a source key selects itself, a key the
 * record does not hold selects nothing, and only keys that stand on the named sheet are ever selected.
 */
import { describe, expect, test } from "vitest";
import { placementKey } from "@/core/identity";
import type { RecordStanding } from "@/core/sheets/frames";
import { entitySelectionOf, type PinnedRecord } from "@/modules/takeoff/trace";

const VIEW = { viewClass: "LAYOUT_PLAN", captionAnchorSourceKey: "DXF_HANDLE:9A" } as const;
const PLACED = placementKey({ view: VIEW, mark: "C1", x: 0, y: 0 });
const INSTANCE_BARS = `${PLACED}#bars`;
const STRAY = placementKey({ view: VIEW, mark: "C9", x: 50, y: 50 });

const OUTLINE = "DXF_HANDLE:1A";
const MARK = "DXF_HANDLE:1B";
const NOTE = "DXF_HANDLE:2C";
const ELSEWHERE = "DXF_HANDLE:3D";

/** One model space (`Model`) shown on S-10 by one window, and a paper sheet S-25 with a note drawn on it. */
function record(): PinnedRecord {
  const standing: RecordStanding = {
    sheets: [
      { layoutName: "Model", kind: "model" },
      { layoutName: "S-10", kind: "paper" },
      { layoutName: "S-25", kind: "paper" },
    ],
    spaces: new Map([
      [OUTLINE, "Model"],
      [MARK, "Model"],
      [ELSEWHERE, "Model"],
      [NOTE, "S-25"],
      ["DXF_HANDLE:9A", "Model"],
    ]),
    frames: {
      windows: [{ layoutName: "S-10", model: [0, 0, 10, 10] }],
      standing: new Map<string, readonly [number, number]>([
        [OUTLINE, [1, 1]],
        [MARK, [2, 2]],
        [ELSEWHERE, [500, 500]],
        ["DXF_HANDLE:9A", [3, 3]],
      ]),
    },
    members: new Map([[PLACED, { outlineKey: OUTLINE, markKey: MARK }]]),
  };
  return { standing, labelOf: (layoutName) => layoutName, gridOf: () => null };
}

const RECORDS: ReadonlyMap<string, PinnedRecord> = new Map([["drawing-1", record()]]);

describe("I-555: the entity a row names, as the Trace selects it", () => {
  test("a placement opens on the sheet its outline stands on and selects the outline and the mark", () => {
    expect(entitySelectionOf(PLACED, RECORDS)).toEqual({ drawingId: "drawing-1", layoutName: "S-10", sourceKeys: [OUTLINE, MARK] });
  });

  test("an instance's bar set is the member again, through its schedule", () => {
    expect(entitySelectionOf(INSTANCE_BARS, RECORDS)?.sourceKeys).toEqual([OUTLINE, MARK]);
  });

  test("a source key selects itself on the sheet it is drawn on", () => {
    expect(entitySelectionOf(NOTE, RECORDS)).toEqual({ drawingId: "drawing-1", layoutName: "S-25", sourceKeys: [NOTE] });
  });

  test("a source key drawn in model space opens on the paper sheet whose window frames it", () => {
    expect(entitySelectionOf(OUTLINE, RECORDS)).toEqual({ drawingId: "drawing-1", layoutName: "S-10", sourceKeys: [OUTLINE] });
  });

  test("a sheet the caller names is kept, and a key that does not stand on it is not selected", () => {
    expect(entitySelectionOf(PLACED, RECORDS, { drawingId: "drawing-1", layoutName: "S-10" })?.layoutName).toBe("S-10");
    expect(entitySelectionOf(ELSEWHERE, RECORDS, { drawingId: "drawing-1", layoutName: "S-10" }), "drawn in model space where no window of S-10 frames it").toBeNull();
    expect(entitySelectionOf(NOTE, RECORDS, { drawingId: "drawing-1", layoutName: "S-10" }), "drawn on another paper sheet").toBeNull();
  });

  test("what the record does not hold selects nothing: an unplaced member, a view, an act, another drawing", () => {
    expect(entitySelectionOf(STRAY, RECORDS), "a placement nobody stored on this record").toBeNull();
    expect(entitySelectionOf("v:LAYOUT_PLAN:DXF_HANDLE:9A", RECORDS), "a view is a region, never flown to").toBeNull();
    expect(entitySelectionOf("act:5b0c", RECORDS), "an act stands on no sheet").toBeNull();
    expect(entitySelectionOf(NOTE, RECORDS, { drawingId: "drawing-2" }), "a drawing the records do not hold").toBeNull();
    expect(entitySelectionOf(NOTE, new Map()), "no record at all").toBeNull();
  });
});
