// The exact plane a hand measurement is judged on (I-380, I-385): every coordinate of the geometry
// under judgement is scaled onto ONE integer lattice by the largest decimal exponent among them, and
// every predicate — orientation, crossing, containment, the area two regions share — is decided in
// BigInt and in fractions of BigInts. Nothing here is a float and nothing is compared with a
// tolerance: a sliver one hundredth of a millimetre wide is shared area, and two outlines that meet
// along an edge share none (B-07).
//
// Pure: no store, no clock. What a point IS (its exact decimal spelling) is `./law`'s; this file only
// computes over the spellings it is handed.

/** A decimal as an integer over a power of ten: value = n / 10^s. */
type Scaled = { readonly n: bigint; readonly s: number };

/** A plain decimal spelling: an optional sign, digits, and an optional fraction. */
const DECIMAL = /^-?\d+(?:\.\d+)?$/u;

/** Read one plain decimal spelling exactly. A spelling that is not one is a mistake in the caller. */
export function scaledOf(spelling: string): Scaled {
  if (!DECIMAL.test(spelling)) throw new Error(`"${spelling}" is not a plain decimal spelling, so no exact point stands at it (I-385)`);
  const negative = spelling.startsWith("-");
  const [whole = "0", fraction = ""] = (negative ? spelling.slice(1) : spelling).split(".");
  const n = BigInt(`${whole}${fraction}`);
  return { n: negative ? -n : n, s: fraction.length };
}

/** A point on the integer lattice: both coordinates scaled by the same power of ten. */
export type LatticePoint = { readonly x: bigint; readonly y: bigint };

/** A point in the plane of fractions — where two lattice segments meet. */
type Fraction = { readonly num: bigint; readonly den: bigint };
type FractionPoint = { readonly x: Fraction; readonly y: Fraction };

/** One exact point, as `./law` spells one. */
export type ExactSpelling = { readonly x: string; readonly y: string };

/**
 * The one scale every coordinate of a judgement is carried on: the largest decimal exponent among
 * them all, so each lands on the lattice exactly (81D's chamfer vertex carries 15 places, so S-08's
 * rings are scaled by 10¹⁵).
 */
export function latticeOf(rings: readonly (readonly ExactSpelling[])[]): (point: ExactSpelling) => LatticePoint {
  let places = 0;
  for (const ring of rings) for (const point of ring) places = Math.max(places, scaledOf(point.x).s, scaledOf(point.y).s);
  const lift = (spelling: string): bigint => {
    const scaled = scaledOf(spelling);
    return scaled.n * 10n ** BigInt(places - scaled.s);
  };
  return (point) => ({ x: lift(point.x), y: lift(point.y) });
}

/* ------------------------------------------------------------------ fractions */

const ZERO: Fraction = { num: 0n, den: 1n };

function fraction(num: bigint, den: bigint): Fraction {
  if (den === 0n) throw new Error("a fraction over zero is no point of the plane (I-380)");
  return den < 0n ? { num: -num, den: -den } : { num, den };
}

const whole = (n: bigint): Fraction => ({ num: n, den: 1n });
const plus = (a: Fraction, b: Fraction): Fraction => fraction(a.num * b.den + b.num * a.den, a.den * b.den);
const minus = (a: Fraction, b: Fraction): Fraction => fraction(a.num * b.den - b.num * a.den, a.den * b.den);
const times = (a: Fraction, b: Fraction): Fraction => fraction(a.num * b.num, a.den * b.den);
const signOf = (a: Fraction): number => (a.num === 0n ? 0 : a.num > 0n ? 1 : -1);
const compare = (a: Fraction, b: Fraction): number => signOf(minus(a, b));

/** Keep a fraction's terms small: the kernel sums many of them, and nothing here needs them large. */
function reduced(a: Fraction): Fraction {
  let x = a.num < 0n ? -a.num : a.num;
  let y = a.den;
  while (y !== 0n) [x, y] = [y, x % y];
  return x <= 1n ? a : { num: a.num / x, den: a.den / x };
}

/* ------------------------------------------------------------------ lattice predicates */

/** Twice the signed area of the triangle (a, b, c): positive when the turn is counter-clockwise. */
export function orient(a: LatticePoint, b: LatticePoint, c: LatticePoint): bigint {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

const sign = (n: bigint): number => (n === 0n ? 0 : n > 0n ? 1 : -1);
const dot = (a: LatticePoint, b: LatticePoint, c: LatticePoint, d: LatticePoint): bigint => (b.x - a.x) * (d.x - c.x) + (b.y - a.y) * (d.y - c.y);

/** Twice the signed area a ring encloses: positive for a counter-clockwise ring (the shoelace). */
export function twiceSignedArea(ring: readonly LatticePoint[]): bigint {
  let twice = 0n;
  ring.forEach((point, index) => {
    const next = ring[(index + 1) % ring.length] as LatticePoint;
    twice += point.x * next.y - next.x * point.y;
  });
  return twice;
}

/** The box a set of lattice points spans. */
export type LatticeBox = { readonly minX: bigint; readonly minY: bigint; readonly maxX: bigint; readonly maxY: bigint };

/** The box these points span, or null where there are none. */
export function boxOf(points: readonly LatticePoint[]): LatticeBox | null {
  let box: { minX: bigint; minY: bigint; maxX: bigint; maxY: bigint } | null = null;
  for (const { x, y } of points) {
    if (box === null) box = { minX: x, minY: y, maxX: x, maxY: y };
    else {
      if (x < box.minX) box.minX = x;
      if (x > box.maxX) box.maxX = x;
      if (y < box.minY) box.minY = y;
      if (y > box.maxY) box.maxY = y;
    }
  }
  return box;
}

/** Do two closed boxes share any point at all? Two runs whose boxes do not can run along each other nowhere. */
export function boxesMeet(a: LatticeBox, b: LatticeBox): boolean {
  return a.minX <= b.maxX && b.minX <= a.maxX && a.minY <= b.maxY && b.minY <= a.maxY;
}

/** Do two boxes share a positive area? Two regions whose outlines' boxes do not share none. */
function boxesShareArea(a: LatticeBox, b: LatticeBox): boolean {
  return a.minX < b.maxX && b.minX < a.maxX && a.minY < b.maxY && b.minY < a.maxY;
}

/** Does c stand on the closed segment a–b? */
function onSegment(a: LatticePoint, b: LatticePoint, c: LatticePoint): boolean {
  if (orient(a, b, c) !== 0n) return false;
  return (c.x - a.x) * (c.x - b.x) <= 0n && (c.y - a.y) * (c.y - b.y) <= 0n;
}

/** Do the closed segments a–b and c–d share any point at all? */
export function segmentsMeet(a: LatticePoint, b: LatticePoint, c: LatticePoint, d: LatticePoint): boolean {
  const o1 = sign(orient(a, b, c));
  const o2 = sign(orient(a, b, d));
  const o3 = sign(orient(c, d, a));
  const o4 = sign(orient(c, d, b));
  if (o1 * o2 < 0 && o3 * o4 < 0) return true;
  return onSegment(a, b, c) || onSegment(a, b, d) || onSegment(c, d, a) || onSegment(c, d, b);
}

/** Do two collinear segments run along each other for a positive length? */
export function collinearOverlap(a: LatticePoint, b: LatticePoint, c: LatticePoint, d: LatticePoint): boolean {
  if (orient(a, b, c) !== 0n || orient(a, b, d) !== 0n) return false;
  const length = dot(a, b, a, b);
  if (length === 0n) return false;
  // c and d projected onto a–b, as multiples of |ab|²: the run a–b is [0, length].
  const tc = dot(a, b, a, c);
  const td = dot(a, b, a, d);
  const low = tc < td ? tc : td;
  const high = tc < td ? td : tc;
  const from = low > 0n ? low : 0n;
  const to = high < length ? high : length;
  return to > from;
}

/**
 * Is this ring simple — no edge meets another except where two consecutive edges share their vertex,
 * and no edge doubles back along the one before it? A ring that crosses or touches itself encloses
 * no single region, and its shoelace would count part of it twice or net part of it away.
 */
export function isSimpleRing(ring: readonly LatticePoint[]): boolean {
  const count = ring.length;
  if (count < 3) return false;
  const edge = (index: number): [LatticePoint, LatticePoint] => [ring[index % count] as LatticePoint, ring[(index + 1) % count] as LatticePoint];
  for (let i = 0; i < count; i += 1) {
    const [a, b] = edge(i);
    if (a.x === b.x && a.y === b.y) return false;
    for (let j = i + 1; j < count; j += 1) {
      const [c, d] = edge(j);
      const adjacent = j === i + 1 || (i === 0 && j === count - 1);
      if (adjacent) {
        // Consecutive edges share one vertex; they may continue straight on, but never turn back.
        if (orient(a, b, j === i + 1 ? d : c) === 0n && collinearOverlap(a, b, c, d)) return false;
        continue;
      }
      if (segmentsMeet(a, b, c, d)) return false;
    }
  }
  return true;
}

/* ------------------------------------------------------------------ regions and the area they share */

/** A region: an outer ring and the holes cut out of it, each a ring of lattice points. */
export type LatticeRegion = { readonly outer: readonly LatticePoint[]; readonly holes: readonly (readonly LatticePoint[])[] };

/** One directed edge of a region's boundary, with the region's interior on its left. */
type Edge = { readonly from: LatticePoint; readonly to: LatticePoint };

/** The boundary of a region, oriented so its interior lies on the left: outer anticlockwise, holes clockwise. */
function boundaryOf(region: LatticeRegion): Edge[] {
  const edges: Edge[] = [];
  const add = (ring: readonly LatticePoint[], anticlockwise: boolean): void => {
    const turning = twiceSignedArea(ring);
    const ordered = (turning > 0n) === anticlockwise ? ring : [...ring].reverse();
    ordered.forEach((from, index) => {
      const to = ordered[(index + 1) % ordered.length] as LatticePoint;
      if (from.x !== to.x || from.y !== to.y) edges.push({ from, to });
    });
  };
  add(region.outer, true);
  for (const hole of region.holes) add(hole, false);
  return edges;
}

/** Where along e (as a fraction of its length) the edges of another boundary meet or run along it. */
function cutsAlong(e: Edge, others: readonly Edge[]): Fraction[] {
  const cuts: Fraction[] = [ZERO, whole(1n)];
  const d = { x: e.to.x - e.from.x, y: e.to.y - e.from.y };
  for (const f of others) {
    const g = { x: f.to.x - f.from.x, y: f.to.y - f.from.y };
    const r = { x: f.from.x - e.from.x, y: f.from.y - e.from.y };
    const denominator = d.x * g.y - d.y * g.x;
    if (denominator !== 0n) {
      const t = fraction(r.x * g.y - r.y * g.x, denominator);
      const u = fraction(r.x * d.y - r.y * d.x, denominator);
      if (signOf(t) >= 0 && compare(t, whole(1n)) <= 0 && signOf(u) >= 0 && compare(u, whole(1n)) <= 0) cuts.push(t);
      continue;
    }
    if (r.x * d.y - r.y * d.x !== 0n) continue;
    // Collinear: f's two ends, projected onto e.
    const length = d.x * d.x + d.y * d.y;
    for (const end of [f.from, f.to]) {
      const t = fraction((end.x - e.from.x) * d.x + (end.y - e.from.y) * d.y, length);
      if (signOf(t) > 0 && compare(t, whole(1n)) < 0) cuts.push(t);
    }
  }
  const sorted = cuts.sort(compare);
  return sorted.filter((cut, index) => index === 0 || compare(cut, sorted[index - 1] as Fraction) !== 0);
}

/** The point a fraction t of the way along e. */
function along(e: Edge, t: Fraction): FractionPoint {
  return {
    x: plus(whole(e.from.x), times(t, whole(e.to.x - e.from.x))),
    y: plus(whole(e.from.y), times(t, whole(e.to.y - e.from.y))),
  };
}

/** The boundary edges a point of the plane stands on (it lies on each, collinear and between its ends). */
function edgesHolding(point: FractionPoint, boundary: readonly Edge[]): Edge[] {
  return boundary.filter((edge) => {
    const ax = whole(edge.from.x);
    const ay = whole(edge.from.y);
    const across = minus(times(whole(edge.to.x - edge.from.x), minus(point.y, ay)), times(whole(edge.to.y - edge.from.y), minus(point.x, ax)));
    if (signOf(across) !== 0) return false;
    const withinX = signOf(times(minus(point.x, ax), minus(point.x, whole(edge.to.x)))) <= 0;
    const withinY = signOf(times(minus(point.y, ay), minus(point.y, whole(edge.to.y)))) <= 0;
    return withinX && withinY;
  });
}

/** Does a ray from the point towards +x cross this ring an odd number of times? (The point is on none of its edges.) */
function crossesOddly(point: FractionPoint, ring: readonly LatticePoint[]): boolean {
  let inside = false;
  ring.forEach((a, index) => {
    const b = ring[(index + 1) % ring.length] as LatticePoint;
    const aAbove = compare(whole(a.y), point.y) > 0;
    const bAbove = compare(whole(b.y), point.y) > 0;
    if (aAbove === bAbove) return;
    // x where the edge meets the ray's height: a.x + (py − a.y)(b.x − a.x)/(b.y − a.y).
    const meet = plus(whole(a.x), times(minus(point.y, whole(a.y)), fraction(b.x - a.x, b.y - a.y)));
    if (compare(point.x, meet) < 0) inside = !inside;
  });
  return inside;
}

/** Is a point strictly inside a region (on none of its boundary)? */
function strictlyInside(point: FractionPoint, region: LatticeRegion): boolean {
  return crossesOddly(point, region.outer) && !region.holes.some((hole) => crossesOddly(point, hole));
}

/**
 * ∫ x dy along the part of each edge of one boundary that stands inside the other region — the half
 * of Green's theorem each boundary contributes to the area the two regions share. Where the edge runs
 * along the other boundary, it counts only on the first pass and only where both interiors lie on the
 * same side of it; two regions that meet along an edge from opposite sides share none of it.
 */
function contribution(boundary: readonly Edge[], other: LatticeRegion, otherBoundary: readonly Edge[], countShared: boolean): Fraction {
  let sum = ZERO;
  for (const edge of boundary) {
    const cuts = cutsAlong(edge, otherBoundary);
    for (let index = 1; index < cuts.length; index += 1) {
      const t0 = cuts[index - 1] as Fraction;
      const t1 = cuts[index] as Fraction;
      const middle = along(edge, times(plus(t0, t1), fraction(1n, 2n)));
      const holding = edgesHolding(middle, otherBoundary);
      let counted: boolean;
      if (holding.length > 0) {
        counted = countShared && holding.some((held) => dot(edge.from, edge.to, held.from, held.to) > 0n);
      } else {
        counted = strictlyInside(middle, other);
      }
      if (!counted) continue;
      const start = along(edge, t0);
      const end = along(edge, t1);
      sum = reduced(plus(sum, times(times(plus(start.x, end.x), fraction(1n, 2n)), minus(end.y, start.y))));
    }
  }
  return sum;
}

/**
 * The area two regions share, exactly, as a fraction of the lattice's square unit (I-380): the area
 * of their intersection by Green's theorem over its boundary, which is each region's boundary where
 * it stands inside the other, and the boundary they run along together on the same side. Zero where
 * they meet only along edges or at points.
 */
export function sharedArea(a: LatticeRegion, b: LatticeRegion): { readonly num: bigint; readonly den: bigint } {
  // Every region lies inside its outline's box, so two whose boxes share no area share none — said
  // before the kernel spends its edge-by-edge exact arithmetic on a pair that cannot meet.
  const boxA = boxOf(a.outer);
  const boxB = boxOf(b.outer);
  if (boxA === null || boxB === null || !boxesShareArea(boxA, boxB)) return ZERO;
  const boundaryA = boundaryOf(a);
  const boundaryB = boundaryOf(b);
  const total = plus(contribution(boundaryA, b, boundaryB, true), contribution(boundaryB, a, boundaryA, false));
  return reduced(total);
}

/** Does a fraction the kernel answered stand above zero? */
export function positive(value: { readonly num: bigint; readonly den: bigint }): boolean {
  return value.num > 0n;
}
