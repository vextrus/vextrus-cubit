// The members a traced slab ring runs past, as junction candidates (L-MEA-09; s-measure I-389).
//
// "Slabs run through: … less column and wall plan areas." A hand ring of a slab-class plate at level L
// is laid on the members of the storey whose top is L — the columns and walls that were cast before
// it and stand through it — and each of their plans is deducted whole, clipped to the ring's net
// region (the outline less every cut-out), in the `junction` channel the gate sums (I-538). A member
// the ring does not meet deducts nothing; a member inside a cut-out deducts nothing more, because the
// cut-out already took it; a member straddling the ring's edge deducts the part the ring holds.
//
// A member's plan is the ring the placement stage placed it by (I-333), in its own view's frame. It is
// laid into the ring's frame by the one rule the cap relation lays two plans over one another by
// (I-547): the same view is its own frame, and two views are one frame where their grids agree as a
// translation on the placement lattice — every axis label the two share, and at least two per world
// axis, at one offset (L-CAD-07, L-REG-04). Two views affirmed at different scales of record are no
// frame either: a translation between drawing units of two sizes lays nothing where it stands.
//
// A member that cannot be laid is NOT skipped: the ring may hold it, and a figure that left it in
// would be over (L-QTY-04). Such members are answered by name, and the offer builder refuses the whole
// measurement `MANUAL_JUNCTION_UNPROVEN` rather than publish (I-389's fail-closed arm).
//
// Exact throughout (B-07): every coordinate is carried at its own decimal spelling, the clipping is
// the overlap guard's exact kernel (`sharedArea`), and an area the kernel answers as a fraction that
// does not terminate is rounded UP — toward the larger deduction, so the figure can only be under.
//
// Pure: no store, no clock. The reads it is handed are `./offer.ts`'s.
import type { ElementType } from "../catalogue/classes";
import { quantise } from "../identity";
import { exact } from "../units/canon";
import { isSimpleRing, latticeOf, sharedArea, twiceSignedArea, type ExactSpelling } from "./exact";
import { exactSpellingOf, normalisedGeometry, ringsOf, type MeasuredGeometry } from "./law";

/**
 * Which classes stand through a plate of each class, as L-MEA-09 names them: "slabs run through …
 * less column and wall plan areas". A class not keyed here runs past nothing a hand ring deducts.
 */
export const JUNCTION_MEMBER_CLASSES: Readonly<Partial<Record<ElementType, readonly ElementType[]>>> = Object.freeze({
  slab: Object.freeze(["column", "shear_wall"] as const),
});

/** One view a plan stands in: the record it was read from and the partition's own key for it. */
export type PlanFrame = { readonly ingestId: string; readonly viewKey: string };

/** One grid axis of one view (L-CAD-07), as the stored grid holds it. */
export type FrameAxis = PlanFrame & { readonly family: string; readonly axis: string; readonly label: string; readonly position: number };

/** A view's scale of record: the metres one drawing unit measures, per axis (L-MEA-05). */
export type FrameScale = { readonly factorX: string; readonly factorY: string };

/**
 * One member standing through the ring's level, as the reader found it: its register key, the key a
 * deduction cites it by, the view it was placed on and that view's scale, and its plan in that view's
 * own coordinates — null where nobody read a plan for it (no placement, no ring, no scale).
 */
export type StandingMember = {
  readonly objectKey: string;
  readonly source: string;
  readonly frame: PlanFrame | null;
  readonly scale: FrameScale | null;
  readonly plan: readonly ExactSpelling[] | null;
};

/**
 * The ring's own view and the scale it was measured at — null where that view stands under another
 * scale now, when nothing can be laid on it — and every axis of every view the reader read.
 */
export type JunctionFacts = {
  readonly ring: PlanFrame & { readonly scale: FrameScale | null };
  readonly members: readonly StandingMember[];
  readonly axes: readonly FrameAxis[];
};

/** One member's plan clipped to the ring's net region, in the ring's drawn unit squared. */
export type JunctionCandidate = { readonly objectKey: string; readonly source: string; readonly area: string };

/** What the members come to: the candidates the ring holds, and the members nobody could lay on it. */
export type JunctionReading = { readonly candidates: readonly JunctionCandidate[]; readonly unplaced: readonly string[] };

/** How few shared labels on one world axis prove two plans one frame (the cap relation's rule, I-547). */
const FEWEST_SHARED = 2;

/** The places a non-terminating clipped area is rounded up at: a trillionth of a drawing unit². */
const ROUNDING_PLACES = 12;

/** Two frames name one view. */
function sameFrame(a: PlanFrame, b: PlanFrame): boolean {
  return a.ingestId === b.ingestId && a.viewKey === b.viewKey;
}

/**
 * The translation that lays `from` over `to`, as two exact spellings on the placement lattice, or null
 * where their grids are no one frame. Per world axis: every label of every family both views draw
 * along it stands at one offset on the placement lattice (`quantise`, L-REG-04), and at least two
 * labels say so. The offset IS that lattice reading: two grids drawn to one building differ by float
 * noise the lattice exists to absorb, never by a real length.
 */
export function frameTranslation(axes: readonly FrameAxis[], from: PlanFrame, to: PlanFrame): { readonly dx: string; readonly dy: string } | null {
  if (sameFrame(from, to)) return { dx: "0", dy: "0" };
  const offsets: string[] = [];
  for (const world of ["x", "y"] as const) {
    const theirs = new Map(axes.filter((axis) => sameFrame(axis, to) && axis.axis === world).map((axis) => [`${axis.family}|${axis.label}`, axis.position]));
    const deltas: string[] = [];
    for (const axis of axes) {
      if (!sameFrame(axis, from) || axis.axis !== world) continue;
      const other = theirs.get(`${axis.family}|${axis.label}`);
      if (other !== undefined) deltas.push(quantise(other - axis.position));
    }
    if (deltas.length < FEWEST_SHARED || deltas.some((delta) => delta !== deltas[0])) return null;
    offsets.push(deltas[0] as string);
  }
  return { dx: offsets[0] as string, dy: offsets[1] as string };
}

/** A lattice fraction of `places`-scaled squared units, as a decimal of drawing units², rounded up where it does not end. */
function areaOf(shared: { readonly num: bigint; readonly den: bigint }, places: number): string {
  // area = num / (den · 10^(2·places)); carried at ROUNDING_PLACES and rounded towards +∞.
  const numerator = shared.num * 10n ** BigInt(ROUNDING_PLACES);
  const denominator = shared.den * 10n ** BigInt(2 * places);
  let quotient = numerator / denominator;
  if (numerator % denominator !== 0n && numerator > 0n) quotient += 1n;
  const digits = quotient.toString().padStart(ROUNDING_PLACES + 1, "0");
  const integer = digits.slice(0, digits.length - ROUNDING_PLACES);
  const fraction = digits.slice(digits.length - ROUNDING_PLACES).replace(/0+$/u, "");
  return fraction === "" ? integer : `${integer}.${fraction}`;
}

/** The places the lattice of these rings is carried at: the largest decimal exponent among them. */
function placesOf(rings: readonly (readonly ExactSpelling[])[]): number {
  let places = 0;
  for (const ring of rings) for (const point of ring) for (const value of [point.x, point.y]) places = Math.max(places, (value.split(".")[1] ?? "").length);
  return places;
}

/**
 * The junction candidates a traced ring holds (I-389): each standing member laid into the ring's frame
 * and clipped to its net region. A member with no plan, no scale, a scale other than the ring's, or no
 * frame the ring's grid can lay it in, is answered in `unplaced`; one whose clipped plan is nothing is
 * simply not a candidate. Only an outline is laid on: a run or a set of points encloses no plan.
 */
export function junctionsOf(traced: MeasuredGeometry, facts: JunctionFacts): JunctionReading {
  const whole = normalisedGeometry(traced);
  if (whole.geometry !== "POLYGON") return { candidates: [], unplaced: [] };
  const net = ringsOf(whole);
  const candidates: JunctionCandidate[] = [];
  const unplaced: string[] = [];
  for (const member of [...facts.members].sort((a, b) => (a.objectKey < b.objectKey ? -1 : a.objectKey > b.objectKey ? 1 : 0))) {
    const laid = layOnto(member, facts);
    if (laid === null) {
      unplaced.push(member.objectKey);
      continue;
    }
    const rings = [...net, laid];
    const lift = latticeOf(rings);
    const plan = laid.map(lift);
    if (plan.length < 3 || !isSimpleRing(plan) || twiceSignedArea(plan) === 0n) {
      unplaced.push(member.objectKey);
      continue;
    }
    const shared = sharedArea({ outer: plan, holes: [] }, { outer: whole.outer.map(lift), holes: whole.cutouts.map((cutout) => cutout.ring.map(lift)) });
    if (shared.num <= 0n) continue;
    candidates.push({ objectKey: member.objectKey, source: member.source, area: areaOf(shared, placesOf(rings)) });
  }
  return { candidates, unplaced };
}

/** A member's plan in the ring's frame, or null where it cannot be laid there. */
function layOnto(member: StandingMember, facts: JunctionFacts): ExactSpelling[] | null {
  const ringScale = facts.ring.scale;
  if (member.plan === null || member.frame === null || member.scale === null || ringScale === null) return null;
  // Two scales of record are two sizes of drawing unit: a translation between them lays nothing where it stands.
  if (!exact(member.scale.factorX).eq(ringScale.factorX) || !exact(member.scale.factorY).eq(ringScale.factorY)) return null;
  const shift = frameTranslation(facts.axes, member.frame, facts.ring);
  if (shift === null) return null;
  return member.plan.map((point) => ({ x: plain(exact(point.x).plus(shift.dx).toFixed()), y: plain(exact(point.y).plus(shift.dy).toFixed()) }));
}

/** A decimal spelling written plain — never a negative zero. */
function plain(spelling: string): string {
  return spelling === "-0" ? "0" : spelling;
}

/** A drawn ring's points as exact spellings (I-385): each double at its shortest round-trip spelling. */
export function planOf(points: readonly (readonly [number, number])[]): ExactSpelling[] {
  return points.map(([x, y]) => ({ x: exactSpellingOf(x), y: exactSpellingOf(y) }));
}
