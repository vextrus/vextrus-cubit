// What every FRAME rail reads before it can offer anything: where a row was sighted, under which
// affirmed calibration, which variant of its schedule family covers the level it stands on, and the
// section that variant states.
//
// Said once for the six rails of this area (B-17): beam, tie beam and lintel differ in what they
// measure, never in how they find the member they measure. The column rail keeps its own copy of the
// same reading because its file is closed to this increment; unifying the two is a question for the
// increment that may edit both.
//
// Nothing here reaches a store or a clock — a rail is a pure function of what it was handed
// (L-MEA-08).
import type { ElementType } from "@/core/catalogue/classes";
import type { Kind } from "@/core/catalogue/kinds";
import type { LevelSetup, Measure, MemberVariantSetup, PlacementSetup, RailObservation, RailSetup, ReadingSetup, RegisterObjectRow } from "@/core/offers/contract";
import type { FrameRailCode } from "./codes";

/** The item-selecting attribute a concrete line is priced by, where a reader stated one (L-QTY-03). */
const GRADE = "grade";

/** One member instance is one member: a rail states what it counted, never a total it derived. */
export const ONE = "1";

/** The geometry a beam, tie beam or lintel instance is read off (L-FRM-02). */
export const PRISM_RECT = "PRISM_RECT";

/** The section a variant states, as the two readings a prism's plan is bound by. */
export type Section = { readonly width: Measure; readonly depth: Measure };

/** One row this rail could read, with everything it needed to read it. */
export type MemberRead = {
  readonly row: RegisterObjectRow;
  readonly placement: PlacementSetup;
  readonly calibration: string;
  readonly section: Section;
  readonly level: LevelSetup | undefined;
};

/** What reading one row answered: the read, or the code it could not be read under and where. */
export type MemberReading = { readonly ok: true; readonly read: MemberRead } | { readonly ok: false; readonly code: FrameRailCode; readonly sourceEntity: string };

/**
 * The variant of a family that covers one level.
 *
 * A variant whose schedule stated no band at all covers every level — that is what an unbanded
 * schedule row says. A banded one covers the levels its endpoints name, matched by the label the
 * stack carries and bounded by ordinal, so a band written "GF TO 5F" covers what physically stands
 * between them (L-MEA-07: the ordinal is physical). A level no band covers defers (L-FRM-02).
 */
function variantCovering(variants: readonly MemberVariantSetup[], level: LevelSetup | undefined, levels: readonly LevelSetup[]): MemberVariantSetup | undefined {
  const unbanded = variants.find((variant) => variant.bandFrom === null && variant.bandTo === null);
  if (level === undefined) return unbanded;
  const ordinalOf = (label: string | null): number | undefined => (label === null ? undefined : levels.find((one) => one.label === label)?.ordinal);
  return (
    variants.find((variant) => {
      if (variant.bandFrom === null && variant.bandTo === null) return true;
      const from = ordinalOf(variant.bandFrom);
      const to = ordinalOf(variant.bandTo);
      // An endpoint the stack cannot place is an endpoint this band cannot be judged by: the band
      // covers nothing rather than everything (L-CAD-07's `LEVEL_RANGE_ENDPOINT_UNMAPPED` is the
      // expansion's answer to the same fact; a rail states no coverage it cannot show).
      if ((variant.bandFrom !== null && from === undefined) || (variant.bandTo !== null && to === undefined)) return false;
      return level.ordinal >= (from ?? level.ordinal) && level.ordinal <= (to ?? level.ordinal);
    }) ?? unbanded
  );
}

/**
 * The section one variant states. A section read without the unit it was written in cannot be
 * carried into metres by anybody, and a rail does not guess one — it reports
 * (`SECTION_UNIT_UNSTATED`). The source is the first schedule cell the variant was read from:
 * provenance is to the cell rather than to the row that collected it (L-QTY-03).
 */
function sectionOf(variant: MemberVariantSetup): { readonly ok: true; readonly section: Section } | { readonly ok: false; readonly source: string | undefined } {
  const source = variant.sourceKeys[0];
  if (variant.sectionUnit === null || variant.sectionWidth === null || variant.sectionDepth === null || source === undefined) return { ok: false, source };
  const unit = variant.sectionUnit;
  const read = (value: number): Measure => ({ value: String(value), unit, basis: "TRANSCRIBED", source });
  return { ok: true, section: { width: read(variant.sectionWidth), depth: read(variant.sectionDepth) } };
}

/**
 * Everything one register row must state before a figure can be offered for it — or the first thing
 * it did not. Each code is the one the column rail reports the same silence under, because it is the
 * same silence: a view nobody affirmed, a mark the schedules hold no type for, a level no band
 * covers, a section read without its unit (L-MEA-08, riskNotes (3)).
 */
export function readMember(row: RegisterObjectRow, setup: RailSetup): MemberReading {
  const placement = setup.placements[row.placementKey];
  // A row whose placement the setup does not hold names a sighting nothing can be traced to: there is
  // no drawing, no view and no engine to offer it under.
  if (placement === undefined) return { ok: false, code: "MEMBER_TYPE_UNKNOWN", sourceEntity: row.placementKey };

  // A rail cannot mint a calibration reference it does not hold, and a line always carries "a
  // non-empty set of affirmed calibration references" (L-QTY-03): a view nobody has affirmed a scale
  // for is reported against THE VIEW — what a reader has to go and affirm.
  const calibration = setup.calibrations[placement.ingestId]?.[placement.viewKey];
  if (calibration === undefined || calibration.length === 0) return { ok: false, code: "VIEW_SCALE_UNAFFIRMED", sourceEntity: placement.viewKey };

  const family = placement.memberFamily;
  const variants = family === null ? undefined : setup.memberTypes[placement.ingestId]?.[family];
  if (variants === undefined || variants.length === 0) return { ok: false, code: "MEMBER_TYPE_UNKNOWN", sourceEntity: placement.sourceEntity };

  const level = setup.levels.find((one) => one.levelId === row.levelId);
  const variant = variantCovering(variants, level, setup.levels);
  if (variant === undefined) return { ok: false, code: "SECTION_BAND_UNCOVERED", sourceEntity: placement.sourceEntity };

  const section = sectionOf(variant);
  if (!section.ok) return { ok: false, code: "SECTION_UNIT_UNSTATED", sourceEntity: section.source ?? placement.sourceEntity };

  return { ok: true, read: { row, placement, calibration, section: section.section, level } };
}

/**
 * One observation about a row this rail did not offer, under the area's closed roster (L-MEA-08).
 * The object is the register row nothing was offered for, and the source entity is what a reader has
 * to go and look at. Nothing else is carried: what the row IS is the register's to answer through
 * the object key, and a copy of it here would be a second home for it (B-17).
 */
export function observe(className: ElementType, kind: Kind, code: FrameRailCode, row: RegisterObjectRow, sourceEntity: string): RailObservation {
  return { class: className, kind, code, objectKey: row.objectKey, sourceEntity };
}

/** The reading a setup states, carried onto an offer as the measure it is (L-QTY-03). */
export function measureOf(reading: ReadingSetup, calibration?: string): Measure {
  return calibration === undefined
    ? { value: reading.value, unit: reading.unit, basis: reading.basis, source: reading.source }
    : { value: reading.value, unit: reading.unit, basis: reading.basis, source: reading.source, calibration };
}

/** The grade a drawing's general notes stated, as the selector a concrete line is priced by. */
export function selectorsOf(placement: PlacementSetup, setup: RailSetup): Readonly<Record<string, Measure>> {
  const grade = setup.grades[placement.drawingId];
  return grade === undefined ? {} : { [GRADE]: grade };
}

/** Every row of a batch a rail of this class measures: the instances of its own class (L-MEA-08). */
export function rowsOfClass(objects: readonly RegisterObjectRow[], className: ElementType): readonly RegisterObjectRow[] {
  return objects.filter((row) => row.elementType === className);
}
