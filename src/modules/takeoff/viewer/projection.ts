// A paper sheet shows model space through its viewports. The artifact inventories each window as the
// VIEWPORT states it (where it stands on the paper, which piece of model space it looks at, at what
// height); this module does the one derivation that inventory leaves to a consumer — the scale is
// `size[1] / view_height` — and projects the model-space records the window frames onto the paper,
// clipped to the frame the way a plot clips them. Nothing here reads a camera or a token, and
// nothing here invents a fact: a projected record is the model entity's own geometry, moved and
// scaled, named by that entity's source key as `src` and by the window's handle as `via`.
//
// What is projected: a window that is switched on and not twisted. A twisted window would need a
// rotation this pass does not perform, and a window switched off shows nothing on the plot either;
// both are left out rather than approximated. A window clipped by a non-rectangular boundary is
// projected through its rectangular frame — the boundary's own geometry is paint of the sheet and
// is drawn as such, so the frame is the one reading the artifact carries.
import type { EntityGraph } from "@/core/entitygraph/schema";
// Which windows a sheet looks through, and the piece of model space each one frames, are core's one
// reading (`@/core/sheets/windows`): the sheet index, the register and the Trace ask what a sheet
// SHOWS through them (`@/core/sheets/frames`), and this projection paints what it shows through the
// very same windows (B-17).
import { modelBoxOf, projectable, type Box, type ViewportRecord } from "@/core/sheets/windows";
import type { RenderRecord } from "./types";

export { projectable, type Box, type ViewportRecord };

/**
 * One projectable window: the piece of model space it looks at (`model`), the frame it fills on the
 * paper (`paper`), and the affine map between them.
 */
export type Window = {
  readonly via: string;
  readonly scale: number;
  readonly model: Box;
  readonly paper: Box;
  readonly centre: readonly [number, number];
  readonly viewCentre: readonly [number, number];
};

/** The window a projectable viewport opens: its model box, its paper frame and the map between. */
export function windowOf(viewport: ViewportRecord): Window {
  const scale = viewport.size[1] / viewport.view_height;
  const [cx, cy] = viewport.centre;
  return {
    via: viewport.handle,
    scale,
    model: modelBoxOf(viewport),
    paper: [cx - viewport.size[0] / 2, cy - viewport.size[1] / 2, cx + viewport.size[0] / 2, cy + viewport.size[1] / 2],
    centre: viewport.centre,
    viewCentre: viewport.view_centre,
  };
}

/** The windows of one layout's inventory that this pass projects through, in the drawing's order. */
export function windowsOf(layout: EntityGraph["layouts"][number] | undefined): Window[] {
  return (layout?.viewports ?? []).filter(projectable).map(windowOf);
}

/** The frames of these windows on the paper, as one box — the extents a sheet of windows alone has. */
export function unionOfFrames(windows: readonly Window[]): { min: [number, number]; max: [number, number] } | null {
  if (windows.length === 0) return null;
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const window of windows) {
    minX = Math.min(minX, window.paper[0]);
    minY = Math.min(minY, window.paper[1]);
    maxX = Math.max(maxX, window.paper[2]);
    maxY = Math.max(maxY, window.paper[3]);
  }
  return { min: [minX, minY], max: [maxX, maxY] };
}

/** The box of a record's points, or of its anchor alone, or null for a record that stands nowhere. */
function boxOf(record: RenderRecord): Box | null {
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

function inside(box: Box, point: readonly [number, number]): boolean {
  return point[0] >= box[0] && point[0] <= box[2] && point[1] >= box[1] && point[1] <= box[3];
}

function contains(outer: Box, inner: Box): boolean {
  return inner[0] >= outer[0] && inner[1] >= outer[1] && inner[2] <= outer[2] && inner[3] <= outer[3];
}

function intersects(a: Box, b: Box): boolean {
  return a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];
}

/** One model point on the paper, through a window. */
function project(window: Window, point: readonly [number, number]): [number, number] {
  return [window.centre[0] + (point[0] - window.viewCentre[0]) * window.scale, window.centre[1] + (point[1] - window.viewCentre[1]) * window.scale];
}

/**
 * One segment clipped to a box (Liang–Barsky), or null where none of it lies inside. A segment that
 * only touches the box at a point is kept as that point twice, which the run builder drops.
 */
function clipSegment(box: Box, from: readonly [number, number], to: readonly [number, number]): [[number, number], [number, number]] | null {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  let enter = 0;
  let leave = 1;
  const edges: readonly (readonly [number, number])[] = [
    [-dx, from[0] - box[0]],
    [dx, box[2] - from[0]],
    [-dy, from[1] - box[1]],
    [dy, box[3] - from[1]],
  ];
  for (const [p, q] of edges) {
    if (p === 0) {
      if (q < 0) return null;
      continue;
    }
    const t = q / p;
    if (p < 0) {
      if (t > leave) return null;
      if (t > enter) enter = t;
    } else {
      if (t < enter) return null;
      if (t < leave) leave = t;
    }
  }
  return [
    [from[0] + enter * dx, from[1] + enter * dy],
    [from[0] + leave * dx, from[1] + leave * dy],
  ];
}

/**
 * A polyline clipped to a box: the runs of it that lie inside, each at least two points long, in
 * model coordinates. A closed outline is clipped as its closed ring; where its last run meets its
 * first at the ring's start vertex the two are one run, so a ring cut once is one open piece and
 * not two meeting at an arbitrary seam.
 */
export function clipPolyline(points: readonly (readonly [number, number])[], closed: boolean, box: Box): [number, number][][] {
  const runs: [number, number][][] = [];
  let run: [number, number][] = [];
  const count = points.length;
  const segments = closed && count >= 3 ? count : count - 1;
  for (let at = 0; at < segments; at += 1) {
    const from = points[at] as readonly [number, number];
    const to = points[(at + 1) % count] as readonly [number, number];
    const piece = clipSegment(box, from, to);
    if (piece === null) {
      if (run.length >= 2) runs.push(run);
      run = [];
      continue;
    }
    const [start, end] = piece;
    const continues = run.length > 0 && same(run[run.length - 1] as [number, number], start);
    if (!continues) {
      if (run.length >= 2) runs.push(run);
      run = [start];
    }
    if (!same(run[run.length - 1] as [number, number], end)) run.push(end);
  }
  if (run.length >= 2) runs.push(run);
  if (closed && runs.length >= 2) {
    const first = runs[0] as [number, number][];
    const last = runs[runs.length - 1] as [number, number][];
    if (same(last[last.length - 1] as [number, number], first[0] as [number, number])) {
      runs.pop();
      runs[0] = [...last, ...first.slice(1)];
    }
  }
  return runs;
}

function same(a: readonly [number, number], b: readonly [number, number]): boolean {
  return a[0] === b[0] && a[1] === b[1];
}

/**
 * One model-space record seen through one window: nothing where the window does not frame it, the
 * whole record moved and scaled where the window frames all of it, and its clipped pieces where the
 * frame cuts it. Text is placed by its anchor and is either in the window or not; its world height
 * becomes a paper height. Every piece names the model entity as `src` and the window as `via`.
 */
export function projectRecord(record: RenderRecord, window: Window): RenderRecord[] {
  const box = boxOf(record);
  if (box === null || !intersects(window.model, box)) return [];
  const src = record.key ?? record.src;
  if (src === undefined) return [];
  // Everything but the geometry and the identity: the identity is the model entity's, as `src`.
  const open: RenderRecord = { src, via: window.via, type: record.type, rgb: record.rgb };

  if (record.text !== undefined) {
    if (record.anchor === undefined || !inside(window.model, record.anchor)) return [];
    return [
      {
        ...open,
        text: record.text,
        anchor: project(window, record.anchor),
        ...(record.height === undefined ? {} : { height: record.height * window.scale }),
      },
    ];
  }

  const points = record.points;
  if (points === undefined || points.length === 0) return [];
  const whole: RenderRecord = record.closed === undefined ? open : { ...open, closed: record.closed };
  if (points.length === 1) {
    const only = points[0] as readonly [number, number];
    return inside(window.model, only) ? [{ ...whole, points: [project(window, only)] }] : [];
  }
  if (contains(window.model, box)) {
    return [{ ...whole, points: points.map((point) => project(window, point)) }];
  }
  // Cut by the frame: the pieces are open runs of the outline, whatever the whole was.
  const runs = clipPolyline(points, record.closed === true, window.model);
  return runs.map((run) => ({ ...open, points: run.map((point) => project(window, point)) }));
}

/**
 * Every model-space record of a graph as one layout's windows show it, window by window in the
 * drawing's order, then record by record in the artifact's order. `renderOf` turns an artifact
 * record into its render record (the manifest's own reading of colour, height and anchor), so the
 * projection restates none of that.
 */
export function projectedRecords<R extends EntityGraph["entities"][number] | EntityGraph["derived"][number]>(
  modelRecords: readonly R[],
  windows: readonly Window[],
  renderOf: (record: R) => RenderRecord,
): { record: RenderRecord; layer: string }[] {
  const out: { record: RenderRecord; layer: string }[] = [];
  if (windows.length === 0) return out;
  const rendered = modelRecords.map((record) => ({ layer: record.layer, render: renderOf(record) }));
  for (const window of windows) {
    for (const { layer, render } of rendered) {
      for (const piece of projectRecord(render, window)) out.push({ record: piece, layer });
    }
  }
  return out;
}
