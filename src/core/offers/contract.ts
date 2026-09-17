// L-MEA-08's rail↔gate contract: what a rail hands the gate, said once, in the vocabulary both
// sides speak. "A rail is a pure function returning `{ offers, observations }`" — so a rail is a
// type, an offer is a type, and neither of them needs the gate to be written down.
//
// This is the home of that vocabulary rather than the gate, and deliberately: the gate is the sole
// writer of quantity lines (SEAM-GATE), which only holds if nothing outside the worker's handler can
// reach `src/core/gate` at all — a type-only import reaches it too. A module that has to type a rail
// imports this file, and the ban beside the gate (`src/core/gate/__tests__/gate-import-scan.ts`)
// stays total.
//
// Nothing here computes: "there is no field where a computed value could land" (L-MEA-08). Every
// reading an offer carries is what a drawing said, in the unit it was written in, and the carrying
// into canonical units is the gate's — through the one canon (B-17).
import type { ElementType } from "../catalogue/classes";
import type { Kind } from "../catalogue/kinds";
import { registerObjects } from "../db";
import type { RefusalCode } from "../errors";
import { STOREY_HEIGHT_ABSENCE, type StoreyHeightStandingName } from "../levels/law";
import type { SiteFact } from "../site-facts/law";
import type { Coverage, DeductionChannel, Engine, GeometryType, QuantityBasis } from "./law";

// The rosters are the law file's, and published from here because this is the door a rail and the
// gate both read the contract at (B-17).
export { COVERAGES, DEDUCTION_CHANNELS, ENGINES, GEOMETRY_TYPES, PLAN_MEMBERS, QUANTITY_BASES, weakestBasis } from "./law";
export type { Coverage, DeductionChannel, Engine, GeometryType, PlanMember, QuantityBasis } from "./law";

/**
 * One reading, as a rail offers it: what the drawing said, the unit it said it in, how it was known,
 * the entity it was read from and the calibration it stands on. The value stays as written — the
 * canonical value is the gate's to derive (L-QTY-03: "the raw reading and unit beside the SI value").
 */
export type Measure = {
  readonly value: string;
  readonly unit: string;
  readonly basis: QuantityBasis;
  readonly source: string;
  readonly calibration?: string;
};

/** One thing that might be deducted, in the channel it would be deducted through — never a sum. */
export type DeductionCandidate = {
  readonly channel: DeductionChannel;
  readonly measure: Measure;
};

/**
 * One offer: a rail's statement that this register object, read from this view of this drawing,
 * stands to be measured by this rule. It carries a `ruleId` with no version — which version is in
 * force is the project's pinned edition's to say, and the gate's to resolve (L-MEA-08).
 */
export type Offer = {
  readonly ruleId: string;
  readonly kind: Kind;
  readonly class: ElementType;
  readonly register: { readonly setRevisionId: string; readonly objectKey: string };
  readonly drawing: { readonly drawingId: string; readonly viewKey: string };
  readonly engine: Engine;
  /**
   * The geometry an offer was read off: the L-FRM-01 type, its own basis, and the calibration
   * reference it stands on. The reference is owed rather than optional — a line always carries "a
   * non-empty set of affirmed calibration references" (L-QTY-03) and a missing mandatory publishable
   * attribute is a hard block (L-QTY-04), so a rail that affirms none has made an offer that cannot
   * publish. Spelling it here keeps a rail from being type-correct and unpublishable at once.
   */
  readonly geometry: { readonly type: GeometryType; readonly basis: QuantityBasis; readonly calibration: string };
  /** The method's declared variables, each as a reading — the gate normalises them (L-MEA-08). */
  readonly bindings: Readonly<Record<string, Measure>>;
  /** The item-selecting attributes, carried onto the line beside the machine's derivation (L-QTY-03). */
  readonly selectors: Readonly<Record<string, Measure>>;
  readonly deductions: readonly DeductionCandidate[];
  /**
   * Every component of the item description this offer leaves out, by name and by the registered
   * code it is left out under. Empty under COMPLETE; under PARTIAL_DECLARED it is what makes the
   * partiality DECLARED — "PARTIAL_UNDECLARED is unrepresentable" (L-QTY-02).
   */
  readonly omitted: readonly OmittedComponent[];
  readonly coverage: Coverage;
};

/**
 * One declared variable an offer does not bind, with the registered code that says why. A variable
 * named here is a variable the method declares and the drawing did not state: the line is kept and
 * carries no quantity, rather than a quantity computed over something nobody read (L-QTY-02).
 */
export type OmittedComponent = {
  readonly variable: string;
  readonly code: RefusalCode;
};

/**
 * One observation a rail reports beside its offers: a rail-local closed code keyed (class × kind),
 * with the object and the source entity it is about where it is about one (L-MEA-08).
 */
export type RailObservation = {
  readonly class: ElementType;
  readonly kind: Kind;
  readonly code: string;
  readonly objectKey?: string;
  readonly sourceEntity?: string;
  readonly detail?: Record<string, unknown>;
};

/** One register object, as the store holds it — what a rail is handed to read (L-REG-01). */
export type RegisterObjectRow = typeof registerObjects.$inferSelect;

/**
 * Where one register row was sighted, as the setup carries it: the drawing and the view it was read
 * in, the ingest record those belong to, the schedule family its mark normalises to, the engine that
 * read it, and the entity a count of it provenances to (L-QTY-03).
 */
export type PlacementSetup = {
  readonly drawingId: string;
  readonly ingestId: string;
  readonly viewKey: string;
  readonly memberFamily: string | null;
  readonly engine: Engine;
  readonly sourceEntity: string;
  /** The plan outline a reader read for this placement, or null where none was read (L-FRM-02). */
  readonly outline: OutlineSetup | null;
};

/**
 * One placement's plan, as the reader of the drawing read it: which of L-FRM-01's plan geometries it
 * is, the area it encloses, and — where the plan is a rectangle somebody measured rather than a
 * schedule stated — the two sides of it.
 *
 * A polygon plan has an area and no sides, which is exactly why L-FRM-02 measures it as
 * `A × depth` and why L-FRM-04 defers its pit: there is no `L` and no `B` to widen by the working
 * space. Nothing here is converted — a rail binds what was read (L-REG-01).
 */
export type OutlineSetup = {
  readonly type: GeometryType;
  readonly area: Measure;
  readonly length: Measure | null;
  readonly breadth: Measure | null;
};

/**
 * One variant of a member-type family, as the schedules registry recorded it: the band of levels it
 * heads (null endpoints where the schedule stated none), the section it carries over that band, and
 * the schedule cells it was read from. Nothing here is converted — a rail binds what was written.
 */
export type MemberVariantSetup = {
  readonly variantKey: string;
  readonly bandFrom: string | null;
  readonly bandTo: string | null;
  readonly sectionText: string;
  readonly sectionWidth: number | null;
  readonly sectionDepth: number | null;
  readonly sectionUnit: string | null;
  readonly sourceKeys: readonly string[];
  /**
   * The named dimensions a schedule states for the family BESIDE its section — a foundation's depth,
   * a pile's diameter and its length, the level its top stands at. Keyed by the name the method that
   * needs it declares, each carried as it was written (L-REG-01). Empty where the family's schedule
   * states none: an unread dimension is never a zero, and the rail declares the omission (L-QTY-02).
   */
  readonly dimensions: Readonly<Record<string, Measure>>;
  /**
   * The reinforcement zones the family's schedule states, in the order the schedule states them.
   * Empty where nothing has read one — a member with no zones has no bars to bill, and the rail
   * observes the absence by name rather than inferring steel from a section (L-QTY-01, L-QTY-02).
   */
  readonly rebar: readonly RebarZoneSetup[];
};

/**
 * How one level's storey height stands (L-MEA-07): the standing, and the reading it stands at where
 * it stands at one. Every field of the reading is null under SUSPENDED and under NONE — "a height
 * whose readings disagree has no height", and neither has one nobody read.
 */
export type StoreyHeightSetup = {
  readonly standing: StoreyHeightStandingName;
  readonly value: string | null;
  readonly unit: string | null;
  readonly basis: QuantityBasis | null;
  readonly sourceKey: string | null;
};

/** One level of the stack a vertical class expands over (L-FRM-02). */
export type LevelSetup = {
  readonly levelId: string;
  readonly label: string;
  readonly ordinal: number;
  readonly height: StoreyHeightSetup;
};

/**
 * A band as a schedule states it: the labels its two ends name, either or both left open (L-FRM-02).
 */
export type BandStatement = {
  readonly from: string | null;
  readonly to: string | null;
};

/**
 * How a stack places one end of a band: the ordinal of the level that label names, or `undefined`
 * where the stack carries none.
 *
 * The placement is the CALLER's because the stacks differ in how a label reaches them — the partition
 * reads labels off a drawing and matches them normalised, a rail reads the stack's own labels — while
 * the rule below, which is what a band MEANS, is one (B-17).
 */
export type BandPlacement = (label: string) => number | undefined;

/** The placement a stack of labelled levels makes by its own labels, lowest ordinal first. */
export function placedBy(levels: readonly { readonly label: string; readonly ordinal: number }[]): BandPlacement {
  return (label) => levels.find((one) => one.label === label)?.ordinal;
}

/** A band with neither end stated: the schedule named no range, so it selects nothing (L-FRM-02). */
export function bandOpen(band: BandStatement): boolean {
  return band.from === null && band.to === null;
}

/**
 * Whether the stack can place every end this band states.
 *
 * A band naming an endpoint no live level carries is a statement nothing can judge — the same fact
 * L-CAD-07 answers with `LEVEL_RANGE_ENDPOINT_UNMAPPED` where a person states the range. A caller
 * that would otherwise CUT by such a band declines to cut at all rather than dropping the member
 * with no word said (L-QTY-02).
 */
export function bandJudgeable(band: BandStatement, place: BandPlacement): boolean {
  return (band.from === null || place(band.from) !== undefined) && (band.to === null || place(band.to) !== undefined);
}

/**
 * Whether one stated band covers one ordinal — the one reading of a schedule's band, for every caller
 * that asks (B-17: one fact, one home; every area asked it and the answer may not part).
 *
 * An open end is no bound: a band stating only its start runs to the top of whatever it is read
 * against, and an entirely open band covers everything, because that is what an unbanded schedule row
 * says. The comparison is by ORDINAL and never by label, because a range over a building is physical
 * (L-MEA-07, L-REG-02). An end the stack cannot place makes the band unjudgeable, and an unjudgeable
 * band covers nothing rather than everything.
 */
export function bandCovers(band: BandStatement, ordinal: number, place: BandPlacement): boolean {
  if (!bandJudgeable(band, place)) return false;
  const from = band.from === null ? undefined : place(band.from);
  const to = band.to === null ? undefined : place(band.to);
  return ordinal >= (from ?? ordinal) && ordinal <= (to ?? ordinal);
}

/**
 * The variant of a family that covers one level — `bandCovers` asked of a member type's own band.
 *
 * A variant whose schedule stated no band at all covers every level — that is what an unbanded
 * schedule row says. A banded one covers the levels its endpoints name, matched by the label the
 * stack carries and bounded by ordinal, so a band written "GF TO 5F" covers what physically stands
 * between them (L-MEA-07: the ordinal is physical). A level no band covers defers (L-FRM-02), which
 * the caller reports under its own area's code.
 *
 * A row that stands on NO level of the stack — a member in the foundation slot, which is a place a
 * member stands rather than a storey (L-REG-02) — is not banded by the stack at all: a band is a
 * range over it, and a range cannot select for a member outside it. Its schedule row is then its
 * section where the family states exactly one, and the band on that row names where the member
 * stands rather than which row to take. A family stating several is genuinely ambiguous off the
 * stack, and defers rather than having one picked for it (L-QTY-01: never a guess).
 *
 * Nothing is computed here and nothing converted: a section is SELECTED, and what it reads is
 * carried on untouched.
 */
export function variantCovering(
  variants: readonly MemberVariantSetup[],
  level: LevelSetup | undefined,
  levels: readonly LevelSetup[],
): MemberVariantSetup | undefined {
  const unbanded = variants.find((variant) => bandOpen(bandOf(variant)));
  if (level === undefined) return unbanded ?? (variants.length === 1 ? variants[0] : undefined);
  const place = placedBy(levels);
  // A row that states a BAND covering this level is what the schedule says about it; the unbanded row
  // covers every level and is therefore what is left when no band covers. Asked of the banded rows
  // first, because an unbanded row standing earlier in the schedule would otherwise win by the order
  // the drawing happened to be written in — a reading of the store's order, not of the drawing
  // (L-FRM-02, L-REG-04).
  return variants.filter((variant) => !bandOpen(bandOf(variant))).find((variant) => bandCovers(bandOf(variant), level.ordinal, place)) ?? unbanded;
}

/** The band a member-type variant states, in the spelling the one reading of a band is asked in. */
function bandOf(variant: MemberVariantSetup): BandStatement {
  return { from: variant.bandFrom, to: variant.bandTo };
}

/** The reading of the height a level stands at — or the code a rail omits that row's `H` under. */
export type StoreyHeightReading = { readonly ok: true; readonly reading: Measure } | { readonly ok: false; readonly code: RefusalCode };

/** The code an agreed height that cites no drawing entity is omitted under (Q-07, L-QTY-03). */
const STOREY_HEIGHT_UNCITED: RefusalCode = "STOREY_HEIGHT_UNCITED";

/**
 * The storey height a level stands at, as a reading — or the code it stands under instead. A height
 * whose readings disagree, and one nobody read, are both a level with no height (L-MEA-07), and the
 * code each is reported under is the levels law's own pairing rather than a map spelled here (B-17).
 *
 * It lives here rather than beside one rail because every VERTICAL class asks it of the same setup —
 * a column and a shear wall both measure floor-to-floor through the joint (L-MEA-09) — and one
 * invariant has one home (B-17, ARCH-02).
 */
export function heightOf(level: LevelSetup | undefined): StoreyHeightReading {
  // A row standing on a level the live stack does not hold has no reading of a storey height either:
  // it is the same absence, and L-QTY-02 keeps the row and declares it rather than dropping it.
  const height = level?.height;
  if (height === undefined || height.standing !== "AGREED" || height.value === null || height.unit === null || height.basis === null) {
    const code = height === undefined ? STOREY_HEIGHT_ABSENCE.NONE : STOREY_HEIGHT_ABSENCE[height.standing];
    return { ok: false, code: code ?? (STOREY_HEIGHT_ABSENCE.NONE as RefusalCode) };
  }
  // A reading that cites no drawing entity is a reading with nowhere to go back to, and a line always
  // carries the provenance of what it states (L-QTY-03) — so it is no height a rail can bind, and the
  // row is KEPT with H declared omitted rather than offered under a source nothing answers to
  // (L-QTY-02). A source the setup spells as nothing is no source either, the same way a calibration
  // reference it spells as nothing is no affirmed reference.
  //
  // Under its OWN code: the readings AGREE and a figure stands, so telling the reader nobody has
  // stated this level's height would send them to enter one that is already entered (Q-07).
  if (height.sourceKey === null || height.sourceKey.length === 0) return { ok: false, code: STOREY_HEIGHT_UNCITED };
  // The source is the entity the height was read from, as the level states it: a rail names no
  // provenance the setup did not give it, and the guard above means there is one to name (L-QTY-03).
  return { ok: true, reading: { value: height.value, unit: height.unit, basis: height.basis, source: height.sourceKey } };
}

/**
 * The read-only setup every rail is handed beside the register's rows — "rails share only setup, the
 * register and the document stage" (L-MEA-08).
 *
 * It is data, wholly: a rail is a pure function, so everything it would otherwise have asked a store
 * for is read once by the measure job and handed in. Nothing here is derived and nothing is
 * converted; each map is keyed by the identifier its own reader already holds.
 */
export type RailSetup = {
  /** Every placement of the campaign's drawings, by its placement key. */
  readonly placements: Readonly<Record<string, PlacementSetup>>;
  /** Each ingest record's member-type variants, by family. */
  readonly memberTypes: Readonly<Record<string, Readonly<Record<string, readonly MemberVariantSetup[]>>>>;
  /** The project's live level stack, in ordinal order. */
  readonly levels: readonly LevelSetup[];
  /** The affirmed calibration reference of each (ingest, view) — absent where none is affirmed. */
  readonly calibrations: Readonly<Record<string, Readonly<Record<string, string>>>>;
  /** The concrete grade a drawing's general notes stated, where a reader stated one. */
  readonly grades: Readonly<Record<string, Measure>>;
  /**
   * What the plan reader read of each placement, by placement key: the plate, the sunken drop, the
   * flight, the landing and the wall run a rail measures from (R-TO-032, AM-06 §3/§4). A placement
   * with no entry here is one nobody read a plan for, and the rail reports that absence rather than
   * measuring something nobody read (L-QTY-01, L-QTY-04).
   */
  readonly plans: Readonly<Record<string, PlanReadingSetup>>;
  /** The run the partition read for each beam and tie-beam placement, by its placement key. */
  readonly runs: Readonly<Record<string, RunSetup>>;
  /** The opening an opening schedule states behind each lintel placement, by its placement key. */
  readonly lintels: Readonly<Record<string, LintelSetup>>;
  /** The wall plan's readings and the opening schedule behind each brick-wall placement, by key. */
  readonly walls: Readonly<Record<string, WallSetup>>;
  /** The outline, the selecting facts and the opening schedule behind each surface placement, by key. */
  readonly surfaces: Readonly<Record<string, SurfaceSetup>>;
  /**
   * What each SITE fact of the project stands at, where somebody entered one (L-MEA-06). A fact
   * nobody entered is an ABSENT KEY — "an absent fact is a named deferral, never a default"
   * (AM-06 §1) — so a rail reads an absence here and reports it rather than falling back to a zero.
   */
  readonly siteFacts: Readonly<Partial<Record<SiteFact, SiteFactSetup>>>;
  /**
   * The edition the campaign was opened under: its digest, and the parameter values it states. What
   * no drawing carries and no person entered is bound DERIVED from a citable clause of this edition
   * (L-MEA-06: "a citable clause is DERIVED, not DEFAULTED"), and the digest is what such a reading
   * cites, so a reader can go back to the very edition the figure stood on (L-MEA-01, L-QTY-01).
   */
  readonly edition: EditionSetup;
  /**
   * What the campaign's drawings say about DETAILING, read through the notes law's one door. A
   * general note re-versions what a campaign APPLIES and mints no rule-set edition (AM-03(h)), so
   * this seam is where a transcribed lap or grade reaches the rail that details with it.
   */
  readonly detailing: DetailingSetup;
};

/**
 * The detailing values a campaign applies, as the notes door answered them (AM-03(h), inc-303).
 *
 * Every half is nullable because every half may simply not have been read: a null is an ABSENCE, and
 * the rail falls back to the applied edition's own clause and binds it DERIVED (L-MEA-06) rather
 * than treating the absence as a zero. `suspended` names the kinds whose readings DISAGREE — a note
 * nobody has settled states nothing at all, and the component it governs is omitted by name.
 */
export type DetailingSetup = {
  readonly fy: Measure | null;
  readonly fc: Measure | null;
  readonly lapMultiplier: number | null;
  readonly hookExtension: { readonly multiplier: number | null; readonly minimumMm: number | null } | null;
  readonly suspended: readonly string[];
  readonly sourceKeys: readonly string[];
};

/**
 * One reinforcement zone a schedule states for a member-type variant (L-FRM-05, R-TO-032).
 *
 * A zone states either a GROUP of bars (`n × ⌀`, as a column's `main` does) or a SPACING (as its
 * ties do), and the length it runs over is the schedule's business rather than this shape's: a zone
 * that states a spacing and no length is exactly the absence `REBAR_TIE_ZONE_UNSTATED` discloses.
 */
export type RebarZoneSetup = {
  readonly zone: string;
  readonly bars: readonly { readonly n: number; readonly diameterMm: number }[] | null;
  readonly spacing: number | null;
  readonly spacingUnit: string | null;
  readonly spacingBar: number | null;
  readonly sourceKeys: readonly string[];
};

/**
 * One SITE fact as the setup carries one: the reading as it was written, the metres the canon made
 * of it, the note that says where it came from and the act that entered it. A rail binds the value
 * AS WRITTEN and cites the act — an ENTERED reading's recourse is the person who entered it
 * (L-QTY-01, L-QTY-03).
 */
export type SiteFactSetup = {
  readonly value: string;
  readonly unit: string;
  readonly canonicalMetres: string;
  readonly sourceNote: string;
  readonly actId: string;
};

/** The pinned edition a DERIVED reading is bound from: what it is, and what it states (L-MEA-01). */
export type EditionSetup = {
  readonly digest: string;
  readonly parameters: Readonly<Record<string, { readonly value: string; readonly unit: string }>>;
};

/**
 * One reading of the setup that the partition READ rather than transcribed: the value in the unit it
 * was read in, how it was known, and the entity it was read from. Narrower than `Measure` because
 * the calibration a run stands on is the view's, which the rail already holds (L-QTY-03).
 */
export type ReadingSetup = {
  readonly value: string;
  readonly unit: string;
  readonly basis: QuantityBasis;
  readonly source: string;
};

/**
 * How a junction stands where one member's quantity turns on another's (L-QTY-04, L-MEA-09).
 *
 * RESOLVED is the figure read outright. BOUNDED is a reading that could only BOUND the junction: it
 * is deducted at its bound and the published figure is then UNDER, which is a lawful disclosure.
 * UNBOUNDED carries no reading at all — "over-measurement → hard block, never a disclosure" — so
 * there is no bound to deduct at and nothing publishes.
 */
export type JunctionReading =
  | { readonly reading: ReadingSetup; readonly standing: "RESOLVED" | "BOUNDED" }
  | { readonly reading: null; readonly standing: "UNBOUNDED" };

/**
 * One reading of a plan member, as the plan reader states it and a rail measures from it (R-TO-032,
 * AM-06 §3/§4). The five members are `PLAN_MEMBERS`, and the discriminant is which of them it is.
 *
 * Nothing here is derived and nothing is converted: each field is what the drawing said, in the unit
 * it was written in, with the basis and the entity it was read from (L-MEA-08, L-QTY-03). What a
 * reading says ABOUT ITSELF — whether the outline closed, what bears the plate, what shape a stair
 * is — is STATED rather than inferred, because a surface that is not a closed outline defers with a
 * reason and is never bounding-boxed (L-MEA-03).
 */
export type PlanReadingSetup =
  | {
      readonly member: "SLAB_PANEL";
      readonly outline: "CLOSED" | "OPEN";
      readonly bearing: "FRAMED" | "GROUND";
      readonly area: ReadingSetup;
      /** The column and wall plan areas the plate runs past — the vertical owns that volume (L-MEA-09). */
      readonly members: JunctionReading;
      /** The beam soffits the plate stands over — the beam owns that face (L-MEA-09). */
      readonly beamSoffit: JunctionReading;
      readonly freeEdge: ReadingSetup;
      readonly thickness: ReadingSetup;
      /** The second thickness a tapering plate was read at, where the reader stated one. */
      readonly thickness2: ReadingSetup | null;
      readonly openings: readonly ReadingSetup[];
    }
  | { readonly member: "SLAB_DROP"; readonly length: ReadingSetup; readonly breadth: ReadingSetup; readonly height: ReadingSetup }
  | {
      readonly member: "STAIR_FLIGHT";
      readonly shape: "STRAIGHT" | "COMPLEX";
      readonly sloped: ReadingSetup;
      readonly width: ReadingSetup;
      readonly waist: ReadingSetup;
      readonly going: ReadingSetup;
      readonly rise: ReadingSetup;
      readonly risers: ReadingSetup;
    }
  | { readonly member: "STAIR_LANDING"; readonly shape: "RECT" | "COMPLEX"; readonly area: ReadingSetup; readonly thickness: ReadingSetup }
  | { readonly member: "WALL_RUN"; readonly length: ReadingSetup; readonly thickness: ReadingSetup; readonly contact: ReadingSetup; readonly ends: ReadingSetup };

/**
 * One placement's run (L-MEA-09): the drawn axis clear between the faces of the members supporting
 * its ends, and the slab thickness adjoining each of its two sides. Each is null where the drawing
 * stated none — an unread reading is never a zero, and the rail declares the omission (L-QTY-02).
 */
export type RunSetup = {
  readonly clear: ReadingSetup | null;
  readonly sides: readonly [ReadingSetup | null, ReadingSetup | null];
};

/**
 * One placement's lintel, as an opening schedule states one: the five readings a lintel is measured
 * from, all of them the schedule's. A lintel with no entry here is a lintel nothing scheduled, and
 * the rail reports `LINTEL_SOURCE_ABSENT` rather than reading the wall around it (R-TO-032).
 */
export type LintelSetup = {
  readonly count: ReadingSetup;
  readonly b: ReadingSetup;
  readonly D: ReadingSetup;
  readonly w: ReadingSetup;
  readonly bearing: ReadingSetup;
};

/**
 * One row of an opening schedule, as the reader read it (L-MEA-02: "the opening schedule is the
 * authority"). A row states a mark, the face area of one opening of that mark, how many of them it
 * claims, and the floors it claims them on — and the cell it was read at, which every candidate
 * expanded from it cites.
 */
export type OpeningSetup = {
  readonly mark: string;
  /** The opening's face area as the schedule reader stated it (w × h of the row); null where the opening was seen but is not areable (L-MEA-03). */
  readonly area: ReadingSetup | null;
  /** How many of this mark the row states; expanded by the rail into that many candidates. */
  readonly count: ReadingSetup;
  /** The floors the schedule row claims (L-MEA-02); null where the row claims none and stands in the wall's own floor group. */
  readonly floors: BandStatement | null;
  /** The schedule cell / entity the row was read at — what every candidate cites. */
  readonly source: string;
};

/**
 * One placement's brick wall, as the wall plan and the opening schedule state it: the three readings
 * its brickwork is measured from, and the openings that deduct from its face. Each reading is null
 * where nothing stated it — an unread reading is never a zero, and the rail declares the omission
 * (L-QTY-02).
 */
export type WallSetup = {
  readonly length: ReadingSetup | null;
  readonly height: ReadingSetup | null;
  readonly thickness: ReadingSetup | null;
  /** The scheduled openings of this wall; null where NO opening schedule stands behind it (the face is then not measured). */
  readonly openings: readonly OpeningSetup[] | null;
};

/**
 * One placement's finished surface, as the reader read it: whether the outline closed at all, the
 * gross area it encloses, the facts that SELECT the finish item (L-MEA-06), and the openings that
 * deduct from it.
 */
export type SurfaceSetup = {
  /** Whether the reader read a closed outline; false defers SURFACE_NOT_CLOSED, never a bounding box. */
  readonly closed: boolean;
  readonly gross: ReadingSetup | null;
  readonly face: ReadingSetup;
  readonly floor: ReadingSetup;
  readonly thickness: ReadingSetup | null;
  readonly mix: ReadingSetup | null;
  readonly openings: readonly OpeningSetup[] | null;
};

/** What a rail is asked: which campaign, over which pinned revision, for which kind, and of what. */
export type RailInput = {
  readonly campaignId: string;
  readonly setRevisionId: string;
  readonly kind: Kind;
  readonly objects: readonly RegisterObjectRow[];
  /** What the rows are read against — placements, sections, levels, calibrations and grades. */
  readonly setup: RailSetup;
};

/** What a rail answers with — offers and observations, and nothing computed (L-MEA-08). */
export type RailBatch = {
  readonly offers: readonly Offer[];
  readonly observations: readonly RailObservation[];
};

/** A rail: a pure function of what it was handed (L-MEA-08). It reaches no store and no clock. */
export type Rail = (input: RailInput) => RailBatch;

/** Which campaign, in which project of which workspace, a batch is being judged for. */
export type GateScope = {
  readonly tenantId: string;
  readonly projectId: string;
  readonly campaignId: string;
};

/** One offer the gate refused, naming the object it was about and the registered code (L-MEA-08). */
export type GateRefusal = {
  readonly objectKey: string;
  readonly code: RefusalCode;
};

/**
 * The gate's total verdict over one batch: the three arms sum to the offers handed in, and every
 * refusal is RETURNED rather than thrown, so one bad offer never costs the others their answer.
 */
export type GateVerdict = {
  readonly published: number;
  readonly refused: number;
  readonly queued: number;
  readonly refusals: readonly GateRefusal[];
};

/**
 * The gate, as a caller types it. The one lawful caller is the worker's measure handler, so the
 * function's TYPE lives here with the rest of the contract: a module composing the job's dependencies
 * types the gate through this and never reaches `src/core/gate` (SEAM-GATE, riskNotes (2)).
 */
export type GateEvaluate = (scope: GateScope, batch: RailBatch) => Promise<GateVerdict>;
