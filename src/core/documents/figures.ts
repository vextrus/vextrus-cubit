// L-FMT-02 at the document's edge: a figure crosses into a template at EXACTLY the precision its kind
// states, or it is refused. The seam does not round and does not pad, and malformed input takes the
// same code as a figure at the wrong precision — "nearly right" and "not a number" are the same
// answer to a document.
//
// The grouping is NOT re-spelled here. Lakh/crore grouping is SEAM-FORMAT's one invariant
// (`formatUserFigure`, src/core/format.ts), and a second grouping engine beside it would agree with
// it until the day one of them moved. What this file adds is the only thing SEAM-FORMAT leaves to the
// caller: a figure is user-owned and free-precision there, and per-KIND precision here (L-FMT-02's
// "the stated per-kind precision"). So the figure is grouped by the seam that owns grouping, and the
// fraction the seam handed back is then counted — which also means the decimal grammar is stated
// once, in SEAM-FORMAT, and a shape it refuses arrives here already refused with this same code.
import { formatUserFigure } from "../format";
import type { RefusalCode } from "../errors";
import { refusal } from "../faults/refusal-marker";

/** A figure that is not exactly at its kind's precision, or is not a decimal at all (L-FMT-02). */
const PRECISION_NOT_APPLIED: RefusalCode = "PRECISION_NOT_APPLIED";

/**
 * A quantity as a document prints it: grouped lakh/crore, at exactly `precision` fraction digits.
 *
 * `12.500` at precision 3 is `12.500`; `1234567.500` is `12,34,567.500`. `12.50` and `12.5000` are
 * refused rather than padded or trimmed, and so is `12,500` — a figure that arrives with separators
 * already applied is not a decimal this seam was handed, it is one somebody already formatted
 * (L-FMT-02). Compact `L`/`Cr` never appears: that spelling is refused ON a document by the same
 * clause, and this is the only figure path a template has.
 *
 * The value is a string end to end (B-07): a document's figures come from `numeric` columns and a
 * float would lose the very digits this function exists to count.
 */
export function figure(value: string, precision: number): string {
  if (!Number.isSafeInteger(precision) || precision < 0) {
    throw refusal(PRECISION_NOT_APPLIED, `a document kind states a whole, non-negative precision, not ${String(precision)} (L-FMT-02)`);
  }
  // Grouping and the decimal grammar are SEAM-FORMAT's; anything it will not read is already this
  // same refusal, raised where the grammar is stated rather than judged a second time here.
  const grouped = formatUserFigure(value);
  // Grouping only ever touches the integer part, so what follows the point is the fraction as the
  // writer wrote it — including its absence, which is a precision of zero.
  const point = grouped.indexOf(".");
  const digits = point === -1 ? 0 : grouped.length - point - 1;
  if (digits !== precision) {
    throw refusal(
      PRECISION_NOT_APPLIED,
      `the figure carries ${String(digits)} fraction digits where this document kind states ${String(precision)} — the seam refuses rather than rounding or padding (L-FMT-02)`,
    );
  }
  return grouped;
}
