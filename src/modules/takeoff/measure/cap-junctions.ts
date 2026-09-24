// Which piles each pile cap stands on — the one relation the cap rails need that no single stored
// reading states (L-MEA-09: pile › pile cap; Interpretation I-547).
//
// A drawing places its piles on a pile layout plan and its caps on a cap layout plan, and each plan
// stands in its own region of model space. Both draw the building's grid (L-CAD-07), so both are laid
// over one frame by it: a pile's centre, taken off the pile plan's axes and put back on the cap plan's
// same-named axes, stands where the pile stands under the caps. The cap's own ring (I-333) — never its
// bounding box, never its schedule's rectangle — then says which of those centres it holds. A cap
// turned 45° holds the piles its ring holds, and a chamfered one the piles inside its chamfer.
//
// The relation is read over the WHOLE pinned revision, never one drawing at a time: a set routinely
// draws its pile layout and its cap layout on two files, and a pile the cap's own drawing does not
// place is still a pile the pile rail bills from cut-off to toe. Each drawing's keys are kept apart
// from the same spelling in another — two files may share a handle — and every plan of every drawing
// is laid over every other by the one grid rule below.
//
// Two plans are laid over one another only where their grids agree as a TRANSLATION on the placement
// lattice (L-REG-04): every axis label the two share, and at least two per world axis, must stand at
// one offset. Plans drawn at two scales, or turned, or sharing too few axes to tell, are no frame, and
// a cap whose piles any pile plan cannot be laid under has no entry at all: nobody read its piles.
// The rails then keep its row and name `CAP_PILES_UNREAD` — never its whole prism over heads nobody
// placed (L-QTY-01: never a guess; L-QTY-04: over-measurement is a hard block).
//
// The one other reading every cap is handed is how far the piles' heads stand into it (`e`, I-544): the
// set's own note, read by the notation's head reader over each view's words (I-597). And a cap
// a recess is cast into is handed the recess — its plan sides and its depth — as the set's section of
// that cap states it, read by the partition's recess reader and bound by the cap's mark
// (I-546, I-598).
//
// Pure: placements, axes, rings and view texts in, the relation and the head out. No store, no clock — the measure setup reads
// what this is handed and hands on what it answers (L-MEA-08: rails share only setup).
import type { SectionUnit } from "@/core/db";
import type { EntityGraph } from "@/core/entitygraph/schema";
import { quantise } from "@/core/identity";
import type { CapJunctionSetup, JunctionReading, ReadingSetup, RecessSetup } from "@/core/offers/contract";
import { CANONICAL_UNIT } from "@/core/units/canon";
import { pileHeadClausesOf, pileHeadOf, type PileHeadClause, type ViewText } from "@/modules/takeoff/partition/notation/pile-head";
import { recessStatementsOf, recessesByMark, type RecessInput, type RecessSide, type RecessStatement } from "@/modules/takeoff/partition/recess/read";

/** A point in the drawing's own plane. */
export type Point = readonly [number, number];

/**
 * Every closed ring of an artifact, by the source key that names it — the entity the placement stage
 * placed a member by and named as its `outlineKey` (I-333). Read back entity by key, never re-derived:
 * which entity is a cap's ring is the placement stage's answer, and this only reads its points.
 */
export function ringsOf(graph: EntityGraph): Map<string, readonly Point[]> {
  const rings = new Map<string, readonly Point[]>();
  for (const entity of graph.entities) {
    if (entity.closed !== true || entity.points === undefined) continue;
    rings.set(
      entity.key,
      entity.points.map((point): Point => [point[0] ?? 0, point[1] ?? 0]),
    );
  }
  return rings;
}

/** One placed member, as the relation reads it: where it stands, on which view, and the ring it was placed by. */
export type PlacedMember = {
  readonly placementKey: string;
  readonly elementType: string;
  readonly viewKey: string;
  readonly x: number;
  readonly y: number;
  readonly outlineKey: string;
};

/** One grid axis, keyed by the view its placements name it under (L-CAD-07). */
export type FrameAxis = {
  readonly viewKey: string;
  readonly family: string;
  readonly axis: string;
  readonly label: string;
  readonly position: number;
};

/** The two classes the relation is between. */
const PILE_CAP = "pile_cap";
const PILE = "pile";

/** The two world axes a plan's grid places a point along. */
const WORLD_AXES = ["x", "y"] as const;

/** How few shared labels on one world axis prove two plans one frame rather than one coincidence. */
const FEWEST_SHARED = 2;

/** How many vertices a ring needs to enclose anything. */
const FEWEST_VERTICES = 3;

/** One view's axes, by world axis, then by family and label. */
type ViewFrame = ReadonlyMap<string, ReadonlyMap<string, number>>;

/** The axes of each view, keyed `axis|family` → label → position. */
function framesOf(axes: readonly FrameAxis[]): Map<string, Map<string, Map<string, number>>> {
  const held = new Map<string, Map<string, Map<string, number>>>();
  for (const axis of axes) {
    const view = held.get(axis.viewKey) ?? new Map<string, Map<string, number>>();
    const line = `${axis.axis}|${axis.family}`;
    const labels = view.get(line) ?? new Map<string, number>();
    labels.set(axis.label, axis.position);
    view.set(line, labels);
    held.set(axis.viewKey, view);
  }
  return held;
}

/**
 * The translation that lays the `from` plan over the `to` plan, or null where their grids are no one
 * frame. Per world axis: every label of every family both plans draw along it stands at one offset on
 * the placement lattice, and at least two labels say so.
 */
function translationBetween(from: ViewFrame | undefined, to: ViewFrame | undefined): Point | null {
  if (from === undefined || to === undefined) return null;
  const offsets: number[] = [];
  for (const world of WORLD_AXES) {
    const deltas: number[] = [];
    for (const [line, labels] of from) {
      if (!line.startsWith(`${world}|`)) continue;
      const theirs = to.get(line);
      if (theirs === undefined) continue;
      for (const [label, position] of labels) {
        const other = theirs.get(label);
        if (other !== undefined) deltas.push(other - position);
      }
    }
    if (deltas.length < FEWEST_SHARED) return null;
    const first = quantise(deltas[0] as number);
    if (deltas.some((delta) => quantise(delta) !== first)) return null;
    offsets.push(deltas[0] as number);
  }
  return [offsets[0] as number, offsets[1] as number];
}

/** Whether a point stands inside a closed ring (even–odd rule; a ring's own vertices close it). */
function inside(point: Point, ring: readonly Point[]): boolean {
  let held = false;
  for (let at = 0, before = ring.length - 1; at < ring.length; before = at, at += 1) {
    const [xi, yi] = ring[at] as Point;
    const [xj, yj] = ring[before] as Point;
    if (yi > point[1] !== yj > point[1] && point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi) + xi) held = !held;
  }
  return held;
}

/**
 * The pile placements each pile cap's ring holds, by the cap's placement key, in key order — for the
 * caps whose piles could be read at all. A cap is left out, never answered empty, where its ring was
 * not read or where any view placing piles cannot be laid over its view: then nobody knows which piles
 * it stands on. A cap every pile plan CAN be laid under and whose ring holds none is answered empty —
 * the plans disagree about it, and the rails say so (`CAP_HOLDS_NO_PILE`).
 *
 * A pile view that cannot be laid over a cap's view leaves THAT cap unread, and never only its own
 * piles uncounted: the piles it places may stand under the cap, and a count that skipped them would
 * net fewer heads than the cap holds — a figure over, published as whole (L-QTY-04). A cap on another
 * view every pile plan CAN be laid under is read as ever.
 *
 * View keys are one namespace here: a caller reading more than one drawing keeps each drawing's keys
 * apart before it asks (`pilesHeldOverRevision`).
 */
export function pilesHeldOf(input: {
  readonly placements: readonly PlacedMember[];
  readonly axes: readonly FrameAxis[];
  readonly ringOf: (outlineKey: string) => readonly Point[] | null;
}): Map<string, string[]> {
  const caps = input.placements.filter((one) => one.elementType === PILE_CAP);
  const piles = input.placements.filter((one) => one.elementType === PILE);
  const held = new Map<string, string[]>();
  if (caps.length === 0 || piles.length === 0) return held;

  const frames = framesOf(input.axes);
  const pileViews = [...new Set(piles.map((pile) => pile.viewKey))];
  for (const cap of [...caps].sort((left, right) => (left.placementKey < right.placementKey ? -1 : left.placementKey > right.placementKey ? 1 : 0))) {
    const ring = input.ringOf(cap.outlineKey);
    if (ring === null || ring.length < FEWEST_VERTICES) continue;
    const laid = new Map(pileViews.map((view) => [view, view === cap.viewKey ? ([0, 0] as Point) : translationBetween(frames.get(view), frames.get(cap.viewKey))]));
    if ([...laid.values()].some((translation) => translation === null)) continue;
    const under = piles
      .filter((pile) => {
        const [dx, dy] = laid.get(pile.viewKey) as Point;
        return inside([pile.x + dx, pile.y + dy], ring);
      })
      .map((pile) => pile.placementKey)
      .sort();
    held.set(cap.placementKey, under);
  }
  return held;
}

/** One drawing of the pinned revision, as the relation reads it: what it places, its grid, its rings. */
export type DrawingReading = {
  /** The drawing's own record — what keeps two drawings' view keys and entity handles apart. */
  readonly drawing: string;
  readonly placements: readonly PlacedMember[];
  readonly axes: readonly FrameAxis[];
  /** The ring an entity of THIS drawing closes, by its source key. */
  readonly ringOf: (outlineKey: string) => readonly Point[] | null;
};

/** A key of one drawing, kept apart from the same spelling in another. */
function within(drawing: string, key: string): string {
  return `${drawing}|${key}`;
}

/**
 * The pile placements each pile cap of the WHOLE revision holds (L-MEA-09, I-547): every drawing's
 * placements and grid read into one relation, so a cap on one drawing is laid over the piles another
 * drawing places. Placement keys already name one member across the revision and are kept as they
 * are; view keys and outline keys are a drawing's own and are kept apart, since two files may spell
 * one handle. Each cap's ring is still read out of its own drawing, by its own key.
 */
export function pilesHeldOverRevision(drawings: readonly DrawingReading[]): Map<string, string[]> {
  const rings = new Map<string, readonly Point[] | null>();
  const placements: PlacedMember[] = [];
  const axes: FrameAxis[] = [];
  for (const one of drawings) {
    for (const placed of one.placements) {
      const outlineKey = within(one.drawing, placed.outlineKey);
      if (placed.elementType === PILE_CAP) rings.set(outlineKey, one.ringOf(placed.outlineKey));
      placements.push({ ...placed, viewKey: within(one.drawing, placed.viewKey), outlineKey });
    }
    for (const axis of one.axes) axes.push({ ...axis, viewKey: within(one.drawing, axis.viewKey) });
  }
  return pilesHeldOf({ placements, axes, ringOf: (outlineKey) => rings.get(outlineKey) ?? null });
}

/**
 * How far the held piles' heads stand above a cap's soffit where nothing states it: UNBOUNDED, so a
 * cap holding piles keeps its row with `PILE_HEAD_UNSTATED` rather than publishing a figure over the
 * heads (L-QTY-04).
 */
const HEAD_HEIGHT_UNREAD: JunctionReading = Object.freeze({ reading: null, standing: "UNBOUNDED" as const });

/**
 * Every text of a drawing's model space, by the view the partition assigned its entity to (L-CAD-06),
 * in the artifact's own order — what a note reader reads one detail's words from. A text no view
 * holds is left out: it belongs to no detail a clause could be read beside.
 */
export function viewTextsOf(graph: EntityGraph, assignments: ReadonlyMap<string, string>): Map<string, ViewText[]> {
  const texts = new Map<string, ViewText[]>();
  for (const entity of graph.entities) {
    if (typeof entity.text !== "string") continue;
    const view = assignments.get(entity.key);
    if (view === undefined) continue;
    const held = texts.get(view) ?? [];
    held.push({ sourceKey: entity.key, text: entity.text });
    texts.set(view, held);
  }
  return texts;
}

/** One drawing's words for the head reading: its texts by view, and the unit it declares its dimensions in. */
export type HeadReading = {
  readonly textsByView: ReadonlyMap<string, readonly ViewText[]>;
  readonly declaredUnit: SectionUnit | null;
};

/**
 * How far the piles' heads stand into their caps, as the pinned revision's own notes state it
 * (I-544, I-597): every view of every drawing handed in is read by the notation's head reader
 * (`pileHeadClausesOf`), and the revision states ONE height where every clause that states one agrees
 * (`pileHeadOf`). The figure is carried as written — `3` `in` — TRANSCRIBED, cited to the clause, and
 * RESOLVED, or BOUNDED where the note states only the most it can be. Where no clause states it, or
 * two disagree, it stays UNBOUNDED and every cap holding piles keeps its row naming
 * `PILE_HEAD_UNSTATED`.
 */
export function headHeightOverRevision(drawings: readonly HeadReading[]): JunctionReading {
  const clauses: PileHeadClause[] = [];
  for (const drawing of drawings) {
    for (const texts of drawing.textsByView.values()) clauses.push(...pileHeadClausesOf(texts, drawing.declaredUnit));
  }
  const head = pileHeadOf(clauses);
  if (head === null) return HEAD_HEIGHT_UNREAD;
  const source = head.sourceKeys[0] as string;
  return Object.freeze({ reading: { value: head.value, unit: head.unit, basis: "TRANSCRIBED" as const, source }, standing: head.standing });
}

/** One drawing's evidence for the recess reading: its artifact, its views and their assignments, its unit. */
export type RecessReading = Omit<RecessInput, "marks">;

/** A side as the setup hands it: TRANSCRIBED — the figure the set writes — and cited to the entity writing it. */
function readingOf(side: RecessSide | null): ReadingSetup | null {
  return side === null ? null : { value: side.value, unit: side.unit, basis: "TRANSCRIBED", source: side.source };
}

/**
 * The recess cast into each pile cap of the pinned revision, by mark (I-546, I-598): every
 * drawing handed in is read by the partition's recess reader (`recessStatementsOf`) for the marks the
 * revision's caps carry, and the revision states ONE recess per mark (`recessesByMark`) — each side
 * where every statement that states it agrees. A mark the set draws or names as recessed but does not
 * state every way carries the sides it states and null for the rest; the rails keep its rows naming
 * `CAP_RECESS_UNSTATED`. A mark nothing speaks of has no entry: its caps are their prisms.
 */
export function recessesOverRevision(drawings: readonly RecessReading[], marks: readonly string[]): Map<string, RecessSetup> {
  const statements: RecessStatement[] = [];
  for (const drawing of drawings) statements.push(...recessStatementsOf({ ...drawing, marks }));
  const recesses = new Map<string, RecessSetup>();
  for (const [mark, recess] of recessesByMark(statements)) {
    recesses.set(mark, Object.freeze({ length: readingOf(recess.length), breadth: readingOf(recess.breadth), depth: readingOf(recess.depth) }));
  }
  return recesses;
}

/**
 * One cap's junctions, as the rails are handed them: the piles its ring holds and how many, cited to
 * the cap's own placement — the count was taken over its ring — and MEASURED, read off the two plans
 * by the vector engine (L-QTY-01, L-QTY-03); how far their heads stand into it, as the revision's
 * notes state it (`headHeightOverRevision`), UNBOUNDED where none does; and the recess cast into it,
 * as the set's section of its mark states it (`recessesOverRevision`), null where the set draws and
 * names none.
 */
export function capJunctionSetupOf(capPlacementKey: string, piles: readonly string[], headHeight: JunctionReading = HEAD_HEIGHT_UNREAD, recess: RecessSetup | null = null): CapJunctionSetup {
  return {
    piles: Object.freeze([...piles]),
    count: { value: String(piles.length), unit: CANONICAL_UNIT.COUNT, basis: "MEASURED", source: capPlacementKey },
    headHeight,
    recess,
  };
}
