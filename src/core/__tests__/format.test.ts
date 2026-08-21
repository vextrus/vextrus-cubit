/**
 * SEAM-FORMAT, unit by unit (R-SPINE-061, L-FMT-01, L-FMT-02, B-07).
 *
 * The acceptance suite next door pins the contract; this one walks the behaviour behind it —
 * the magnitudes either side of a lakh, the sign, the zone, and the two refusals. Both format
 * refusal codes are written out here in full and each of them is made to fire: Q-07 counts a
 * code as exercised when a test names it, and a name with no firing behind it is a code
 * excused rather than proved.
 *
 * The namespace L-FMT-01 confines to the seam is banned outside it by cubit/format-seam-only,
 * which binds src/** and so this file too — nothing here reaches for it.
 */
import { describe, expect, it } from 'vitest';
import {
  BD_DOCUMENT,
  compareText,
  dhakaDateParts,
  formatDate,
  formatFiscalYear,
  formatMoney,
  formatNumber,
  formatUnit,
} from '../format';
import type { FormatKind, Unit } from '../format';

/** The kinds, as the conventions record states them. */
const KINDS: readonly FormatKind[] = ['money', 'quantity', 'count'];

/** The units, as the enum closes them. */
const UNITS: readonly Unit[] = ['m', 'm2', 'm3', 'kg', 'nos'];

/** Run `body` with the process sitting in `zone`, and put the zone back afterwards. */
function inZone(zone: string, body: () => void): void {
  const before = process.env['TZ'];
  process.env['TZ'] = zone;
  try {
    body();
  } finally {
    if (before === undefined) delete process.env['TZ'];
    else process.env['TZ'] = before;
  }
}

describe('BD_DOCUMENT conventions', () => {
  it('states one convention per question the formatters ask', () => {
    expect(BD_DOCUMENT.locale).toBe('en-IN');
    expect(BD_DOCUMENT.currencyPrefix).toBe('৳');
    expect(BD_DOCUMENT.dateFormat).toBe('DD MMM YYYY');
    expect(BD_DOCUMENT.timeZone).toBe('Asia/Dhaka');
    expect(BD_DOCUMENT.fiscalPrefix).toBe('FY');
    for (const kind of KINDS) {
      expect(typeof BD_DOCUMENT.precision[kind]).toBe('number');
    }
  });

  it('is inert once imported, record and precision alike', () => {
    expect(Object.isFrozen(BD_DOCUMENT)).toBe(true);
    expect(Object.isFrozen(BD_DOCUMENT.precision)).toBe(true);
  });
});

describe('money and numbers group as a document does', () => {
  it('groups by lakh and crore either side of the boundary', () => {
    expect(formatMoney('0.00')).toBe('৳0.00');
    expect(formatMoney('999.00')).toBe('৳999.00');
    expect(formatMoney('1000.00')).toBe('৳1,000.00');
    expect(formatMoney('99999.00')).toBe('৳99,999.00');
    // The first group of two: Western grouping would read 100,000.00 here.
    expect(formatMoney('100000.00')).toBe('৳1,00,000.00');
    expect(formatMoney('12345678.90')).toBe('৳1,23,45,678.90');
    expect(formatMoney('1000000000.00')).toBe('৳1,00,00,00,000.00');
  });

  it('renders a magnitude no binary float could hold', () => {
    // Values cross this seam as decimal strings and group as integers, so precision does not
    // run out where Number's does (B-07).
    expect(formatMoney('123456789012345678901234567890.00')).toBe(
      '৳1,23,45,67,89,01,23,45,67,89,01,23,45,67,890.00',
    );
  });

  it('puts the sign against the amount, behind the prefix', () => {
    expect(formatMoney('-100000.00')).toBe('৳-1,00,000.00');
    expect(formatMoney('-0.01')).toBe('৳-0.01');
    expect(formatNumber('-12345', 'count')).toBe('-12,345');
  });

  it('renders each kind at the precision the conventions state', () => {
    expect(formatNumber('10000000.000', 'quantity')).toBe('1,00,00,000.000');
    expect(formatNumber('0.500', 'quantity')).toBe('0.500');
    expect(formatNumber('0', 'count')).toBe('0');
    expect(formatNumber('12345', 'count')).toBe('12,345');
  });

  it('never reaches for a compact suffix or a Bengali digit', () => {
    for (const rendered of [
      formatMoney('10000000.00'),
      formatNumber('10000000.000', 'quantity'),
      formatNumber('10000000', 'count'),
    ]) {
      expect(/[A-Za-z]/.test(rendered)).toBe(false);
      expect(/[০-৯]/.test(rendered)).toBe(false);
    }
  });
});

describe('dates, fiscal years and the Dhaka wall clock', () => {
  it('writes DD MMM YYYY', () => {
    expect(formatDate({ year: 2026, month: 8, day: 3 })).toBe('03 Aug 2026');
    expect(formatDate({ year: 2025, month: 12, day: 31 })).toBe('31 Dec 2025');
  });

  it('labels the fiscal year from the year it starts in', () => {
    expect(formatFiscalYear(2025)).toBe('FY2025-26');
    expect(formatFiscalYear(1999)).toBe('FY1999-00');
  });

  it('reads the Dhaka wall clock, not the process’s own', () => {
    // Asia/Dhaka is UTC+6: an instant at 18:30 UTC is already the next day there, and an
    // instant at 02:00 UTC is still the same one — whatever zone the machine sits in.
    for (const zone of ['UTC', 'America/Los_Angeles', 'Pacific/Kiritimati', 'Asia/Dhaka']) {
      inZone(zone, () => {
        expect(dhakaDateParts(0)).toEqual({ year: 1970, month: 1, day: 1 });
        expect(dhakaDateParts(Date.UTC(2026, 0, 15, 18, 30))).toEqual({
          year: 2026,
          month: 1,
          day: 16,
        });
        expect(dhakaDateParts(Date.UTC(2026, 0, 15, 2, 0))).toEqual({
          year: 2026,
          month: 1,
          day: 15,
        });
        expect(formatDate(dhakaDateParts(0))).toBe('01 Jan 1970');
      });
    }
  });
});

describe('units and collation', () => {
  it('renders every unit of the enum, and none of them with a number', () => {
    expect(UNITS.map((unit) => formatUnit(unit))).toEqual(['m', 'm²', 'm³', 'kg', 'nos']);
    for (const unit of UNITS) {
      expect(/[0-9]/.test(formatUnit(unit))).toBe(false);
    }
  });

  it('orders text as a reader does', () => {
    expect(compareText('a', 'b')).toBeLessThan(0);
    expect(compareText('b', 'a')).toBeGreaterThan(0);
    expect(compareText('a', 'a')).toBe(0);
    // Code points sort every capital ahead of every lower-case letter; a collator does not.
    expect(compareText('a', 'B')).toBeLessThan(0);
    expect(['Charlie', 'alpha', 'Bravo'].sort(compareText)).toEqual(['alpha', 'Bravo', 'Charlie']);
  });
});

describe('the seam refuses rather than deciding for its caller', () => {
  it('refuses a value off its kind’s precision with PRECISION_NOT_APPLIED', () => {
    // L-FMT-02: the formatter does not round. Too few fraction digits, too many, or none.
    expect(() => formatMoney('1.5')).toThrow(/^PRECISION_NOT_APPLIED: /);
    expect(() => formatMoney('1')).toThrow(/^PRECISION_NOT_APPLIED: /);
    expect(() => formatMoney('1.005')).toThrow(/^PRECISION_NOT_APPLIED: /);
    expect(() => formatNumber('1.23', 'count')).toThrow(/^PRECISION_NOT_APPLIED: /);
    expect(() => formatNumber('1.00', 'quantity')).toThrow(/^PRECISION_NOT_APPLIED: /);
    // And a value that is no decimal at all is no more renderable than a rounded one.
    expect(() => formatNumber('one', 'count')).toThrow(/^PRECISION_NOT_APPLIED: /);
    expect(() => formatMoney('')).toThrow(/^PRECISION_NOT_APPLIED: /);

    // The refusal names the value it read, so the caller can see what it sent.
    expect(() => formatMoney('1.5')).toThrow(/1\.5/);
  });

  it('renders a value already at its precision', () => {
    expect(() => formatMoney('12345678.90')).not.toThrow();
    expect(() => formatNumber('1.000', 'quantity')).not.toThrow();
    expect(() => formatNumber('12345', 'count')).not.toThrow();
  });

  it('refuses an uncovered character with CHARACTER_NOT_COVERED', () => {
    // Outside printable ASCII, outside the Bangla block, outside the two exponents.
    expect(() => compareText('☃', 'a')).toThrow(/^CHARACTER_NOT_COVERED: /);
    expect(() => compareText('a', '☃')).toThrow(/^CHARACTER_NOT_COVERED: /);
    expect(() => compareText('日', 'a')).toThrow(/^CHARACTER_NOT_COVERED: /);
    // The refusal says which code point it could not draw.
    expect(() => compareText('☃', 'a')).toThrow(/U\+2603/);
  });

  it('covers what a document is actually written in', () => {
    expect(() => compareText('ঢাকা', 'চট্টগ্রাম')).not.toThrow();
    expect(() => compareText(BD_DOCUMENT.currencyPrefix, 'a')).not.toThrow();
    expect(() => compareText(formatUnit('m2'), formatUnit('m3'))).not.toThrow();
    expect(() => compareText('~', ' ')).not.toThrow();
    expect(() => compareText(formatMoney('1,00,000.00'.replace(/,/g, '')), '')).not.toThrow();
  });
});
