// R-SPINE-022's renderer: one sheet of an EntityGraph, drawn to a canvas of a tier's long edge.
//
// It draws what the vector lane really carries — the path-shaped geometry of a layout, in the colour
// the extractor already resolved (L-CAD-05), on white. Text, hatch fills, line weights and colour by
// layer are not drawn: a thumbnail is a picture of where the lines are, and a renderer that guessed
// at any of the rest would be inventing a fact the artifact did not state.
//
// Pure: the same graph and the same tier make the same bytes, so a raster's address is a function of
// what it is a picture of (R-SPINE-021, content addressing).
import type { EntityGraph } from "../../../core/entitygraph/schema";
import { CHANNELS, encodePng } from "./png";

/** One rendered sheet: the encoded image and the canvas it was drawn on. */
export type SheetRaster = { png: Uint8Array; width: number; height: number };

/** The paper a sheet is drawn on. Line work is dark on it, never the other way round. */
const PAPER = 255;

/** A point of the plane, as the artifact carries one. */
type Point = readonly [number, number];

/** The geometry of one space: everything the artifact drew there, original or synthesised. */
function pathsOf(graph: EntityGraph, layoutName: string): { points: Point[]; closed: boolean; rgb: readonly [number, number, number] }[] {
  const drawn = [...graph.entities, ...graph.derived];
  return drawn
    .filter((record) => record.space === layoutName && (record.points ?? []).length >= 2)
    .map((record) => ({ points: (record.points ?? []) as Point[], closed: record.closed === true, rgb: record.colour.rgb }));
}

/** A whole number of pixels, at least one and never past the tier's own edge. */
function pixels(span: number, scale: number, longEdge: number): number {
  return Math.min(longEdge, Math.max(1, Math.round(span * scale)));
}

/** A blank sheet: a layout with no extents is a square of paper, because it reaches nowhere. */
function blank(longEdge: number): SheetRaster {
  const canvas = new Uint8Array(longEdge * longEdge * CHANNELS).fill(PAPER);
  return { png: encodePng(canvas, longEdge, longEdge), width: longEdge, height: longEdge };
}

/**
 * Render one layout of an artifact at a tier's long edge.
 *
 * The sheet's longer axis takes the whole long edge and the other stands in the sheet's own
 * proportion to it, so a raster is the shape of the sheet rather than the shape of the tier. A
 * layout the artifact carries no bounding box for — one nothing was drawn in — renders as a blank
 * square of the tier's edge, which is a picture of an empty sheet rather than a missing one.
 */
export function renderSheet(graph: EntityGraph, layoutName: string, longEdge: number): SheetRaster {
  const layout = graph.layouts.find((candidate) => candidate.name === layoutName);
  const bbox = layout?.bbox ?? null;
  if (bbox === null) return blank(longEdge);

  const spanX = bbox.max[0] - bbox.min[0];
  const spanY = bbox.max[1] - bbox.min[1];
  const longest = Math.max(spanX, spanY);
  // Extents that reach nowhere along either axis scale to nothing: the sheet is a point, and a point
  // is drawn as the empty sheet it looks like rather than divided by zero.
  if (!(longest > 0)) return blank(longEdge);

  const scale = longEdge / longest;
  const width = pixels(spanX, scale, longEdge);
  const height = pixels(spanY, scale, longEdge);
  const canvas = new Uint8Array(width * height * CHANNELS).fill(PAPER);

  // World units to pixels: the sheet's own minimum corner is the canvas's bottom-left, and the y axis
  // is flipped because a drawing's y grows upwards while a scanline's row number grows downwards.
  const column = (x: number): number => clamp(Math.floor((x - bbox.min[0]) * scale), width - 1);
  const row = (y: number): number => clamp(Math.floor((bbox.max[1] - y) * scale), height - 1);

  for (const path of pathsOf(graph, layoutName)) {
    const drawn = path.points.map((point) => [column(point[0]), row(point[1])] as const);
    const ends = path.closed && drawn.length > 2 ? [...drawn, drawn[0] as (typeof drawn)[number]] : drawn;
    for (let index = 1; index < ends.length; index += 1) {
      line(canvas, width, ends[index - 1] as readonly [number, number], ends[index] as readonly [number, number], path.rgb);
    }
  }

  return { png: encodePng(canvas, width, height), width, height };
}

/** A coordinate inside the canvas: geometry may sit on the extent's own edge, or a hair past it. */
function clamp(value: number, last: number): number {
  return value < 0 ? 0 : value > last ? last : value;
}

/** One pixel, painted. */
function plot(canvas: Uint8Array, width: number, x: number, y: number, rgb: readonly [number, number, number]): void {
  const at = (y * width + x) * CHANNELS;
  canvas[at] = rgb[0];
  canvas[at + 1] = rgb[1];
  canvas[at + 2] = rgb[2];
}

/** A straight line between two pixels, by Bresenham's — integer arithmetic, and every pixel once. */
function line(canvas: Uint8Array, width: number, from: readonly [number, number], to: readonly [number, number], rgb: readonly [number, number, number]): void {
  let [x, y] = from;
  const [endX, endY] = to;
  const stepX = x < endX ? 1 : -1;
  const stepY = y < endY ? 1 : -1;
  const runX = Math.abs(endX - x);
  const runY = -Math.abs(endY - y);
  let error = runX + runY;

  for (;;) {
    plot(canvas, width, x, y, rgb);
    if (x === endX && y === endY) return;
    const doubled = 2 * error;
    if (doubled >= runY) {
      error += runY;
      x += stepX;
    }
    if (doubled <= runX) {
      error += runX;
      y += stepY;
    }
  }
}
