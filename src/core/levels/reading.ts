// One storey-height reading, carried from what was written to what it is worth in canonical metres
// (L-REG-01: "a unit conversion is not origination only because it carries its derivation — source
// value, source unit as written, canonical unit, factor, factor provenance"; L-FRM-06).
//
// Every number here is the canon's. No factor is spelled in this file: `src/core/units/canon.ts` is
// the one home of the law, and this asks it (B-17).
import { REFUSALS } from "../errors";
import { refusal } from "../faults/refusal-marker";
import { CANONICAL_UNIT, convert, toCanonical, unitNamed, type Unit } from "../units/canon";

/** The code a reading that states no number is answered with, off the closed taxonomy (Q-07). */
const READING_NOT_NUMERIC = REFUSALS.READING_NOT_NUMERIC.code;

/**
 * Where a conversion factor came from, recorded with the reading it carried: a derivation whose
 * factor has no stated source is a number somebody would have to trust (L-REG-01).
 */
export const FACTOR_PROVENANCE = "unit canon (L-FRM-06)";

/** The unit a storey height stands in once carried — the canon's own for LENGTH, never respelled. */
export const CANONICAL_LENGTH: Unit = CANONICAL_UNIT.LENGTH;

/** One reading, carried: what was written, what it is worth, and the derivation that took it there. */
export type CarriedReading = {
  readonly valueAsWritten: string;
  readonly unitAsWritten: string;
  readonly canonicalMetres: string;
  readonly factor: string;
  readonly factorProvenance: string;
};

/**
 * Does this as-written value read as a number at all? Asked before any arithmetic, and asked of the
 * trimmed spelling the canon is then given, so the guard and the arithmetic read one grammar: a
 * reading transcribed with a trailing newline is an ordinary reading, not a crash inside a decimal
 * library (ARCH-03, L-FRM-06). What is kept as written is still what was written.
 */
function readsAsANumber(value: string): boolean {
  return value !== "" && Number.isFinite(Number(value));
}

/**
 * A written height in canonical metres, with its derivation.
 *
 * A unit that measures something other than length refuses by name (`DIMENSION_MISMATCH`), and a
 * packaging unit refuses `PRODUCT_FACTOR_MISSING` — never a silent 1.0 (L-FRM-06). A value that is
 * no number refuses `READING_NOT_NUMERIC`: it is transport-supplied, so it is a fact about what was
 * written and a reader is told what to do about it (ARCH-03, B-21). A spelling the canon names
 * nothing for at all is no unit of this product, and that is a mistake in the caller: it says so
 * where it is made.
 */
export function carryToMetres(valueAsWritten: string, unitAsWritten: string): CarriedReading {
  const value = valueAsWritten.trim();
  // L-REG-01: "convert of no input is no output, never a zero". What arrives here is transport-
  // supplied — a person typed it, or a drawing said `N/A` in the cell it was read from — so it is
  // answered by the registered refusal a reader can act on, never as a bare fault carrying a fault
  // id nobody can do anything about (ARCH-03, B-21). It is the same code the register answers an
  // unreadable reading with, off the closed taxonomy rather than spelled again (Q-07, B-17).
  if (!readsAsANumber(value)) {
    throw refusal(READING_NOT_NUMERIC, `"${valueAsWritten}" is no reading of a storey height, so there is nothing to carry to metres — a convert of no input is no output, never a zero (L-REG-01)`, { valueAsWritten });
  }
  // A drawing writes the metre as `M`; what a written spelling NAMES is the canon's to say, and the
  // reading keeps the spelling that was drawn beside the unit it named (L-REG-01, L-FRM-06, B-17).
  const named = unitNamed(unitAsWritten);
  if (named === null) {
    const canonical = toCanonical(unitAsWritten);
    if (canonical.ok) throw new Error(`"${unitAsWritten}" canonicalised without being a unit of the canon — the canon and its guard disagree (L-FRM-06)`);
    throw refusal(canonical.code, `a storey height written in ${unitAsWritten} carries no factor into metres`, { unitAsWritten });
  }
  const source = toCanonical(named);
  if (!source.ok) throw refusal(source.code, `a storey height written in ${unitAsWritten} carries no factor into metres`, { unitAsWritten });
  const carried = convert(value, named, CANONICAL_LENGTH);
  if (!carried.ok) throw refusal(carried.code, `a storey height is a length, and ${unitAsWritten} does not measure one`, { unitAsWritten });
  return { valueAsWritten, unitAsWritten, canonicalMetres: carried.value, factor: source.factor, factorProvenance: FACTOR_PROVENANCE };
}
