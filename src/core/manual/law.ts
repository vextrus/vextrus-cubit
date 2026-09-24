// S-Measure's law as data, and the one home of a hand measurement's geometry arithmetic (I-374,
// I-385, docs/design/s-measure.md): the recipe a measurement applies, the geometry it traces, the
// basis each of its points stands on, and the exact figure that geometry encloses, runs or counts.
//
// The running figure a viewer shows, the offer a rail builds and the book a QS prints all ask here
// rather than computing a ring's area their own way (B-17). Pure: no store, no clock, no float
// arithmetic — every figure is computed from the points' own decimal spellings (B-07).
import type { ElementType } from "../catalogue/classes";
import type { Kind } from "../catalogue/kinds";
import { VIEW_TYPE_SPELLINGS } from "../errors/transport-vocabulary";
import { quantise, type LevelSlot } from "../identity";
import { weakestBasis, type GeometryType, type QuantityBasis } from "../offers/law";
import { exact, type Unit } from "../units/canon";
import { isSimpleRing, latticeOf, positive, scaledOf, sharedArea, twiceSignedArea, collinearOverlap, type LatticePoint, type LatticeRegion } from "./exact";

/* ------------------------------------------------------------------ the rosters */

/** The three geometries a hand measurement traces (L-FRM-01's manual half; R-TO-040's Area, Linear, Count). */
export const MANUAL_GEOMETRIES = ["POLYGON", "POLYLINE", "POINT_SET"] as const satisfies readonly GeometryType[];

/** One manual geometry, drawn from the closed roster above. */
export type ManualGeometry = (typeof MANUAL_GEOMETRIES)[number];

/** Is this value one of the manual geometries? Asked wherever a geometry arrives as text. */
export function isManualGeometry(value: unknown): value is ManualGeometry {
  return typeof value === "string" && (MANUAL_GEOMETRIES as readonly string[]).includes(value);
}

/**
 * What a traced cut-out is (I-389): an OPENING deducts in the opening channel by the edition's
 * threshold; a MEMBER (a column or wall the QS traced) deducts whole in the junction channel.
 */
export const CUTOUT_ROLES = ["OPENING", "MEMBER"] as const;

/** One cut-out role, drawn from the closed roster above. */
export type CutoutRole = (typeof CUTOUT_ROLES)[number];

/**
 * The basis one traced point stands on (I-387, L-QTY-01, R-TO-040), in the quantity roster's own
 * order: MEASURED where it reproduces on the vector geometry it cites, ENTERED where it was placed
 * free, INTERPRETED where it stands on raster content.
 */
export const POINT_BASES = ["MEASURED", "ENTERED", "INTERPRETED"] as const satisfies readonly QuantityBasis[];

/** One point basis, drawn from the closed roster above. */
export type PointBasis = (typeof POINT_BASES)[number];

/**
 * The basis an attribute reading of a recipe carries (I-374): ENTERED where the condition supplied
 * it — a person stated it, and the act names that person — or TRANSCRIBED where the QS bound it to a
 * note of the drawing, citing that note. Never DEFAULTED (L-MEA-06).
 */
export const READING_BASES = ["ENTERED", "TRANSCRIBED"] as const satisfies readonly QuantityBasis[];

/** One reading basis, drawn from the closed roster above. */
export type ReadingBasis = (typeof READING_BASES)[number];

/**
 * A condition's colour: one of the element palette's eight members, by the token's own name after
 * `--element-` (I-374, R-UI-001: no new token). The screen maps it onto the token; core never names
 * a colour.
 */
export const CONDITION_COLOURS = ["beam", "column", "footing", "generic", "opening", "rebar", "slab", "wall"] as const;

/** One condition colour, drawn from the closed roster above. */
export type ConditionColour = (typeof CONDITION_COLOURS)[number];

/** A condition's hatch: one of six, so colour is never the only thing that tells two apart (R-UI-060). */
export const CONDITION_HATCHES = ["solid", "diagonal", "cross", "dots", "horizontal", "vertical"] as const;

/** One condition hatch, drawn from the closed roster above. */
export type ConditionHatch = (typeof CONDITION_HATCHES)[number];

/** One of L-CAD-06's view classes, as the vocabulary core may read spells it. */
type ViewClassSpelling = (typeof VIEW_TYPE_SPELLINGS)[number];

/**
 * L-CAD-06's view classes, addressable by name. The law's home is the partition module, which core
 * may not import (ARCH-01), and a class written out as a string anywhere else would be a second home
 * for it; the vocabulary core reads is where the spellings stand, and this names them from there.
 */
const VIEW_CLASS = Object.freeze(Object.fromEntries(VIEW_TYPE_SPELLINGS.map((spelling) => [spelling, spelling]))) as { readonly [K in ViewClassSpelling]: K };

/** The view classes that draw no scope (I-375): a hand measurement never stands on one. */
export const NO_SCOPE_VIEW_CLASSES: readonly string[] = Object.freeze([VIEW_CLASS.SCHEDULE, VIEW_CLASS.LEGEND_NOTES, VIEW_CLASS.TITLE]);

/** The class of the view no caption anchors (`partition/views/assign.ts`): the anchorless view. */
export const ANCHORLESS_VIEW_CLASS = VIEW_CLASS.UNASSIGNED;

/**
 * The one lawful-null slot a hand measurement may stand in (I-377): a foundation — never UNRESOLVED
 * (I-368). It is the register's own slot, typed against its roster (`LEVEL_SLOTS`), so a spelling
 * the register does not hold fails to compile rather than agreeing with it by chance.
 */
export const HAND_LEVEL_SLOT = "FOUNDATION" as const satisfies LevelSlot;

/** The level a hand measurement stands at: a live level of the stack, or the FOUNDATION slot (I-377). */
export type HandLevel = { readonly levelId: string } | { readonly slot: typeof HAND_LEVEL_SLOT };

/**
 * How much one statement may trace — a bound on a statement, never on the drawing's truth. The exact
 * guards compare every edge of one ring with every edge of another (a cut-out against its outline and
 * against each other cut-out, a trace against each standing measurement of its cell), so the work a
 * statement asks grows with the product of its rings' sizes, and the commit does it inside a
 * transaction holding the project's state lock. A thousand points over every ring is more than any
 * hand trace clicks (measured: an outline of 1 000 points against another of 1 000 takes about a
 * second to compare); the door refuses beyond it as malformed, and the tool stops at the same bound.
 */
export const MANUAL_BOUNDS = Object.freeze({
  /** Points over every ring of one geometry. */
  points: 1000,
  /** Cut-outs of one outline. */
  cutouts: 50,
  /** Source keys one point may cite. */
  cites: 8,
});

/** Every point of every ring of a traced geometry, counted — what `MANUAL_BOUNDS.points` bounds. */
export function pointCountOf<P>(geometry: TracedGeometry<P>): number {
  return ringsOf(geometry).reduce((sum, ring) => sum + ring.length, 0);
}

/* ------------------------------------------------------------------ the recipe */

/** One kind a recipe measures, with the manual method's rule id it applies (I-374). */
export type RecipeKind = { readonly kind: Kind; readonly ruleId: string };

/** One attribute reading a recipe applies (t = 75 mm), with its basis and, where transcribed, its note. */
export type RecipeReading = {
  readonly attribute: string;
  readonly valueAsWritten: string;
  readonly unitAsWritten: string;
  readonly basis: ReadingBasis;
  readonly sourceKey: string | null;
};

/**
 * A condition's recipe AS APPLIED (I-374): what the measurement snapshots, so editing the condition
 * later never re-derives it. The condition's id is provenance, never identity (L-REG-04): it enters
 * no key, and a measurement stands whole whether or not its condition is still in the chest.
 */
export type Recipe = {
  readonly conditionId: string | null;
  readonly conditionName: string;
  readonly geometry: ManualGeometry;
  readonly elementClass: ElementType;
  readonly kinds: readonly RecipeKind[];
  readonly readings: readonly RecipeReading[];
};

/* ------------------------------------------------------------------ the geometry */

/** One point as the viewer states it: the world point, and the source keys it was snapped on (none: free). */
export type StatedPoint = { readonly x: number; readonly y: number; readonly cites: readonly string[] };

/**
 * One point as the act judged it (I-385, I-387): its exact decimal spelling, the basis it stands on,
 * and the source keys it reproduced on — none for a point placed free or demoted to free.
 */
export type JudgedPoint = { readonly x: string; readonly y: string; readonly basis: PointBasis; readonly sources: readonly string[] };

/** A traced cut-out: its role and its ring. */
export type Cutout<P> = { readonly role: CutoutRole; readonly ring: readonly P[] };

/** A traced geometry over points of one kind: an outline with its cut-outs, a run, or a set of points. */
export type TracedGeometry<P> =
  | { readonly geometry: "POLYGON"; readonly outer: readonly P[]; readonly cutouts: readonly Cutout<P>[] }
  | { readonly geometry: "POLYLINE"; readonly run: readonly P[] }
  | { readonly geometry: "POINT_SET"; readonly points: readonly P[] };

/** The geometry a person traced, as stated. */
export type StatedGeometry = TracedGeometry<StatedPoint>;

/** The geometry as the act judged it — what the measurement stores and every figure is computed from. */
export type MeasuredGeometry = TracedGeometry<JudgedPoint>;

/** Every ring of a geometry, the outer first: an outline and its cut-outs, a run, or the points. */
export function ringsOf<P>(geometry: TracedGeometry<P>): (readonly P[])[] {
  switch (geometry.geometry) {
    case "POLYGON":
      return [geometry.outer, ...geometry.cutouts.map((cutout) => cutout.ring)];
    case "POLYLINE":
      return [geometry.run];
    case "POINT_SET":
      return [geometry.points];
  }
}

/**
 * The same geometry with every ring carried whole through one function — for a judgement that reads a
 * ring's points together (I-499: a free coordinate keeps what a point of its own ring determined).
 */
export function mapRings<P, Q>(geometry: TracedGeometry<P>, carry: (ring: readonly P[]) => readonly Q[]): TracedGeometry<Q> {
  switch (geometry.geometry) {
    case "POLYGON":
      return { geometry: "POLYGON", outer: carry(geometry.outer), cutouts: geometry.cutouts.map((cutout) => ({ role: cutout.role, ring: carry(cutout.ring) })) };
    case "POLYLINE":
      return { geometry: "POLYLINE", run: carry(geometry.run) };
    case "POINT_SET":
      return { geometry: "POINT_SET", points: carry(geometry.points) };
  }
}

/**
 * A coordinate's exact decimal spelling (I-385): the double the drawing's own vertex parsed to, read
 * at its shortest round-trip spelling by the canon and written plain — never an exponent, never a
 * negative zero.
 */
export function exactSpellingOf(n: number): string {
  if (!Number.isFinite(n)) throw new Error(`a point at ${String(n)} is no point of the drawing (I-385)`);
  const spelled = exact(String(n)).toFixed();
  return spelled === "-0" ? "0" : spelled;
}

/**
 * Where a free coordinate stands (I-385): the pointer's world point on the 0.1-drawing-unit lattice,
 * since a free click has no drawing fact to keep. The lattice is the key grammar's own (`quantise`).
 * A coordinate copied exactly from a point of its ring the drawing determined keeps that point's
 * spelling instead (I-499, I-500; `judgeRing`, ./snaps).
 */
export function freeSpellingOf(n: number): string {
  return quantise(n);
}

/** Two judged points at one place, exactly. */
function samePlace(a: { readonly x: string; readonly y: string }, b: { readonly x: string; readonly y: string }): boolean {
  return exact(a.x).eq(b.x) && exact(a.y).eq(b.y);
}

/**
 * A ring with its repeats gone: a closing point that repeats the first, and a point that repeats the
 * one before it, add nothing a ring encloses or a run covers — and a second click on one vertex is
 * not a second vertex.
 */
function withoutRepeats(ring: readonly JudgedPoint[], closed: boolean): JudgedPoint[] {
  const kept: JudgedPoint[] = [];
  for (const point of ring) {
    const last = kept[kept.length - 1];
    if (last !== undefined && samePlace(last, point)) continue;
    kept.push(point);
  }
  const first = kept[0];
  const last = kept[kept.length - 1];
  if (closed && kept.length > 1 && first !== undefined && last !== undefined && samePlace(first, last)) kept.pop();
  return kept;
}

/** The geometry with its repeated points gone — the form every figure, key and guard is taken over. */
export function normalisedGeometry(geometry: MeasuredGeometry): MeasuredGeometry {
  switch (geometry.geometry) {
    case "POLYGON":
      return {
        geometry: "POLYGON",
        outer: withoutRepeats(geometry.outer, true),
        cutouts: geometry.cutouts.map((cutout) => ({ role: cutout.role, ring: withoutRepeats(cutout.ring, true) })),
      };
    case "POLYLINE":
      return { geometry: "POLYLINE", run: withoutRepeats(geometry.run, false) };
    case "POINT_SET":
      return geometry;
  }
}

/** The weakest basis over every point of every ring (I-387): the geometry's own basis. */
export function geometryBasis(geometry: MeasuredGeometry): QuantityBasis {
  return weakestBasis(ringsOf(geometry).flatMap((ring) => ring.map((point) => point.basis)));
}

/* ------------------------------------------------------------------ degenerate geometry */

/** The region an outline and its cut-outs enclose, on a lattice every one of their points lands on. */
function regionOf(lift: (point: JudgedPoint) => LatticePoint, outer: readonly JudgedPoint[], holes: readonly (readonly JudgedPoint[])[]): LatticeRegion {
  return { outer: outer.map(lift), holes: holes.map((hole) => hole.map(lift)) };
}

/** Twice a ring's area, unsigned, on the lattice. */
const twiceAreaOf = (ring: readonly LatticePoint[]): bigint => {
  const twice = twiceSignedArea(ring);
  return twice < 0n ? -twice : twice;
};

/**
 * Why a traced geometry encloses, runs or counts nothing it could be billed for, or null where it is
 * whole (`MANUAL_GEOMETRY_DEGENERATE`): an outline with too few distinct points, one that crosses or
 * touches itself, a cut-out that stands outside its outline or over another cut-out; a run with one
 * point or one that doubles back along itself; a set of points that names one point twice. Each of
 * those is a figure that would count some ground twice or none at all (L-QTY-04).
 */
export function degenerateReason(geometry: MeasuredGeometry): string | null {
  const whole = normalisedGeometry(geometry);
  const lift = latticeOf(ringsOf(whole));
  switch (whole.geometry) {
    case "POLYGON": {
      if (whole.outer.length < 3) return "the outline has fewer than three distinct points";
      const outer = whole.outer.map(lift);
      if (!isSimpleRing(outer) || twiceSignedArea(outer) === 0n) return "the outline crosses or touches itself, or encloses nothing";
      const outline: LatticeRegion = { outer, holes: [] };
      for (const [index, cutout] of whole.cutouts.entries()) {
        if (cutout.ring.length < 3) return `cut-out ${index + 1} has fewer than three distinct points`;
        const ring = cutout.ring.map(lift);
        if (!isSimpleRing(ring) || twiceSignedArea(ring) === 0n) return `cut-out ${index + 1} crosses or touches itself, or encloses nothing`;
        // Wholly inside the outline: the area the two share is the cut-out's own.
        const shared = sharedArea({ outer: ring, holes: [] }, outline);
        if (shared.num * 2n !== twiceAreaOf(ring) * shared.den) return `cut-out ${index + 1} stands partly outside the outline`;
        for (const [other, earlier] of whole.cutouts.slice(0, index).entries()) {
          if (positive(sharedArea({ outer: ring, holes: [] }, { outer: earlier.ring.map(lift), holes: [] }))) return `cut-out ${index + 1} stands over cut-out ${other + 1}`;
        }
      }
      return null;
    }
    case "POLYLINE": {
      if (whole.run.length < 2) return "the run has fewer than two distinct points";
      const run = whole.run.map(lift);
      for (let i = 1; i < run.length; i += 1) {
        for (let j = i + 1; j < run.length; j += 1) {
          if (collinearOverlap(run[i - 1] as LatticePoint, run[i] as LatticePoint, run[j - 1] as LatticePoint, run[j] as LatticePoint)) return "the run doubles back along itself";
        }
      }
      return null;
    }
    case "POINT_SET": {
      if (whole.points.length === 0) return "no point was placed";
      const seen = new Set<string>();
      for (const point of whole.points) {
        const at = `${exact(point.x).toFixed()},${exact(point.y).toFixed()}`;
        if (seen.has(at)) return "one point is counted twice";
        seen.add(at);
      }
      return null;
    }
  }
}

/* ------------------------------------------------------------------ the figure */

/** What a geometry measures: an area with its cut-outs, a length, or a count — each exact (I-385). */
export type GeometryFigure =
  | { readonly measure: "AREA"; readonly gross: string; readonly cutouts: readonly { readonly role: CutoutRole; readonly area: string }[] }
  | { readonly measure: "LENGTH"; readonly gross: string }
  | { readonly measure: "COUNT"; readonly gross: string };

/** A lattice area back in the drawing's own units², spelled exactly (the half of twice the area). */
function areaSpelling(twice: bigint, places: number): string {
  // area = twice / 2 / 10^(2·places) = twice · 5 / 10^(2·places + 1): a terminating decimal, always.
  const scale = 2 * places + 1;
  const n = (twice < 0n ? -twice : twice) * 5n;
  const digits = n.toString().padStart(scale + 1, "0");
  const integer = digits.slice(0, digits.length - scale);
  const fraction = digits.slice(digits.length - scale).replace(/0+$/u, "");
  return fraction === "" ? integer : `${integer}.${fraction}`;
}

/** The places the lattice of these rings is scaled by — the largest decimal exponent among them. */
function placesOf(rings: readonly (readonly JudgedPoint[])[]): number {
  let places = 0;
  for (const ring of rings) for (const point of ring) places = Math.max(places, scaledOf(point.x).s, scaledOf(point.y).s);
  return places;
}

/**
 * The exact figure a geometry measures, in drawing units (I-385): an outline's area and each
 * cut-out's by the shoelace of their points' own spellings, never quantised; a run's length as the
 * sum of its sides at the canon's full precision; a count as the number of points. Which cut-outs
 * deduct is the method's (the edition's threshold, I-389), so each is stated with its role and none
 * is netted here.
 */
export function figureOf(geometry: MeasuredGeometry): GeometryFigure {
  const whole = normalisedGeometry(geometry);
  const places = placesOf(ringsOf(whole));
  const lift = latticeOf(ringsOf(whole));
  switch (whole.geometry) {
    case "POLYGON":
      return {
        measure: "AREA",
        gross: areaSpelling(twiceSignedArea(whole.outer.map(lift)), places),
        cutouts: whole.cutouts.map((cutout) => ({ role: cutout.role, area: areaSpelling(twiceSignedArea(cutout.ring.map(lift)), places) })),
      };
    case "POLYLINE": {
      let length = exact(0);
      for (let index = 1; index < whole.run.length; index += 1) {
        const from = whole.run[index - 1] as JudgedPoint;
        const to = whole.run[index] as JudgedPoint;
        const dx = exact(to.x).minus(from.x);
        const dy = exact(to.y).minus(from.y);
        length = length.plus(dx.times(dx).plus(dy.times(dy)).sqrt());
      }
      return { measure: "LENGTH", gross: length.toFixed() };
    }
    case "POINT_SET":
      return { measure: "COUNT", gross: String(whole.points.length) };
  }
}

/** The region an outline and its cut-outs enclose, for the guard that compares two of them (I-380). */
export function netRegionOf(lift: (point: JudgedPoint) => LatticePoint, geometry: MeasuredGeometry & { readonly geometry: "POLYGON" }): LatticeRegion {
  return regionOf(
    lift,
    geometry.outer,
    geometry.cutouts.map((cutout) => cutout.ring),
  );
}

/* ------------------------------------------------------------------ the unit a hand reading is carried in */

/** The canon area unit each length unit's square is carried in; a length with no square carries no area. */
const SQUARE_OF: Readonly<Partial<Record<Unit, Unit>>> = Object.freeze({ mm: "mm2", m: "m2", ft: "sft" });

/** The unit a geometry's figure is carried in, given the unit the view is drawn in; null where there is none. */
export function figureUnitOf(geometry: ManualGeometry, drawn: Unit): Unit | null {
  switch (geometry) {
    case "POLYGON":
      return SQUARE_OF[drawn] ?? null;
    case "POLYLINE":
      return drawn;
    case "POINT_SET":
      return "pcs";
  }
}
