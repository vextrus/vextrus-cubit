// What every FRAME rail reads before it offers anything: where the member was sighted, the
// calibration the view stands on, the section its schedule states, and the run the partition read.
//
// It stands in its own file because the area's six rails all ask the same four questions and one
// answer to each is the only way they cannot part (B-17). Nothing here computes and nothing converts:
// every reading is carried in the unit it was written in, and the carrying into canonical units is
// the gate's, through the one canon (L-MEA-08, L-FRM-06).
import type { ElementType } from "@/core/catalogue/classes";
import type { Kind } from "@/core/catalogue/kinds";
import type { RefusalCode } from "@/core/errors";
import { variantCovering } from "@/core/offers/contract";
import type { LintelSetup, Measure, PlacementSetup, RailObservation, RailSetup, RegisterObjectRow, RunSetup } from "@/core/offers/contract";

/**
 * The rail-local closed code roster for the FRAME area: every reason one of its rails reports a row
 * it did not offer. Each is a registered refusal too — the same taxonomy serves a machine's refusals
 * and a reader's evidence (R-SPINE-062, L-MEA-08), which is what `satisfies` holds this to.
 */
export const FRAME_RAIL_CODES = [
  "VIEW_SCALE_UNAFFIRMED",
  "MEMBER_TYPE_UNKNOWN",
  "SECTION_BAND_UNCOVERED",
  "SECTION_UNIT_UNSTATED",
  "RUN_UNREAD",
  "SLAB_THICKNESS_UNSTATED",
  "LINTEL_SOURCE_ABSENT",
] as const satisfies readonly RefusalCode[];

/** One code of the roster above. */
export type FrameRailCode = (typeof FRAME_RAIL_CODES)[number];

/**
 * The roster's members by name, read off the roster itself rather than spelled a second time: one
 * code has one spelling in this area, and a rail that reports one names it from here (Q-07).
 */
export const [VIEW_SCALE_UNAFFIRMED, MEMBER_TYPE_UNKNOWN, SECTION_BAND_UNCOVERED, SECTION_UNIT_UNSTATED, RUN_UNREAD, SLAB_THICKNESS_UNSTATED, LINTEL_SOURCE_ABSENT] =
  FRAME_RAIL_CODES;

/** The geometry a beam, tie beam or lintel instance is read off as (L-FRM-02). */
export const PRISM_RECT = "PRISM_RECT";

/** One member is one member: a rail states what it counted, never a total it derived. */
export const ONE = "1";

/** The variable names the frame methods declare, by the names their templates spell them under. */
export const COUNT = "count";
export const WIDTH = "b";
export const DEPTH = "D";
export const CLEAR = "clear";
export const THICKNESS = "t";
export const LEFT = "t_left";
export const RIGHT = "t_right";

/** One observation about a row a frame rail did not offer, under the roster above (L-MEA-08). */
export function observe(className: ElementType, kind: Kind, code: FrameRailCode, row: RegisterObjectRow, sourceEntity: string): RailObservation {
  return { class: className, kind, code, objectKey: row.objectKey, sourceEntity };
}

/**
 * One observation about a DRAWING rather than about a row: what a rail could not read anywhere on it.
 *
 * A silence that is about no single object has no object key, and a key is left off rather than
 * filled with something standing for one — the gate keys an observation on what it IS, and an empty
 * key is part of that identity (L-MEA-08, L-QTY-02).
 */
export function observeDrawing(className: ElementType, kind: Kind, code: FrameRailCode, drawingId: string): RailObservation {
  return { class: className, kind, code, sourceEntity: drawingId };
}

/**
 * A map of the setup as the rail reads it: an absent one is an EMPTY one.
 *
 * A rail is a pure function of what it was handed (L-MEA-08), and what it was handed is whatever the
 * caller assembled — the setup grew the `runs` and `lintels` seams with this area, and a caller that
 * assembles neither is saying the same thing an empty map says: nothing was read there. Reading it as
 * nothing keeps that answer; dying on it would turn a silence into a crash.
 */
function held<T>(map: Readonly<Record<string, T>> | undefined): Readonly<Record<string, T>> {
  return map ?? {};
}

/** The run the partition read for each placement, as the setup carries them (L-MEA-09). */
function runsIn(setup: RailSetup): Readonly<Record<string, RunSetup>> {
  return held(setup.runs);
}

/** The opening an opening schedule states behind each placement, as the setup carries them. */
export function lintelsIn(setup: RailSetup): Readonly<Record<string, LintelSetup>> {
  return held(setup.lintels);
}

/** Every drawing the campaign's placements were read from, in the order the setup holds them. */
export function drawingsOf(setup: RailSetup): readonly string[] {
  const seen: string[] = [];
  for (const placement of Object.values(held(setup.placements))) if (!seen.includes(placement.drawingId)) seen.push(placement.drawingId);
  return seen;
}

/** Where a row was sighted and what it stands on — or the code the rail reports instead. */
export type Sighting =
  | { readonly ok: true; readonly placement: PlacementSetup; readonly calibration: string }
  | { readonly ok: false; readonly code: FrameRailCode; readonly sourceEntity: string };

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

/** The section a schedule states for a member — or the code its absence is reported under. */
export type Section =
  | { readonly ok: true; readonly width: Measure; readonly depth: Measure }
  | { readonly ok: false; readonly code: FrameRailCode; readonly sourceEntity: string | undefined };

/**
 * The section the schedules state for one row's mark, as the two readings a prism's plan is bound by.
 * A section read without the unit it was written in cannot be carried into metres by anybody, and a
 * rail does not guess one — it reports (`SECTION_UNIT_UNSTATED`).
 *
 * The source is the first schedule cell the variant was read from: a section is read at one cell, and
 * provenance is to the cell rather than to the row that collected it (L-QTY-03).
 */
export function sectionOf(row: RegisterObjectRow, placement: PlacementSetup, setup: RailSetup): Section {
  const family = placement.memberFamily;
  const variants = family === null ? undefined : setup.memberTypes[placement.ingestId]?.[family];
  if (variants === undefined || variants.length === 0) return { ok: false, code: MEMBER_TYPE_UNKNOWN, sourceEntity: placement.sourceEntity };
  const level = setup.levels.find((one) => one.levelId === row.levelId);
  const variant = variantCovering(variants, level, setup.levels);
  if (variant === undefined) return { ok: false, code: SECTION_BAND_UNCOVERED, sourceEntity: placement.sourceEntity };
  const source = variant.sourceKeys[0];
  if (variant.sectionUnit === null || variant.sectionWidth === null || variant.sectionDepth === null || source === undefined) {
    return { ok: false, code: SECTION_UNIT_UNSTATED, sourceEntity: source ?? placement.sourceEntity };
  }
  const unit = variant.sectionUnit;
  const read = (value: number): Measure => ({ value: String(value), unit, basis: "TRANSCRIBED", source });
  return { ok: true, width: read(variant.sectionWidth), depth: read(variant.sectionDepth) };
}

/** The run the partition read for a placement, or nothing where it read none (L-MEA-09). */
export function runOf(placementKey: string, setup: RailSetup): RunSetup | undefined {
  const read = runsIn(setup)[placementKey];
  return read === undefined || read.clear === null ? undefined : read;
}
