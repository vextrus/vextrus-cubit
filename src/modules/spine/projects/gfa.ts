/**
 * Target GFA in square feet, from the square metres the project stores (R-SPINE-010: "target
 * GFA (m² and sft display)").
 *
 * The conversion is pinned by the Design Decision (docs/design/s-project-settings-…
 * Interpretation 9): sft = m² ÷ 0.09290304 — 0.3048², the exact ft–m definition — computed in
 * decimal.js, rounded half-up to the nearest whole sft, and the integer grouped through
 * `formatNumber(…, 'count')`, which is L-FMT-01's sole Intl caller. 1000 m² reads 10,764 sft.
 *
 * No float exists anywhere on the path (B-07). The factor is a *string* handed to Decimal
 * rather than a numeric literal: written as a number it would both be a binary float and be
 * L-FRM-06's exact m²/sft constant spelled outside the conversion canon, which is a lint error
 * twice over. Only sft is derived here — the stored value is always the m², so a rounding can
 * never travel back into the row.
 */
import { Decimal } from 'decimal.js';
import { formatNumber } from '../../../core/format';

/** L-FRM-06's exact m²/sft factor, as an exact decimal string. */
const M2_PER_SFT = '0.09290304';

/** `toDecimalPlaces`' whole-number precision — sft is displayed to the foot, never below it. */
const WHOLE = 0;

/**
 * The sft display of a target GFA, grouped — or null when no GFA is stored.
 *
 * Null is the caller's to render as `project.fields.gfaSftNone`: silence is never lawful, and
 * an empty slot is not this function's to invent a number for.
 */
export function gfaSft(targetGfaM2: string | null | undefined): string | null {
  if (targetGfaM2 === null || targetGfaM2 === undefined || targetGfaM2.trim() === '') return null;
  const sft = new Decimal(targetGfaM2.trim())
    .div(M2_PER_SFT)
    .toDecimalPlaces(WHOLE, Decimal.ROUND_HALF_UP);
  return formatNumber(sft.toFixed(WHOLE), 'count');
}
