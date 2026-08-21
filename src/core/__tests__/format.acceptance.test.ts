/**
 * inc-003 acceptance — SEAM-FORMAT renders BD_DOCUMENT, and refuses (AC-1, AC-2).
 *
 * R-SPINE-061: "Numbers, dates, currency and units render only through SEAM-FORMAT with
 * `BD_DOCUMENT` conventions (lakh/crore, ৳ prefix, DD MMM YYYY, tabular numerals in UI)."
 * L-FMT-01 names the seam and the record; L-FMT-02 says the seam does not round, renders a
 * unit from the enum rather than beside a quantity, and refuses a character the pinned
 * coverage set lacks.
 *
 * The seam is loaded inside each test rather than at the top of the file. A module that does
 * not exist yet would otherwise take the whole file down as one collection error, and a
 * single red line says far less than a list of the behaviours still missing.
 *
 * Unlike the taxonomy suite next door, this file writes both format refusal codes out in
 * full and makes each of them fire. That is deliberate: Q-07 counts a code as exercised when
 * a test names it, and a name with no firing behind it would be a code excused rather than
 * proved. Every assertion below that names one also makes the seam raise it.
 *
 * The `Intl` identifier is banned outside `src/core/format.ts` by cubit/format-seam-only —
 * which binds to `src/**` and so to this file — so where the namespace has to be named here
 * it is named as a string.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';
import { REFUSALS, REFUSAL_CODES } from '../errors';
import type { RefusalEntry } from '../errors';
import { DEFERRED_REFUSALS } from '../errors/deferrals';

const REPO = process.cwd();

/** L-FMT-01 names the file; the path is part of the law, not an implementation choice. */
const SEAM_PATH = 'src/core/format.ts';

/** The namespace L-FMT-01 confines to the seam, spelled as data (see the file header). */
const INTL_NAMESPACE = 'Intl';

/** The seam, per test: a missing module then reads as the missing feature it is. */
const seam = async () => await import('../format');

/** The registry leaf this increment adds, likewise loaded per test. */
const formatRefusals = async () => await import('../errors/format');

/** A handle on an exported formatter that lets a call carry more than the contract does. */
type Loose = (...args: readonly unknown[]) => unknown;

const loose = (fn: unknown): Loose => fn as Loose;

/** The English month abbreviations DD MMM YYYY is written with. */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Bengali digits: ASCII digits are the convention, so a rendered document holds none. */
const BENGALI_DIGIT = /[০-৯]/;

/** Money as BD_DOCUMENT writes it: the prefix, an optional minus, groups, two decimals. */
const MONEY_SHAPE = /^৳-?[0-9,]+\.[0-9]{2}$/;

/** Compact forms L-FMT-02 says are never on a document — deliberately absent, not deferred. */
const COMPACT = /\d\s*(?:L|Cr)\b/;

const entryOf = (code: string): RefusalEntry | undefined =>
  (REFUSALS as Record<string, RefusalEntry | undefined>)[code];

describe('AC-1 — BD_DOCUMENT rendering (R-SPINE-061, L-FMT-01)', () => {
  it('renders money ৳-prefixed, lakh/crore grouped, in ASCII digits', async () => {
    const { formatMoney } = await seam();

    // R-SPINE-061 verbatim: lakh/crore and the ৳ prefix. 1,23,45,678.90 is the grouping
    // en-BD would have flattened to 12,345,678.90 (L-FMT-01: the tag is banned for it).
    expect(formatMoney('12345678.90')).toBe('৳1,23,45,678.90');
    // The prefix leads; the sign follows it, against the amount it belongs to.
    expect(formatMoney('-100000.00')).toBe('৳-1,00,000.00');
    expect(formatMoney('0.00')).toBe('৳0.00');
    expect(formatMoney('1234.00')).toBe('৳1,234.00');

    for (const rendered of [formatMoney('12345678.90'), formatMoney('-100000.00')]) {
      expect(MONEY_SHAPE.test(rendered), `${rendered} is not money as BD_DOCUMENT writes it`).toBe(
        true,
      );
      expect(BENGALI_DIGIT.test(rendered), `${rendered} is not in ASCII digits`).toBe(false);
    }
  });

  it('renders plain numbers by kind, grouped the same way', async () => {
    const { formatNumber } = await seam();

    expect(formatNumber('10000000.000', 'quantity')).toBe('1,00,00,000.000');
    expect(formatNumber('12345', 'count')).toBe('12,345');
    // A count crossing the lakh boundary groups as a document does, not as the West does.
    expect(formatNumber('100000', 'count')).toBe('1,00,000');
    expect(formatNumber('0', 'count')).toBe('0');
    expect(BENGALI_DIGIT.test(formatNumber('10000000.000', 'quantity'))).toBe(false);
  });

  it('never renders a compact L or Cr suffix, at any magnitude', async () => {
    const { formatMoney, formatNumber } = await seam();

    // L-FMT-02: "Compact `L`/`Cr` never on a document." Absent, not deferred.
    const rendered = [
      formatMoney('100000.00'),
      formatMoney('10000000.00'),
      formatMoney('1000000000.00'),
      formatNumber('100000', 'count'),
      formatNumber('10000000.000', 'quantity'),
    ];
    for (const value of rendered) {
      expect(COMPACT.test(value), `${value} carries a compact suffix`).toBe(false);
      expect(/[A-Za-z]/.test(value), `${value} carries a letter`).toBe(false);
    }
  });

  it('renders dates DD MMM YYYY, with a zero-padded day and an English month', async () => {
    const { formatDate } = await seam();

    expect(formatDate({ year: 2026, month: 8, day: 3 })).toBe('03 Aug 2026');
    expect(formatDate({ year: 1970, month: 1, day: 1 })).toBe('01 Jan 1970');
    expect(formatDate({ year: 2025, month: 12, day: 31 })).toBe('31 Dec 2025');

    // Jan…Dec, the whole set: an abbreviation table is wrong in exactly one month at a time.
    for (let month = 1; month <= 12; month += 1) {
      expect(formatDate({ year: 2026, month, day: 9 })).toBe(`09 ${MONTHS[month - 1]} 2026`);
    }
  });

  it('labels a fiscal year FY2025-26', async () => {
    const { formatFiscalYear } = await seam();

    expect(formatFiscalYear(2025)).toBe('FY2025-26');
    expect(formatFiscalYear(2009)).toBe('FY2009-10');
    // Two digits of (startYear + 1) % 100 — the century turn is where a slice goes wrong.
    expect(formatFiscalYear(1999)).toBe('FY1999-00');
  });

  it('reads the Asia/Dhaka wall clock of an instant', async () => {
    const { dhakaDateParts, formatDate } = await seam();

    expect(formatDate(dhakaDateParts(0))).toBe('01 Jan 1970');
    // Month is 1–12, not the zero-based month a Date carries.
    expect(dhakaDateParts(0)).toEqual({ year: 1970, month: 1, day: 1 });
    expect(dhakaDateParts(Date.UTC(2026, 0, 15, 12)).month).toBe(1);
  });

  it('renders a unit from the closed enum, and only from it', async () => {
    const { formatUnit } = await seam();

    expect(formatUnit('m')).toBe('m');
    expect(formatUnit('m2')).toBe('m²');
    expect(formatUnit('m3')).toBe('m³');
    expect(formatUnit('kg')).toBe('kg');
    expect(formatUnit('nos')).toBe('nos');
    // L-FMT-02: the unit renders separately from its quantity — it carries no number at all.
    expect(/[0-9]/.test(formatUnit('m2'))).toBe(false);
  });

  it('compares text by collation rather than by code point', async () => {
    const { compareText } = await seam();

    expect(compareText('a', 'b')).toBeLessThan(0);
    expect(compareText('b', 'a')).toBeGreaterThan(0);
    expect(compareText('a', 'a')).toBe(0);
    // Code points put every capital before every lower-case letter; a collator does not.
    // This is what L-FMT-01 confines to the seam, and what localeCompare would leak.
    expect(compareText('a', 'B')).toBeLessThan(0);
  });

  it('states the conventions in one frozen record', async () => {
    const { BD_DOCUMENT } = await seam();

    expect(BD_DOCUMENT.locale).toBe('en-IN');
    expect(BD_DOCUMENT.currencyPrefix).toBe('৳');
    expect(BD_DOCUMENT.dateFormat).toBe('DD MMM YYYY');
    expect(BD_DOCUMENT.timeZone).toBe('Asia/Dhaka');
    expect(BD_DOCUMENT.fiscalPrefix).toBe('FY');
    expect(BD_DOCUMENT.precision).toEqual({ money: 2, quantity: 3, count: 0 });

    // Frozen down to the nested record, as the refusal registries are: a `readonly` that
    // vanishes at compile time still lets an importer edit the conventions at run time.
    expect(Object.isFrozen(BD_DOCUMENT)).toBe(true);
    expect(Object.isFrozen(BD_DOCUMENT.precision)).toBe(true);
    const mutable = BD_DOCUMENT as unknown as Record<string, unknown>;
    expect(() => {
      mutable['currencyPrefix'] = 'Tk';
    }).toThrow();
    expect(BD_DOCUMENT.currencyPrefix).toBe('৳');
  });

  it('takes a value and nothing else — no conventions record, no options bag', async () => {
    const { formatMoney, formatNumber, formatDate, formatFiscalYear, formatUnit, compareText } =
      await seam();

    // L-FMT-01: conventions are "read by conventionless call sites, never an options bag".
    expect(formatMoney).toHaveLength(1);
    expect(formatNumber).toHaveLength(2);
    expect(formatDate).toHaveLength(1);
    expect(formatFiscalYear).toHaveLength(1);
    expect(formatUnit).toHaveLength(1);
    expect(compareText).toHaveLength(2);

    // A declared arity can still hide a defaulted bag, so an offered one changes nothing.
    const options = { locale: 'en-US', currency: 'USD', useGrouping: false };
    expect(loose(formatMoney)('12345678.90', options)).toBe('৳1,23,45,678.90');
    expect(loose(formatNumber)('12345', 'count', options)).toBe('12,345');
    expect(loose(formatDate)({ year: 2026, month: 8, day: 3 }, options)).toBe('03 Aug 2026');
  });

  it('is the tree’s one file allowed to reach for the intl namespace', async () => {
    await seam();

    // L-FMT-01: the seam calls it, which is why the rule exempts this one path…
    const source = readFileSync(join(REPO, SEAM_PATH), 'utf8');
    expect(
      new RegExp(`\\b${INTL_NAMESPACE}\\b`).test(source),
      `${SEAM_PATH} formats without reaching the namespace the clause confines to it`,
    ).toBe(true);

    // …and why a repo-wide `eslint .` is silent on it all the same (AC-4's eslint stage).
    const eslint = new ESLint({ cwd: REPO, errorOnUnmatchedPattern: true });
    const results = await eslint.lintFiles([join(REPO, SEAM_PATH)]);
    const first = results[0];
    expect(first, `eslint returned no result for ${SEAM_PATH}`).toBeDefined();
    expect(
      (first?.messages ?? []).map((message) => `${message.ruleId}: ${message.message}`),
    ).toEqual([]);
  });
});

describe('AC-2 — the seam refuses rather than rounds or renders blind (L-FMT-02, Q-07)', () => {
  it('refuses a value off its kind’s precision, as PRECISION_NOT_APPLIED', async () => {
    const { formatMoney, formatNumber } = await seam();

    // L-FMT-02: "it refuses a value not rounded to the stated per-kind precision". Money is
    // stated at two fraction digits, so one is not a value this seam may render.
    expect(() => formatMoney('1.5')).toThrow(/^PRECISION_NOT_APPLIED: /);
    // Count is stated at none, so a fractional count is refused rather than truncated.
    expect(() => formatNumber('1.23', 'count')).toThrow(/^PRECISION_NOT_APPLIED: /);
    // Quantity is stated at three.
    expect(() => formatNumber('1.00', 'quantity')).toThrow(/^PRECISION_NOT_APPLIED: /);

    // The refusal is a code and a sentence, as the database seam already writes one.
    let message = '';
    try {
      formatMoney('1.5');
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    expect(message.startsWith('PRECISION_NOT_APPLIED: ')).toBe(true);
    expect(message.slice('PRECISION_NOT_APPLIED: '.length).trim()).not.toBe('');

    // And a value already at its precision renders, so the refusal is not a blanket one.
    expect(() => formatMoney('12345678.90')).not.toThrow();
    expect(() => formatNumber('12345', 'count')).not.toThrow();
    expect(() => formatNumber('1.000', 'quantity')).not.toThrow();
  });

  it('refuses a character outside the pinned coverage set, as CHARACTER_NOT_COVERED', async () => {
    const { compareText } = await seam();

    // L-FMT-02: "a character the pinned font lacks refuses CHARACTER_NOT_COVERED". U+2603
    // is outside printable ASCII and outside the Bangla block, so it is outside the set.
    expect(() => compareText('☃', 'a')).toThrow(/^CHARACTER_NOT_COVERED: /);
    expect(() => compareText('a', '☃')).toThrow(/^CHARACTER_NOT_COVERED: /);

    let message = '';
    try {
      compareText('☃', 'a');
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    expect(message.startsWith('CHARACTER_NOT_COVERED: ')).toBe(true);
    expect(message.slice('CHARACTER_NOT_COVERED: '.length).trim()).not.toBe('');

    // Inside the set: Bangla, the taka sign, the two exponents and printable ASCII.
    expect(() => compareText('ঢাকা', 'চট্টগ্রাম')).not.toThrow();
    expect(() => compareText('৳', 'a')).not.toThrow();
    expect(() => compareText('²', '³')).not.toThrow();
    expect(() => compareText('~', ' ')).not.toThrow();
  });

  it('registers both codes in the closed taxonomy, folded by the barrel', async () => {
    const { FORMAT_REFUSALS } = await formatRefusals();

    // R-SPINE-062: every code has an English message, a remedy, a severity and a surface.
    for (const code of ['PRECISION_NOT_APPLIED', 'CHARACTER_NOT_COVERED']) {
      expect(REFUSAL_CODES, `${code} is spelled by the seam and unknown to the registry`).toContain(
        code,
      );
      const entry = entryOf(code);
      expect(entry, `${code} has no row`).toBeDefined();
      expect(Object.keys(entry ?? {}).sort()).toEqual([
        'code',
        'message',
        'remedy',
        'severity',
        'surface',
      ]);
      expect(entry?.code).toBe(code);
      expect(entry?.message.trim()).not.toBe('');
      expect(entry?.remedy.trim()).not.toBe('');
      // Both bite: the Increment Spec files them as block/field.
      expect(entry?.severity).toBe('block');
      expect(entry?.surface).toBe('field');
      // The barrel adds nothing and takes nothing away from the module registry.
      expect((FORMAT_REFUSALS as Record<string, RefusalEntry | undefined>)[code]).toEqual(entry);
    }

    // Q-07's second lawful state stays unused: both codes are exercised above, by name.
    expect(DEFERRED_REFUSALS).toEqual([]);
  });
});
