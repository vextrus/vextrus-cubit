/**
 * NumberInput — a decimal string, never a number (B-07, R-SPINE-061, R-UI-010).
 *
 * R-UI-010: "NumberInput (unit suffix, decimal only, lakh/crore display on blur)".
 * B-07: "Decimal at the seam, `numeric` in the database, lakh/crore on every document; floats
 * and Western grouping are lint errors."
 *
 * The control never holds a `number`. What the user types is kept as the text they typed —
 * `value` in, `onValueChange(next)` out, both `string` — so a quantity crosses this boundary
 * with every digit they wrote and none this file invented. `Number(…)` would round 0.1 + 0.2
 * on the way to a certificate; there is no parse here at all.
 *
 * Two states, one field:
 *
 *   - being edited: the raw decimal string, because grouping is not editable text — a caret
 *     placed after a separator nobody typed is a caret in the wrong place;
 *   - at rest: what SEAM-FORMAT makes of it, which is lakh/crore in ASCII digits.
 *
 * Recorded interpretation — SEAM-FORMAT renders at exactly the stated per-kind precision
 * (`count` none, `quantity` three) and refuses anything else, and src/core/format.ts is out of
 * this increment's scope. A field whose precision is the user's therefore groups its integer
 * part through the seam and writes its own fraction after it: the grouping — the thing B-07
 * and R-SPINE-061 legislate — is still the seam's and nowhere else's. The alternative,
 * widening `formatNumber` to a free-precision kind, would have edited a file this increment
 * does not own to make a display case easier.
 */
import { forwardRef, useId, useState } from 'react';
import type { FocusEvent, InputHTMLAttributes } from 'react';
import { formatNumber } from '../../core/format';
import { cx } from './class-names';

/** An integer the seam will group: an optional sign and at least one ASCII digit. */
const GROUPABLE = /^-?[0-9]+$/;

/**
 * The text, reduced to the decimal string it was trying to be: ASCII digits, at most one
 * point, and a leading sign.
 *
 * Filtering rather than rejecting is deliberate. A rejected keystroke in the middle of a
 * number takes the digits around it with it (`12a3` becomes empty rather than `123`), and a
 * pasted `1,234,567` becomes nothing at all instead of the number the user meant. What may
 * never survive is a separator: B-07 calls Western grouping a defect, and the grouping a
 * document uses is decided at the seam, not pasted in.
 */
export function toDecimalString(text: string): string {
  let kept = '';
  let seenPoint = false;
  for (const character of text) {
    if (character >= '0' && character <= '9') {
      kept += character;
      continue;
    }
    if (character === '.' && !seenPoint) {
      seenPoint = true;
      kept += character;
      continue;
    }
    // A sign is only a sign in front: `1-2` is two digits with a stray key between them.
    if (character === '-' && kept.length === 0) kept += character;
  }
  return kept;
}

/**
 * The value as a document writes it (R-SPINE-061), or the value itself where there is nothing
 * to group yet — an empty field shows an empty field, never `NaN`, and a half-typed `.5` shows
 * what was typed rather than a refusal from the seam.
 */
export function groupedForDisplay(value: string): string {
  if (value.length === 0) return '';
  const point = value.indexOf('.');
  const whole = point === -1 ? value : value.slice(0, point);
  const fraction = point === -1 ? '' : value.slice(point);
  if (!GROUPABLE.test(whole)) return value;
  return `${formatNumber(whole, 'count')}${fraction}`;
}

export interface NumberInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  /** The committed value, a decimal string (B-07). Never a `number`. */
  readonly value: string;
  /** Asked for a change; the argument is the decimal string the field would hold. */
  readonly onValueChange: (next: string) => void;
  /** Written beside the number, never inside it (L-FMT-02). */
  readonly unit?: string;
}

export const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(function NumberInput(
  { value, onValueChange, unit, className, onFocus, onBlur, 'aria-describedby': describedBy, ...rest },
  ref,
) {
  const [editing, setEditing] = useState(false);
  const suffixId = useId();

  return (
    <div className={cx('datum-number-input', className)}>
      <input
        ref={ref}
        data-testid="number-input-field"
        // The unit is part of what this field holds, so the field says so rather than leaving
        // a screen reader to guess at a span beside it (R-UI-012).
        aria-describedby={
          unit === undefined ? describedBy : cx(describedBy, suffixId)
        }
        // A decimal keypad on a phone, and a plain text field everywhere: `type="number"`
        // would hand the browser a float and swallow the string the user typed.
        inputMode="decimal"
        autoComplete="off"
        className={cx('datum-control', 'datum-field', 'datum-number-field', 'datum-focus-ring')}
        value={editing ? value : groupedForDisplay(value)}
        onChange={(event) => {
          const next = toDecimalString(event.target.value);
          // Nothing lawful changed: the keystroke was refused, and refusing it is not an
          // edit. React restores the field to `value` because this render does not move it.
          if (next !== value) onValueChange(next);
        }}
        onFocus={(event: FocusEvent<HTMLInputElement>) => {
          setEditing(true);
          onFocus?.(event);
        }}
        onBlur={(event: FocusEvent<HTMLInputElement>) => {
          setEditing(false);
          onBlur?.(event);
        }}
        {...rest}
      />
      {unit === undefined ? null : (
        <span id={suffixId} data-testid="number-input-suffix" className="datum-number-suffix">
          {unit}
        </span>
      )}
    </div>
  );
});
