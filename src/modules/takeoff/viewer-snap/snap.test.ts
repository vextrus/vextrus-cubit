// Which view's affirmed scale measures a segment, where the sheet's views nest or overlap (I-146,
// L-MEA-05).
import { describe, expect, it } from "vitest";
import { viewMeasuring } from "./snap";
import type { SnapCalibration, SnapCalibrationView, SnapPoint } from "./types";

/** One calibrated view of a sheet, at the extent a case draws it over. */
function view(viewKey: string, min: SnapPoint, max: SnapPoint): SnapCalibrationView {
  return { viewKey, box: { min, max }, factorX: "0.001000000000", factorY: "0.001000000000" };
}

/** The sheet, as the calibration door answers one. */
function sheet(...views: readonly SnapCalibrationView[]): SnapCalibration {
  return { ingestId: "33333333-3333-4333-8333-333333333333", views };
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
