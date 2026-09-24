// `rcc.rebar.synthesis@2`: what bars a member class HOLDS, with a column's ties derived from BNBC 2020
// under D-003 and a stated lap bound outside the grade and mix contest (R6b; s-bbs I-656, I-657).
//
// @1 (`./synthesis.ts`) stands untouched beside this file and is still the code every edition that
// cites it runs: an edition cites a (rule id, version) pair, and a pinned campaign re-measured under
// its own edition writes the bars it always wrote (L-MEA-01, L-REG-07). What this version changes is
// two things and nothing else:
//
// 1. THE TIES OF A COLUMN (D-003). A column schedule states a tie spacing pair (`10Ø@100/150`) and no
//    length for either zone; @1 declares the ties missing (`REBAR_TIE_ZONE_UNSTATED`). This version
//    derives the zones from the code the drawing is detailed under: the end zones ℓo = max(largest
//    section side, clear/6, 450) at each joint face (BNBC 2020 §8.3.10.5(a)), the joint zone through
//    the depth of the deepest framing member (§6.4.9.2), and the middle at the second spacing. The
//    joint zone is never shallower than 450, the golden's own reading of a joint no framing deepens
//    (I-605, W-28 GC-4), and a column whose clear height fits inside its two end zones is tied at the
//    end spacing throughout (GC-1).
//
//    The joint depth is rarely known exactly: the framing the partition placed gives a LOWER bound
//    D_lo (s-bbs I-413), and the count N(D) is not monotonic in D. So a bounded joint is counted at
//    the fewest sets any depth in [D_lo, h) could need — the exact minimum of N over the whole open
//    interval, D_lo itself and the last interval included — which is never over the true count
//    whatever the joint's true depth is (L-QTY-04: over-measurement is a hard block).
//
// 2. A STATED LAP binds outside the FY and FC contest (I-308's R2). A note that states `LAP 50d` is
//    the lap, verbatim, and ℓd is never consulted for it (L-BD-02); a contest about the grade or the
//    mix — which only ℓd reads — no longer suspends a lap nobody derives from them. A contested LAP
//    note still states nothing.
//
// Every function is pure and answers `BarSpec`s or counts; the cutting length is `bs8666.ts`'s, the
// closed link's legs are @1's `synthesiseLink`, and every zone is counted by @1's `countBetween` — the
// one counting rule (B-17).

import { exact } from "@/core/units/canon";
import type { ResolverMethod } from "../law";
import type { DetailingEdition } from "./detailing-bnbc2020-bd";
import {
  countBetween,
  lapLengthFor as lapLengthForV1,
  synthesiseLink,
  type AppliedDetailing,
  type BarPosition,
  type BarSpec,
  type LengthAnswer,
  type LinkZone,
  type VerticalProbe,
} from "./synthesis";
import { NOTE_STANDING_ABSENCE, type NoteContestedCode } from "@/core/notes/law";

/** The version this file implements — the pair it is cited under is `rcc.rebar.synthesis@2`. */
export const SYNTHESIS_V2_VERSION = "2";

/**
 * The shallowest joint zone a column is tied through: 450 mm, where the framing at its top is no
 * deeper (the golden's I-605, W-28 GC-4; §8.3.10.5(a)(iii)'s own floor on ℓo). §6.4.9.2 asks the
 * joint's ties "for a depth not less than that of the deepest connection", so a 450 zone over a
 * shallower member is lawful and never short.
 */
export const TIE_JOINT_FLOOR_MM = "450";

/** The floor BNBC 2020 §8.3.10.5(a)(iii) puts under the end zone ℓo. */
export const TIE_END_ZONE_FLOOR_MM = "450";

/** The clauses a derived tie count stands on, cited beside the line that bills it (D-003). */
export const TIE_CLAUSES: readonly string[] = Object.freeze(["BNBC 2020 §8.3.10.5(a)", "BNBC 2020 §6.4.9.2"]);

/**
 * The lap ONE bar is spliced at, under R2 (I-308): a contested LAP note states nothing; a stated
 * multiplier is the lap, whatever the grade and mix readings say, because ℓd is never consulted for
 * it; and with no stated lap the lap is derived off ℓd exactly as @1 derives it — which is where the
 * grade and mix contest still bites, since that is the only path that reads them.
 */
export function lapLengthFor(applied: AppliedDetailing, edition: DetailingEdition, at: BarPosition): LengthAnswer {
  if (applied.suspended.includes("LAP")) return { ok: false, code: NOTE_STANDING_ABSENCE.SUSPENDED as NoteContestedCode };
  if (applied.lapMultiplier !== null) return { ok: true, mm: exact(applied.lapMultiplier).mul(exact(at.diameterMm)).toString() };
  return lapLengthForV1(applied, edition, at);
}

/**
 * A column's or a shear wall's verticals: straight bars of the storey run, one lap each — @1's rule
 * with this version's lap (R2). A lap that cannot be derived leaves the bar unlapped, and the caller
 * declares the missing component by the disclosure's own code (L-QTY-02).
 */
export function synthesiseVertical(probe: VerticalProbe): readonly BarSpec[] {
  return probe.mains.map((group) => {
    const lap = lapLengthFor(probe.detailing, probe.edition, { diameterMm: group.diameterMm, confined: false, top: false });
    return {
      role: "MAIN",
      diameterMm: group.diameterMm,
      shape: "00",
      legsMm: [exact(probe.storeyRunMm).toString()],
      barsPerUnit: group.n,
      lapMm: lap.ok ? lap.mm : "0",
      lapsPerBar: lap.ok ? 1 : 0,
      sourceKeys: probe.sourceKeys ?? [],
    };
  });
}

/* ------------------------------------------------------------------ the column's ties (D-003) */

/** What a column's tie count turns on: its storey run, its section, and the two spacings stated. */
export type TieCountProbe = {
  readonly storeyRunMm: string;
  readonly bMm: string;
  readonly dMm: string;
  readonly endSpacingMm: string;
  readonly midSpacingMm: string;
};

/**
 * The joint a column's ties are counted through. RESOLVED is a depth read outright (a proof states
 * it; the product's joint seam never answers it, s-bbs I-413); BOUNDED is D_lo, a lower bound.
 */
export type TieJoint = { readonly standing: "RESOLVED" | "BOUNDED"; readonly depthMm: string };

/** The larger of two exact decimals, as text. */
function larger(left: string, right: string): string {
  return exact(left).gte(exact(right)) ? left : right;
}

/**
 * The tie zones of a column tied through a joint zone `jointMm` deep (already floored at 450): two
 * end zones ℓo at the end spacing, the middle at the middle spacing, and the joint at the end
 * spacing — or ONE run at the end spacing over the whole storey where the clear height fits inside
 * the two end zones, or where the two spacings are one (GC-1).
 */
export function tieZonesAt(probe: TieCountProbe, jointMm: string): readonly LinkZone[] {
  const h = exact(probe.storeyRunMm);
  const clear = h.sub(exact(jointMm));
  const largest = larger(larger(probe.bMm, probe.dMm), TIE_END_ZONE_FLOOR_MM);
  const lo = exact(larger(largest, clear.div(exact(6)).toString()));
  if (exact(probe.endSpacingMm).eq(exact(probe.midSpacingMm)) || clear.lte(lo.mul(exact(2)))) {
    return [{ lengthMm: h.toString(), spacingMm: probe.endSpacingMm }];
  }
  return [
    { lengthMm: lo.toString(), spacingMm: probe.endSpacingMm },
    { lengthMm: lo.toString(), spacingMm: probe.endSpacingMm },
    { lengthMm: clear.sub(lo.mul(exact(2))).toString(), spacingMm: probe.midSpacingMm },
    { lengthMm: exact(jointMm).toString(), spacingMm: probe.endSpacingMm },
  ];
}

/** How many tie sets stand in those zones — every zone counted by the ONE counting rule (B-17). */
function setsIn(zones: readonly LinkZone[]): number {
  return zones.reduce((sum, zone) => sum + countBetween(zone.lengthMm, zone.spacingMm), 0);
}

/** N(D): the tie sets of a column whose deepest framing is `depthMm` deep (the joint floored at 450). */
export function tieSetsAt(probe: TieCountProbe, depthMm: string): number {
  return setsIn(tieZonesAt(probe, larger(depthMm, TIE_JOINT_FLOOR_MM)));
}

/**
 * Every joint depth in (from, h) at which N can change: where ℓo turns from the section to clear/6,
 * where the member turns to one run, and where any zone's count steps (a zone length crossing
 * k × spacing − ½ mm, the half millimetre `countBetween` allows). Each is an exact decimal, so the
 * search below is exact rather than sampled.
 */
function breakpoints(probe: TieCountProbe, from: string): string[] {
  const h = exact(probe.storeyRunMm);
  const se = exact(probe.endSpacingMm);
  const sm = exact(probe.midSpacingMm);
  const largest = exact(larger(larger(probe.bMm, probe.dMm), TIE_END_ZONE_FLOOR_MM));
  const half = exact("0.5");
  const held = [h.sub(largest.mul(exact(6))), h.sub(largest.mul(exact(2)))];
  const steps = h.div(se.lt(sm) ? se : sm).ceil().toNumber() + 1;
  for (let k = 0; k <= steps; k += 1) {
    const end = se.mul(exact(k)).sub(half);
    const mid = sm.mul(exact(k)).sub(half);
    // the joint zone's own count; the end zones where ℓo is clear/6; the middle where ℓo is the section
    // side, and where ℓo is clear/6 (the middle is then two thirds of the clear height)
    held.push(end, h.sub(end.mul(exact(6))), h.sub(largest.mul(exact(2))).sub(mid), h.sub(mid.mul(exact("1.5"))));
  }
  const floor = exact(from);
  const within = held.filter((point) => point.gt(floor) && point.lt(h));
  return [...new Set(within.map((point) => point.toString()))].sort((left, right) => (exact(left).lt(exact(right)) ? -1 : exact(left).gt(exact(right)) ? 1 : 0));
}

/** The fewest tie sets a column can hold under a joint, and a joint depth that attains it. */
export type NeverOverTies = { readonly sets: number; readonly jointMm: string };

/**
 * The tie sets a column is published at under D-003.
 *
 * RESOLVED counts N at the depth read (floored at 450). BOUNDED counts the exact MINIMUM of N over
 * every joint depth the bound leaves open, [max(D_lo, 450), h): D_lo itself, every breakpoint, one
 * depth inside every open interval between them, and one inside the last interval up to h. N is
 * constant inside each interval, so this is the minimum over the whole range and not a sample of it.
 * Whatever the joint's true depth, the true count is at least this — never over (L-QTY-04).
 */
export function tieSetsNeverOver(probe: TieCountProbe, joint: TieJoint): NeverOverTies {
  const from = larger(joint.depthMm, TIE_JOINT_FLOOR_MM);
  if (joint.standing === "RESOLVED" || exact(from).gte(exact(probe.storeyRunMm))) return { sets: setsIn(tieZonesAt(probe, from)), jointMm: from };
  const points = [from, ...breakpoints(probe, from)];
  const candidates = [...points];
  const ends = [...points, probe.storeyRunMm];
  for (let at = 0; at + 1 < ends.length; at += 1) candidates.push(exact(ends[at] as string).add(exact(ends[at + 1] as string)).div(exact(2)).toString());
  let best: NeverOverTies | null = null;
  for (const jointMm of candidates) {
    const sets = setsIn(tieZonesAt(probe, jointMm));
    if (best === null || sets < best.sets || (sets === best.sets && exact(jointMm).lt(exact(best.jointMm)))) best = { sets, jointMm };
  }
  return best as NeverOverTies;
}

/** What a column's derived ties are synthesised from: the count probe, the joint, and the tie itself. */
export type ColumnTieProbe = TieCountProbe & {
  readonly joint: TieJoint;
  readonly coverMm: number;
  readonly tieMm: number;
  readonly detailing: AppliedDetailing;
  readonly edition: DetailingEdition;
  readonly sourceKeys?: readonly string[];
};

/**
 * A column's closed ties (shape 51), counted under D-003: the zones at the joint depth that attains
 * the never-over count, closed on @1's link (the four sides inside the cover and two 135° hooks).
 */
export function synthesiseColumnTies(probe: ColumnTieProbe): { readonly bars: readonly BarSpec[]; readonly count: NeverOverTies } {
  const count = tieSetsNeverOver(probe, probe.joint);
  const bars = synthesiseLink({
    bMm: probe.bMm,
    dMm: probe.dMm,
    coverMm: probe.coverMm,
    tieMm: probe.tieMm,
    zones: tieZonesAt(probe, count.jointMm),
    detailing: probe.detailing,
    edition: probe.edition,
    role: "TIE",
    sourceKeys: probe.sourceKeys ?? [],
  });
  return { bars, count };
}

/** The pair that synthesises a member's bars at this version (L-MEA-01). */
export const REBAR_SYNTHESIS_V2: ResolverMethod = Object.freeze({
  role: "resolver",
  ruleId: "rcc.rebar.synthesis",
  version: SYNTHESIS_V2_VERSION,
  resolve: (probe: VerticalProbe): readonly BarSpec[] => synthesiseVertical(probe),
});
