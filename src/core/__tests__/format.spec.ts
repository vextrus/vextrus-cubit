import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import {
  BD_DOCUMENT,
  formatNumber,
  formatTaka,
  formatDate,
  formatFiscalYear,
} from '../format';

// SEAM-FORMAT / L-FMT-01 / R-SPINE-061 — the tree's sole caller of Intl.
// Conventions are a named document-convention record read by conventionless
// call sites, never an options bag.

describe('AC-06 BD_DOCUMENT conventions (L-FMT-01, R-SPINE-061)', () => {
  it('AC-06: BD_DOCUMENT is a named convention record, not an options bag', () => {
    expect(BD_DOCUMENT).toBeTypeOf('object');
    const record = BD_DOCUMENT as unknown as Record<string, unknown>;
    // en-IN numbering for lakh/crore grouping; en-BD is banned (not a CLDR locale)
    expect(JSON.stringify(record)).toContain('en-IN');
    expect(JSON.stringify(record)).not.toContain('en-BD');
    expect(JSON.stringify(record)).toContain('Asia/Dhaka');
  });
});

describe('AC-06 formatNumber (lakh/crore grouping)', () => {
  it('AC-06: 10000000 renders 1,00,00,000', () => {
    expect(formatNumber(new Decimal(10000000))).toBe('1,00,00,000');
  });

  it('AC-06: grouping is Indian at every magnitude, with ASCII digits', () => {
    expect(formatNumber(new Decimal(100000))).toBe('1,00,000');
    expect(formatNumber(new Decimal(1000))).toBe('1,000');
    expect(formatNumber(new Decimal(0))).toBe('0');
    expect(formatNumber(new Decimal(10000000))).toMatch(/^[0-9,]+$/);
  });
});

describe('AC-06 formatTaka (৳ prefix, 2 dp money precision)', () => {
  it('AC-06: taka renders ৳1,00,00,000', () => {
    expect(formatTaka(new Decimal(10000000))).toBe('৳1,00,00,000');
  });

  it('AC-06: the taka sign is prefixed, never suffixed or spaced away', () => {
    expect(formatTaka(new Decimal(1))).toMatch(/^৳1/);
  });

  it('AC-06: money carries at most 2 decimal places', () => {
    const rendered = formatTaka(new Decimal('1234.50'));
    expect(rendered).toContain('৳');
    const fraction = rendered.split('.')[1];
    if (fraction !== undefined) {
      expect(fraction.length).toBeLessThanOrEqual(2);
    }
  });
});

describe('AC-06 formatDate / formatFiscalYear', () => {
  it('AC-06: dates render DD MMM YYYY', () => {
    expect(formatDate(new Date(2026, 7, 20, 12, 0, 0))).toBe('20 Aug 2026');
  });

  it('AC-06: the day is zero-padded to two digits', () => {
    expect(formatDate(new Date(2026, 0, 5, 12, 0, 0))).toBe('05 Jan 2026');
  });

  it('AC-06: fiscal-year labels read FY2025-26 (July–June)', () => {
    expect(formatFiscalYear(new Date(2025, 8, 15, 12, 0, 0))).toBe('FY2025-26');
    expect(formatFiscalYear(new Date(2026, 2, 1, 12, 0, 0))).toBe('FY2025-26');
  });

  it('AC-06: a July date opens the next fiscal year', () => {
    expect(formatFiscalYear(new Date(2026, 6, 1, 12, 0, 0))).toBe('FY2026-27');
  });
});
