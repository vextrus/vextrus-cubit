// R-TO-032's bill of bars: what one campaign's members HOLD, synthesised from what their schedules
// state, as content-keyed rows (L-REG-04, L-FRM-05).
//
// Everything here is pure. The detailing is the applied edition's, carried in through the setup's
// one notes door (AM-03(h)); the cutting lengths are BS 8666's; the splitting is the stock method's;
// the mass is the kg/m table's. This file DECIDES nothing about steel — it reads a member, asks the
// methods, and answers rows. That is why the same input twice answers the identical key multiset and
// why re-measuring an unchanged campaign rewrites the same rows (L-REG-04, L-MEA-08).
//
// A class this file has no reader for is not measured at zero: it is OBSERVED under
// REBAR_SCHEDULE_UNREAD, which is what a reader goes and reads (L-QTY-01, L-QTY-02).
//
// WHICH synthesis details a campaign is its edition's to say (L-MEA-01, s-bbs I-658): the pair the
// campaign's pinned edition cites for `rcc.rebar.synthesis` picks the code, so a campaign pinned
// before @2 writes the bars it always wrote. @2 derives a column's ties under D-003 and binds a stated
// lap outside the grade and mix contest; @1 does neither.
import type { ElementType } from "@/core/catalogue/classes";
import type { Kind } from "@/core/catalogue/kinds";
import type { RebarRefusalCode } from "@/core/errors/rebar";
import type { NoteContestedCode } from "@/core/notes/law";
import { semanticDigest } from "@/core/identity/semantic";
import { detailingOfClass, foundationNeckOf, heightOf, variantCovering } from "@/core/offers/contract";
import type {
  EditionSetup,
  JointReading,
  LevelSetup,
  Measure,
  MemberVariantSetup,
  PlacementSetup,
  RailInput,
  RailObservation,
  RailSetup,
  RebarZoneSetup,
  RegisterObjectRow,
} from "@/core/offers/contract";
import { cuttingLengthOf, isAdditiveLengthOf, roundedCuttingLengthOf, SHAPES } from "@/core/rulesets/methods/rebar/bs8666";
import {
  coverOf,
  DETAILING_BNBC2020_BD,
  isEditionDiameter,
  kgPerMetreOf,
  STOCK_BAR_MM,
  type DetailingEdition,
} from "@/core/rulesets/methods/rebar/detailing-bnbc2020-bd";
import { massOf } from "@/core/rulesets/methods/rebar/mass";
import { stockSplitOf } from "@/core/rulesets/methods/rebar/stock";
import {
  applyDetailing,
  lapLengthFor,
  REBAR_SYNTHESIS,
  synthesiseLink,
  synthesiseVertical,
  type AppliedDetailing,
  type BarPosition,
  type BarRole,
  type BarSpec,
  type LengthAnswer,
  type VerticalProbe,
} from "@/core/rulesets/methods/rebar/synthesis";
import {
  lapLengthFor as lapLengthForV2,
  REBAR_SYNTHESIS_V2,
  synthesiseColumnTies,
  synthesiseVertical as synthesiseVerticalV2,
  TIE_CLAUSES,
} from "@/core/rulesets/methods/rebar/synthesis-v2";
import { isLinkRole } from "@/core/rulesets/rebar-roles";
import { convert, exact, unitNamed } from "@/core/units/canon";

/** The one kind this rail measures — a rail is selected per quantity KIND (L-MEA-08). */
export const RCC_REBAR: Kind = "rcc.rebar";

/** The rule the rebar offers are made under. An offer names a rule and never a version (L-MEA-08). */
export const REBAR_RULE_ID = "rcc.rebar.mass";

/** The detailing edition of record, resolved once: the methods are data, and data is read once. */
const EDITION: DetailingEdition = DETAILING_BNBC2020_BD.resolve() as DetailingEdition;

/** One millimetre-stated length, as every length in this file is (BS 8666 is a millimetre standard). */
const MM = "mm";

/** The shape a plan note calls a round member (I-304) — whose ties are hoops the roster does not hold. */
const ROUND = "ROUND";

/** The class whose ties @2 derives under D-003. A shear wall's confinement is a wall's, not a column's. */
const COLUMN: ElementType = "column";

/**
 * One version of the bar synthesis, as this leaf runs it: the verticals, the lap they are spliced
 * at, and whether a column's unstated tie zones are DERIVED (D-003) or declared unstated.
 */
type Synthesis = {
  readonly pair: string;
  readonly synthesiseVertical: (probe: VerticalProbe) => readonly BarSpec[];
  readonly lapLengthFor: (applied: AppliedDetailing, edition: DetailingEdition, at: BarPosition) => LengthAnswer;
  readonly derivesColumnTies: boolean;
};

/** The versions this tree implements, by version (L-MEA-01: a method is versioned code). */
const SYNTHESES: Readonly<Record<string, Synthesis>> = Object.freeze({
  [REBAR_SYNTHESIS.version]: Object.freeze({ pair: `${REBAR_SYNTHESIS.ruleId}@${REBAR_SYNTHESIS.version}`, synthesiseVertical, lapLengthFor, derivesColumnTies: false }),
  [REBAR_SYNTHESIS_V2.version]: Object.freeze({
    pair: `${REBAR_SYNTHESIS_V2.ruleId}@${REBAR_SYNTHESIS_V2.version}`,
    synthesiseVertical: synthesiseVerticalV2,
    lapLengthFor: lapLengthForV2,
    derivesColumnTies: true,
  }),
});

/**
 * The synthesis a campaign's bars are written by: the version its pinned edition cites for
 * `rcc.rebar.synthesis` — the FIRST pair it cites for the rule, as the gate reads an edition
 * (`versionInForce`) — and null where it cites a version this tree does not implement.
 *
 * An edition that cites NO synthesis pair (the platform's 2026.08–.12, which predate the rebar rail,
 * and a setup a proof builds by hand) is written by @1: that is the code every such campaign's bar
 * rows were written by, and the re-measure of a pinned campaign writes the bars it always wrote
 * (L-REG-07; s-bbs I-658). The gate publishes no rebar line under such an edition anyway — it cites
 * no `rcc.rebar.mass` — so the rows are the bill of bars and nothing more.
 */
export function synthesisFor(edition: EditionSetup): Synthesis | null {
  const cited = edition.methods?.find((pair) => pair.ruleId === REBAR_SYNTHESIS.ruleId);
  if (cited === undefined) return SYNTHESES[REBAR_SYNTHESIS.version] as Synthesis;
  return Object.hasOwn(SYNTHESES, cited.version) ? (SYNTHESES[cited.version] as Synthesis) : null;
}

/**
 * The classes this leaf synthesises bars for, and the reader each is read by.
 *
 * A vertical member's steel is its main-bar group through the storey run and the links that confine
 * it; those are the two readers R-TO-032 lands. Every other class that BEARS `rcc.rebar` is borne
 * rather than read here — its schedule is a different shape, and a class with no reader is disclosed
 * by name rather than measured at zero (L-QTY-01, L-QTY-02).
 */
const READ_CLASSES: readonly ElementType[] = Object.freeze(["column", "shear_wall"] as const);

/**
 * The suffix a bar mark carries per role. A schedule marks a member's bars by what they ARE — a
 * column's verticals, the ties around them — and the mark is the member's own mark with that letter
 * beside it, so a reader can find the row on the drawing it came from (L-FRM-05).
 */
const MARK_SUFFIX: Readonly<Record<BarRole, string>> = Object.freeze({
  MAIN: "v",
  SIDE: "sd",
  TIE: "t",
  STIRRUP: "s",
  EXTRA_TOP: "et",
  EXTRA_BOTTOM: "eb",
  DISTRIBUTION: "d",
  HORIZONTAL: "h",
  SPIRAL: "sp",
});

/**
 * One row of the bill of bars: what the bar IS, how it is cut, how many of it, and what it weighs.
 *
 * The three lengths stand side by side because AM-01 says they must: the raw BS 8666 length, never
 * rounded; the ONE rounded surface; and the IS 2502 additive figure, recorded beside them and billed
 * by nothing at all. Every figure is an exact decimal as text (B-07).
 */
export type BarRow = {
  readonly barKey: string;
  readonly objectKey: string;
  readonly class: ElementType;
  readonly level: string | null;
  readonly mark: string;
  readonly barMark: string;
  readonly role: BarRole;
  readonly diameterMm: number;
  readonly shape: string;
  readonly dimsMm: Readonly<Record<string, string>>;
  readonly cuttingRawMm: string;
  readonly cuttingRoundedMm: string;
  readonly cuttingIsAdditiveMm: string;
  readonly piecesPerBar: number;
  readonly lapMm: string;
  readonly lapsPerBar: number;
  readonly barsPerUnit: number;
  readonly parentCount: string;
  readonly bars: string;
  readonly kgPerMetre: string;
  readonly kgNet: string;
  readonly kgLap: string;
  readonly kg: string;
  readonly sourceKeys: readonly string[];
  readonly detailingSourceKeys: readonly string[];
  readonly editionDigest: string;
  readonly semantic: string;
};

/**
 * L-REG-04's content-derived key for one bar row: the member it belongs to, the role it stands in,
 * the diameter it is, and which group of that role it is. No UUID, no timestamp and no insertion
 * order — "the same content yields the same key, on any machine, in any order".
 */
export function barRowKeyOf(at: { readonly objectKey: string; readonly role: BarRole; readonly diameterMm: number; readonly sequence: number }): string {
  return `${at.objectKey}|${at.role}|${at.diameterMm}|${at.sequence}`;
}

/** What one member was read as, once everything its bars need has been found. */
type MemberRead = {
  readonly row: RegisterObjectRow;
  readonly class: ElementType;
  readonly placement: PlacementSetup;
  readonly calibration: string;
  readonly variant: MemberVariantSetup;
  readonly level: LevelSetup | undefined;
  readonly applied: AppliedDetailing;
  /** The grade a note stated, as it was written — what the line is SELECTED by (L-QTY-03). */
  readonly fy: Measure | null;
  readonly bars: readonly BarRow[];
  /** The components no schedule stated, each under the code that says what is missing (L-QTY-02). */
  readonly unstated: readonly { readonly variable: string; readonly code: UnstatedCode }[];
};

/**
 * What a component of this leaf's line is declared missing under: this area's own codes, and the
 * notes law's contested reading where the note the component would be taken off is one two readers
 * read differently (AM-03(h), Q-07 — the code is the notes law's, not a second spelling here).
 */
type UnstatedCode = RebarRefusalCode | NoteContestedCode;

/**
 * What this leaf answers a member it could not read under — its own closed roster (L-MEA-08) — and
 * the gate's own code for a synthesis version the campaign's edition cites and the tree does not
 * implement, which is the same absence the gate names for a formula (B-17).
 */
type ObservedCode = RebarRefusalCode | "METHOD_IMPLEMENTATION_MISSING";

/** One observation of this leaf, with what it stands on where it says more than its code. */
function observe(code: ObservedCode, row: RegisterObjectRow, sourceEntity: string, detail?: Record<string, unknown>): RailObservation {
  const said: RailObservation = { class: row.elementType as ElementType, kind: RCC_REBAR, code, objectKey: row.objectKey, sourceEntity };
  return detail === undefined ? said : { ...said, detail };
}

/**
 * The storey run a vertical member rises through, in millimetres.
 *
 * The bar runs floor to floor THROUGH the joint (L-MEA-09), so the run IS the level's storey height,
 * and it is read through `heightOf` — the one reading every vertical class asks of a level (B-17).
 * A height nobody read, one whose readings disagree and one that cites no drawing entity are no run
 * here either (L-MEA-07, L-QTY-03).
 *
 * A drawing states a storey in the unit it states it in — F-RCC6-BNBC's section writes 3.353 m and
 * 3.048 m off its `EL` marks — and BS 8666 cuts in millimetres, so the reading is carried there by
 * the canon's own `convert`. L-FRM-06 bans a conversion LITERAL outside the canon; asking the canon
 * is that law kept, not broken (I-307). The carry is exact and nothing rounds it: the run is the raw
 * cutting length's own leg (AM-01).
 *
 * Every refusal — no height, a standing other than AGREED, a unit the canon names nothing for, a
 * unit that is not a length — is this leaf's REBAR_STOREY_RUN_UNSTATED rather than the levels law's
 * code, because what is missing here is the LENGTH OF BAR, and naming the storey height alone would
 * send a reader to a different question (L-MEA-07, L-MEA-08's roster). The spelling is asked of the
 * canon's recogniser first because the canon throws on a unit it does not know (ARCH-03), and a rail
 * that throws takes the whole campaign's measurement with it (L-QTY-02).
 */
function storeyRunOf(level: LevelSetup | undefined): { readonly ok: true; readonly mm: string; readonly source: string } | { readonly ok: false } {
  const height = heightOf(level);
  if (!height.ok) return { ok: false };
  const unit = unitNamed(height.reading.unit);
  if (unit === null) return { ok: false };
  const run = convert(height.reading.value, unit, MM);
  if (!run.ok) return { ok: false };
  return { ok: true, mm: run.value, source: height.reading.source };
}

/** The main-bar group a member's schedule states, and the tie zones it states around them. */
function zonesOf(variant: MemberVariantSetup): { readonly main: RebarZoneSetup | undefined; readonly ties: readonly RebarZoneSetup[] } {
  const main = variant.rebar.find((zone) => zone.bars !== null && zone.bars.length > 0);
  return { main, ties: variant.rebar.filter((zone) => zone.spacing !== null) };
}

/** One synthesised spec, costed into a row: cut, split, weighed and keyed by its own content. */
function rowOf(spec: BarSpec, sequence: number, read: Omit<MemberRead, "bars" | "unstated">): BarRow {
  const probe = { shape: spec.shape, diameterMm: spec.diameterMm, legsMm: spec.legsMm };
  const raw = cuttingLengthOf(probe, EDITION);
  // A bar longer than the stock bar is spliced, and the joints the CUT forces are laps like any
  // other (AM-03(a)). They are not added to the detail's: a detail that calls for one splice places
  // it at a joint the cut already makes, which is the reading every split row of the F-RCC6-BNBC
  // roster stands on — a bar is spliced pieces − 1 times, or once where the detail says so and the
  // stock bar reaches, and never both at once.
  const split = stockSplitOf({ lengthMm: raw, lapMm: spec.lapMm, stockMm: String(STOCK_BAR_MM) });
  const pieces = split.ok ? split.pieces : 1;
  const lapsPerBar = Math.max(spec.lapsPerBar, pieces - 1);
  const parentCount = "1";
  const bars = exact(spec.barsPerUnit).mul(exact(parentCount)).toString();
  const lapTotal = exact(spec.lapMm).mul(exact(lapsPerBar)).toString();
  const mass = (billableMm: string): string => massOf({ billableMm, diameterMm: spec.diameterMm, bars, edition: EDITION });
  const dimsMm: Record<string, string> = {};
  SHAPES[spec.shape].legs.forEach((letter, at) => {
    const leg = spec.legsMm[at];
    if (leg !== undefined) dimsMm[letter] = leg;
  });
  const content = {
    objectKey: read.row.objectKey,
    role: spec.role,
    diameterMm: spec.diameterMm,
    shape: spec.shape,
    dimsMm,
    barsPerUnit: spec.barsPerUnit,
    parentCount,
    lapMm: spec.lapMm,
    lapsPerBar,
    editionDigest: read.applied.editionDigest,
  };
  return {
    barKey: barRowKeyOf({ objectKey: read.row.objectKey, role: spec.role, diameterMm: spec.diameterMm, sequence }),
    objectKey: read.row.objectKey,
    class: read.class,
    level: read.level?.label ?? read.row.levelLabel,
    mark: read.row.mark,
    barMark: `${read.row.mark}-${MARK_SUFFIX[spec.role]}`,
    role: spec.role,
    diameterMm: spec.diameterMm,
    shape: spec.shape,
    dimsMm,
    // The raw length is NEVER rounded, and the rounded surface is the only place a rounding happens
    // — the IS-additive figure is recorded beside both and asserted equal to neither (AM-01).
    cuttingRawMm: raw,
    cuttingRoundedMm: roundedCuttingLengthOf(raw),
    cuttingIsAdditiveMm: isAdditiveLengthOf(probe, EDITION),
    piecesPerBar: pieces,
    lapMm: spec.lapMm,
    lapsPerBar,
    barsPerUnit: spec.barsPerUnit,
    parentCount,
    bars,
    kgPerMetre: kgPerMetreOf(EDITION, spec.diameterMm),
    kgNet: mass(raw),
    kgLap: mass(lapTotal),
    kg: mass(exact(raw).add(exact(lapTotal)).toString()),
    sourceKeys: spec.sourceKeys,
    detailingSourceKeys: read.applied.sourceKeys,
    editionDigest: read.applied.editionDigest,
    semantic: semanticDigest(content),
  };
}

/**
 * Every member of the batch this leaf could read, with its bars — and an observation for every one
 * it could not.
 *
 * Both the rail and the stored bill are taken from this one pass, so the line a member is billed on
 * and the rows behind it are two views of the SAME synthesis rather than two computations of it
 * (B-17). What is read is read in the order the rows arrived: this sorts nothing.
 */
export function readMembers(input: RailInput): { readonly reads: readonly MemberRead[]; readonly observations: readonly RailObservation[] } {
  const setup: RailSetup = input.setup;
  const reads: MemberRead[] = [];
  const observations: RailObservation[] = [];
  // The detailing is the member CLASS's (I-652): a note that scoped a figure to the piles details
  // the piles, and a column is detailed at the unscoped figures. Resolved once per class.
  const appliedByClass = new Map<ElementType, AppliedDetailing>();
  const appliedOf = (memberClass: ElementType): AppliedDetailing => {
    const held = appliedByClass.get(memberClass);
    if (held !== undefined) return held;
    const resolved = applyDetailing(detailingOfClass(setup.detailing, memberClass), EDITION, setup.edition.digest);
    appliedByClass.set(memberClass, resolved);
    return resolved;
  };
  const synthesis = synthesisFor(setup.edition);
  // The foundation neck, where a column's bars are billed through the neck and their anchorage into
  // the cap is stated on no sheet (A′; the level a person entered beneath GF, `foundationNeckOf`).
  const neck = foundationNeckOf(setup.levels)?.neck.levelId ?? null;

  for (const row of input.objects) {
    const memberClass = row.elementType as ElementType;
    if (!READ_CLASSES.includes(memberClass)) continue;
    if (synthesis === null) {
      // The edition cites a synthesis version the tree does not compute: no bar is written under a
      // version nobody implements, and the member says so by the gate's own code (L-MEA-01).
      observations.push(observe("METHOD_IMPLEMENTATION_MISSING", row, row.placementKey));
      continue;
    }

    const placement = setup.placements[row.placementKey];
    if (placement === undefined) {
      observations.push(observe("REBAR_SCHEDULE_UNREAD", row, row.placementKey));
      continue;
    }
    // A rail cannot mint a calibration reference it does not hold, and a line always carries "a
    // non-empty set of affirmed calibration references" (L-QTY-03).
    const calibration = setup.calibrations[placement.ingestId]?.[placement.viewKey];
    if (calibration === undefined || calibration.length === 0) {
      observations.push(observe("REBAR_SCHEDULE_UNREAD", row, placement.viewKey));
      continue;
    }
    const family = placement.memberFamily;
    const variants = family === null ? undefined : setup.memberTypes[placement.ingestId]?.[family];
    const level = setup.levels.find((one) => one.levelId === row.levelId);
    const variant = variants === undefined || variants.length === 0 ? undefined : variantCovering(variants, level, setup.levels);
    if (variant === undefined) {
      observations.push(observe("REBAR_SCHEDULE_UNREAD", row, placement.sourceEntity));
      continue;
    }

    const zones = zonesOf(variant);
    if (zones.main === undefined || zones.main.bars === null) {
      // A member whose schedule states no bar group has no steel to bill: the absence is reported
      // against the schedule cell a reader goes and reads, never inferred from the section.
      observations.push(observe("REBAR_SCHEDULE_UNREAD", row, placement.sourceEntity));
      continue;
    }

    const applied = appliedOf(memberClass);
    const head = { row, class: memberClass, placement, calibration, variant, level, applied, fy: detailingOfClass(setup.detailing, memberClass).fy };
    const unstated: { readonly variable: string; readonly code: UnstatedCode }[] = [];
    const bars: BarRow[] = [];

    const run = storeyRunOf(level);
    if (!run.ok) {
      // No run, no bar: the net and the laps are both DECLARED missing and the row is kept, because
      // "a row kept with no quantity is PARTIAL_DECLARED, never COMPLETE" (L-QTY-02).
      unstated.push({ variable: "net", code: "REBAR_STOREY_RUN_UNSTATED" }, { variable: "lap", code: "REBAR_STOREY_RUN_UNSTATED" });
      observations.push(observe("REBAR_STOREY_RUN_UNSTATED", row, placement.sourceEntity));
    } else {
      // A bar the edition holds no unit weight for cannot be billed at all, and a rail never invents
      // a rate (AM-03(b)): the group is left unsynthesised and the member keeps its line with the net
      // declared missing — a schedule cell that yielded no bars anyone can bill is a schedule unread
      // for this member's steel, which is the code below. A throw here would take the whole
      // campaign's measurement with it, every other kind's lines included (L-QTY-02, L-MEA-08).
      const priced = zones.main.bars.filter((group) => isEditionDiameter(EDITION, group.diameterMm));
      if (priced.length < zones.main.bars.length) {
        unstated.push({ variable: "net", code: "REBAR_SCHEDULE_UNREAD" });
        observations.push(observe("REBAR_SCHEDULE_UNREAD", row, zones.main.sourceKeys[0] ?? placement.sourceEntity));
      }
      const mains = synthesis.synthesiseVertical({
        storeyRunMm: run.mm,
        mains: priced,
        detailing: applied,
        edition: EDITION,
        sourceKeys: [...zones.main.sourceKeys, run.source],
      });
      mains.forEach((spec, at) => bars.push(rowOf(spec, at, head)));
      // Why a lap could not be derived is the detailing's OWN answer and never a guess made here: a
      // grade the edition holds no row for and a note two readers read differently are different
      // disclosures, and the one that applies is the one reported (AM-03(f), AM-03(h), L-QTY-02).
      for (const group of zones.main.bars) {
        const lap = synthesis.lapLengthFor(applied, EDITION, { diameterMm: group.diameterMm, confined: false, top: false });
        if (lap.ok) continue;
        unstated.push({ variable: "lap", code: lap.code });
        break;
      }
      // A′: the bars of a column standing on the foundation neck are billed through the neck; their
      // anchorage into the cap below is stated on no sheet, and the line says it stands under.
      if (synthesis.derivesColumnTies && memberClass === COLUMN && neck !== null && row.levelId === neck) {
        observations.push(observe("REBAR_ANCHORAGE_UNSTATED", row, zones.main.sourceKeys[0] ?? placement.sourceEntity));
      }
    }

    // A zone the schedule states a LENGTH for is counted over it, under either version: the drawing
    // outranks the clause (L-QTY-01). Where the zones state a spacing and no length, @1 leaves the
    // confinement steel a component nobody has read (riskNotes (5)); @2 derives a COLUMN's zones under
    // D-003 where the joint at its top is bounded, and names what it could not read where it is not.
    const links = linksOf(zones.ties, variant, head, run.ok ? run.mm : null);
    if (links.length > 0) links.forEach((spec, at) => bars.push(rowOf(spec, at, head)));
    else if (synthesis.derivesColumnTies && memberClass === COLUMN) {
      const derived = derivedTiesOf({ row, placement, variant, ties: zones.ties, head, runMm: run.ok ? run.mm : null, joint: setup.joints?.[row.objectKey] });
      if (derived.ok) {
        derived.bars.forEach((spec, at) => bars.push(rowOf(spec, at, head)));
        observations.push(derived.observation);
      } else {
        unstated.push({ variable: "ties", code: derived.code });
        if (derived.observation !== undefined) observations.push(derived.observation);
      }
    } else unstated.push({ variable: "ties", code: "REBAR_TIE_ZONE_UNSTATED" });

    reads.push({ ...head, bars, unstated });
  }

  return { reads, observations };
}

/** What one column's derived ties came to: the bars and the bound they stand at, or the code they are left out under. */
type DerivedTies =
  | { readonly ok: true; readonly bars: readonly BarSpec[]; readonly observation: RailObservation }
  | { readonly ok: false; readonly code: RebarRefusalCode; readonly observation?: RailObservation };

/** The spacing a column schedule states for one of its tie zones, where it states it in millimetres. */
function spacingOf(ties: readonly RebarZoneSetup[], zone: "ties-end" | "ties-mid"): RebarZoneSetup | undefined {
  const stated = (one: RebarZoneSetup): boolean => one.spacing !== null && one.spacingBar !== null && one.spacingUnit === MM;
  // a pair (`10Ø@100/150`) states each zone; a single spacing (`10Ø@150`) states both
  return ties.find((one) => one.zone === zone && stated(one)) ?? ties.find((one) => one.zone === "ties" && stated(one));
}

/**
 * A column's ties under D-003 (`rcc.rebar.synthesis@2`; s-bbs I-656).
 *
 * The count turns on the joint at the column's top, which the joint seam reads off the framing the
 * partition placed (`RailSetup.joints`, I-413). BOUNDED: the ties are counted at the fewest any joint
 * depth the bound leaves open could need — never over — and the line says it stands at that bound
 * (`REBAR_TIE_JOINT_BOUNDED`, with the method, the clauses and the bound in its detail). UNREAD, or no
 * reading at all: the ties are left out by name (`REBAR_TIE_JOINT_UNREAD`, A′). A round column's ties
 * are hoops the BS 8666 roster does not hold, so they are left out as the bar schedule leaves such a
 * bar out (`BAR_SHAPE_NOT_HELD`, I-596) until the shape joins the roster with its own method.
 */
function derivedTiesOf(at: {
  readonly row: RegisterObjectRow;
  readonly placement: PlacementSetup;
  readonly variant: MemberVariantSetup;
  readonly ties: readonly RebarZoneSetup[];
  readonly head: Omit<MemberRead, "bars" | "unstated">;
  readonly runMm: string | null;
  readonly joint: JointReading | undefined;
}): DerivedTies {
  const { row, placement, variant } = at;
  if (at.runMm === null) return { ok: false, code: "REBAR_STOREY_RUN_UNSTATED" };
  if (placement.noteShape === ROUND) return { ok: false, code: "BAR_SHAPE_NOT_HELD" };
  const end = spacingOf(at.ties, "ties-end");
  const mid = spacingOf(at.ties, "ties-mid");
  if (end === undefined || mid === undefined || variant.sectionWidth === null || variant.sectionDepth === null || variant.sectionUnit !== MM) {
    return { ok: false, code: "REBAR_TIE_ZONE_UNSTATED" };
  }
  const tieMm = end.spacingBar as number;
  // A tie the edition holds no unit weight for cannot be billed (AM-03(b)): a schedule cell that
  // yields no bar anyone can bill is a schedule unread for this member's ties, as it is for its mains.
  if (tieMm !== mid.spacingBar || !isEditionDiameter(EDITION, tieMm)) return { ok: false, code: "REBAR_SCHEDULE_UNREAD" };
  const joint = at.joint;
  if (joint === undefined || joint.standing === "UNREAD") {
    return {
      ok: false,
      code: "REBAR_TIE_JOINT_UNREAD",
      observation: observe("REBAR_TIE_JOINT_UNREAD", row, placement.sourceEntity, { unread: joint === undefined ? null : joint.unread, levelId: joint?.levelId ?? null }),
    };
  }
  const tied = synthesiseColumnTies({
    storeyRunMm: at.runMm,
    bMm: String(variant.sectionWidth),
    dMm: String(variant.sectionDepth),
    endSpacingMm: String(end.spacing),
    midSpacingMm: String(mid.spacing),
    joint: { standing: "BOUNDED", depthMm: joint.depthMm },
    coverMm: coverOf(EDITION, "column"),
    tieMm,
    detailing: at.head.applied,
    edition: EDITION,
    // the schedule cells the spacings were read at, and the cell the bounding member's depth was read at
    sourceKeys: [...new Set([...end.sourceKeys, ...mid.sourceKeys, joint.deepest.depth.source])],
  });
  return {
    ok: true,
    bars: tied.bars,
    observation: observe("REBAR_TIE_JOINT_BOUNDED", row, placement.sourceEntity, {
      method: `${REBAR_SYNTHESIS_V2.ruleId}@${REBAR_SYNTHESIS_V2.version}`,
      clauses: [...TIE_CLAUSES],
      boundMm: joint.depthMm,
      boundBy: joint.deepest.objectKey,
      jointMm: tied.count.jointMm,
      sets: tied.count.sets,
    }),
  };
}

/**
 * The links one member's tie zones come to — empty where the zones state no length to run over.
 *
 * A zone that states `⌀10 @ 150 c/c` and nothing else states a spacing over an unnamed distance, and
 * a count taken over the whole storey run would be a length THIS leaf invented. So a zone is only
 * counted where the schedule stated the distance it runs, as `zoneLengthMm` beside its spacing.
 */
function linksOf(
  ties: readonly RebarZoneSetup[],
  variant: MemberVariantSetup,
  head: Omit<MemberRead, "bars" | "unstated">,
  runMm: string | null,
): readonly BarSpec[] {
  if (runMm === null || ties.length === 0) return [];
  const width = variant.sectionWidth;
  const depth = variant.sectionDepth;
  if (width === null || depth === null || variant.sectionUnit !== MM) return [];
  const stated = ties.filter((zone) => zone.spacingBar !== null && zone.spacing !== null && zone.spacingUnit === MM);
  if (stated.length === 0) return [];
  const zones = stated.flatMap((zone) => {
    const length = variant.dimensions[`${zone.zone}LengthMm`];
    return length === undefined || length.unit !== MM ? [] : [{ lengthMm: length.value, spacingMm: String(zone.spacing) }];
  });
  if (zones.length === 0) return [];
  const tieBar = stated[0]?.spacingBar;
  if (tieBar === undefined || tieBar === null) return [];
  return synthesiseLink({
    bMm: String(width),
    dMm: String(depth),
    coverMm: coverOf(EDITION, head.class === "shear_wall" ? "shear_wall" : "column"),
    tieMm: tieBar,
    zones,
    detailing: head.applied,
    edition: EDITION,
    sourceKeys: stated.flatMap((zone) => [...zone.sourceKeys]),
  });
}

/**
 * The campaign's bill of bars, in the order its register rows arrived: one row per (member, role,
 * diameter, group), keyed by content (L-REG-04).
 */
export function barRowsOf(input: RailInput): readonly BarRow[] {
  return readMembers(input).reads.flatMap((read) => read.bars);
}

/** What one member's bars come to, by component: the net, the laps, and the confinement steel. */
export function massesOf(read: { readonly bars: readonly BarRow[] }): { readonly net: string; readonly lap: string; readonly ties: string } {
  let net = exact(0);
  let lap = exact(0);
  let ties = exact(0);
  for (const bar of read.bars) {
    if (isLinkRole(bar.role)) ties = ties.add(exact(bar.kg));
    else {
      net = net.add(exact(bar.kgNet));
      lap = lap.add(exact(bar.kgLap));
    }
  }
  return { net: net.toString(), lap: lap.toString(), ties: ties.toString() };
}

export type { AppliedDetailing, MemberRead };
export { EDITION as REBAR_EDITION, lapLengthFor };
