// What the machine PROPOSES for a view (R-TO-020, L-MEA-05): ranks 2 to 4, recomputed from the frozen
// artifact, the stored grid and the file's own header on every read and stored by nothing. Rank 1 is
// a person's own observation and is never proposed.
//
// Pure over the evidence it is handed: the same artifact, grid and header propose the same factors
// forever. Nothing here averages — each axis derives from its own dimensions, and a rank whose
// evidence disagrees with itself beyond tolerance along an axis, or covers only one axis, is ABSENT
// rather than resolved (riskNotes (2) to (4); fail-closed, L-QTY-04).
//
// Printed scale notes are not evidence at any rank: a TEXT saying "1:100" is a claim about scale, and
// nothing here reads one. Every proposal cites the entities it measured and nothing else (L-CAD-03).
import type { EntityGraph } from "../entitygraph/schema";
import { exact, isScaleUnit, judgeAnisotropy, metresPerExact, precedenceOf, renderFactor, unitFactor, withinTolerance, type FactorPair, type MachineScaleRank, type ScaleUnit } from "./law";
import type { ScaleAxis } from "./observation";

/** The tolerances the edition pins for this law (L-MEA-01: parameters are edition data), as ratios. */
export type ScaleTolerances = {
  /** `scaleVerificationTolerance`: how far two readings of one axis may disagree and still be one reading. */
  readonly verification: string;
  /** `scaleAnisotropyTolerance`: how far X and Y may disagree before the view is unplaceable. */
  readonly anisotropy: string;
};

/** One georeferenced bubble of a view, as inc-202's grid rows carry it (L-CAD-07). */
export type GridReading = {
  readonly viewKey: string;
  readonly axis: ScaleAxis;
  readonly position: number;
  readonly bubbleKey: string;
};

/** Everything the machine reads a drawing's proposals from. */
export type ScaleEvidence = {
  readonly graph: EntityGraph;
  /** The views proposals are asked for. */
  readonly viewKeys: readonly string[];
  /** Entity source key → view key, as the partition assigned them (L-CAD-06). */
  readonly assignments: ReadonlyMap<string, string>;
  /** Every grid row of the record, per view (inc-202's backbone). */
  readonly grid: readonly GridReading[];
  /** The header's unit as the ingest reported it: a mapped spelling, "unitless", or null for unmapped. */
  readonly unit: string | null;
  readonly tolerances: ScaleTolerances;
};

/** One proposal: the rank, the factor pair it computed, the entities it was read off, and its anisotropy judged. */
export type ScaleProposal = FactorPair & {
  readonly rank: MachineScaleRank;
  readonly evidence: readonly string[];
  readonly anisotropy: string;
  readonly placeable: boolean;
};

/**
 * One DIMENSION original as this engine reads it: the axis its non-text paint measures along, the
 * raw drawn span of that paint along the axis, what its measurement text states, and the unitless
 * ratio of the two (riskNotes (3): the style factor divided out is what stated ÷ raw span leaves).
 */
export type DimensionReading = {
  readonly key: string;
  readonly viewKey: string | null;
  readonly axis: ScaleAxis;
  readonly span: number;
  readonly stated: string;
  /** stated ÷ span, exact — a ratio, not yet a factor, because the header is what carries it into metres. */
  readonly ratio: string;
};

/**
 * How far a dimension's drawn span and the gap between two adjacent grid positions may stand apart
 * and still be the same distance, in drawing units (riskNotes (4): "within 0.1 unit").
 */
export const GRID_MATCH_TOLERANCE = 0.1;

/** The DXF type a dimension original arrives as — the one entity type this engine reads by name. */
const DIMENSION_TYPE = "DIMENSION";

/** A measurement text that states a number: digits, optionally a decimal part, nothing else. */
const STATED_NUMBER = /^[0-9]+(?:\.[0-9]+)?$/;

const AXIS_X = "x" satisfies ScaleAxis;
const AXIS_Y = "y" satisfies ScaleAxis;

/** The rank's spelling, as members of the roster rather than literals beside it. */
const GRID_SPACING = "GRID_SPACING" satisfies MachineScaleRank;
const DIMENSION_RATIO = "DIMENSION_RATIO" satisfies MachineScaleRank;
const FILE_UNITS = "FILE_UNITS" satisfies MachineScaleRank;

/** A drawn record of the artifact, original or derived — narrowed to what a reading needs. */
type Drawn = EntityGraph["derived"][number];

/**
 * The proposals of every asked-for view, by view key, each list in precedence order. A view the
 * evidence supports no rank for answers an empty list — the door turns that into the declared
 * refusal (SCALE_NO_EVIDENCE, or SCALE_UNIT_UNMAPPED where the header is what failed).
 */
export function proposalsFor(evidence: ScaleEvidence): ReadonlyMap<string, readonly ScaleProposal[]> {
  const answered = new Map<string, readonly ScaleProposal[]>();
  // The strict unit lane: no mapped unit, no metres, no rank at all (riskNotes (2)).
  if (!isScaleUnit(evidence.unit)) {
    for (const viewKey of evidence.viewKeys) answered.set(viewKey, []);
    return answered;
  }
  const unit: ScaleUnit = evidence.unit;
  const dimensions = readDimensions(evidence.graph, evidence.assignments);

  for (const viewKey of evidence.viewKeys) {
    const own = dimensions.filter((dimension) => dimension.viewKey === viewKey);
    const gaps = adjacentGapsOf(evidence.grid.filter((row) => row.viewKey === viewKey));
    const proposals: ScaleProposal[] = [];

    const matched = own.flatMap((dimension) => {
      const gap = gaps.find((candidate) => candidate.axis === dimension.axis && Math.abs(candidate.gap - dimension.span) <= GRID_MATCH_TOLERANCE);
      return gap === undefined ? [] : [{ dimension, bubbles: gap.bubbleKeys }];
    });
    const grid = rankOf(
      GRID_SPACING,
      matched.map((match) => match.dimension),
      unit,
      evidence.tolerances,
      matched.flatMap((match) => [...match.bubbles, match.dimension.key]),
    );
    if (grid !== null) proposals.push(grid);

    const ratio = rankOf(
      DIMENSION_RATIO,
      own,
      unit,
      evidence.tolerances,
      own.map((dimension) => dimension.key),
    );
    if (ratio !== null) proposals.push(ratio);

    const header = unitFactor(unit);
    if (header !== null) proposals.push({ rank: FILE_UNITS, ...header, evidence: [], ...judgeAnisotropy(header, evidence.tolerances.anisotropy) });

    answered.set(
      viewKey,
      proposals.sort((left, right) => precedenceOf(left.rank) - precedenceOf(right.rank)),
    );
  }
  return answered;
}

/**
 * One rank's proposal over the dimensions it may read, or null where the rank is absent: each axis
 * stands at the FIRST dimension's factor along it, provided every further dimension along that axis
 * agrees within the verification tolerance, and both axes must stand (X and Y derive independently,
 * and a pair with one axis missing is half a scale — never a pair with one axis borrowed).
 */
function rankOf(rank: MachineScaleRank, dimensions: readonly DimensionReading[], unit: ScaleUnit, tolerances: ScaleTolerances, evidence: readonly string[]): ScaleProposal | null {
  const factorX = axisFactorOf(dimensions.filter((dimension) => dimension.axis === AXIS_X), unit, tolerances.verification);
  const factorY = axisFactorOf(dimensions.filter((dimension) => dimension.axis === AXIS_Y), unit, tolerances.verification);
  if (factorX === null || factorY === null) return null;
  const pair = { factorX, factorY };
  return { rank, ...pair, evidence: [...new Set(evidence)], ...judgeAnisotropy(pair, tolerances.anisotropy) };
}

/** The factor one axis's dimensions agree on, in metres per drawing unit, or null where they do not or there are none. */
function axisFactorOf(dimensions: readonly DimensionReading[], unit: ScaleUnit, tolerance: string): string | null {
  const first = dimensions[0];
  if (first === undefined) return null;
  const factors = dimensions.map((dimension) => renderFactor(exact(dimension.ratio).mul(metresPerExact(unit))));
  const reference = factors[0] as string;
  return factors.every((factor) => withinTolerance(reference, factor, tolerance)) ? reference : null;
}

/** One gap between two adjacent grid positions of one axis, and the bubbles standing at both ends. */
type AdjacentGap = { readonly axis: ScaleAxis; readonly gap: number; readonly bubbleKeys: readonly string[] };

/**
 * The gaps between ADJACENT positions of one view's grid, per axis (riskNotes (4)). Two bubbles at
 * one position — an axis bubbled at both ends — are one position, and both are named as its evidence.
 */
function adjacentGapsOf(rows: readonly GridReading[]): AdjacentGap[] {
  const gaps: AdjacentGap[] = [];
  for (const axis of [AXIS_X, AXIS_Y]) {
    const positions = new Map<number, string[]>();
    for (const row of rows) {
      if (row.axis !== axis) continue;
      const held = positions.get(row.position);
      if (held === undefined) positions.set(row.position, [row.bubbleKey]);
      else held.push(row.bubbleKey);
    }
    const ordered = [...positions.keys()].sort((left, right) => left - right);
    for (let index = 1; index < ordered.length; index += 1) {
      const before = ordered[index - 1] as number;
      const after = ordered[index] as number;
      gaps.push({ axis, gap: after - before, bubbleKeys: [...(positions.get(before) ?? []), ...(positions.get(after) ?? [])] });
    }
  }
  return gaps;
}

/**
 * Every DIMENSION original of the artifact that states a number over a drawn span. `cad/` emits a
 * dimension as an original carrying no points, whose paint — the lines, the arrowheads and the
 * measurement text — arrives as derived records naming it as `src` (L-CAD-03). The measurement axis
 * is the one its non-text paint reaches further along, the span is the raw extent of that paint
 * along it, and the stated number is the one measurement text the dimension carries. A dimension
 * carrying no such text, two of them, or paint of no extent states nothing and is not read.
 */
export function readDimensions(graph: EntityGraph, assignments: ReadonlyMap<string, string>): DimensionReading[] {
  const paintOf = new Map<string, Drawn[]>();
  for (const derived of graph.derived) {
    const held = paintOf.get(derived.src);
    if (held === undefined) paintOf.set(derived.src, [derived]);
    else held.push(derived);
  }

  const readings: DimensionReading[] = [];
  for (const entity of graph.entities) {
    if (entity.type !== DIMENSION_TYPE) continue;
    const paint = paintOf.get(entity.key) ?? [];
    const texts = paint.filter((record) => typeof record.text === "string").map((record) => (record.text ?? "").trim());
    const stated = texts.filter((text) => STATED_NUMBER.test(text));
    if (stated.length !== 1) continue;
    const said = stated[0] as string;

    const extent = extentOf(paint.filter((record) => typeof record.text !== "string"));
    if (extent === null) continue;
    const axis = extent.x >= extent.y ? AXIS_X : AXIS_Y;
    const span = axis === AXIS_X ? extent.x : extent.y;
    if (!(span > 0) || !exact(said).gt(0)) continue;

    readings.push({
      key: entity.key,
      viewKey: assignments.get(entity.key) ?? null,
      axis,
      span,
      stated: said,
      ratio: exact(said).div(span).toString(),
    });
  }
  return readings;
}

/** How far some paint reaches along each axis, end to end, or null where it has no points at all. */
function extentOf(paint: readonly Drawn[]): { x: number; y: number } | null {
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  let any = false;
  for (const record of paint) {
    for (const point of record.points ?? []) {
      any = true;
      minX = Math.min(minX, point[0]);
      maxX = Math.max(maxX, point[0]);
      minY = Math.min(minY, point[1]);
      maxY = Math.max(maxY, point[1]);
    }
  }
  return any ? { x: maxX - minX, y: maxY - minY } : null;
}
