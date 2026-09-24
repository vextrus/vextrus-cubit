// The basis of one traced point, re-derived from the drawing itself (I-387), and the spelling it is
// stored in (I-385). A point claims MEASURED only where it stands on the vector geometry it cites,
// and it is then stored as the DRAWING's coordinate wherever the drawing states one there — never as
// the client's word for it:
//
//   - Where a point the drawing itself determines — a vertex of a cited entity, the midpoint of one
//     of its segments, or the crossing of two cited grid axes — stands within the snap reach of the
//     stated point and on everything the point cites, the point IS that one, spelled exactly as the
//     drawing spells it.
//   - Otherwise (a nearest point, a perpendicular foot, a crossing of two entities away from their
//     vertices, a point on one grid axis) the stated point is kept only where it stands within the
//     snap reach of every entity and axis it cites.
//   - Anything farther is demoted to a free point, ENTERED, on the lattice — never refused.
//   - A point that stands on a traced scan (a RASTER_TRACE key) is INTERPRETED, never MEASURED: the
//     weakest basis of what it stands on is its own (L-QTY-01, I-387).
//
// A free coordinate is quantised only where it is truly free (I-499, I-500): a coordinate a point
// shares exactly with a point of its own ring that the drawing determined — the one Shift or Ortho
// copied from the anchor, or a rectangle's derived corner copied from a clicked one — keeps that
// point's own spelling, so an ortho run is stored square and a rectangle is stored as the rectangle.
//
// The snap reach is one micrometre of real length, through the unit the view is drawn in
// (`snapReachOf`, ./units): float noise for a viewer that computes on the drawing's own doubles, and a
// push no bill can print. It is never a lattice step: on a metre drawing a lattice step is 100 mm, and
// four corners each pushed 70 mm outward along it once read as MEASURED 2.8 % over the drawing. So a
// tampered or buggy viewer can make a figure weaker, never stronger than the drawing supports.
//
// And the view it stands in (I-375): a point standing on an entity the partition put in another view,
// or in another space, is off the named view; a free point stands in the named view only inside the
// extent that view's own entities draw.
//
// Pure: the act reads the artifact, the partition's assignments and the grid, and hands them here.
import { LATTICE_STEP } from "../identity";
import type { SourceScheme } from "../sources";
import { exact } from "../units/canon";
import { exactSpellingOf, freeSpellingOf, type JudgedPoint, type StatedPoint } from "./law";

/** A world point, as the artifact states one. */
export type DrawnPoint = readonly [number, number];

/** One path a drawn thing draws: its points, and whether it closes back to its first. */
export type DrawnPath = { readonly points: readonly DrawnPoint[]; readonly closed: boolean };

/** One drawn thing a point may cite, by its source key: the paths it (and its own paint) draws, and its space. */
export type DrawnShape = { readonly space: string; readonly paths: readonly DrawnPath[] };

/** One grid axis a bubble georeferences (L-CAD-07): the line x = position, or y = position, of one view. */
export type GridAxisLine = { readonly viewKey: string; readonly axis: string; readonly position: number };

/** The scheme of a traced scan's primitives (L-CAD-02): a point that stands on one is INTERPRETED (L-QTY-01). */
const RASTER_TRACE = "RASTER_TRACE" satisfies SourceScheme;

/** A world box, as the extent of a view's own drawing. */
export type Extent = { readonly minX: number; readonly minY: number; readonly maxX: number; readonly maxY: number };

/** What the act knows of the drawing when it judges a point. */
export type DrawingFacts = {
  /** Every drawn thing, by source key — an original merged with the paint that names it. */
  readonly shapes: ReadonlyMap<string, DrawnShape>;
  /** The view the partition put each original entity in (L-CAD-06). */
  readonly assigned: ReadonlyMap<string, string>;
  /** Every grid axis of the record, by the bubble that georeferenced it. */
  readonly axes: ReadonlyMap<string, GridAxisLine>;
};

/**
 * The view a measurement names: the partition's key for it, the space its points are in, what its
 * entities draw, and the snap reach in its own drawing units — one micrometre of real length through
 * the unit it is drawn in (`snapReachOf`, I-387).
 */
export type NamedView = { readonly viewKey: string; readonly space: string; readonly extent: Extent | null; readonly reach: string };

/** What judging one point answered: the point as it stands, or the reason it stands off the named view. */
export type PointVerdict =
  | { readonly judged: JudgedPoint; readonly demoted: boolean; readonly offView?: undefined }
  | { readonly offView: string; readonly judged?: undefined; readonly demoted?: undefined };

/** What judging one ring answered: its points as they stand and how many were demoted, or why it stands off the named view. */
export type RingVerdict =
  | { readonly judged: readonly JudgedPoint[]; readonly demoted: number; readonly offView?: undefined }
  | { readonly offView: string; readonly judged?: undefined; readonly demoted?: undefined };

/**
 * The coordinates the drawing determined for a ring, by the double each was stated at, one table per
 * axis (I-499, I-500): what a free coordinate stated at exactly that double keeps instead of the lattice.
 */
export type HeldCoordinates = { readonly x: ReadonlyMap<number, string>; readonly y: ReadonlyMap<number, string> };

/** No coordinate held: every free coordinate is on the lattice. */
const NOTHING_HELD: HeldCoordinates = { x: new Map(), y: new Map() };

/** One exact decimal of the canon. */
type Exact = ReturnType<typeof exact>;

/** A point in the canon's exact decimals, with the spelling it would be stored in. */
type ExactPoint = { readonly x: Exact; readonly y: Exact };

/** One thing a point cites, resolved against the drawing: a drawn shape, or a grid axis of the named view. */
type Cited = { readonly shape: DrawnShape; readonly axis?: undefined } | { readonly axis: GridAxisLine; readonly shape?: undefined };

/** How near a point must stand, as the reach and its square in exact decimals, and a float window no nearer thing lies outside. */
type Reach = { readonly exact: Exact; readonly squared: Exact; readonly window: number };

/** A decimal written plain, as a coordinate is stored — never an exponent, never a negative zero (I-385). */
function spelled(value: Exact): string {
  const plain = value.toFixed();
  return plain === "-0" ? "0" : plain;
}

/** A drawn coordinate in the canon's exact decimals: the double's own shortest spelling (I-385). */
const exactOf = (n: number): Exact => exact(exactSpellingOf(n));

/**
 * The reach a point is judged within: the view's snap reach, exactly, and — for skipping what cannot
 * be near before any exact arithmetic is spent on it — a float window of twice that reach plus the
 * float noise of coordinates this large, so nothing within the reach is ever skipped.
 */
function reachAround(stated: StatedPoint, view: NamedView): Reach {
  const reach = exact(view.reach);
  const magnitude = Math.max(1, Math.abs(stated.x), Math.abs(stated.y));
  return { exact: reach, squared: reach.times(reach), window: 2 * Number(view.reach) + magnitude * 1e-9 };
}

/** The squared distance from a point to a segment, in the canon's exact decimals. */
function squaredDistanceToSegment(p: ExactPoint, a: DrawnPoint, b: DrawnPoint): Exact {
  const ax = exactOf(a[0]);
  const ay = exactOf(a[1]);
  const dx = exactOf(b[0]).minus(ax);
  const dy = exactOf(b[1]).minus(ay);
  const toX = p.x.minus(ax);
  const toY = p.y.minus(ay);
  const length = dx.times(dx).plus(dy.times(dy));
  let t = length.isZero() ? exact(0) : toX.times(dx).plus(toY.times(dy)).div(length);
  if (t.isNegative()) t = exact(0);
  if (t.greaterThan(1)) t = exact(1);
  const offX = toX.minus(dx.times(t));
  const offY = toY.minus(dy.times(t));
  return offX.times(offX).plus(offY.times(offY));
}

/** Could a segment's points stand within the float window of this point at all? Its box, widened by the window. */
function withinBox(x: number, y: number, a: DrawnPoint, b: DrawnPoint, window: number): boolean {
  return x >= Math.min(a[0], b[0]) - window && x <= Math.max(a[0], b[0]) + window && y >= Math.min(a[1], b[1]) - window && y <= Math.max(a[1], b[1]) + window;
}

/** Every segment one path draws, the closing one included where it closes; a lone point is a segment of no length. */
function* segmentsOf(path: DrawnPath): Generator<readonly [DrawnPoint, DrawnPoint]> {
  const points = path.points;
  if (points.length === 1) {
    const only = points[0] as DrawnPoint;
    yield [only, only];
    return;
  }
  const count = path.closed ? points.length : points.length - 1;
  for (let index = 0; index < count; index += 1) yield [points[index] as DrawnPoint, points[(index + 1) % points.length] as DrawnPoint];
}

/** Does the point stand within the reach of anything this shape draws? */
function standsOnShape(p: ExactPoint, near: DrawnPoint, shape: DrawnShape, reach: Reach): boolean {
  for (const path of shape.paths) {
    for (const [a, b] of segmentsOf(path)) {
      if (!withinBox(near[0], near[1], a, b, reach.window)) continue;
      if (squaredDistanceToSegment(p, a, b).lessThanOrEqualTo(reach.squared)) return true;
    }
  }
  return false;
}

/** Does the point stand within the reach of this grid axis's line? */
function standsOnAxis(p: ExactPoint, axis: GridAxisLine, reach: Reach): boolean {
  const along = axis.axis === "x" ? p.x : p.y;
  return along.minus(exactOf(axis.position)).abs().lessThanOrEqualTo(reach.exact);
}

/** Does the point stand within the reach of everything it cites? */
function standsOnAll(p: ExactPoint, near: DrawnPoint, cited: readonly Cited[], reach: Reach): boolean {
  return cited.every((one) => (one.axis !== undefined ? standsOnAxis(p, one.axis, reach) : standsOnShape(p, near, one.shape, reach)));
}

/**
 * The points the drawing itself determines among what a point cites (I-385): every vertex of a cited
 * shape, the midpoint of each of its segments, and each crossing of a cited x axis with a cited y
 * axis — each with the float point it stands near, for the window, and its exact decimals.
 */
function* anchorsOf(cited: readonly Cited[]): Generator<{ readonly near: DrawnPoint; readonly at: ExactPoint }> {
  const columns: GridAxisLine[] = [];
  const rows: GridAxisLine[] = [];
  for (const one of cited) {
    if (one.axis !== undefined) {
      (one.axis.axis === "x" ? columns : rows).push(one.axis);
      continue;
    }
    for (const path of one.shape.paths) {
      for (const vertex of path.points) yield { near: vertex, at: { x: exactOf(vertex[0]), y: exactOf(vertex[1]) } };
      if (path.points.length < 2) continue;
      for (const [a, b] of segmentsOf(path)) {
        yield {
          near: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2],
          at: { x: exactOf(a[0]).plus(exactOf(b[0])).div(2), y: exactOf(a[1]).plus(exactOf(b[1])).div(2) },
        };
      }
    }
  }
  for (const column of columns) for (const row of rows) yield { near: [column.position, row.position], at: { x: exactOf(column.position), y: exactOf(row.position) } };
}

/**
 * Where a snapped point stands, in the drawing's terms, or null where it does not reproduce: the
 * drawing's own point nearest the stated one within the reach that stands on everything cited; else
 * the stated point itself where it stands within the reach of everything cited (I-387, I-385).
 */
function reproduced(stated: StatedPoint, cited: readonly Cited[], reach: Reach): ExactPoint | null {
  const at: ExactPoint = { x: exactOf(stated.x), y: exactOf(stated.y) };
  const near: DrawnPoint = [stated.x, stated.y];
  let best: { readonly at: ExactPoint; readonly squared: Exact } | null = null;
  for (const anchor of anchorsOf(cited)) {
    if (Math.abs(anchor.near[0] - stated.x) > reach.window || Math.abs(anchor.near[1] - stated.y) > reach.window) continue;
    const dx = anchor.at.x.minus(at.x);
    const dy = anchor.at.y.minus(at.y);
    const squared = dx.times(dx).plus(dy.times(dy));
    if (squared.greaterThan(reach.squared)) continue;
    // The nearest wins; of two equally near, the lesser x then y, so one statement answers one point.
    if (best !== null && (squared.comparedTo(best.squared) || anchor.at.x.comparedTo(best.at.x) || anchor.at.y.comparedTo(best.at.y)) >= 0) continue;
    if (!standsOnAll(anchor.at, anchor.near, cited, reach)) continue;
    best = { at: anchor.at, squared };
  }
  if (best !== null) return best.at;
  return standsOnAll(at, near, cited, reach) ? at : null;
}

/**
 * A free point: ENTERED, citing nothing — and inside the named view's own extent. Each coordinate is
 * on the lattice, except one the ring holds at exactly that double, which keeps the held spelling.
 */
function free(stated: StatedPoint, view: NamedView, demoted: boolean, held: HeldCoordinates): PointVerdict {
  const x = held.x.get(stated.x) ?? freeSpellingOf(stated.x);
  const y = held.y.get(stated.y) ?? freeSpellingOf(stated.y);
  const extent = view.extent;
  if (extent === null) return { offView: "a point placed free on a view that draws nothing" };
  const step = exact(LATTICE_STEP);
  const inside =
    exact(x).greaterThanOrEqualTo(exact(String(extent.minX)).minus(step)) &&
    exact(x).lessThanOrEqualTo(exact(String(extent.maxX)).plus(step)) &&
    exact(y).greaterThanOrEqualTo(exact(String(extent.minY)).minus(step)) &&
    exact(y).lessThanOrEqualTo(exact(String(extent.maxY)).plus(step));
  if (!inside) return { offView: `a point placed free at ${x}, ${y} stands outside the view` };
  return { judged: { x, y, basis: "ENTERED", sources: [] }, demoted };
}

/**
 * One stated point, judged against the drawing (I-387, I-385, I-375). A point citing nothing is free.
 * A point whose every cited key names a drawn thing (or a grid axis of the named view) and which
 * reproduces on all of them stands on the drawing, cites those keys, and is spelled as the drawing's
 * own point where one stands there — provided each cited thing stands in the named view and space, or
 * the point is off the view. It is MEASURED, or INTERPRETED where any key it cites is a traced scan's
 * (L-QTY-01: weakest wins). Anything else is demoted to free, keeping what the ring holds (`held`).
 */
export function judgePoint(stated: StatedPoint, facts: DrawingFacts, view: NamedView, held: HeldCoordinates = NOTHING_HELD): PointVerdict {
  const cites = [...new Set(stated.cites)].sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
  if (cites.length === 0) return free(stated, view, false, held);

  const cited: Cited[] = [];
  const elsewhere: string[] = [];
  for (const key of cites) {
    const axis = facts.axes.get(key);
    if (axis !== undefined && axis.viewKey === view.viewKey) {
      cited.push({ axis });
      continue;
    }
    const shape = facts.shapes.get(key);
    if (shape === undefined) return free(stated, view, true, held);
    cited.push({ shape });
    if (shape.space !== view.space || facts.assigned.get(key) !== view.viewKey) elsewhere.push(key);
  }
  const at = reproduced(stated, cited, reachAround(stated, view));
  if (at === null) return free(stated, view, true, held);
  if (elsewhere.length > 0) return { offView: `the point stands on ${elsewhere.join(", ")}, which the partition put in another view or space` };
  const basis = cites.some((key) => key.startsWith(`${RASTER_TRACE}:`)) ? "INTERPRETED" : "MEASURED";
  return { judged: { x: spelled(at.x), y: spelled(at.y), basis, sources: cites }, demoted: false };
}

/**
 * One ring, judged point by point (I-387, I-499, I-500). The points that stand on the drawing are
 * judged first; then every free or demoted point, whose coordinate keeps the spelling of a point of
 * this ring that stands on the drawing wherever it was stated at exactly that point's double — the
 * coordinate a constraint or a derived corner copied — and goes on the lattice everywhere else. The
 * first point off the named view, in ring order, answers for the ring.
 */
export function judgeRing(ring: readonly StatedPoint[], facts: DrawingFacts, view: NamedView): RingVerdict {
  const first = ring.map((point) => judgePoint(point, facts, view));
  const x = new Map<number, string>();
  const y = new Map<number, string>();
  first.forEach((verdict, index) => {
    const stated = ring[index];
    if (stated === undefined || verdict.judged === undefined || verdict.judged.sources.length === 0) return;
    // In ring order: of two drawn points stated at one double, the first holds it.
    if (!x.has(stated.x)) x.set(stated.x, verdict.judged.x);
    if (!y.has(stated.y)) y.set(stated.y, verdict.judged.y);
  });
  const held: HeldCoordinates = { x, y };
  const judged: JudgedPoint[] = [];
  let demoted = 0;
  for (const [index, point] of ring.entries()) {
    const once = first[index] as PointVerdict;
    const verdict = once.judged !== undefined && once.judged.sources.length > 0 ? once : judgePoint(point, facts, view, held);
    if (verdict.judged === undefined) return { offView: verdict.offView };
    if (verdict.demoted) demoted += 1;
    judged.push(verdict.judged);
  }
  return { judged, demoted };
}

/** The extent a view's own entities draw on one space, or null where it draws nothing there. */
export function extentOf(facts: DrawingFacts, view: { readonly viewKey: string; readonly space: string }): Extent | null {
  let extent: { minX: number; minY: number; maxX: number; maxY: number } | null = null;
  for (const [key, viewKey] of facts.assigned) {
    if (viewKey !== view.viewKey) continue;
    const shape = facts.shapes.get(key);
    if (shape === undefined || shape.space !== view.space) continue;
    for (const path of shape.paths) {
      for (const [x, y] of path.points) {
        extent =
          extent === null
            ? { minX: x, minY: y, maxX: x, maxY: y }
            : { minX: Math.min(extent.minX, x), minY: Math.min(extent.minY, y), maxX: Math.max(extent.maxX, x), maxY: Math.max(extent.maxY, y) };
      }
    }
  }
  return extent;
}
