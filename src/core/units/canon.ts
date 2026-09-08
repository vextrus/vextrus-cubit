// L-FRM-06's unit canon, as values: the two tiers — physical dimensions, whose units each carry one
// exact factor into their canonical unit, and packaging units, which carry none until a product
// property says what one holds — and the two structural refusals a conversion answers with. Pure:
// no store, no clock, no I/O, because a law that needs a machine to answer is not one (ARCH-02).
//
// One factor per unit lives here and nowhere else (B-17): every pair derives as the quotient of the
// two factors, so no pair carries a table of its own, and a factor spelled anywhere else in `src/**`
// is a second home for the law — which is what `CONVERSION_LITERALS` and the scan beside it refuse.
//
// Refusal is structural (L-FRM-06, ARCH-03): the failing arm carries no value and no factor at all,
// so a caller cannot read a silent 1.0 out of an answer that refused. The codes are the closed
// taxonomy's, read from the register rather than spelled again here (R-SPINE-062, Q-07).
//
// Unit codes are ASCII — "m3", "m2" — because the glyphs m³ and m² are the document's rendering
// concern (L-FMT-02) and SQL and JSON carry ASCII.
import Decimal from "decimal.js";
import { REFUSALS, type RefusalCode } from "../errors";

/** The physical dimensions a quantity can stand in; cross-dimension is a refusal (L-FRM-06). */
export const DIMENSIONS = ["MASS", "VOLUME", "LENGTH", "AREA", "COUNT"] as const;

/** One dimension, drawn from the closed roster above. */
export type Dimension = (typeof DIMENSIONS)[number];

/**
 * The arithmetic every conversion is spoken in: exact decimals at a precision no quotient of two
 * factors reaches, rounded half to even. A double cannot hold 0.028316846592, let alone divide by
 * it, so the canon's numbers are decimal strings from end to end (B-07).
 *
 * This clone is the tree's one exact-decimal arithmetic — `src/core/scale/law.ts` renders its
 * factors through this same `exact`, rather than cloning a second one beside it (B-17).
 */
const Exact = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_EVEN });

/** A value the exact arithmetic accepts: a decimal string, or a number a caller already holds. */
export type DecimalValue = string | number | Decimal;

/** An exact decimal over a value, so callers do their arithmetic in the canon's own numbers. */
export function exact(value: DecimalValue): Decimal {
  return new Exact(value);
}

/**
 * One factor per unit: how much of its dimension's canonical unit one of this unit is, exactly.
 * L-FRM-06 fixes the five that are not one — 0.028316846592 m³/cft, 0.3048 m/ft, 0.09290304 m²/sft,
 * 1000 kg/MT, 0.45359237 kg/lb — and the canonical units are one of themselves. This table is the
 * canon: `UNITS`, `CONVERSION_LITERALS` and every conversion are read off it (B-19).
 */
const FACTORS = Object.freeze({
  kg: { dimension: "MASS", factor: "1" },
  MT: { dimension: "MASS", factor: "1000" },
  lb: { dimension: "MASS", factor: "0.45359237" },
  m3: { dimension: "VOLUME", factor: "1" },
  cft: { dimension: "VOLUME", factor: "0.028316846592" },
  m: { dimension: "LENGTH", factor: "1" },
  ft: { dimension: "LENGTH", factor: "0.3048" },
  m2: { dimension: "AREA", factor: "1" },
  sft: { dimension: "AREA", factor: "0.09290304" },
  pcs: { dimension: "COUNT", factor: "1" },
}) satisfies Readonly<Record<string, { readonly dimension: Dimension; readonly factor: string }>>;

/** One physical unit of the canon. */
export type Unit = keyof typeof FACTORS;

/** Every physical unit the canon carries a factor for, read off the factor table itself. */
export const UNITS: readonly Unit[] = Object.freeze(Object.keys(FACTORS) as Unit[]);

/** Is this value a physical unit of the canon? Asked wherever a unit arrives as text. */
export function isUnit(value: unknown): value is Unit {
  return typeof value === "string" && Object.hasOwn(FACTORS, value);
}

/**
 * The packaging units L-FRM-06 names: a bag, a drum, a coil hold whatever the product they package
 * says they hold, so none of them has a factor of its own until a product property supplies one
 * (M5, R-BK-010). Until then every one of them refuses.
 */
export const PACKAGING_UNITS = ["bag", "drum", "coil"] as const;

/** One packaging unit, drawn from the closed roster above. */
export type PackagingUnit = (typeof PACKAGING_UNITS)[number];

/** Is this value one of the packaging units? */
export function isPackagingUnit(value: unknown): value is PackagingUnit {
  return typeof value === "string" && (PACKAGING_UNITS as readonly string[]).includes(value);
}

/** The unit each dimension is canonically measured in: kg · m³ · m · m² · pcs (L-FRM-06). */
export const CANONICAL_UNIT: Readonly<Record<Dimension, Unit>> = Object.freeze({
  MASS: "kg",
  VOLUME: "m3",
  LENGTH: "m",
  AREA: "m2",
  COUNT: "pcs",
});

/** The dimension a unit stands in. */
export function dimensionOf(unit: Unit): Dimension {
  return FACTORS[unit].dimension;
}

/** The one factor a unit carries into its canonical unit, as the exact decimal string it is. */
export function factorOf(unit: Unit): string {
  return FACTORS[unit].factor;
}

/** A cross-dimension pair — a volume is not an area, and no factor makes it one (L-FRM-06). */
const DIMENSION_MISMATCH: RefusalCode = REFUSALS.DIMENSION_MISMATCH.code;

/** A packaging unit asked to convert with no product property to say what it holds (L-FRM-06). */
const PRODUCT_FACTOR_MISSING: RefusalCode = REFUSALS.PRODUCT_FACTOR_MISSING.code;

/**
 * What a unit canonicalises to: its dimension and its one factor, or a refusal carrying neither.
 * The refusing arm has no `factor` field at all, so "never a silent 1.0" is a fact about the type
 * rather than a promise about the caller (L-FRM-06, ARCH-03).
 */
export type CanonicalAnswer = { readonly ok: true; readonly dimension: Dimension; readonly factor: string } | { readonly ok: false; readonly code: RefusalCode };

/** What a conversion answers: the converted value as an exact decimal string, or a refusal. */
export type ConversionAnswer = { readonly ok: true; readonly value: string } | { readonly ok: false; readonly code: RefusalCode };

/**
 * The unit a spelling names, canonicalised: its dimension and its factor. A packaging unit refuses
 * `PRODUCT_FACTOR_MISSING` — it has no factor until a product says what it holds — and a spelling
 * the canon does not know at all is a mistake in the caller rather than a refusal anyone typed, so
 * it throws (ARCH-03): text from a person or a wire is asked through `isUnit` first.
 */
export function toCanonical(unit: string): CanonicalAnswer {
  if (isPackagingUnit(unit)) return { ok: false, code: PRODUCT_FACTOR_MISSING };
  if (!isUnit(unit)) throw new Error(`"${unit}" is not a unit of the canon, so it canonicalises to nothing (L-FRM-06)`);
  return { ok: true, dimension: dimensionOf(unit), factor: factorOf(unit) };
}

/**
 * A quantity converted from one unit to another — the last term of `amount = rate × qty × convert(1,
 * qtyUnit, rateBasisUnit)` (L-FRM-06). Every pair derives as the quotient of the two units' factors;
 * across dimensions there is no quotient to take, and that is `DIMENSION_MISMATCH`.
 */
export function convert(value: DecimalValue, from: string, to: string): ConversionAnswer {
  const source = toCanonical(from);
  if (!source.ok) return source;
  const target = toCanonical(to);
  if (!target.ok) return target;
  if (source.dimension !== target.dimension) return { ok: false, code: DIMENSION_MISMATCH };
  return { ok: true, value: exact(value).mul(source.factor).div(target.factor).toString() };
}

/** A factor that is 1 or an integer power of ten — 1000 kg to the tonne — written as a decimal. */
const POWER_OF_TEN = /^(?:10*|0\.0*1)$/;

/**
 * The factors the literal ban is scanned for: the canon's own, less the ones that are 1 or a power
 * of ten. 1000 is a canon factor and also every timeout and grouping constant in the tree, so a scan
 * that hunted it would redden the tree rather than the law (riskNotes 4). The needles are read off
 * the factor table, so a unit the canon gains tomorrow is banned elsewhere with no edit (B-19).
 */
export const CONVERSION_LITERALS: readonly string[] = Object.freeze(
  [...new Set(Object.values(FACTORS).map((entry) => entry.factor))].filter((factor) => !POWER_OF_TEN.test(factor)).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)),
);

/**
 * The files a conversion factor may be spelled in, repo-relative: this one, which declares the
 * canon, and the document seam, which is where a figure is rendered rather than converted. Every
 * other file under `src/**` that spells one is a second home for the law (L-FRM-06).
 */
export const CONVERSION_SCAN_EXEMPT: readonly string[] = Object.freeze(["src/core/format.ts", "src/core/units/canon.ts"]);
