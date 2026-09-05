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
import { REFUSALS, type RefusalEntry } from "../errors";

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

/** What a product knows about the packaging it is sold in: one canonical-unit factor per packaging unit. */
export type ProductFactors = {
  /**
   * How much of a product's material one packaging unit holds, **expressed in the canonical unit of
   * that packaging unit's dimension** — kg for a bag or a coil, m3 for a drum (`PACKAGING` above says
   * which dimension each one fills, and `CANONICAL_UNITS` says that dimension's canonical). The number
   * is the unit's factor to the canonical and is used as one: a cement bag is recorded as 50, not as
   * 110 lb or 0.05 MT. A factor stated in any other unit converts everything silently wrong, which is
   * the failure L-FRM-06 built the second tier to refuse — so a caller holding a figure in some other
   * unit converts it with `convert` first and records what that answers. It is a plain number and
   * says so: a bare alias over `number` reads as a nominal type the checker never enforces (B-17).
   */
  factors?: Record<string, number>;
};

/* ------------------------------------------------------------------------- the refusals */

/**
 * The registered entries this seam refuses with, read straight out of the taxonomy: the register is
 * the home of both the name and the copy (R-SPINE-062). The seam answers with an entry's own `code`
 * rather than a string of its own, so the code a caller receives is the register's value — a code
 * cannot be spelled here and be absent there, and the two cannot drift apart (Q-07).
 */
export const CONVERSION_REFUSALS = Object.freeze({
  DIMENSION_MISMATCH: REFUSALS.DIMENSION_MISMATCH,
  PRODUCT_FACTOR_MISSING: REFUSALS.PRODUCT_FACTOR_MISSING,
  UNIT_UNKNOWN: REFUSALS.UNIT_UNKNOWN,
}) satisfies Readonly<Record<string, RefusalEntry>>;

/** The three codes, as a type: the keys of the entries above, so the roster too has one home (B-17). */
export type ConversionRefusalCode = keyof typeof CONVERSION_REFUSALS;

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
  if (packaging === undefined) return { ok: false, code: CONVERSION_REFUSALS.UNIT_UNKNOWN.code };

  const stated = product?.factors?.[unit];
  if (!statedFactor(stated)) return { ok: false, code: CONVERSION_REFUSALS.PRODUCT_FACTOR_MISSING.code };
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
  if (source.dimension !== target.dimension) return { ok: false, code: CONVERSION_REFUSALS.DIMENSION_MISMATCH.code };
  return { ok: true, value: value * (source.factor / target.factor) };
}
