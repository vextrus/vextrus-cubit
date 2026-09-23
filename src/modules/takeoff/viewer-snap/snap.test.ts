// Which view's affirmed scale measures a segment, where the sheet's views nest or overlap (I-146,
// L-MEA-05) — and, on a paper sheet, through which window (s-measure I-501).
import { describe, expect, it } from "vitest";
import { metresBetween, modelUnitsPerSheetUnit, sheetMeasuring, viewMeasuring } from "./snap";
import type { SnapCalibration, SnapCalibrationView, SnapFactorSpace, SnapPoint, SnapWindow } from "./types";

/** One calibrated view of a sheet, at the extent a case draws it over. */
function view(viewKey: string, min: SnapPoint, max: SnapPoint, space: SnapFactorSpace = "model"): SnapCalibrationView {
  return { viewKey, box: { min, max }, factorX: "0.001000000000", factorY: "0.001000000000", space };
}

/** The sheet, as the calibration door answers one — model space, with no window. */
function sheet(...views: readonly SnapCalibrationView[]): SnapCalibration {
  return { ingestId: "33333333-3333-4333-8333-333333333333", views, windows: [] };
}

/** A window on paper at 1:100, as S-08's viewport 2077 is (view height 34000 over a 340 frame). */
function window(via: string, min: SnapPoint, max: SnapPoint): SnapWindow {
  return { via, frame: { min, max }, viewHeight: "34000", frameHeight: "340" };
}

/** A paper sheet: its views' boxes and its windows' frames, both in paper coordinates. */
function paper(views: readonly SnapCalibrationView[], windows: readonly SnapWindow[]): SnapCalibration {
  return { ingestId: "33333333-3333-4333-8333-333333333333", views, windows };
}

const A: SnapPoint = [10, 10];
const B: SnapPoint = [20, 20];

describe("viewMeasuring", () => {
  it("measures by the innermost view holding both picks, whatever order the store answers in", () => {
    const plan = view("PLAN", [0, 0], [100, 100]);
    const detail = view("INSET", [5, 5], [40, 40]);
    expect(viewMeasuring(sheet(plan, detail), A, B)?.viewKey, "the detail drawn inside the plan is the view these picks were drawn in").toBe("INSET");
    expect(viewMeasuring(sheet(detail, plan), A, B)?.viewKey, "and the answer is the drawing's, not the store's order").toBe("INSET");
  });

  it("answers none where two views hold the picks and neither is drawn inside the other", () => {
    const left = view("LEFT", [0, 0], [30, 30]);
    const right = view("RIGHT", [5, 5], [60, 60]);
    expect(viewMeasuring(sheet(left, right), A, B), "overlapping views are two scales over one segment, and neither is the one it was drawn at").toBeNull();
    expect(viewMeasuring(sheet(left, view("SAME", [0, 0], [30, 30])), A, B), "two views of one extent say the same thing about where, and nothing about which").toBeNull();
  });

  it("answers none where no affirmed view holds both picks", () => {
    const one = view("ONE", [0, 0], [15, 15]);
    expect(viewMeasuring(sheet(one), A, B), "a segment leaving the view is measured in the drawing's own units").toBeNull();
    expect(viewMeasuring(sheet(), A, B), "a sheet no act has affirmed measures nothing").toBeNull();
    expect(viewMeasuring(null, A, B), "and neither does a sheet with no calibration read at all").toBeNull();
  });
});

describe("sheetMeasuring (s-measure I-501): a model-space factor carries paper coordinates only through the one window they stand in", () => {
  const plan = view("PLAN", [0, 0], [100, 100]);
  const P: SnapPoint = [10, 10];
  const Q: SnapPoint = [13, 14];

  it("on model space the view's factor carries the sheet's own coordinates, through no window", () => {
    const answered = sheetMeasuring(sheet(plan), P, Q);
    expect([answered.kind, answered.view?.viewKey, answered.through]).toEqual(["measured", "PLAN", null]);
    expect(metresBetween(P, Q, plan), "5 units at 0.001 m per unit").toBe("0.005");
  });

  it("on paper the one window both points stand in carries them, by its view height over its frame's height", () => {
    const only = window("2077", [0, 0], [100, 100]);
    const answered = sheetMeasuring(paper([plan], [only]), P, Q);
    expect([answered.kind, answered.through?.via]).toEqual(["measured", "2077"]);
    expect(modelUnitsPerSheetUnit(only).toString(), "34000 / 340: one paper unit is a hundred model units at 1:100").toBe("100");
    expect(metresBetween(P, Q, { ...plan, through: answered.through }), "5 paper units are 500 model units, 0.5 m — never 0.005 m").toBe("0.500");
  });

  it("points in two windows, or outside every window, carry no metres: two windows are two scales, and bare paper shows none", () => {
    const left = window("LEFT", [0, 0], [11, 100]);
    const right = window("RIGHT", [12, 0], [100, 100]);
    expect(sheetMeasuring(paper([plan], [left, right]), P, Q).kind, "P stands in LEFT and Q in RIGHT").toBe("windowed");
    expect(sheetMeasuring(paper([plan], [window("SMALL", [0, 0], [12, 12])]), P, Q).kind, "Q stands on paper outside the only window").toBe("windowed");
    expect(sheetMeasuring(paper([plan], [window("A", [0, 0], [50, 50]), window("B", [5, 5], [60, 60])]), P, Q).kind, "two overlapping windows both hold them, and neither says which scale").toBe("windowed");
  });

  it("a QS two-point factor, whose sheet the store does not record, is carried through no window — and on model space as it always was", () => {
    const twoPoint = view("PLAN", [0, 0], [100, 100], "unrecorded");
    expect(sheetMeasuring(paper([twoPoint], [window("2077", [0, 0], [100, 100])]), P, Q).kind).toBe("unrecorded");
    expect(sheetMeasuring(sheet(twoPoint), P, Q).kind).toBe("measured");
  });

  it("no view holding both points is no scale, on paper as on model space", () => {
    expect(sheetMeasuring(paper([view("ONE", [0, 0], [11, 11])], [window("2077", [0, 0], [100, 100])]), P, Q).kind).toBe("uncalibrated");
    expect(sheetMeasuring(null, P, Q).kind).toBe("uncalibrated");
  });
});
