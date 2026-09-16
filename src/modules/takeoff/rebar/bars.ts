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
import type { ElementType } from "@/core/catalogue/classes";
import type { Kind } from "@/core/catalogue/kinds";
import type { RebarRefusalCode } from "@/core/errors/rebar";
import { semanticDigest } from "@/core/identity/semantic";
import { STOREY_HEIGHT_ABSENCE } from "@/core/levels/law";
import { variantCovering } from "@/core/offers/contract";
import type {
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
  kgPerMetreOf,
  STOCK_BAR_MM,
  type DetailingEdition,
} from "@/core/rulesets/methods/rebar/detailing-bnbc2020-bd";
import { massOf } from "@/core/rulesets/methods/rebar/mass";
import { stockSplitOf } from "@/core/rulesets/methods/rebar/stock";
import {
  applyDetailing,
  lapLengthFor,
  synthesiseLink,
  synthesiseVertical,
  type AppliedDetailing,
  type BarRole,
  type BarSpec,
} from "@/core/rulesets/methods/rebar/synthesis";
import { exact } from "@/core/units/canon";

/** The one kind this rail measures — a rail is selected per quantity KIND (L-MEA-08). */
export const RCC_REBAR: Kind = "rcc.rebar";

/** The rule the rebar offers are made under. An offer names a rule and never a version (L-MEA-08). */
export const REBAR_RULE_ID = "rcc.rebar.mass";

/** The detailing edition of record, resolved once: the methods are data, and data is read once. */
const EDITION: DetailingEdition = DETAILING_BNBC2020_BD.resolve() as DetailingEdition;

/** One millimetre-stated length, as every length in this file is (BS 8666 is a millimetre standard). */
const MM = "mm";

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
  readonly unstated: readonly { readonly variable: string; readonly code: RebarRefusalCode }[];
};

/** What this leaf answers a member it could not read under — its own closed roster (L-MEA-08). */
function observe(code: RebarRefusalCode, row: RegisterObjectRow, sourceEntity: string): RailObservation {
  return { class: row.elementType as ElementType, kind: RCC_REBAR, code, objectKey: row.objectKey, sourceEntity };
}

/**
 * The storey run a vertical member rises through, in millimetres.
 *
 * The bar runs floor to floor THROUGH the joint (L-MEA-09), so the run IS the level's storey height.
 * A height nobody read, or one whose readings disagree, is no run at all (L-MEA-07) — and so is one
 * written in a unit this leaf cannot cut a bar to: a rail converts nothing (L-FRM-06), and a length
 * it cannot state in millimetres is a length it has not read.
 */
function storeyRunOf(level: LevelSetup | undefined): { readonly ok: true; readonly mm: string; readonly source: string } | { readonly ok: false } {
  const height = level?.height;
  if (height === undefined || height.standing !== "AGREED" || height.value === null || height.unit !== MM || height.sourceKey === null || height.sourceKey.length === 0) return { ok: false };
  // The levels law pairs each standing with the code it is absent under; this leaf reports its own
  // REBAR_STOREY_RUN_UNSTATED instead, because what is missing here is the LENGTH OF BAR, and naming
  // the storey height alone would send a reader to a different question (L-MEA-08's roster).
  if (STOREY_HEIGHT_ABSENCE[height.standing] !== undefined) return { ok: false };
  return { ok: true, mm: height.value, source: height.sourceKey };
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
  // A bar longer than the stock bar is spliced, and each splice after the first costs one more lap:
  // the split's own laps are ADDED to the detail's, because both are steel in place (AM-03(a)).
  const split = stockSplitOf({ lengthMm: raw, lapMm: spec.lapMm, stockMm: STOCK_BAR_MM });
  const pieces = split.ok ? split.pieces : 1;
  const lapsPerBar = spec.lapsPerBar + (pieces - 1);
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
  const applied = applyDetailing(setup.detailing, EDITION, setup.edition.digest);

  for (const row of input.objects) {
    const memberClass = row.elementType as ElementType;
    if (!READ_CLASSES.includes(memberClass)) continue;

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

    const head = { row, class: memberClass, placement, calibration, variant, level, applied, fy: setup.detailing.fy };
    const unstated: { readonly variable: string; readonly code: RebarRefusalCode }[] = [];
    const bars: BarRow[] = [];

    const run = storeyRunOf(level);
    if (!run.ok) {
      // No run, no bar: the net and the laps are both DECLARED missing and the row is kept, because
      // "a row kept with no quantity is PARTIAL_DECLARED, never COMPLETE" (L-QTY-02).
      unstated.push({ variable: "net", code: "REBAR_STOREY_RUN_UNSTATED" }, { variable: "lap", code: "REBAR_STOREY_RUN_UNSTATED" });
      observations.push(observe("REBAR_STOREY_RUN_UNSTATED", row, placement.sourceEntity));
    } else {
      const mains = synthesiseVertical({
        storeyRunMm: run.mm,
        mains: zones.main.bars,
        detailing: applied,
        edition: EDITION,
        sourceKeys: [...zones.main.sourceKeys, run.source],
      });
      mains.forEach((spec, at) => bars.push(rowOf(spec, at, head)));
      // A grade the applied edition holds no ℓd row for leaves the lap underivable while the net the
      // schedule stated is still steel: the lap alone is declared missing (AM-03(f), L-QTY-02).
      if (mains.some((spec) => spec.lapsPerBar === 0)) unstated.push({ variable: "lap", code: "DETAILING_ROW_NOT_IN_EDITION" });
    }

    // The tie zones state a SPACING and no length to run it over — "the registry states spacing,
    // never a zone length" — so the confinement steel is a component nobody has read, omitted by
    // name rather than derived from a confinement rule nobody wrote down (L-QTY-02, riskNotes (5)).
    const links = linksOf(zones.ties, variant, head, run.ok ? run.mm : null);
    if (links.length === 0) unstated.push({ variable: "ties", code: "REBAR_TIE_ZONE_UNSTATED" });
    links.forEach((spec, at) => bars.push(rowOf(spec, at, head)));

    reads.push({ ...head, bars, unstated });
  }

  return { reads, observations };
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
    if (bar.role === "TIE" || bar.role === "STIRRUP" || bar.role === "SPIRAL") ties = ties.add(exact(bar.kg));
    else {
      net = net.add(exact(bar.kgNet));
      lap = lap.add(exact(bar.kgLap));
    }
  }
  return { net: net.toString(), lap: lap.toString(), ties: ties.toString() };
}

export type { AppliedDetailing, MemberRead };
export { EDITION as REBAR_EDITION, lapLengthFor };
