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
import type { EntityGraph } from "@/core/entitygraph/schema";
import { placementKey, quantise, viewKey as viewKeyOf, type ViewRef } from "@/core/identity";
import type { QuantityBasis } from "@/core/offers/law";
import type { Unit } from "@/core/units/canon";
import type { GridAxisRow } from "../grid/detect";
import { normaliseMark } from "../notation";
import type { PartitionedView } from "../views/assign";
import { yieldsInstances } from "../views/law";
import { classOfMark, isFoundationClass, isVerticalClass, levelWordsOf } from "./law";
import type { DetectedRuns, FamilyNamed, PlacementEvidence, PlacementRow, RunReading, RunRow } from "./rows";
import { shareValue } from "./shares";

/** The bases a reading of this stage stands on, read off the offer law's closed roster (L-QTY-01). */
const MEASURED: QuantityBasis = "MEASURED";
const TRANSCRIBED: QuantityBasis = "TRANSCRIBED";
const DERIVED: QuantityBasis = "DERIVED";

/** The two families of the backbone, named as the members of the seam's roster they are. */
const LETTER_FAMILY = "letter";
const NUMERAL_FAMILY = "numeral";

/** How few vertices a closed ring may be drawn from and still enclose an area. */
const FEWEST_OUTLINE_VERTICES = 3;

/** How many points an edge line is drawn from: two, and a polyline of three is not one. */
const EDGE_LINE_POINTS = 2;

/**
 * What the view states the slab adjoining it is: `SLAB 150 THK`, `ROOF SLAB 150 THK`. The word SLAB is
 * load-bearing — `PARAPET 150 THK, 1000 HIGH` states the thickness of a parapet and of no slab, and a
 * reader that took the number alone would give every roof beam a soffit it does not have (L-CAD-03).
 */
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
 * The classes a plan draws as a pair of edge lines rather than as a closed outline: the members that
 * span between supports. A column is drawn as its own footprint and placed by `./detect`; a beam and a
 * tie beam are drawn as the two edges of a run, and placed here (L-MEA-09).
 */
const FRAMED_CLASSES: readonly ElementType[] = Object.freeze(["beam", "tie_beam"]);

/** Is this the class of a member drawn as a run between its supports? Total over an unread mark. */
function isFramedClass(type: ElementType | null): type is ElementType {
  return type !== null && FRAMED_CLASSES.includes(type);
}

/** A point in the drawing's own plane. */
type Point = readonly [number, number];

/** An entity as this stage reads one — the artifact's own shape, narrowed to what it needs. */
type Drawn = EntityGraph["entities"][number];

/** One straight edge line of a plan: where it runs from and to, and what it was drawn on. */
type Edge = { readonly key: string; readonly layer: string; readonly from: Point; readonly to: Point };

/** One closed outline of a plan: the ring, its bounding box and its area. */
type Ring = { readonly key: string; readonly min: Point; readonly max: Point; readonly area: number };

/** One text of a plan, where it stands. */
type Said = { readonly key: string; readonly text: string; readonly at: Point };

/** A member drawn as two edge lines: the axis between them, and how far apart they were drawn. */
type Axis = {
  readonly keys: readonly [string, string];
  readonly from: Point;
  readonly to: Point;
  /** Which of the plane's two directions the axis runs along — the dominant one of its direction. */
  readonly along: "x" | "y";
  /** The coordinate the axis holds constant, and the two the run is measured between. */
  readonly at: number;
  readonly start: number;
  readonly end: number;
  readonly width: number;
};

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
 * the rings this stage must not read as a slab.
 */
export function detectRuns(evidence: PlacementEvidence, placed: readonly PlacementRow[]): DetectedRuns {
  const shares = { containmentMerge: shareValue(evidence.shares, "containmentMerge"), nearAnchor: shareValue(evidence.shares, "nearAnchor") };
  const unit = CANON_OF_HEADER[evidence.graph.insunits.unit ?? ""] ?? null;
  const axesByView = axesOf(evidence.grid);
  const ringsByKey = new Map<string, Ring>();

  const plans: Plan[] = [];
  for (const view of evidence.views) {
    if (!yieldsInstances(view.type) || view.anchorKey === null) continue;
    const axes = axesByView.get(view.viewKey) ?? [];
    const spacing = axes[0]?.minSpacing ?? 0;
    // A plan the grid stage could not georeference states no spacing, and a share of no spacing is no
    // distance: it is left alone rather than paired by numbers nobody read (L-CAD-07).
    if (!(spacing > 0)) continue;

    const standing = evidence.graph.entities.filter((entity) => evidence.assignments.get(entity.key) === view.viewKey);
    const rings = standing.flatMap((entity) => ringOf(entity) ?? []);
    for (const ring of rings) ringsByKey.set(ring.key, ring);
    const members = pairsIn(
      standing.flatMap((entity) => edgeOf(entity) ?? []),
      shares.containmentMerge * spacing,
    );
    const said = standing.flatMap((entity) => saidOf(entity) ?? []);
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
      marked: markedIn(members, said, shares.nearAnchor * spacing),
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

/** This entity read as one straight edge line, or nothing where it is not one. */
function edgeOf(entity: Drawn): [Edge] | null {
  if (entity.closed === true) return null;
  const points = (entity.points ?? []).map((point): Point => [point[0] ?? 0, point[1] ?? 0]);
  if (points.length !== EDGE_LINE_POINTS) return null;
  const [from, to] = points as [Point, Point];
  if (from[0] === to[0] && from[1] === to[1]) return null;
  return [{ key: entity.key, layer: entity.layer, from, to }];
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
  return [{ key: entity.key, min, max, area: (max[0] - min[0]) * (max[1] - min[1]) }];
}

/** This entity read as a piece of the drawing's text, or nothing where it says none. */
function saidOf(entity: Drawn): [Said] | null {
  const text = entity.text ?? "";
  const at = (entity.points ?? [])[0];
  if (text === "" || at === undefined) return null;
  return [{ key: entity.key, text, at: [at[0] ?? 0, at[1] ?? 0] }];
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
  const candidates: { readonly left: Edge; readonly right: Edge; readonly gap: number }[] = [];
  const tolerance = apart / 1000;
  for (let index = 0; index < edges.length; index += 1) {
    for (let other = index + 1; other < edges.length; other += 1) {
      const left = edges[index] as Edge;
      const right = edges[other] as Edge;
      if (left.layer !== right.layer) continue;
      const gap = translationBetween(left, right, tolerance);
      if (gap === null || !(gap > tolerance) || gap > apart) continue;
      candidates.push({ left, right, gap });
    }
  }
  candidates.sort((left, right) => left.gap - right.gap || (left.left.key < right.left.key ? -1 : left.left.key > right.left.key ? 1 : 0));

  const taken = new Set<string>();
  const members: Axis[] = [];
  for (const candidate of candidates) {
    if (taken.has(candidate.left.key) || taken.has(candidate.right.key)) continue;
    taken.add(candidate.left.key);
    taken.add(candidate.right.key);
    members.push(axisBetween(candidate.left, candidate.right, candidate.gap));
  }
  return members;
}

/**
 * How far one edge line stands off another, where the two are one member's two edges — null where they
 * are not. They are when the second is the first, translated: same direction, same length, and the
 * translation square to the direction they both run.
 */
function translationBetween(left: Edge, right: Edge, tolerance: number): number | null {
  const direction: Point = [left.to[0] - left.from[0], left.to[1] - left.from[1]];
  const length = Math.hypot(direction[0], direction[1]);
  if (!(length > 0)) return null;
  // Either end of the second line may be the one that answers the first's start: a plan draws its two
  // edges in whichever direction it drew them, and the member is the same member either way.
  for (const [from, to] of [
    [right.from, right.to],
    [right.to, right.from],
  ] as [Point, Point][]) {
    const offset: Point = [from[0] - left.from[0], from[1] - left.from[1]];
    const closing: Point = [to[0] - left.to[0], to[1] - left.to[1]];
    if (Math.hypot(offset[0] - closing[0], offset[1] - closing[1]) > tolerance) continue;
    const along = (offset[0] * direction[0] + offset[1] * direction[1]) / length;
    if (Math.abs(along) > tolerance) continue;
    return Math.hypot(offset[0], offset[1]);
  }
  return null;
}

/** The member two edge lines enclose: the axis midway between them, and the width they were drawn apart. */
function axisBetween(left: Edge, right: Edge, gap: number): Axis {
  const near = Math.hypot(right.from[0] - left.from[0], right.from[1] - left.from[1]);
  const far = Math.hypot(right.to[0] - left.from[0], right.to[1] - left.from[1]);
  const [otherFrom, otherTo] = near <= far ? [right.from, right.to] : [right.to, right.from];
  const from: Point = [(left.from[0] + otherFrom[0]) / 2, (left.from[1] + otherFrom[1]) / 2];
  const to: Point = [(left.to[0] + otherTo[0]) / 2, (left.to[1] + otherTo[1]) / 2];
  const along = Math.abs(to[0] - from[0]) >= Math.abs(to[1] - from[1]) ? "x" : "y";
  const at = along === "x" ? (from[1] + to[1]) / 2 : (from[0] + to[0]) / 2;
  const [start, end] = along === "x" ? [from[0], to[0]] : [from[1], to[1]];
  return { keys: [left.key, right.key], from, to, along, at, start: Math.min(start, end), end: Math.max(start, end), width: gap };
}

/** The member mark standing nearest each pair, where one stands within the near-anchor reach of it. */
function markedIn(members: readonly Axis[], said: readonly Said[], reach: number): Map<Axis, Said> {
  const marks = said.filter((one) => isFramedClass(classOfMark(one.text)));
  const named = new Map<Axis, Said>();
  for (const member of members) {
    const centre: Point = [(member.from[0] + member.to[0]) / 2, (member.from[1] + member.to[1]) / 2];
    let held: { mark: Said; distance: number } | null = null;
    for (const mark of marks) {
      const distance = Math.hypot(mark.at[0] - centre[0], mark.at[1] - centre[1]);
      if (distance > reach) continue;
      // Ties go to the lower source key, so one drawing anchors one way every time (L-REG-04).
      if (held === null || distance < held.distance || (distance === held.distance && mark.key < held.mark.key)) held = { mark, distance };
    }
    if (held !== null) named.set(member, held.mark);
  }
  return named;
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

/** Where a point stands on one view's backbone: the nearest axis of each family, and the offset off it. */
function addressOf(axes: readonly GridAxisRow[], at: Point): Address {
  const letter = nearestAxis(axes, LETTER_FAMILY, at);
  const numeral = nearestAxis(axes, NUMERAL_FAMILY, at);
  return {
    letter: letter?.label ?? null,
    numeral: numeral?.label ?? null,
    offX: letter === undefined ? at[0] : at[0] - letter.position,
    offY: numeral === undefined ? at[1] : at[1] - numeral.position,
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
function nearestLabel(axes: readonly GridAxisRow[], family: string, at: Point): string | null {
  return nearestAxis(axes, family, at)?.label ?? null;
}

/** The position of one view's axis by label, or null where its backbone carries no such axis. */
function axisAt(axes: readonly GridAxisRow[], family: string, label: string | null): number | null {
  if (label === null) return null;
  return axes.find((axis) => axis.family === family && axis.label === label)?.position ?? null;
}

/**
 * One member's run: the clear it measures along its own axis, and what adjoins each of its two sides
 * (L-MEA-09). A tie beam reads no side — it carries no slab, and a reading of a soffit that is not
 * there would be a figure nobody drew (L-QTY-04).
 */
function runOf(key: string, member: Axis, plan: Plan, supports: readonly Support[], type: ElementType, unit: Unit | null): RunRow {
  // A drawing whose units the seam could not map states no length at all: the run is unread rather
  // than stated in a unit nobody named (L-CAD-02, B-07).
  if (unit === null) return { placementKey: key, clear: null, sides: [null, null] };

  const cut = supportedSpan(member, plan, supports);
  const segments = lessOpenings(member, cut.span, openingsOf(plan));
  const clear = segments.reduce((sum, [from, to]) => sum + (to - from), 0);
  if (!(clear > 0)) return { placementKey: key, clear: null, sides: [null, null] };

  // Written onto the same 0.1-drawing-unit lattice a placement is keyed on (L-REG-04). The clear is a
  // difference of coordinates read off doubles, so a run drawn 4200 long can arrive as
  // 4199.999999999985: the lattice is the precision the artifact states a coordinate to, and a figure
  // carried past it would be a reading more exact than the drawing it came from (L-QTY-01).
  const reading: RunReading = { value: quantise(clear), unit, basis: MEASURED, sourceKeys: [...member.keys, ...cut.sourceKeys] };
  if (type !== "beam") return { placementKey: key, clear: reading, sides: [null, null] };
  return { placementKey: key, clear: reading, sides: sidesOf(member, segments, plan, unit) };
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
  const letterAt = axisAt(plan.axes, LETTER_FAMILY, address.letter);
  const numeralAt = axisAt(plan.axes, NUMERAL_FAMILY, address.numeral);
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
    const [origin, off, half] = member.along === "x" ? [letterAt, held.offX, held.halfX] : [numeralAt, held.offY, held.halfY];
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
 */
function sidesOf(member: Axis, segments: readonly [number, number][], plan: Plan, unit: Unit): readonly [RunReading | null, RunReading | null] {
  const plate = plateOf(plan);
  if (plate === undefined) return [null, null];
  const openings = openingsOf(plan);
  const stated = thicknessOf(plan);
  const sides: (RunReading | null)[] = [null, null];

  for (const [from, to] of segments) {
    const mid = (from + to) / 2;
    for (const side of [0, 1]) {
      const off = side === 0 ? -member.width : member.width;
      const probe: Point = member.along === "x" ? [mid, member.at + off] : [member.at + off, mid];
      const onPlate = plate.min[0] < probe[0] && probe[0] < plate.max[0] && plate.min[1] < probe[1] && probe[1] < plate.max[1];
      const inOpening = openings.some((ring) => ring.min[0] < probe[0] && probe[0] < ring.max[0] && ring.min[1] < probe[1] && probe[1] < ring.max[1]);
      // Off the plate or over a hole in it, nothing adjoins: the beam's whole depth is its own, and
      // that is a reading of the drawing rather than an absence of one (L-QTY-02).
      const reading: RunReading | null =
        !onPlate || inOpening
          ? { value: "0", unit, basis: DERIVED, sourceKeys: [plate.key] }
          : stated === null
            ? null
            : { value: stated.value, unit, basis: TRANSCRIBED, sourceKeys: [stated.key] };
      sides[side] = thicker(sides[side] ?? null, reading);
    }
  }
  return [sides[0] ?? null, sides[1] ?? null];
}

/** The thicker of two readings of one side — a side adjoins the thickest slab it was found beside. */
function thicker(held: RunReading | null, found: RunReading | null): RunReading | null {
  if (held === null) return found;
  if (found === null) return held;
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
