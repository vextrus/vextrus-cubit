// L-FRM-06: the measurement canon, and its one home (ARCH-02, B-17). Two tiers sit here and
// nowhere else — the physical dimensions with one canonical unit each, and the packaging units that
// mean nothing until a product says what one of them holds.
//
// The shape of the canon is what makes the law enforceable rather than merely stated:
//
//   - **one factor per unit.** A unit knows how to reach its own dimension's canonical and nothing
//     else. There is no table of pairs, so there is no second path a pair could disagree along.
//   - **every pair is a quotient.** `convert` derives ft→m, cft→m3 and every other same-dimension
//     pair by dividing the two units' factors. A pair nobody thought of is already right.
//   - **the five constants are exact.** They are written once, below, and every other conversion in
//     the tree is arithmetic over them — a conversion literal spelled anywhere else is the same
//     fact held in two places, and the fact that drifts is the one that was copied.
//   - **refusal is structural.** The failure arm of both answers carries a code and nothing else:
//     there is no value to read past a refusal, so a caller cannot use one by mistake (B-21).
//
// Rate bases — job, LS, per % cft, hour — are deliberately absent. A rate basis says how a price is
// quoted, not how a quantity is measured; giving one a factor would let a quantity be converted
// into a pricing convention.
import { refusalOf, type RefusalEntry } from "../errors";

/* ------------------------------------------------------------------ the physical tier */

/** The five physical dimensions L-FRM-06 closes. Cross-dimension arithmetic is a refusal, never a guess. */
export const DIMENSIONS = ["MASS", "VOLUME", "LENGTH", "AREA", "COUNT"] as const;

/** One of the five, as a type. */
export type Dimension = (typeof DIMENSIONS)[number];

/** The canonical unit codes, pinned ASCII so a stored row, a JSON table and a test all spell them alike. */
export type CanonicalUnit = "kg" | "m3" | "m" | "m2" | "pcs";

/** Each dimension's canonical unit: kg · m3 · m · m2 · pcs (L-FRM-06). */
export const CANONICAL_UNITS = Object.freeze({
  MASS: "kg",
  VOLUME: "m3",
  LENGTH: "m",
  AREA: "m2",
  COUNT: "pcs",
} as const) satisfies Readonly<Record<Dimension, CanonicalUnit>>;

/** The canonical unit of one dimension, at the type level: what a catalogue entry's unit must be. */
export type CanonicalUnitOf<D extends Dimension> = (typeof CANONICAL_UNITS)[D];

/**
 * The five exact conversion constants, verbatim from L-FRM-06. Exact means exact: each is the
 * defining ratio of its unit, not a rounded one, so a quotient of two of them is as good as the
 * arithmetic can be. Nothing else in this tree spells a conversion factor.
 */
export const EXACT_FACTORS = Object.freeze({
  /** m3 per cft. */
  cubicMetresPerCubicFoot: 0.028316846592,
  /** m per ft. */
  metresPerFoot: 0.3048,
  /** m2 per sft. */
  squareMetresPerSquareFoot: 0.09290304,
  /** kg per MT. */
  kilogramsPerTonne: 1000,
  /** kg per lb. */
  kilogramsPerPound: 0.45359237,
});

/** One physical unit: what it measures, and the single factor that takes it to its canonical. */
type PhysicalUnit = { dimension: Dimension; toCanonical: number };

/**
 * Every physical unit the canon knows, each with exactly one factor. A canonical unit's factor is 1
 * — it converts to itself — and the abbreviations a bill of quantities is written in (cum, sqm,
 * rft, nr) are the same units under the spelling the trade uses, never a second factor path.
 */
const PHYSICAL: Readonly<Record<string, PhysicalUnit>> = Object.freeze({
  kg: { dimension: "MASS", toCanonical: 1 },
  MT: { dimension: "MASS", toCanonical: EXACT_FACTORS.kilogramsPerTonne },
  lb: { dimension: "MASS", toCanonical: EXACT_FACTORS.kilogramsPerPound },
  m3: { dimension: "VOLUME", toCanonical: 1 },
  cum: { dimension: "VOLUME", toCanonical: 1 },
  cft: { dimension: "VOLUME", toCanonical: EXACT_FACTORS.cubicMetresPerCubicFoot },
  m: { dimension: "LENGTH", toCanonical: 1 },
  ft: { dimension: "LENGTH", toCanonical: EXACT_FACTORS.metresPerFoot },
  rft: { dimension: "LENGTH", toCanonical: EXACT_FACTORS.metresPerFoot },
  m2: { dimension: "AREA", toCanonical: 1 },
  sqm: { dimension: "AREA", toCanonical: 1 },
  sft: { dimension: "AREA", toCanonical: EXACT_FACTORS.squareMetresPerSquareFoot },
  pcs: { dimension: "COUNT", toCanonical: 1 },
  nr: { dimension: "COUNT", toCanonical: 1 },
});

/* ----------------------------------------------------------------- the packaging tier */

/**
 * The packaging units, and the dimension the product property that fills each one is expressed in:
 * a bag and a coil are bought by weight, a drum by volume. A packaging unit has no factor of its
 * own — a bag of cement and a bag of lime are different quantities of material — so the factor
 * comes from the product or the answer is a refusal. Never a silent 1.0 (L-FRM-06).
 */
const PACKAGING: Readonly<Record<string, Dimension>> = Object.freeze({
  bag: "MASS",
  drum: "VOLUME",
  coil: "MASS",
});

/**
 * Every unit code the canon knows, in the spelling a document writes it. This is the roster a kind
 * name is judged against (L-MEA-04): a work item named for its unit has named a measurement rather
 * than a trade.
 */
export const UNIT_ABBREVIATIONS: readonly string[] = Object.freeze([...Object.keys(PHYSICAL), ...Object.keys(PACKAGING)]);

/* --------------------------------------------------------------------- what a product says */

/** What a product knows about the packaging it is sold in: how much of its material one unit holds. */
export type ProductFactors = { factors?: Record<string, number> };

/* ------------------------------------------------------------------------- the refusals */

/** The codes this seam refuses with. Each is a registered refusal, and the register is its home (R-SPINE-062). */
export type ConversionRefusalCode = "DIMENSION_MISMATCH" | "PRODUCT_FACTOR_MISSING" | "UNIT_UNKNOWN";

/**
 * The registered entries behind those codes, read from the taxonomy at load. `refusalOf` throws on a
 * code the register lacks, so a code answered from here is one a screen can actually render — the
 * name and the entry cannot drift apart (Q-07, R-SPINE-062).
 */
export const CONVERSION_REFUSALS: Readonly<Record<ConversionRefusalCode, RefusalEntry>> = Object.freeze({
  DIMENSION_MISMATCH: refusalOf("DIMENSION_MISMATCH"),
  PRODUCT_FACTOR_MISSING: refusalOf("PRODUCT_FACTOR_MISSING"),
  UNIT_UNKNOWN: refusalOf("UNIT_UNKNOWN"),
});

/**
 * What a unit resolves to. The refusal arm carries a code and nothing else: there is no factor to
 * read past it and no dimension to assume, so a refused conversion cannot be half-used (B-21).
 */
export type ToCanonicalResult = { ok: true; factor: number; dimension: Dimension } | { ok: false; code: ConversionRefusalCode };

/** What a conversion answers. Its refusal arm carries no value, for the same reason. */
export type ConvertResult = { ok: true; value: number } | { ok: false; code: ConversionRefusalCode };

/* ------------------------------------------------------------------------ the two answers */

/** Is this a factor a product actually stated? A missing, zero, negative or non-finite one states nothing. */
function statedFactor(value: number | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

/**
 * The one factor that takes `unit` to its dimension's canonical. A packaging unit needs the product
 * whose packaging it is; without it the answer is `PRODUCT_FACTOR_MISSING`, which is the whole point
 * of the second tier (L-FRM-06).
 */
export function toCanonical(unit: string, product?: ProductFactors): ToCanonicalResult {
  const physical = Object.hasOwn(PHYSICAL, unit) ? PHYSICAL[unit] : undefined;
  if (physical !== undefined) return { ok: true, factor: physical.toCanonical, dimension: physical.dimension };

  const packaging = Object.hasOwn(PACKAGING, unit) ? PACKAGING[unit] : undefined;
  if (packaging === undefined) return { ok: false, code: "UNIT_UNKNOWN" };

  const stated = product?.factors?.[unit];
  if (!statedFactor(stated)) return { ok: false, code: "PRODUCT_FACTOR_MISSING" };
  return { ok: true, factor: stated, dimension: packaging };
}

/**
 * `value` in `from`, expressed in `to`. The pair is derived as the quotient of the two units'
 * factors rather than looked up, so every pair the canon admits converts and no pair is tabulated.
 * Two units of different dimensions do not convert at all — that is `DIMENSION_MISMATCH`, not a
 * number that happens to be arithmetically available.
 */
export function convert(value: number, from: string, to: string, product?: ProductFactors): ConvertResult {
  const source = toCanonical(from, product);
  if (!source.ok) return { ok: false, code: source.code };
  const target = toCanonical(to, product);
  if (!target.ok) return { ok: false, code: target.code };
  if (source.dimension !== target.dimension) return { ok: false, code: "DIMENSION_MISMATCH" };
  return { ok: true, value: value * (source.factor / target.factor) };
}

/** Is this one of the five dimensions? Asked wherever a dimension arrives as text. */
export function isDimension(value: string): value is Dimension {
  return (DIMENSIONS as readonly string[]).includes(value);
}
