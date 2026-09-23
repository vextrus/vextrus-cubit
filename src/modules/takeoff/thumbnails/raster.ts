// R-SPINE-022's renderer: one sheet of an EntityGraph, drawn to a canvas of a tier's long edge.
//
// It draws what the vector lane really carries — the path-shaped geometry of a layout, in the colour
// the extractor already resolved (L-CAD-05), on white — a colour too light to read on white plotted
// black, as a plotter prints the default colour. Text, hatch fills, line weights and colour by
// layer are not drawn: a thumbnail is a picture of where the lines are, and a renderer that guessed
// at any of the rest would be inventing a fact the artifact did not state.
//
// A paper sheet is its own paint AND what its viewports show of model space, as a plot of it is
// (I-359). The windows are the viewer's shipped reading of a VIEWPORT (`windowsOf`), and a model path
// is moved onto the paper and clipped to the frame by the viewer's own `projectRecord` — the same
// projection the viewer paints a sheet with and the sheet index attributes views by, never a second
// one (B-17). Without it a sheet whose drawing stands in model space (every F-RCC6-BNBC plan,
// schedule and section) rasterised as an empty frame and title-block strip.
//
// Pure: the same graph and the same tier make the same bytes, so a raster's address is a function of
// what it is a picture of (R-SPINE-021, content addressing).
import type { EntityGraph } from "@/core/entitygraph/schema";
import { projectRecord, unionOfFrames, windowsOf, type Window } from "../viewer/projection";
import { CHANNELS, encodePng } from "./png";

/** One rendered sheet: the encoded image and the canvas it was drawn on. */
export type SheetRaster = { png: Uint8Array; width: number; height: number };

/** The paper a sheet is drawn on. Line work is dark on it, never the other way round. */
const PAPER = 255;

/**
 * The lightest channel a line may keep and still read on the paper. A CAD drawing is drawn light on
 * a dark screen: ACI 7, the default colour most line work stands in, resolves to white (L-CAD-05),
 * and white on this paper is no line at all — the F-RCC6-BNBC paper layouts rasterised blank. A
 * plotter prints ACI 7 black on paper, and so does this: a colour whose every channel is at least
 * this light is drawn in ink. Every other resolved colour stands as the artifact states it.
 */
const PAPER_LIGHT = 0xc0;

/** The ink a too-light line is plotted in: the paper-plot convention for the default colour. */
const INK: readonly [number, number, number] = [0, 0, 0];

/**
 * The long edge at or under which a stroke is two pixels wide. A thumbnail is shown at about its own
 * size on a card, and a one-pixel Bresenham line at that tier washes out to nothing once the browser
 * resamples it; the larger tiers stay one pixel, which is what a viewer background wants.
 */
const BOLD_BELOW = 256;

/** The colour one path is drawn in on paper: its own, unless it is too light to be seen there. */
function onPaper(rgb: readonly [number, number, number]): readonly [number, number, number] {
  return rgb[0] >= PAPER_LIGHT && rgb[1] >= PAPER_LIGHT && rgb[2] >= PAPER_LIGHT ? INK : rgb;
}

/** A point of the plane, as the artifact carries one. */
type Point = readonly [number, number];

/** One stroke to lay down: a run of points in the sheet's own units, and the colour it resolved to. */
type Path = { points: Point[]; closed: boolean; rgb: readonly [number, number, number] };

/** The name the artifact gives model space (`vextrus_cad.ingest.MODEL_SPACE`, the manifest's own). */
const MODEL_SPACE = "model";

/** The geometry of one space: everything the artifact drew there, original or synthesised. */
function pathsOf(graph: EntityGraph, layoutName: string): Path[] {
  const drawn = [...graph.entities, ...graph.derived];
  return drawn
    .filter((record) => record.space === layoutName && (record.points ?? []).length >= 2)
    .map((record) => ({ points: (record.points ?? []) as Point[], closed: record.closed === true, rgb: record.colour.rgb }));
}

/** The windows a layout opens onto model space — none for model space itself (I-359). */
function windowsOfSheet(graph: EntityGraph, layoutName: string): Window[] {
  if (layoutName === MODEL_SPACE) return [];
  const layout = graph.layouts.find((candidate) => candidate.name === layoutName);
  return layout?.kind === "paper" ? windowsOf(layout) : [];
}

/**
 * The model-space paths a sheet's windows show, on the paper and clipped to each frame, window by
 * window in the drawing's order (I-359). The same records `pathsOf` would draw in model space, handed
 * to the viewer's own projection: a path the frame cuts comes back as the open runs of it inside.
 */
function projectedPathsOf(graph: EntityGraph, windows: readonly Window[]): Path[] {
  if (windows.length === 0) return [];
  const model = pathsOf(graph, MODEL_SPACE);
  const shown: Path[] = [];
  for (const window of windows) {
    model.forEach((path, index) => {
      // The projection names what it moves; a thumbnail keeps no identity, so the index stands in.
      for (const piece of projectRecord({ src: String(index), type: "PATH", rgb: path.rgb, points: path.points, closed: path.closed }, window)) {
        const points = (piece.points ?? []) as Point[];
        if (points.length >= 2) shown.push({ points, closed: piece.closed === true, rgb: path.rgb });
      }
    });
  }
  return shown;
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
 * square of the tier's edge, which is a picture of an empty sheet rather than a missing one; a paper
 * layout of windows and nothing else is framed by its windows, as the viewer frames it (I-359).
 *
 * A paper layout's windows are drawn first and its own paint over them, so the frames and the title
 * block stand crisp over whatever model space runs up to them.
 */
export function renderSheet(graph: EntityGraph, layoutName: string, longEdge: number): SheetRaster {
  const layout = graph.layouts.find((candidate) => candidate.name === layoutName);
  const windows = windowsOfSheet(graph, layoutName);
  const bbox = layout?.bbox ?? unionOfFrames(windows);
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

  const pen = longEdge <= BOLD_BELOW ? 2 : 1;
  for (const path of [...projectedPathsOf(graph, windows), ...pathsOf(graph, layoutName)]) {
    const drawn = path.points.map((point) => [column(point[0]), row(point[1])] as const);
    const ends = path.closed && drawn.length > 2 ? [...drawn, drawn[0] as (typeof drawn)[number]] : drawn;
    const ink = onPaper(path.rgb);
    for (let index = 1; index < ends.length; index += 1) {
      line(canvas, width, height, ends[index - 1] as readonly [number, number], ends[index] as readonly [number, number], ink, pen);
    }
  }

  return { png: encodePng(canvas, width, height), width, height };
}

/** A coordinate inside the canvas: geometry may sit on the extent's own edge, or a hair past it. */
function clamp(value: number, last: number): number {
  return value < 0 ? 0 : value > last ? last : value;
}

/** One pen stroke, painted: a square of `pen` pixels from the point towards the canvas's far corner,
    stopping at the canvas's own edge. */
function plot(canvas: Uint8Array, width: number, height: number, x: number, y: number, rgb: readonly [number, number, number], pen: number): void {
  for (let down = 0; down < pen && y + down < height; down += 1) {
    for (let across = 0; across < pen && x + across < width; across += 1) {
      const at = ((y + down) * width + (x + across)) * CHANNELS;
      canvas[at] = rgb[0];
      canvas[at + 1] = rgb[1];
      canvas[at + 2] = rgb[2];
    }
  }
}

/** A straight line between two pixels, by Bresenham's — integer arithmetic, and every pixel once. */
function line(
  canvas: Uint8Array,
  width: number,
  height: number,
  from: readonly [number, number],
  to: readonly [number, number],
  rgb: readonly [number, number, number],
  pen: number,
): void {
  let [x, y] = from;
  const [endX, endY] = to;
  const stepX = x < endX ? 1 : -1;
  const stepY = y < endY ? 1 : -1;
  const runX = Math.abs(endX - x);
  const runY = -Math.abs(endY - y);
  let error = runX + runY;

  for (;;) {
    plot(canvas, width, height, x, y, rgb, pen);
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
