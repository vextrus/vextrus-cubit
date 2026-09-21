/**
 * A paper sheet shows model space through its viewports (R-UI-040, L-CAD-05).
 *
 * The committed `viewports` artifact draws model space in two regions and one sheet with three
 * windows: one switched on over region A at 1:50, one switched off over region B, one twisted over
 * region A. The manifest of that sheet must carry region A's entities moved and scaled into the
 * on-window's frame, clipped to it, each naming the model entity as `src` and the window as `via`;
 * nothing of region B, nothing through the twisted window, and the sheet's own paint untouched.
 * Every expectation below is derived from the artifact's own records and inventory, never
 * transcribed from a run (B-19).
 */
import { describe, expect, test } from "vitest";
import { committedGraph, drawnRecordsOf, identityOf, viewerSeam } from "./support/viewer-support";
import { clipPolyline, projectRecord, windowOf, type Window } from "../../../src/modules/takeoff/viewer/projection";
import type { RenderManifest, RenderRecord } from "../../../src/modules/takeoff/viewer/types";

const SHEET = "SHEET";
const MODEL = "model";

function inventoryOf(name: string) {
  const graph = committedGraph("viewports");
  const layout = graph.layouts.find((each) => each.name === name);
  expect(layout, `the artifact inventories ${name}`).toBeDefined();
  return { graph, layout: layout! };
}

function projectedOf(manifest: RenderManifest): RenderRecord[] {
  return manifest.layers.flatMap((layer) => layer.records.filter((record) => record.via !== undefined));
}

function within(frame: readonly [number, number, number, number], point: readonly [number, number], slack = 1e-6): boolean {
  return point[0] >= frame[0] - slack && point[0] <= frame[2] + slack && point[1] >= frame[1] - slack && point[1] <= frame[3] + slack;
}

describe("the sheet shows model space through its windows", () => {
  test("the inventory carries the three windows and not the paper's own viewport", () => {
    const { layout } = inventoryOf(SHEET);
    const viewports = layout.viewports ?? [];
    expect(viewports.map((each) => [each.on, each.twist])).toEqual([
      [true, 0],
      [false, 0],
      [true, 30],
    ]);
    expect(inventoryOf(MODEL).layout.viewports, "model space opens no windows").toEqual([]);
  });

  test("region A is projected into the on-window at the window's own scale, named by src and via", async () => {
    const { buildRenderManifest } = await viewerSeam();
    const { graph, layout } = inventoryOf(SHEET);
    const manifest = buildRenderManifest(graph, SHEET) as RenderManifest;
    const on = (layout.viewports ?? []).find((each) => each.on && each.twist === 0)!;
    const window = windowOf(on);
    const scale = on.size[1] / on.view_height;
    expect(scale, "400 x 200 mm over 10 m is 1:50").toBeCloseTo(1 / 50, 12);

    const projected = projectedOf(manifest);
    expect(projected.length).toBeGreaterThan(0);
    for (const record of projected) {
      expect(record.via, "every projected piece names the window that showed it").toBe(on.handle);
      expect(record.key, "a projected piece is not an atom of the sheet").toBeUndefined();
      expect(record.src, "a projected piece names the model entity it shows").toMatch(/^DXF_HANDLE:[0-9A-F]+$/);
      for (const point of [...(record.points ?? []), ...(record.anchor === undefined ? [] : [record.anchor])]) {
        expect(within(window.paper, point), `${record.src} at ${String(point)} lies inside the window's frame`).toBe(true);
      }
    }

    // The set of model entities shown is exactly the set whose box meets the window's model box.
    const modelRecords = drawnRecordsOf(graph).filter((record) => record.space === MODEL);
    const framed = new Set(
      modelRecords
        .filter((record) => {
          const points = record.points ?? [];
          if (points.length === 0) return false;
          const xs = points.map((point) => point[0]);
          const ys = points.map((point) => point[1]);
          const [minX, minY, maxX, maxY] = window.model;
          return Math.min(...xs) <= maxX && Math.max(...xs) >= minX && Math.min(...ys) <= maxY && Math.max(...ys) >= minY;
        })
        .map(identityOf),
    );
    expect(new Set(projected.map((record) => record.src))).toEqual(framed);
    expect([...framed].length, "region A frames more than one entity and region B none").toBeGreaterThan(3);

    // Text keeps its copy, its height scaled to paper, its anchor moved.
    const caption = modelRecords.find((record) => record.text === "C1 400x400")!;
    const shown = projected.find((record) => record.text === "C1 400x400")!;
    expect(shown.height).toBeCloseTo((caption.height ?? 0) * scale, 9);
    const anchor = caption.points?.[0] as [number, number];
    expect(shown.anchor?.[0]).toBeCloseTo(on.centre[0] + (anchor[0] - on.view_centre[0]) * scale, 9);
    expect(shown.anchor?.[1]).toBeCloseTo(on.centre[1] + (anchor[1] - on.view_centre[1]) * scale, 9);
  });

  test("the line that crosses out of the frame is clipped to it, and a whole outline keeps its closure", async () => {
    const { buildRenderManifest } = await viewerSeam();
    const { graph, layout } = inventoryOf(SHEET);
    const on = (layout.viewports ?? []).find((each) => each.on && each.twist === 0)!;
    const window = windowOf(on);
    const projected = projectedOf(buildRenderManifest(graph, SHEET) as RenderManifest);

    const crossing = drawnRecordsOf(graph).find((record) => record.space === MODEL && record.type === "LINE" && (record.points?.[0]?.[0] ?? 0) < 0)!;
    const piece = projected.find((record) => record.src === identityOf(crossing))!;
    expect(piece.points?.length).toBe(2);
    expect(piece.points?.[0]?.[0]).toBeCloseTo(window.paper[0], 9);
    expect(piece.points?.[1]?.[0]).toBeCloseTo(window.paper[2], 9);

    const frame = drawnRecordsOf(graph).find((record) => record.space === MODEL && record.closed === true && (record.points?.length ?? 0) === 4 && (record.points?.[1]?.[0] ?? 0) === 20000)!;
    const shownFrame = projected.find((record) => record.src === identityOf(frame))!;
    expect(shownFrame.closed, "an outline the window frames whole keeps its closure").toBe(true);
    expect(shownFrame.points?.length).toBe(4);
  });

  test("region B and the twisted window show nothing; the sheet's own paint is unchanged", async () => {
    const { buildRenderManifest } = await viewerSeam();
    const { graph, layout } = inventoryOf(SHEET);
    const manifest = buildRenderManifest(graph, SHEET) as RenderManifest;
    const vias = new Set(projectedOf(manifest).map((record) => record.via));
    const off = (layout.viewports ?? []).find((each) => !each.on)!;
    const twisted = (layout.viewports ?? []).find((each) => each.twist !== 0)!;
    expect(vias.has(off.handle), "a window switched off shows nothing").toBe(false);
    expect(vias.has(twisted.handle), "a twisted window is not projected").toBe(false);
    expect(projectedOf(manifest).some((record) => record.text === "REGION B")).toBe(false);

    const own = manifest.layers.flatMap((layer) => layer.records.filter((record) => record.via === undefined));
    const sheetRecords = drawnRecordsOf(graph).filter((record) => record.space === SHEET);
    expect(own.map(identityOf).sort()).toEqual(sheetRecords.map(identityOf).sort());
    for (const layer of manifest.layers) expect(layer.entityCount).toBe(layer.records.length);
    expect(manifest.extents, "the extents are the sheet's own, as the inventory states them").toEqual(layout.bbox);
  });

  test("the model sheet projects nothing through anything", async () => {
    const { buildRenderManifest } = await viewerSeam();
    const { graph } = inventoryOf(MODEL);
    expect(projectedOf(buildRenderManifest(graph, MODEL) as RenderManifest)).toEqual([]);
  });
});

describe("clipping", () => {
  const box = [0, 0, 10, 10] as const;

  test("a polyline cut once by the box is the run inside it", () => {
    expect(clipPolyline([[-5, 5], [5, 5], [15, 5]], false, box)).toEqual([[[0, 5], [5, 5], [10, 5]]]);
  });

  test("a polyline that leaves and returns is two runs", () => {
    const runs = clipPolyline([[2, 2], [2, 20], [8, 20], [8, 2]], false, box);
    expect(runs).toEqual([[[2, 2], [2, 10]], [[8, 10], [8, 2]]]);
  });

  test("a ring cut once is one open piece joined across its start vertex", () => {
    const runs = clipPolyline([[5, 5], [15, 5], [15, 8], [5, 8]], true, box);
    expect(runs.length).toBe(1);
    expect(runs[0]).toEqual([[10, 8], [5, 8], [5, 5], [10, 5]]);
  });

  test("a segment wholly outside contributes nothing", () => {
    expect(clipPolyline([[20, 20], [30, 30]], false, box)).toEqual([]);
  });

  test("a record whose box misses the window is not projected, whatever its layer", () => {
    const window: Window = windowOf({ handle: "A", on: true, centre: [100, 100], size: [10, 10], view_centre: [0, 0], view_height: 10, twist: 0, clipped: false });
    expect(projectRecord({ key: "DXF_HANDLE:1", type: "LINE", rgb: [1, 2, 3], points: [[50, 50], [60, 60]] }, window)).toEqual([]);
    expect(projectRecord({ key: "DXF_HANDLE:2", type: "LINE", rgb: [1, 2, 3], points: [[-1, 0], [1, 0]] }, window)).toEqual([
      { src: "DXF_HANDLE:2", via: "A", type: "LINE", rgb: [1, 2, 3], points: [[99, 100], [101, 100]] },
    ]);
  });
});
