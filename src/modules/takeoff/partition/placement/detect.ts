// L-CAD-07's placement: the members a layout-plan view places, read off the drawing itself — the
// fifth stage of R-TO-030's stored partition.
//
// A placement is a closed outline anchored by a member mark. Every constant that decides one is a
// CONTENT-SCALED SHARE of the view's own minimum grid spacing (L-MEA-01), read off the project's
// pinned edition and handed in: nothing here spells a distance in drawing units, so a plan drawn at
// another size places the same way.
//
// Three shares decide, in this order:
//   · near-anchor — an outline is placed only where a mark stands within `nearAnchor × spacing` of
//     it; the nearest such mark is the one that names it.
//   · footprint — a candidate whose longest side is outside the band `footprintMin … footprintMax`
//     times the MEDIAN longest side of the view's mark-anchored candidates is not a member of this
//     plan at all (riskNotes (1)): the columns of one plan are alike, and a room outline or a hatch
//     fragment is not.
//   · containment/merge — outlines of one mark whose centres stand within `containmentMerge ×
//     spacing` of each other are one member drawn twice, and yield one placement.
//
// Only layout-plan-class views are read (L-CAD-06: "only layout-plan-class views may yield
// instances"), and only a view the grid stage georeferenced: a plan with no spacing has nothing to
// scale a share by, so it stands in `ungridded` rather than being placed by numbers nobody read.
//
// Pure over the artifact and the stages before it: no store, no clock, no model. The same evidence
// places the same members forever, which is what makes the stored partition rebuildable (L-REG-04).
import type { ElementType } from "@/core/catalogue/classes";
import type { EntityGraph } from "@/core/entitygraph/schema";
import { placementKey, viewKey as viewKeyOf, type ViewRef } from "@/core/identity";
import type { DetectedGrid, GridAxisRow } from "../grid/detect";
import { normaliseMark } from "../notation";
import type { PartitionedView } from "../views/assign";
import { yieldsInstances } from "../views/law";
import { classOfMark } from "./law";
import { shareValue, type PlacementShares } from "./shares";

/** One placed member, as the store holds one and as the expansion reads one (L-REG-04). */
export type PlacementRow = {
  /** L-REG-04's view key — the class and the caption anchor the view was read at. */
  readonly viewKey: string;
  /** The view itself, as a key is derived from one: the expansion keys instance rows off it (L-REG-04). */
  readonly view: ViewRef;
  /** L-REG-04's placement key: the view, the mark and the point quantised onto the lattice. */
  readonly placementKey: string;
  readonly mark: string;
  /** What the drawing spelled, kept beside what the rule compares (L-CAD-03). */
  readonly markText: string;
  readonly elementType: ElementType;
  readonly x: number;
  readonly y: number;
  /** The nearest axis of each family of this view's backbone, or null where it carries none. */
  readonly gridLetter: string | null;
  readonly gridNumeral: string | null;
  readonly outlineKey: string;
  readonly markKey: string;
  /** The member family of the record's own schedules this mark names, or null where none does. */
  readonly memberFamily: string | null;
};

/** A layout plan that placed nothing because it georeferenced as deferred (L-CAD-07). */
export type UngriddedView = { readonly viewKey: string };

/** What one artifact's placement stage read: the plans it examined, and what it found in them. */
export type DetectedPlacements = {
  readonly views: number;
  readonly placements: readonly PlacementRow[];
  readonly ungridded: readonly UngriddedView[];
};

/** One member family the record's schedules named — what a placement's `member_family` joins to. */
export type FamilyNamed = { readonly family: string };

/** What the stage is handed: the artifact, what the stages before it derived, and the pinned shares. */
export type PlacementEvidence = {
  readonly graph: EntityGraph;
  readonly views: readonly PartitionedView[];
  /** Entity source key → view key, as the views stage assigned them (L-CAD-06). */
  readonly assignments: ReadonlyMap<string, string>;
  /** What the grid stage detected, or null where no such stage ran (L-CAD-07). */
  readonly grid: DetectedGrid | null;
  readonly shares: PlacementShares;
  /** The families the schedules stage registered for this record (R-TO-031). */
  readonly families: readonly FamilyNamed[];
};

/** A point in the drawing's own plane. */
type Point = readonly [number, number];

/** An entity as this detection reads one — the artifact's own shape, narrowed to what it needs. */
type Drawn = EntityGraph["entities"][number];

/** One mark standing on a plan: what it says, where it stands, and the class it names. */
type Mark = { readonly key: string; readonly text: string; readonly mark: string; readonly type: ElementType; readonly at: Point };

/** One closed outline of a plan: where its bounding box centres, and how long its longest side is. */
type Outline = { readonly key: string; readonly centre: Point; readonly longest: number };

/** An outline the plan's own marks name: the two together, which is what a placement is read from. */
type Anchored = { readonly outline: Outline; readonly mark: Mark };

/** The two families of the backbone, named as the members of the seam's roster they are. */
const LETTER_FAMILY = "letter";
const NUMERAL_FAMILY = "numeral";

/** How few vertices a closed ring may be drawn from and still enclose an area. */
const FEWEST_OUTLINE_VERTICES = 3;

/**
 * The placements of one artifact (L-CAD-07). Every layout-plan view is examined; a georeferenced one
 * yields the members its marks anchor, and one the grid stage deferred yields nothing and says so.
 */
export function detectPlacements(evidence: PlacementEvidence): DetectedPlacements {
  const shares = {
    containmentMerge: shareValue(evidence.shares, "containmentMerge"),
    nearAnchor: shareValue(evidence.shares, "nearAnchor"),
    footprintMin: shareValue(evidence.shares, "footprintMin"),
    footprintMax: shareValue(evidence.shares, "footprintMax"),
  };
  const families = new Set(evidence.families.map((named) => named.family));
  const axesByView = axesOf(evidence.grid);

  const placements: PlacementRow[] = [];
  const ungridded: UngriddedView[] = [];
  let examined = 0;

  for (const view of evidence.views) {
    if (!yieldsInstances(view.type) || view.anchorKey === null) continue;
    examined += 1;
    const axes = axesByView.get(view.viewKey) ?? [];
    // A plan the grid stage could not georeference states no spacing, and a share of no spacing is
    // no distance: the plan is reported rather than placed by numbers nobody read (L-CAD-07).
    const spacing = axes[0]?.minSpacing ?? 0;
    if (!(spacing > 0)) {
      ungridded.push({ viewKey: view.viewKey });
      continue;
    }
    const ref: ViewRef = { viewClass: view.type, captionAnchorSourceKey: view.anchorKey };
    for (const row of placementsIn({ evidence, view, axes, spacing, shares, families, ref })) placements.push(row);
  }

  return { views: examined, placements, ungridded };
}

/** What one plan places, keyed and grid-referenced. */
type PlanPass = {
  readonly evidence: PlacementEvidence;
  readonly view: PartitionedView;
  readonly axes: readonly GridAxisRow[];
  readonly spacing: number;
  readonly shares: { readonly containmentMerge: number; readonly nearAnchor: number; readonly footprintMin: number; readonly footprintMax: number };
  readonly families: ReadonlySet<string>;
  readonly ref: ViewRef;
};

/**
 * The members one layout plan places. The bubbles the grid was read from are excluded by the grid's
 * own citation rather than by a second reading of what a bubble is: a ring the backbone stands on is
 * a georeference, and reading it as a member would place a column at every grid intersection (B-17).
 */
function placementsIn(pass: PlanPass): PlacementRow[] {
  const cited = new Set(pass.axes.flatMap((axis) => [axis.bubbleKey, axis.labelKey]));
  const standing = pass.evidence.graph.entities.filter(
    (entity) => pass.evidence.assignments.get(entity.key) === pass.view.viewKey && !cited.has(entity.key),
  );

  const marks = standing.flatMap((entity) => markOf(entity) ?? []);
  const outlines = standing.flatMap((entity) => outlineOf(entity) ?? []);

  const reach = pass.shares.nearAnchor * pass.spacing;
  const anchored = outlines.flatMap((outline) => {
    const mark = nearestMark(outline, marks, reach);
    return mark === null ? [] : [{ outline, mark }];
  });

  const inBand = withinFootprintBand(anchored, pass.shares.footprintMin, pass.shares.footprintMax);
  const merged = mergedByMark(inBand, pass.shares.containmentMerge * pass.spacing);

  const rows: PlacementRow[] = [];
  const keyed = new Set<string>();
  for (const held of merged) {
    const placement = { view: pass.ref, mark: held.mark.mark, x: held.outline.centre[0], y: held.outline.centre[1] };
    const key = placementKey(placement);
    // Two members of one mark quantising onto one lattice point are one member (L-REG-04): the key
    // is the identity, so the second is the same placement rather than a row that collides at insert.
    if (keyed.has(key)) continue;
    keyed.add(key);
    rows.push({
      viewKey: viewKeyOf(pass.ref),
      view: pass.ref,
      placementKey: key,
      mark: held.mark.mark,
      markText: held.mark.text,
      elementType: held.mark.type,
      x: held.outline.centre[0],
      y: held.outline.centre[1],
      gridLetter: nearestLabel(pass.axes, LETTER_FAMILY, held.outline.centre),
      gridNumeral: nearestLabel(pass.axes, NUMERAL_FAMILY, held.outline.centre),
      outlineKey: held.outline.key,
      markKey: held.mark.key,
      memberFamily: pass.families.has(held.mark.mark) ? held.mark.mark : null,
    });
  }
  return rows;
}

/** One view's axes, by the view they georeference. */
function axesOf(grid: DetectedGrid | null): Map<string, GridAxisRow[]> {
  const byView = new Map<string, GridAxisRow[]>();
  for (const axis of grid?.axes ?? []) {
    const held = byView.get(axis.viewKey);
    if (held === undefined) byView.set(axis.viewKey, [axis]);
    else held.push(axis);
  }
  return byView;
}

/** This entity read as a member mark, or nothing where its text names no member (L-CAD-07). */
function markOf(entity: Drawn): [Mark] | null {
  const text = entity.text ?? "";
  const at = (entity.points ?? [])[0];
  if (text === "" || at === undefined) return null;
  const type = classOfMark(text);
  if (type === null) return null;
  return [{ key: entity.key, text, mark: normaliseMark(text), type, at: [at[0] ?? 0, at[1] ?? 0] }];
}

/** This entity read as a closed outline, or nothing where it encloses no area. */
function outlineOf(entity: Drawn): [Outline] | null {
  if (entity.closed !== true) return null;
  const points = (entity.points ?? []).map((point): Point => [point[0] ?? 0, point[1] ?? 0]);
  if (points.length < FEWEST_OUTLINE_VERTICES) return null;
  const xs = points.map((point) => point[0]);
  const ys = points.map((point) => point[1]);
  const width = Math.max(...xs) - Math.min(...xs);
  const height = Math.max(...ys) - Math.min(...ys);
  return [
    {
      key: entity.key,
      centre: [(Math.max(...xs) + Math.min(...xs)) / 2, (Math.max(...ys) + Math.min(...ys)) / 2],
      longest: Math.max(width, height),
    },
  ];
}

/**
 * The mark that names this outline: the nearest one standing within the near-anchor reach, or null
 * where none does. Ties go to the lower source key, so one drawing anchors one way every time
 * (L-REG-04).
 */
function nearestMark(outline: Outline, marks: readonly Mark[], reach: number): Mark | null {
  let held: { mark: Mark; distance: number } | null = null;
  for (const mark of marks) {
    const distance = distanceBetween(mark.at, outline.centre);
    if (distance > reach) continue;
    if (held === null || distance < held.distance || (distance === held.distance && mark.key < held.mark.key)) held = { mark, distance };
  }
  return held?.mark ?? null;
}

/**
 * The anchored candidates whose longest side stands inside the footprint band (riskNotes (1)): the
 * band is a share of the MEDIAN longest side of this plan's own mark-anchored candidates, because
 * the columns of one plan are alike and a room outline or a hatch fragment is not. A plan whose
 * candidates have no size at all is left alone: a band around zero would drop every one of them.
 */
function withinFootprintBand(anchored: readonly Anchored[], min: number, max: number): Anchored[] {
  const median = medianOf(anchored.map((held) => held.outline.longest));
  if (!(median > 0)) return [...anchored];
  return anchored.filter((held) => {
    const share = held.outline.longest / median;
    return share >= min && share <= max;
  });
}

/** The middle of a set of measurements — the mean of the two middles where there is no single one. */
function medianOf(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle] as number;
  return (((sorted[middle - 1] as number) + (sorted[middle] as number)) / 2);
}

/**
 * One member per group of outlines of ONE mark standing within the containment/merge share of each
 * other — a column drawn as an outline and its own hatch boundary is one column, and two rows of
 * quantity for it is over-measurement (L-CAD-07, L-REG-03).
 *
 * The group is single-linkage over the merge distance, and the member it yields is the FIRST of the
 * group in the artifact's own order — a representative chosen by the drawing rather than by the
 * order a reader happened to walk it in (L-REG-04).
 */
function mergedByMark(anchored: readonly Anchored[], distance: number): Anchored[] {
  const kept: Anchored[] = [];
  const merged = new Set<string>();
  for (const held of anchored) {
    if (merged.has(held.outline.key)) continue;
    kept.push(held);
    merged.add(held.outline.key);
    // Single linkage: everything reachable from the representative through a chain of merges is the
    // same member, so a member drawn as three touching rings is one and not two.
    const reachable = [held];
    while (reachable.length > 0) {
      const from = reachable.pop() as Anchored;
      for (const other of anchored) {
        if (merged.has(other.outline.key) || other.mark.mark !== held.mark.mark) continue;
        if (distanceBetween(from.outline.centre, other.outline.centre) > distance) continue;
        merged.add(other.outline.key);
        reachable.push(other);
      }
    }
  }
  return kept;
}

/**
 * The label of the nearest axis of one family, or null where this view's backbone carries none. Ties
 * go to the lower label, so a member standing midway between two axes is referenced the same way
 * every time (L-REG-04).
 */
function nearestLabel(axes: readonly GridAxisRow[], family: string, at: Point): string | null {
  let held: { label: string; distance: number } | null = null;
  for (const axis of axes) {
    if (axis.family !== family) continue;
    const distance = Math.abs((axis.axis === "x" ? at[0] : at[1]) - axis.position);
    if (held === null || distance < held.distance || (distance === held.distance && axis.label < held.label)) held = { label: axis.label, distance };
  }
  return held?.label ?? null;
}

function distanceBetween(left: Point, right: Point): number {
  return Math.hypot(left[0] - right[0], left[1] - right[1]);
}
