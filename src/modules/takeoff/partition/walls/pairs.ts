// R-TO-032's "brickwork by nominal thickness", read off the architect's plan: the brick walls a layout
// plan draws, each placed off its two FACES at a thickness the drawing's own WALL TYPES table states,
// with the openings standing in it (Interpretations I-590, I-591, I-593).
//
// An architect's plan draws a wall as the two lines of its faces, cut at every opening, stopped at every
// column, broken where another wall meets it — and never names it: no mark stands beside a wall. So a
// wall is read by GEOMETRY alone, and only at a thickness the drawing states (the WALL TYPES table,
// s-schedules I-508): two faces of one direction standing exactly that far apart, over the stretch
// BOTH are drawn. A face drawn on one side only is no wall there (the far face of a T, the side a
// junction opens). Nothing here reads a layer's name — F-ARCH files its walls on a dozen layers, some
// misspelt (A-20) — and nothing here reads a closed ring as a wall: a lift core's 250 mm walls are its
// closed rings (T-CORE-RING-250, F-RCC6-BNBC's 28 of them), and a closed ring is no face line.
//
// What else a plan draws in parallel pairs at a wall's thickness, and the fence that keeps each out:
//   · a grid line on a wall's axis, and a flight's treads 250 apart: a face line serving as a face of
//     TWO bands, on opposite sides of it, is a rung of a ladder and no wall's face (`ladders`);
//   · the dashed pair an archway's beam is drawn by, closed by the caps of the two walls either side:
//     a stretch closed at both ends by caps that each close another stretch of the same band is drawn
//     beyond the cut, not cut through (`beyondTheCut`, T-ARCHWAY);
//   · the short bands a wall's own end caps and corners make: a run shorter than the wall's own
//     thickness is the end of something else, never a wall (`WALL_SHORTER_THAN_ITS_THICKNESS`).
//
// A wall then RUNS across the gaps the drawing says it runs across, and stops at every other:
//   · an opening's gap — jambs at both ends, a tag of an opening beside it, and as wide as the plan's
//     schedule states that opening to be (`./openings`, L-MEA-02: the schedule the authority, the gap
//     the cross-check). The opening is then placed in that gap, and the wall deducts it;
//   · a T-junction's gap — the stem of a wall no thicker than this one ending at this wall's face on one
//     side only, or thinner walls ending on both sides: the thicker wall owns the junction (A-10's
//     250 > 125, L-MEA-09's one owner per junction). A crossing of equal walls is owned by neither and
//     measured by neither — under, never twice;
//   · never a gap a closed ring stands in: a column or a core owns its plan (L-MEA-09).
// And at an L-corner of two walls of one thickness with no column in it, each runs to where the two
// axes meet — "walls of one thickness meet at corners on their centrelines" (F-ARCH A-10) — within the
// reach the two faces' own geometry allows, so a corner square is owned once.
//
// Every tolerance is a share of what the drawing states: the thinnest stated thickness over a thousand
// is the congruence the faces are judged to (as `../placement/runs`' pairing is), and half the printed
// place of each thickness is how close a gap must come to it (as I-344's widths are). Pure over the
// artifact and the stages before it: no store, no clock, no model (L-REG-04).
import type { ElementType } from "@/core/catalogue/classes";
import type { Kind } from "@/core/catalogue/kinds";
import type { GridAxisRow } from "../grid/detect";
import { manualMark, placementPointOf } from "@/core/manual/identity";
import type { JudgedPoint, MeasuredGeometry } from "@/core/manual/law";
import { placementKey, quantise, viewKey as viewKeyOf, type ViewRef } from "@/core/identity";
import { exact, factorOf, isUnit } from "@/core/units/canon";
import { yieldsInstances } from "../views/law";
import type { PartitionedView } from "../views/assign";
import {
  bothDrawn,
  directionGroups,
  edgeOf,
  facesOf,
  inFrame,
  insideRing,
  linesOver,
  outOfFrame,
  saidOf,
  type Edge,
  type Face,
  type FaceStretch,
  type Frame,
  type Point,
} from "../placement/edge-pairs";
import { classOfFamily, isBoundXrefContext } from "../placement/law";
import type { DrawnUnit, PlacementEvidence, PlacementRow, WallOpeningRow, WallRow } from "../placement/rows";
import { halfUnitOf, nearestLabel } from "../placement/runs";
import { shareValue } from "../placement/shares";
import { assignedGaps, openingTagsOf, scheduledWidthOf, type OpeningTag, type TagClaim } from "./openings";

/** The two classes this lane places, written as the members of the catalogue's roster they are. */
const BRICK_WALL = "brick_wall" satisfies ElementType;
const OPENING = "opening" satisfies ElementType;

/** The kinds a brick wall bears, which its markless identity is derived over (I-378, `../../../core/catalogue/bears`). */
const WALL_KINDS: readonly Kind[] = Object.freeze(["masonry.brickwork"] satisfies Kind[]);

/** The coordinate space a plan's model-space geometry is read in, as a markless identity names it (I-378). */
const MODEL_SPACE = "model";

/** The dimension a WALL TYPES row states its thickness under (s-schedules I-508). */
const THICKNESS = "thickness";

/** The two families of the backbone, named as the members of the seam's roster they are. */
const LETTER_FAMILY = "letter";
const NUMERAL_FAMILY = "numeral";

/** How few vertices a closed ring may be drawn from and still enclose an area. */
const FEWEST_RING_VERTICES = 3;

/** How a congruence tolerance is taken off the thinnest stated thickness — `../placement/runs`' own share. */
const TOLERANCE_PARTS = 1000;

/** The basis a wall's length is read on: measured off the plan by the vector engine (L-QTY-01). */
const MEASURED = "MEASURED";

/** One wall type the drawing states: its family, its thickness as written, and that thickness at the drawn scale. */
export type WallType = {
  readonly family: string;
  readonly value: number;
  readonly unit: string;
  readonly text: string;
  readonly sourceKeys: readonly string[];
  /** The cells the family's mark was read at — what a placed wall's `markKey` cites. */
  readonly markKeys: readonly string[];
  readonly drawn: number;
  readonly halfUnit: number;
};

/**
 * The wall types the drawing's WALL TYPES tables state (s-schedules I-508): every family whose mark
 * names the brick-wall class (`BW250`) and whose row states a thickness in a unit — at the drawn scale,
 * the canon's exact factors carrying the thickness from the unit it was written in into the unit the
 * geometry is read in (L-FRM-06). Two types stating one thickness are two answers to what a wall of
 * that thickness is, and neither is read (L-QTY-04): the walls drawn at it stay unplaced.
 */
export function wallTypesOf(families: PlacementEvidence["families"], unit: DrawnUnit): WallType[] {
  const types: WallType[] = [];
  for (const named of families) {
    if (classOfFamily(named.family) !== BRICK_WALL) continue;
    for (const variant of named.variants ?? []) {
      const thickness = (variant.dimensions ?? []).find((dimension) => dimension.dimension === THICKNESS);
      if (thickness === undefined || thickness.unit === undefined || !isUnit(thickness.unit) || !(thickness.value > 0)) continue;
      const scale = exact(factorOf(thickness.unit)).dividedBy(factorOf(unit.unit));
      types.push({
        family: named.family,
        value: thickness.value,
        unit: thickness.unit,
        text: thickness.text,
        sourceKeys: thickness.sourceKeys ?? [],
        markKeys: named.sourceKeys ?? [],
        drawn: exact(thickness.value).times(scale).toNumber(),
        halfUnit: exact(halfUnitOf(thickness.value)).times(scale).toNumber(),
      });
    }
  }
  return types.filter((type) => types.filter((other) => Math.abs(other.drawn - type.drawn) <= Math.max(other.halfUnit, type.halfUnit)).length === 1);
}

/** What the wall lane read off one artifact: the placements it makes, and the walls and openings behind them. */
export type DetectedWalls = {
  readonly placements: readonly PlacementRow[];
  readonly walls: readonly WallRow[];
  readonly openings: readonly WallOpeningRow[];
};

/** Nothing placed: a drawing that states no wall type, or no unit its geometry is read in. */
const NO_WALLS: DetectedWalls = Object.freeze({ placements: Object.freeze([]), walls: Object.freeze([]), openings: Object.freeze([]) });

/** A band of one frame: its two faces, its type, and the stretches both faces are drawn over. */
type Band = {
  readonly frame: Frame;
  readonly lower: number;
  readonly upper: number;
  readonly type: WallType;
  readonly stretches: readonly FaceStretch[];
};

/** A stretch of a band once its caps are read: the lines that draw it, and the cap that closes each end. */
type Piece = { readonly from: number; readonly to: number; readonly keys: readonly string[]; readonly capStart: string | null; readonly capEnd: string | null };

/** A gap between two pieces of one band. */
type Gap = {
  readonly id: number;
  readonly band: Band;
  readonly from: number;
  readonly to: number;
  readonly jambed: boolean;
  readonly ringed: boolean;
  readonly jambs: readonly string[];
};

/** A run of a band: where it runs, what draws it, and the openings standing in its gaps. */
type Run = { from: number; to: number; keys: string[]; openings: { readonly gap: Gap; readonly claim: TagClaim }[] };

/**
 * The walls and openings one artifact's layout plans draw (I-593), placed at the thicknesses the
 * drawing's WALL TYPES tables state. Handed the unit the drawing's geometry is read in, read once by
 * `../placement/detect` for rings, runs and walls alike (I-340); null reads no wall at all, since a
 * thickness nobody can set against the plan admits nothing.
 */
export function detectWalls(evidence: PlacementEvidence, unit: DrawnUnit | null): DetectedWalls {
  if (unit === null) return NO_WALLS;
  const types = wallTypesOf(evidence.families, unit);
  if (types.length === 0) return NO_WALLS;
  const thinnest = Math.min(...types.map((type) => type.drawn));
  const tolerance = thinnest / TOLERANCE_PARTS;
  const axesByView = new Map<string, GridAxisRow[]>();
  for (const axis of evidence.grid?.axes ?? []) axesByView.set(axis.viewKey, [...(axesByView.get(axis.viewKey) ?? []), axis]);

  const placements: PlacementRow[] = [];
  const walls: WallRow[] = [];
  const openings: WallOpeningRow[] = [];
  for (const view of evidence.views) {
    if (!yieldsInstances(view.type) || view.anchorKey === null) continue;
    const axes = axesByView.get(view.viewKey) ?? [];
    // A plan the grid stage could not georeference is left alone, as every placement reader leaves it
    // (L-CAD-07): its members are read nowhere, and the stage reports it ungridded.
    const spacing = axes[0]?.minSpacing ?? 0;
    if (!(spacing > 0)) continue;
    const read = readPlan(evidence, view, types, unit, tolerance, axes);
    placements.push(...read.placements);
    walls.push(...read.walls);
    openings.push(...read.openings);
  }
  return { placements, walls, openings };
}

/**
 * The sheet a view was captioned on (I-592): the paper layout its caption stands in, which is the
 * sheet a person confirms a discipline for (L-REG-03) — or null where the caption stands in model
 * space and names no sheet, and then nothing the view places is walked until one does.
 */
export function sheetOf(evidence: PlacementEvidence, view: PartitionedView): string | null {
  const anchor = evidence.graph.entities.find((entity) => entity.key === view.anchorKey);
  return anchor === undefined || anchor.space === MODEL_SPACE ? null : anchor.space;
}

/** Everything one plan places: walls, the openings in them, and the rows both stand as. */
function readPlan(
  evidence: PlacementEvidence,
  view: PartitionedView,
  types: readonly WallType[],
  unit: DrawnUnit,
  tolerance: number,
  axes: readonly GridAxisRow[],
): { placements: PlacementRow[]; walls: WallRow[]; openings: WallOpeningRow[] } {
  // What another drawing bound in as background is none of this plan's walls (I-342).
  const standing = evidence.graph.entities.filter((entity) => evidence.assignments.get(entity.key) === view.viewKey && !isBoundXrefContext(entity.layer));
  const edges = standing.flatMap((entity) => edgeOf(entity) ?? []);
  const rings = standing.flatMap((entity) => (entity.closed === true && (entity.points ?? []).length >= FEWEST_RING_VERTICES ? [(entity.points ?? []).map((point): Point => [point[0] ?? 0, point[1] ?? 0])] : []));
  const tags = openingTagsOf(standing.flatMap((entity) => saidOf(entity) ?? []));
  const ref: ViewRef = { viewClass: view.type, captionAnchorSourceKey: view.anchorKey ?? "" };
  const key = viewKeyOf(ref);
  const sheet = sheetOf(evidence, view);

  const bands = bandsOf(edges, types, tolerance);
  const gapsByBand = new Map<Band, { pieces: Piece[]; gaps: Gap[] }>();
  let nextGap = 0;
  for (const band of bands) {
    const pieces = beyondTheCut(piecesOf(band, edges, tolerance), tolerance);
    const gaps: Gap[] = [];
    for (let index = 1; index < pieces.length; index += 1) {
      const before = pieces[index - 1] as Piece;
      const after = pieces[index] as Piece;
      if (!(after.from - before.to > tolerance)) continue;
      const middle = outOfFrame((before.to + after.from) / 2, (band.lower + band.upper) / 2, band.frame);
      gaps.push({
        id: nextGap++,
        band,
        from: before.to,
        to: after.from,
        jambed: before.capEnd !== null && after.capStart !== null,
        ringed: rings.some((ring) => insideRing(middle, ring)),
        jambs: [before.capEnd, after.capStart].flatMap((one) => one ?? []),
      });
    }
    gapsByBand.set(band, { pieces, gaps });
  }

  // Which gap each opening tag names (`./openings`): a jambed gap, no ring in it, the tag standing
  // beside it within the plan's own reach — and as wide as the plan's schedule states the opening.
  const reach = shareValue(evidence.shares, "nearAnchor") * (axes[0]?.minSpacing ?? 0);
  const claims: TagClaim[] = [];
  for (const { gaps } of gapsByBand.values()) {
    for (const gap of gaps) {
      if (!gap.jambed || gap.ringed) continue;
      for (const tag of tags) claims.push(...claimOf(tag, gap, reach, tolerance));
    }
  }
  const plan = { viewKey: view.viewKey, caption: view.caption };
  const assigned = assignedGaps(claims, (mark) => scheduledWidthOf(mark, plan, evidence.families, unit));
  const openingOf = new Map<number, TagClaim>([...assigned.values()].map((claim) => [claim.gap.id, claim]));

  // The runs: pieces joined across the gaps an opening or a junction says the wall runs across.
  const runsByBand = new Map<Band, Run[]>();
  for (const band of bands) {
    const held = gapsByBand.get(band);
    if (held === undefined || held.pieces.length === 0) continue;
    const runs: Run[] = [];
    for (const piece of held.pieces) {
      const last = runs[runs.length - 1];
      const gap = held.gaps.find((one) => last !== undefined && Math.abs(one.from - last.to) <= tolerance && Math.abs(one.to - piece.from) <= tolerance);
      const claim = gap === undefined ? undefined : openingOf.get(gap.id);
      if (last !== undefined && gap !== undefined && !gap.ringed && (claim !== undefined || junctionAt(gap, bands, gapsByBand, tolerance))) {
        last.to = piece.to;
        last.keys.push(...piece.keys, ...gap.jambs);
        if (claim !== undefined) last.openings.push({ gap, claim });
        continue;
      }
      runs.push({ from: piece.from, to: piece.to, keys: [...piece.keys], openings: [] });
    }
    // A run shorter than its own thickness is the end or the corner of something else, never a wall.
    runsByBand.set(
      band,
      runs.filter((run) => run.to - run.from >= band.type.drawn),
    );
  }
  cornersMet(runsByBand, rings, tolerance);

  const placements: PlacementRow[] = [];
  const walls: WallRow[] = [];
  const openings: WallOpeningRow[] = [];
  for (const [band, runs] of runsByBand) {
    const middle = (band.lower + band.upper) / 2;
    for (const run of runs) {
      const from = outOfFrame(run.from, middle, band.frame);
      const to = outOfFrame(run.to, middle, band.frame);
      const keys = [...new Set(run.keys)].sort();
      const geometry: MeasuredGeometry = { geometry: "POLYLINE", run: [judged(from, keys), judged(to, keys)] };
      const mark = manualMark({ elementClass: BRICK_WALL, kinds: WALL_KINDS, geometry, space: MODEL_SPACE, supersedes: null });
      const point = placementPointOf(geometry);
      const x = Number(point.x);
      const y = Number(point.y);
      const wallKey = placementKey({ view: ref, mark, x, y });
      if (placements.some((row) => row.placementKey === wallKey)) continue;
      const declared = unit.sourceKey === null ? [] : [unit.sourceKey];
      placements.push({
        viewKey: key,
        view: ref,
        placementKey: wallKey,
        mark,
        markText: band.type.family,
        elementType: BRICK_WALL,
        x,
        y,
        gridLetter: nearestLabel(axes, LETTER_FAMILY, midpointOf(from, to)),
        gridNumeral: nearestLabel(axes, NUMERAL_FAMILY, midpointOf(from, to)),
        // The first face line is the entity a reader goes back to (L-CAD-03).
        outlineKey: keys[0] ?? "",
        // What placed it is the WALL TYPES row whose thickness its faces stand apart at.
        markKey: band.type.markKeys[0] ?? band.type.sourceKeys[0] ?? "",
        memberFamily: band.type.family,
        note: null,
        sheet,
      });
      walls.push({
        placementKey: wallKey,
        viewKey: key,
        family: band.type.family,
        sheet,
        from,
        to,
        thickness: { value: String(band.type.value), unit: band.type.unit, sourceKeys: band.type.sourceKeys },
        length: { value: quantise(run.to - run.from), unit: unit.unit, basis: MEASURED, sourceKeys: [...keys, ...declared] },
      });
      for (const { gap, claim } of run.openings) {
        const gapFrom = outOfFrame(gap.from, middle, band.frame);
        const gapTo = outOfFrame(gap.to, middle, band.frame);
        const centre = midpointOf(gapFrom, gapTo);
        const openingKey = placementKey({ view: ref, mark: claim.tag.mark, x: centre[0], y: centre[1] });
        if (placements.some((row) => row.placementKey === openingKey)) continue;
        const width = scheduledWidthOf(claim.tag.mark, plan, evidence.families, unit);
        placements.push({
          viewKey: key,
          view: ref,
          placementKey: openingKey,
          mark: claim.tag.mark,
          markText: claim.tag.text,
          elementType: OPENING,
          x: centre[0],
          y: centre[1],
          gridLetter: nearestLabel(axes, LETTER_FAMILY, centre),
          gridNumeral: nearestLabel(axes, NUMERAL_FAMILY, centre),
          // The jamb that closes the gap is the entity the opening was read off; the tag named it.
          outlineKey: gap.jambs[0] ?? claim.tag.key,
          markKey: claim.tag.key,
          memberFamily: evidence.families.some((family) => family.family === claim.tag.mark) ? claim.tag.mark : null,
          note: null,
          sheet,
        });
        openings.push({
          placementKey: openingKey,
          hostPlacementKey: wallKey,
          viewKey: key,
          mark: claim.tag.mark,
          tagKey: claim.tag.key,
          sheet,
          from: gapFrom,
          to: gapTo,
          width: quantise(gap.to - gap.from),
          checked: width.kind === "stated",
        });
      }
    }
  }
  return { placements, walls, openings };
}

/** A point of a wall's axis as its markless identity is derived over (I-378): measured, cited to its faces. */
function judged(point: Point, sources: readonly string[]): JudgedPoint {
  return { x: String(point[0]), y: String(point[1]), basis: MEASURED, sources };
}

/** The point midway between two. */
function midpointOf(from: Point, to: Point): Point {
  return [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2];
}

/**
 * Every band the plan's faces draw at a stated wall thickness: in each direction, two faces standing
 * the type's thickness apart (to half its printed place), over the stretches both are drawn — less the
 * ladders (I-593).
 */
function bandsOf(edges: readonly Edge[], types: readonly WallType[], tolerance: number): Band[] {
  const bands: Band[] = [];
  for (const group of directionGroups(edges, tolerance)) {
    const faces = facesOf(group.edges, tolerance);
    const found: { lower: Face; upper: Face; band: Band }[] = [];
    for (let index = 0; index < faces.length; index += 1) {
      for (let other = index + 1; other < faces.length; other += 1) {
        const lower = faces[index] as Face;
        const upper = faces[other] as Face;
        const gap = upper.at - lower.at;
        const type = types.find((one) => Math.abs(gap - one.drawn) <= one.halfUnit);
        if (type === undefined) continue;
        const stretches = bothDrawn(lower, upper, tolerance);
        if (stretches.length === 0) continue;
        found.push({ lower, upper, band: { frame: group.frame, lower: lower.at, upper: upper.at, type, stretches } });
      }
    }
    bands.push(...ladders(found));
  }
  return bands;
}

/**
 * The bands left once every ladder is taken out: a face serving as the LOWER face of one band and the
 * UPPER face of another stands between two bands, which is how a flight's treads and a grid line on a
 * wall's axis are drawn — and never how a wall's face is, which has the wall on one side and the room
 * on the other. Every band using such a face on the wrong side is dropped; the wall whose axis the grid
 * line runs down keeps its own two faces, which serve it alone.
 */
function ladders(found: readonly { lower: Face; upper: Face; band: Band }[]): Band[] {
  const asLower = new Set(found.map((one) => one.lower));
  const asUpper = new Set(found.map((one) => one.upper));
  return found.filter((one) => !asUpper.has(one.lower) && !asLower.has(one.upper)).map((one) => one.band);
}

/**
 * A band's stretches, split at its CAPS — a line drawn square across the band from one face to the
 * other, which is how a plan closes a wall's end and a jamb closes an opening — each end of each piece
 * noting the cap that closes it.
 */
function piecesOf(band: Band, edges: readonly Edge[], tolerance: number): Piece[] {
  const caps: { at: number; key: string }[] = [];
  for (const edge of edges) {
    const from = inFrame(edge.from, band.frame);
    const to = inFrame(edge.to, band.frame);
    if (Math.abs(from.u - to.u) > tolerance) continue;
    const low = Math.min(from.v, to.v);
    const high = Math.max(from.v, to.v);
    if (Math.abs(low - band.lower) <= tolerance && Math.abs(high - band.upper) <= tolerance) caps.push({ at: (from.u + to.u) / 2, key: edge.key });
  }
  const capAt = (at: number): string | null => caps.find((cap) => Math.abs(cap.at - at) <= tolerance)?.key ?? null;
  const pieces: Piece[] = [];
  for (const stretch of band.stretches) {
    const cuts = [...new Set(caps.map((cap) => cap.at).filter((at) => at > stretch.from + tolerance && at < stretch.to - tolerance))].sort((left, right) => left - right);
    const bounds = [stretch.from, ...cuts, stretch.to];
    for (let index = 1; index < bounds.length; index += 1) {
      const from = bounds[index - 1] as number;
      const to = bounds[index] as number;
      pieces.push({ from, to, keys: linesOver(stretch.lines, from, to, tolerance), capStart: capAt(from), capEnd: capAt(to) });
    }
  }
  return pieces.sort((left, right) => left.from - right.from);
}

/**
 * The pieces cut through by the plan, less the ones drawn BEYOND the cut (T-ARCHWAY): a piece closed
 * by a cap at both ends where each cap also closes another piece of the band on its far side stands
 * between two walls' ends — the dashed pair a beam over an archway is drawn by — and is no wall.
 */
function beyondTheCut(pieces: readonly Piece[], tolerance: number): Piece[] {
  return pieces.filter((piece, index) => {
    const before = pieces[index - 1];
    const after = pieces[index + 1];
    const touchedBefore = before !== undefined && Math.abs(before.to - piece.from) <= tolerance;
    const touchedAfter = after !== undefined && Math.abs(after.from - piece.to) <= tolerance;
    return !(piece.capStart !== null && piece.capEnd !== null && touchedBefore && touchedAfter);
  });
}

/** One tag's claim on one gap, where it stands beside it: along the gap, and within the plan's reach off it. */
function claimOf(tag: OpeningTag, gap: Gap, reach: number, tolerance: number): TagClaim[] {
  const at = inFrame(tag.at, gap.band.frame);
  if (at.u < gap.from - tolerance || at.u > gap.to + tolerance) return [];
  const distance = Math.abs(at.v - (gap.band.lower + gap.band.upper) / 2);
  return distance <= reach ? [{ tag, gap: { id: gap.id, width: gap.to - gap.from }, distance }] : [];
}

/**
 * Does another wall meet this one at this gap, so that this one runs across it? A wall at right
 * angles, no thicker than this one, whose drawn stretch ends at this wall's face inside the gap and is
 * as wide as the gap — on ONE side of this wall (a T: the stem stops at the face), or thinner walls on
 * both sides (a crossing the thicker wall owns). A crossing of equal walls is owned by neither
 * (L-MEA-09: one owner per junction, and none named is none measured twice).
 */
function junctionAt(gap: Gap, bands: readonly Band[], held: ReadonlyMap<Band, { pieces: Piece[] }>, tolerance: number): boolean {
  const band = gap.band;
  const sides: { side: "lower" | "upper"; drawn: number }[] = [];
  for (const other of bands) {
    if (other === band) continue;
    const square = Math.abs(other.frame.along[0] * band.frame.along[0] + other.frame.along[1] * band.frame.along[1]);
    if (square > tolerance / Math.max(1, other.type.drawn)) continue;
    if (Math.abs(gap.to - gap.from - other.type.drawn) > other.type.halfUnit + tolerance) continue;
    const middle = (other.lower + other.upper) / 2;
    for (const piece of held.get(other)?.pieces ?? []) {
      if (piece.to - piece.from < other.type.drawn) continue;
      for (const end of [piece.from, piece.to]) {
        const at = inFrame(outOfFrame(end, middle, other.frame), band.frame);
        if (at.u < gap.from - tolerance || at.u > gap.to + tolerance) continue;
        if (Math.abs(at.v - band.lower) <= tolerance) sides.push({ side: "lower", drawn: other.type.drawn });
        if (Math.abs(at.v - band.upper) <= tolerance) sides.push({ side: "upper", drawn: other.type.drawn });
      }
    }
  }
  const standing = new Set(sides.map((one) => one.side));
  const own = band.type.drawn;
  if (standing.size === 1) return sides.every((one) => one.drawn <= own + band.type.halfUnit);
  if (standing.size === 2) return sides.every((one) => one.drawn < own - band.type.halfUnit);
  return false;
}

/**
 * Walls of one thickness meeting at an L with no column in the corner (F-ARCH A-10: "walls of one
 * thickness meet at corners on their centrelines"): each run's end is carried on along its axis to
 * where the two axes meet — no further than the corner's own faces reach, `t/2 · cot(φ/2)` for axes
 * meeting at φ, and never into a closed ring (a column there owns the corner, L-MEA-09).
 */
function cornersMet(runsByBand: ReadonlyMap<Band, Run[]>, rings: readonly (readonly Point[])[], tolerance: number): void {
  const ends: { band: Band; run: Run; end: "from" | "to"; at: Point }[] = [];
  for (const [band, runs] of runsByBand) {
    const middle = (band.lower + band.upper) / 2;
    for (const run of runs) {
      ends.push({ band, run, end: "from", at: outOfFrame(run.from, middle, band.frame) });
      ends.push({ band, run, end: "to", at: outOfFrame(run.to, middle, band.frame) });
    }
  }
  for (const one of ends) {
    for (const other of ends) {
      if (one.band === other.band || one.band.type !== other.band.type) continue;
      const a = one.band.frame.along;
      const b = other.band.frame.along;
      const cross = a[0] * b[1] - a[1] * b[0];
      if (Math.abs(cross) <= tolerance / Math.max(1, one.band.type.drawn)) continue;
      const dx = other.at[0] - one.at[0];
      const dy = other.at[1] - one.at[1];
      const s = (dx * b[1] - dy * b[0]) / cross;
      const t = (dx * a[1] - dy * a[0]) / cross;
      const meet: Point = [one.at[0] + a[0] * s, one.at[1] + a[1] * s];
      if (rings.some((ring) => insideRing(meet, ring))) continue;
      const acute = Math.acos(Math.min(1, Math.abs(a[0] * b[0] + a[1] * b[1])));
      const reach = one.band.type.drawn / 2 / Math.tan(Math.max(acute, tolerance) / 2) + tolerance;
      const onward = (end: "from" | "to", by: number): boolean => (end === "to" ? by > tolerance : by < -tolerance);
      if (!onward(one.end, s) || !onward(other.end, t) || Math.abs(s) > reach || Math.abs(t) > reach) continue;
      one.run[one.end] += s;
    }
  }
}
