// L-FRM-01/02's plan, read off the ring a member was placed by: what geometry the ring IS, and the
// area, the perimeter and — where it is a rectangle — the two sides it encloses, in the ring's OWN
// frame and never its bounding box (Interpretation I-333).
//
// A foundation's plan is the drawn outline's. F-RCC6-BNBC's S-06 draws fourteen PC2 caps as six-vertex
// chamfered rings whose bounding box is the schedule's 2100 × 1750 (3.675 m²) and whose shoelace is
// 3.2625 m², and one PC1 turned 45° whose bounding box is 2121 × 2121 (4.5 m²) and whose own sides are
// 2000 × 1000 (2.0 m²). A reader that took either box would put the cap concrete over the golden; the
// ring itself says what was drawn (L-QTY-04: an over-measured figure is never a disclosure).
//
// Every judgement here is SCALE-FREE (L-MEA-01): a corner is right where the cosine between its two
// edges is below a pure number, whatever unit the ring is drawn in, so a plan drawn in feet reads the
// way one drawn in millimetres does. Pure over the ring's points: no store, no clock, no model.
import type { OutlineGeometry } from "@/core/db";
import { quantise } from "@/core/identity";
import type { Unit } from "@/core/units/canon";

/** A point in the drawing's own plane. */
type Point = readonly [number, number];

/**
 * The two geometries a closed ring is read as (L-FRM-01): a rectangle by its sides, or a polygon —
 * each written as the member of the store's closed roster it is, so the geometry a ring is read as
 * and the one its row is checked against are one spelling (B-17).
 */
const OUTLINE_RECT = "PRISM_RECT" satisfies OutlineGeometry;
const OUTLINE_POLY = "PRISM_POLY" satisfies OutlineGeometry;

/** How many corners a rectangle has. */
const RECTANGLE_CORNERS = 4;

/**
 * How far from square a corner may be and still be a right angle: the cosine of the angle between its
 * two edges, a pure number. A millionth is a thousandth of a degree's worth of a drafting error — far
 * inside anything a draughtsman draws on purpose, and far outside the rounding of a coordinate that a
 * rotated rectangle's vertices carry as doubles (S-06's `5FB`).
 */
const SQUARE_COSINE = 1e-6;

/**
 * The square of each length unit a ring can be read in — the canon's own units, so an area is carried
 * in the unit its sides were drawn in and converted by nobody on the way (L-REG-01, B-07). A length
 * unit with no square here reads no outline at all.
 */
const AREA_OF_LENGTH: Readonly<Partial<Record<Unit, Unit>>> = Object.freeze({ mm: "mm2", m: "m2", ft: "sft" });

/** One ring's plan, as the placement stage carries it beside the member it placed (I-333). */
export type OutlineReading = {
  readonly geometry: OutlineGeometry;
  /** The length unit the ring was read in, and its square — the unit every figure below is in. */
  readonly unit: Unit;
  readonly areaUnit: Unit;
  /** The shoelace area, the perimeter, and a rectangle's longer and shorter side — each on the 0.1 lattice. */
  readonly area: string;
  readonly perimeter: string;
  readonly length: string | null;
  readonly breadth: string | null;
};

/**
 * The plan one closed ring encloses, in the unit it was drawn in, or null where the ring encloses
 * nothing or the unit is one the canon carries no area for (a reading in a unit nobody named is no
 * reading, L-CAD-02).
 *
 * Every figure is written onto the 0.1-drawing-unit lattice a placement is keyed on (L-REG-04), for
 * the reason a run's clear is: a coordinate is read off a double, and a side drawn 2000 long on a ring
 * turned 45° arrives as 1999.9999999999998 — a reading more exact than the drawing it came from.
 */
export function outlineReadingOf(points: readonly Point[], unit: Unit | null): OutlineReading | null {
  if (unit === null) return null;
  const areaUnit = AREA_OF_LENGTH[unit];
  if (areaUnit === undefined) return null;
  const ring = openRing(points);
  if (ring.length < 3) return null;
  const area = shoelaceOf(ring);
  if (!(area > 0)) return null;
  const sides = rectangleSidesOf(ring);
  return {
    geometry: sides === null ? OUTLINE_POLY : OUTLINE_RECT,
    unit,
    areaUnit,
    area: quantise(area),
    perimeter: quantise(perimeterOf(ring)),
    length: sides === null ? null : quantise(sides[0]),
    breadth: sides === null ? null : quantise(sides[1]),
  };
}

/** The ring with the vertex that repeats its first taken away, where the drawing closed it that way. */
function openRing(points: readonly Point[]): Point[] {
  const ring = [...points];
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (ring.length > 1 && first !== undefined && last !== undefined && first[0] === last[0] && first[1] === last[1]) ring.pop();
  return ring;
}

/** The area a ring encloses, however it was closed — what "innermost" is judged by (`./detect`). */
export function enclosedAreaOf(points: readonly Point[]): number {
  return shoelaceOf(openRing(points));
}

/** The area a ring encloses — the shoelace, whichever way round it was drawn. */
function shoelaceOf(ring: readonly Point[]): number {
  let twice = 0;
  for (const [index, point] of ring.entries()) {
    const next = ring[(index + 1) % ring.length] as Point;
    twice += point[0] * next[1] - next[0] * point[1];
  }
  return Math.abs(twice) / 2;
}

/** The length of a ring's boundary, closed back onto its first vertex. */
function perimeterOf(ring: readonly Point[]): number {
  let length = 0;
  for (const [index, point] of ring.entries()) {
    const next = ring[(index + 1) % ring.length] as Point;
    length += Math.hypot(next[0] - point[0], next[1] - point[1]);
  }
  return length;
}

/**
 * A rectangle's two sides — the longer first — or null where the ring is no rectangle: four corners,
 * every one of them square, in whatever orientation the ring was drawn. The sides are the ring's OWN,
 * so a rectangle drawn turned is measured by its edges and never by the box around it (I-333).
 */
function rectangleSidesOf(ring: readonly Point[]): readonly [number, number] | null {
  if (ring.length !== RECTANGLE_CORNERS) return null;
  const edges = ring.map((point, index) => {
    const next = ring[(index + 1) % ring.length] as Point;
    return [next[0] - point[0], next[1] - point[1]] as const;
  });
  for (const [index, edge] of edges.entries()) {
    const next = edges[(index + 1) % edges.length] as readonly [number, number];
    const lengths = Math.hypot(edge[0], edge[1]) * Math.hypot(next[0], next[1]);
    if (!(lengths > 0) || Math.abs(edge[0] * next[0] + edge[1] * next[1]) > SQUARE_COSINE * lengths) return null;
  }
  const one = Math.hypot((edges[0] as readonly [number, number])[0], (edges[0] as readonly [number, number])[1]);
  const two = Math.hypot((edges[1] as readonly [number, number])[0], (edges[1] as readonly [number, number])[1]);
  return one >= two ? [one, two] : [two, one];
}

/** Whether a point stands inside a ring — the even-odd rule, over the ring's own vertices. */
export function ringHolds(ring: readonly Point[], at: Point): boolean {
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index, index += 1) {
    const [xi, yi] = ring[index] as Point;
    const [xj, yj] = ring[previous] as Point;
    if (yi > at[1] !== yj > at[1] && at[0] < ((xj - xi) * (at[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
