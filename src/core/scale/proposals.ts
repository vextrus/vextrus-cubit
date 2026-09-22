// What the machine PROPOSES for a view (R-TO-020, L-MEA-05): ranks 2 to 4, recomputed from the frozen
// artifact, the stored grid, the lengths the drawing's own dimension texts state and the file's own
// header on every read and stored by nothing. Rank 1 is a person's own observation and is never
// proposed.
//
// Pure over the evidence it is handed: the same artifact, grid, stated lengths and header propose the
// same factors forever. Nothing here averages — each axis derives from its own dimensions, and a rank
// whose evidence carries no agreeing majority along an axis, or covers only one axis, is ABSENT rather
// than resolved (riskNotes (2) to (4); fail-closed, L-QTY-04). Where an axis's readings do agree but
// for one, that one is an overridden dimension rather than a reason to refuse the axis: the majority
// stands, and the reading it overrules is named on the proposal as a DIMENSION_OVERRIDE observation
// (I-295b, T-DIM-OVERRIDE).
//
// Printed scale notes are not evidence at any rank: a TEXT saying "1:100" is a claim about scale, and
// nothing here reads one. Every proposal cites the entities it measured and nothing else (L-CAD-03).
import type { EntityGraph } from "../entitygraph/schema";
import {
  DIMENSION_OVERRIDE,
  exact,
  isFactorString,
  isScaleUnit,
  judgeAnisotropy,
  metresPerExact,
  precedenceOf,
  renderFactor,
  unitFactor,
  withinTolerance,
  type FactorPair,
  type MachineScaleRank,
  type ScaleUnit,
} from "./law";
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

/**
 * A length a dimension's own measurement text states in a unit the TEXT names — `15'-0"` on this
 * drawing — read to metres by the notation grammar, with the words it was read from beside it.
 *
 * The grammar that reads a drawing's own words is the takeoff module's one home (B-17), and core
 * may not reach a module (ARCH-01), so the reading crosses the seam already parsed: core measures
 * spans and divides, and parses no notation of its own.
 */
export type StatedLength = {
  /** The measurement text verbatim, as the drawing wrote it. */
  readonly text: string;
  /** What those words state, in metres — the world unit a factor is spoken in (riskNotes (1)). */
  readonly metres: string;
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
  /**
   * Per DIMENSION source key, the length that dimension's measurement text states in its own named
   * unit. Empty where the gatherer handed none — the header-only reading, exactly as before.
   */
  readonly statedMetres: ReadonlyMap<string, StatedLength>;
  readonly tolerances: ScaleTolerances;
};

/**
 * One reading an axis's agreeing majority overruled: the dimension it was read from, the words that
 * dimension printed, and the factor those words state over the span it is drawn across.
 *
 * It is an OBSERVATION, not a refusal: the drawing printed a length its own geometry does not carry
 * (T-DIM-OVERRIDE, "the printed text wins (DO NOT SCALE)"), and what the machine owes a person is the
 * name of the dimension it did not scale by — never a silently averaged factor and never a refusal of
 * an axis the rest of the drawing agrees about (I-295b, L-MEA-05 rank 3).
 */
export type ScaleOverride = {
  readonly observation: typeof DIMENSION_OVERRIDE;
  readonly axis: ScaleAxis;
  /** The DIMENSION source key whose reading was overruled (L-CAD-03: a reading names its atoms). */
  readonly sourceKey: string;
  /** What that dimension's measurement text states, verbatim. */
  readonly stated: string;
  /** The metres per drawing unit that reading alone would have given, rendered as a factor is. */
  readonly factor: string;
};

/**
 * One proposal: the rank, the factor pair it computed, the entities it was read off, the readings its
 * axes overruled, and its anisotropy judged.
 */
export type ScaleProposal = FactorPair & {
  readonly rank: MachineScaleRank;
  readonly evidence: readonly string[];
  readonly overridden: readonly ScaleOverride[];
  readonly anisotropy: string;
  readonly placeable: boolean;
};

/**
 * One DIMENSION original as this engine reads it: the axis its non-text paint measures along, the
 * span it MEASURES along that axis — the extent of its own definition points, falling back to the
 * extent of its paint where it carries none (I-295b) — what its measurement text states, and what
 * that leaves: the unitless ratio of the two (riskNotes (3): the style factor divided out is what
 * stated ÷ span leaves), or the metres outright where the text named its own unit.
 *
 * Exactly one of `ratio` and `metres` stands on any reading: a bare number is a ratio the header
 * carries into metres, and a text that states its own unit has already said what it measures.
 */
export type DimensionReading = {
  readonly key: string;
  readonly viewKey: string | null;
  readonly axis: ScaleAxis;
  /** What the dimension measures along that axis, in drawing units — never what it paints (I-295b). */
  readonly span: number;
  readonly stated: string;
  /** stated ÷ span, exact — a ratio, not yet a factor, because the header is what carries it into metres. */
  readonly ratio: string | null;
  /** The metres the text itself states, where it named its own unit; null where it stated a bare number. */
  readonly metres: string | null;
};

/**
 * How far a dimension's drawn span and the gap between two adjacent grid positions may stand apart
 * and still be the same distance, in drawing units (riskNotes (4): "within 0.1 unit").
 */
export const GRID_MATCH_TOLERANCE = 0.1;

/** The DXF type a dimension original arrives as — the one entity type this engine reads by name. */
const DIMENSION_TYPE = "DIMENSION";

/**
 * How a dimension's own definition points arrive: POINT records on the layer AutoCAD reserves for
 * them, carried by the dimension as `src` like the rest of its paint (L-CAD-03). The layer is
 * compared case-folded because the reserved name is written `Defpoints` by one hand and `DEFPOINTS`
 * by another, and which of the two a draughtsman's file happens to carry says nothing about what the
 * dimension measures.
 */
const DEFINITION_POINT_TYPE = "POINT";
const DEFINITION_POINT_LAYER = "DEFPOINTS";

/** A measurement text that states a number: digits, optionally a decimal part, nothing else. */
const STATED_NUMBER = /^[0-9]+(?:\.[0-9]+)?$/;

const AXIS_X = "x" satisfies ScaleAxis;
const AXIS_Y = "y" satisfies ScaleAxis;

/** Both world axes, in the order a pair states them. */
const AXES: readonly ScaleAxis[] = [AXIS_X, AXIS_Y];

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
  // The strict unit lane holds where the drawing says nothing else: an unmapped header carries no
  // metres of its own (riskNotes (2)), so rank 4 is absent and a bare number states nothing. What
  // it does NOT bar is a dimension whose own text names its unit — that text states its length
  // whatever the header failed to say, and rank 3 reads it (I-295).
  const unit: ScaleUnit | null = isScaleUnit(evidence.unit) ? evidence.unit : null;
  const dimensions = readDimensions(evidence.graph, evidence.assignments, evidence.statedMetres);

  for (const viewKey of evidence.viewKeys) {
    const own = dimensions.filter((dimension) => dimension.viewKey === viewKey && factorOfReading(dimension, unit) !== null);
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
    // The header measures no dimension, so it overrules none: rank 4 stands on the file's own words.
    if (header !== null) proposals.push({ rank: FILE_UNITS, ...header, evidence: [], overridden: [], ...judgeAnisotropy(header, evidence.tolerances.anisotropy) });

    answered.set(
      viewKey,
      proposals.sort((left, right) => precedenceOf(left.rank) - precedenceOf(right.rank)),
    );
  }
  return answered;
}

/**
 * One rank's proposal over the dimensions it may read, or null where the rank is absent: each axis
 * stands at the factor its own dimensions agree on, and both axes must stand (X and Y derive
 * independently, and a pair with one axis missing is half a scale — never a pair with one axis
 * borrowed). What either axis overruled rides on the proposal, so the person affirming reads which
 * of the drawing's own dimensions the machine did not scale by (I-295b).
 */
function rankOf(rank: MachineScaleRank, dimensions: readonly DimensionReading[], unit: ScaleUnit | null, tolerances: ScaleTolerances, evidence: readonly string[]): ScaleProposal | null {
  const x = axisFactorOf(dimensions.filter((dimension) => dimension.axis === AXIS_X), unit, tolerances.verification);
  const y = axisFactorOf(dimensions.filter((dimension) => dimension.axis === AXIS_Y), unit, tolerances.verification);
  if (x === null || y === null) return null;
  const pair = { factorX: x.factor, factorY: y.factor };
  return { rank, ...pair, evidence: [...new Set(evidence)], overridden: [...x.overridden, ...y.overridden], ...judgeAnisotropy(pair, tolerances.anisotropy) };
}

/** One dimension's reading of an axis: the factor its words leave over its span, and where it was read. */
type AxisReading = { readonly key: string; readonly stated: string; readonly axis: ScaleAxis; readonly factor: string };

/** What one axis answered: the factor it stands at, and the readings that factor overruled. */
type AxisFactor = { readonly factor: string; readonly overridden: readonly ScaleOverride[] };

/**
 * The factor one axis's dimensions state, in metres per drawing unit, with whatever it overruled —
 * or null where they carry no answer at all.
 *
 * One reading is the axis's factor, as it always was: a drawing that dimensions an axis once has said
 * once what it measures, and there is nothing for a second reading to agree or disagree with.
 *
 * Two readings or more are judged as a body. The axis stands at the factor a MAJORITY of them agree
 * on within the verification tolerance — at least two readings, and more than half of the axis's own
 * — and every reading outside that majority is an overridden dimension, named on the proposal
 * (T-DIM-OVERRIDE: a drawing that prints `14'-2"` over a span its geometry draws as fourteen feet has
 * overridden its own dimension, and the four dimensions that agree are not silenced by it). Where no
 * such majority stands — two readings that disagree, or two pairs each agreeing with itself — the
 * axis is ABSENT rather than resolved: which half of a drawing is right is not this engine's to
 * decide (fail-closed, L-QTY-04).
 *
 * The majority is found by taking each reading in turn as the reference the others are judged
 * against, and keeping the largest body that agrees with one of its own; ties keep the reading stated
 * first, so one artifact reads the same way every time (L-REG-04).
 */
function axisFactorOf(dimensions: readonly DimensionReading[], unit: ScaleUnit | null, tolerance: string): AxisFactor | null {
  const readings = dimensions.flatMap((dimension) => {
    const factor = factorOfReading(dimension, unit);
    return factor === null ? [] : [{ key: dimension.key, stated: dimension.stated, axis: dimension.axis, factor }];
  });
  const first = readings[0];
  if (first === undefined) return null;
  if (readings.length === 1) return { factor: first.factor, overridden: [] };

  let standing: { reference: AxisReading; agreeing: AxisReading[] } | null = null;
  for (const reference of readings) {
    const agreeing = readings.filter((other) => withinTolerance(reference.factor, other.factor, tolerance));
    if (standing === null || agreeing.length > standing.agreeing.length) standing = { reference, agreeing };
  }
  if (standing === null || standing.agreeing.length < 2 || standing.agreeing.length * 2 <= readings.length) return null;

  const majority = new Set(standing.agreeing.map((reading) => reading.key));
  const overridden = readings
    .filter((reading) => !majority.has(reading.key))
    .map((reading) => ({ observation: DIMENSION_OVERRIDE, axis: reading.axis, sourceKey: reading.key, stated: reading.stated, factor: reading.factor }));
  return { factor: standing.reference.factor, overridden };
}

/**
 * The metres per drawing unit ONE dimension states, or null where it states no factor at all.
 *
 * A text that named its own unit has already said how many metres its span covers, and says it
 * whatever the header does or does not name: the factor is those metres over the drawn span
 * (I-295). A bare number is a number in the header's units and nothing else — under a mapped
 * header the header carries it into metres, and under an unmapped one it states no length, so it
 * proposes nothing rather than a guessed scale (L-MEA-05's strict unit lane).
 *
 * A reading whose metres and span render to no positive 12-place factor states no scale either: a
 * factor the rendering cannot speak is not one a calibration could be named over, and answering
 * null here is what keeps that a missing rank instead of a thrown error (ARCH-03, L-QTY-04).
 */
function factorOfReading(dimension: DimensionReading, unit: ScaleUnit | null): string | null {
  const metres = dimension.metres !== null ? exact(dimension.metres).div(dimension.span) : dimension.ratio !== null && unit !== null ? exact(dimension.ratio).mul(metresPerExact(unit)) : null;
  if (metres === null) return null;
  const factor = renderFactor(metres);
  return isFactorString(factor) ? factor : null;
}

/** One gap between two adjacent grid positions of one axis, and the bubbles standing at both ends. */
type AdjacentGap = { readonly axis: ScaleAxis; readonly gap: number; readonly bubbleKeys: readonly string[] };

/**
 * The gaps between ADJACENT positions of one view's grid, per axis (riskNotes (4)). Two bubbles at
 * one position — an axis bubbled at both ends — are one position, and both are named as its evidence.
 */
function adjacentGapsOf(rows: readonly GridReading[]): AdjacentGap[] {
  const gaps: AdjacentGap[] = [];
  for (const axis of AXES) {
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
 * is the one its non-text paint reaches further along, and the stated number is the one measurement
 * text the dimension carries. A dimension carrying no such text, two of them, paint of no extent, or
 * paint reaching equally far along both axes — which names no axis — states nothing and is not read.
 *
 * THE SPAN IS WHAT THE DIMENSION MEASURES, not what it paints (I-295b): a dimension is drawn between
 * its own definition points, and its extension lines, its arrowheads and their overshoot are the
 * dimension STYLE — the very thing rank 3's "the style factor divided out" sets aside (L-MEA-05).
 * `cad/` emits those definition points as POINT records on the reserved layer, carried by the
 * dimension like the rest of its paint, so the span along the measurement axis is their extent along
 * it. A dimension whose paint carries none of them is read exactly as it always was, off the raw
 * extent of its paint: this engine measures what the drawing gives it and invents nothing where the
 * drawing gave less.
 *
 * `statedMetres` is the other half of what a text can say: where the caller's grammar read a length
 * in a unit the TEXT named (`15'-0"`), that reading is what the dimension states and the bare-number
 * rule steps aside for it — a number standing beside words that named their unit adds nothing to
 * them. Handed none, this reads exactly the numbers it always read (I-295).
 *
 * Which view a dimension measures in: the partition's own assignment where the original carried
 * points the partition could place (L-CAD-06 — one reading, B-17). An original carrying none stands
 * nowhere for the partition, and stands where its paint stands for this engine: a dimension is drawn
 * against the entities it measures, so its paint's centre lies nearest a placed original of that
 * view, and the view of the nearest placed original is the one it measures in.
 */
export function readDimensions(graph: EntityGraph, assignments: ReadonlyMap<string, string>, statedMetres: ReadonlyMap<string, StatedLength> = new Map()): DimensionReading[] {
  const paintOf = new Map<string, Drawn[]>();
  for (const derived of graph.derived) {
    const held = paintOf.get(derived.src);
    if (held === undefined) paintOf.set(derived.src, [derived]);
    else held.push(derived);
  }
  const placed = placedOriginals(graph, assignments);
  const textsOf = measurementTextsOf(graph);

  const readings: DimensionReading[] = [];
  for (const entity of graph.entities) {
    if (entity.type !== DIMENSION_TYPE) continue;
    const paint = paintOf.get(entity.key) ?? [];
    // A text that named its own unit is what the dimension SAYS; a bare number standing beside it
    // named no unit and adds nothing to that (L-MEA-05: nothing here guesses a unit).
    const said = statedMetres.get(entity.key) ?? null;
    const stated = (textsOf.get(entity.key) ?? []).filter((text) => STATED_NUMBER.test(text));
    if (said === null && stated.length !== 1) continue;
    const number = said === null ? (stated[0] as string) : null;

    const drawn = paint.filter((record) => typeof record.text !== "string");
    const extent = extentOf(drawn);
    if (extent === null) continue;
    // Paint reaching equally far along both axes names no axis at all: neither span is the one the
    // number was measured over, and a reading filed under an axis the dimension does not measure
    // proposes a factor off evidence that says nothing (L-MEA-05, L-QTY-04).
    if (extent.x === extent.y) continue;
    const axis = extent.x > extent.y ? AXIS_X : AXIS_Y;
    // What the dimension MEASURES along that axis: its own definition points where it carries them,
    // and the raw extent of its paint where it carries none (I-295b). A dimension carrying definition
    // points that reach nowhere along the axis it measures along measures nothing there, and the
    // guard below is what leaves it unread rather than read off the style (fail-closed, L-QTY-04).
    const measured = extentOf(definitionPointsOf(paint));
    const reach = measured ?? extent;
    const span = axis === AXIS_X ? reach.x : reach.y;
    if (!(span > 0) || !exact(said?.metres ?? (number as string)).gt(0)) continue;

    const viewKey = (entity.points ?? []).length > 0 ? (assignments.get(entity.key) ?? null) : nearestViewOf(extent.centre, placed);

    readings.push({
      key: entity.key,
      viewKey,
      axis,
      span,
      stated: said?.text ?? (number as string),
      ratio: number === null ? null : exact(number).div(span).toString(),
      metres: said?.metres ?? null,
    });
  }
  return readings;
}

/**
 * The measurement texts of every DIMENSION original of an artifact, by source key, trimmed and in
 * the order the paint carries them (L-CAD-03: "a dimension's measurement text is a derived text
 * entity"). One reading of which words belong to which dimension, so the gatherer that parses those
 * words through the drawing's notation grammar and the reader that measures their spans stand on
 * the same answer rather than each walking the paint its own way (B-17).
 */
export function measurementTextsOf(graph: EntityGraph): ReadonlyMap<string, readonly string[]> {
  const dimensions = new Set(graph.entities.filter((entity) => entity.type === DIMENSION_TYPE).map((entity) => entity.key));
  const texts = new Map<string, string[]>();
  for (const derived of graph.derived) {
    if (typeof derived.text !== "string" || !dimensions.has(derived.src)) continue;
    const held = texts.get(derived.src);
    if (held === undefined) texts.set(derived.src, [derived.text.trim()]);
    else held.push(derived.text.trim());
  }
  return texts;
}

/**
 * The definition points of one dimension's paint: the POINT records it carries on the reserved layer
 * (L-CAD-03). These are what the draughtsman picked, so they are what the dimension measures between
 * — the rest of its paint is style drawn around them (I-295b).
 */
function definitionPointsOf(paint: readonly Drawn[]): Drawn[] {
  return paint.filter((record) => record.type === DEFINITION_POINT_TYPE && typeof record.layer === "string" && record.layer.toUpperCase() === DEFINITION_POINT_LAYER);
}

/** One point of the plane, as the artifact carries them. */
type Point = readonly [number, number];

/** One original the partition placed, and the points it is drawn from. */
type PlacedOriginal = { readonly viewKey: string; readonly points: readonly Point[] };

/** Every original the partition assigned a view that carries points of its own to stand at. */
function placedOriginals(graph: EntityGraph, assignments: ReadonlyMap<string, string>): PlacedOriginal[] {
  return graph.entities.flatMap((entity) => {
    const viewKey = assignments.get(entity.key);
    const points = entity.points ?? [];
    return viewKey === undefined || points.length === 0 ? [] : [{ viewKey, points }];
  });
}

/** The view of the placed original standing nearest a point, or null where nothing is placed at all. */
function nearestViewOf(at: Point, placed: readonly PlacedOriginal[]): string | null {
  let held: { viewKey: string; distance: number } | null = null;
  for (const original of placed) {
    for (const point of original.points) {
      const distance = Math.hypot(point[0] - at[0], point[1] - at[1]);
      // Ties go to the lower view key, so one artifact reads the same way every time (L-REG-04).
      if (held === null || distance < held.distance || (distance === held.distance && original.viewKey < held.viewKey)) {
        held = { viewKey: original.viewKey, distance };
      }
    }
  }
  return held?.viewKey ?? null;
}

/** How far some paint reaches along each axis, end to end, and where its middle is — or null for no points at all. */
function extentOf(paint: readonly Drawn[]): { x: number; y: number; centre: Point } | null {
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
  return any ? { x: maxX - minX, y: maxY - minY, centre: [(minX + maxX) / 2, (minY + maxY) / 2] } : null;
}
