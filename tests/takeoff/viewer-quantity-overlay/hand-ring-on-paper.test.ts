/**
 * A hand ring on the paper sheet it was traced on (s-measure I-666, walk-2 BD-2): S-08 is a
 * paper sheet, so its ring was stated in model space (I-620), and the overlay filed it under "model · 1"
 * rather than painting it where the QS traced it. The ring paints through the one window whose model
 * box holds it, by the projection the viewer drew the sheet by — `paper = centre + (model − viewCentre) × scale`.
 */
import { describe, expect, test } from "vitest";
import { ringsOnPaper, type PaperWindow } from "@/modules/takeoff/viewer-quantity-overlay/scene";

// A 1:100 window: model [0, 0]–[10 000, 5 000] shown at [200, 150] on the paper, 100 by 50.
const PLAN: PaperWindow = { model: [0, 0, 10_000, 5_000], centre: [200, 150], viewCentre: [5_000, 2_500], scale: 0.01 };
const DETAIL: PaperWindow = { model: [20_000, 0, 22_000, 2_000], centre: [400, 150], viewCentre: [21_000, 1_000], scale: 0.02 };

const SLAB = [
  [1_000, 1_000],
  [9_000, 1_000],
  [9_000, 4_000],
  [1_000, 4_000],
] as const;
const PIT = [
  [2_000, 2_000],
  [3_000, 2_000],
  [3_000, 3_000],
] as const;

describe("I-666: a hand ring paints on the paper sheet whose window holds it", () => {
  test("every ring through the window that holds the outer ring, onto the paper", () => {
    expect(ringsOnPaper([SLAB, PIT], [DETAIL, PLAN])).toEqual([
      [
        [160, 135],
        [240, 135],
        [240, 165],
        [160, 165],
      ],
      [
        [170, 145],
        [180, 145],
        [180, 155],
      ],
    ]);
  });

  test("a ring no one window holds whole is not shown on this sheet; nor is an empty one", () => {
    expect(ringsOnPaper([[...SLAB, [15_000, 1_000]]], [PLAN, DETAIL])).toBeNull();
    expect(ringsOnPaper([SLAB], [])).toBeNull();
    expect(ringsOnPaper([], [PLAN])).toBeNull();
  });
});
