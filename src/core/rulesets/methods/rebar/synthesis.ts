// Synthesis: what bars a member class HOLDS, given what its schedule states (R-TO-032, L-FRM-05).
//
// Every function here is pure and answers `BarSpec`s — a role, a shape, its legs, how many of it,
// and the lap it is spliced at. Nothing reaches a store, nothing rounds and nothing bills: the
// cutting length is `bs8666.ts`'s, the splitting is `stock.ts`'s and the mass is `mass.ts`'s. What
// this file decides is DETAILING — where a bar starts, where it ends, and how many of it there are.
//
// The detailing a member is synthesised under arrives as an `AppliedDetailing`: the drawing's own
// note where it states one, and the applied edition's clause where it does not (L-MEA-06 — "a
// citable clause is DERIVED, not DEFAULTED"). Where a note states a grade the edition holds no ℓd
// row for, the lap is an ANSWER rather than a length scaled off a neighbouring row (AM-03(f)).

import type { DetailingSetup } from "@/core/offers/contract";
import type { QuantityBasis } from "@/core/offers/law";
import { exact } from "@/core/units/canon";
import type { ResolverMethod } from "../law";
import type { ShapeCode } from "./bs8666";
import { stockSplitOf } from "./stock";
import {
  developmentLengthOf,
  fcPsiOf,
  hookExtensionOf,
  lapLengthOf,
  STOCK_BAR_MM,
  type DetailingEdition,
  type NoRow,
} from "./detailing-bnbc2020-bd";

/** The roles a synthesised bar stands in — what the bar is FOR, on the schedule's own words. */
export const BAR_ROLES = ["MAIN", "SIDE", "TIE", "STIRRUP", "EXTRA_TOP", "EXTRA_BOTTOM", "DISTRIBUTION", "HORIZONTAL", "SPIRAL"] as const;

/** One bar role, drawn from the closed roster above. */
export type BarRole = (typeof BAR_ROLES)[number];

/** Is this a role a bar row may stand in? Asked wherever a role arrives as text. */
export function isBarRole(value: unknown): value is BarRole {
  return typeof value === "string" && (BAR_ROLES as readonly string[]).includes(value);
}

/**
 * How many ends of a bar of each role are ANCHORED into what supports it. A main bar develops at
 * both ends, a distribution bar at one, and a link or a tie closes on its own hooks rather than
 * anchoring into anything — which is why the last two take no development length at all.
 */
export const ANCHORAGE_ENDS: Readonly<Record<"MAIN" | "DISTRIBUTION" | "STIRRUP" | "TIE", number>> = Object.freeze({ MAIN: 2, DISTRIBUTION: 1, STIRRUP: 0, TIE: 0 });

/** One synthesised bar: what it is, how it is cut, how many of it, and how it is spliced. */
export type BarSpec = {
  readonly role: BarRole;
  readonly diameterMm: number;
  readonly shape: ShapeCode;
  readonly legsMm: readonly string[];
  readonly barsPerUnit: number;
  readonly lapMm: string;
  readonly lapsPerBar: number;
  readonly sourceKeys: readonly string[];
};

/**
 * The detailing one campaign applies, resolved once: the grade and the mix in force, the lap
 * multiplier a note stated (null where none did), the 135° hook the ties are bent to, and how all of
 * it was KNOWN — TRANSCRIBED where a drawing said it, DERIVED off the applied edition's clause.
 */
export type AppliedDetailing = {
  readonly fyMPa: number;
  readonly fcPsi: number;
  readonly lapMultiplier: number | null;
  readonly hook135: { readonly multiplier: number; readonly minimumMm: number };
  readonly basis: QuantityBasis;
  readonly sourceKeys: readonly string[];
  readonly editionDigest: string;
};

/**
 * What the campaign applies, given what its notes said and what its edition states.
 *
 * A note's value is taken VERBATIM — the drawing outranks the clause (L-QTY-01) — and the basis is
 * TRANSCRIBED the moment any half of it was read off a drawing. A half nobody read falls back to the
 * edition, which is a citable clause and therefore DERIVED rather than defaulted (L-MEA-06). The
 * mix is carried to psi before anything clamps to a row, because the table is stated in psi.
 */
export function applyDetailing(setup: DetailingSetup, edition: DetailingEdition, editionDigest: string): AppliedDetailing {
  const transcribed = setup.fy !== null || setup.fc !== null || setup.lapMultiplier !== null || setup.hookExtension !== null;
  const hook = setup.hookExtension;
  return {
    fyMPa: setup.fy === null ? edition.fyDefaultMPa : Number(setup.fy.value),
    fcPsi: setup.fc === null ? edition.fcDefaultPsi : fcPsiOf(setup.fc.value, setup.fc.unit),
    lapMultiplier: setup.lapMultiplier,
    hook135: {
      multiplier: hook?.multiplier ?? edition.hooks[135].multiplier,
      minimumMm: hook?.minimumMm ?? edition.hooks[135].minimumMm,
    },
    basis: transcribed ? "TRANSCRIBED" : "DERIVED",
    sourceKeys: setup.sourceKeys,
    editionDigest,
  };
}

/** A length the detailing answers, or the disclosure that the applied edition holds no row for it. */
export type LengthAnswer = { readonly ok: true; readonly mm: string } | NoRow;

/** Where one bar of the member sits, as the ℓd table asks it: confined cover, and top-cast or not. */
export type BarPosition = {
  readonly diameterMm: number;
  readonly confined: boolean;
  readonly top: boolean;
};

/**
 * The lap ONE bar is spliced at.
 *
 * A note that states `LAP 50d` is applied verbatim — 50 × d and nothing else, with ℓd never
 * consulted for it (riskNotes (3)). With no note, the edition's default Class B lap is derived off
 * ℓd for the applied grade and mix, floored at 300 mm. And where the applied grade has no row at
 * all, the answer is the code: a lap scaled off the 420 row would be a length nobody stated.
 */
export function lapLengthFor(applied: AppliedDetailing, edition: DetailingEdition, at: BarPosition): LengthAnswer {
  if (applied.lapMultiplier !== null) return { ok: true, mm: exact(applied.lapMultiplier).mul(exact(at.diameterMm)).toString() };
  const ld = developmentLengthOf(edition, { fyMPa: applied.fyMPa, fcPsi: applied.fcPsi, diameterMm: at.diameterMm, confined: at.confined, top: at.top });
  if (!ld.ok) return ld;
  return { ok: true, mm: exact(lapLengthOf(edition, { diameterMm: at.diameterMm, ldMm: ld.mm, class: edition.lap.default })).toString() };
}

/** The development length one bar anchors over, or the same disclosure a lap carries. */
export function anchorageLengthFor(applied: AppliedDetailing, edition: DetailingEdition, at: BarPosition): LengthAnswer {
  const ld = developmentLengthOf(edition, { fyMPa: applied.fyMPa, fcPsi: applied.fcPsi, diameterMm: at.diameterMm, confined: at.confined, top: at.top });
  return ld.ok ? { ok: true, mm: exact(ld.mm).toString() } : ld;
}

/**
 * How many bars stand at `spacingMm` over `distanceMm`: the spaces that fit, plus the bar that closes
 * the last one. This is the ONE counting rule — every spaced group is counted through it.
 *
 * A MEASURED run is allowed half a millimetre before it is called short. A zone a drawing spaces at
 * 150 c/c and dimensions 1499.6 is a run of ten spaces detailed, not nine and a sliver: the tenth
 * space is missing by four tenths of a millimetre, which is the arithmetic of the cover and the
 * support faces the zone was struck between and not a space the detailer left out (L-QTY-01 — the
 * figure the drawing STATED is the spacing, and a count that dropped a bar to a rounding would be a
 * figure of ours). Beyond that half millimetre the part space carries no bar of its own.
 *
 * A caller whose distance is DERIVED rather than measured — a mat's width inside its own cover, which
 * is arithmetic to the last digit — states `toleranceMm` "0" and gets the plain floor: there is no
 * measurement there to be generous about.
 */
export function countBetween(distanceMm: string, spacingMm: string, toleranceMm = "0.5"): number {
  return exact(distanceMm).add(exact(toleranceMm)).div(exact(spacingMm)).floor().toNumber() + 1;
}

/* ------------------------------------------------------------------ the member classes */

/** What a vertical member's schedule states: the run it rises through, and its main-bar group. */
export type VerticalProbe = {
  readonly storeyRunMm: string;
  readonly mains: readonly { readonly n: number; readonly diameterMm: number }[];
  readonly detailing: AppliedDetailing;
  readonly edition: DetailingEdition;
  readonly sourceKeys?: readonly string[];
};

/**
 * A column's or a shear wall's verticals: straight bars of the storey run, one lap each.
 *
 * The bar runs floor to floor THROUGH the joint (L-MEA-09's vertical rule), so its cut length is the
 * storey height itself; the splice above the floor is one lap, billed as its own component beside
 * the net (AM-03(a)). A grade the edition holds no ℓd row for leaves the group out entirely — the
 * caller discloses it, because a vertical with no lap is not a vertical anybody detailed.
 */
export function synthesiseVertical(probe: VerticalProbe): readonly BarSpec[] {
  const bars: BarSpec[] = [];
  for (const group of probe.mains) {
    // A grade the edition holds no ℓd row for leaves the bar UNLAPPED rather than lapped at a length
    // scaled off another row: the steel the schedule states is still steel, and the lap the drawing
    // never let us derive is DECLARED missing by the caller (AM-03(f), L-QTY-02).
    const lap = lapLengthFor(probe.detailing, probe.edition, { diameterMm: group.diameterMm, confined: false, top: false });
    bars.push({
      role: "MAIN",
      diameterMm: group.diameterMm,
      shape: "00",
      legsMm: [exact(probe.storeyRunMm).toString()],
      barsPerUnit: group.n,
      lapMm: lap.ok ? lap.mm : "0",
      lapsPerBar: lap.ok ? 1 : 0,
      sourceKeys: probe.sourceKeys ?? [],
    });
  }
  return bars;
}

/** One zone of links: how far it runs, and what spacing it runs at. */
export type LinkZone = { readonly lengthMm: string; readonly spacingMm: string };

/** What a link's schedule states: the section it closes on, its cover, its bar, and its zones. */
export type LinkProbe = {
  readonly bMm: string;
  readonly dMm: string;
  readonly coverMm: number;
  readonly tieMm: number;
  readonly zones: readonly LinkZone[];
  readonly detailing: AppliedDetailing;
  readonly edition: DetailingEdition;
  readonly role?: Extract<BarRole, "TIE" | "STIRRUP">;
  readonly sourceKeys?: readonly string[];
};

/**
 * A closed link (shape 51): the four sides inside the cover, closed on two 135° hooks.
 *
 * The hook extension is the applied detailing's — AM-03(g) defaults it to max(6d, 75 mm) and a
 * drawing's own note overrides it. The count is the zones', added up: a link is counted where a
 * zone states a LENGTH, and a zone that states only a spacing is counted by nobody (L-QTY-01).
 */
export function synthesiseLink(probe: LinkProbe): readonly BarSpec[] {
  const inset = exact(probe.coverMm).mul(exact(2));
  const sideB = exact(probe.bMm).sub(inset);
  const sideD = exact(probe.dMm).sub(inset);
  const hook = exact(Math.max(probe.detailing.hook135.multiplier * probe.tieMm, probe.detailing.hook135.minimumMm));
  let count = 0;
  for (const zone of probe.zones) count += countBetween(zone.lengthMm, zone.spacingMm);
  if (count === 0) return [];
  return [
    {
      role: probe.role ?? "TIE",
      diameterMm: probe.tieMm,
      shape: "51",
      legsMm: [sideB.toString(), sideD.toString(), sideB.toString(), sideD.toString(), hook.toString(), hook.toString()],
      barsPerUnit: count,
      lapMm: "0",
      lapsPerBar: 0,
      sourceKeys: probe.sourceKeys ?? [],
    },
  ];
}

/** What a through bar's schedule states: the span it crosses, its group, and where it sits. */
export type ThroughBarProbe = {
  readonly spanMm: string;
  readonly diameterMm: number;
  readonly n: number;
  readonly top: boolean;
  readonly confined: boolean;
  readonly detailing: AppliedDetailing;
  readonly edition: DetailingEdition;
  readonly role?: BarRole;
  readonly sourceKeys?: readonly string[];
};

/**
 * A bar that runs the span and anchors at both ends: `span + 2 ℓd`, straight (shape 00), cut out of
 * the stock bar with the splices that takes counted.
 *
 * Both ends develop, because that is what `ANCHORAGE_ENDS.MAIN` says a main bar does — a bar that
 * stopped at the support face would not be developed there. And a bar the span makes longer than the
 * mill length is not one bar: it is n pieces lapped together, and every joint after the first is
 * billable bar-in-place rather than a percentage (L-BD-02, AM-03(a)). How many pieces is the stock
 * method's answer and not a second splitting rule written here (B-17, L-FRM-05's 12,000 mm stock).
 */
export function synthesiseThroughBar(probe: ThroughBarProbe): readonly BarSpec[] {
  const at: BarPosition = { diameterMm: probe.diameterMm, confined: probe.confined, top: probe.top };
  // The anchorage IS the bar's length here, so a grade with no ℓd row leaves nothing to cut: the bar
  // is not synthesised at all, and the caller declares the absence (L-QTY-01, AM-03(f)).
  const anchorage = anchorageLengthFor(probe.detailing, probe.edition, at);
  if (!anchorage.ok) return [];
  const lap = lapLengthFor(probe.detailing, probe.edition, at);
  const role = probe.role ?? "MAIN";
  // How many ends develop is the role's own fact, read off the one roster rather than decided again
  // here: a main bar anchors at both, a distribution bar at one, a link at neither (B-17). A role the
  // roster states nothing for anchors like a main bar, which is what a bar that runs a span does.
  const ends = ANCHORAGE_ENDS[role as keyof typeof ANCHORAGE_ENDS] ?? ANCHORAGE_ENDS.MAIN;
  const length = exact(probe.spanMm).add(exact(anchorage.mm).mul(exact(ends)));
  const lapMm = lap.ok ? lap.mm : "0";
  const split = stockSplitOf({ lengthMm: length.toString(), lapMm, stockMm: String(STOCK_BAR_MM) });
  return [
    {
      role,
      diameterMm: probe.diameterMm,
      shape: "00",
      legsMm: [length.toString()],
      barsPerUnit: probe.n,
      lapMm,
      lapsPerBar: split.ok ? split.pieces - 1 : 0,
      sourceKeys: probe.sourceKeys ?? [],
    },
  ];
}

/** What an extra top bar's schedule states: the clear span it is placed over, and its group. */
export type ExtraTopProbe = {
  readonly clearSpanMm: string;
  readonly diameterMm: number;
  readonly n: number;
  readonly role?: Extract<BarRole, "EXTRA_TOP" | "EXTRA_BOTTOM">;
  readonly sourceKeys?: readonly string[];
};

/**
 * An extra bar over a support: `2 × Ln/3`, a third of the clear span either side of it — the length
 * a curtailed top bar is detailed to, straight and anchored by the span it reaches into.
 */
export function synthesiseExtraTop(probe: ExtraTopProbe): readonly BarSpec[] {
  const length = exact(probe.clearSpanMm).div(exact(3)).mul(exact(2));
  return [
    {
      role: probe.role ?? "EXTRA_TOP",
      diameterMm: probe.diameterMm,
      shape: "00",
      legsMm: [length.toString()],
      barsPerUnit: probe.n,
      lapMm: "0",
      lapsPerBar: 0,
      sourceKeys: probe.sourceKeys ?? [],
    },
  ];
}

/** What a mat bar's plan states: the dimension it runs, the one it is spaced across, and its bar. */
export type MatBarProbe = {
  readonly dimMm: string;
  readonly distDimMm: string;
  readonly coverMm: number;
  readonly diameterMm: number;
  readonly spacingMm: string;
  readonly role?: BarRole;
  readonly sourceKeys?: readonly string[];
};

/**
 * One direction of a mat: a bar the width of the member inside its cover, hooked 12d at each end
 * (shape 21), spaced across the other direction inside the same cover.
 *
 * The count is the spaces inside the cover plus the closing bar — a mat's outermost bars sit at the
 * cover line, not beyond it. The distance it is counted over is struck here, not measured off a
 * drawing, so it is counted to the plain floor with none of the half millimetre a measured zone is
 * allowed: ⌊(distDim − 2c) ÷ spacing⌋ + 1.
 */
export function synthesiseMatBar(probe: MatBarProbe): readonly BarSpec[] {
  const inset = exact(probe.coverMm).mul(exact(2));
  const net = exact(probe.dimMm).sub(inset);
  const hook = exact(12).mul(exact(probe.diameterMm));
  const across = exact(probe.distDimMm).sub(inset);
  return [
    {
      role: probe.role ?? "MAIN",
      diameterMm: probe.diameterMm,
      shape: "21",
      legsMm: [hook.toString(), net.toString(), hook.toString()],
      barsPerUnit: countBetween(across.toString(), probe.spacingMm, "0"),
      lapMm: "0",
      lapsPerBar: 0,
      sourceKeys: probe.sourceKeys ?? [],
    },
  ];
}

/** What a cranked slab bar's plan states: the clear span, the slab's depth, and its group. */
export type SlabCrankProbe = {
  readonly clearSpanMm: string;
  readonly depthMm: string;
  readonly diameterMm: number;
  readonly n: number;
  readonly detailing: AppliedDetailing;
  readonly edition: DetailingEdition;
  readonly sourceKeys?: readonly string[];
};

/**
 * A cranked slab bar (shape CRK): the clear span, anchored ℓd at each end, with the two cranks
 * rising 0.42 D apiece — the geometry of a 45° crank through a slab of depth D.
 *
 * D is the depth the crank rises through, which is what the caller states: a slab's rows in
 * F-RCC6-BNBC crank 35.700 in a 125 mm slab and 46.200 in a 150 mm one, the 0.42 taken over the slab
 * inside its covers, and it is the member's reader that takes the cover off — this method cranks
 * through the depth it was given and invents no dimension of its own (L-QTY-01, AM-03(d)).
 */
export function synthesiseSlabCrank(probe: SlabCrankProbe): readonly BarSpec[] {
  const at: BarPosition = { diameterMm: probe.diameterMm, confined: false, top: false };
  const anchorage = anchorageLengthFor(probe.detailing, probe.edition, at);
  if (!anchorage.ok) return [];
  const lap = lapLengthFor(probe.detailing, probe.edition, at);
  const crank = exact(probe.depthMm).mul(exact("0.42"));
  const straight = exact(probe.clearSpanMm).add(exact(anchorage.mm).mul(exact(ANCHORAGE_ENDS.MAIN)));
  return [
    {
      role: "MAIN",
      diameterMm: probe.diameterMm,
      shape: "CRK",
      legsMm: [straight.toString(), crank.toString(), crank.toString()],
      barsPerUnit: probe.n,
      lapMm: lap.ok ? lap.mm : "0",
      lapsPerBar: 0,
      sourceKeys: probe.sourceKeys ?? [],
    },
  ];
}

/** The pair that synthesises a member's bars (L-MEA-01). */
export const REBAR_SYNTHESIS: ResolverMethod = Object.freeze({
  role: "resolver",
  ruleId: "rcc.rebar.synthesis",
  version: "1",
  resolve: (probe: VerticalProbe): readonly BarSpec[] => synthesiseVertical(probe),
});

/** The hook extension a bar of `diameterMm` takes at one of the edition's angles (L-FRM-05). */
export function hookOf(edition: DetailingEdition, angle: 90 | 135 | 180, diameterMm: number): number {
  return hookExtensionOf(edition, { angle, diameterMm });
}
