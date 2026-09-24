// R-TO-036's "room/space outlines from wall geometry": the closed regions an architect's plan encloses
// between the INNER FACES of its walls, read as a planar arrangement (s-takeoff I-643).
//
// An architect's plan never draws a room. It draws walls — two face lines a WALL TYPES thickness apart,
// which the wall lane has already read into runs (`../walls/pairs`, I-593) — and the room is what the
// faces enclose. So the solids of the arrangement are:
//   · every wall run the lane placed, as the band between its two faces. A run already spans the gaps
//     the drawing says a wall runs across — an opening's (its threshold belongs to neither room) and a
//     junction's — and stops at every other, so an archway's gap stays open and two labelled spaces
//     either side of it are one room (F-ARCH A-13);
//   · a wall run bridged ALONG ITS OWN LINE through a closed ring it ends in — a column the wall stops
//     at, whose ring covers the wall's whole width there. The room's outline runs along the wall's
//     face as though the wall ran through the column; the column is an obstruction INSIDE the outline
//     (F-ARCH A-14), never a notch in it. Nothing else is bridged: a gap no ring and no run closes is a
//     gap, and the room behind it is not closed (T-UNCLOSED-WALL: 60 mm short is not closed);
//   · every other closed ring that touches a solid — a lift core's concrete, a low wall — since the
//     room is bounded by what the plan cuts through, whatever it is built of. A ring touching nothing
//     (a rug, a tag's circle, a grid bubble) bounds nothing, and a ring drawn round a word is the
//     word's tag;
//   · a curved wall drawn as two concentric arcs, both drawn (a single arc is a door's swing, never a
//     wall), as the band between them.
//
// The arrangement is cut exactly as path 2 of the fixture's own golden cuts it (split every solid edge
// where another meets it, walk the half-edges, keep the bounded faces no solid covers), with snapping:
// two vertices within the drawing's congruence tolerance are one. A face's area is its shoelace over
// the points as drawn, plus — where an edge is a chord of a flattened arc — the circular segment
// between chord and arc; and L-FRM-01's 0.5 % is then the check that the stored area and the
// outline's own shoelace are one figure (a flattening too coarse to carry the arc refuses by name).
//
// Pure over what it is handed: no store, no clock, no model (L-REG-04).
import type Decimal from "decimal.js";
import { exact } from "@/core/units/canon";
import { insideRing, type Point } from "../placement/edge-pairs";

export type { Point } from "../placement/edge-pairs";

/** A band of wall, as the arrangement is handed one: its axis and how thick it is drawn. */
export type WallBand = {
  readonly key: string;
  readonly from: Point;
  readonly to: Point;
  /** The thickness in drawing units. */
  readonly drawn: number;
  /** The entities that draw it (its face lines), which a room it bounds cites. */
  readonly sourceKeys: readonly string[];
};

/** A closed ring the plan draws, and the entity that draws it. */
export type DrawnRing = { readonly key: string; readonly points: readonly Point[] };

/** An arc the plan draws, already flattened by the extractor into the points it is drawn through. */
export type DrawnArc = { readonly key: string; readonly points: readonly Point[] };

/** What the arrangement is cut from on one plan. */
export type RegionEvidence = {
  readonly walls: readonly WallBand[];
  readonly rings: readonly DrawnRing[];
  readonly arcs: readonly DrawnArc[];
  /** Where the plan's words stand: a ring drawn round one is its tag, never a solid. */
  readonly words: readonly Point[];
  /** The congruence the drawing is read to: two points nearer than this are one. */
  readonly tolerance: number;
};

/** One closed region no solid covers: its outline (anticlockwise), its holes (clockwise), and its area. */
export type ClosedRegion = {
  readonly outer: readonly Point[];
  readonly holes: readonly (readonly Point[])[];
  /** The area the region encloses, arcs carried as arcs, in drawing units squared. */
  readonly area: Decimal;
  /** The shoelace of the flattened outline alone — what the stored area is checked against. */
  readonly shoelace: Decimal;
  /** The entities whose solids bound it, sorted: what the room was read off (L-CAD-03). */
  readonly sourceKeys: readonly string[];
};

/** Everything one plan's arrangement answers: the regions, and which rings were bridged as obstructions. */
export type Arrangement = {
  readonly regions: readonly ClosedRegion[];
  /** The rings a wall was bridged through — the obstructions standing inside the outlines they touch. */
  readonly obstructions: readonly string[];
};

/** One solid of the arrangement: its ring, the entities drawing it, and the arc its edges carry, if any. */
type Solid = { readonly ring: readonly Point[]; readonly keys: readonly string[]; readonly arc: Circle | null };

/** A circle an arc is drawn on. */
type Circle = { readonly centre: Point; readonly r: number };

/** How few points a closed ring may be drawn from and still enclose an area. */
const FEWEST_RING_POINTS = 3;

/** How many tolerances a face's probe point stands inside its longest edge. */
const PROBE_TOLERANCES = 4;

/** L-FRM-01: a stored plan area disagreeing with its own polygon's shoelace by more than 0.5 % refuses. */
export const SHOELACE_AGREEMENT = "0.005";

/**
 * The closed regions one plan's walls enclose (I-643). Total over any evidence: a plan whose walls
 * enclose nothing answers no region.
 */
export function arrangementOf(evidence: RegionEvidence): Arrangement {
  const tolerance = evidence.tolerance;
  const frames = evidence.walls.map(frameOf);
  const rings = evidence.rings.filter((ring) => ring.points.length >= FEWEST_RING_POINTS && !evidence.words.some((word) => insideRing(word, ring.points)));

  // Where a band ends in a ring covering its whole width: the band may run on through it.
  const entries: Entry[] = [];
  frames.forEach((frame, band) => {
    for (const atEnd of [false, true]) {
      const corners = cornersAt(frame, atEnd);
      const outward: Point = atEnd ? frame.u : [-frame.u[0], -frame.u[1]];
      for (const ring of rings) {
        if (!isConvex(ring.points) || !corners.every((corner) => withinOrOn(corner, ring.points, tolerance))) continue;
        const exit = Math.max(...corners.map((corner) => exitAlong(corner, outward, ring.points)));
        if (exit > tolerance) entries.push({ band, atEnd, ring: ring.key, exit });
      }
    }
  });

  // A ring is a column — an obstruction standing inside the rooms it touches — where the walls that
  // meet it run into it whole. A ring a wall merely ABUTS is a wall itself (a lift core's concrete),
  // and so is a ring only one wall runs into that touches such a wall-ring (the core's cross piece):
  // a column stands where two walls meet or one runs through, and a core is drawn as pieces (I-643).
  const bandRings = frames.map((frame) => rectOf(frame, 0, frame.length));
  const entered = (ring: string): number => new Set(entries.filter((entry) => entry.ring === ring).map((entry) => entry.band)).size;
  const walled = new Set<string>();
  for (const ring of rings) {
    const touching = bandRings.flatMap((rect, band) => (touches(rect, ring.points, tolerance) ? [band] : []));
    if (touching.some((band) => !entries.some((entry) => entry.band === band && entry.ring === ring.key))) walled.add(ring.key);
  }
  let spread = true;
  while (spread) {
    spread = false;
    for (const ring of rings) {
      if (walled.has(ring.key) || entered(ring.key) > 1) continue;
      if (!rings.some((other) => walled.has(other.key) && touches(other.points, ring.points, tolerance))) continue;
      walled.add(ring.key);
      spread = true;
    }
  }
  const columns = new Set(entries.filter((entry) => !walled.has(entry.ring)).map((entry) => entry.ring));

  // Each band carried through the columns it ends in — to the column's far face, or, where another
  // wall runs into the same column across it, to that wall's far face and no further: the corner of
  // two walls meeting in a column is where their faces meet (F-ARCH A-14).
  const bands: Solid[] = frames.map((frame, band) => {
    let start = 0;
    let end = frame.length;
    for (const entry of entries.filter((one) => one.band === band && columns.has(one.ring))) {
      const crossing = entries
        .filter((other) => other.ring === entry.ring && other.band !== band && columns.has(other.ring))
        .flatMap((other) => {
          const far = farFaceAlong(frame, entry.atEnd, frames[other.band] as Frame, tolerance);
          return far === null ? [] : [far];
        });
      const reach = crossing.length === 0 ? entry.exit : Math.min(entry.exit, Math.max(...crossing));
      if (entry.atEnd) end = Math.max(end, frame.length + reach);
      else start = Math.min(start, -reach);
    }
    return { ring: rectOf(frame, start, end), keys: [...frame.wall.sourceKeys], arc: null };
  });

  const corners = cornerFills(frames, tolerance);

  const candidates: Solid[] = [...rings.filter((ring) => !columns.has(ring.key)).map((ring) => ({ ring: ring.points, keys: [ring.key], arc: null })), ...arcBands(evidence.arcs, tolerance)];

  // A ring bounds a room only where it touches what does: grown from the walls outward, so a core
  // piece touching a core piece touching a wall bounds, and a rug touching nothing does not.
  const solids: Solid[] = [...bands, ...corners];
  let grown = true;
  while (grown) {
    grown = false;
    for (let index = candidates.length - 1; index >= 0; index -= 1) {
      const candidate = candidates[index] as Solid;
      if (!solids.some((solid) => touches(solid.ring, candidate.ring, tolerance))) continue;
      solids.push(candidate);
      candidates.splice(index, 1);
      grown = true;
    }
  }
  return { regions: freeFaces(solids, tolerance), obstructions: [...columns].sort() };
}

/**
 * The corner square two walls meeting at an L leave open. The wall lane runs each to where their axes
 * meet (I-593), so each band stops square on the other's axis and the OUTER quadrant of the corner is
 * drawn by neither — a notch that would add a thickness-square of floor to the room wrapped round the
 * corner, measured where a wall stands. It is filled to where the two outer faces meet.
 */
function cornerFills(frames: readonly Frame[], tolerance: number): Solid[] {
  const fills: Solid[] = [];
  const ends = frames.flatMap((frame) => [
    { frame, atEnd: false, at: frame.wall.from },
    { frame, atEnd: true, at: frame.wall.to },
  ]);
  for (let i = 0; i < ends.length; i += 1) {
    for (let j = i + 1; j < ends.length; j += 1) {
      const a = ends[i] as (typeof ends)[number];
      const b = ends[j] as (typeof ends)[number];
      if (a.frame === b.frame || distance(a.at, b.at) > tolerance) continue;
      const corner = a.at;
      // Each band's body runs away from the corner.
      const bodyA: Point = a.atEnd ? [-a.frame.u[0], -a.frame.u[1]] : a.frame.u;
      const bodyB: Point = b.atEnd ? [-b.frame.u[0], -b.frame.u[1]] : b.frame.u;
      const den = bodyA[0] * bodyB[1] - bodyA[1] * bodyB[0];
      if (Math.abs(den) <= 1e-9) continue;
      // The outer face of each is the one on the side away from the other band's body.
      const sideA = Math.sign(a.frame.n[0] * bodyB[0] + a.frame.n[1] * bodyB[1]) || 1;
      const sideB = Math.sign(b.frame.n[0] * bodyA[0] + b.frame.n[1] * bodyA[1]) || 1;
      const outerA: Point = [corner[0] - sideA * a.frame.n[0], corner[1] - sideA * a.frame.n[1]];
      const outerB: Point = [corner[0] - sideB * b.frame.n[0], corner[1] - sideB * b.frame.n[1]];
      // Where the outer faces meet: outerA + s·bodyA = outerB + r·bodyB.
      const s = ((outerB[0] - outerA[0]) * bodyB[1] - (outerB[1] - outerA[1]) * bodyB[0]) / den;
      const meet: Point = [outerA[0] + s * bodyA[0], outerA[1] + s * bodyA[1]];
      // Only the corner's own faces reach it: past twice the thicker wall it is no corner of these two.
      if (distance(meet, corner) > Math.max(a.frame.wall.drawn, b.frame.wall.drawn) * 2) continue;
      fills.push({ ring: [corner, outerA, meet, outerB], keys: [...a.frame.wall.sourceKeys, ...b.frame.wall.sourceKeys], arc: null });
    }
  }
  return fills;
}

/** One band read off its wall: the axis, its direction, the half-thickness square to it, and its length. */
type Frame = { readonly wall: WallBand; readonly length: number; readonly u: Point; readonly n: Point };

/** A band ending in a ring that covers its whole width, and how far on its line the ring runs. */
type Entry = { readonly band: number; readonly atEnd: boolean; readonly ring: string; readonly exit: number };

/** A wall's band, framed. */
function frameOf(wall: WallBand): Frame {
  const length = distance(wall.from, wall.to);
  const u: Point = length > 0 ? [(wall.to[0] - wall.from[0]) / length, (wall.to[1] - wall.from[1]) / length] : [1, 0];
  return { wall, length, u, n: [-u[1] * (wall.drawn / 2), u[0] * (wall.drawn / 2)] };
}

/** The two face points at one end of a band. */
function cornersAt(frame: Frame, atEnd: boolean): Point[] {
  const at = atEnd ? frame.wall.to : frame.wall.from;
  return [
    [at[0] + frame.n[0], at[1] + frame.n[1]],
    [at[0] - frame.n[0], at[1] - frame.n[1]],
  ];
}

/** The band between two distances along its axis, as a ring. */
function rectOf(frame: Frame, start: number, end: number): Point[] {
  const { wall, u, n } = frame;
  const a: Point = [wall.from[0] + u[0] * start, wall.from[1] + u[1] * start];
  const b: Point = [wall.from[0] + u[0] * end, wall.from[1] + u[1] * end];
  return [
    [a[0] + n[0], a[1] + n[1]],
    [b[0] + n[0], b[1] + n[1]],
    [b[0] - n[0], b[1] - n[1]],
    [a[0] - n[0], a[1] - n[1]],
  ];
}

/**
 * How far past one end of a band its line runs before it leaves the far face of another band that
 * crosses it — null where the two run alongside each other (a column between two pieces of one wall).
 */
function farFaceAlong(frame: Frame, atEnd: boolean, other: Frame, tolerance: number): number | null {
  const outward: Point = atEnd ? frame.u : [-frame.u[0], -frame.u[1]];
  const across: Point = [-other.u[1], other.u[0]];
  const den = outward[0] * across[0] + outward[1] * across[1];
  if (Math.abs(den) <= tolerance / Math.max(frame.length, 1)) return null;
  const at = atEnd ? frame.wall.to : frame.wall.from;
  const half = other.wall.drawn / 2;
  const offset = (at[0] - other.wall.from[0]) * across[0] + (at[1] - other.wall.from[1]) * across[1];
  const far = Math.max((half - offset) / den, (-half - offset) / den);
  return far > tolerance ? far : null;
}

/**
 * The curved walls a plan draws: two arcs on one centre, each drawn through the same sweep — the band
 * between them, closed straight across at each end. A single arc is a door's swing and bounds nothing.
 */
function arcBands(arcs: readonly DrawnArc[], tolerance: number): Solid[] {
  const read = arcs.flatMap((arc) => {
    const circle = circleOf(arc.points, tolerance);
    return circle === null ? [] : [{ arc, circle }];
  });
  const solids: Solid[] = [];
  const used = new Set<string>();
  for (const inner of read) {
    if (used.has(inner.arc.key)) continue;
    const partner = read
      .filter((other) => other.arc.key !== inner.arc.key && !used.has(other.arc.key))
      .filter((other) => distance(other.circle.centre, inner.circle.centre) <= tolerance && other.circle.r > inner.circle.r + tolerance)
      .sort((left, right) => left.circle.r - right.circle.r)[0];
    if (partner === undefined) continue;
    used.add(inner.arc.key);
    used.add(partner.arc.key);
    // The inner arc's chords carry the arc: the region inside the circle is the one its edges bound.
    solids.push({ ring: [...inner.arc.points, ...[...partner.arc.points].reverse()], keys: [inner.arc.key, partner.arc.key], arc: inner.circle });
  }
  return solids;
}

/** The circle a flattened arc is drawn on — through its first, middle and last points — or null. */
function circleOf(points: readonly Point[], tolerance: number): Circle | null {
  if (points.length < FEWEST_RING_POINTS) return null;
  const a = points[0] as Point;
  const b = points[Math.floor(points.length / 2)] as Point;
  const c = points[points.length - 1] as Point;
  const d = 2 * (a[0] * (b[1] - c[1]) + b[0] * (c[1] - a[1]) + c[0] * (a[1] - b[1]));
  if (Math.abs(d) <= tolerance) return null;
  const sq = (p: Point): number => p[0] * p[0] + p[1] * p[1];
  const centre: Point = [(sq(a) * (b[1] - c[1]) + sq(b) * (c[1] - a[1]) + sq(c) * (a[1] - b[1])) / d, (sq(a) * (c[0] - b[0]) + sq(b) * (a[0] - c[0]) + sq(c) * (b[0] - a[0])) / d];
  const r = distance(centre, a);
  // Every point it is drawn through stands on that circle, or it is no arc.
  if (!points.every((point) => Math.abs(distance(centre, point) - r) <= Math.max(tolerance, r / 1000))) return null;
  return { centre, r };
}

/** The distance between two points. */
function distance(p: Point, q: Point): number {
  return Math.hypot(q[0] - p[0], q[1] - p[1]);
}

/** Twice the signed area of a ring, as a number (anticlockwise positive). */
function turning(ring: readonly Point[]): number {
  let sum = 0;
  for (let index = 0; index < ring.length; index += 1) {
    const p = ring[index] as Point;
    const q = ring[(index + 1) % ring.length] as Point;
    sum += p[0] * q[1] - q[0] * p[1];
  }
  return sum;
}

/** Is a ring convex (either way round)? */
function isConvex(ring: readonly Point[]): boolean {
  let sign = 0;
  for (let index = 0; index < ring.length; index += 1) {
    const a = ring[index] as Point;
    const b = ring[(index + 1) % ring.length] as Point;
    const c = ring[(index + 2) % ring.length] as Point;
    const cross = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
    if (cross === 0) continue;
    if (sign === 0) sign = Math.sign(cross);
    else if (Math.sign(cross) !== sign) return false;
  }
  return sign !== 0;
}

/** Is a point inside a ring, or within a tolerance of its boundary? */
function withinOrOn(point: Point, ring: readonly Point[], tolerance: number): boolean {
  if (insideRing(point, ring)) return true;
  return edgesOf(ring).some(([a, b]) => segmentDistance(point, a, b) <= tolerance);
}

/** How far along a direction a point runs before it leaves a convex ring (Cyrus–Beck), from where it stands. */
function exitAlong(point: Point, direction: Point, ring: readonly Point[]): number {
  const ccw = turning(ring) > 0 ? ring : [...ring].reverse();
  let hi = Number.POSITIVE_INFINITY;
  for (const [p, q] of edgesOf(ccw)) {
    const inward: Point = [-(q[1] - p[1]), q[0] - p[0]];
    const num = (point[0] - p[0]) * inward[0] + (point[1] - p[1]) * inward[1];
    const den = direction[0] * inward[0] + direction[1] * inward[1];
    if (den < 0) hi = Math.min(hi, -num / den);
  }
  return Number.isFinite(hi) ? hi : 0;
}

/** A ring's edges, closing back to its first point. */
function edgesOf(ring: readonly Point[]): [Point, Point][] {
  return ring.map((point, index) => [point, ring[(index + 1) % ring.length] as Point]);
}

/** The distance from a point to a segment. */
function segmentDistance(point: Point, a: Point, b: Point): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const ll = dx * dx + dy * dy;
  const t = ll === 0 ? 0 : Math.max(0, Math.min(1, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / ll));
  return distance(point, [a[0] + t * dx, a[1] + t * dy]);
}

/** The box a ring stands in. */
function boxOf(ring: readonly Point[]): readonly [number, number, number, number] {
  const xs = ring.map((p) => p[0]);
  const ys = ring.map((p) => p[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

/** Do two rings touch — overlap, or stand within a tolerance of each other anywhere? */
function touches(left: readonly Point[], right: readonly Point[], tolerance: number): boolean {
  const a = boxOf(left);
  const b = boxOf(right);
  if (a[0] > b[2] + tolerance || b[0] > a[2] + tolerance || a[1] > b[3] + tolerance || b[1] > a[3] + tolerance) return false;
  if (left.some((point) => withinOrOn(point, right, tolerance)) || right.some((point) => withinOrOn(point, left, tolerance))) return true;
  for (const [p, q] of edgesOf(left)) for (const [r, s] of edgesOf(right)) if (crossParameters(p, q, r, s, tolerance) !== null) return true;
  return false;
}

/** Where two segments cross, as the parameter along each, or null where they do not. */
function crossParameters(p: Point, p2: Point, q: Point, q2: Point, tolerance: number): readonly [number, number] | null {
  const r: Point = [p2[0] - p[0], p2[1] - p[1]];
  const s: Point = [q2[0] - q[0], q2[1] - q[1]];
  const den = r[0] * s[1] - r[1] * s[0];
  const rr = Math.hypot(r[0], r[1]);
  const ss = Math.hypot(s[0], s[1]);
  if (Math.abs(den) <= 1e-12 * rr * ss) return null;
  const qp: Point = [q[0] - p[0], q[1] - p[1]];
  const t = (qp[0] * s[1] - qp[1] * s[0]) / den;
  const v = (qp[0] * r[1] - qp[1] * r[0]) / den;
  const slackT = tolerance / rr;
  const slackV = tolerance / ss;
  if (t < -slackT || t > 1 + slackT || v < -slackV || v > 1 + slackV) return null;
  return [Math.min(Math.max(t, 0), 1), Math.min(Math.max(v, 0), 1)];
}

/** One edge of the arrangement's input: a solid's edge, the solid it bounds, and the arc it is a chord of. */
type Segment = { readonly from: Point; readonly to: Point; readonly solid: number; readonly arc: Circle | null };

/**
 * The bounded faces of the arrangement no solid covers, each with its holes (path 2 of the fixture's
 * golden: split every solid edge where another meets it, walk the half-edges, keep the anticlockwise
 * faces whose inside no solid covers, and hang each clockwise boundary in the least face holding it).
 */
function freeFaces(solids: readonly Solid[], tolerance: number): ClosedRegion[] {
  const segments: Segment[] = [];
  solids.forEach((solid, index) => {
    for (const [from, to] of edgesOf(solid.ring)) if (distance(from, to) > tolerance) segments.push({ from, to, solid: index, arc: solid.arc });
  });

  // Every place along each segment another meets it.
  const cuts: number[][] = segments.map(() => [0, 1]);
  const boxes = segments.map((segment) => boxOf([segment.from, segment.to]));
  const order = segments.map((_, index) => index).sort((left, right) => (boxes[left]?.[0] ?? 0) - (boxes[right]?.[0] ?? 0));
  for (let at = 0; at < order.length; at += 1) {
    const i = order[at] as number;
    const bi = boxes[i] as readonly [number, number, number, number];
    for (let next = at + 1; next < order.length; next += 1) {
      const j = order[next] as number;
      const bj = boxes[j] as readonly [number, number, number, number];
      if (bj[0] > bi[2] + tolerance) break;
      if (bj[1] > bi[3] + tolerance || bi[1] > bj[3] + tolerance) continue;
      meet(segments[i] as Segment, segments[j] as Segment, cuts[i] as number[], cuts[j] as number[], tolerance);
    }
  }

  // The snapped graph: one vertex per lattice cell of the tolerance, one edge per pair of them.
  const cell = (point: Point): string => `${Math.round(point[0] / tolerance)},${Math.round(point[1] / tolerance)}`;
  const vertices = new Map<string, Point>();
  const snapped = (point: Point): string => {
    const key = cell(point);
    // A point standing within the tolerance of a vertex already held is that vertex, whichever cell
    // its rounding fell in.
    if (vertices.has(key)) return key;
    const [cx, cy] = key.split(",").map(Number) as [number, number];
    for (let dx = -1; dx <= 1; dx += 1) {
      for (let dy = -1; dy <= 1; dy += 1) {
        const near = `${cx + dx},${cy + dy}`;
        const held = vertices.get(near);
        if (held !== undefined && distance(held, point) <= tolerance) return near;
      }
    }
    vertices.set(key, point);
    return key;
  };
  const edges = new Map<string, { readonly a: string; readonly b: string; readonly solids: Set<number>; arc: Circle | null }>();
  segments.forEach((segment, index) => {
    const ts = [...new Set(cuts[index])].sort((left, right) => left - right);
    const points = ts.map((t): Point => [segment.from[0] + (segment.to[0] - segment.from[0]) * t, segment.from[1] + (segment.to[1] - segment.from[1]) * t]);
    for (let k = 1; k < points.length; k += 1) {
      const a = snapped(points[k - 1] as Point);
      const b = snapped(points[k] as Point);
      if (a === b) continue;
      const id = a < b ? `${a}|${b}` : `${b}|${a}`;
      const held = edges.get(id);
      // Only a whole chord of an arc carries its segment: a piece of one is a straight piece.
      const whole = segment.arc !== null && ts.length === 2 ? segment.arc : null;
      if (held === undefined) edges.set(id, { a: a < b ? a : b, b: a < b ? b : a, solids: new Set([segment.solid]), arc: whole });
      else {
        held.solids.add(segment.solid);
        if (held.arc === null) held.arc = whole;
      }
    }
  });

  // Around each vertex, its neighbours by angle.
  const around = new Map<string, { angle: number; to: string }[]>();
  for (const edge of edges.values()) {
    for (const [from, to] of [
      [edge.a, edge.b],
      [edge.b, edge.a],
    ] as const) {
      const p = vertices.get(from) as Point;
      const q = vertices.get(to) as Point;
      around.set(from, [...(around.get(from) ?? []), { angle: Math.atan2(q[1] - p[1], q[0] - p[0]), to }]);
    }
  }
  for (const list of around.values()) list.sort((left, right) => left.angle - right.angle);

  // Walk the half-edges: each face turns left at every vertex, so bounded faces are anticlockwise.
  const seen = new Set<string>();
  const cycles: string[][] = [];
  for (const edge of [...edges.values()].sort((left, right) => (left.a + left.b < right.a + right.b ? -1 : 1))) {
    for (const [first, second] of [
      [edge.a, edge.b],
      [edge.b, edge.a],
    ] as const) {
      if (seen.has(`${first}>${second}`)) continue;
      const cycle: string[] = [];
      let from: string = first;
      let to: string = second;
      while (!seen.has(`${from}>${to}`)) {
        seen.add(`${from}>${to}`);
        cycle.push(from);
        const list = around.get(to) ?? [];
        const back = list.findIndex((one) => one.to === from);
        const next = list[(back - 1 + list.length) % list.length] as { to: string };
        from = to;
        to = next.to;
      }
      cycles.push(cycle);
    }
  }

  const pointsOf = (cycle: readonly string[]): Point[] => cycle.map((key) => vertices.get(key) as Point);
  const rings = solids.map((solid) => solid.ring);
  const free: { cycle: string[]; outer: Point[]; holes: Point[][]; holeCycles: string[][] }[] = [];
  const outlines: { cycle: string[]; ring: Point[] }[] = [];
  for (const cycle of cycles) {
    const ring = pointsOf(cycle);
    const area = turning(ring);
    if (area > 0) {
      const probe = probeOf(ring, tolerance);
      if (probe !== null && !rings.some((solid) => insideRing(probe, solid))) free.push({ cycle, outer: ring, holes: [], holeCycles: [] });
    } else if (area < 0) outlines.push({ cycle, ring });
  }
  for (const outline of outlines) {
    const probe = probeOf(outline.ring, tolerance);
    if (probe === null) continue;
    const hosts = free.filter((face) => insideRing(probe, face.outer));
    const host = hosts.sort((left, right) => turning(left.outer) - turning(right.outer))[0];
    if (host === undefined) continue;
    host.holes.push(outline.ring);
    host.holeCycles.push(outline.cycle);
  }

  return free.map((face) => {
    const all = [face.cycle, ...face.holeCycles];
    let shoelace = exact(0);
    let segmentsSum = exact(0);
    const keys = new Set<string>();
    for (const cycle of all) {
      for (let index = 0; index < cycle.length; index += 1) {
        const a = cycle[index] as string;
        const b = cycle[(index + 1) % cycle.length] as string;
        const p = vertices.get(a) as Point;
        const q = vertices.get(b) as Point;
        shoelace = shoelace.plus(exact(p[0]).times(q[1]).minus(exact(q[0]).times(p[1])));
        const edge = edges.get(a < b ? `${a}|${b}` : `${b}|${a}`);
        for (const solid of edge?.solids ?? []) for (const key of solids[solid]?.keys ?? []) keys.add(key);
        if (edge?.arc !== null && edge?.arc !== undefined) segmentsSum = segmentsSum.plus(arcSegment(p, q, edge.arc));
      }
    }
    const flattened = shoelace.div(2);
    return { outer: face.outer, holes: face.holes, area: flattened.plus(segmentsSum), shoelace: flattened, sourceKeys: [...keys].sort() };
  });
}

/** Record where two segments meet — crossing, touching, or lying along each other. */
function meet(left: Segment, right: Segment, leftCuts: number[], rightCuts: number[], tolerance: number): void {
  const r: Point = [left.to[0] - left.from[0], left.to[1] - left.from[1]];
  const s: Point = [right.to[0] - right.from[0], right.to[1] - right.from[1]];
  const rr = r[0] * r[0] + r[1] * r[1];
  const ss = s[0] * s[0] + s[1] * s[1];
  const den = r[0] * s[1] - r[1] * s[0];
  if (den * den <= 1e-18 * rr * ss) {
    // Parallel: along each other only where the one stands on the other's line.
    const side = (right.from[0] - left.from[0]) * r[1] - (right.from[1] - left.from[1]) * r[0];
    if (side * side > tolerance * tolerance * rr) return;
    for (const [end, cuts, base, d, dd] of [
      [right.from, leftCuts, left.from, r, rr],
      [right.to, leftCuts, left.from, r, rr],
      [left.from, rightCuts, right.from, s, ss],
      [left.to, rightCuts, right.from, s, ss],
    ] as const) {
      const t = ((end[0] - base[0]) * d[0] + (end[1] - base[1]) * d[1]) / dd;
      if (t > 0 && t < 1) cuts.push(t);
    }
    return;
  }
  const crossed = crossParameters(left.from, left.to, right.from, right.to, tolerance);
  if (crossed === null) return;
  leftCuts.push(crossed[0]);
  rightCuts.push(crossed[1]);
}

/** A point just inside a ring's longest edge (on its left: inside an anticlockwise ring), or null. */
function probeOf(ring: readonly Point[], tolerance: number): Point | null {
  let best: [Point, Point] | null = null;
  for (const [p, q] of edgesOf(ring)) if (best === null || distance(p, q) > distance(best[0], best[1])) best = [p, q];
  if (best === null) return null;
  const [p, q] = best;
  const ll = distance(p, q);
  if (!(ll > 0)) return null;
  const nudge = tolerance * PROBE_TOLERANCES;
  return [(p[0] + q[0]) / 2 - ((q[1] - p[1]) / ll) * nudge, (p[1] + q[1]) / 2 + ((q[0] - p[0]) / ll) * nudge];
}

/**
 * The circular segment between one chord of an arc and the arc, signed for the face on the chord's
 * left: added where the arc bulges out of the face (its centre on the face's side), taken off where
 * it bulges in. r²/2 (θ − sin θ), θ the angle the chord subtends.
 */
function arcSegment(p: Point, q: Point, circle: Circle): Decimal {
  const chord = distance(p, q);
  const half = Math.min(1, chord / (2 * circle.r));
  const theta = 2 * Math.asin(half);
  const segment = ((circle.r * circle.r) / 2) * (theta - Math.sin(theta));
  const side = (q[0] - p[0]) * (circle.centre[1] - p[1]) - (q[1] - p[1]) * (circle.centre[0] - p[0]);
  return exact(side > 0 ? segment : -segment);
}

/**
 * Does a region's stored area agree with its own outline's shoelace (L-FRM-01: "a stored plan area
 * disagreeing with its own polygon's shoelace by more than 0.5 % refuses")? A flattening too coarse to
 * carry its arc fails here and the room is refused by name, never stored at a figure its own outline
 * does not bear out.
 */
export function agreesWithShoelace(region: Pick<ClosedRegion, "area" | "shoelace">): boolean {
  if (region.area.isZero()) return region.shoelace.isZero();
  return region.area.minus(region.shoelace).abs().div(region.area.abs()).lte(SHOELACE_AGREEMENT);
}
