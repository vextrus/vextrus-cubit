// What every MASONRY rail reads before it offers anything: where the row was sighted, the calibration
// its view stands on, and the opening schedule that stands behind its face.
//
// It stands in its own file because the area's three rails ask the same questions of the same
// schedule and one answer to each is the only way they cannot part (B-17): a plaster and a paint of
// one surface deduct the SAME openings, and a wall and its finishes read a schedule row the same way.
//
// Nothing here computes and nothing converts: an opening's area is carried in the unit the schedule
// wrote it in, the candidates are ENUMERATED one per instance, and both the summing and the carrying
// are the gate's (L-MEA-08, L-MEA-02's deducted sum, B-17).
import type { ElementType } from "@/core/catalogue/classes";
import type { Kind } from "@/core/catalogue/kinds";
import type { RefusalCode } from "@/core/errors";
import { bandCovers, bandJudgeable, placedBy } from "@/core/offers/contract";
import type {
  DeductionCandidate,
  DeductionChannel,
  Measure,
  OpeningSetup,
  PlacementSetup,
  RailObservation,
  RailSetup,
  ReadingSetup,
  RegisterObjectRow,
  SurfaceSetup,
  WallSetup,
} from "@/core/offers/contract";

/**
 * The rail-local closed code roster of this area: every reason a masonry rail reports a row it did
 * not offer whole. Each is a registered refusal too — the same taxonomy serves a machine's refusals
 * and a reader's evidence (R-SPINE-062, L-MEA-08), which is what `satisfies` holds this to.
 *
 * The first six are OBSERVATIONS about a face nothing can be measured off: a view nobody affirmed, a
 * row the setup places nowhere, a face no schedule stands behind, an opening nobody could area, a
 * schedule row claiming floors the stack cannot place, and an outline that did not close. Measuring
 * past any of them would OVER-measure, which L-QTY-04 forecloses outright. The last five are
 * omissions on a KEPT row: a reading a drawing simply does not state keeps its row and names what is
 * missing (L-QTY-02).
 */
export const MASONRY_RAIL_CODES = [
  "VIEW_SCALE_UNAFFIRMED",
  "MEMBER_TYPE_UNKNOWN",
  "OPENING_SCHEDULE_ABSENT",
  "OPENING_NOT_AREABLE",
  "OPENING_FLOOR_UNJUDGEABLE",
  "SURFACE_NOT_CLOSED",
  "WALL_LENGTH_UNSTATED",
  "WALL_HEIGHT_UNSTATED",
  "WALL_THICKNESS_UNSTATED",
  "FINISH_GROSS_UNSTATED",
  "FINISH_SELECTOR_UNSTATED",
] as const satisfies readonly RefusalCode[];

/** One code of the roster above. */
export type MasonryRailCode = (typeof MASONRY_RAIL_CODES)[number];

/**
 * The roster's members by name, read off the roster itself rather than spelled a second time: one
 * code has one spelling in this area, and a rail that reports one names it from here (Q-07).
 */
export const [
  VIEW_SCALE_UNAFFIRMED,
  MEMBER_TYPE_UNKNOWN,
  OPENING_SCHEDULE_ABSENT,
  OPENING_NOT_AREABLE,
  OPENING_FLOOR_UNJUDGEABLE,
  SURFACE_NOT_CLOSED,
  WALL_LENGTH_UNSTATED,
  WALL_HEIGHT_UNSTATED,
  WALL_THICKNESS_UNSTATED,
  FINISH_GROSS_UNSTATED,
  FINISH_SELECTOR_UNSTATED,
] = MASONRY_RAIL_CODES;

/** The two classes this area measures (R-TO-032, L-MEA-03). */
export const BRICK_WALL: ElementType = "brick_wall";
export const SURFACE: ElementType = "surface";

/** The geometries this area's faces are read off (L-FRM-01): a wall is an area × its thickness. */
export const AREA_THICK = "AREA_THICK";
export const POLYGON = "POLYGON";

/** The variable each method declares its DERIVED threshold under (L-MEA-02's "threshold in force"). */
export const THRESHOLD = "threshold";

/** The facts that SELECT an item of this area, by the names a line carries them under (L-MEA-06). */
export const THICKNESS = "thickness";
export const MIX = "mix";
export const FACE = "face";
export const FLOOR = "floor";

/** A count states how many of a mark the schedule claims: whole members, and at least one of them. */
const A_POSITIVE_WHOLE_NUMBER = /^[1-9][0-9]*$/;

/** One observation about a row a masonry rail did not offer for, under this area's roster (L-MEA-08). */
export function observe(className: ElementType, kind: Kind, code: MasonryRailCode, row: RegisterObjectRow, sourceEntity: string): RailObservation {
  return { class: className, kind, code, objectKey: row.objectKey, sourceEntity };
}

/**
 * One observation carrying a DETAIL: which of the facts that select the item was left unstated. The
 * detail names the selector because the code alone says a fact is missing and not which one, and a
 * reader has to know which cell of the finish schedule to go and read (L-QTY-04, R-UI-050).
 */
export function observeSelector(className: ElementType, kind: Kind, row: RegisterObjectRow, sourceEntity: string, selector: string): RailObservation {
  return { class: className, kind, code: FINISH_SELECTOR_UNSTATED, objectKey: row.objectKey, sourceEntity, detail: { selector } };
}

/** Where a row was sighted and what it stands on — or the code the rail reports instead. */
export type Sighting =
  | { readonly ok: true; readonly placement: PlacementSetup; readonly calibration: string }
  | { readonly ok: false; readonly code: MasonryRailCode; readonly sourceEntity: string };

/**
 * The sighting of one register row: the placement the partition stored for it, and the affirmed
 * calibration of the view it was read in.
 *
 * A rail cannot mint a calibration reference it does not hold, and a line always carries "a non-empty
 * set of affirmed calibration references" (L-QTY-03): a view nobody has affirmed a scale for is
 * reported against THE VIEW — what a reader has to go and affirm. A row whose placement the setup
 * does not hold names a sighting nothing can be traced to, and reaches the residue as evidence.
 */
export function sightingOf(row: RegisterObjectRow, setup: RailSetup): Sighting {
  const placement = setup.placements[row.placementKey];
  if (placement === undefined) return { ok: false, code: MEMBER_TYPE_UNKNOWN, sourceEntity: row.placementKey };
  const calibration = setup.calibrations[placement.ingestId]?.[placement.viewKey];
  if (calibration === undefined || calibration.length === 0) return { ok: false, code: VIEW_SCALE_UNAFFIRMED, sourceEntity: placement.viewKey };
  return { ok: true, placement, calibration };
}

/** The wall the wall plan and the opening schedule state behind one placement, if they state one. */
export function wallOf(placementKey: string, setup: RailSetup): WallSetup | undefined {
  return setup.walls[placementKey];
}

/** The surface the reader read for one placement, if it read one. */
export function surfaceOf(placementKey: string, setup: RailSetup): SurfaceSetup | undefined {
  return setup.surfaces[placementKey];
}

/** One reading of the setup as an offer carries it: what was read, in the unit it was read in. */
export function carried(reading: ReadingSetup): Measure {
  return { value: reading.value, unit: reading.unit, basis: reading.basis, source: reading.source };
}

/**
 * The threshold this channel's candidates are partitioned against, bound DERIVED from the pinned
 * edition it cites (L-MEA-02: "the threshold in force lands in the line's variables"; L-MEA-06: "a
 * citable clause is DERIVED, not DEFAULTED").
 *
 * An edition that states no figure for a channel it admits is an inconsistency of the store rather
 * than a reading this offer can carry: nothing is bound, and the gate answers the offer by name
 * rather than a rail guessing a threshold (ARCH-03, L-MEA-01).
 */
export function thresholdOf(setup: RailSetup, parameterKey: string): Record<string, Measure> {
  const stated = setup.edition.parameters[parameterKey];
  if (stated === undefined) return {};
  return { [THRESHOLD]: { value: stated.value, unit: stated.unit, basis: "DERIVED", source: `edition:${setup.edition.digest}#${parameterKey}` } };
}

/** What one face's opening schedule comes to: the candidates it states, or why it states none. */
export type Schedule =
  | { readonly ok: true; readonly candidates: DeductionCandidate[] }
  | { readonly ok: false; readonly reported: readonly { readonly code: MasonryRailCode; readonly sourceEntity: string }[] };

/**
 * Every opening INSTANCE one schedule states for the level this row stands on, as candidates in one
 * channel — one per unit of the row's `count`, and none at all from a row whose claimed floors do not
 * cover that level (L-MEA-02: "opening marks are scoped to their floor group").
 *
 * A row claiming floors is an EXPANSION of the schedule over a stack, so its instances are DERIVED
 * even though the area they carry was transcribed; a row claiming none stands in the face's own floor
 * group and carries the area's own basis (L-MEA-02: "a schedule row claiming floors makes the
 * expansion DERIVED, not TRANSCRIBED"). Nothing is summed and nothing converted: a rail enumerates,
 * and the deducted sum is the gate's (L-MEA-08).
 *
 * The two silences are refusals about the SCHEDULE and not about the face, so each cites the schedule
 * row it was read at rather than the placement: an opening nobody could area, and a row claiming
 * floors nothing can place. Either leaves the face unmeasured — measuring it would bill an opening as
 * solid work, which is the over-measurement L-QTY-04 forecloses.
 */
export function scheduleOf(row: RegisterObjectRow, openings: readonly OpeningSetup[], setup: RailSetup, channel: DeductionChannel): Schedule {
  const place = placedBy(setup.levels);
  const standing = setup.levels.find((one) => one.levelId === row.levelId);
  const reported: { code: MasonryRailCode; sourceEntity: string }[] = [];
  const candidates: DeductionCandidate[] = [];

  for (const opening of openings) {
    const area = opening.area;
    if (area === null || !A_POSITIVE_WHOLE_NUMBER.test(opening.count.value.trim())) {
      reported.push({ code: OPENING_NOT_AREABLE, sourceEntity: opening.source });
      continue;
    }
    if (opening.floors !== null) {
      // A band is a range over the stack, so judging one needs both a stack that can place its ends
      // and a level to place the member on: a row the stack carries no level for is a row no band can
      // select for, and that is a statement nothing can judge rather than one that claims nothing.
      if (standing === undefined || !bandJudgeable(opening.floors, place)) {
        reported.push({ code: OPENING_FLOOR_UNJUDGEABLE, sourceEntity: opening.source });
        continue;
      }
      if (!bandCovers(opening.floors, standing.ordinal, place)) continue;
    }
    const basis = opening.floors === null ? area.basis : "DERIVED";
    for (let at = 0; at < Number(opening.count.value); at += 1) {
      candidates.push({ channel, measure: { value: area.value, unit: area.unit, basis, source: opening.source } });
    }
  }

  return reported.length === 0 ? { ok: true, candidates } : { ok: false, reported };
}
