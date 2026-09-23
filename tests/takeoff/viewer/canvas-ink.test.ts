/**
 * I-79 — CAD colour 7 paints in the canvas ink, and the rule has ONE home.
 *
 * The painter resolved colour 7 by a rule of its own, so the layers panel's swatch — which shows the
 * same layer's colour beside the canvas — had no rule to read: in the light theme eight of S-10's
 * thirteen swatches were white on the near-white panel while the canvas drew those layers in ink
 * (craft finding, B-viewer). `isCanvasInk` is that rule, exported where both can read it; this suite
 * fixes its edges, and the painter reads nothing else (`painter.ts` imports it).
 */
import { describe, expect, test } from "vitest";
import { isCanvasInk } from "../../../src/modules/takeoff/viewer/client";

describe("I-79: white and black resolve to the canvas ink, every other colour paints as itself", () => {
  test("I-79: all channels at or above 250 — white as the reading resolved it — is ink", () => {
    expect(isCanvasInk([255, 255, 255]), "pure white").toBe(true);
    expect(isCanvasInk([250, 250, 250]), "the near-white floor itself").toBe(true);
    expect(isCanvasInk([250, 250, 249]), "one channel under the floor is a colour of its own").toBe(false);
  });

  test("I-79: all channels at or below 5 — black as the reading resolved it — is ink", () => {
    expect(isCanvasInk([0, 0, 0]), "pure black").toBe(true);
    expect(isCanvasInk([5, 5, 5]), "the near-black ceiling itself").toBe(true);
    expect(isCanvasInk([5, 5, 6]), "one channel over the ceiling is a colour of its own").toBe(false);
  });

  test("I-79: a colour the drawing chose paints exactly as the artifact resolved it", () => {
    expect(isCanvasInk([255, 0, 0]), "colour 1, red").toBe(false);
    expect(isCanvasInk([128, 128, 128]), "colour 8, grey").toBe(false);
    expect(isCanvasInk([255, 255, 0]), "colour 2, yellow — two white channels are not white").toBe(false);
  });
});
