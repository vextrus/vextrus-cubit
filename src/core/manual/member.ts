// A hand-traced blinding is held to its member (D-005's guard; s-measure I-614).
//
// D-005 measures a blinding traced by hand over its outline with no projection: `count × (A − Σ
// openings − Σ junctions) × t` over the member's own ring, or over a drawn blinding outline that
// follows it. A drawn blinding outline that runs past its member — Rev B of S-08, where LINEs 824–827
// drew the slab's bounding box plus 75 mm round the chamfered pentagon 81D — would bill blinding where
// no member stands: over-measurement, a hard block (L-QTY-04). So such a ring is refused by name.
//
// Which outline is the ring's member is read off the drawing of the one view the ring was traced on:
// a closed outline that view draws and that covers MORE THAN HALF the ring's net area (the outline
// less its cut-outs). A blinding is laid under its member and passes it by a projection strip, so the
// member covers nearly all of it; a closed outline covering less is something the plate carries or
// stands beside (a cap, a pit, a pad), never what it blinds. The ring runs past that member where any
// of its net area stands outside it. An outline that holds the whole ring (a frame, a slab the QS
// traced part of) is no overrun: the ring stands inside it.
//
// Exact throughout (B-07): every coordinate at its own decimal spelling, one integer lattice per
// comparison, the overlap guard's kernel (`sharedArea`). Pure: no store, no clock.
import type { Kind } from "../catalogue/kinds";
import { isSimpleRing, latticeOf, sharedArea, twiceSignedArea, type LatticePoint } from "./exact";
import { planOf } from "./junctions";
import { netRegionOf, normalisedGeometry, ringsOf, type MeasuredGeometry } from "./law";
import type { DrawingFacts, DrawnPoint } from "./snaps";

/** The kinds a hand ring is held to its member for: a blinding lies under a member (D-005). */
export const HELD_TO_MEMBER: readonly Kind[] = Object.freeze(["pcc.blinding"] satisfies Kind[]);

/** The member a ring runs past: the source key of the closed outline that is its member. */
export type MemberOverrun = { readonly member: string };

/** Twice a lattice ring's area, unsigned. */
function twiceAreaOf(ring: readonly LatticePoint[]): bigint {
  const twice = twiceSignedArea(ring);
  return twice < 0n ? -twice : twice;
}

/** Could two float boxes share any area? Checked before any exact arithmetic is spent on a pair. */
function boxesOverlap(points: readonly DrawnPoint[], box: { minX: number; minY: number; maxX: number; maxY: number }): boolean {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of points) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return minX <= box.maxX && maxX >= box.minX && minY <= box.maxY && maxY >= box.minY;
}

/**
 * Where a traced blinding runs past the member it lies under, the member; null where it does not, or
 * where the measurement is no ring of a kind held to its member. `view` is the view the ring was
 * traced on and the space its points are in; only what the partition put in that view is read.
 */
export function blindingPastMember(traced: MeasuredGeometry, kinds: readonly Kind[], facts: DrawingFacts, view: { readonly viewKey: string; readonly space: string }): MemberOverrun | null {
  if (traced.geometry !== "POLYGON" || !kinds.some((kind) => HELD_TO_MEMBER.includes(kind))) return null;
  const whole = normalisedGeometry(traced);
  if (whole.geometry !== "POLYGON") return null;
  const box = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (const point of whole.outer) {
    const x = Number(point.x);
    const y = Number(point.y);
    box.minX = Math.min(box.minX, x);
    box.minY = Math.min(box.minY, y);
    box.maxX = Math.max(box.maxX, x);
    box.maxY = Math.max(box.maxY, y);
  }

  // Code-point order of the source key, so one drawing answers one member whatever order it was read in.
  const keys = [...facts.assigned.entries()]
    .filter(([, viewKey]) => viewKey === view.viewKey)
    .map(([key]) => key)
    .sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
  for (const key of keys) {
    const shape = facts.shapes.get(key);
    if (shape === undefined || shape.space !== view.space) continue;
    for (const path of shape.paths) {
      if (!path.closed || path.points.length < 3 || !boxesOverlap(path.points, box)) continue;
      const plan = planOf(path.points);
      const lift = latticeOf([...ringsOf(whole), plan]);
      const outline = plan.map(lift);
      if (!isSimpleRing(outline) || twiceSignedArea(outline) === 0n) continue;
      const region = netRegionOf(lift, whole);
      const twiceNet = twiceAreaOf(region.outer) - region.holes.reduce((sum, hole) => sum + twiceAreaOf(hole), 0n);
      const shared = sharedArea(region, { outer: outline, holes: [] });
      // shared = num / den of the lattice's square unit, and the net area is twiceNet / 2 of it.
      const coversMost = 4n * shared.num > twiceNet * shared.den;
      const holdsAll = 2n * shared.num >= twiceNet * shared.den;
      if (coversMost && !holdsAll) return { member: key };
    }
  }
  return null;
}
