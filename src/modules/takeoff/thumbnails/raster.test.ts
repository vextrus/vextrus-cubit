/**
 * I-359 — a paper sheet's thumbnail is a picture of the sheet AS IT PLOTS: its own paint, and what its
 * windows show of model space, moved and clipped by the viewer's own projection (R-SPINE-022, L-CAD-05,
 * s-drawings I-87 / I-323.8).
 *
 * Read over the committed `viewports` artifact, whose one paper sheet opens three windows onto model
 * space: one switched on, one switched off, one twisted. Every expectation is derived from that
 * artifact's own inventory — the frames the windows stand in, the sheet's extent — and from the
 * decoded pixels, never from a hash of today's bytes (B-19): the raster of the sheet without its
 * windows is the baseline the projection is judged against.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { inflateSync } from "node:zlib";
import { describe, expect, test } from "vitest";
import type { EntityGraph } from "@/core/entitygraph/schema";
import { projectable, windowOf, type Box } from "../viewer/projection";
import { renderSheet } from "./raster";

const SHEET = "SHEET";
const MODEL = "model";
/** The tier a sheet card is drawn from, and the pen it draws with there (two pixels). */
const THUMB = 256;
/** A stroke's width and a rasteriser's rounding, in pixels: what a frame is widened by when judged. */
const SLACK = 3;

function committedGraph(name: string): EntityGraph {
  return JSON.parse(readFileSync(join(process.cwd(), "cad", "tests", "fixtures", `${name}.entitygraph.json`), "utf8")) as EntityGraph;
}

/** The same graph with one layout's windows taken away — the sheet as it rendered before I-359. */
function withoutWindows(graph: EntityGraph, layoutName: string): EntityGraph {
  return { ...graph, layouts: graph.layouts.map((layout) => (layout.name === layoutName ? { ...layout, viewports: [] } : layout)) };
}

/** An 8-bit RGB PNG of the one shape `./png` writes (filter byte zero per scanline), decoded. */
function pixelsOf(png: Uint8Array): { width: number; height: number; rgb: Uint8Array } {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  let at = 8;
  let width = 0;
  let height = 0;
  const idat: Uint8Array[] = [];
  while (at < png.length) {
    const length = view.getUint32(at);
    const type = String.fromCharCode(...png.subarray(at + 4, at + 8));
    const data = png.subarray(at + 8, at + 8 + length);
    if (type === "IHDR") {
      width = new DataView(data.buffer, data.byteOffset).getUint32(0);
      height = new DataView(data.buffer, data.byteOffset).getUint32(4);
    }
    if (type === "IDAT") idat.push(data);
    at += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * 3;
  const rgb = new Uint8Array(stride * height);
  for (let row = 0; row < height; row += 1) {
    expect(raw[row * (stride + 1)], "every scanline is filtered None").toBe(0);
    rgb.set(raw.subarray(row * (stride + 1) + 1, (row + 1) * (stride + 1)), row * stride);
  }
  return { width, height, rgb };
}

/** Every inked pixel (anything that is not the white paper), as `column,row`. */
function inkOf(png: Uint8Array): { width: number; height: number; ink: Set<string> } {
  const { width, height, rgb } = pixelsOf(png);
  const ink = new Set<string>();
  for (let row = 0; row < height; row += 1) {
    for (let column = 0; column < width; column += 1) {
      const at = (row * width + column) * 3;
      if (rgb[at] !== 255 || rgb[at + 1] !== 255 || rgb[at + 2] !== 255) ink.add(`${column},${row}`);
    }
  }
  return { width, height, ink };
}

/** A paper box as the pixels it covers on a canvas fitted to `extent` at `longEdge`, widened by SLACK. */
function pixelBox(box: Box, extent: { min: readonly number[]; max: readonly number[] }, longEdge: number): Box {
  const minX = extent.min[0] as number;
  const minY = extent.min[1] as number;
  const maxY = extent.max[1] as number;
  const scale = longEdge / Math.max((extent.max[0] as number) - minX, maxY - minY);
  return [(box[0] - minX) * scale - SLACK, (maxY - box[3]) * scale - SLACK, (box[2] - minX) * scale + SLACK, (maxY - box[1]) * scale + SLACK];
}

function inside(box: Box, pixel: string): boolean {
  const [column, row] = pixel.split(",").map(Number) as [number, number];
  return column >= box[0] && column <= box[2] && row >= box[1] && row <= box[3];
}

describe("I-359: a paper sheet's thumbnail shows model space through its windows", () => {
  const graph = committedGraph("viewports");
  const layout = graph.layouts.find((each) => each.name === SHEET);
  const extent = layout?.bbox ?? null;

  test("the premise, asked of the corpus: one sheet, one window switched on and untwisted, two that are not", () => {
    expect(layout?.kind, "the artifact carries the paper sheet").toBe("paper");
    expect(extent, "with an extent of its own").not.toBeNull();
    const viewports = layout?.viewports ?? [];
    expect(viewports.filter(projectable).length, "exactly one of its windows is one a plot shows").toBe(1);
    expect(viewports.length, "and two it does not").toBe(3);
  });

  test("the on-window's piece of model space is drawn, inside its frame and nowhere else", () => {
    const shown = inkOf(renderSheet(graph, SHEET, THUMB).png);
    const paintOnly = inkOf(renderSheet(withoutWindows(graph, SHEET), SHEET, THUMB).png);
    expect([shown.width, shown.height], "the canvas is the sheet's own shape either way — a window adds ink, never extent").toEqual([paintOnly.width, paintOnly.height]);

    const added = [...shown.ink].filter((pixel) => !paintOnly.ink.has(pixel));
    expect(added.length, "the window's model space is drawn: a sheet of windows was an empty frame and title strip before I-359").toBeGreaterThan(0);

    const viewports = layout?.viewports ?? [];
    const on = viewports.filter(projectable).map((viewport) => pixelBox(windowOf(viewport).paper, extent!, THUMB));
    const astray = added.filter((pixel) => !on.some((frame) => inside(frame, pixel)));
    expect(astray, "every added pixel stands inside the frame of a window a plot shows — clipped to it, and nothing through a window switched off or twisted").toEqual([]);

    // The sheet's own paint is kept: nothing the sheet drew is lost under what the windows show.
    const lost = [...paintOnly.ink].filter((pixel) => !shown.ink.has(pixel));
    expect(lost, "the sheet's own paint stands over its windows, whole").toEqual([]);
  });

  test("model space opens no windows, so its raster is exactly what it was", () => {
    const now = renderSheet(graph, MODEL, THUMB);
    const before = renderSheet(withoutWindows(graph, SHEET), MODEL, THUMB);
    expect(Buffer.from(now.png).equals(Buffer.from(before.png)), "the model sheet's bytes do not move").toBe(true);
  });

  test("a sheet of windows and nothing else is framed by its windows, as the viewer frames it", () => {
    const framedOnly: EntityGraph = {
      ...graph,
      layouts: graph.layouts.map((each) => (each.name === SHEET ? { ...each, bbox: null } : each)),
      entities: graph.entities.filter((entity) => entity.space !== SHEET),
      derived: graph.derived.filter((record) => record.space !== SHEET),
    };
    const raster = renderSheet(framedOnly, SHEET, THUMB);
    const frames = (layout?.viewports ?? []).filter(projectable).map((viewport) => windowOf(viewport).paper);
    const frame = frames[0] as Box;
    const [spanX, spanY] = [frame[2] - frame[0], frame[3] - frame[1]];
    const long = Math.max(spanX, spanY);
    expect([raster.width, raster.height], "the canvas takes the union of the frames' shape rather than the blank square of a sheet with no extent").toEqual([
      Math.round((spanX / long) * THUMB),
      Math.round((spanY / long) * THUMB),
    ]);
    expect(inkOf(raster.png).ink.size, "and it shows what the window frames").toBeGreaterThan(0);
  });
});
