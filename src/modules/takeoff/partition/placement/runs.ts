// L-MEA-09's runs: the beams and tie beams a layout plan draws as a PAIR OF EDGE LINES, placed off
// that pair, and the clear each one measures along its own axis.
//
// A column is drawn as a closed outline with its mark beside it, which is what `./detect` reads. A
// beam is not: a structural plan draws it as its two edge lines, half a width either side of the axis
// it runs along, with the mark standing beside that axis. So the anchor is the PAIR — two lines drawn
// alike, congruent, parallel and a member's width apart — and the member is the axis between them.
//
// What the run IS, is L-MEA-09's sentence read literally: "beams measure clear between support faces
// and below the slab soffit". Clear, here:
//   · the drawn axis, less the part of it the member supporting each END owns. That member is the
//     closed vertical- or foundation-class outline the end lies in; failing that the same building's
//     vertical at the same grid reference, because a plan of a storey need not redraw the columns that
//     carry it (L-MEA-09: "vertical members measure floor-to-floor through the joint"); failing that
//     the edge-line pair of a beam crossing that end, which is what carries a trimmer; failing all
//     three, nothing — the drawing showed no support and none is invented (L-QTY-04).
//   · less every stretch of it lying inside a slab opening the axis crosses. A beam over a stair well
//     is not cast through the well, and a figure that measured it through would be OVER — which
//     L-QTY-06 never allows and no deferral can excuse.
// And below the soffit: each side of the run states the slab thickness adjoining it, read where a
// probe one width off the axis — half a width clear of the beam's own face — stands on the slab plate
// and outside every opening. The rail subtracts it; nothing here does arithmetic on it.
//
// Every constant that decides a pair is a share of the view's own minimum grid spacing, read off the
// project's pinned edition exactly as `./detect`'s are (L-MEA-01), or a share of the member's own
// drawn width. Nothing here spells a distance in drawing units, so a plan drawn at another size reads
// the same way.
//
// Pure over the artifact and the stages before it: no store, no clock, no model (L-REG-04).
import type { ElementType } from "@/core/catalogue/classes";
import type { GridAxis } from "@/core/db";
import type { EntityGraph } from "@/core/entitygraph/schema";
import { placementKey, quantise, viewKey as viewKeyOf, type ViewRef } from "@/core/identity";
import type { QuantityBasis } from "@/core/offers/law";
import type { Unit } from "@/core/units/canon";
import type { GridAxisRow } from "../grid/detect";
import { normaliseMark } from "../notation";
import type { PartitionedView } from "../views/assign";
import { yieldsInstances } from "../views/law";
import { axisBetween, edgeOf, greedyPairs, insideRing, pairCandidates, saidOf, squareToThePlane, type Axis, type Drawn, type Edge, type Point, type Said } from "./edge-pairs";
import { classOfMark, isBoundXrefContext, isFoundationClass, isFramedClass, isVerticalClass, levelWordsOf } from "./law";
import type { DetectedRuns, DrawnUnit, FamilyNamed, PlacementEvidence, PlacementRow, RunReading, RunRow } from "./rows";
import { shareValue } from "./shares";

/** The bases a reading of this stage stands on, read off the offer law's closed roster (L-QTY-01). */
const MEASURED: QuantityBasis = "MEASURED";
const TRANSCRIBED: QuantityBasis = "TRANSCRIBED";
const DERIVED: QuantityBasis = "DERIVED";

/** The two families of the backbone, named as the members of the seam's roster they are. */
const LETTER_FAMILY = "letter";
const NUMERAL_FAMILY = "numeral";

/** The plane's two directions an axis can stand across, named as the members of the grid roster they are. */
const AXIS_X = "x" satisfies GridAxis;
const AXIS_Y = "y" satisfies GridAxis;

/** How few vertices a closed ring may be drawn from and still enclose an area. */
const FEWEST_OUTLINE_VERTICES = 3;

/**
 * What the view states the slab adjoining it is: `SLAB 150 THK`, `ROOF SLAB 150 THK`. The word SLAB is
 * load-bearing — `PARAPET 150 THK, 1000 HIGH` states the thickness of a parapet and of no slab, and a
 * reader that took the number alone would give every roof beam a soffit it does not have (L-CAD-03).
 */
/**
 * The unit a slab-thickness caption is written in, whatever the drawing's own header unit is. `SLAB
 * 150 THK` is a hundred and fifty MILLIMETRES on a drawing set out in feet as surely as on one set out
 * in metres: the note is a detailing convention and not a length measured off the plan, and stamping
 * the header's unit on it publishes a slab a hundred and fifty feet thick (L-MEA-01, L-CAD-03).
 */
const SLAB_THICKNESS_UNIT: Unit = "mm";

const SLAB_THICKNESS = /\bSLAB\b[^A-Za-z0-9]*(\d+(?:\.\d+)?)\s*(?:MM)?\s*THK\b/;

/** The words a plan names a hole in its slab by (L-MEA-09: "less openings"). */
const OPENING_WORDS: ReadonlySet<string> = new Set(["OPENING", "OPENINGS", "VOID", "SHAFT", "WELL", "CUTOUT"]);

/**
 * The header spellings a run can be STATED in, and what the measurement canon calls each (L-CAD-02's
 * `$INSUNITS` map read against B-07's canon). A reading is carried in the unit it was read in and
 * converted by nobody on the way, so a drawing whose header names a length the canon does not carry —
 * `cm`, `inch` — states a run this stage cannot write down, and the run is unread rather than
 * silently converted into one the canon does carry (L-REG-01, L-QTY-04).
 */
const CANON_OF_HEADER: Readonly<Record<string, Unit>> = Object.freeze({ mm: "mm", m: "m", foot: "ft" });

/**
 * The length unit one artifact's header states its drawing in, as the canon calls it, or null where
 * the header names one the canon does not carry. Published because a RING's plan is read in the same
 * unit a run is (`./outline`, I-333): one map from the header to the canon, read by both (B-17).
 */
export function drawnUnitOf(graph: EntityGraph): Unit | null {
  return CANON_OF_HEADER[graph.insunits.unit ?? ""] ?? null;
}

/** One closed outline of a plan: the ring as drawn, its bounding box and the box's area. */
type Ring = { readonly key: string; readonly points: readonly Point[]; readonly min: Point; readonly max: Point; readonly area: number };

/** A member that may carry a beam's end: where it stands on the backbone, and how far it reaches. */
type Support = {
  readonly viewKey: string;
  readonly letter: string | null;
  readonly numeral: string | null;
  readonly offX: number;
  readonly offY: number;
  readonly halfX: number;
  readonly halfY: number;
  /** A foundation member carries only what its own plan draws; a vertical carries the whole building. */
  readonly ownViewOnly: boolean;
  readonly key: string;
};

/** Where a point stands on one view's backbone: the two axes nearest it, and how far off each it is. */
type Address = { readonly letter: string | null; readonly numeral: string | null; readonly offX: number; readonly offY: number };

/** One layout plan, read whole: everything the pairing, the marking and the run measuring need. */
type Plan = {
  readonly view: PartitionedView;
  readonly ref: ViewRef;
  /**
   * L-REG-04's derived address of this view — the name a PLACEMENT calls it by. The stored view's own
   * `viewKey` names it in the other key space, and the two are never compared (B-17).
   */
  readonly key: string;
  readonly axes: readonly GridAxisRow[];
  readonly spacing: number;
  readonly rings: readonly Ring[];
  readonly said: readonly Said[];
  readonly members: readonly Axis[];
  /** The rings this view's own placements were read off — a member, never a slab (`./detect`). */
  readonly placed: ReadonlySet<string>;
  /** The mark standing nearest each member, where one stands near enough to name it. */
  readonly marked: ReadonlyMap<Axis, Said>;
};

/**
 * The beams and tie beams one artifact's layout plans draw, and the run each one measures (L-MEA-09).
 *
 * Handed what `./detect` already placed, because two of its answers are evidence here: the closed
 * outlines those placements were read off are the members that CARRY a beam's ends, and they are also
 * the rings this stage must not read as a slab. And handed the unit the drawing's geometry is read in,
 * read once by `./detect` for the rings and the runs alike (I-340): the header's where it names one,
 * and the drawing's own declaration where the header is unitless and its members bear the declaration
 * out — null where neither does, and then no clear is read at all. And handed the drawn scale `./detect`
 * read off the outlines — how many drawing units one unit of the schedules measures — which is what a
 * width a schedule states is set against a pair's gap at (I-344); null where nothing could be compared,
 * and then only the edition's own band pairs.
 */
export function detectRuns(evidence: PlacementEvidence, placed: readonly PlacementRow[], unit: DrawnUnit | null, scale: number | null): DetectedRuns {
  const shares = { containmentMerge: shareValue(evidence.shares, "containmentMerge"), nearAnchor: shareValue(evidence.shares, "nearAnchor") };
  const axesByView = axesOf(evidence.grid);
  const ringsByKey = new Map<string, Ring>();
  const widths = statedWidthsOf(evidence.families, scale);

  const plans: Plan[] = [];
  for (const view of evidence.views) {
    if (!yieldsInstances(view.type) || view.anchorKey === null) continue;
    const axes = axesByView.get(view.viewKey) ?? [];
    const spacing = axes[0]?.minSpacing ?? 0;
    // A plan the grid stage could not georeference states no spacing, and a share of no spacing is no
    // distance: it is left alone rather than paired by numbers nobody read (L-CAD-07).
    if (!(spacing > 0)) continue;

    // What another drawing bound in as background is none of this plan's members, slabs or marks: the
    // architect's walls are drawn as congruent pairs too, and paired they are beams nobody drew (I-342).
    const standing = evidence.graph.entities.filter((entity) => evidence.assignments.get(entity.key) === view.viewKey && !isBoundXrefContext(entity.layer));
    const rings = standing.flatMap((entity) => ringOf(entity) ?? []);
    for (const ring of rings) ringsByKey.set(ring.key, ring);
    const edges = standing.flatMap((entity) => edgeOf(entity) ?? []);
    const said = standing.flatMap((entity) => saidOf(entity) ?? []);
    const apart = shares.containmentMerge * spacing;
    const reach = shares.nearAnchor * spacing;
    const banded = pairsIn(edges, apart);
    // The pairs the edition's band admits, and then the pairs wider than it that the drawing's own
    // schedules admit: a pair whose gap IS the width its naming mark's schedule states (I-344). Each of
    // those carries the mark it was admitted by, which is the mark that names it — one reading, never a
    // second pass that could name it otherwise (B-17).
    const taken = new Set(banded.flatMap((member) => member.keys));
    const stated = statedPairsIn(
      edges.filter((edge) => !taken.has(edge.key)),
      { apart, reach, marks: said.filter((one) => isFramedClass(classOfMark(one.text))), banded },
      widths,
    );
    const members = [...banded, ...stated.map((one) => one.member)];
    const ref: ViewRef = { viewClass: view.type, captionAnchorSourceKey: view.anchorKey };
    const key = viewKeyOf(ref);
    const plan: Plan = {
      view,
      ref,
      key,
      axes,
      spacing,
      rings,
      said,
      members,
      placed: new Set(placed.filter((row) => row.viewKey === key).map((row) => row.outlineKey)),
      marked: new Map([...markedIn(banded, said, reach), ...stated.map((one) => [one.member, one.mark] as const)]),
    };
    plans.push(plan);
  }

  // The members that can carry a beam's end, read across the drawing's plans: a vertical stands where
  // the building stands it whichever plan drew it, a foundation member only on its own plan.
  const supports = plans.flatMap((plan) => supportsOf(plan, placed, ringsByKey));

  const rows: PlacementRow[] = [];
  const runs: RunRow[] = [];
  for (const plan of plans) {
    const named = namedIn(plan, plans, evidence.families);
    for (const [member, mark] of named) {
      const type = classOfMark(mark.text);
      if (!isFramedClass(type)) continue;
      const centre: Point = [(member.from[0] + member.to[0]) / 2, (member.from[1] + member.to[1]) / 2];
      const key = placementKey({ view: plan.ref, mark: normaliseMark(mark.text), x: centre[0], y: centre[1] });
      // Two members of one mark quantising onto one lattice point are one member (L-REG-04).
      if (rows.some((row) => row.placementKey === key)) continue;
      rows.push({
        viewKey: plan.key,
        view: plan.ref,
        placementKey: key,
        mark: normaliseMark(mark.text),
        markText: mark.text,
        elementType: type,
        x: centre[0],
        y: centre[1],
        gridLetter: nearestLabel(plan.axes, LETTER_FAMILY, centre),
        gridNumeral: nearestLabel(plan.axes, NUMERAL_FAMILY, centre),
        // The pair IS the member here, and the first of its two lines is the entity a reader goes
        // back to (L-CAD-03: a reading names the atom it was read from).
        outlineKey: member.keys[0],
        markKey: mark.key,
        memberFamily: evidence.families.some((family) => family.family === normaliseMark(mark.text)) ? normaliseMark(mark.text) : null,
        // A FRAMED member is never noted: `memberNoteOf` refuses a framed class for the reason
        // `markOf` does — a beam is placed from the pair of edge lines it is drawn as and not from an
        // outline standing near a text, so a note about one has no member here to be evidence about
        // (I-303, L-MEA-09, `./law`). The null is that refusal read back, not a field left unfilled.
        note: null,
      });
      runs.push(runOf(key, member, plan, supports, type, unit));
    }
  }
  return { placements: rows, runs };
}

/** One view's axes, by the view they georeference. */
function axesOf(grid: PlacementEvidence["grid"]): Map<string, GridAxisRow[]> {
  const byView = new Map<string, GridAxisRow[]>();
  for (const axis of grid?.axes ?? []) {
    const held = byView.get(axis.viewKey);
    if (held === undefined) byView.set(axis.viewKey, [axis]);
    else held.push(axis);
  }
  return byView;
}

/** This entity read as a closed ring, or nothing where it encloses no area. */
function ringOf(entity: Drawn): [Ring] | null {
  if (entity.closed !== true) return null;
  const points = (entity.points ?? []).map((point): Point => [point[0] ?? 0, point[1] ?? 0]);
  if (points.length < FEWEST_OUTLINE_VERTICES) return null;
  const xs = points.map((point) => point[0]);
  const ys = points.map((point) => point[1]);
  const min: Point = [Math.min(...xs), Math.min(...ys)];
  const max: Point = [Math.max(...xs), Math.max(...ys)];
  return [{ key: entity.key, points, min, max, area: (max[0] - min[0]) * (max[1] - min[1]) }];
}

/**
 * Does a point stand INSIDE a ring as the ring is drawn — its polygon, not its bounding box
 * (I-611)? A chamfered or L-shaped slab plate is not the rectangle around it, and a probe in the
 * corner the box adds and the plate does not is off the slab. The box is only the quick refusal; the
 * even-odd test over the ring's own edges is the pairing geometry's one (`insideRing`, B-17).
 */
function inside(ring: Ring, point: Point): boolean {
  if (!(ring.min[0] < point[0] && point[0] < ring.max[0] && ring.min[1] < point[1] && point[1] < ring.max[1])) return false;
  return insideRing(point, ring.points);
}

/**
 * The members one plan draws as pairs of edge lines.
 *
 * Two lines are one member's two edges when they are drawn ALIKE — the same layer, the same length,
 * the same direction — and one is the other translated PERPENDICULAR to that direction by a distance
 * inside the merge share of the view's spacing. That is exactly how a plan draws a beam, and nothing
 * else on a structural plan is drawn that way: two grid lines are a bay apart, a dimension line is not
 * two points, and a ring is closed.
 *
 * Greedy over the closest pairs first, each line taken once, so a run of touching bays pairs edge with
 * edge rather than bay with bay (L-REG-04: one artifact pairs one way every time).
 */
function pairsIn(edges: readonly Edge[], apart: number): Axis[] {
  const tolerance = apart / 1000;
  return greedyPairs(pairCandidates(edges, { tolerance, sameLayer: true, admits: (gap) => gap > tolerance && !(gap > apart) }));
}

/**
 * The mark that names each pair: the nearest one standing BESIDE it, within the near-anchor reach.
 *
 * Beside is two statements about where a label is drawn, and both are about the member's own geometry
 * rather than about the plan:
 *   · CLEAR of the member's two edge lines. A label drawn between them is standing on the member, and
 *     what it names is whatever else the plan drew there. This is what keeps the `B5` lettering the
 *     lift-well trimmer carries — drawn 450 below its own axis, and so straight down the middle of the
 *     beam that crosses the well — from being read onto that beam, whose own label stands 400 to the
 *     side and 400 further off (L-CAD-03: a reading names the atom it was read from).
 *   · ALONGSIDE the stretch the member runs over, within a margin of its own width at each end. A
 *     label past the end of a member is beside the next one.
 * Of the marks that answer both, the nearest to the member's centre names it — a plan letters its
 * members one apiece, and the nearest is the one the draughtsman put there.
 */
function markedIn(members: readonly Axis[], said: readonly Said[], reach: number): Map<Axis, Said> {
  const marks = said.filter((one) => isFramedClass(classOfMark(one.text)));
  const named = new Map<Axis, Said>();
  for (const member of members) {
    const mark = markNaming(member, marks, reach);
    if (mark !== null) named.set(member, mark);
  }
  return named;
}

/** The one mark that names one member — `markedIn`'s rule, asked of a single member (B-17). */
function markNaming(member: Axis, marks: readonly Said[], reach: number): Said | null {
  let held: { mark: Said; distance: number } | null = null;
  for (const mark of marks) {
    const distance = besideAt(mark, member, reach);
    if (distance === null) continue;
    // Ties go to the lower source key, so one drawing anchors one way every time (L-REG-04).
    if (held === null || distance < held.distance || (distance === held.distance && mark.key < held.mark.key)) held = { mark, distance };
  }
  return held?.mark ?? null;
}

/** One width a framed family's schedule states, in drawing units, and the half-unit it was printed to. */
type StatedWidth = { readonly value: number; readonly halfUnit: number };

/**
 * The widths each FRAMED family's schedules state, set at the drawn scale (I-344): a beam's `b`, the
 * first side of its section, in drawing units — beside half a unit of the place the schedule printed
 * it to, since `250` is a figure in [249.5, 250.5] and a pair drawn inside that is the member the
 * schedule describes (the tolerance I-321 reads a diameter to). Empty where the drawing states no
 * scale: a width nobody can set against the plan admits nothing.
 */
function statedWidthsOf(families: readonly FamilyNamed[], scale: number | null): ReadonlyMap<string, readonly StatedWidth[]> {
  const widths = new Map<string, StatedWidth[]>();
  if (scale === null || !(scale > 0)) return widths;
  for (const named of families) {
    if (!isFramedClass(classOfMark(named.family))) continue;
    for (const variant of named.variants ?? []) {
      const width = variant.sectionWidth;
      if (width === null || !(width > 0)) continue;
      widths.set(named.family, [...(widths.get(named.family) ?? []), { value: width * scale, halfUnit: halfUnitOf(width) * scale }]);
    }
  }
  return widths;
}

/** Half a unit of the last place a figure is written to — `250` → 0.5, `12.5` → 0.05. */
export function halfUnitOf(value: number): number {
  const places = String(value).split(".")[1]?.length ?? 0;
  return 0.5 * 10 ** -places;
}

/**
 * The members one plan draws WIDER than the edition's pairing band, admitted by the drawing's own
 * statement of how wide they are (Interpretation I-344, D2 of the session-7 beams map).
 *
 * The band — `containmentMerge × spacing` — is 195.1 on F-RCC6-BNBC, whose beams are 250, 300 and 400
 * wide: at the band alone the set's beams are never paired at all. Widening the band would pair
 * whatever else a plan draws alike and a little apart, and name each pair by whichever mark stood
 * nearest — measured: EB1's four 250 × 300 spans named `B2`…`B5` (300 × 600), two cantilevers named
 * `B3`, each billed at a section twice the one drawn (L-QTY-06). So a pair beyond the band is a member
 * only where its gap EQUALS the width its naming mark's schedule states, at the drawn scale and within
 * half the printed unit — the mark `markedIn` would name it by, asked first, and never a second mark
 * when the first disagrees (L-QTY-01: never a guess).
 *
 * Greedy over the closest candidates first, each line taken once and never one the band already took,
 * as `pairsIn` is (L-REG-04). A candidate wider than every stated width is not a candidate at all.
 *
 * Two fences more, and both are here rather than beside the band's own pairing, because the band's
 * members are F-RCC6's byte-frozen reading and these are the members only a stated width admits:
 *   · A mark standing ON a drawn pair — between its two edge lines, within its stretch — names no
 *     OTHER pair. Measured on S-14 without it: `LB1` (250 × 375) and `B31` (250 × 450) stand 1219
 *     apart, each on its own axis, and each named the OTHER — the same width, so the width could not
 *     tell (L-CAD-03: a reading names the atom it was read from). Whether it names the pair it stands
 *     on is the drawing's to say, and it says so by how the mark is WRITTEN (I-460, reading I-415's
 *     world rotation): a set that letters a beam running up the sheet writes its mark on the beam's
 *     axis, turned to run along it (T-TEXT-ROTATED), and such a mark — turned, standing on exactly one
 *     drawn pair and running along it — is that pair's own lettering and names it (`ownLettering`). A
 *     mark written the way the sheet reads is not: F-RCC6's trimmer lettering `40B` stands at 0° on
 *     exactly one pair that is not its own and runs along it, which is what every label written across
 *     the sheet does wherever it happens to fall. An artifact that states no rotation (v2) letters no
 *     pair this way at all, and reads exactly as it did.
 *   · The mark names the pair it stands NEAREST, and no other: of every drawn pair it stands beside and
 *     within reach of, this one. A label is written beside the member it names, and a pair it merely
 *     reaches — S-14's `LB1`, 914 off `B12`'s label and 1399 from its centre, where `B12`'s own pair
 *     is 160 off — is the next member over, whatever width the two share.
 *   · The pair runs along an axis of the plane. A run is measured and probed along the axis it
 *     dominantly runs (`axisBetween`), which is exact for a member drawn square to the grid and not for
 *     one drawn on a slant: S-13's porch beams `PB4`/`PB5` measured their projection, and probed off
 *     the slab plate at both sides read a soffit of nothing — a line COMPLETE and 15 % over the
 *     golden's own (L-QTY-06). A slanted pair waits for the run to be read along its own direction.
 */
function statedPairsIn(
  edges: readonly Edge[],
  near: { readonly apart: number; readonly reach: number; readonly marks: readonly Said[]; readonly banded: readonly Axis[] },
  widths: ReadonlyMap<string, readonly StatedWidth[]>,
): { readonly member: Axis; readonly mark: Said }[] {
  const stated = [...widths.values()].flat();
  const widest = Math.max(0, ...stated.map((width) => width.value + width.halfUnit));
  if (!(widest > near.apart)) return [];
  const tolerance = near.apart / 1000;
  // A pair drawn as wide as SOME framed member of the drawing is stated to be — the pairs the fences
  // below and the naming then judge.
  const candidates = pairCandidates(edges, {
    tolerance,
    sameLayer: true,
    admits: (gap) => gap > near.apart && stated.some((width) => Math.abs(gap - width.value) <= width.halfUnit),
  }).map((candidate) => ({ ...candidate, member: axisBetween(candidate.left, candidate.right, candidate.gap) }));

  // A mark standing on a pair is never a label standing BESIDE another (the first fence), whichever
  // way it is written and whichever pairing drew the pair it stands on — the band's own members are
  // drawn pairs too; a turned one running along the one pair it stands on letters that pair.
  const drawn = [...near.banded, ...candidates.map((candidate) => candidate.member)];
  const lettering = near.marks.filter((mark) => !drawn.some((member) => standsOn(mark, member)));
  const own = ownLettering(drawn, near.marks);
  // The drawn pair each label stands nearest, among the pairs it stands beside and within reach of.
  const nearestTo = new Map<string, Axis>();
  for (const mark of lettering) {
    let held: { member: Axis; distance: number } | null = null;
    for (const candidate of candidates) {
      const distance = besideAt(mark, candidate.member, near.reach);
      // Ties go to the earlier candidate — the narrower, then the lower key — as the pairing's are.
      if (distance !== null && (held === null || distance < held.distance)) held = { member: candidate.member, distance };
    }
    if (held !== null) nearestTo.set(mark.key, held.member);
  }

  const taken = new Set<string>();
  const members: { member: Axis; mark: Said }[] = [];
  for (const candidate of candidates) {
    if (taken.has(candidate.left.key) || taken.has(candidate.right.key)) continue;
    if (!squareToThePlane(candidate.left, tolerance)) continue;
    const beside = markNaming(candidate.member, lettering, near.reach);
    const mark = namingOf(own.get(candidate.member) ?? [], beside !== null && nearestTo.get(beside.key) === candidate.member ? beside : null);
    if (mark === null) continue;
    const named = widths.get(normaliseMark(mark.text));
    if (named === undefined || !named.some((width) => Math.abs(candidate.gap - width.value) <= width.halfUnit)) continue;
    taken.add(candidate.left.key);
    taken.add(candidate.right.key);
    members.push({ member: candidate.member, mark });
  }
  return members;
}

/**
 * The marks each drawn pair is LETTERED by (I-460): a mark turned to run along the one pair it
 * stands on, which is how a set letters a beam running up the sheet (T-TEXT-ROTATED). A mark standing
 * on two pairs — where they cross, or where two readings of one pair of lines overlap — letters
 * neither: the drawing did not say which (L-QTY-04).
 */
function ownLettering(members: readonly Axis[], marks: readonly Said[]): ReadonlyMap<Axis, readonly Said[]> {
  const lettered = new Map<Axis, Said[]>();
  for (const mark of marks) {
    const on = members.filter((member) => standsOn(mark, member));
    const [only] = on;
    if (on.length !== 1 || only === undefined || !runsTurnedAlong(mark, only)) continue;
    lettered.set(only, [...(lettered.get(only) ?? []), mark]);
  }
  return lettered;
}

/**
 * Is this mark written TURNED along this member — its baseline running along the member's axis, and
 * not the way the sheet reads (along x)? Both are asked the one way the member itself sets: carry the
 * baseline the member's own length, and see whether it stays within half the member's width of the
 * axis, and whether it leaves a line drawn along x by more than that. A 90° mark on a pair running up
 * the sheet answers yes; a 0° mark on a pair running across answers no — it is written the way every
 * label on the sheet is, wherever it falls (F-RCC6's `40B`); a 90° mark across a pair answers no
 * (S-13's `TG1` lettering `D75`). An artifact stating no rotation answers no, always.
 *
 * "The way the sheet reads" is model x. That holds for every plan of both fixtures, each drawn in
 * model space square to the sheet; a plan drawn turned in model space and shown through a
 * twisted viewport would read its across-the-sheet labels as turned, and bring F-RCC6's `40B` risk
 * back. No fixture draws one and this stage reads no viewport's twist, so the assumption is recorded
 * rather than proved: the day such a plan is partitioned, its twist is subtracted here first
 * (I-460).
 */
function runsTurnedAlong(mark: Said, member: Axis): boolean {
  if (mark.turn === null) return false;
  const radians = (mark.turn * Math.PI) / 180;
  const baseline: Point = [Math.cos(radians), Math.sin(radians)];
  const run: Point = [member.to[0] - member.from[0], member.to[1] - member.from[1]];
  const half = member.width / 2;
  const offAxis = Math.abs(baseline[0] * run[1] - baseline[1] * run[0]);
  const offSheet = Math.hypot(run[0], run[1]) * Math.abs(baseline[1]);
  return offAxis <= half && offSheet > half;
}

/**
 * The one mark that names a pair: its own lettering, or the label beside it that stands nearest it.
 * Where they name two different members — two turned marks on one pair, or a pair's own lettering and
 * a label beside it that disagrees — nothing names it: the drawing stated two readings and this stage
 * does not choose between them (L-QTY-04). Where they agree, the pair's own lettering is the atom
 * named, the lowest source key of it where it was lettered twice (L-REG-04).
 */
function namingOf(lettered: readonly Said[], beside: Said | null): Said | null {
  const answers = new Set([...lettered, ...(beside === null ? [] : [beside])].map((mark) => normaliseMark(mark.text)));
  if (answers.size !== 1) return null;
  const [first] = [...lettered].sort((left, right) => (left.key < right.key ? -1 : left.key > right.key ? 1 : 0));
  return first ?? beside;
}

/**
 * How far a mark stands from a member's centre where it stands BESIDE it — clear of its edge lines,
 * alongside its stretch, within the reach — or null where it does not: `markNaming`'s own test (B-17).
 */
function besideAt(mark: Said, member: Axis, reach: number): number | null {
  const along = member.along === "x" ? mark.at[0] : mark.at[1];
  const off = Math.abs((member.along === "x" ? mark.at[1] : mark.at[0]) - member.at);
  if (off <= member.width / 2) return null;
  if (along < member.start - member.width || along > member.end + member.width) return null;
  const distance = Math.hypot(mark.at[0] - (member.from[0] + member.to[0]) / 2, mark.at[1] - (member.from[1] + member.to[1]) / 2);
  return distance > reach ? null : distance;
}

/** Does this mark stand ON a member — between its two edge lines, and within the stretch it runs? */
function standsOn(mark: Said, member: Axis): boolean {
  const along = member.along === "x" ? mark.at[0] : mark.at[1];
  const off = Math.abs((member.along === "x" ? mark.at[1] : mark.at[0]) - member.at);
  return off <= member.width / 2 && member.start <= along && along <= member.end;
}

/**
 * Every member of one plan with the mark that names it — its own where the plan lettered one, and
 * otherwise the mark the SAME DRAWING gives the member standing at that grid reference on another of
 * its plans (settled reading, L-CAD-07/L-REG-04).
 *
 * A roof plan that draws sixty beams and letters none of them has not said its beams are nameless: it
 * has drawn the same backbone as the plan beside it, and every one of its axes coincides with an axis
 * that plan letters. Two statements of the drawing hold the reading up, and it is made under both or
 * not at all:
 *   · the receiving plan letters NO member of this kind at all. A plan that lettered some and not
 *     others has made its own choice about which to name, and reading a mark onto the rest would be
 *     this stage overruling the drawing rather than reading it.
 *   · the lettered member's own schedule row names a level this plan's caption names. `B1 … 1F TO
 *     ROOF` and `ROOF PLAN` name ROOF between them; `TB1 … FDN` names no level a roof plan does. Where
 *     more than one mark answers, nothing is taken — the drawing did not say which (L-QTY-04).
 */
function namedIn(plan: Plan, plans: readonly Plan[], families: readonly FamilyNamed[]): Map<Axis, Said> {
  if (plan.marked.size > 0) return new Map(plan.marked);
  const stated = new Set(levelWordsOf(plan.view.caption));
  if (stated.size === 0) return new Map();

  const offered = new Map<string, Set<string>>();
  for (const other of plans) {
    if (other === plan) continue;
    for (const [member, mark] of other.marked) {
      const normalised = normaliseMark(mark.text);
      if (!bandNames(normalised, families, stated)) continue;
      const signature = signatureOf(other, member);
      offered.set(signature, new Set([...(offered.get(signature) ?? []), normalised]));
    }
  }

  const named = new Map<Axis, Said>();
  for (const member of plan.members) {
    const candidates = offered.get(signatureOf(plan, member));
    if (candidates === undefined || candidates.size !== 1) continue;
    const mark = [...candidates][0] as string;
    const source = plans
      .flatMap((other) => (other === plan ? [] : [...other.marked.values()]))
      .find((one) => normaliseMark(one.text) === mark);
    if (source !== undefined) named.set(member, source);
  }
  return named;
}

/** Where a member stands on its plan's backbone: the two axes nearest its axis, and which way it runs. */
function signatureOf(plan: Plan, member: Axis): string {
  const centre: Point = [(member.from[0] + member.to[0]) / 2, (member.from[1] + member.to[1]) / 2];
  return [member.along, nearestLabel(plan.axes, LETTER_FAMILY, centre) ?? "", nearestLabel(plan.axes, NUMERAL_FAMILY, centre) ?? ""].join("|");
}

/** Does this mark's schedule row name one of the levels this plan's caption names (L-CAD-07)? */
function bandNames(mark: string, families: readonly FamilyNamed[], stated: ReadonlySet<string>): boolean {
  const variants = families.find((family) => family.family === mark)?.variants ?? [];
  return variants.some((variant) => levelWordsOf(variant.bandText ?? "").some((level) => stated.has(level)));
}

/** The members of one plan that can carry a beam's end, addressed on the backbone they stand on. */
function supportsOf(plan: Plan, placed: readonly PlacementRow[], rings: ReadonlyMap<string, Ring>): Support[] {
  const carried: Support[] = [];
  for (const row of placed) {
    if (row.viewKey !== plan.key) continue;
    const vertical = isVerticalClass(row.elementType);
    if (!vertical && !isFoundationClass(row.elementType)) continue;
    const ring = rings.get(row.outlineKey);
    if (ring === undefined) continue;
    const centre: Point = [(ring.min[0] + ring.max[0]) / 2, (ring.min[1] + ring.max[1]) / 2];
    const address = addressOf(plan.axes, centre);
    carried.push({
      viewKey: plan.key,
      letter: address.letter,
      numeral: address.numeral,
      offX: address.offX,
      offY: address.offY,
      halfX: (ring.max[0] - ring.min[0]) / 2,
      halfY: (ring.max[1] - ring.min[1]) / 2,
      // A footing carries the tie beams of its own plan and nothing standing six storeys above it; a
      // column runs floor-to-floor and carries the beams of every storey it passes (L-MEA-09).
      ownViewOnly: !vertical,
      key: ring.key,
    });
  }
  return carried;
}

/**
 * Where a point stands on one view's backbone: the nearest axis of each family, and the offset off it
 * along each of the plane's two directions.
 *
 * Each offset is taken off the axis that stands ACROSS that direction — the one whose own orientation
 * the grid stage read as it (`GridAxisRow.axis`) — and never off a family by its name (I-340). A
 * drawing letters whichever way its draughtsman chose: F-RCC6 stands its letters along x and its
 * numerals along y, F-RCC6-BNBC the other way about, and an offset taken off "the letter" measured a
 * BNBC point's x against a letter axis's y. Every support of another plan was then a stranger at its
 * own grid reference, every beam end fell through to the crossing beam's edges, and each clear was
 * OVER by the column's half-width at both ends (L-QTY-06: over is never a disclosure).
 */
function addressOf(axes: readonly GridAxisRow[], at: Point): Address {
  const letter = nearestAxis(axes, LETTER_FAMILY, at);
  const numeral = nearestAxis(axes, NUMERAL_FAMILY, at);
  const across = (direction: GridAxisRow["axis"]): GridAxisRow | undefined => [letter, numeral].find((axis) => axis?.axis === direction);
  return {
    letter: letter?.label ?? null,
    numeral: numeral?.label ?? null,
    offX: at[0] - (across(AXIS_X)?.position ?? 0),
    offY: at[1] - (across(AXIS_Y)?.position ?? 0),
  };
}

/**
 * The nearest axis of one family, or undefined where this view's backbone carries none. Ties go to the
 * lower label, so a member standing midway between two axes is referenced the same way every time
 * (L-REG-04).
 */
function nearestAxis(axes: readonly GridAxisRow[], family: string, at: Point): GridAxisRow | undefined {
  let held: GridAxisRow | undefined;
  let nearest = Number.POSITIVE_INFINITY;
  for (const axis of axes) {
    if (axis.family !== family) continue;
    const distance = Math.abs((axis.axis === "x" ? at[0] : at[1]) - axis.position);
    if (distance < nearest || (distance === nearest && held !== undefined && axis.label < held.label)) {
      held = axis;
      nearest = distance;
    }
  }
  return held;
}

/** The label of the nearest axis of one family, or null where this view's backbone carries none. */
export function nearestLabel(axes: readonly GridAxisRow[], family: string, at: Point): string | null {
  return nearestAxis(axes, family, at)?.label ?? null;
}

/**
 * The position of the axis at one grid reference that stands ACROSS a direction of the plane — the
 * letter or the numeral, whichever the grid stage read standing that way (I-340) — or null where this
 * view's backbone carries no such axis.
 */
function originAcross(axes: readonly GridAxisRow[], address: Address, direction: GridAxis): number | null {
  for (const [family, label] of [
    [LETTER_FAMILY, address.letter],
    [NUMERAL_FAMILY, address.numeral],
  ] as const) {
    if (label === null) continue;
    const axis = axes.find((one) => one.family === family && one.label === label);
    if (axis?.axis === direction) return axis.position;
  }
  return null;
}

/**
 * One member's run: the clear it measures along its own axis, and what adjoins each of its two sides
 * (L-MEA-09). A tie beam reads no side — it carries no slab, and a reading of a soffit that is not
 * there would be a figure nobody drew (L-QTY-04).
 */
function runOf(key: string, member: Axis, plan: Plan, supports: readonly Support[], type: ElementType, unit: DrawnUnit | null): RunRow {
  // A drawing whose units neither the seam nor the drawing's own notes could name states no length at
  // all: the run is unread rather than stated in a unit nobody named (L-CAD-02, B-07, I-340).
  if (unit === null) return { placementKey: key, clear: null, sides: [null, null] };

  const cut = supportedSpan(member, plan, supports);
  const segments = lessOpenings(member, cut.span, openingsOf(plan));
  const clear = segments.reduce((sum, [from, to]) => sum + (to - from), 0);
  if (!(clear > 0)) return { placementKey: key, clear: null, sides: [null, null] };

  // Written onto the same 0.1-drawing-unit lattice a placement is keyed on (L-REG-04). The clear is a
  // difference of coordinates read off doubles, so a run drawn 4200 long can arrive as
  // 4199.999999999985: the lattice is the precision the artifact states a coordinate to, and a figure
  // carried past it would be a reading more exact than the drawing it came from (L-QTY-01). A clear
  // read in a unit the drawing DECLARED cites the declaration beside the lines it was read off, as a
  // ring's plan does (I-333, I-340; L-QTY-03).
  const declared = unit.sourceKey === null ? [] : [unit.sourceKey];
  const reading: RunReading = { value: quantise(clear), unit: unit.unit, basis: MEASURED, sourceKeys: [...member.keys, ...cut.sourceKeys, ...declared] };
  if (type !== "beam") return { placementKey: key, clear: reading, sides: [null, null] };
  return { placementKey: key, clear: reading, sides: sidesOf(member, segments, plan) };
}

/** The span of a member's axis left once the member carrying each of its ends has taken its own. */
function supportedSpan(member: Axis, plan: Plan, supports: readonly Support[]): { span: readonly [number, number]; sourceKeys: readonly string[] } {
  let start = member.start;
  let end = member.end;
  const cited: string[] = [];
  for (const which of ["start", "end"] as const) {
    const at = which === "start" ? member.start : member.end;
    const point: Point = member.along === "x" ? [at, member.at] : [member.at, at];
    const face = faceAt(point, member, plan, supports);
    if (face === null) continue;
    cited.push(face.key);
    if (which === "start") start = Math.max(start, face.reach[1]);
    else end = Math.min(end, face.reach[0]);
  }
  return { span: [start, end], sourceKeys: cited };
}

/**
 * The face of the member carrying one end, and how far along the run it reaches. In L-MEA-09's own
 * precedence: the vertical or foundation member whose outline the end lies in, then the same building's
 * vertical at that grid reference, then the beam crossing the end, then nothing.
 */
function faceAt(point: Point, member: Axis, plan: Plan, supports: readonly Support[]): { reach: readonly [number, number]; key: string } | null {
  const address = addressOf(plan.axes, point);
  const reaching = supports
    .filter(
      (support) =>
        (!support.ownViewOnly || support.viewKey === plan.key) &&
        support.letter === address.letter &&
        support.numeral === address.numeral &&
        Math.abs(address.offX - support.offX) <= support.halfX &&
        Math.abs(address.offY - support.offY) <= support.halfY,
    )
    // The plan that drew this member speaks first about what carries it; another plan of the same
    // building answers only where this one drew nothing there.
    .sort((left, right) => Number(right.viewKey === plan.key) - Number(left.viewKey === plan.key));

  const held = reaching[0];
  if (held !== undefined) {
    // The support's offset along the run is taken back off the axis standing ACROSS the run at this
    // grid reference — the one the offset was measured off (I-340).
    const origin = originAcross(plan.axes, address, member.along);
    const [off, half] = member.along === AXIS_X ? [held.offX, held.halfX] : [held.offY, held.halfY];
    if (origin !== null) return { reach: [origin + off - half, origin + off + half], key: held.key };
  }

  // A trimmer ends on the beam it frames into, and that beam's own edge lines are its face.
  const crossing = plan.members.find(
    (other) =>
      other !== member &&
      other.along !== member.along &&
      Math.abs(other.at - (member.along === "x" ? point[0] : point[1])) <= other.width / 2 &&
      other.start <= member.at &&
      member.at <= other.end,
  );
  return crossing === undefined ? null : { reach: [crossing.at - crossing.width / 2, crossing.at + crossing.width / 2], key: crossing.keys[0] };
}

/**
 * The span less every stretch of it lying inside a slab opening the axis crosses (L-MEA-09). An axis
 * running ALONG an opening's edge does not cross it — the trimmer framing a stair well is cast, and
 * the well is what it frames.
 */
function lessOpenings(member: Axis, span: readonly [number, number], openings: readonly Ring[]): [number, number][] {
  let kept: [number, number][] = [[span[0], span[1]]];
  for (const opening of openings) {
    const [low, high] = member.along === "x" ? [opening.min[1], opening.max[1]] : [opening.min[0], opening.max[0]];
    if (!(low < member.at && member.at < high)) continue;
    const [from, to] = member.along === "x" ? [opening.min[0], opening.max[0]] : [opening.min[1], opening.max[1]];
    const left: [number, number][] = [];
    for (const [start, end] of kept) {
      if (end <= from || start >= to) {
        left.push([start, end]);
        continue;
      }
      if (start < from) left.push([start, from]);
      if (end > to) left.push([to, end]);
    }
    kept = left;
  }
  return kept;
}

/**
 * The holes one plan's slab carries: the smallest ring each of its opening notes stands inside. The
 * note is what makes a ring a hole — a plan draws many rings, and the one the words `STAIR OPENING`
 * stand in is the one the slab is not cast over (L-CAD-03: the drawing's own words decide).
 */
function openingsOf(plan: Plan): Ring[] {
  const held = new Map<string, Ring>();
  for (const said of plan.said) {
    if (!wordsOf(said.text).some((word) => OPENING_WORDS.has(word))) continue;
    let smallest: Ring | undefined;
    for (const ring of plan.rings) {
      if (plan.placed.has(ring.key)) continue;
      if (!(ring.min[0] <= said.at[0] && said.at[0] <= ring.max[0] && ring.min[1] <= said.at[1] && said.at[1] <= ring.max[1])) continue;
      if (smallest === undefined || ring.area < smallest.area) smallest = ring;
    }
    if (smallest !== undefined) held.set(smallest.key, smallest);
  }
  return [...held.values()];
}

/** The plate the plan's slab is cast over: the widest ring it draws that is no member of its own. */
function plateOf(plan: Plan): Ring | undefined {
  let widest: Ring | undefined;
  for (const ring of plan.rings) {
    if (plan.placed.has(ring.key)) continue;
    if (widest === undefined || ring.area > widest.area) widest = ring;
  }
  return widest;
}

/**
 * The slab adjoining each side of a run (L-MEA-09: "the thicker adjoining slab governing" — which is
 * the rail's selection to make; both sides are stated here, and nothing here chooses between them).
 *
 * The probe stands one width off the axis: half a width clear of the beam's own face, so what it
 * reads is what adjoins the beam rather than the beam itself. It is taken at the midpoint of every
 * kept segment, and the side states the thickest slab any of them found — a beam half of whose length
 * runs along a void still has a soffit over the half that does not.
 *
 * What a probe reads is a SLAB READING, and until the slab panels are read (SLB-1) the plan's slab
 * reading is two statements of its own and nothing else (I-611): the thickness it states
 * (`SLAB 150 THK`) and the plate that thickness is cast over — its widest closed ring that is no
 * member of its own — each tested by the ring as drawn, never its box:
 *   · a plan that states no slab thickness has made no slab reading at all, and every side of every
 *     run on it is UNREAD. Nothing adjoining is a reading of the drawing like any other, and a plan
 *     that never said where its slab is has not said where it is not: S-15's stair roof draws the
 *     machine-room roof's outline beside the stair roof's and captions it `MRR 150 THK`, and read
 *     against the one plate its SB-R4 stood off it on both sides and billed its full depth (L-QTY-06).
 *   · a probe inside the plate and clear of every opening reads the stated thickness;
 *   · a probe inside an opening the plan names reads nothing adjoining — the well is not cast;
 *   · a probe off the plate reads nothing adjoining only where it stands inside no other closed
 *     outline the plan draws that is none of its members. Inside one, the plan has drawn something
 *     there it did not state a thickness for — a second slab, a landing, a roof over a machine room —
 *     and the side is unread.
 * An unread segment leaves its side unread, whatever the other segments read: the thicker of a
 * stated slab and a silence is not the stated one (L-QTY-01), and an unread side is never a zero
 * (L-QTY-02) — the rail then declares the line PARTIAL, naming the slab thickness it could not read.
 */
function sidesOf(member: Axis, segments: readonly [number, number][], plan: Plan): readonly [RunReading | null, RunReading | null] {
  const stated = thicknessOf(plan);
  if (stated === null) return [null, null];
  const plate = plateOf(plan);
  if (plate === undefined) return [null, null];
  const openings = openingsOf(plan);
  const others = plan.rings.filter((ring) => ring !== plate && !plan.placed.has(ring.key) && !openings.includes(ring));
  const sides: (RunReading | null)[] = [null, null];
  const unread = [false, false];

  for (const [from, to] of segments) {
    const mid = (from + to) / 2;
    for (const side of [0, 1]) {
      const off = side === 0 ? -member.width : member.width;
      const probe: Point = member.along === "x" ? [mid, member.at + off] : [member.at + off, mid];
      const reading: RunReading | null = openings.some((ring) => inside(ring, probe))
        ? { value: "0", unit: SLAB_THICKNESS_UNIT, basis: DERIVED, sourceKeys: [plate.key] }
        : inside(plate, probe)
          ? { value: stated.value, unit: SLAB_THICKNESS_UNIT, basis: TRANSCRIBED, sourceKeys: [stated.key] }
          : others.some((ring) => inside(ring, probe))
            ? null
            : { value: "0", unit: SLAB_THICKNESS_UNIT, basis: DERIVED, sourceKeys: [plate.key] };
      if (reading === null) unread[side] = true;
      else sides[side] = thicker(sides[side] ?? null, reading);
    }
  }
  return [unread[0] === true ? null : (sides[0] ?? null), unread[1] === true ? null : (sides[1] ?? null)];
}

/** The thicker of two readings of one side — a side adjoins the thickest slab it was found beside. */
function thicker(held: RunReading | null, found: RunReading): RunReading {
  if (held === null) return found;
  return Number(found.value) > Number(held.value) ? found : held;
}

/** The slab thickness this view states, and the note it states it in — null where it states none. */
function thicknessOf(plan: Plan): { value: string; key: string } | null {
  let held: { value: string; key: string } | null = null;
  for (const said of [...plan.said].sort((left, right) => (left.key < right.key ? -1 : left.key > right.key ? 1 : 0))) {
    const stated = SLAB_THICKNESS.exec(said.text.toUpperCase())?.[1];
    if (stated === undefined) continue;
    // Two notes disagreeing about one slab is a contest, not a reading: the view states none rather
    // than one of them chosen by order (L-QTY-04).
    if (held !== null && held.value !== stated) return null;
    held = { value: stated, key: said.key };
  }
  return held;
}

/** The words of a piece of the drawing's text, folded for comparison. */
function wordsOf(text: string): string[] {
  return text
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .filter((word) => word !== "");
}
