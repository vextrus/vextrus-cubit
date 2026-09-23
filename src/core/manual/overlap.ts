// The double-count guards between hand measurements (I-380, I-381): two hand measurements in one
// class × kind × level cell must not measure the same ground on one view, and one cell is measured on
// one view only unless the two are proven disjoint — which nothing proves yet, so the second view is
// refused. Machine against hand is the act's own read of the lines in the cell (I-382).
//
// The guard reads the geometry the figure reads: the stored exact points, scaled onto one integer
// lattice, with every predicate decided in BigInt (`./exact`). A guard on the key's quantised lattice
// would pass two rings that overlap by less than one lattice step, and both would bill the sliver.
// Only standing measurements are ever handed in: a superseded or repudiated one is nothing (L-ACT-01),
// and an edit is never refused as overlapping the very measurement it replaces.
import type { ElementType } from "../catalogue/classes";
import type { Kind } from "../catalogue/kinds";
import { boxOf, boxesMeet, collinearOverlap, latticeOf, positive, sharedArea, type LatticePoint } from "./exact";
import { netRegionOf, normalisedGeometry, ringsOf, type MeasuredGeometry } from "./law";

/** One hand measurement as the guards read it: what it claims, where it was traced, and its geometry. */
export type Footprint = {
  readonly objectKey: string;
  readonly elementClass: ElementType;
  readonly kinds: readonly Kind[];
  /** The level segment the row stands at — a surrogate or the lawful-null slot — spelled as its key spells it. */
  readonly level: string;
  /** The register's view key the row stands under, and the coordinate space its points are in (I-375). */
  readonly viewKey: string;
  readonly space: string;
  readonly geometry: MeasuredGeometry;
};

/**
 * One class × kind × level cell, as the guards compare cells (I-382, I-383): the one spelling a hand
 * measurement's claim and a machine line's are both read into, so the two can only meet by being the
 * same cell.
 */
export function cellKeyOf(elementClass: string, kind: string, level: string): string {
  return `${elementClass}|${kind}|${level}`;
}

/** The cells a measurement claims (I-382, I-383): its class, at its level, for each of its recipe's kinds. */
export function cellsOf(footprint: Pick<Footprint, "elementClass" | "kinds" | "level">): string[] {
  return footprint.kinds.map((kind) => cellKeyOf(footprint.elementClass, kind, footprint.level));
}

/** Do two measurements claim a cell in common? */
function shareACell(a: Footprint, b: Footprint): boolean {
  const claimed = new Set(cellsOf(a));
  return cellsOf(b).some((cell) => claimed.has(cell));
}

/**
 * Do two traced geometries measure some of the same ground (I-380)? Two outlines whose net regions —
 * each outline less its cut-outs — share any positive area; two runs that lie along each other for
 * any positive length; two sets of points with a point in common, or two points that cite one counted
 * symbol. Shared edges and shared points of two outlines are not shared ground. Geometries of two
 * different kinds are not compared: an area and a run hold no ground in common a figure could count.
 */
export function sharesGround(a: MeasuredGeometry, b: MeasuredGeometry): boolean {
  const left = normalisedGeometry(a);
  const right = normalisedGeometry(b);
  const lift = latticeOf([...ringsOf(left), ...ringsOf(right)]);
  if (left.geometry === "POLYGON" && right.geometry === "POLYGON") {
    return positive(sharedArea(netRegionOf(lift, left), netRegionOf(lift, right)));
  }
  if (left.geometry === "POLYLINE" && right.geometry === "POLYLINE") {
    const runA = left.run.map(lift);
    const runB = right.run.map(lift);
    const boxA = boxOf(runA);
    const boxB = boxOf(runB);
    if (boxA === null || boxB === null || !boxesMeet(boxA, boxB)) return false;
    for (let i = 1; i < runA.length; i += 1) {
      for (let j = 1; j < runB.length; j += 1) {
        if (collinearOverlap(runA[i - 1] as LatticePoint, runA[i] as LatticePoint, runB[j - 1] as LatticePoint, runB[j] as LatticePoint)) return true;
      }
    }
    return false;
  }
  if (left.geometry === "POINT_SET" && right.geometry === "POINT_SET") {
    const placed = new Set(left.points.map(lift).map((point) => `${point.x},${point.y}`));
    const cited = new Set(left.points.flatMap((point) => point.sources));
    return right.points.some((point) => {
      const at = lift(point);
      return placed.has(`${at.x},${at.y}`) || point.sources.some((key) => cited.has(key));
    });
  }
  return false;
}

/** Why a measurement cannot stand beside the ones already standing in its cells. */
export type Collision =
  /** The cell is measured by hand on another view, and the two are not proven disjoint (I-381). */
  | { readonly collision: "other-view"; readonly other: Footprint }
  /** On the same view, the two measure some of the same ground (I-380). */
  | { readonly collision: "overlap"; readonly other: Footprint };

/** Code-point order, so one state answers one collision (L-ACT-02: one state, one digest). */
const byKey = (left: Footprint, right: Footprint): number => (left.objectKey < right.objectKey ? -1 : left.objectKey > right.objectKey ? 1 : 0);

/**
 * The first collision a candidate meets among the STANDING measurements of its revision, or null.
 * Another view is said first — it is the stronger fact about the cell — and the guard's proof of
 * disjointness across views (grid-frame mapping) is owed (I-381), so every other view refuses.
 */
export function collisionOf(candidate: Footprint, standing: readonly Footprint[]): Collision | null {
  const sharing = standing.filter((other) => other.objectKey !== candidate.objectKey && shareACell(candidate, other)).sort(byKey);
  const elsewhere = sharing.find((other) => other.viewKey !== candidate.viewKey || other.space !== candidate.space);
  if (elsewhere !== undefined) return { collision: "other-view", other: elsewhere };
  const overlapping = sharing.find((other) => sharesGround(candidate.geometry, other.geometry));
  return overlapping === undefined ? null : { collision: "overlap", other: overlapping };
}
