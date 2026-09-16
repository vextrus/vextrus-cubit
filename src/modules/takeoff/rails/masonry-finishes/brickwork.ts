// R-TO-032's "brickwork by nominal thickness", as a rail: one brick wall's face, the openings its
// schedule deducts from it, and the thickness that both measures and SELECTS the item.
//
// The opening schedule is the authority (L-MEA-02): a wall the schedule reader has not read stands
// unmeasured under `OPENING_SCHEDULE_ABSENT`, because its gross face would over-measure the work —
// and an over-measured figure is never a disclosure (L-QTY-04). The rail enumerates one candidate per
// opening instance and sums nothing; which side of the edition's threshold each falls on, and the
// deducted sum the formula subtracts, are the gate's (L-MEA-08).
//
// The thickness reaches the line as the reading it was written as — `250 mm`, never `band: 2`: the
// line records and the pricing seam bands (L-MEA-06).
import type { Kind } from "@/core/catalogue/kinds";
import type { Measure, Offer, OmittedComponent, Rail, RailInput, RailObservation, RailSetup, ReadingSetup } from "@/core/offers/contract";
import {
  AREA_THICK,
  BRICK_WALL,
  OPENING_SCHEDULE_ABSENT,
  THICKNESS,
  WALL_HEIGHT_UNSTATED,
  WALL_LENGTH_UNSTATED,
  WALL_THICKNESS_UNSTATED,
  carried,
  observe,
  scheduleOf,
  sightingOf,
  thresholdOf,
  wallOf,
  type MasonryRailCode,
} from "./read";

/** The rule this rail offers under. An offer names a rule and never a version (L-MEA-08). */
export const BRICK_WALL_VOLUME_RULE_ID = "masonry.brick_wall.volume";

/** The one kind it measures: the brickwork a mason builds, wherever the wall stands (L-MEA-04). */
const MASONRY_BRICKWORK: Kind = "masonry.brickwork";

/** The channel a wall's openings are deducted through, and the parameter it is partitioned against. */
const OPENING_CHANNEL = "opening" as const;
const OPENING_THRESHOLD_PARAMETER = "openingDeductionMinM2";

/** The variables the method declares, by the names its template spells them under (L-MEA-02). */
const LENGTH = "L";
const HEIGHT = "h";
const THICKNESS_VARIABLE = "t";

/**
 * One of the wall's three readings, bound where it was read and declared missing where it was not.
 * An unread reading is never a zero: the row is kept, carries no quantity, and says by name which
 * reading a person has to go and read (L-QTY-02).
 */
function read(stated: ReadingSetup | null, variable: string, code: MasonryRailCode): { readonly binding?: Measure; readonly omission?: OmittedComponent } {
  return stated === null ? { omission: { variable, code } } : { binding: carried(stated) };
}

/**
 * The brickwork rail: every brick wall of the batch whose opening schedule was read, offered as the
 * wall's face over its nominal thickness.
 *
 * The order of the offers is the order of the rows it was handed — a rail sorts nothing, so what it
 * answers is a function of what it was given and of nothing else.
 */
export const brickworkRail: Rail = (input: RailInput) => {
  const setup: RailSetup = input.setup;
  const offers: Offer[] = [];
  const observations: RailObservation[] = [];

  for (const row of input.objects.filter((one) => one.elementType === BRICK_WALL)) {
    const sighting = sightingOf(row, setup);
    if (!sighting.ok) {
      observations.push(observe(BRICK_WALL, MASONRY_BRICKWORK, sighting.code, row, sighting.sourceEntity));
      continue;
    }
    const { placement, calibration } = sighting;

    // L-MEA-02: "a face with no schedule is not measured (gross area would over-measure)". A wall the
    // setup holds no entry for, and one whose entry states no schedule at all, are the same fact.
    const wall = wallOf(row.placementKey, setup);
    if (wall === undefined || wall.openings === null) {
      observations.push(observe(BRICK_WALL, MASONRY_BRICKWORK, OPENING_SCHEDULE_ABSENT, row, placement.sourceEntity));
      continue;
    }

    const schedule = scheduleOf(row, wall.openings, setup, OPENING_CHANNEL);
    if (!schedule.ok) {
      for (const said of schedule.reported) observations.push(observe(BRICK_WALL, MASONRY_BRICKWORK, said.code, row, said.sourceEntity));
      continue;
    }

    const length = read(wall.length, LENGTH, WALL_LENGTH_UNSTATED);
    const height = read(wall.height, HEIGHT, WALL_HEIGHT_UNSTATED);
    const thickness = read(wall.thickness, THICKNESS_VARIABLE, WALL_THICKNESS_UNSTATED);
    const bindings: Record<string, Measure> = {};
    const omitted: OmittedComponent[] = [];
    for (const [variable, held] of [
      [LENGTH, length],
      [HEIGHT, height],
      [THICKNESS_VARIABLE, thickness],
    ] as const) {
      if (held.binding === undefined) omitted.push(held.omission as OmittedComponent);
      else bindings[variable] = held.binding;
    }

    offers.push({
      ruleId: BRICK_WALL_VOLUME_RULE_ID,
      kind: MASONRY_BRICKWORK,
      class: BRICK_WALL,
      register: { setRevisionId: row.setRevisionId, objectKey: row.objectKey },
      drawing: { drawingId: placement.drawingId, viewKey: placement.viewKey },
      engine: placement.engine,
      // A wall is L-FRM-01's AREA_THICK: a face read off the plan, over a thickness the plan states.
      geometry: { type: AREA_THICK, basis: row.standing, calibration },
      // `openings` is bound by nobody here: the gate binds the sum of what its threshold deducted,
      // and a rail that summed the candidates would be computing (L-MEA-08, riskNotes (2)).
      bindings: { ...bindings, ...thresholdOf(setup, OPENING_THRESHOLD_PARAMETER) },
      // A brickwork item is selected by the wall's nominal thickness: a 250 mm wall and a 125 mm wall
      // are two items of one kind, priced by the square or cubic measure of their own thickness
      // (R-TO-032, L-MEA-06). An unread thickness leaves the key absent rather than defaulted.
      selectors: thickness.binding === undefined ? {} : { [THICKNESS]: thickness.binding },
      deductions: schedule.candidates,
      omitted,
      // "A row kept with no quantity is PARTIAL_DECLARED, never COMPLETE" (L-QTY-02).
      coverage: omitted.length === 0 ? "COMPLETE" : "PARTIAL_DECLARED",
    });
  }

  return { offers, observations };
};
