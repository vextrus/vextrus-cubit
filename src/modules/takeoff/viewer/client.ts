// R-UI-040's client half, without a browser in it: the camera a sheet is seen through, the
// level-of-detail rule that hides text nobody could read, the spatial index hit-testing runs on, and
// the layer posture a panel row shows. Pure functions and plain objects only — no DOM global is
// touched at import, so the worker, the painter, a jsdom mount and a server render all load this
// same module (ARCH-01).
//
// Nothing here re-derives what the manifest already carries: colours, world heights and extents come
// from the server's reading (L-CAD-05), and this file decides only what is drawn and what is under
// the pointer.
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

/** Below this many device-independent pixels a glyph is a smudge, so it is not drawn (R-UI-040). */
export const LEGIBLE_TEXT_PX = 6;

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
    centre: [
      anchor[0] - (atPx.x - camera.viewport.width / 2) / scale,
      anchor[1] + (atPx.y - camera.viewport.height / 2) / scale,
    ],
  };
}

/** The camera as the address carries it: the world centre and the pixels per drawing unit (R-UI-031). */
export function serialiseViewport(camera: Camera): string {
  return `${spell(camera.centre[0])},${spell(camera.centre[1])},${spell(camera.scale)}`;
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
    viewport: { width: Math.max(viewportPx.width, 1), height: Math.max(viewportPx.height, 1) },
  };
}

/* ---------------------------------------------------------------------- level of detail (LOD) */

/** Whether text of this world height is worth drawing at this scale, in device-independent pixels. */
export function isTextLegible(heightWorld: number, scale: number): boolean {
  return Number.isFinite(heightWorld) && Number.isFinite(scale) && heightWorld * scale >= LEGIBLE_TEXT_PX;
}

/** The text of one layer that is legible under this camera — the rest is not drawn at all. */
export function legibleTexts(layer: RenderLayer, camera: Camera): RenderRecord[] {
  return layer.records.filter((record) => record.text !== undefined && isTextLegible(record.height ?? 0, camera.scale));
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
export type SpatialIndex = { readonly root: IndexNode | null; readonly size: number };

/** A world box as a query is stated in. */
export type IndexBox = { min: readonly [number, number]; max: readonly [number, number] };

/** How many entries one leaf holds — a packed R-tree's node size. */
const NODE_SIZE = 16;

/** The world box of one record: its path's, or the single point text is set at. */
function boxOf(record: RenderRecord): [number, number, number, number] | null {
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
      const id = record.key ?? record.src;
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

/** The keys of every record whose box meets this world box — what culling and marquees ask. */
export function queryIndex(index: SpatialIndex, bbox: IndexBox): string[] {
  return search(index, [bbox.min[0], bbox.min[1], bbox.max[0], bbox.max[1]]).map((entry) => entry.id);
}

/** How far a world point is from a segment of the drawing. */
function distanceToSegment(point: readonly [number, number], from: readonly [number, number], to: readonly [number, number]): number {
  const spanX = to[0] - from[0];
  const spanY = to[1] - from[1];
  const lengthSquared = spanX * spanX + spanY * spanY;
  const along = lengthSquared === 0 ? 0 : Math.min(1, Math.max(0, ((point[0] - from[0]) * spanX + (point[1] - from[1]) * spanY) / lengthSquared));
  return Math.hypot(point[0] - (from[0] + along * spanX), point[1] - (from[1] + along * spanY));
}

/** How far a world point is from a record's own geometry, not merely from its box. */
function distanceTo(record: RenderRecord, point: readonly [number, number]): number {
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
  return nearest;
}

/**
 * The keys under a world point, nearest first: the index narrows the sheet to a handful of
 * candidates and their own geometry decides, so a pointer between two lines picks the line it is
 * nearer rather than whichever box it happens to sit in.
 */
export function hitTest(index: SpatialIndex, worldPoint: [number, number], tolerance: number): string[] {
  const reach = Math.max(tolerance, 0);
  const candidates = search(index, [worldPoint[0] - reach, worldPoint[1] - reach, worldPoint[0] + reach, worldPoint[1] + reach]);
  return candidates
    .map((entry) => ({ id: entry.id, gap: distanceTo(entry.record, worldPoint) }))
    .filter((candidate) => candidate.gap <= reach)
    .sort((a, b) => a.gap - b.gap)
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

  const isDrawn = (name: string): boolean => postureOf(name).visible && (isolated === null || isolated === name);

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
