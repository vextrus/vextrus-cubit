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

/** The magnitude the seam will group: at least one ASCII digit, no sign and no point. */
const GROUPABLE = /^[0-9]+$/;

/** The integer part of a value that has none — `.5` is half of nothing, and nothing is zero. */
const NO_WHOLE = '0';

/** The point a half-typed value ends on: `123.` is `123` until a digit follows it. */
const POINT = '.';

/** A leading minus, kept aside so the seam is only ever asked to group a magnitude. */
const MINUS = '-';

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
 * The value as a document writes it (Design Decision §4, R-SPINE-061).
 *
 * The document fixes the three cases the split leaves behind: the integer part is `0` where
 * the user wrote none, a trailing bare point drops from the display, and an empty field shows
 * an empty field — never `NaN`. So `1234567.89` reads `12,34,567.89`, `.5` reads `0.5` and
 * `123.` reads `1,23`'s grouping without the point the caret was resting on. The sign is held
 * aside rather than handed to the seam, because a magnitude of nothing under a minus is `-0`,
 * which is a number nobody typed.
 *
 * A value that is not a number yet — a lone `-` or a lone `.` — is shown as itself: there is
 * nothing there to group, and rewriting it to `0` would put a digit in a field the user has
 * only started.
 */
export function groupedForDisplay(value: string): string {
  if (value.length === 0) return '';
  const sign = value.startsWith(MINUS) ? MINUS : '';
  const magnitude = value.slice(sign.length);
  const point = magnitude.indexOf(POINT);
  const whole = point === -1 ? magnitude : magnitude.slice(0, point);
  const written = point === -1 ? '' : magnitude.slice(point);
  // "a trailing bare point drops from display": the point is only shown once it holds digits.
  const fraction = written === POINT ? '' : written;
  if (whole.length === 0 && fraction.length === 0) return value;
  const groupable = whole.length === 0 ? NO_WHOLE : whole;
  if (!GROUPABLE.test(groupable)) return value;
  return `${sign}${formatNumber(groupable, 'count')}${fraction}`;
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
        // `numeric` is R-UI-003's utility (src/ui/globals.css); the sheet restates the rule
        // for the primitive itself, so a number is tabular with or without the app's globals.
        className={cx(
          'datum-control',
          'datum-field',
          'datum-number-field',
          'numeric',
          'datum-focus-ring',
        )}
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
