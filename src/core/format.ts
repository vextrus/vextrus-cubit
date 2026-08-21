/**
 * SEAM-FORMAT — the one place a number, a date, a unit or a comparison becomes text.
 *
 * L-FMT-01: "`src/core/format.ts` is the tree's sole caller of `Intl` (including
 * `Intl.Collator`); conventions are a named document-convention record (`BD_DOCUMENT` …) read
 * by conventionless call sites, never an options bag." So every formatter below takes a value
 * and nothing else: there is no locale argument, no options bag and no second convention to
 * pick between, because a document that can be formatted two ways is a document two readers
 * disagree about. `cubit/format-seam-only` exempts this file and this file only.
 *
 * Two things this seam refuses to do (L-FMT-02):
 *
 *   1. Round. A value arrives as a decimal string already written at its kind's precision, or
 *      it does not render at all. Rounding is an accounting decision — where it happens is
 *      the caller's business and it is never a side effect of drawing text.
 *   2. Substitute a glyph. Text renders only in the coverage the document's font is pinned
 *      to; anything else refuses rather than reaching a page as a box.
 *
 * Values cross this seam as decimal strings and the grouping is done on the integer part as a
 * `bigint`, so nothing here is ever a binary float (B-07) and no magnitude is too large to
 * render. `cubit/no-float-arithmetic` binds this file: the arithmetic below is integer
 * arithmetic and string work, all of it.
 */

/** The refusal a caller reads when a value is not written at its kind's precision. */
const PRECISION_NOT_APPLIED = 'PRECISION_NOT_APPLIED';

/** The refusal a caller reads when text carries a character the pinned font lacks. */
const CHARACTER_NOT_COVERED = 'CHARACTER_NOT_COVERED';

/**
 * The document conventions, named once (L-FMT-01).
 *
 * `en-IN` is the locale tag for one reason: it is the CLDR locale that groups 1,00,00,000 the
 * way a Bangladeshi document does. `en-BD` is not a CLDR locale at all — it falls back to
 * Western grouping — which is why the tag is banned tree-wide and why the taka sign is
 * prefixed here rather than asked of a currency style.
 *
 * Frozen down to the nested record, as the refusal registries are: conventions an importer
 * can edit at run time are a default, not a convention.
 */
export const BD_DOCUMENT = Object.freeze({
  locale: 'en-IN',
  currencyPrefix: '৳',
  dateFormat: 'DD MMM YYYY',
  timeZone: 'Asia/Dhaka',
  fiscalPrefix: 'FY',
  /** Fraction digits a value of each kind is written with — exactly, never at most. */
  precision: Object.freeze({ money: 2, quantity: 3, count: 0 }),
} as const);

/** The kinds of number this seam renders, each with its own stated precision. */
export type FormatKind = 'money' | 'quantity' | 'count';

/** The closed unit enum. A unit renders from here, never from a caller's string. */
export type Unit = 'm' | 'm2' | 'm3' | 'kg' | 'nos';

/** How each unit is written on a document (L-FMT-02: from the enum, and never with a number). */
const UNIT_RENDERING: Readonly<Record<Unit, string>> = Object.freeze({
  m: 'm',
  m2: 'm²',
  m3: 'm³',
  kg: 'kg',
  nos: 'nos',
});

/** DD MMM YYYY's MMM, in English. Pinned rather than asked of a locale, which drifts. */
const MONTHS: readonly string[] = Object.freeze([
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]);

/**
 * The coverage the document's font is pinned to, as inclusive code-point ranges: printable
 * ASCII, the Bangla block (the taka sign lives in it), and the two exponents the unit table
 * writes m² and m³ with.
 *
 * Pinned data rather than a font asset, because there is no font asset yet — when one lands,
 * this set is read off it and the refusal below does not change.
 */
const COVERAGE: readonly (readonly [number, number])[] = Object.freeze([
  Object.freeze([0x0020, 0x007e] as const),
  Object.freeze([0x00b2, 0x00b3] as const),
  Object.freeze([0x0980, 0x09ff] as const),
]);

/** The one number formatter: en-IN grouping, applied to an integer, so it never rounds. */
const GROUPING = new Intl.NumberFormat(BD_DOCUMENT.locale);

/** The one date reader: the Asia/Dhaka wall clock, whatever zone the process happens to sit in. */
const DHAKA_DATE = new Intl.DateTimeFormat(BD_DOCUMENT.locale, {
  timeZone: BD_DOCUMENT.timeZone,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** The one collator: L-FMT-01 confines `Intl.Collator` here along with the rest of `Intl`. */
const COLLATOR = new Intl.Collator(BD_DOCUMENT.locale);

/** What lakh/crore grouping has to make of a crore, checked below against the runtime. */
const CRORE_GROUPED = '1,00,00,000';

/**
 * The runtime actually resolved the document's conventions — or nothing renders.
 *
 * A locale tag is a request, not a guarantee: on a Node built without full ICU `en-IN` falls
 * back to root and every amount on every document comes out with Western grouping
 * (12,345,678.90), which B-07 calls a defect. That fallback happens at run time, so no lint
 * rule and no type can catch it; only asking the formatters what they resolved to can. The
 * check runs once, at import, and reads the grouping off a real crore rather than trusting the
 * tag, because the tag is exactly the thing that lies.
 */
function requireResolvedConventions(): void {
  const grouping = GROUPING.resolvedOptions();
  const dates = DHAKA_DATE.resolvedOptions();
  const collation = COLLATOR.resolvedOptions();
  const complaints: string[] = [];
  if (!grouping.locale.startsWith(BD_DOCUMENT.locale)) {
    complaints.push(`number grouping resolved to ${grouping.locale}, not ${BD_DOCUMENT.locale}`);
  }
  if (GROUPING.format(10000000n) !== CRORE_GROUPED) {
    complaints.push(`a crore groups as ${GROUPING.format(10000000n)}, not ${CRORE_GROUPED}`);
  }
  if (grouping.numberingSystem !== 'latn' || dates.numberingSystem !== 'latn') {
    complaints.push('the numbering system is not the ASCII digits a document is written in');
  }
  if (dates.timeZone !== BD_DOCUMENT.timeZone) {
    complaints.push(`the wall clock resolved to ${dates.timeZone}, not ${BD_DOCUMENT.timeZone}`);
  }
  if (!collation.locale.startsWith('en')) {
    complaints.push(`collation resolved to ${collation.locale}, which is not an English one`);
  }
  if (complaints.length > 0) {
    throw new Error(
      `SEAM-FORMAT needs a runtime with full ICU data: ${complaints.join('; ')}. A document rendered here would be wrong rather than late.`,
    );
  }
}

requireResolvedConventions();

/** A refusal, in the shape SEAM-TENANT already writes one: a code, a colon, a sentence. */
function refuse(code: string, sentence: string): never {
  throw new Error(`${code}: ${sentence}`);
}

/** Text left-padded with zeros to `width`, for a day, a year and the tail of a fiscal label. */
function pad(text: string, width: number): string {
  let padded = text;
  while (padded.length < width) padded = `0${padded}`;
  return padded;
}

/**
 * The shape a value of `kind` must already be in: a sign, digits, and exactly the kind's
 * fraction digits — no more, no fewer, and none at all where the kind states none.
 */
function shapeOf(kind: FormatKind): RegExp {
  const digits = BD_DOCUMENT.precision[kind];
  return digits === 0
    ? /^-?[0-9]+$/
    : new RegExp(`^-?[0-9]+\\.[0-9]{${String(digits)}}$`);
}

/**
 * The value split into its sign, its grouped integer part and its fraction — or a refusal.
 *
 * L-FMT-02: "it refuses a value not rounded to the stated per-kind precision". A value at
 * another precision is not a value this seam may render at all: padding it would claim an
 * accuracy nobody measured and truncating it would quietly lose money.
 */
function render(value: string, kind: FormatKind): string {
  if (!shapeOf(kind).test(value)) {
    refuse(
      PRECISION_NOT_APPLIED,
      `${kind} renders at exactly ${String(BD_DOCUMENT.precision[kind])} fraction digits, and ${JSON.stringify(value)} is not written that way.`,
    );
  }
  const negative = value.startsWith('-');
  const magnitude = negative ? value.slice(1) : value;
  const point = magnitude.indexOf('.');
  const whole = point === -1 ? magnitude : magnitude.slice(0, point);
  const fraction = point === -1 ? '' : magnitude.slice(point);
  return `${negative ? '-' : ''}${GROUPING.format(BigInt(whole))}${fraction}`;
}

/** Every character of `text` is one the pinned font covers, or the text does not render. */
function requireCoverage(text: string): void {
  for (const character of text) {
    const point = character.codePointAt(0) ?? 0;
    if (COVERAGE.some(([from, to]) => point >= from && point <= to)) continue;
    refuse(
      CHARACTER_NOT_COVERED,
      `U+${pad(point.toString(16).toUpperCase(), 4)} is outside the coverage the document’s font is pinned to.`,
    );
  }
}

/**
 * Money, as a document writes it: the taka sign, then the amount (R-SPINE-061).
 *
 * The prefix leads and the sign follows it — ৳-1,00,000.00 — so a column of amounts lines up
 * on the sign that matters. Two fraction digits, always, because that is money's stated
 * precision and this seam does not round to it.
 */
export function formatMoney(value: string): string {
  return `${BD_DOCUMENT.currencyPrefix}${render(value, 'money')}`;
}

/** A plain number of its kind: the same lakh/crore grouping, without the currency prefix. */
export function formatNumber(value: string, kind: 'quantity' | 'count'): string {
  return render(value, kind);
}

/**
 * A whole number inside `low`…`high`, or a RangeError naming the part and what it was given.
 *
 * `pad` only ever prepends zeros, so a component it cannot widen it prints verbatim: a day of
 * -5 would reach a document as `0-5` and a day of 3.5 as `3.5`. A date part is checked before
 * it is written, not padded into something that looks like one.
 */
function requireDatePart(name: string, value: number, low: number, high: number): void {
  if (!Number.isInteger(value) || value < low || value > high) {
    throw new RangeError(
      `formatDate takes a ${name} of ${String(low)} to ${String(high)}, a whole number, not ${String(value)}.`,
    );
  }
}

/** A date as DD MMM YYYY: zero-padded day, English month, four-digit year. */
export function formatDate(parts: { year: number; month: number; day: number }): string {
  // Four digits is the whole of the year field DD MMM YYYY has room for, and a day of the month
  // is 1 to 31 — the calendar's own length per month is the caller's to know, but a date this
  // seam could not write down at all is one it refuses to draw.
  requireDatePart('year', parts.year, 1, 9999);
  requireDatePart('month', parts.month, 1, 12);
  requireDatePart('day', parts.day, 1, 31);
  const month = MONTHS[parts.month - 1];
  if (month === undefined) {
    throw new RangeError(`formatDate takes a month of the year, 1 to 12, not ${String(parts.month)}.`);
  }
  return `${pad(String(parts.day), 2)} ${month} ${pad(String(parts.year), 4)}`;
}

/**
 * The Asia/Dhaka wall-clock date of an instant, as parts (month 1–12).
 *
 * Built from the zone rather than from the process's own: a document dated by the machine's
 * ambient zone says something different depending on where it was printed.
 */
export function dhakaDateParts(epochMs: number): { year: number; month: number; day: number } {
  const parts = DHAKA_DATE.formatToParts(epochMs);
  const partValue = (type: string): number => {
    const found = parts.find((part) => part.type === type);
    // A part the runtime did not produce is not a zero. `Number(undefined ?? '')` would be one,
    // and a wall clock that quietly answers year 0 puts 0000 on a document; a reader can act on
    // a date that is missing, never on one that is wrong.
    if (found === undefined || !/^[0-9]+$/.test(found.value)) {
      throw new RangeError(
        `The Asia/Dhaka wall clock read no ${type} from this runtime for ${String(epochMs)}.`,
      );
    }
    return Number(found.value);
  };
  return { year: partValue('year'), month: partValue('month'), day: partValue('day') };
}

/** A fiscal year, labelled from the year it starts in: `formatFiscalYear(2025)` is FY2025-26. */
export function formatFiscalYear(startYear: number): string {
  // The tail is a remainder, and a remainder of a negative is negative: FY-5--4 is what an
  // unchecked -5 writes. A fiscal year starts in a year a document can carry, or it refuses.
  if (!Number.isInteger(startYear) || startYear < 1 || startYear > 9998) {
    throw new RangeError(
      `formatFiscalYear takes the year a fiscal year starts in, 1 to 9998, a whole number, not ${String(startYear)}.`,
    );
  }
  return `${BD_DOCUMENT.fiscalPrefix}${String(startYear)}-${pad(String((startYear + 1) % 100), 2)}`;
}

/** A unit, from the enum and on its own — L-FMT-02 keeps it apart from its quantity. */
export function formatUnit(unit: Unit): string {
  return UNIT_RENDERING[unit];
}

/**
 * Compare two pieces of text the way a reader orders them, not the way code points do.
 *
 * This is what `localeCompare` would have leaked to every call site with the ambient locale
 * attached; here the collator is the document's, and text that could not be rendered is not
 * text this seam will sort either.
 */
export function compareText(a: string, b: string): number {
  requireCoverage(a);
  requireCoverage(b);
  return COLLATOR.compare(a, b);
}
