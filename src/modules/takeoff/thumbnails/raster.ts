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
// A scanned page is the scan itself first (I-684): each page raster the vectoriser traced from
// (I-584) is laid down at the page-space corners its record states — a standalone scan over the whole
// page, a picture pasted onto a PDF page (S-03) at its own placement — averaged down to the tier by
// area, as any viewer shows a picture smaller than it is; the page's paint, the traced lines among
// it, is drawn over it as on every other sheet. The same reduction draws the viewer's backdrop
// (`scanBackdrop`): the scan alone, fitted to the full tier's edge, which the viewer lays under the
// traced lines it paints itself.
//
// Pure: the same graph, the same scans and the same tier make the same bytes, so a raster's address
// is a function of what it is a picture of (R-SPINE-021, content addressing).
import type { EntityGraph, RasterRecord } from "@/core/entitygraph/schema";
import { projectRecord, unionOfFrames, windowsOf, type Window } from "../viewer/projection";
import { CHANNELS, encodeGreyPng, encodePng, type GreyImage } from "./png";

/** One rendered sheet: the encoded image and the canvas it was drawn on. */
export type SheetRaster = { png: Uint8Array; width: number; height: number };

/**
 * A page raster the sheet was traced from, decoded, with the record that says where it stands: its
 * page (`space`) and the page-space corners of its top-left, top-right, bottom-right and bottom-left
 * pixels (I-584).
 */
export type PageScan = { readonly record: Pick<RasterRecord, "space" | "placement">; readonly image: GreyImage };

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
export function renderSheet(graph: EntityGraph, layoutName: string, longEdge: number, scans: readonly PageScan[] = []): SheetRaster {
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

  // The scans first, so every path the page carries stands over the picture it was traced from.
  for (const scan of scans) {
    if (scan.record.space === layoutName) layScan(canvas, width, height, scan, { minX: bbox.min[0], maxY: bbox.max[1], scale });
  }

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

/**
 * A grey picture averaged down by area to `width` × `height`: every output pixel is the mean of the
 * source pixels its footprint covers, so a hairline thinner than the footprint fades rather than
 * vanishing or breaking into dashes, as a picture shown smaller than itself does anywhere.
 */
export function reduceGrey(image: GreyImage, width: number, height: number): GreyImage {
  if (width >= image.width && height >= image.height) return image;
  const across = new Uint32Array(width + 1);
  for (let column = 0; column <= width; column += 1) across[column] = Math.floor((column * image.width) / width);
  const sums = new Uint32Array(width);
  const pixels = new Uint8Array(width * height);
  for (let row = 0; row < height; row += 1) {
    const top = Math.floor((row * image.height) / height);
    const bottom = Math.max(top + 1, Math.floor(((row + 1) * image.height) / height));
    sums.fill(0);
    for (let source = top; source < bottom; source += 1) {
      const line = source * image.width;
      for (let column = 0; column < width; column += 1) {
        const end = Math.max((across[column] as number) + 1, across[column + 1] as number);
        let sum = 0;
        for (let at = across[column] as number; at < end; at += 1) sum += image.pixels[line + at] as number;
        sums[column] = (sums[column] as number) + sum;
      }
    }
    for (let column = 0; column < width; column += 1) {
      const span = Math.max(1, (across[column + 1] as number) - (across[column] as number)) * (bottom - top);
      pixels[row * width + column] = Math.round((sums[column] as number) / span);
    }
  }
  return { width, height, pixels };
}

/**
 * The viewer's backdrop of one scan (I-684): the page raster alone, averaged down so its long
 * edge is at most `longEdge`, as a grey PNG. A scan already that small is written as it is.
 */
export function scanBackdrop(image: GreyImage, longEdge: number): SheetRaster {
  const fit = Math.min(1, longEdge / Math.max(image.width, image.height));
  const reduced = reduceGrey(image, Math.max(1, Math.round(image.width * fit)), Math.max(1, Math.round(image.height * fit)));
  return { png: encodeGreyPng(reduced.pixels, reduced.width, reduced.height), width: reduced.width, height: reduced.height };
}

/**
 * One scan laid onto a sheet's canvas at the corners its record states. The corners are an affine
 * image of the picture (a scale, a turn and a move, as the vectoriser's page map is), so each canvas
 * pixel's centre is taken back into the picture's pixels by the inverse of that map and the nearest
 * one read — from the picture first averaged down to about one of its pixels per canvas pixel where
 * it is larger than that. A pixel is darkened to the scan, never lightened: two scans overlapping
 * both show, and nothing drawn before one is washed out by its paper.
 */
function layScan(canvas: Uint8Array, width: number, height: number, scan: PageScan, sheet: { minX: number; maxY: number; scale: number }): void {
  const placement = scan.record.placement as readonly (readonly [number, number])[];
  const [topLeft, topRight, , bottomLeft] = placement;
  if (topLeft === undefined || topRight === undefined || bottomLeft === undefined) return;
  const { image } = scan;
  // The world step of one picture pixel across and down.
  const acrossX = (topRight[0] - topLeft[0]) / image.width;
  const acrossY = (topRight[1] - topLeft[1]) / image.width;
  const downX = (bottomLeft[0] - topLeft[0]) / image.height;
  const downY = (bottomLeft[1] - topLeft[1]) / image.height;
  const determinant = acrossX * downY - downX * acrossY;
  if (!(Math.abs(determinant) > 0)) return;

  // How many picture pixels one canvas pixel covers, and the picture at about one of them per pixel.
  const footprint = 1 / sheet.scale / Math.max(Math.hypot(acrossX, acrossY), Math.hypot(downX, downY));
  const factor = Math.max(1, footprint);
  const source = factor > 1 ? reduceGrey(image, Math.max(1, Math.round(image.width / factor)), Math.max(1, Math.round(image.height / factor))) : image;
  const shrinkX = source.width / image.width;
  const shrinkY = source.height / image.height;

  // The canvas box the four corners cover, so the pixels outside the picture are never visited.
  const across = placement.map(([x]) => (x - sheet.minX) * sheet.scale);
  const down = placement.map(([, y]) => (sheet.maxY - y) * sheet.scale);
  const left = Math.max(0, Math.floor(Math.min(...across)));
  const right = Math.min(width - 1, Math.ceil(Math.max(...across)));
  const top = Math.max(0, Math.floor(Math.min(...down)));
  const bottom = Math.min(height - 1, Math.ceil(Math.max(...down)));

  for (let row = top; row <= bottom; row += 1) {
    const worldY = sheet.maxY - (row + 0.5) / sheet.scale - topLeft[1];
    for (let column = left; column <= right; column += 1) {
      const worldX = sheet.minX + (column + 0.5) / sheet.scale - topLeft[0];
      const u = (worldX * downY - downX * worldY) / determinant;
      const v = (acrossX * worldY - worldX * acrossY) / determinant;
      if (u < 0 || v < 0 || u >= image.width || v >= image.height) continue;
      const grey = source.pixels[Math.min(source.height - 1, Math.floor(v * shrinkY)) * source.width + Math.min(source.width - 1, Math.floor(u * shrinkX))] as number;
      const at = (row * width + column) * CHANNELS;
      canvas[at] = Math.min(canvas[at] as number, grey);
      canvas[at + 1] = Math.min(canvas[at + 1] as number, grey);
      canvas[at + 2] = Math.min(canvas[at + 2] as number, grey);
    }
  }
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
