// L-FRM-05's detailing rules, as the versioned DATA they are: the edition `BNBC2020_BD @ 2026.07`.
//
// The edition is a resolver-role method pair (L-MEA-01) rather than a `ruleset_editions` row: what
// the manifest digest keys is parameter VALUES, and a table of ℓd rows is method data — so the pair
// is hashed whole into `rebar.methods.json` and a platform edition cites it by (rule id, version).
//
// Nothing here converts a reading and nothing here decides a bar: this file answers what the law
// states, and `synthesis.ts` decides what to do with the answer. Every lookup answers rather than
// throws — AM-03(f)'s fy 500 rows are the edition's, and a grade the table has no row for is a
// DISCLOSURE (`DETAILING_ROW_NOT_IN_EDITION`), never a row scaled from a neighbouring one.

import type { ElementType } from "../../../catalogue/classes";
import { exact } from "../../../units/canon";
import type { ResolverMethod } from "../law";

/** The name and version this edition is cited by, wherever a bar row records what it was cut under. */
export const EDITION_IDENTITY = Object.freeze({ name: "BNBC2020_BD", version: "2026.07" } as const);

/** The grades the ℓd table holds rows for: L-FRM-05's own 420, and AM-03(f)'s 500. */
export type EditionFy = 420 | 500;

/** The concrete strengths the table is stated at, in psi — a probe clamps to the row at-or-below. */
export type EditionFcPsi = 3000 | 3500 | 4000;

/** The two diameter columns of every row: 19 mm or less, and 20 mm or more (L-FRM-05). */
export type LdColumns = readonly [small: number, large: number];

/** One row of the ℓd table, in multiples of d_b, for confined cover and for everything else. */
export type LdRow = {
  readonly fyMPa: EditionFy;
  readonly fcPsi: EditionFcPsi;
  readonly confined: LdColumns;
  readonly otherwise: LdColumns;
};

/** The three hook angles L-FRM-05 states an extension for, and AM-03(g) fixes the stirrup's. */
export type HookAngle = 90 | 135 | 180;

/** The diameters the verified kg/m lookup holds a rate for (L-FRM-05's eleven rows). */
export type EditionDiameter = 8 | 10 | 12 | 16 | 20 | 22 | 25 | 28 | 32 | 36 | 40;

/** The classes L-FRM-05 states a nominal cover for. */
export type CoveredClass = Extract<ElementType, "beam" | "column" | "shear_wall" | "slab" | "footing" | "pile_cap" | "pile">;

/**
 * One detailing edition, whole: the ℓd table, the laps, the hooks, the covers, the unit weights, the
 * bend radii, the stock bar, and the two allowances AM-03(a) confines to resource outputs.
 *
 * It is a plain value on purpose — a rail reads it, a bar row cites the digest it was derived under,
 * and nothing mutates it (the resolver freezes it whole).
 */
export type DetailingEdition = {
  readonly identity: typeof EDITION_IDENTITY;
  readonly fyDefaultMPa: 420;
  readonly fcDefaultPsi: 3000;
  readonly ld: readonly LdRow[];
  readonly topBarFactor: 1.3;
  readonly ldFloorMm: 300;
  readonly lap: {
    readonly A: 1.0;
    readonly B: 1.3;
    readonly default: "B";
    readonly floorMm: 300;
    readonly compressionMultiplier: 30;
  };
  readonly hooks: Readonly<Record<HookAngle, { readonly multiplier: number; readonly minimumMm: number }>>;
  readonly isAdditive: {
    readonly allowance: Readonly<Record<90 | 135 | 180, number>>;
    readonly deduction: Readonly<Record<45 | 90 | 135 | 180, number>>;
  };
  readonly coverMm: Readonly<Record<CoveredClass, number>>;
  readonly kgPerMetre: Readonly<Record<EditionDiameter, string>>;
  readonly bendRadius: { readonly upToMm: 16; readonly small: 2; readonly large: 3.5 };
  readonly STOCK_BAR_MM: 12000;
  readonly roundingMm: 25;
  readonly wastageFraction: "0.03";
  readonly bindingWireKgPerTonne: 8;
};

/**
 * What a lookup answers when the edition holds no row for the grade it was asked about: the code, so
 * the rail omits the component by name (L-QTY-02) instead of scaling a row that says something else.
 */
export type NoRow = { readonly ok: false; readonly code: "DETAILING_ROW_NOT_IN_EDITION" };

/** A multiplier off the ℓd table, in multiples of d_b, or the disclosure that no row holds it. */
export type LdMultiplierAnswer = { readonly ok: true; readonly multiplier: number } | NoRow;

/** A development length in millimetres, or the same disclosure the multiplier carries. */
export type DevelopmentLengthAnswer = { readonly ok: true; readonly mm: number } | NoRow;

/** What a caller asks the ℓd table: the grade, the mix, the bar, its confinement and its position. */
export type LdProbe = {
  readonly fyMPa: number;
  readonly fcPsi: number;
  readonly diameterMm: number;
  readonly confined: boolean;
  readonly top: boolean;
};

/** How many psi one MPa is, for a note that states f'c the other way about (L-FRM-05 reads psi). */
export const PSI_PER_MPA = "145.038";

/** The largest bar the small-diameter column of the ℓd table covers (L-FRM-05: "≤19 / ≥20 mm"). */
const SMALL_COLUMN_UP_TO_MM = 19;

/** The code every lookup of this edition discloses an unheld row by (`REBAR_REFUSALS`). */
const ROW_NOT_IN_EDITION: NoRow = Object.freeze({ ok: false, code: "DETAILING_ROW_NOT_IN_EDITION" } as const);

/**
 * L-FRM-05's ℓd table for fy 420, and AM-03(f)'s fy 500 rows beside it, in multiples of d_b.
 *
 * The fy 500 rows are the law's own figures, not a scaling done here: AM-03(f) states them, and a
 * grade outside the two row sets is answered `DETAILING_ROW_NOT_IN_EDITION` rather than scaled.
 */
const LD_TABLE: readonly LdRow[] = Object.freeze([
  { fyMPa: 420, fcPsi: 3000, confined: [44, 54], otherwise: [66, 83] },
  { fyMPa: 420, fcPsi: 3500, confined: [41, 50], otherwise: [61, 78] },
  { fyMPa: 420, fcPsi: 4000, confined: [38, 47], otherwise: [57, 72] },
  { fyMPa: 500, fcPsi: 3000, confined: [52, 64], otherwise: [79, 99] },
  { fyMPa: 500, fcPsi: 3500, confined: [49, 60], otherwise: [73, 93] },
  { fyMPa: 500, fcPsi: 4000, confined: [45, 56], otherwise: [68, 86] },
] as const satisfies readonly LdRow[]);

/** The edition itself, frozen whole so every consumer reads the same rows (L-MEA-01). */
const EDITION: DetailingEdition = Object.freeze({
  identity: EDITION_IDENTITY,
  fyDefaultMPa: 420,
  fcDefaultPsi: 3000,
  ld: LD_TABLE,
  topBarFactor: 1.3,
  ldFloorMm: 300,
  lap: Object.freeze({ A: 1.0, B: 1.3, default: "B", floorMm: 300, compressionMultiplier: 30 } as const),
  hooks: Object.freeze({
    90: Object.freeze({ multiplier: 12, minimumMm: 0 } as const),
    135: Object.freeze({ multiplier: 6, minimumMm: 75 } as const),
    180: Object.freeze({ multiplier: 4, minimumMm: 65 } as const),
  } as const),
  isAdditive: Object.freeze({
    allowance: Object.freeze({ 90: 12, 135: 10, 180: 9 } as const),
    deduction: Object.freeze({ 45: 1, 90: 2, 135: 3, 180: 4 } as const),
  } as const),
  coverMm: Object.freeze({ beam: 25, column: 40, shear_wall: 20, slab: 20, footing: 75, pile_cap: 75, pile: 75 } as const),
  kgPerMetre: Object.freeze({
    8: "0.395",
    10: "0.616",
    12: "0.888",
    16: "1.579",
    20: "2.466",
    22: "2.980",
    25: "3.854",
    28: "4.828",
    32: "6.313",
    36: "7.981",
    40: "9.864",
  } as const),
  bendRadius: Object.freeze({ upToMm: 16, small: 2, large: 3.5 } as const),
  STOCK_BAR_MM: 12000,
  roundingMm: 25,
  wastageFraction: "0.03",
  bindingWireKgPerTonne: 8,
} as const);

/** The stock bar every cutting list of this edition is cut from, in millimetres (L-FRM-05). */
export const STOCK_BAR_MM = EDITION.STOCK_BAR_MM;

/**
 * The row the probe stands on: an EXACT grade, and the f'c row AT OR BELOW the strength stated.
 *
 * The clamp is downward on purpose and the distinction matters: 3400 psi is nearer 3500, but reading
 * it there would shorten every ℓd and every lap derived from it. "Clamp f'c to the row at-or-below"
 * (L-FRM-05) is a bond rule, not a rounding one — below the first row the weakest row still governs.
 */
function rowFor(edition: DetailingEdition, fyMPa: number, fcPsi: number): LdRow | undefined {
  const graded = edition.ld.filter((row) => row.fyMPa === fyMPa);
  if (graded.length === 0) return undefined;
  const atOrBelow = graded.filter((row) => row.fcPsi <= fcPsi);
  return atOrBelow.length === 0 ? graded[0] : atOrBelow[atOrBelow.length - 1];
}

/**
 * The ℓd multiplier in multiples of d_b for one (grade, mix, bar, confinement, position) cell, or
 * the disclosure that this edition holds no row for the grade (AM-03(f)).
 */
export function ldMultiplierOf(edition: DetailingEdition, probe: LdProbe): LdMultiplierAnswer {
  const row = rowFor(edition, probe.fyMPa, probe.fcPsi);
  if (row === undefined) return ROW_NOT_IN_EDITION;
  const columns = probe.confined ? row.confined : row.otherwise;
  const base = probe.diameterMm <= SMALL_COLUMN_UP_TO_MM ? columns[0] : columns[1];
  return { ok: true, multiplier: probe.top ? base * edition.topBarFactor : base };
}

/**
 * The development length in millimetres: the cell's multiplier times the bar, never under the floor.
 * The top-bar factor reaches the LENGTH because it reaches the multiplier it is taken off.
 */
export function developmentLengthOf(edition: DetailingEdition, probe: LdProbe): DevelopmentLengthAnswer {
  const multiplier = ldMultiplierOf(edition, probe);
  if (!multiplier.ok) return multiplier;
  return { ok: true, mm: Math.max(multiplier.multiplier * probe.diameterMm, edition.ldFloorMm) };
}

/** Which class of lap a schedule states, where it states one (L-FRM-05, BNBC 2020 Part 6 Ch. 8). */
export type LapClass = "A" | "B";

/**
 * A lap length: its class times the development length it is taken off, floored at 300 mm. The
 * diameter is carried so a caller reads one signature for every lap; the floor is what uses it.
 */
export function lapLengthOf(edition: DetailingEdition, probe: { readonly diameterMm: number; readonly ldMm: number; readonly class: LapClass }): number {
  return Math.max(edition.lap[probe.class] * probe.ldMm, edition.lap.floorMm);
}

/**
 * A hook's extension beyond the bend: 90° = 12d, 180° = max(4d, 65 mm), and the 135° stirrup or tie
 * hook = max(6d, 75 mm) — AM-03(g)'s default, which a drawing's own note may override.
 */
export function hookExtensionOf(edition: DetailingEdition, probe: { readonly angle: HookAngle; readonly diameterMm: number }): number {
  const hook = edition.hooks[probe.angle];
  return Math.max(hook.multiplier * probe.diameterMm, hook.minimumMm);
}

/** The nominal cover L-FRM-05 states for one class, in millimetres. */
export function coverOf(edition: DetailingEdition, elementType: CoveredClass): number {
  return edition.coverMm[elementType];
}

/**
 * Tie spacing: the least of 16 longitudinal diameters, 48 tie diameters and the least section side.
 *
 * The edition is carried so every lookup of this module reads one signature — the rule itself is
 * L-FRM-05's own arithmetic over the bars, and the edition holds no parameter it turns on.
 */
export function tieSpacingOf(
  _edition: DetailingEdition,
  probe: { readonly longitudinalMm: number; readonly tieMm: number; readonly leastDimensionMm: number },
): number {
  return Math.min(16 * probe.longitudinalMm, 48 * probe.tieMm, probe.leastDimensionMm);
}

/** Is this a diameter the verified unit-weight lookup holds a rate for? */
function isEditionDiameter(edition: DetailingEdition, diameterMm: number): diameterMm is EditionDiameter {
  return Object.hasOwn(edition.kgPerMetre, String(diameterMm));
}

/**
 * The unit weight that BILLS, in kg/m (AM-03(b): "the table bills; d²/162 checks"). A diameter the
 * table has no row for is not billable at all, so it is a defect rather than an answer — every
 * diameter a schedule can state stands in the table, and a rail never invents a rate.
 */
export function kgPerMetreOf(edition: DetailingEdition, diameterMm: number): string {
  if (!isEditionDiameter(edition, diameterMm)) throw new Error(`no kg/m rate for a ${diameterMm} mm bar in ${edition.identity.name} @ ${edition.identity.version}`);
  return edition.kgPerMetre[diameterMm];
}

/** The internal bend radius in millimetres: 2d up to 16 mm, 3.5d above it (L-FRM-05). */
export function bendRadiusOf(edition: DetailingEdition, diameterMm: number): number {
  return (diameterMm <= edition.bendRadius.upToMm ? edition.bendRadius.small : edition.bendRadius.large) * diameterMm;
}

/**
 * An f'c as the ℓd table reads one — psi. A drawing that states the mix in MPa is CARRIED here,
 * once, before any clamp: the clamp is to a row at-or-below, and a strength compared in the wrong
 * unit would land on a row the drawing never meant (L-FRM-05).
 */
export function fcPsiOf(value: string, unit: string): number {
  const said = exact(value);
  return unit.trim().toLowerCase() === "mpa" ? said.mul(exact(PSI_PER_MPA)).toNumber() : said.toNumber();
}

/**
 * The pair that resolves the edition (L-MEA-01: "resolvers are code, enumerated by (rule id,
 * version), hashed whole into a committed manifest").
 */
export const DETAILING_BNBC2020_BD: ResolverMethod = Object.freeze({
  role: "resolver",
  ruleId: `detailing.${EDITION_IDENTITY.name}`,
  version: EDITION_IDENTITY.version,
  resolve: (): DetailingEdition => EDITION,
});
