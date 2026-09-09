// The gate's normalisation (L-MEA-08: "normalises units in decimal (`UNIT_UNMAPPED`)").
//
// Every factor is the canon's and none is here (B-17, L-FRM-06): this asks `isUnit` first, so a
// spelling the canon has no factor for — a packaging unit included, which holds nothing until a
// product property says what it holds — is answered `UNIT_UNMAPPED` rather than throwing out of the
// canon. A pair the canon refuses structurally (a length asked for as a mass) carries the canon's
// own registered code back, because that refusal is a different fact and reporting it as an unmapped
// unit would tell a reader the wrong thing (ARCH-03, R-SPINE-062).
import { REFUSALS, type RefusalCode } from "../errors";
import type { Measure } from "../offers/contract";
import { CANONICAL_UNIT, convert, isUnit, type Dimension, type Unit } from "../units/canon";

/** What a reading normalises to: the canonical value and its unit, or a registered refusal. */
export type NormalisedMeasure = { readonly ok: true; readonly value: string; readonly unit: Unit } | { readonly ok: false; readonly code: RefusalCode };

/**
 * One reading, carried into the canonical unit of the dimension it is supposed to be of, exactly.
 * The failing arm carries no value at all, so a caller cannot read a silent figure out of a reading
 * that could not be carried.
 */
export function normaliseMeasure(measure: Measure, dimension: Dimension): NormalisedMeasure {
  if (!isUnit(measure.unit)) return { ok: false, code: REFUSALS.UNIT_UNMAPPED.code };
  const unit = CANONICAL_UNIT[dimension];
  const carried = convert(measure.value, measure.unit, unit);
  if (!carried.ok) return { ok: false, code: carried.code };
  return { ok: true, value: carried.value, unit };
}
