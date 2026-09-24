/**
 * Where the card stands (docs/design/s-measure.md § 2.5, I-618): on the side of the closing point with
 * room — right, then left, below, above — clamped inside the stage, never over the point, with a
 * hairline to the point when the card's nearest corner stands more than 24 px from it. Pure.
 */
import { describe, expect, test } from "vitest";
import { cardAt, closingPointOf, modelPointOf } from "@/modules/takeoff/viewer-measure/scene";
import { NO_DRAFT, type MeasureDraft } from "@/modules/takeoff/viewer-measure/gesture";

const CARD = { width: 320, height: 440 };
const STAGE = { width: 1192, height: 804 };
const INSET = 12;

const covers = (at: { x: number; y: number }, point: { x: number; y: number }): boolean => point.x >= at.x && point.x <= at.x + CARD.width && point.y >= at.y && point.y <= at.y + CARD.height;

describe("§ 2.5: the card's place at the closing point", () => {
  test("with room on the right it stands to the right, its corner 12 px off the point on each axis", () => {
    const place = cardAt({ x: 300, y: 200 }, CARD, STAGE, INSET);
    expect(place.side).toBe("right");
    expect(place.at).toEqual({ x: 312, y: 188 });
    expect(covers(place.at, { x: 300, y: 200 })).toBe(false);
  });

  test("near the right edge it takes the left", () => {
    const place = cardAt({ x: 1100, y: 400 }, CARD, STAGE, INSET);
    expect(place.side).toBe("left");
    expect(place.at.x + CARD.width).toBe(1088);
  });

  test("with no room either side it goes below, then above; it is clamped inside the stage and never covers the point", () => {
    const narrow = { width: 500, height: 1200 };
    const below = cardAt({ x: 250, y: 100 }, CARD, narrow, INSET);
    expect(below.side).toBe("below");
    expect(covers(below.at, { x: 250, y: 100 })).toBe(false);
    const above = cardAt({ x: 250, y: 1100 }, CARD, narrow, INSET);
    expect(above.side).toBe("above");
    expect(above.at.y + CARD.height).toBeLessThanOrEqual(1100);
  });

  test("a leader joins the nearest corner to the point only past 24 px", () => {
    // Against the point, the nearest corner is 17 px off: no leader.
    expect(cardAt({ x: 300, y: 200 }, CARD, STAGE, INSET).leader).toBeNull();
    // A stage too narrow for a side pushes the card along the edge, away from the point: the hairline says whose it is.
    const pushed = cardAt({ x: 250, y: 100 }, CARD, { width: 500, height: 1200 }, INSET);
    expect(pushed.leader).toEqual({ from: { x: 168, y: 112 }, to: { x: 250, y: 100 } });
  });

  test("the closing point is the last point placed on the outline, or none", () => {
    expect(closingPointOf(NO_DRAFT)).toBeNull();
    const draft: MeasureDraft = { ...NO_DRAFT, phase: "closed", outer: [{ at: [0, 0], basis: "MEASURED", sourceKeys: [] }, { at: [5, 1], basis: "ENTERED", sourceKeys: [] }] };
    expect(closingPointOf(draft)).toEqual([5, 1]);
  });
});

describe("I-620: a point on a paper sheet is stated in model space, carried back through its window", () => {
  const window = { paper: [100, 100, 300, 200] as const, centre: [200, 150] as const, viewCentre: [5000, -390000] as const, scale: 0.01 };

  test("the inverse of the viewer's projection: paper = centre + (model − viewCentre) × scale", () => {
    const [x, y] = modelPointOf([window], [250, 120]);
    expect(x).toBeCloseTo(10000, 6);
    expect(y).toBeCloseTo(-393000, 6);
  });

  test("a point in no window is returned as placed: the act refuses it by name (I-375)", () => {
    expect(modelPointOf([window], [50, 50])).toEqual([50, 50]);
    expect(modelPointOf([], [250, 120])).toEqual([250, 120]);
  });
});
