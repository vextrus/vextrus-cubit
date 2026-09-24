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
// band, a section read without its unit and a round note over a cell whose two sides differ are
// observations under this rail's own closed roster (riskNotes (3)).
//
// It BRANCHES on the shape and still computes nothing: a member the plan calls round is offered
// under `rcc.column.circular.concrete` as a PRISM_POLY binding the diameter the schedule stated,
// and every other thing about the offer — its count, its storey, its grade, its calibration, its
// omissions and its coverage — is what it always was (I-304, I-305).
import type { ElementType } from "@/core/catalogue/classes";
import type { Kind } from "@/core/catalogue/kinds";
import type { RefusalCode } from "@/core/errors";
import { heightOf, sightedBy, unsettledLevelCode, variantCovering } from "@/core/offers/contract";
import type {
  Measure,
  MemberShape,
  MemberVariantSetup,
  Offer,
  OmittedComponent,
  PlacementSetup,
  Rail,
  RailInput,
  RailObservation,
  RailSetup,
  RegisterObjectRow,
  StoreyHeightReading,
} from "@/core/offers/contract";
import { CANONICAL_UNIT } from "@/core/units/canon";

/** The rule this rail offers under. An offer names a rule and never a version (L-MEA-08). */
export const COLUMN_CONCRETE_RULE_ID = "rcc.column.concrete";

/**
 * And the rule a member the PLAN calls round is offered under instead (I-304, I-305).
 *
 * Two rules rather than one that took whichever reading it was handed: a single method prints a
 * sentence that does not say what was measured, and the difference is not decoration — a 450 circle
 * is 78.5 % of a 450 square. The line this rail offers under it prints `count × π × d × d × H ÷ 4`,
 * which is the shape it measured, written where a reader audits it (L-QTY-03, L-FRM-02).
 */
export const COLUMN_CIRCULAR_CONCRETE_RULE_ID = "rcc.column.circular.concrete";

/**
 * The rail-local closed code roster, keyed (column × rcc.concrete): every reason this rail reports
 * a row it did not offer. Each is a registered refusal too — the same taxonomy serves a machine's
 * refusals and a reader's evidence (R-SPINE-062, L-MEA-08).
 */
export const COLUMN_RAIL_CODES = [
  "VIEW_SCALE_UNAFFIRMED",
  "PLACEMENT_UNHELD",
  "MEMBER_TYPE_UNKNOWN",
  "SECTION_BAND_UNCOVERED",
  "SECTION_UNIT_UNSTATED",
  "SECTION_NOT_CIRCULAR",
  "TYPICAL_RANGE_UNSTATED",
] as const satisfies readonly RefusalCode[];

/** One code of the roster above. */
export type ColumnRailCode = (typeof COLUMN_RAIL_CODES)[number];

/** The one (class × kind) this rail measures — a rail is selected per quantity kind (L-MEA-08). */
const COLUMN: ElementType = "column";
const RCC_CONCRETE: Kind = "rcc.concrete";

/** The geometry a rectangular column instance is read off (L-FRM-01, L-FRM-02). */
const PRISM_RECT = "PRISM_RECT";

/**
 * And the geometry a circular one is read off. A round column is a prism over a plan that is no
 * rectangle — a circle — so it is offered under L-FRM-01's PRISM_POLY like every other
 * non-rectangular prism this product reads. What makes it a circle rather than a polygon is the RULE
 * its line names, `rcc.column.circular.concrete`, whose template prints the π/4 · d² a reader audits.
 * L-FRM-01's union is CLOSED and a builder may not amend the Bible, so a round column is no new
 * member of it; the bored pile is read exactly this way already
 * (`src/modules/takeoff/rails/foundations/concrete.ts`, I-305, L-QTY-03).
 */
const PRISM_POLY = "PRISM_POLY";

/** The shape a plan note states that sends a member to the circular rule (I-304, `MEMBER_SHAPES`). */
const ROUND: MemberShape = "ROUND";

/** The variables `rcc.column.concrete@1` declares, by the names its template spells them under. */
const COUNT = "count";
const LENGTH = "L";
const BREADTH = "B";
const HEIGHT = "H";

/** The one variable `rcc.column.circular.concrete@1` declares beside `count` and `H` — a DIAMETER. */
const DIAMETER = "d";

/** The item-selecting attribute a concrete line is priced by, where a reader stated one (L-QTY-03). */
const GRADE = "grade";

/** One column instance is one member: a rail states what it counted, never a total it derived. */
const ONE = "1";

/**
 * The section a variant states, in the shape the plan says it is — or the reason nothing states one,
 * beside the schedule cell that stated it so incompletely (the cell is what a reader goes and reads
 * again).
 *
 * The two ok arms are the two rules this rail offers under, and the discriminant is the SHAPE: a
 * rectangle is two sides and a circle is one diameter, because that is what each method declares
 * (I-305). Nothing here is computed — each reading is the schedule's own figure in the schedule's
 * own unit (L-MEA-08).
 */
type Section =
  | { readonly ok: true; readonly shape: "RECT"; readonly width: Measure; readonly depth: Measure }
  | { readonly ok: true; readonly shape: typeof ROUND; readonly diameter: Measure }
  | { readonly ok: false; readonly code: ColumnRailCode; readonly source: string | undefined };

/** Every row of the batch this rail measures: the instances of its own class (L-MEA-08). */
function columnsOf(objects: readonly RegisterObjectRow[]): readonly RegisterObjectRow[] {
  return objects.filter((row) => row.elementType === COLUMN);
}

/**
 * The section one member states, as the readings a prism's plan is bound by. A section read without
 * the unit it was written in cannot be carried into metres by anybody, and a rail does not guess one
 * — it reports (`SECTION_UNIT_UNSTATED`).
 *
 * The source is the first schedule cell the variant was read from: a section is read at one cell,
 * and provenance is to the cell rather than to the row that collected it (L-QTY-03).
 *
 * THE FIGURE IS ALWAYS THE SCHEDULE'S AND THE SHAPE IS ALWAYS THE PLAN'S (I-304). The note carries
 * no unit — `C7 %%C450 PORCH COLUMN` states 450 of nothing, and a unitless section is exactly what
 * the guard above already refuses (L-REG-01) — so the diameter and the unit it is written in are
 * read from the schedule's own cell, down the path that already carries a header's declared unit
 * (I-302). What the note contributes is that the cell's 450 is a DIAMETER rather than a side.
 *
 * Which is only true while the cell's two sides agree. Where the plan calls a member round and the
 * schedule states two DIFFERENT sides, nothing in the set states a diameter at all: that is a real
 * disagreement, it is DECLARED and never resolved silently (L-REG-03), and no side is picked for it
 * (`SECTION_NOT_CIRCULAR`, L-QTY-01).
 */
function sectionOf(variant: MemberVariantSetup, placement: PlacementSetup): Section {
  const source = variant.sourceKeys[0];
  if (variant.sectionUnit === null || variant.sectionWidth === null || variant.sectionDepth === null || source === undefined) {
    return { ok: false, code: "SECTION_UNIT_UNSTATED", source };
  }
  const read = (value: number): Measure => ({ value: String(value), unit: variant.sectionUnit as string, basis: "TRANSCRIBED", source });
  if (placement.noteShape !== ROUND) return { ok: true, shape: "RECT", width: read(variant.sectionWidth), depth: read(variant.sectionDepth) };
  if (variant.sectionWidth !== variant.sectionDepth) return { ok: false, code: "SECTION_NOT_CIRCULAR", source };
  return { ok: true, shape: ROUND, diameter: read(variant.sectionWidth) };
}


/**
 * One observation about a row this rail did not offer, under its own closed roster (L-MEA-08).
 *
 * L-MEA-08 gives an observation an "optional object and source entity", and each is the one thing
 * the code is about: the object is the register row nothing was offered for, and the source entity
 * is what a reader has to go and look at — the view whose scale nobody affirmed, the schedule cell
 * that stated a section without its unit, the placement whose member type or band the schedules do
 * not cover. Nothing else is carried: what the row IS (its mark, its level) is the register's to
 * answer through the object key, and a copy of it here would be a second home for it (B-17).
 */
function observe(code: ColumnRailCode, row: RegisterObjectRow, sourceEntity: string): RailObservation {
  return { class: COLUMN, kind: RCC_CONCRETE, code, objectKey: row.objectKey, sourceEntity };
}

/** What one row is offered from, once everything it needs has been found. */
type Read = {
  readonly row: RegisterObjectRow;
  readonly placement: PlacementSetup;
  readonly calibration: string;
  readonly section: Extract<Section, { ok: true }>;
  readonly height: StoreyHeightReading;
};

/** The offer one read row stands to be measured by (L-MEA-08's offer, whole). */
function offerOf(read: Read, setup: RailSetup): Offer {
  const { row, placement, calibration, section } = read;
  // An expanded object's geometry on a level not drawn carries DERIVED, and one read off the drawing
  // carries MEASURED: the register row's own standing IS that distinction, and the rail carries it
  // rather than re-deciding it (L-QTY-01, L-REG-03).
  const basis = row.standing;
  const counted: Measure = { value: ONE, unit: CANONICAL_UNIT.COUNT, basis, source: placement.sourceEntity, calibration };
  // The section the plan says this member has is bound under the variables the rule that measures it
  // DECLARES, and nothing else parts between the two: one member counted, one storey run through,
  // one grade, one calibration (I-305). A circle declares `d` where a rectangle declares `L` and `B`.
  const bindings: Record<string, Measure> =
    section.shape === ROUND
      ? { [COUNT]: counted, [DIAMETER]: section.diameter }
      : { [COUNT]: counted, [LENGTH]: section.width, [BREADTH]: section.depth };
  const omitted: OmittedComponent[] = [];
  if (read.height.ok) bindings[HEIGHT] = read.height.reading;
  else omitted.push({ variable: HEIGHT, code: read.height.code });

  const grade = setup.grades[placement.drawingId];
  return {
    ruleId: section.shape === ROUND ? COLUMN_CIRCULAR_CONCRETE_RULE_ID : COLUMN_CONCRETE_RULE_ID,
    kind: RCC_CONCRETE,
    class: COLUMN,
    register: { setRevisionId: row.setRevisionId, objectKey: row.objectKey },
    drawing: { drawingId: placement.drawingId, viewKey: placement.viewKey },
    ...sightedBy(placement),
    geometry: { type: section.shape === ROUND ? PRISM_POLY : PRISM_RECT, basis, calibration },
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
 * The column-concrete rail: every column instance of the batch, offered as a prism over the level it
 * stands on — rectangular where the schedule's B × D cell is the whole of what the set says about
 * its plan, circular where a plan note says the section is round (I-304, I-305).
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
      // no view and no engine to offer it under, and the row reaches the residue as evidence. Under
      // its OWN code: the member-type registry answered nothing wrong here, and a reader sent to
      // check the schedules for this mark would be sent to the wrong page (Q-07).
      observations.push(observe("PLACEMENT_UNHELD", row, row.placementKey));
      continue;
    }

    // A rail cannot mint a calibration reference it does not hold, and a line always carries "a
    // non-empty set of affirmed calibration references" (L-QTY-03): a view nobody has affirmed a
    // scale for is reported against THE VIEW — what a reader has to go and affirm (riskNotes (3)).
    // A reference the setup spells as nothing is no affirmed reference either: offering under it
    // would publish nothing and be refused OFFER_NOT_TO_CONTRACT, which names the contract rather
    // than the silence a reader has to go and fill (L-MEA-08's residue, riskNotes (3)).
    const calibration = setup.calibrations[placement.ingestId]?.[placement.viewKey];
    if (calibration === undefined || calibration.length === 0) {
      observations.push(observe("VIEW_SCALE_UNAFFIRMED", row, placement.viewKey));
      continue;
    }

    // A column a bare typical caption left in the UNRESOLVED slot stands on no storey, so no band of
    // its schedule can be asked about it: what is missing is the range of floors the plan is typical
    // of, and it is reported against THE VIEW, which is what a person states a range for — never as
    // an uncovered band, which sent the QS to the schedule (I-667, L-CAD-07, walk-2 BD-3).
    const unsettled = unsettledLevelCode(row);
    if (unsettled !== null) {
      observations.push(observe(unsettled, row, placement.viewKey));
      continue;
    }

    const family = placement.memberFamily;
    const variants = family === null ? undefined : setup.memberTypes[placement.ingestId]?.[family];
    if (variants === undefined || variants.length === 0) {
      observations.push(observe("MEMBER_TYPE_UNKNOWN", row, placement.sourceEntity));
      continue;
    }

    const level = setup.levels.find((one) => one.levelId === row.levelId);
    const variant = variantCovering(variants, level, setup.levels);
    if (variant === undefined) {
      observations.push(observe("SECTION_BAND_UNCOVERED", row, placement.sourceEntity));
      continue;
    }

    const section = sectionOf(variant, placement);
    if (!section.ok) {
      observations.push(observe(section.code, row, section.source ?? placement.sourceEntity));
      continue;
    }

    offers.push(offerOf({ row, placement, calibration, section, height: heightOf(level) }, setup));
  }

  return { offers, observations };
};
