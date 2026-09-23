// The ring arithmetic a hand measurement is drawn with (s-measure I-372, I-385), exact: every
// coordinate is read as the decimal its number spells (the canon's `exact(String(n))`, the reading
// `quantise` makes), scaled onto one integer lattice per question, and every predicate is decided in
// BigInt. A double would call a cut-out that shares an edge with its outline "outside" on one sheet
// and "inside" on the next, and the status would name a refusal the QS cannot see (B-07).
//
// Pure: no DOM, no camera, no clock. The gesture machine asks these questions of the rings it holds;
// the running figure reads the areas and the lengths from `./figure.ts`.
import { exact } from "@/core/units/canon";

/** A world point, as every seam of the sheet states one. */
export type RingPoint = readonly [number, number];

/** A point on an integer lattice: the world point times 10^scale, exactly. */
type Lattice = { readonly x: bigint; readonly y: bigint };

/** A coordinate as its plain decimal spelling: no exponent, every digit the number carries. */
function spelled(value: number): string {
  return exact(String(value)).toFixed();
}

/** How many decimal places a spelling carries. */
function placesOf(text: string): number {
  const point = text.indexOf(".");
  return point === -1 ? 0 : text.length - point - 1;
}

/** One spelling on the lattice of `scale` places: the digits, with the point moved away. */
function onLattice(text: string, scale: number): bigint {
  const negative = text.startsWith("-");
  const [whole = "0", fraction = ""] = (negative ? text.slice(1) : text).split(".");
  const digits = BigInt(`${whole}${fraction.padEnd(scale, "0")}`);
  return negative ? -digits : digits;
}

/**
 * Every ring handed in, carried onto ONE lattice — the finest any of their coordinates needs — so a
 * point shared by two rings is one lattice point in both and a shared edge is decided as shared.
 * The lattice is multiplied by six so that every midpoint (÷ 2) and every triangle's centroid (÷ 3)
 * the containment questions sample is itself a lattice point: no question below divides.
 */
export function latticeOf(rings: readonly (readonly RingPoint[])[]): { readonly rings: readonly (readonly Lattice[])[]; readonly scale: number } {
  const texts = rings.map((ring) => ring.map((point) => [spelled(point[0]), spelled(point[1])] as const));
  let scale = 0;
  for (const ring of texts) for (const [x, y] of ring) scale = Math.max(scale, placesOf(x), placesOf(y));
  const six = BigInt(6);
  return {
    scale,
    rings: texts.map((ring) => ring.map(([x, y]) => ({ x: onLattice(x, scale) * six, y: onLattice(y, scale) * six }))),
  };
}

const ZERO = BigInt(0);

/** The sign of the turn a → b → c: positive counter-clockwise, negative clockwise, zero collinear. */
function orient(a: Lattice, b: Lattice, c: Lattice): number {
  const turn = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  return turn === ZERO ? 0 : turn > ZERO ? 1 : -1;
}

/** Does p stand on the closed segment a–b? */
function onSegment(p: Lattice, a: Lattice, b: Lattice): boolean {
  if (orient(a, b, p) !== 0) return false;
  const inX = (p.x >= a.x && p.x <= b.x) || (p.x >= b.x && p.x <= a.x);
  const inY = (p.y >= a.y && p.y <= b.y) || (p.y >= b.y && p.y <= a.y);
  return inX && inY;
}

/** Do the two segments cross at one point interior to both? Touching and running along are not crossing. */
function crossProperly(a: Lattice, b: Lattice, c: Lattice, d: Lattice): boolean {
  const abc = orient(a, b, c);
  const abd = orient(a, b, d);
  const cda = orient(c, d, a);
  const cdb = orient(c, d, b);
  return abc * abd < 0 && cda * cdb < 0;
}

/** Each edge of a closed ring, the closing edge included. */
function* edgesOf(ring: readonly Lattice[]): Generator<readonly [Lattice, Lattice]> {
  for (let at = 0; at < ring.length; at += 1) yield [ring[at] as Lattice, ring[(at + 1) % ring.length] as Lattice];
}

/** Where a point stands against a closed ring: strictly inside, on its boundary, or outside. */
function standing(p: Lattice, ring: readonly Lattice[]): "inside" | "on" | "outside" {
  let inside = false;
  for (const [a, b] of edgesOf(ring)) {
    if (onSegment(p, a, b)) return "on";
    // The crossing rule, half-open on y so a vertex is counted once; decided by the turn's sign,
    // never by a division.
    if (a.y > p.y !== b.y > p.y) {
      const turn = orient(a, b, p);
      if (b.y > a.y ? turn > 0 : turn < 0) inside = !inside;
    }
  }
  return inside ? "inside" : "outside";
}

/** Twice the ring's signed area on the lattice (positive counter-clockwise). */
function twiceSigned(ring: readonly Lattice[]): bigint {
  let twice = ZERO;
  for (const [a, b] of edgesOf(ring)) twice += a.x * b.y - b.x * a.y;
  return twice;
}

/** A point strictly inside a simple ring of non-zero area (the ear of its least vertex). */
function interiorOf(ring: readonly Lattice[]): Lattice {
  let least = 0;
  ring.forEach((point, at) => {
    const held = ring[least] as Lattice;
    if (point.x < held.x || (point.x === held.x && point.y < held.y)) least = at;
  });
  const v = ring[least] as Lattice;
  const p = ring[(least - 1 + ring.length) % ring.length] as Lattice;
  const n = ring[(least + 1) % ring.length] as Lattice;
  // The least vertex of a simple ring is convex. Where no other vertex stands inside its ear, the
  // ear's centroid is interior; otherwise the vertex deepest in the ear, joined to v, runs inside.
  const turn = orient(p, v, n);
  let deepest: Lattice | null = null;
  let depth = ZERO;
  for (const q of ring) {
    if (q === p || q === v || q === n) continue;
    const inEar = orient(p, v, q) * turn >= 0 && orient(v, n, q) * turn >= 0 && orient(n, p, q) * turn >= 0;
    if (!inEar) continue;
    const far = (n.x - p.x) * (q.y - p.y) - (n.y - p.y) * (q.x - p.x);
    const magnitude = far < ZERO ? -far : far;
    if (deepest === null || magnitude > depth) {
      deepest = q;
      depth = magnitude;
    }
  }
  const three = BigInt(3);
  const two = BigInt(2);
  if (deepest === null) return { x: (p.x + v.x + n.x) / three, y: (p.y + v.y + n.y) / three };
  return { x: (v.x + deepest.x) / two, y: (v.y + deepest.y) / two };
}

/** Every point a ring's interior is sampled at: its vertices and the midpoints of its edges. */
function samplesOf(ring: readonly Lattice[]): Lattice[] {
  const two = BigInt(2);
  const found: Lattice[] = [...ring];
  for (const [a, b] of edgesOf(ring)) found.push({ x: (a.x + b.x) / two, y: (a.y + b.y) / two });
  return found;
}

/** Is the ring simple — no two edges that do not share a vertex cross, and no vertex repeats? */
function simple(ring: readonly Lattice[]): boolean {
  for (let one = 0; one < ring.length; one += 1) {
    for (let other = one + 1; other < ring.length; other += 1) {
      const a = ring[one] as Lattice;
      const b = ring[other] as Lattice;
      if (a.x === b.x && a.y === b.y) return false;
    }
  }
  const edges = [...edgesOf(ring)];
  for (let one = 0; one < edges.length; one += 1) {
    for (let other = one + 2; other < edges.length; other += 1) {
      if (one === 0 && other === edges.length - 1) continue;
      const [a, b] = edges[one] as readonly [Lattice, Lattice];
      const [c, d] = edges[other] as readonly [Lattice, Lattice];
      if (crossProperly(a, b, c, d) || onSegment(c, a, b) || onSegment(d, a, b) || onSegment(a, c, d) || onSegment(b, c, d)) return false;
    }
  }
  return true;
}

/**
 * Does the ring enclose something, once? Three distinct points or more, no edge crossing another,
 * and an area that is not zero — the shape `MANUAL_GEOMETRY_DEGENERATE` refuses at the door, said
 * here before the QS is asked to confirm it.
 */
export function ringEncloses(ring: readonly RingPoint[]): boolean {
  if (ring.length < 3) return false;
  const [lattice] = latticeOf([ring]).rings;
  const held = lattice ?? [];
  return twiceSigned(held) !== ZERO && simple(held);
}

/**
 * May `cutout` be cut out of `outer`, beside the cut-outs already standing (I-372)? It must enclose
 * something, lie wholly inside the outline (its boundary may run along the outline's), and share no
 * area with another cut-out. Decided on the exact points, with shared edges and shared points not
 * counting as shared area (I-380's reading of overlap).
 */
export function cutoutFits(outer: readonly RingPoint[], cutout: readonly RingPoint[], others: readonly (readonly RingPoint[])[]): boolean {
  if (!ringEncloses(cutout)) return false;
  const { rings } = latticeOf([outer, cutout, ...others]);
  const [o = [], c = [], ...k] = rings;

  // Wholly inside: no sample of the cut-out outside, and no edge of it crossing the outline.
  if (samplesOf(c).some((point) => standing(point, o) === "outside")) return false;
  for (const [a, b] of edgesOf(c)) for (const [d, e] of edgesOf(o)) if (crossProperly(a, b, d, e)) return false;
  if (standing(interiorOf(c), o) !== "inside") return false;

  // Clear of each other cut-out: no crossing edges, and neither holds a sample of the other inside it.
  for (const other of k) {
    for (const [a, b] of edgesOf(c)) for (const [d, e] of edgesOf(other)) if (crossProperly(a, b, d, e)) return false;
    if (samplesOf(c).some((point) => standing(point, other) === "inside")) return false;
    if (samplesOf(other).some((point) => standing(point, c) === "inside")) return false;
    // A point strictly inside one ring that stands inside or on the other has area of both around it.
    if (standing(interiorOf(c), other) !== "outside" || standing(interiorOf(other), c) !== "outside") return false;
  }
  return true;
}

/** Are two world points one point, exactly — the drawing's own spelling, never a tolerance? */
export function samePoint(a: RingPoint, b: RingPoint): boolean {
  return spelled(a[0]) === spelled(b[0]) && spelled(a[1]) === spelled(b[1]);
}
