/**
 * PB-3 — what one mark costs per frame, and what that cost buys.
 *
 * `gl.lineWidth` is a no-op on ANGLE, so a mark's 2 px stroke (R-UI-012) is laid down as the same
 * 1-device-pixel run drawn at several offsets — one `gl.drawArrays` over the whole mark buffer each,
 * every frame of a pan, for the hover mark and the selection mark alike, with a selection that may
 * hold the entire sheet. The offsets are therefore a budget, and this pins it on the two ratios the
 * painter can be driven at (its store is capped at twice the layout): the count, and the stroke the
 * count buys — a round stroke of the width the reading asks for, laid down in steps no wider than
 * the device pixel a run is drawn at, since a wider step is the striping the offsets exist to avoid.
 *
 * Nothing here is transcribed from a run: the stroke's width comes from the painter's own step count
 * at ratio 1, the block it is measured against is that count squared, and the thickness is measured
 * by projecting the offsets onto every direction a segment can run in.
 */
import { describe, expect, test } from "vitest";
import { productModule } from "./support/viewer-support";

/** The painter's home, and the two seams the mark pass is measured through. */
const PAINTER_MODULE = "src/modules/takeoff/viewer/painter.ts";

type PainterSeam = {
  markSteps: (extentPx: number, layoutPx: number) => number;
  markOffsets: (acrossSteps: number, downSteps: number) => readonly (readonly [number, number])[];
};

/** A canvas wide enough that a ratio is a clean multiple of its layout size. */
const LAYOUT_PX = 800;

/** The ratios the painter can be driven at: unaccelerated, and its own HiDPI cap. */
const RATIOS = [1, 2] as const;

/** The budget at the cap: the offsets inside the stroke's disc, where the square block holds 16. */
const CALLS_AT_CAP = 12;

/** Directions a segment can run in, in degrees — a half turn covers them all for a line. */
const DIRECTIONS = 180;

const painter = (): Promise<PainterSeam> => productModule<PainterSeam>(PAINTER_MODULE);

/** Where the offsets fall when projected onto one direction, sorted — the stroke seen edge on. */
function projections(offsets: readonly (readonly [number, number])[], degrees: number): number[] {
  const radians = (degrees * Math.PI) / 180;
  const [alongX, alongY] = [Math.cos(radians), Math.sin(radians)];
  return offsets.map(([across, down]) => across * alongX + down * alongY).sort((first, second) => first - second);
}

describe("PB-3 — the mark pass draws a round stroke at a bounded number of calls", () => {
  test("the offsets are inside the step block, and cost fewer calls than it on a HiDPI store", async () => {
    const { markSteps, markOffsets } = await painter();
    const strokePx = markSteps(LAYOUT_PX, LAYOUT_PX);
    expect(strokePx, "the stroke is at least a pixel wide at ratio 1").toBeGreaterThanOrEqual(1);

    for (const ratio of RATIOS) {
      const steps = markSteps(LAYOUT_PX * ratio, LAYOUT_PX);
      expect(steps, `a ${strokePx} px stroke is ${strokePx * ratio} device pixels at ratio ${ratio}`).toBe(strokePx * ratio);

      const offsets = markOffsets(steps, steps);
      for (const [across, down] of offsets) {
        expect(across, "an offset is a step of the block").toBeGreaterThanOrEqual(0);
        expect(across).toBeLessThan(steps);
        expect(down).toBeGreaterThanOrEqual(0);
        expect(down).toBeLessThan(steps);
      }
      expect(new Set(offsets.map(([across, down]) => `${across},${down}`)).size, "no offset is drawn twice").toBe(offsets.length);
      expect(offsets.length, `ratio ${ratio} draws no more than its block`).toBeLessThanOrEqual(steps * steps);
    }

    const atOne = markOffsets(markSteps(LAYOUT_PX, LAYOUT_PX), markSteps(LAYOUT_PX, LAYOUT_PX));
    expect(atOne.length, "an unaccelerated store pays what it always paid").toBe(strokePx * strokePx);

    const cap = markSteps(LAYOUT_PX * 2, LAYOUT_PX);
    expect(markOffsets(cap, cap).length, "the HiDPI store pays the disc, not the block").toBeLessThanOrEqual(CALLS_AT_CAP);
    expect(markOffsets(cap, cap).length, "and that is fewer calls than the block").toBeLessThan(cap * cap);
  });

  test("in every direction the runs step by at most a device pixel and make the stroke's width", async () => {
    const { markSteps, markOffsets } = await painter();
    for (const ratio of RATIOS) {
      const steps = markSteps(LAYOUT_PX * ratio, LAYOUT_PX);
      const offsets = markOffsets(steps, steps);
      for (let degrees = 0; degrees < DIRECTIONS; degrees += 1) {
        const seen = projections(offsets, degrees);
        const widest = seen.slice(1).reduce((worst, at, index) => Math.max(worst, at - seen[index]!), 0);
        expect(widest, `direction ${degrees}° at ratio ${ratio} leaves no unpainted row`).toBeLessThanOrEqual(1);
        // Each run is itself a device pixel wide, so the stroke is the span of the offsets plus one.
        const thickness = seen[seen.length - 1]! - seen[0]! + 1;
        expect(thickness, `direction ${degrees}° at ratio ${ratio} is the stroke, within half a pixel`).toBeGreaterThanOrEqual(steps - 0.5);
        expect(thickness).toBeLessThanOrEqual(steps + 0.5);
      }
    }
  });
});
