// R-TO-012's snapping, as arithmetic: the six kinds resolved over the records near the pointer, the
// two constraints a taken pick anchors, and the two figures the readout states. Pure — no DOM, no
// camera, no clock — so what a reader sees on the sheet is a function of the drawing and nothing else.
//
// Everything here is computed in DRAWING units (R-UI-041): the screen converts its 8 px of reach into
// the drawing's own units at the camera's scale and asks in those, so a snap reaches equally far at
// every zoom. The snapped point is carried into a key through the register's ONE lattice (L-REG-04's
// `quantise`), never through a second rounding of this module's own (B-17).
import Decimal from "decimal.js";
import { quantise } from "@/core/identity/keys";
import { recordKey } from "@/modules/takeoff/viewer/client";
import type { GridAxisRow } from "@/modules/takeoff/partition";
import { SNAP_PRIORITY } from "./types";
import type { GridIntersection, SnapBox, SnapCalibration, SnapCalibrationView, SnapCandidate, SnapInput, SnapKind, SnapPoint, SnapResult } from "./types";

export { SNAP_KINDS, SNAP_PRIORITY } from "./types";
export type { GridIntersection, SnapCalibration, SnapCalibrationView, SnapCandidate, SnapInput, SnapKind, SnapPick, SnapPoint, SnapResult } from "./types";

/**
 * How far a snap reaches on the READER's screen, in CSS pixels. The screen divides it by the camera's
 * pixels-per-unit to ask in drawing units, so the reach is the same distance under the hand at every
 * zoom (I-147). A code constant rather than a stylesheet value: no surface transcribes it (Decision §5).
 */
export const SNAP_TOLERANCE_PX = 8;

/** The angle lock's step, in degrees (Decision §5). */
export const ANGLE_STEP_DEG = 15;

/** How many decimals a metre figure is stated to (Decision §5, L-MEA-05). */
const METRE_DECIMALS = 3;

/** One feature of the drawing a snap can land on, with what it would be met as. */
type Feature = {
  readonly kind: SnapKind;
  readonly point: readonly [number, number];
  readonly sourceKeys: readonly string[];
};

/** One drawn record read for snapping: what it is called, and the points it actually draws. */
type Geometry = {
  readonly key: string;
  readonly points: readonly (readonly [number, number])[];
};

/**
 * The points a record draws, or none where it draws none the drawing can stand on. A record carrying
 * a coordinate that is not finite is no geometry of the drawing at all — it offers no snap rather
 * than throwing where it is drawn, and the sound records beside it are still snapped to.
 */
function geometryOf(candidate: SnapCandidate): Geometry | null {
  const key = recordKey(candidate);
  const points = candidate.points ?? (candidate.anchor === undefined ? undefined : [candidate.anchor]);
  if (key === undefined || points === undefined || points.length === 0) return null;
  for (const point of points) if (!Number.isFinite(point[0]) || !Number.isFinite(point[1])) return null;
  return { key, points };
}

/**
 * A world point carried onto the register's one lattice (L-REG-04), as the pair of strings a key is
 * written from. It is `quantise` and nothing else: a second rounding of this module's own would be a
 * second lattice, and two lattices are two identities for one placement (B-17).
 */
export function keyPointOf(point: SnapPoint): [string, string] {
  return [quantise(point[0]), quantise(point[1])];
}

/** How far apart two world points stand, in drawing units. */
export function distanceBetween(a: SnapPoint, b: SnapPoint): number {
  return Math.hypot(b[0] - a[0], b[1] - a[1]);
}

/** Where along a segment a point's perpendicular foot falls: 0 at its start, 1 at its end. */
function alongSegment(point: SnapPoint, from: SnapPoint, to: SnapPoint): number | null {
  const spanX = to[0] - from[0];
  const spanY = to[1] - from[1];
  const lengthSquared = spanX * spanX + spanY * spanY;
  if (lengthSquared === 0) return null;
  return ((point[0] - from[0]) * spanX + (point[1] - from[1]) * spanY) / lengthSquared;
}

/** The point a fraction of the way along a segment. */
function atFraction(from: SnapPoint, to: SnapPoint, along: number): [number, number] {
  return [from[0] + along * (to[0] - from[0]), from[1] + along * (to[1] - from[1])];
}

/** Every segment of one record, in the order it is drawn. */
function* segmentsOf(geometry: Geometry): Generator<{ from: SnapPoint; to: SnapPoint }> {
  for (let at = 1; at < geometry.points.length; at += 1) {
    yield { from: geometry.points[at - 1] as SnapPoint, to: geometry.points[at] as SnapPoint };
  }
}

/** Where two segments cross, or null where they run apart, run parallel, or only meet beyond their ends. */
function crossingOf(a: { from: SnapPoint; to: SnapPoint }, b: { from: SnapPoint; to: SnapPoint }): [number, number] | null {
  const aX = a.to[0] - a.from[0];
  const aY = a.to[1] - a.from[1];
  const bX = b.to[0] - b.from[0];
  const bY = b.to[1] - b.from[1];
  const denominator = aX * bY - aY * bX;
  if (denominator === 0) return null;
  const alongA = ((b.from[0] - a.from[0]) * bY - (b.from[1] - a.from[1]) * bX) / denominator;
  const alongB = ((b.from[0] - a.from[0]) * aY - (b.from[1] - a.from[1]) * aX) / denominator;
  if (alongA < 0 || alongA > 1 || alongB < 0 || alongB > 1) return null;
  return atFraction(a.from, a.to, alongA);
}

/** Every feature of one kind the drawing offers near the pointer, unfiltered by reach. */
function featuresOfKind(kind: SnapKind, geometries: readonly Geometry[], input: SnapInput): Feature[] {
  const found: Feature[] = [];

  if (kind === "endpoint") {
    // Every point the drawing actually draws is an end a hand can meet: a segment's two, and each
    // vertex of a polyline, which is where two of its segments end.
    for (const geometry of geometries) for (const point of geometry.points) found.push({ kind, point: [point[0], point[1]], sourceKeys: [geometry.key] });
    return found;
  }

  if (kind === "midpoint") {
    for (const geometry of geometries) for (const segment of segmentsOf(geometry)) found.push({ kind, point: atFraction(segment.from, segment.to, 0.5), sourceKeys: [geometry.key] });
    return found;
  }

  if (kind === "nearest") {
    for (const geometry of geometries) {
      const only = geometry.points[0] as SnapPoint;
      if (geometry.points.length === 1) {
        found.push({ kind, point: [only[0], only[1]], sourceKeys: [geometry.key] });
        continue;
      }
      for (const segment of segmentsOf(geometry)) {
        const along = alongSegment(input.cursor, segment.from, segment.to);
        if (along === null) continue;
        found.push({ kind, point: atFraction(segment.from, segment.to, Math.min(1, Math.max(0, along))), sourceKeys: [geometry.key] });
      }
    }
    return found;
  }

  if (kind === "perpendicular") {
    // A perpendicular is dropped FROM the first pick: with no pick standing there is no anchor to
    // drop one from, so the kind is not offered at all rather than offered from somewhere nobody
    // chose (I-148).
    const anchor = input.firstPick;
    if (anchor === null) return found;
    for (const geometry of geometries) {
      for (const segment of segmentsOf(geometry)) {
        const along = alongSegment(anchor, segment.from, segment.to);
        if (along === null || along < 0 || along > 1) continue;
        found.push({ kind, point: atFraction(segment.from, segment.to, along), sourceKeys: [geometry.key] });
      }
    }
    return found;
  }

  if (kind === "intersection") {
    for (let left = 0; left < geometries.length; left += 1) {
      for (let right = left + 1; right < geometries.length; right += 1) {
        const one = geometries[left] as Geometry;
        const other = geometries[right] as Geometry;
        // Two records painted under one identity are one thing crossing itself, which is no crossing
        // a reader means (I-86: a derived record answers the key of what it was painted from).
        if (one.key === other.key) continue;
        for (const first of segmentsOf(one)) {
          for (const second of segmentsOf(other)) {
            const crossing = crossingOf(first, second);
            if (crossing !== null) found.push({ kind, point: crossing, sourceKeys: [one.key, other.key] });
          }
        }
      }
    }
    return found;
  }

  for (const crossing of input.grid) found.push({ kind, point: [crossing.point[0], crossing.point[1]], sourceKeys: [...crossing.sourceKeys] });
  return found;
}

/**
 * What the pointer met, or null where it met nothing within reach.
 *
 * The winner is decided by PRIORITY and only then by proximity (I-147): the ladder is walked from
 * endpoint down to nearest, and the first kind with anything inside the tolerance answers — the
 * nearest of that kind's own features. So a pointer at a vertex meets the end of the line every time
 * rather than flickering between its end and the nearest point along it.
 */
export function resolveSnap(input: SnapInput): SnapResult | null {
  const geometries: Geometry[] = [];
  for (const candidate of input.candidates) {
    const geometry = geometryOf(candidate);
    if (geometry !== null) geometries.push(geometry);
  }

  for (const kind of SNAP_PRIORITY) {
    let met: Feature | null = null;
    let nearest = Number.POSITIVE_INFINITY;
    for (const feature of featuresOfKind(kind, geometries, input)) {
      const gap = distanceBetween(input.cursor, feature.point);
      if (gap > input.tolerance || gap >= nearest) continue;
      met = feature;
      nearest = gap;
    }
    if (met === null) continue;
    return { kind: met.kind, point: [met.point[0], met.point[1]], sourceKeys: [...met.sourceKeys], keyPoint: keyPointOf(met.point) };
  }
  return null;
}

/**
 * Every crossing of the stored grid: each `x` axis met with each `y` axis OF THE SAME VIEW, sourced
 * by the two bubbles that georeferenced them, in `[x, y]` order so a reader of `sourceKeys` knows
 * which bubble is which. Two views' axes never pair (I-149): a crossing of one view's column with
 * another's row stands nowhere on either grid, and an axis alone crosses nothing at all.
 */
export function gridIntersectionsOf(axes: readonly GridAxisRow[]): GridIntersection[] {
  const columns = axes.filter((row) => row.axis === "x");
  const rows = axes.filter((row) => row.axis === "y");
  const found: GridIntersection[] = [];
  for (const column of columns) {
    for (const row of rows) {
      if (row.viewKey !== column.viewKey) continue;
      found.push({ point: [column.position, row.position], sourceKeys: [column.bubbleKey, row.bubbleKey], viewKey: column.viewKey });
    }
  }
  return found;
}

/**
 * The point ortho leaves a segment at: the world axis the hand travelled furthest along, kept at the
 * length it travelled, and the other zeroed. Keeping the shorter axis instead would move the point a
 * reader was aiming at (I-148).
 */
export function constrainOrtho(anchor: SnapPoint, point: SnapPoint): [number, number] {
  const dx = point[0] - anchor[0];
  const dy = point[1] - anchor[1];
  return Math.abs(dx) >= Math.abs(dy) ? [anchor[0] + dx, anchor[1]] : [anchor[0], anchor[1] + dy];
}

/**
 * The point the angle lock leaves a segment at: the direction turned to the nearest whole step, at
 * the reach the hand travelled. The lock turns the segment; it never lengthens or shortens it.
 */
export function constrainAngle(anchor: SnapPoint, point: SnapPoint, stepDeg: number): [number, number] {
  const dx = point[0] - anchor[0];
  const dy = point[1] - anchor[1];
  const reach = Math.hypot(dx, dy);
  if (reach === 0 || stepDeg <= 0) return [point[0], point[1]];
  const step = (stepDeg * Math.PI) / 180;
  const turned = Math.round(Math.atan2(dy, dx) / step) * step;
  return [anchor[0] + reach * Math.cos(turned), anchor[1] + reach * Math.sin(turned)];
}

/** Does this world box hold this point? A point on the edge stands inside the view that drew it. */
function boxHolds(box: SnapBox, point: SnapPoint): boolean {
  return point[0] >= box.min[0] && point[0] <= box.max[0] && point[1] >= box.min[1] && point[1] <= box.max[1];
}

/**
 * The view whose affirmed scale measures the segment between two picks, or null where none does
 * (I-146): the factors of a view are the factors of what stands INSIDE it, so both picks must stand
 * inside one calibrated view's box. Two picks in two different views, or in a view no act has
 * affirmed, are measured in the drawing's own units and said to be — never carried into metres by a
 * scale that was never affirmed over them (L-MEA-05, R-UI-041).
 */
export function viewMeasuring(calibration: SnapCalibration | null, a: SnapPoint, b: SnapPoint): SnapCalibrationView | null {
  if (calibration === null) return null;
  for (const view of calibration.views) {
    if (view.box !== null && boxHolds(view.box, a) && boxHolds(view.box, b)) return view;
  }
  return null;
}

/**
 * The metres between two picks under one view's affirmed calibration: each axis carried by ITS OWN
 * factor and the two composed, `√((Δx·factorX)² + (Δy·factorY)²)`, computed in decimal over the
 * stored 12-place strings. The two factors are never averaged (L-MEA-05, I-146): a mean of an
 * anisotropic pair is a measurement nobody took.
 */
export function metresBetween(a: SnapPoint, b: SnapPoint, factors: { factorX: string; factorY: string }): string {
  const acrossX = new Decimal(b[0]).minus(a[0]).times(factors.factorX);
  const acrossY = new Decimal(b[1]).minus(a[1]).times(factors.factorY);
  return acrossX.times(acrossX).plus(acrossY.times(acrossY)).sqrt().toFixed(METRE_DECIMALS);
}
