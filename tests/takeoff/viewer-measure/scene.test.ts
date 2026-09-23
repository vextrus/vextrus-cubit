/**
 * What the measure layer draws (s-measure § 2.3), judged as a value and as the calls a canvas is
 * handed: the ring in progress runs to the live point, a finished outline closes, a cut-out is knocked
 * out of the 12 % fill, a rectangle spans from its first corner, and each placed point wears its
 * basis glyph in its basis colour on a paper halo.
 */
import { describe, expect, test } from "vitest";
import { fitCamera } from "@/modules/takeoff/viewer/client";
import { BASIS_GLYPHS } from "@/ui/primitives/core/basis";
import { NO_DRAFT, type MeasureDraft, type MeasurePoint } from "@/modules/takeoff/viewer-measure/gesture";
import { drawMeasureScene, type MeasurePalette } from "@/modules/takeoff/viewer-measure/paint";
import { labelAt, measureScene } from "@/modules/takeoff/viewer-measure/scene";
import { S08_PIT, S08_SOG } from "./support/s08";

const camera = fitCamera({ min: [-1000, -401000], max: [22000, -383000] }, { width: 800, height: 600 });
const point = (at: readonly [number, number], basis: MeasurePoint["basis"] = "MEASURED"): MeasurePoint => ({ at, basis, sourceKeys: [] });
const draft = (o: Partial<MeasureDraft>): MeasureDraft => ({ ...NO_DRAFT, ...o });

describe("§2.3: the scene", () => {
  test("drawing: the outline is open, runs a live segment to the pointer, and fills through it", () => {
    const scene = measureScene({ tool: "area", rectangle: false, draft: draft({ phase: "drawing", outer: S08_SOG.slice(0, 3).map((at) => point(at)) }), live: S08_SOG[3] as readonly [number, number], camera });
    expect(scene.rings.map((ring) => [ring.points.length, ring.closed, ring.cutout])).toEqual([[3, false, false]]);
    expect(scene.live, "the live segment runs from the last point").not.toBeNull();
    expect(scene.fill?.ring, "the fill closes through the live point").toHaveLength(4);
  });

  test("a finished outline closes, and a closed cut-out is dashed and knocked out of the fill", () => {
    const scene = measureScene({ tool: "area", rectangle: false, draft: draft({ phase: "draft", outer: S08_SOG.map((at) => point(at)), cutouts: [S08_PIT.map((at) => point(at))] }), live: null, camera });
    expect(scene.rings.map((ring) => [ring.closed, ring.cutout])).toEqual([
      [true, false],
      [true, true],
    ]);
    expect([scene.fill?.ring.length, scene.fill?.holes.length, scene.live]).toEqual([5, 1, null]);
    expect(scene.points).toHaveLength(9);
  });

  test("Rectangle: one corner and the live point span four corners, closed, with no live segment", () => {
    const [a, , c] = S08_PIT as [readonly [number, number], readonly [number, number], readonly [number, number]];
    const scene = measureScene({ tool: "area", rectangle: true, draft: draft({ phase: "drawing", outer: [point(a)] }), live: c, camera });
    expect([scene.rings[0]?.points.length, scene.rings[0]?.closed, scene.live]).toEqual([4, true, null]);
  });

  test("Count draws its points and no ring; Linear letters each placed segment at its midpoint", () => {
    expect(measureScene({ tool: "count", rectangle: false, draft: draft({ phase: "drawing", outer: S08_PIT.map((at) => point(at)) }), live: null, camera }).rings).toEqual([]);
    const run = measureScene({ tool: "linear", rectangle: false, draft: draft({ phase: "draft", outer: S08_SOG.slice(0, 3).map((at) => point(at)) }), live: null, camera });
    expect(run.segments.map((segment) => [segment.from, segment.to])).toEqual([
      [S08_SOG[0], S08_SOG[1]],
      [S08_SOG[1], S08_SOG[2]],
    ]);
    expect(run.rings[0]?.closed, "a run never closes").toBe(false);
  });

  test("the running figure's label sits 12 px right of and below the live point, clamped inside the stage", () => {
    expect(labelAt({ x: 100, y: 100 }, { width: 80, height: 20 }, { width: 800, height: 600 }, 12)).toEqual({ x: 112, y: 112 });
    expect(labelAt({ x: 790, y: 595 }, { width: 80, height: 20 }, { width: 800, height: 600 }, 12)).toEqual({ x: 708, y: 568 });
  });
});

describe("§2.3: the paint", () => {
  test("the fill is even-odd at 12 %, and each point's glyph is its basis's own, in its basis's colour, over a paper halo", () => {
    const calls: string[] = [];
    const record = (name: string) => (...args: unknown[]) => void calls.push(`${name}(${args.map(String).join(",")})`);
    const state: Record<string, unknown> = {};
    const context = new Proxy(state, {
      get: (_target, property: string) => (property in state ? state[property] : record(property)),
      set: (_target, property: string, value: unknown) => {
        state[property] = value;
        if (property === "globalAlpha" || property === "fillStyle") calls.push(`${property}=${String(value)}`);
        return true;
      },
    }) as unknown as CanvasRenderingContext2D;
    const palette: MeasurePalette = {
      measure: "measure",
      paper: "paper",
      basis: { MEASURED: "teal", ENTERED: "amber", INTERPRETED: "magenta" },
      glyphs: BASIS_GLYPHS,
      font: "mono",
      glyphPx: 10,
      labelPx: 12,
    };
    const scene = measureScene({ tool: "area", rectangle: false, draft: draft({ phase: "draft", outer: [point(S08_SOG[0] as readonly [number, number]), point(S08_SOG[1] as readonly [number, number], "ENTERED"), point(S08_SOG[2] as readonly [number, number])] }), live: null, camera });
    drawMeasureScene(context, scene, palette, { width: 800, height: 600 });
    expect(calls).toContain("globalAlpha=0.12");
    expect(calls).toContain("fill(evenodd)");
    const glyphs = calls.filter((call) => call.startsWith("fillText(")).map((call) => call.slice(9, 10));
    expect(glyphs, "each placed point's basis glyph (R-UI-002)").toEqual([BASIS_GLYPHS.MEASURED, BASIS_GLYPHS.ENTERED, BASIS_GLYPHS.MEASURED]);
    expect(calls.filter((call) => call.startsWith("fillStyle=")).slice(-3)).toEqual(["fillStyle=teal", "fillStyle=amber", "fillStyle=teal"]);
  });
});
