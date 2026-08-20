import type Decimal from 'decimal.js';
import { refusal } from './errors';

/**
 * SEAM-FORMAT / L-FMT-01 — this file is the tree's sole caller of `Intl`
 * (including `Intl.Collator`). Conventions are a named document-convention
 * record read by conventionless call sites, never an options bag: a screen asks
 * `formatTaka(value)` and gets Bangladeshi document conventions, full stop.
 *
 * `en-BD` is not a CLDR locale — it falls back to Western grouping and is banned
 * here and in the lint rule. `en-IN` is what actually groups lakh and crore.
 */
export const BD_DOCUMENT = {
  name: 'BD_DOCUMENT',
  /** lakh/crore grouping: 1,00,00,000 */
  locale: 'en-IN',
  /** ASCII digits, never Bengali numerals */
  numberingSystem: 'latn',
  currencySymbol: '৳',
  currencyCode: 'BDT',
  /** money is shown with at most this many decimal places */
  moneyDecimalPlaces: 2,
  datePattern: 'DD MMM YYYY',
  /** the wall clock a date is read on — every rendered date is Dhaka-local */
  timeZone: 'Asia/Dhaka',
  /** the fiscal year opens in July: FY2025-26 runs Jul 2025 – Jun 2026 */
  fiscalYearStartMonth: 7,
} as const;

export type DocumentConvention = typeof BD_DOCUMENT;

const CENTURY = 100;

function grouper(fractionDigits: number): Intl.NumberFormat {
  return new Intl.NumberFormat(BD_DOCUMENT.locale, {
    numberingSystem: BD_DOCUMENT.numberingSystem,
    useGrouping: true,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

/**
 * Groups a decimal the way a Bangladeshi document does. The value's own
 * precision is what renders — a whole number carries no decimal point.
 */
export function formatNumber(value: Decimal): string {
  const places = value.decimalPlaces();
  // ES2023 Intl accepts a numeric string, which is how a Decimal keeps its precision
  return grouper(places).format(value.toFixed() as Intl.StringNumericLiteral);
}

/**
 * Money, ৳ prefixed. Money is a 2-decimal-place quantity: a value carrying more
 * precision has not been rounded yet, and rounding it here would hide the
 * decision, so it is refused by name (PRECISION_NOT_APPLIED).
 *
 * A value that carries a fraction renders with both places: `1234.5` is
 * ৳1,234.50, never ৳1,234.5 — a Decimal drops its trailing zero and money does
 * not. A whole number of taka carries no decimal point at all, which is the
 * rendering AC-06 pins by name (`10000000` → `৳1,00,00,000`).
 */
export function formatTaka(value: Decimal): string {
  if (value.decimalPlaces() > BD_DOCUMENT.moneyDecimalPlaces) {
    throw refusal('PRECISION_NOT_APPLIED', `${value.toFixed()} carries more than 2 decimal places`);
  }
  const places = value.decimalPlaces() === 0 ? 0 : BD_DOCUMENT.moneyDecimalPlaces;
  // ES2023 Intl accepts a numeric string, which is how a Decimal keeps its precision
  const grouped = grouper(places).format(value.toFixed(places) as Intl.StringNumericLiteral);
  return `${BD_DOCUMENT.currencySymbol}${grouped}`;
}

/**
 * `DD MMM YYYY`, on the Dhaka wall clock (`BD_DOCUMENT.timeZone`).
 *
 * The parts are the *document's* local parts, not the host process's: a
 * timestamptz read out of the database is an instant, and `getDate()` would
 * resolve it in whatever zone the server happens to run in — so a session
 * created just after Dhaka midnight would render on the previous day on a CI
 * runner in UTC. The convention record names the zone; the formatter reads it.
 */
export function formatDate(value: Date): string {
  return new Intl.DateTimeFormat(BD_DOCUMENT.locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: BD_DOCUMENT.timeZone,
    numberingSystem: BD_DOCUMENT.numberingSystem,
  }).format(value);
}

/** The year and month an instant falls in, read on the Dhaka wall clock. */
function dhakaParts(value: Date): { year: number; month: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'numeric',
    timeZone: BD_DOCUMENT.timeZone,
    numberingSystem: BD_DOCUMENT.numberingSystem,
  }).formatToParts(value);
  const read = (type: string): number => Number(parts.find((part) => part.type === type)?.value ?? '0');
  return { year: read('year'), month: read('month') };
}

/** `FY2025-26` — the fiscal year that contains the date, opening in July. */
export function formatFiscalYear(value: Date): string {
  const { year, month } = dhakaParts(value);
  const opensIn = month >= BD_DOCUMENT.fiscalYearStartMonth ? year : year - 1;
  const closesIn = String((opensIn + 1) % CENTURY).padStart(2, '0');
  return `FY${opensIn}-${closesIn}`;
}
