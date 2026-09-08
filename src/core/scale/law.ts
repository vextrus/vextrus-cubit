// L-MEA-05's scale law, as values: the four ranks in the one precedence the clause fixes, the closed
// unit lane a factor is carried into metres by, the 12-place half-even rendering a factor is spoken
// in, and the content address a calibration is named by. Pure — no store, no clock — because a law
// that needs a store to answer is not one (ARCH-02, B-17).
//
// This file is the roster half of the law, kept free of every other core module but the one digest
// home so the seam's table definitions can close their columns over it without a cycle: the store's
// CHECK on a rank and on a factor's shape are written from `SCALE_RANKS` and `FACTOR_PATTERN` here,
// the way `DISCIPLINES` closes `sheet_disciplines` (B-17).
import { createHash } from "node:crypto";
import Decimal from "decimal.js";
import { canonical } from "../acts/consequence";

/**
 * The precedence, strongest first: "QS two-point › grid-spacing match › overridden dimension ratio
 * › file units header" (L-MEA-05). The order of this roster IS the precedence — `precedenceOf` reads
 * it off the index rather than off a second list beside it.
 */
export const SCALE_RANKS = ["QS_TWO_POINT", "GRID_SPACING", "DIMENSION_RATIO", "FILE_UNITS"] as const;

/** One rank, drawn from the closed roster above. */
export type ScaleRank = (typeof SCALE_RANKS)[number];

/** Where a rank stands in the precedence: 1 is the strongest. */
export type ScalePrecedence = 1 | 2 | 3 | 4;

/** The ranks a machine reads for itself — everything but the person's own observation (R-TO-020). */
export type MachineScaleRank = Exclude<ScaleRank, "QS_TWO_POINT">;

/** The rank a person's two-point observation stands at, spelled once as a member of the roster. */
export const QS_TWO_POINT = "QS_TWO_POINT" satisfies ScaleRank;

/** Is this value one of the four ranks? Asked wherever a rank arrives as text — a row, a wire. */
export function isScaleRank(value: unknown): value is ScaleRank {
  return typeof value === "string" && (SCALE_RANKS as readonly string[]).includes(value);
}

/** The precedence of a rank, read off the roster's own order (L-MEA-05). */
export function precedenceOf(rank: ScaleRank): ScalePrecedence {
  const index = SCALE_RANKS.indexOf(rank);
  if (index === -1) throw new Error(`"${String(rank)}" is not a rank of L-MEA-05's precedence`);
  return (index + 1) as ScalePrecedence;
}

/**
 * The candidate standing at the strongest rank present, or null for none: L-MEA-05's membership is
 * positive, never residual, so an empty set is no scale rather than a default one. Ties keep the
 * first offered, so a caller that offers one candidate per rank gets exactly that rank's.
 */
export function strongestOf<T extends { readonly rank: ScaleRank }>(candidates: readonly T[]): T | null {
  let strongest: T | null = null;
  for (const candidate of candidates) {
    if (strongest === null || precedenceOf(candidate.rank) < precedenceOf(strongest.rank)) strongest = candidate;
  }
  return strongest;
}

/**
 * The closed unit lane: the header spellings a factor can be carried into metres by, and the units a
 * person may enter a distance in (L-CAD-02's `$INSUNITS` map, less `unitless`, which is a code and
 * not a length). Unknown or unmapped ⇒ null, never a guessed scale (L-MEA-05).
 */
export const SCALE_UNITS = ["mm", "cm", "m", "inch", "foot"] as const;

/** One unit, drawn from the closed lane above. */
export type ScaleUnit = (typeof SCALE_UNITS)[number];

/** Is this value one of the mapped spellings? The lane's one membership question. */
export function isScaleUnit(value: unknown): value is ScaleUnit {
  return typeof value === "string" && (SCALE_UNITS as readonly string[]).includes(value);
}

/**
 * Metres per one drawing unit of each mapped spelling, exact (riskNotes (1): the world unit of a
 * factor is METRES). The inch and the foot are their international definitions.
 */
const METRES_PER_UNIT: Readonly<Record<ScaleUnit, string>> = Object.freeze({
  mm: "0.001",
  cm: "0.01",
  m: "1",
  inch: "0.0254",
  foot: "0.3048",
});

/** How many places a factor is rendered to (L-MEA-05: "12-place half-even decimal strings"). */
export const FACTOR_PLACES = 12;

/**
 * The shape a rendered factor has — the same pattern the store's CHECK is written from, so a factor
 * the seam admits is one the column admits and no other (B-17). Spelled as a string so the SQL
 * regex and the JavaScript one are one spelling.
 */
export const FACTOR_PATTERN = `^[0-9]+\\.[0-9]{${FACTOR_PLACES}}$`;

const FACTOR_SHAPE = new RegExp(FACTOR_PATTERN);

/**
 * The least factor the rendering can speak: one unit in the twelfth place. A factor is a positive
 * quantity of metres, and at 12 places "positive" means "at least this" — the bound the seam and the
 * store's CHECK both hold a factor to, spelled in the rendering itself (B-17).
 */
export const FACTOR_MINIMUM = `0.${"0".repeat(FACTOR_PLACES - 1)}1`;

/**
 * The arithmetic every factor is rendered through: exact decimals at a precision no chain of one
 * multiply and one divide reaches, rounded half to even at the twelfth place as the last step and
 * nowhere earlier. A double would lose the twelfth place a factor is rendered to (B-07).
 */
const Exact = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_EVEN });

/** A value the exact arithmetic accepts: a decimal string or a number a caller already holds. */
export type DecimalValue = string | number | Decimal;

/** An exact decimal over a value, so callers of the law do their arithmetic in the law's own numbers. */
export function exact(value: DecimalValue): Decimal {
  return new Exact(value);
}

/** One factor, rendered to 12 places half-even. */
export function renderFactor(value: DecimalValue): string {
  return exact(value).toFixed(FACTOR_PLACES, Decimal.ROUND_HALF_EVEN);
}

/**
 * Is this the 12-place rendering of a positive factor? What `factorPair` renders is what this admits
 * — one rendering, one reading — and "0.001" or a whole "1" is not a factor string at all.
 */
export function isFactorString(value: string): boolean {
  return FACTOR_SHAPE.test(value) && exact(value).gte(FACTOR_MINIMUM);
}

/** The two factors a view is scaled by, one per axis, never averaged (L-MEA-05). */
export type FactorPair = { readonly factorX: string; readonly factorY: string };

/**
 * A factor pair, rendered: both factors to 12 places, half to even. A value that renders to no
 * positive factor — zero, a negative, a rounding to nothing — is a mistake in the caller and throws a
 * plain Error rather than minting a pair nothing could scale by (ARCH-03).
 */
export function factorPair(x: DecimalValue, y: DecimalValue): FactorPair {
  const factorX = renderFactor(x);
  const factorY = renderFactor(y);
  for (const factor of [factorX, factorY]) {
    if (!isFactorString(factor)) throw new Error(`${factor} is not a positive factor — a scale is metres per drawing unit, and there are none of them here (L-MEA-05)`);
  }
  return { factorX, factorY };
}

/** Metres per drawing unit for a header spelling, 12-place; null for null, "unitless" and any other spelling. */
export function metresPer(unit: string | null): string | null {
  return isScaleUnit(unit) ? renderFactor(METRES_PER_UNIT[unit]) : null;
}

/** The exact metres per one unit of a mapped spelling, for arithmetic before rendering. */
export function metresPerExact(unit: ScaleUnit): Decimal {
  return exact(METRES_PER_UNIT[unit]);
}

/** The factor pair the header alone yields — the same metres along both axes — or null for none (rank 4). */
export function unitFactor(unit: string | null): FactorPair | null {
  const metres = metresPer(unit);
  return metres === null ? null : { factorX: metres, factorY: metres };
}

/**
 * The content address of a calibration: sha-256, lowercase hex, over the canonical form of (view
 * key, factorX, factorY) as the 12-place strings they are spoken in (L-MEA-05, L-CAD-02). Equal
 * readings are one calibration; a factor short of the rendering can name none, and that is a mistake
 * in the caller rather than a refusal anyone typed (ARCH-03).
 */
export function calibrationKey(viewKey: string, factorX: string, factorY: string): string {
  if (viewKey.trim().length === 0) throw new Error("a calibration is named over a view key, and none was given (L-MEA-05)");
  for (const factor of [factorX, factorY]) {
    if (!isFactorString(factor)) throw new Error(`"${factor}" is not the 12-place rendering a factor is spoken in, so no calibration can be named over it (L-MEA-05)`);
  }
  return createHash("sha256").update(canonical({ factorX, factorY, viewKey }), "utf8").digest("hex");
}

/**
 * Do two factors agree within a relative tolerance of the first? `tolerance` is a ratio, the shape
 * the edition carries `scaleVerificationTolerance` and `scaleAnisotropyTolerance` in (L-MEA-01).
 */
export function withinTolerance(reference: DecimalValue, other: DecimalValue, tolerance: DecimalValue): boolean {
  const base = exact(reference);
  return base.minus(other).abs().lte(base.mul(tolerance));
}

/**
 * How far the two axes of a pair disagree, as a share of the larger factor, rendered to 12 places —
 * a judgement stated on every answer, never an average of the two (L-MEA-05).
 */
export function anisotropyOf(factorX: string, factorY: string): string {
  for (const factor of [factorX, factorY]) {
    if (!isFactorString(factor)) throw new Error(`"${factor}" is not a factor string, so its anisotropy is not a question (L-MEA-05)`);
  }
  const x = exact(factorX);
  const y = exact(factorY);
  const larger = x.gte(y) ? x : y;
  return renderFactor(x.minus(y).abs().div(larger));
}

/** What the anisotropy judgement answers: the share, and whether the view can be placed at all. */
export type AnisotropyJudgement = { readonly anisotropy: string; readonly placeable: boolean };

/** The anisotropy of a pair judged against the edition's tolerance: beyond it, the view is unplaceable. */
export function judgeAnisotropy(pair: FactorPair, tolerance: DecimalValue): AnisotropyJudgement {
  const anisotropy = anisotropyOf(pair.factorX, pair.factorY);
  return { anisotropy, placeable: exact(anisotropy).lte(tolerance) };
}
