// What code finds about one placed outline before anything is asked about it (L-QTY-04, L-AI-03).
//
// L-QTY-04 defers an interpreted outline nobody corroborated. The question put to a model about such
// an outline — "is this the member its mark names, at the size the drawing states for it?" — reasons
// over NUMBERS, and every one of them is found here, by code, from the artifact and the stages before
// it: the outline's own bounding box, the section the record's schedules state for its mark carried
// to drawing units, the median footprint of the plan's own members, how far the naming mark stands
// and how far it may stand, and the band the pinned edition states. Nothing is asked of a model
// about a figure a model supplied.
//
// ONE home for it (B-17): the production request builder (`@/core/outline-corroboration`) and the
// corpus recorder (`scripts/model-corpus/outline-corroboration.ts`) both read this function, so a
// recorded answer is an answer to the question production asks and not to one a script re-spelled.
//
// Pure over what `./detect` already answered: no store, no clock, no model, and no second reading of
// what a placement IS — the rows are taken as the stage placed them, and this file only measures the
// entities they already name. A figure it cannot find is not defaulted: the outline is left out, or
// the field is null, because a drawing that was silent reads as silence (L-MEA-07, L-QTY-04).
import type { EntityGraph } from "@/core/entitygraph/schema";
import type { OutlineEvidence } from "@/core/outline-corroboration";
import type { DetectedGrid } from "../grid/detect";
import { partitionViewKey } from "../views/law";
import type { FamilyNamed, PlacementRow } from "./rows";
import { shareValue, type PlacementShares } from "./shares";

/** A point in the drawing's own plane. */
type Point = readonly [number, number];

/** How few vertices a closed ring may be drawn from and still enclose an area (`./detect`'s own bar). */
const FEWEST_OUTLINE_VERTICES = 3;

/** One outline's bounding box, as the two sides a reader recognises a footprint by. */
type Box = { readonly longest: number; readonly shorter: number; readonly centre: Point };

/** What the evidence is read over: the artifact, what the stages before the placement derived, and the rows it placed. */
export type OutlineEvidenceInput = {
  readonly graph: EntityGraph;
  /** What the grid stage detected, or null where no such stage ran — a plan with no spacing scales nothing. */
  readonly grid: DetectedGrid | null;
  readonly shares: PlacementShares;
  /** The families the schedules stage registered for this record (R-TO-031). */
  readonly families: readonly FamilyNamed[];
  /** The members the placement stage placed — the objects the question is asked of. */
  readonly placements: readonly PlacementRow[];
};

/**
 * The evidence of every placed outline of one artifact, in the order the stage placed them.
 *
 * A placement whose outline is not a closed ring of this artifact yields nothing: `./runs` places the
 * members a plan draws as a PAIR of edge lines, and a beam has no footprint to judge against a
 * section the way a column does — asking about it would be asking about a box nobody drew.
 *
 * A plan the grid stage could not georeference yields nothing either: every band in the question is a
 * share of that plan's own spacing, and a share of no spacing is no distance (L-MEA-01).
 */
export function outlineEvidenceOf(input: OutlineEvidenceInput): OutlineEvidence[] {
  const entities = new Map(input.graph.entities.map((entity) => [entity.key, entity]));
  const spacingByView = spacingOf(input.grid);
  const reach = shareValue(input.shares, "nearAnchor");
  const footprintMin = shareValue(input.shares, "footprintMin");
  const footprintMax = shareValue(input.shares, "footprintMax");
  const stated = statedSectionOf(input.families);

  /* --- what can be measured at all: the placements whose outline is a closed ring on a plan the
     grid stage georeferenced. The two passes below are over THESE, so the plan's median and the
     drawing's scale are read off the same population the questions are asked about. --- */
  const measured: { readonly row: PlacementRow; readonly box: Box; readonly spacing: number }[] = [];
  for (const row of input.placements) {
    const box = boxOf(entities.get(row.outlineKey));
    if (box === null) continue;
    // The grid keys its axes by the partition's view key; a placement row keys itself by L-REG-04's
    // identity key (`v:`-prefixed) and carries the view it was placed on. The plan's spacing is
    // read by the partition's spelling, built from that view — never by comparing the two keys.
    const spacing = spacingByView.get(partitionViewKey(row.view.viewClass, row.view.captionAnchorSourceKey)) ?? 0;
    if (!(spacing > 0)) continue;
    measured.push({ row, box, spacing });
  }

  const medianByView = new Map<string, number>();
  for (const view of new Set(measured.map((held) => held.row.viewKey))) {
    medianByView.set(view, medianOf(measured.filter((held) => held.row.viewKey === view).map((held) => held.box.longest)));
  }

  // The drawing's own statement of what it was drawn at: the median of every measured outline's
  // longest side against the section its mark's schedule states. `./detect` reads it the same way
  // over the candidates it anchored, and both are the same sentence — a plan draws its members to
  // the sizes its schedules give them (L-MEA-01). Null where nothing can be compared, and a null
  // scale carries no stated side into drawing units at all rather than one nobody read.
  const scale = drawnScaleOf(measured, stated);

  return measured.flatMap((held) => {
    const markAt = markPointOf(entities.get(held.row.markKey));
    if (markAt === null) return [];
    const median = medianByView.get(held.row.viewKey) ?? 0;
    if (!(median > 0)) return [];
    const section = stated.get(held.row.memberFamily ?? held.row.mark);
    return [
      {
        mark: held.row.mark,
        class: held.row.elementType,
        outlineKey: held.row.outlineKey,
        markKey: held.row.markKey,
        outlineLongest: held.box.longest,
        outlineShorter: held.box.shorter,
        outlineArea: held.box.longest * held.box.shorter,
        planMedianLongest: median,
        statedLongest: section === undefined || scale === null ? null : section.longest * scale,
        statedShorter: section === undefined || scale === null || section.shorter === null ? null : section.shorter * scale,
        nearAnchorDistance: distanceBetween(markAt, held.box.centre),
        nearAnchorReach: reach * held.spacing,
        gridSpacing: held.spacing,
        footprintMin,
        footprintMax,
      },
    ];
  });
}

/** One entity read as a closed outline's bounding box, or null where it encloses no area. */
function boxOf(entity: EntityGraph["entities"][number] | undefined): Box | null {
  if (entity === undefined || entity.closed !== true) return null;
  const points = (entity.points ?? []).map((point): Point => [point[0] ?? 0, point[1] ?? 0]);
  if (points.length < FEWEST_OUTLINE_VERTICES) return null;
  const xs = points.map((point) => point[0]);
  const ys = points.map((point) => point[1]);
  const width = Math.max(...xs) - Math.min(...xs);
  const height = Math.max(...ys) - Math.min(...ys);
  return {
    longest: Math.max(width, height),
    shorter: Math.min(width, height),
    centre: [(Math.max(...xs) + Math.min(...xs)) / 2, (Math.max(...ys) + Math.min(...ys)) / 2],
  };
}

/** Where one mark stands — the first point of its own text entity, as `./detect` reads it. */
function markPointOf(entity: EntityGraph["entities"][number] | undefined): Point | null {
  const at = (entity?.points ?? [])[0];
  return at === undefined ? null : [at[0] ?? 0, at[1] ?? 0];
}

/** The minimum spacing each view's backbone was georeferenced at, by view key. */
function spacingOf(grid: DetectedGrid | null): Map<string, number> {
  const byView = new Map<string, number>();
  for (const axis of grid?.axes ?? []) if (!byView.has(axis.viewKey)) byView.set(axis.viewKey, axis.minSpacing);
  return byView;
}

/**
 * The section the record's schedules state for each mark family, in the SCHEDULES' own units: the
 * variant with the largest side, and that variant's own two sides.
 *
 * The largest, because a banded family states a section per band and the member is drawn to one of
 * them — judging by the smallest would call the member drawn at its highest band a stranger
 * (L-FRM-02, `./detect`'s own reading). The shorter side travels WITH it rather than being taken
 * across variants, so the pair asked about is a section the schedule actually states and never two
 * halves of two different bands. A family whose every section went unread states none at all.
 */
function statedSectionOf(families: readonly FamilyNamed[]): Map<string, { longest: number; shorter: number | null }> {
  const stated = new Map<string, { longest: number; shorter: number | null }>();
  for (const named of families) {
    for (const variant of named.variants ?? []) {
      const sides = [variant.sectionWidth, variant.sectionDepth].filter((side): side is number => side !== null && side > 0);
      if (sides.length === 0) continue;
      const section = { longest: Math.max(...sides), shorter: sides.length > 1 ? Math.min(...sides) : null };
      const held = stated.get(named.family);
      if (held === undefined || section.longest > held.longest) stated.set(named.family, section);
    }
  }
  return stated;
}

/** How many drawing units one unit of the schedules measures, or null where nothing can be compared. */
function drawnScaleOf(
  measured: readonly { readonly row: PlacementRow; readonly box: Box }[],
  stated: ReadonlyMap<string, { longest: number; shorter: number | null }>,
): number | null {
  const ratios = measured.flatMap((held) => {
    const said = stated.get(held.row.memberFamily ?? held.row.mark);
    return said === undefined || !(held.box.longest > 0) ? [] : [held.box.longest / said.longest];
  });
  const median = medianOf(ratios);
  return median > 0 ? median : null;
}

/** The middle of a set of measurements — the mean of the two middles where there is no single one. */
function medianOf(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle] as number;
  return ((sorted[middle - 1] as number) + (sorted[middle] as number)) / 2;
}

function distanceBetween(left: Point, right: Point): number {
  return Math.hypot(left[0] - right[0], left[1] - right[1]);
}
