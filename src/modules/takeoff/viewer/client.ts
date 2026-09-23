// R-UI-040's client half, without a browser in it: the camera a sheet is seen through, the
// level-of-detail rule that hides text nobody could read, the spatial index hit-testing runs on, and
// the layer posture a panel row shows. Pure functions and plain objects only — no DOM global is
// touched at import, so the worker, the painter, a jsdom mount and a server render all load this
// same module (ARCH-01).
//
// Nothing here re-derives what the manifest already carries: colours, world heights and extents come
// from the server's reading (L-CAD-05), and this file decides only what is drawn and what is under
// the pointer.
import { NOMINAL_FACE, letter, letteredBox } from "./lettering";
import type { Camera, RenderLayer, RenderManifest, RenderRecord, ViewerHead, Viewport } from "./types";

/* ------------------------------------------------------------------------------- the budgets */

/** PB-3: one frame of a 60 fps pan or zoom. */
export const FRAME_BUDGET_MS = 16.7;

/** PB-3: the longest a hit-test may take before a pointer feels stuck. */
export const HIT_TEST_BUDGET_MS = 16;

/** PB-2: first paint of a 100 000-entity sheet from a warm manifest cache. */
export const FIRST_PAINT_WARM_MS = 2000;

/** PB-2: first paint of the same sheet cold, with the manifest still to build. */
export const FIRST_PAINT_COLD_MS = 6000;

/**
 * The size, in device-independent pixels, a label the product letters for itself is never set
 * below — the partition overlay's bubbles: read without effort at it, and dropped rather than
 * shrunk past it. The drawing's OWN text is the level of detail's, at `LETTERED_TEXT_PX`.
 */
export const LEGIBLE_TEXT_PX = 6;

/**
 * The cap height, in device-independent pixels, below which a drawing's own text is not drawn at
 * all — R-UI-040's level of detail, as Deviation D-006 draws it. A capital is read from about
 * 3 px tall (Decision I-463, measured on the atlas's own glyphs); from 2 px to 3 px it is
 * lettered anyway, at its true size, so a fitted sheet shows its marks, notes and title block in
 * their places as the drawing and every plot of it does, and a zoom sharpens them rather than
 * making them appear. Below 2 px a capital is two rows of pixels, and it is not drawn.
 */
export const LETTERED_TEXT_PX = 2;

/* ------------------------------------------------------------------- a resolved colour, as shown */

/**
 * The notation a resolved colour is written in for a browser, held as a value because it is not a
 * colour: the colour is the three channels the reading resolved (L-CAD-05), and the notation is the
 * grammar they are handed over in. R-UI-001 bans colour literals — a token is what a surface's own
 * colour comes from — and this is neither: it is drawing data on its way to a swatch.
 */
const COLOUR_NOTATION = "rgb";

/** One layer's or record's resolved colour as a CSS value — artifact data, in its one home (B-17). */
export function cssColour(rgb: readonly [number, number, number]): string {
  return `${COLOUR_NOTATION}(${rgb[0]} ${rgb[1]} ${rgb[2]})`;
}

/** A channel is "white" at or above this, and "black" at or below the other — colour 7 (I-79). */
const NEAR_WHITE = 250;
const NEAR_BLACK = 5;

/**
 * Whether a resolved colour is CAD colour 7 — white or black as the reading resolved it — which
 * paints in `--canvas-ink` rather than as itself, so it is legible on both papers (Decision I-79).
 * The rule's one home: the painter reads it for every record, and anything else that shows a
 * drawing's colour beside the canvas — a layer's swatch — reads the same answer, so the two never
 * disagree about a layer the canvas draws in ink.
 */
export function isCanvasInk(rgb: readonly [number, number, number]): boolean {
  const [red, green, blue] = rgb;
  const white = red >= NEAR_WHITE && green >= NEAR_WHITE && blue >= NEAR_WHITE;
  const black = red <= NEAR_BLACK && green <= NEAR_BLACK && blue <= NEAR_BLACK;
  return white || black;
}

/* -------------------------------------------------------------------------------- the camera */

/** The scale is kept inside a finite positive band, so a camera always has a figure to publish. */
const MIN_SCALE = 1e-6;
const MAX_SCALE = 1e6;

/** How much of the viewport a fitted sheet leaves as margin, so the extents frame is not on the edge. */
const FIT_MARGIN = 0.92;

/** The decimals a serialised viewport carries — enough to restore a camera the eye cannot tell apart. */
const VIEWPORT_DECIMALS = 4;

/** A scale that is finite and positive, whatever arithmetic produced it. */
function clampScale(scale: number): number {
  if (!Number.isFinite(scale) || scale <= 0) return 1;
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}

/** A number as a deep link spells it: fixed decimals, with the trailing zeros dropped. */
function spell(value: number): string {
  const fixed = value.toFixed(VIEWPORT_DECIMALS);
  return fixed.includes(".") ? fixed.replace(/0+$/, "").replace(/\.$/, "") : fixed;
}

/**
 * The scale as a deep link spells it. A site plan in millimetres fits at ~2.5e-5 pixels per drawing
 * unit, which four decimals round to `0` — a scale this module then refuses to read back, so the
 * address in the bar would not be the address that reopens the sheet. Below that floor the figure is
 * spelled to significant digits instead (R-UI-031: what the viewer writes, it must read).
 */
function spellScale(scale: number): string {
  const fixed = spell(scale);
  return Number(fixed) > 0 ? fixed : String(Number(scale.toPrecision(VIEWPORT_DECIMALS)));
}

/**
 * The camera a sheet opens at: the whole drawing in view, centred, with a margin. Opening a sheet
 * and fitting it are the same camera — `fitCamera` is the name the Fit control asks for it under —
 * so the two cannot answer differently (B-17).
 */
export function createCamera(extents: RenderManifest["extents"], viewportPx: { width: number; height: number }): Camera {
  const width = Math.max(viewportPx.width, 1);
  const height = Math.max(viewportPx.height, 1);
  if (extents === null) return { centre: [0, 0], scale: 1, viewport: { width, height } };

  const spanX = Math.max(extents.max[0] - extents.min[0], 0);
  const spanY = Math.max(extents.max[1] - extents.min[1], 0);
  const byWidth = spanX > 0 ? (width * FIT_MARGIN) / spanX : Number.POSITIVE_INFINITY;
  const byHeight = spanY > 0 ? (height * FIT_MARGIN) / spanY : Number.POSITIVE_INFINITY;
  const fitted = Math.min(byWidth, byHeight);

  return {
    centre: [(extents.min[0] + extents.max[0]) / 2, (extents.min[1] + extents.max[1]) / 2],
    scale: clampScale(Number.isFinite(fitted) ? fitted : 1),
    viewport: { width, height },
  };
}

/** The whole sheet in view again (Decision I-83: fit is one camera write, untweened). */
export function fitCamera(extents: RenderManifest["extents"], viewportPx: { width: number; height: number }): Camera {
  return createCamera(extents, viewportPx);
}

/**
 * The camera moved by a screen distance: the view travels by the pixels given, so the drawing under
 * a dragging hand travels the other way. Screen y grows downward and world y upward, so the second
 * axis is negated once, here.
 */
export function panCamera(camera: Camera, dxPx: number, dyPx: number): Camera {
  return {
    ...camera,
    centre: [camera.centre[0] + dxPx / camera.scale, camera.centre[1] - dyPx / camera.scale],
  };
}

/** Where a screen point stands in the drawing, under a given camera. */
export function worldAt(camera: Camera, atPx: { x: number; y: number }): [number, number] {
  return [
    camera.centre[0] + (atPx.x - camera.viewport.width / 2) / camera.scale,
    camera.centre[1] - (atPx.y - camera.viewport.height / 2) / camera.scale,
  ];
}

/**
 * Zoom about a point of the viewport, keeping the drawing under it still — the gesture a wheel and a
 * pinch both make. A zoom that would leave the scale band clamps, and the anchor still holds.
 */
export function zoomCameraAt(camera: Camera, factor: number, atPx: { x: number; y: number }): Camera {
  const scale = clampScale(camera.scale * (Number.isFinite(factor) && factor > 0 ? factor : 1));
  const anchor = worldAt(camera, atPx);
  return {
    ...camera,
    scale,
    centre: [anchor[0] - (atPx.x - camera.viewport.width / 2) / scale, anchor[1] + (atPx.y - camera.viewport.height / 2) / scale],
  };
}

/** The camera as the address carries it: the world centre and the pixels per drawing unit (R-UI-031). */
export function serialiseViewport(camera: Camera): string {
  return `${spell(camera.centre[0])},${spell(camera.centre[1])},${spellScale(camera.scale)}`;
}

/** A `v` parameter read back, or null where it is not one this viewer wrote. */
export function parseViewport(value: string): Viewport | null {
  const parts = value.split(",");
  if (parts.length !== 3) return null;
  const [x, y, scale] = parts.map((part) => Number(part.trim()));
  if (x === undefined || y === undefined || scale === undefined) return null;
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(scale) || scale <= 0) return null;
  return { x, y, scale };
}

/** The camera a deep link restores: its own centre and scale, in the viewport this reader has. */
export function cameraFromViewport(viewport: Viewport, viewportPx: { width: number; height: number }): Camera {
  return {
    centre: [viewport.x, viewport.y],
    scale: clampScale(viewport.scale),
    viewport: {
      width: Math.max(viewportPx.width, 1),
      height: Math.max(viewportPx.height, 1),
    },
  };
}

/* ---------------------------------------------------------------------- level of detail (LOD) */

/** Whether text of this world cap height is drawn at this scale — the level of detail's one rule (R-UI-040, D-006). */
export function isTextLettered(heightWorld: number, scale: number): boolean {
  return Number.isFinite(heightWorld) && Number.isFinite(scale) && heightWorld * scale >= LETTERED_TEXT_PX;
}

/** The text of one layer that is drawn under this camera — the rest is not drawn at all. */
export function letteredTexts(layer: RenderLayer, camera: Camera): RenderRecord[] {
  return layer.records.filter((record) => record.text !== undefined && isTextLettered(record.height ?? 0, camera.scale));
}

/**
 * Where lettering begins in a run of finite world heights sorted ascending: the index of the first
 * one `isTextLettered` admits at this scale, or the run's length where none is. The LOD cut is this
 * index — everything from it up is drawn — so a search rather than a walk: a sheet with fifty
 * thousand notes mostly too small to draw is asked it every frame (R-UI-040, PB-3).
 */
export function letteredFrom(heights: readonly number[], scale: number): number {
  let low = 0;
  let high = heights.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (isTextLettered(heights[middle] ?? 0, scale)) high = middle;
    else low = middle + 1;
  }
  return low;
}

/* ------------------------------------------------------------ the settled frame (I-345, I-346) */

/**
 * Decision § 4's settle: how long a camera must hold still before its gesture is over. The address
 * is written then (R-UI-031), and the sheet is drawn in full then (I-345) — one settle, so the two
 * never disagree about when the reader stopped.
 */
export const GESTURE_SETTLE_MS = 150;

/**
 * The most a settled frame is ever stretched or shrunk to stand for a camera in motion. Past it the
 * sheet is drawn in full again and that frame is the one the motion goes on from, so a sheet in
 * motion is never softer than a resample of a full frame by a quarter (I-345).
 */
export const SETTLED_RESAMPLE_MAX = 1.25;

/**
 * How far past each edge of the view a settled frame is drawn, as a fraction of the view on that
 * axis: the room a pan has to travel, and a zoom out to its resample limit, before geometry the frame
 * does not hold would come into view (I-345).
 */
export const SETTLED_MARGIN = 0.25;

/** A box in drawing units, `[minX, minY, maxX, maxY]`. */
export type WorldBox = readonly [number, number, number, number];

/** The world box a camera sees. */
export function viewBoxOf(camera: Camera): WorldBox {
  const halfWidth = camera.viewport.width / 2 / camera.scale;
  const halfHeight = camera.viewport.height / 2 / camera.scale;
  return [camera.centre[0] - halfWidth, camera.centre[1] - halfHeight, camera.centre[0] + halfWidth, camera.centre[1] + halfHeight];
}

/** A full frame kept to stand for a moving camera: the camera it was drawn at, and the world it holds. */
export type SettledFrame = {
  readonly at: Camera;
  readonly holds: WorldBox;
};

/**
 * Whether a settled frame may stand for this camera while it moves (I-345). It may only where moving
 * and scaling its pixels puts in front of the reader exactly the geometry and the lettering a full
 * frame at this camera would draw — resampled, never fewer:
 *
 * - the view is the same size, so the frame is the same picture of the same stage;
 * - the scale is within `SETTLED_RESAMPLE_MAX` of the frame's, either way;
 * - every drawn layer's LOD cut is where it was: no text has become legible that the frame left
 *   out, and none has gone below legibility that the frame put in (`heights`, one ascending run per
 *   drawn layer);
 * - whatever the sheet holds inside the view lies inside what the frame holds (`content`, the world
 *   box of every drawn layer and the extents frame, or null where nothing is drawn). Past the
 *   frame's edge is paper only where the sheet itself has nothing.
 */
export function settledFrameServes(frame: SettledFrame, camera: Camera, content: WorldBox | null, heights: readonly (readonly number[])[]): boolean {
  if (frame.at.viewport.width !== camera.viewport.width || frame.at.viewport.height !== camera.viewport.height) return false;
  const ratio = camera.scale / frame.at.scale;
  if (!(ratio <= SETTLED_RESAMPLE_MAX && ratio >= 1 / SETTLED_RESAMPLE_MAX)) return false;
  for (const run of heights) if (letteredFrom(run, camera.scale) !== letteredFrom(run, frame.at.scale)) return false;
  if (content === null) return true;
  const view = viewBoxOf(camera);
  const seen: WorldBox = [Math.max(view[0], content[0]), Math.max(view[1], content[1]), Math.min(view[2], content[2]), Math.min(view[3], content[3])];
  // Nothing of the sheet is in view: the paper alone is the whole of a full frame too.
  if (seen[0] > seen[2] || seen[1] > seen[3]) return true;
  const [minX, minY, maxX, maxY] = frame.holds;
  return seen[0] >= minX && seen[1] >= minY && seen[2] <= maxX && seen[3] <= maxY;
}

/* --------------------------------------------------------------------------- the spatial index */

/** One indexed record: what it is called, which layer holds it, its world box and its geometry. */
type IndexEntry = {
  readonly id: string;
  readonly layer: string;
  readonly box: readonly [number, number, number, number];
  readonly record: RenderRecord;
};

/** A packed node: its own box, and either child nodes or the entries it holds. */
type IndexNode = {
  readonly box: [number, number, number, number];
  readonly children?: readonly IndexNode[];
  readonly entries?: readonly IndexEntry[];
};

/** A built index over one sheet, the shape a worker posts back and a hit-test walks. */
export type SpatialIndex = {
  readonly root: IndexNode | null;
  readonly size: number;
};

/** A world box as a query is stated in. */
export type IndexBox = {
  min: readonly [number, number];
  max: readonly [number, number];
};

/** How many entries one leaf holds — a packed R-tree's node size. */
const NODE_SIZE = 16;

/**
 * The world box of one record: its path's, or — for a text — the box its lettering stands in, turned
 * and set as it is drawn (`./lettering`, I-462), so a hit, a marquee and a fly-to meet the words
 * a reader sees rather than the one point they were set at. A text with no height to letter at is its
 * point.
 */
function boxOf(record: RenderRecord): [number, number, number, number] | null {
  if (record.text !== undefined) {
    const lettered = letteredBox(record);
    if (lettered !== null) return lettered;
  }
  const points = record.points ?? (record.anchor === undefined ? undefined : [record.anchor]);
  if (points === undefined || points.length === 0) return null;
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const [x, y] of points) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return Number.isFinite(minX) ? [minX, minY, maxX, maxY] : null;
}

/**
 * The key a record is selected, listed and copied under: its own source key, or the key of the
 * instance it was painted from. A derived record answers the instance's key, so a block selects as
 * one atom however many pieces it paints (Decision I-86) — and this is the one place that is decided,
 * for the index, the inspector and the address alike (B-17).
 */
export function recordKey(record: RenderRecord): string | undefined {
  return record.key ?? record.src;
}

/** The world box of one record, as a query, a selection row and the index all state it (B-17). */
export function recordBox(record: RenderRecord): IndexBox | null {
  const box = boxOf(record);
  return box === null ? null : { min: [box[0], box[1]], max: [box[2], box[3]] };
}

/** The box that holds all of these. */
function unionOf(boxes: readonly { box: readonly [number, number, number, number] }[]): [number, number, number, number] {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const { box } of boxes) {
    if (box[0] < minX) minX = box[0];
    if (box[1] < minY) minY = box[1];
    if (box[2] > maxX) maxX = box[2];
    if (box[3] > maxY) maxY = box[3];
  }
  return [minX, minY, maxX, maxY];
}

/** Chunk a sorted run into nodes of at most `size`. */
function chunk<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let at = 0; at < items.length; at += size) chunks.push(items.slice(at, at + size));
  return chunks;
}

/**
 * Sort-Tile-Recursive packing: the entries are sorted by x, cut into vertical slices, each slice
 * sorted by y and cut into leaves, and the leaves packed the same way until one node is left. It is
 * built once per sheet and never updated, which is exactly what a static drawing wants — and it
 * needs no dependency to be small (the Decision's reading of R-UI-040's "spatial index").
 */
function packLeaves(entries: readonly IndexEntry[]): IndexNode[] {
  const leaves = Math.ceil(entries.length / NODE_SIZE);
  const slices = Math.max(Math.ceil(Math.sqrt(leaves)), 1);
  const byX = [...entries].sort((a, b) => a.box[0] - b.box[0]);
  const packed: IndexNode[] = [];
  for (const slice of chunk(byX, Math.ceil(byX.length / slices))) {
    const byY = [...slice].sort((a, b) => a.box[1] - b.box[1]);
    for (const leaf of chunk(byY, NODE_SIZE)) packed.push({ box: unionOf(leaf), entries: leaf });
  }
  return packed;
}

/** One level of parents over the level below, packed the same way. */
function packLevel(nodes: readonly IndexNode[]): IndexNode[] {
  const groups = Math.max(Math.ceil(Math.sqrt(Math.ceil(nodes.length / NODE_SIZE))), 1);
  const byX = [...nodes].sort((a, b) => a.box[0] - b.box[0]);
  const packed: IndexNode[] = [];
  for (const slice of chunk(byX, Math.ceil(byX.length / groups))) {
    const byY = [...slice].sort((a, b) => a.box[1] - b.box[1]);
    for (const group of chunk(byY, NODE_SIZE)) packed.push({ box: unionOf(group), children: group });
  }
  return packed;
}

/** The index of a whole sheet, every layer's records in one tree. */
export function buildSpatialIndex(manifest: Pick<RenderManifest, "layers">): SpatialIndex {
  const entries: IndexEntry[] = [];
  for (const layer of manifest.layers) {
    for (const record of layer.records) {
      const box = boxOf(record);
      const id = recordKey(record);
      if (box === null || id === undefined) continue;
      entries.push({ id, layer: layer.name, box, record });
    }
  }
  if (entries.length === 0) return { root: null, size: 0 };

  let level: IndexNode[] = packLeaves(entries);
  while (level.length > 1) level = packLevel(level);
  return { root: level[0] ?? null, size: entries.length };
}

/** Do these two world boxes touch? */
function overlaps(box: readonly [number, number, number, number], query: readonly [number, number, number, number]): boolean {
  return box[0] <= query[2] && box[2] >= query[0] && box[1] <= query[3] && box[3] >= query[1];
}

/** Every entry whose box meets the query box, walked from the root. */
function search(index: SpatialIndex, query: readonly [number, number, number, number]): IndexEntry[] {
  const found: IndexEntry[] = [];
  const pending: IndexNode[] = index.root === null ? [] : [index.root];
  while (pending.length > 0) {
    const node = pending.pop() as IndexNode;
    if (!overlaps(node.box, query)) continue;
    if (node.children !== undefined) pending.push(...node.children);
    for (const entry of node.entries ?? []) if (overlaps(entry.box, query)) found.push(entry);
  }
  return found;
}

/**
 * The keys of every record whose box meets this world box — what culling and marquees ask. Where the
 * caller names the layers that may answer, the rest of the sheet is silent: a rectangle takes what a
 * reader can see, so nothing hidden, isolated away or locked is ever selected (Decision I-87). Each
 * key answers once however many records paint it (I-86).
 */
export function queryIndex(index: SpatialIndex, bbox: IndexBox, layers?: readonly string[]): string[] {
  const open = layers === undefined ? null : new Set(layers);
  const found = search(index, [bbox.min[0], bbox.min[1], bbox.max[0], bbox.max[1]]);
  return distinct(found.filter((entry) => open === null || open.has(entry.layer)));
}

/** Every key on one named layer, in the order the index answers them — what a layer's Select takes. */
export function layerKeys(index: SpatialIndex, layer: string): string[] {
  const everywhere: IndexBox = {
    min: [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY],
    max: [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY],
  };
  return queryIndex(index, everywhere, [layer]);
}

/** The keys of these entries, each once, in the order they were found. */
function distinct(entries: readonly IndexEntry[]): string[] {
  const keys: string[] = [];
  const held = new Set<string>();
  for (const entry of entries) {
    if (held.has(entry.id)) continue;
    held.add(entry.id);
    keys.push(entry.id);
  }
  return keys;
}

/** How far a world point is from a segment of the drawing. */
function distanceToSegment(point: readonly [number, number], from: readonly [number, number], to: readonly [number, number]): number {
  const spanX = to[0] - from[0];
  const spanY = to[1] - from[1];
  const lengthSquared = spanX * spanX + spanY * spanY;
  const along = lengthSquared === 0 ? 0 : Math.min(1, Math.max(0, ((point[0] - from[0]) * spanX + (point[1] - from[1]) * spanY) / lengthSquared));
  return Math.hypot(point[0] - (from[0] + along * spanX), point[1] - (from[1] + along * spanY));
}

/** Whether a point stands inside a convex outline, walked corner to corner in one turning sense. */
function insideOutline(outline: readonly (readonly [number, number])[], point: readonly [number, number]): boolean {
  let sign = 0;
  for (let at = 0; at < outline.length; at += 1) {
    const from = outline[at] as readonly [number, number];
    const to = outline[(at + 1) % outline.length] as readonly [number, number];
    const cross = (to[0] - from[0]) * (point[1] - from[1]) - (to[1] - from[1]) * (point[0] - from[0]);
    if (cross === 0) continue;
    if (sign === 0) sign = Math.sign(cross);
    else if (Math.sign(cross) !== sign) return false;
  }
  return true;
}

/**
 * How far a world point is from a record's own geometry, not merely from its box. A text's geometry
 * is its lettered outline: a point on the words is on the text, and a point beside it is as far as
 * the outline's nearest edge.
 */
function distanceTo(record: RenderRecord, point: readonly [number, number]): number {
  if (record.text !== undefined) {
    const lettered = letter(record, NOMINAL_FACE);
    if (lettered !== null) {
      if (insideOutline(lettered.outline, point)) return 0;
      let nearest = Number.POSITIVE_INFINITY;
      lettered.outline.forEach((corner, at) => {
        const gap = distanceToSegment(point, corner, lettered.outline[(at + 1) % 4] as readonly [number, number]);
        if (gap < nearest) nearest = gap;
      });
      return nearest;
    }
  }
  const points = record.points ?? (record.anchor === undefined ? undefined : [record.anchor]);
  if (points === undefined || points.length === 0) return Number.POSITIVE_INFINITY;
  if (points.length === 1) {
    const only = points[0] as readonly [number, number];
    return Math.hypot(point[0] - only[0], point[1] - only[1]);
  }
  let nearest = Number.POSITIVE_INFINITY;
  for (let at = 1; at < points.length; at += 1) {
    const gap = distanceToSegment(point, points[at - 1] as readonly [number, number], points[at] as readonly [number, number]);
    if (gap < nearest) nearest = gap;
  }
  if (record.closed === true && points.length >= 3) {
    const gap = distanceToSegment(point, points[points.length - 1] as readonly [number, number], points[0] as readonly [number, number]);
    if (gap < nearest) nearest = gap;
  }
  return nearest;
}

/**
 * How far behind the geometry a text's words stand in the ranking, as a part of the reach: a quarter
 * of it, one pixel at the hover's 4 px reach (I-462 (5)). Only a line the pointer is actually
 * on — one drawn through the lettering, within a pixel — is met before the words under the pointer;
 * a line merely within reach of them is met after.
 */
export const WORDS_BEHIND_REACH = 1 / 4;

/**
 * The keys under a world point, nearest first: the index narrows the sheet to a handful of
 * candidates and their own geometry decides, so a pointer between two lines picks the line it is
 * nearer rather than whichever box it happens to sit in.
 *
 * A text's geometry is its lettered outline, so a pointer on its words is at no distance from it
 * however far from its insert. Its rank is that distance plus a pixel's worth of the reach
 * (`WORDS_BEHIND_REACH`), and a record is admitted by its own distance alone: the words under the
 * pointer come before any text the pointer is merely near and any line more than a pixel away, and
 * after a line drawn through them (I-462 (5)).
 */
export function hitTest(index: SpatialIndex, worldPoint: [number, number], tolerance: number, lockedLayers: readonly string[] = []): string[] {
  const reach = Math.max(tolerance, 0);
  const behind = reach * WORDS_BEHIND_REACH;
  // A locked layer is painted and is out of the hit-test (Decision § 1): the index holds the whole
  // sheet, and the posture the reader set decides which of its layers may answer.
  const shut = new Set(lockedLayers);
  const candidates = search(index, [worldPoint[0] - reach, worldPoint[1] - reach, worldPoint[0] + reach, worldPoint[1] + reach]);
  return candidates
    .filter((entry) => !shut.has(entry.layer))
    .map((entry) => {
      const gap = distanceTo(entry.record, worldPoint);
      return { id: entry.id, gap, rank: entry.record.text === undefined ? gap : gap + behind };
    })
    .filter((candidate) => candidate.gap <= reach)
    .sort((a, b) => a.rank - b.rank)
    .map((candidate) => candidate.id);
}

/* ------------------------------------------------------------------------- the layers' posture */

/** One row of the layers panel: the manifest's own facts, and what the reader has done to them. */
export type LayerRow = {
  readonly name: string;
  readonly rgb: readonly [number, number, number];
  readonly entityCount: number;
  /** What the reader set: whether this layer is shown at all. */
  readonly visible: boolean;
  /** Whether it is painted right now — a layer left out by an isolation is visible but not drawn. */
  readonly drawn: boolean;
  /** Locked layers are painted and are out of the hit-test (Decision § 1). */
  readonly locked: boolean;
  readonly isolated: boolean;
  /** Whether this layer's records failed to load — the partial state, shown and not hidden (I-81). */
  readonly failed: boolean;
};

/** The layer posture of one open sheet: what a panel renders and a painter and a hit-test obey. */
export type ViewerState = {
  layerRows: () => LayerRow[];
  setLayerVisible: (name: string, visible: boolean) => void;
  isolateLayer: (name: string | null) => void;
  lockLayer: (name: string, locked: boolean) => void;
  markLayerFailed: (name: string, failed: boolean) => void;
  isolatedLayer: () => string | null;
  drawnEntityCount: () => number;
  entityCount: () => number;
};

/** What the state holds per layer, beside the manifest's own facts. */
type LayerPosture = { visible: boolean; locked: boolean; failed: boolean };

/**
 * The posture of a sheet's layers, made from the head the route answered. A head that is not a
 * manifest — a refusal, or a drawing nobody has read — has no layers, so the panel is empty and both
 * counts are zero: an absence is answered as itself, never as a sheet of nothing (R-UI-050).
 */
export function createViewerState(head: ViewerHead): ViewerState {
  const layers = head.kind === "manifest" ? head.manifest.layers : [];
  const posture = new Map<string, LayerPosture>(layers.map((layer) => [layer.name, { visible: true, locked: false, failed: false }]));
  let isolated: string | null = null;

  const postureOf = (name: string): LayerPosture => {
    const held = posture.get(name);
    if (held !== undefined) return held;
    const made = { visible: true, locked: false, failed: false };
    posture.set(name, made);
    return made;
  };

  // A layer whose geometry never arrived is on no buffer, so it is not drawn however the reader has
  // set it: counting it would let the readout claim entities nobody can see (R-UI-050, I-81).
  const isDrawn = (name: string): boolean => {
    const held = postureOf(name);
    return held.visible && !held.failed && (isolated === null || isolated === name);
  };

  return {
    layerRows: () =>
      layers.map((layer) => ({
        name: layer.name,
        rgb: layer.rgb,
        entityCount: layer.entityCount,
        visible: postureOf(layer.name).visible,
        drawn: isDrawn(layer.name),
        locked: postureOf(layer.name).locked,
        isolated: isolated === layer.name,
        failed: postureOf(layer.name).failed,
      })),
    setLayerVisible: (name, visible) => {
      postureOf(name).visible = visible;
    },
    isolateLayer: (name) => {
      isolated = name;
    },
    lockLayer: (name, locked) => {
      postureOf(name).locked = locked;
    },
    markLayerFailed: (name, failed) => {
      postureOf(name).failed = failed;
    },
    isolatedLayer: () => isolated,
    drawnEntityCount: () => layers.reduce((sum, layer) => sum + (isDrawn(layer.name) ? layer.entityCount : 0), 0),
    entityCount: () => layers.reduce((sum, layer) => sum + layer.entityCount, 0),
  };
}
