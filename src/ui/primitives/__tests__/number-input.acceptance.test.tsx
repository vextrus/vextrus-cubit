// @vitest-environment jsdom
/**
 * inc-005 acceptance — NumberInput is a decimal-string field (AC-3).
 *
 * B-07: "Decimal at the seam, `numeric` in the database, lakh/crore on every document;
 * floats and Western grouping are lint errors."
 * R-SPINE-061: "Numbers, dates, currency and units render only through SEAM-FORMAT with
 * `BD_DOCUMENT` conventions (lakh/crore, ৳ prefix, DD MMM YYYY, tabular numerals in UI)."
 * R-UI-010: "NumberInput (unit suffix, decimal only, lakh/crore display on blur)".
 *
 * The whole point of the control is that a number never becomes a `number`: what leaves it
 * is the text the user typed, and what it shows when it is not being edited is that text
 * grouped by SEAM-FORMAT. Both halves are asserted here, and the grouped half is derived
 * from `formatNumber` at run time rather than transcribed — a suite that hardcoded the
 * grouping would still pass if the seam were bypassed.
 *
 * Recorded interpretation — SEAM-FORMAT renders at exactly the stated per-kind precision
 * (`quantity` three fraction digits, `count` none) and refuses anything else, and
 * src/core/format.ts is out of scope for this increment. A free-precision field therefore
 * groups its integer part through the seam and keeps its own fraction beside it: the
 * grouping — the thing B-07 and R-SPINE-061 legislate — is still the seam's and nowhere
 * else's. That is why the expectation below is composed from `formatNumber(…, 'count')`
 * rather than asked of the seam in one call, and why it is also checked against the literal
 * the test contract states.
 *
 * The modules are loaded inside each test so that a module which does not exist yet reads as
 * one missing behaviour per test rather than a single collection error.
 */
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import type { ReactElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { installJsdomSupport } from './jsdom-support';

installJsdomSupport();

/** The barrel and the one formatter seam, per test (see the file header). */
const primitives = async () => await import('../index');
const seam = async () => await import('../../../core/format');

type Primitives = typeof import('../index');

/** The test contract's ids. */
const FIELD = 'number-input-field';
const SUFFIX = 'number-input-suffix';

const NAME = 'Amount';
const UNIT = 'kg';
const ELSEWHERE = 'Elsewhere';

/** The contract's display example, and the value behind it. */
const RAW = '1234567.89';
const GROUPED = '12,34,567.89';

/** Bengali digits: R-SPINE-061 renders a document in ASCII numerals, whatever the locale. */
const BENGALI_DIGIT = /[০-৯]/;

/** What a decimal string may look like at any moment while it is being typed (B-07). */
const DECIMAL_STRING = /^-?[0-9]*(?:\.[0-9]*)?$/;

/**
 * A parent that owns the value, which is what "controlled" means: the field renders what it
 * is given and asks for a change; nothing else is allowed to move.
 */
function harnessFor(
  NumberInput: Primitives['NumberInput'],
  committed: string[],
): (props: { initial: string }) => ReactElement {
  return function Harness({ initial }: { initial: string }) {
    const [value, setValue] = useState(initial);
    return (
      <div>
        <NumberInput
          value={value}
          onValueChange={(next: string) => {
            committed.push(next);
            setValue(next);
          }}
          unit={UNIT}
          aria-label={NAME}
        />
        <button type="button">{ELSEWHERE}</button>
      </div>
    );
  };
}

const field = (): HTMLInputElement => screen.getByTestId(FIELD) as HTMLInputElement;

afterEach(() => {
  cleanup();
});

describe('AC-3 — the value is a decimal string, end to end (B-07)', () => {
  it('commits a string, never a number, and always a lawful decimal', async () => {
    const { NumberInput } = await primitives();
    const committed: string[] = [];
    const Harness = harnessFor(NumberInput, committed);
    const user = userEvent.setup();

    render(<Harness initial="" />);
    await user.type(field(), '1234.5');

    expect(committed.length, 'typing committed nothing').toBeGreaterThan(0);
    const notStrings = committed.filter((value) => typeof value !== 'string');
    expect(notStrings, 'a value left NumberInput as something other than a string').toEqual([]);
    const malformed = committed.filter((value) => !DECIMAL_STRING.test(value));
    expect(malformed, `not decimal strings: ${malformed.join(' | ')}`).toEqual([]);
    expect(committed.at(-1), 'the typed decimal did not survive').toBe('1234.5');
  });

  it('refuses a character outside 0-9 and one point, leaving the value unchanged', async () => {
    const { NumberInput } = await primitives();
    const committed: string[] = [];
    const Harness = harnessFor(NumberInput, committed);
    const user = userEvent.setup();

    render(<Harness initial="" />);

    // A letter in the middle of a number: the keystroke is refused, the digits either side
    // are not. `12a3` is `123`, not `12a3` and not an empty field.
    await user.type(field(), '12a3');
    expect(field().value, 'a letter reached the field').toBe('123');

    // The second point is the refused one — a decimal string has at most one.
    await user.clear(field());
    await user.type(field(), '1.2.3');
    expect(field().value, 'a second decimal point reached the field').toBe('1.23');

    const unlawful = committed.filter((value) => !DECIMAL_STRING.test(value));
    expect(unlawful, `refused text was committed anyway: ${unlawful.join(' | ')}`).toEqual([]);
  });

  it('refuses Western grouping on paste (B-07: Western grouping is a defect)', async () => {
    const { NumberInput } = await primitives();
    const committed: string[] = [];
    const Harness = harnessFor(NumberInput, committed);
    const user = userEvent.setup();

    render(<Harness initial="" />);
    await user.click(field());
    await user.paste('1,234,567');

    // Whether the control filters the paste or declines it whole, what it may never do is
    // hold a comma: the grouping a document uses is decided at the seam, not pasted in.
    expect(field().value, 'a Western-grouped string was accepted').not.toContain(',');
    expect(
      DECIMAL_STRING.test(field().value),
      `the field holds "${field().value}", which is not a decimal string`,
    ).toBe(true);
    const unlawful = committed.filter((value) => !DECIMAL_STRING.test(value));
    expect(unlawful, `committed: ${unlawful.join(' | ')}`).toEqual([]);
  });
});

describe('AC-3 — lakh/crore on blur, the raw string on focus (R-SPINE-061)', () => {
  it('groups through SEAM-FORMAT when it loses focus', async () => {
    const { NumberInput } = await primitives();
    const { formatNumber } = await seam();
    const committed: string[] = [];
    const Harness = harnessFor(NumberInput, committed);
    const user = userEvent.setup();

    render(<Harness initial={RAW} />);
    await user.click(field());
    await user.tab();

    const shown = field().value;

    // Derived from the seam, so the assertion still means "through SEAM-FORMAT" if the
    // grouping convention ever moves; and checked against the contract's literal, so a seam
    // that stopped grouping at all could not satisfy it either.
    expect(shown, 'the blurred field does not show the seam grouping').toBe(
      `${formatNumber('1234567', 'count')}.89`,
    );
    expect(shown, 'the blurred field does not show lakh/crore grouping').toBe(GROUPED);
    expect(BENGALI_DIGIT.test(shown), 'a document renders in ASCII numerals').toBe(false);
  });

  it('returns the raw decimal string when it regains focus', async () => {
    const { NumberInput } = await primitives();
    const committed: string[] = [];
    const Harness = harnessFor(NumberInput, committed);
    const user = userEvent.setup();

    render(<Harness initial={RAW} />);
    await user.click(field());
    await user.tab();
    expect(field().value, 'the field did not group on blur').toBe(GROUPED);

    await user.click(field());
    expect(field().value, 'grouping is not editable text — the raw string has to come back').toBe(
      RAW,
    );

    // Grouping is a display, not an edit: nothing was committed by looking at the field.
    expect(committed, `focus and blur committed: ${committed.join(' | ')}`).toEqual([]);
  });

  it('renders the unit prop in its own suffix', async () => {
    const { NumberInput } = await primitives();
    const committed: string[] = [];
    const Harness = harnessFor(NumberInput, committed);

    render(<Harness initial={RAW} />);

    const suffix = screen.getByTestId(SUFFIX);
    expect(suffix.textContent?.trim(), 'the unit is not in its suffix').toBe(UNIT);

    // A unit is written beside a number, never inside it (L-FMT-02).
    expect(field().value, 'the unit leaked into the value').not.toContain(UNIT);
  });
});
