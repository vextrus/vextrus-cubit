/**
 * I-345 — a sheet in motion is drawn from its settled frame, and only where that frame shows the
 * reader exactly what a full frame would, resampled; the sheet is drawn in full again once the
 * camera has held still for the settle.
 *
 * PB-3 was never met at the size a reader sees: at 1080 × 756 under the perf lane's software GL a full
 * frame of the PERF-011 sheet costs ~48 ms, ~39 of them lettering. The rule that holds 60 fps is the
 * one this suite pins: the conditions under which a kept frame may stand for a moving camera
 * (`settledFrameServes`), the LOD cut those conditions compare (`letteredFrom`), and the two clocks —
 * the settle the sheet is restored on is the settle the address is written on, and the frame loop
 * outlives it, so the frame a gesture ends on is always a full one.
 *
 * Every expectation is derived from the product's own constants and cameras (B-19): a margin, a
 * resample limit or a legibility floor moved at source moves the cases with it.
 */
import { describe, expect, test } from "vitest";
import {
  GESTURE_SETTLE_MS,
  LETTERED_TEXT_PX,
  SETTLED_MARGIN,
  SETTLED_RESAMPLE_MAX,
  isTextLettered,
  letteredFrom,
  panCamera,
  settledFrameServes,
  viewBoxOf,
  zoomCameraAt,
  type SettledFrame,
  type WorldBox,
} from "../../../src/modules/takeoff/viewer/client";
import { ADDRESS_SETTLE_MS } from "../../../src/modules/takeoff/viewer/hooks/use-camera";
import { GESTURE_TAIL_MS } from "../../../src/modules/takeoff/viewer/painter";
import type { Camera } from "../../../src/modules/takeoff/viewer/types";

/** A stage the size PERF-011's sheet is read at, and a camera fitted over a 1000 × 700 sheet in it. */
const STAGE = { width: 1080, height: 756 };
const AT: Camera = { centre: [500, 350], scale: 0.9936, viewport: STAGE };

/** The frame a painter keeps at a camera: its view, `SETTLED_MARGIN` wider on every side. */
function settledAt(camera: Camera): SettledFrame {
  const wider: Camera = {
    ...camera,
    viewport: { width: camera.viewport.width * (1 + 2 * SETTLED_MARGIN), height: camera.viewport.height * (1 + 2 * SETTLED_MARGIN) },
  };
  return { at: camera, holds: viewBoxOf(wider) };
}

/** The LOD cut the painter drew before this suite: the first height, walking up, that is legible. */
function walkedCut(heights: readonly number[], scale: number): number {
  let at = 0;
  while (at < heights.length && !isTextLettered(heights[at] ?? 0, scale)) at += 1;
  return at;
}

/** A sheet's content box that lies wholly inside the fitted view — what a fitted sheet is. */
const INSIDE: WorldBox = [0, 0, 1000, 700];

describe("I-345: the LOD cut is a search, and it cuts where the walk did", () => {
  test("I-345: letteredFrom answers the index the painter's old walk answered, for every scale that moves the cut", () => {
    const ladder = [0.1, 0.25, 0.5, 1, 2.5, 5, 10, 25, 50, 100];
    // Every scale at which some rung crosses the floor, and one either side of it.
    const scales = ladder.flatMap((height) => [LETTERED_TEXT_PX / height, (LETTERED_TEXT_PX / height) * 0.999, (LETTERED_TEXT_PX / height) * 1.001]);
    for (const scale of [...scales, 1e-9, 1e9, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(letteredFrom(ladder, scale), `the cut at scale ${scale}`).toBe(walkedCut(ladder, scale));
    }
    expect(letteredFrom([], 1), "an unlettered layer cuts at nothing").toBe(0);
    expect(letteredFrom([3, 3, 3, 9, 9], LETTERED_TEXT_PX / 9), "a run of equal heights cuts before the first of them").toBe(3);
  });
});

describe("I-345: a settled frame stands for a moving camera only where it shows what a full frame would", () => {
  const frame = settledAt(AT);

  test("I-345: it stands for the camera it was drawn at, and for a pan that keeps the sheet inside what it holds", () => {
    expect(settledFrameServes(frame, AT, INSIDE, []), "the camera it was drawn at").toBe(true);
    const marginPx = STAGE.width * SETTLED_MARGIN;
    expect(settledFrameServes(frame, panCamera(AT, marginPx * 0.9, 0), INSIDE, []), "a pan inside the margin").toBe(true);
  });

  test("I-345: it never stands where the view would reach geometry it does not hold — that would hide what is there", () => {
    // A sheet wider than the frame holds: its right edge beyond the margin.
    const wide: WorldBox = [0, 0, frame.holds[2] + 200, 700];
    const past = panCamera(AT, STAGE.width, 0);
    expect(settledFrameServes(frame, past, wide, []), "a pan past the margin onto more of the sheet").toBe(false);
    // The same pan over a sheet that ends inside the frame shows only paper past its edge — as a
    // full frame would.
    expect(settledFrameServes(frame, past, INSIDE, []), "a pan past the margin onto bare paper").toBe(true);
    expect(settledFrameServes(frame, past, null, []), "a sheet with nothing drawn").toBe(true);
  });

  test("I-345: it is resampled by at most SETTLED_RESAMPLE_MAX, either way", () => {
    const centre = { x: STAGE.width / 2, y: STAGE.height / 2 };
    expect(settledFrameServes(frame, zoomCameraAt(AT, SETTLED_RESAMPLE_MAX, centre), INSIDE, []), "in to the limit").toBe(true);
    expect(settledFrameServes(frame, zoomCameraAt(AT, 1 / SETTLED_RESAMPLE_MAX, centre), INSIDE, []), "out to the limit").toBe(true);
    expect(settledFrameServes(frame, zoomCameraAt(AT, SETTLED_RESAMPLE_MAX * 1.001, centre), INSIDE, []), "in past the limit").toBe(false);
    expect(settledFrameServes(frame, zoomCameraAt(AT, 1 / (SETTLED_RESAMPLE_MAX * 1.001), centre), INSIDE, []), "out past the limit").toBe(false);
  });

  test("I-345: a zoom out to the resample limit about the centre stays inside the frame's own margin", () => {
    // So the margin, not the sheet, is what a zoom out spends: the frame holds (1 + 2m) views.
    expect(1 + 2 * SETTLED_MARGIN).toBeGreaterThanOrEqual(SETTLED_RESAMPLE_MAX);
    const out = zoomCameraAt(AT, 1 / SETTLED_RESAMPLE_MAX, { x: STAGE.width / 2, y: STAGE.height / 2 });
    const view = viewBoxOf(out);
    const everywhere: WorldBox = [-1e6, -1e6, 1e6, 1e6];
    expect(view[0] >= frame.holds[0] && view[2] <= frame.holds[2], "the view is inside what the frame holds").toBe(true);
    expect(settledFrameServes(frame, out, everywhere, []), "even over a sheet that fills the world").toBe(true);
  });

  test("I-345: it never stands once a zoom moves any drawn layer's LOD cut — no text appears or vanishes late", () => {
    // A rung that crosses the floor inside the resample limit: legible at the frame's scale, not
    // after a zoom out of a tenth.
    const crossing = (LETTERED_TEXT_PX / AT.scale) * 1.05;
    const ladder = [crossing];
    const centre = { x: STAGE.width / 2, y: STAGE.height / 2 };
    const out = zoomCameraAt(AT, 1 / 1.1, centre);
    expect(isTextLettered(crossing, AT.scale), "the rung is lettered in the frame").toBe(true);
    expect(isTextLettered(crossing, out.scale), "and would not be lettered after the zoom").toBe(false);
    expect(settledFrameServes(frame, out, INSIDE, []), "the zoom alone is inside the limit").toBe(true);
    expect(settledFrameServes(frame, out, INSIDE, [ladder]), "the cut moved, so a full frame is owed").toBe(false);
    // A layer whose cut does not move lets it stand.
    expect(settledFrameServes(frame, out, INSIDE, [[1000]]), "a cut that holds").toBe(true);
  });

  test("I-345: it never stands for a stage of another size", () => {
    const resized: Camera = { ...AT, viewport: { width: STAGE.width - 1, height: STAGE.height } };
    expect(settledFrameServes(frame, resized, INSIDE, [])).toBe(false);
  });
});

describe("I-345: one settle, and the loop outlives it", () => {
  test("I-345: the sheet is drawn in full on the settle the address is written on", () => {
    expect(ADDRESS_SETTLE_MS, "the address and the sheet settle together").toBe(GESTURE_SETTLE_MS);
  });

  test("I-345: the frame loop runs past the settle, so the frame a gesture ends on is a full frame", () => {
    expect(GESTURE_TAIL_MS).toBeGreaterThan(GESTURE_SETTLE_MS);
  });
});
