// R-TO-031's first rail: RCC column concrete, keyed (column × rcc.concrete) — the vertical slice
// that ends in a bill line with basis, coverage and calibration.
//
// A rail "is a pure function returning `{ offers, observations }`" (L-MEA-08): everything this file
// reads arrives in its argument, so it reaches no store and no clock and the same input twice
// answers deep-equal batches. It computes nothing — "there is no field where a computed value could
// land" — and it converts nothing: every reading is carried in the unit it was written in, and the
// carrying into canonical units is the gate's, through the one canon (B-17, L-FRM-06).
//
// One offer per (instance row, level). The register's rows ARE the expansion — an instance key is a
// placement key followed by one level segment (L-REG-04) — so a level is not iterated here: the row
// names the level it stands on, and a level the drawing did not show carries the row's own DERIVED
// standing onto the geometry it is offered under (L-QTY-01).
//
// What the rail could not read is REPORTED rather than offered. L-MEA-08 reserves the refused arm
// for contract violations and sends a non-offer to the residue as evidence, and a rail cannot mint a
// calibration reference it does not hold: an unaffirmed view, an unknown member type, an uncovered
// band and a section read without its unit are observations under this rail's own closed roster
// (riskNotes (3)).
import type { ElementType } from "@/core/catalogue/classes";
import type { Kind } from "@/core/catalogue/kinds";
import type { RefusalCode } from "@/core/errors";
import { STOREY_HEIGHT_ABSENCE } from "@/core/levels/law";
import type {
  LevelSetup,
  Measure,
  MemberVariantSetup,
  Offer,
  OmittedComponent,
  PlacementSetup,
  Rail,
  RailInput,
  RailObservation,
  RailSetup,
  RegisterObjectRow,
} from "@/core/offers/contract";
import { CANONICAL_UNIT } from "@/core/units/canon";

/** The rule this rail offers under. An offer names a rule and never a version (L-MEA-08). */
export const COLUMN_CONCRETE_RULE_ID = "rcc.column.concrete";

/**
 * The rail-local closed code roster, keyed (column × rcc.concrete): every reason this rail reports
 * a row it did not offer. Each is a registered refusal too — the same taxonomy serves a machine's
 * refusals and a reader's evidence (R-SPINE-062, L-MEA-08).
 */
export const COLUMN_RAIL_CODES = ["VIEW_SCALE_UNAFFIRMED", "MEMBER_TYPE_UNKNOWN", "SECTION_BAND_UNCOVERED", "SECTION_UNIT_UNSTATED"] as const satisfies readonly RefusalCode[];

/** One code of the roster above. */
export type ColumnRailCode = (typeof COLUMN_RAIL_CODES)[number];

/** The one (class × kind) this rail measures — a rail is selected per quantity kind (L-MEA-08). */
const COLUMN: ElementType = "column";
const RCC_CONCRETE: Kind = "rcc.concrete";

/** The geometry a rectangular column instance is read off (L-FRM-01, L-FRM-02). */
const PRISM_RECT = "PRISM_RECT";

/** The variables `rcc.column.concrete@1` declares, by the names its template spells them under. */
const COUNT = "count";
const LENGTH = "L";
const BREADTH = "B";
const HEIGHT = "H";

/** The item-selecting attribute a concrete line is priced by, where a reader stated one (L-QTY-03). */
const GRADE = "grade";

/** One column instance is one member: a rail states what it counted, never a total it derived. */
const ONE = "1";

/** The section a variant states, as two readings — or the reason it states none. */
type Section = { readonly ok: true; readonly width: Measure; readonly depth: Measure } | { readonly ok: false; readonly code: ColumnRailCode };

/** The reading of the height a level stands at — or the code the row's H is omitted under. */
type Height = { readonly ok: true; readonly reading: Measure } | { readonly ok: false; readonly code: RefusalCode };

/** Every row of the batch this rail measures: the instances of its own class (L-MEA-08). */
function columnsOf(objects: readonly RegisterObjectRow[]): readonly RegisterObjectRow[] {
  return objects.filter((row) => row.elementType === COLUMN);
}

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
 * The section one variant states, as the two readings a prism's plan is bound by. A section read
 * without the unit it was written in cannot be carried into metres by anybody, and a rail does not
 * guess one — it reports (`SECTION_UNIT_UNSTATED`).
 *
 * The source is the first schedule cell the variant was read from: a section is read at one cell,
 * and provenance is to the cell rather than to the row that collected it (L-QTY-03).
 */
function sectionOf(variant: MemberVariantSetup): Section {
  const source = variant.sourceKeys[0];
  if (variant.sectionUnit === null || variant.sectionWidth === null || variant.sectionDepth === null || source === undefined) {
    return { ok: false, code: "SECTION_UNIT_UNSTATED" };
  }
  const read = (value: number): Measure => ({ value: String(value), unit: variant.sectionUnit as string, basis: "TRANSCRIBED", source });
  return { ok: true, width: read(variant.sectionWidth), depth: read(variant.sectionDepth) };
}

/**
 * The storey height a level stands at, as a reading — or the code it stands under instead. A height
 * whose readings disagree, and one nobody read, are both a level with no height (L-MEA-07), and the
 * code each is reported under is the levels law's own pairing rather than a map spelled here (B-17).
 */
function heightOf(level: LevelSetup | undefined): Height {
  // A row standing on a level the live stack does not hold has no reading of a storey height either:
  // it is the same absence, and L-QTY-02 keeps the row and declares it rather than dropping it.
  const height = level?.height;
  if (height === undefined || height.standing !== "AGREED" || height.value === null || height.unit === null || height.basis === null) {
    const code = height === undefined ? STOREY_HEIGHT_ABSENCE.NONE : STOREY_HEIGHT_ABSENCE[height.standing];
    return { ok: false, code: code ?? STOREY_HEIGHT_ABSENCE.NONE as RefusalCode };
  }
  return { ok: true, reading: { value: height.value, unit: height.unit, basis: height.basis, source: height.sourceKey ?? "" } };
}

/** One observation about a row this rail did not offer, under its own closed roster (L-MEA-08). */
function observe(code: ColumnRailCode, row: RegisterObjectRow, detail?: Record<string, unknown>): RailObservation {
  return {
    class: COLUMN,
    kind: RCC_CONCRETE,
    code,
    objectKey: row.objectKey,
    sourceEntity: row.placementKey,
    ...(detail === undefined ? {} : { detail }),
  };
}

/** What one row is offered from, once everything it needs has been found. */
type Read = {
  readonly row: RegisterObjectRow;
  readonly placement: PlacementSetup;
  readonly calibration: string;
  readonly section: { readonly width: Measure; readonly depth: Measure };
  readonly height: Height;
};

/** The offer one read row stands to be measured by (L-MEA-08's offer, whole). */
function offerOf(read: Read, setup: RailSetup): Offer {
  const { row, placement, calibration } = read;
  // An expanded object's geometry on a level not drawn carries DERIVED, and one read off the drawing
  // carries MEASURED: the register row's own standing IS that distinction, and the rail carries it
  // rather than re-deciding it (L-QTY-01, L-REG-03).
  const basis = row.standing;
  const bindings: Record<string, Measure> = {
    [COUNT]: { value: ONE, unit: CANONICAL_UNIT.COUNT, basis, source: placement.sourceEntity, calibration },
    [LENGTH]: read.section.width,
    [BREADTH]: read.section.depth,
  };
  const omitted: OmittedComponent[] = [];
  if (read.height.ok) bindings[HEIGHT] = read.height.reading;
  else omitted.push({ variable: HEIGHT, code: read.height.code });

  const grade = setup.grades[placement.drawingId];
  return {
    ruleId: COLUMN_CONCRETE_RULE_ID,
    kind: RCC_CONCRETE,
    class: COLUMN,
    register: { setRevisionId: row.setRevisionId, objectKey: row.objectKey },
    drawing: { drawingId: placement.drawingId, viewKey: placement.viewKey },
    engine: placement.engine,
    geometry: { type: PRISM_RECT, basis, calibration },
    bindings,
    selectors: grade === undefined ? {} : { [GRADE]: grade },
    // Columns deduct through nothing at this leaf: the member-end and embedded-duct channels arrive
    // with the leaf that reads them, and a candidate in a channel the method does not declare is a
    // contract violation rather than a threshold question (L-MEA-08).
    deductions: [],
    omitted,
    // "A row kept with no quantity is PARTIAL_DECLARED, never COMPLETE" (L-QTY-02).
    coverage: omitted.length === 0 ? "COMPLETE" : "PARTIAL_DECLARED",
  };
}

/**
 * The column-concrete rail: every column instance of the batch, offered as a rectangular prism over
 * the level it stands on.
 *
 * The order of the offers is the order of the rows it was handed — a rail sorts nothing, so what it
 * answers is a function of what it was given and of nothing else.
 */
export const columnConcreteRail: Rail = (input: RailInput) => {
  const setup = input.setup;
  const offers: Offer[] = [];
  const observations: RailObservation[] = [];

  for (const row of columnsOf(input.objects)) {
    const placement = setup.placements[row.placementKey];
    if (placement === undefined) {
      // The setup is read off the same partition the register was expanded from, so a row whose
      // placement it does not hold names a sighting nothing can be traced to: there is no drawing,
      // no view and no engine to offer it under, and the row reaches the residue as evidence.
      observations.push(observe("MEMBER_TYPE_UNKNOWN", row, { placementKey: row.placementKey }));
      continue;
    }

    const calibration = setup.calibrations[placement.ingestId]?.[placement.viewKey];
    if (calibration === undefined) {
      observations.push(observe("VIEW_SCALE_UNAFFIRMED", row, { viewKey: placement.viewKey }));
      continue;
    }

    const family = placement.memberFamily;
    const variants = family === null ? undefined : setup.memberTypes[placement.ingestId]?.[family];
    if (variants === undefined || variants.length === 0) {
      observations.push(observe("MEMBER_TYPE_UNKNOWN", row, { mark: row.mark, memberFamily: family }));
      continue;
    }

    const level = setup.levels.find((one) => one.levelId === row.levelId);
    const variant = variantCovering(variants, level, setup.levels);
    if (variant === undefined) {
      observations.push(observe("SECTION_BAND_UNCOVERED", row, { memberFamily: family, level: level?.label ?? null }));
      continue;
    }

    const section = sectionOf(variant);
    if (!section.ok) {
      observations.push(observe(section.code, row, { memberFamily: family, variantKey: variant.variantKey }));
      continue;
    }

    offers.push(offerOf({ row, placement, calibration, section, height: heightOf(level) }, setup));
  }

  return { offers, observations };
};
