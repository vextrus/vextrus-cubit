// SEAM-FORMAT, L-FMT-01: this file is the tree's sole caller of the platform's locale machinery,
// and the conventions it applies are a named document record read by conventionless call sites —
// never an options bag handed in at the call. L-FMT-02: the seam does not round. A value that is
// not exactly at its kind's precision is refused, and so is input that is not a decimal at all;
// both take one code, because "nearly right" and "not a number" are the same answer to a document.
//
// ARCH-03, B-21: a refusal is an answer, not a fault. It travels as the settled core marker — an
// Error carrying a string `refusalCode`, which `faults/refusal-marker.ts` is the one reader of. The
// codes themselves belong to the closed taxonomy in `./errors` (R-SPINE-062, ARCH-02) — this seam
// names two of them and registers none of its own.
import { refusalOf, type RefusalCode } from "./errors";

/**
 * The document convention (L-FMT-01). `en-IN` is the CLDR locale whose numbering groups the last
 * three digits and then twos — `1,00,00,000` — in ASCII digits; the taka sign prefixes the figure
 * with no space; dates are `DD MMM YYYY` built from Asia/Dhaka wall-clock parts, so the month
 * names are pinned here rather than read from the platform, whose short forms vary by ICU release.
 */
export const BD_DOCUMENT = Object.freeze({
  locale: "en-IN",
  numberingSystem: "latn",
  currencySymbol: "৳",
  timeZone: "Asia/Dhaka",
  /** Money's stated per-kind precision: taka carry two paisa digits, exactly (L-FMT-02). */
  moneyFractionDigits: 2,
  fiscalYearPrefix: "FY",
  months: Object.freeze(["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const),
} as const);

/** A figure that is not exactly at its kind's precision, or is not a decimal at all (L-FMT-02). */
const PRECISION_NOT_APPLIED: RefusalCode = "PRECISION_NOT_APPLIED";

/** Text carrying a character the pinned document font has no glyph for (L-FMT-02). */
const CHARACTER_NOT_COVERED: RefusalCode = "CHARACTER_NOT_COVERED";

/**
 * The grouping engine, built once. The integer part is handed over as a `bigint` so a ledger figure
 * beyond the safe integer range groups exactly — B-07 keeps money off floats end to end.
 */
const GROUPING = new Intl.NumberFormat(BD_DOCUMENT.locale, {
  numberingSystem: BD_DOCUMENT.numberingSystem,
  useGrouping: true,
  maximumFractionDigits: 0,
});

/**
 * An integer part as a figure is written: `0`, or a digit string that does not begin with one. A
 * leading zero is a shape the seam has no answer for but the one it refuses with — normalising
 * `0007` to `7` would be the seam transforming the figure it was handed (L-FMT-02).
 */
const INTEGER_PART = "(0|[1-9]\\d*)";

/** Money: a sign, an integer part, and exactly the paisa digits the convention states. */
const MONEY_SHAPE = new RegExp(`^(-?)${INTEGER_PART}\\.(\\d{${BD_DOCUMENT.moneyFractionDigits}})$`);

/** A user-owned figure: a sign, an integer part, and whatever fraction the human wrote (B-07). */
const USER_FIGURE_SHAPE = new RegExp(`^(-?)${INTEGER_PART}(?:\\.(\\d+))?$`);

/**
 * What the pinned document font covers, as data. ARCH-01 keeps `src/core` from reaching into the
 * UI's font assets, so the repertoire is stated here: printable ASCII, the Bengali block (the taka
 * sign U+09F3 among it), and the typographic punctuation the product's copy is written with. The
 * line and tab breaks a multi-line field is written with are here too: they are the shape of the
 * text, not characters a font could be missing, and `CHARACTER_NOT_COVERED` is only for the latter.
 */
const COVERED_RANGES: readonly (readonly [number, number])[] = [
  [0x0009, 0x000a], // tab, line feed — layout of a multi-line field, not glyphs a font can lack
  [0x000d, 0x000d], // carriage return, the other half of a CRLF break
  [0x0020, 0x007e], // printable ASCII
  [0x00a0, 0x00a0], // no-break space
  [0x0980, 0x09ff], // Bengali, including ৳
  [0x2013, 0x2014], // en dash, em dash
  [0x2018, 0x2019], // single curly quotes
  [0x201c, 0x201d], // double curly quotes
  [0x2022, 0x2022], // bullet
  [0x2026, 0x2026], // ellipsis
];

/** A decimal string taken apart, with the fraction absent when the writer wrote none. */
interface DecimalParts {
  sign: string;
  integer: string;
  fraction: string | undefined;
}

/**
 * Money under the document convention: `৳1,00,00,000.00`. The amount arrives as a decimal string —
 * B-07 keeps the value exact from the database's `numeric` to the page — and carries exactly two
 * fraction digits, or it is refused rather than rounded or padded (L-FMT-02).
 */
export function formatMoney(amount: string): string {
  const { sign, integer, fraction } = decimalParts(amount, MONEY_SHAPE);
  return `${sign}${BD_DOCUMENT.currencySymbol}${group(integer)}.${fraction ?? ""}`;
}

/**
 * A user-owned free-precision figure (B-07): the integer part is grouped by this seam and the
 * human's own fraction is appended verbatim — grouping is the seam's, precision is theirs. Input
 * that is not a decimal at all is refused with the seam's one code (L-FMT-02).
 */
export function formatUserFigure(value: string): string {
  const { sign, integer, fraction } = decimalParts(value, USER_FIGURE_SHAPE);
  return `${sign}${group(integer)}${fraction === undefined ? "" : `.${fraction}`}`;
}

/**
 * R-SPINE-010's target GFA is stored in m² and displayed in square feet as well. The factor is one
 * fact and lives here, in the seam that renders figures, so no screen and no stylesheet spells it.
 */
const SFT_PER_M2 = "10.7639";

/** The factor as an exact scaled integer: B-07 keeps a figure a person entered off floats. */
const SFT_FACTOR = { unscaled: BigInt(SFT_PER_M2.replace(".", "")), scale: 10n ** BigInt(SFT_PER_M2.split(".")[1]?.length ?? 0) } as const;

/**
 * A target area in square metres, as the square feet a reader knows it by — grouped like any other
 * user-owned figure and stated to the whole foot, because a target is a target and not a
 * measurement (L-FMT-01). Input that is not a decimal is refused, like every other figure here.
 */
export function formatSquareFeet(areaM2: string): string {
  const { sign, integer, fraction } = decimalParts(areaM2, USER_FIGURE_SHAPE);
  const scale = SFT_FACTOR.scale * 10n ** BigInt(fraction?.length ?? 0);
  const product = BigInt(`${integer}${fraction ?? ""}`) * SFT_FACTOR.unscaled;
  // Half up, on the magnitude: the sign is carried separately, so the rounding never depends on it.
  const whole = (product + scale / 2n) / scale;
  const figure = formatUserFigure(whole.toString());
  return whole === 0n ? figure : `${sign}${figure}`;
}

/**
 * A date as `DD MMM YYYY` (L-FMT-01). The caller hands over Asia/Dhaka wall-clock parts with a
 * 1-based month — never an epoch and never a `Date`, because an instant carries a zone with it and
 * the document's day is the one the reader is standing in. Parts that are not a real day are
 * refused rather than rolled over: a 30th of February renders as no date at all.
 */
export function formatDate(parts: { year: number; month: number; day: number }): string {
  if (typeof parts !== "object" || parts === null) throw refusal(PRECISION_NOT_APPLIED, "a date renders from wall-clock parts, so there must be parts (L-FMT-01)");
  const { year, month, day } = parts;
  if (!isWholeNumber(year) || year < 1 || year > 9999) throw refusal(PRECISION_NOT_APPLIED, "a date's year must be a whole four-digit year (L-FMT-01)");
  if (!isWholeNumber(month) || month < 1 || month > BD_DOCUMENT.months.length) throw refusal(PRECISION_NOT_APPLIED, "a date's month must be 1-based wall-clock part between 1 and 12 (L-FMT-01)");
  if (!isWholeNumber(day) || day < 1 || day > daysInMonth(year, month)) throw refusal(PRECISION_NOT_APPLIED, "a date's day must be a day that month actually has (L-FMT-01)");
  return `${pad(day, 2)} ${BD_DOCUMENT.months[month - 1]} ${pad(year, 4)}`;
}

/**
 * The fiscal-year label for a year that begins in `startYear`: `FY2025-26` (L-FMT-01). Derived from
 * the start year, so no table of labels can drift away from the years it names. The last year the
 * label can name is 9998-99: a year beginning in 9999 ends in 10000, which the two-digit tail of
 * `FY2025-26` cannot say, and the seam refuses a label it cannot state rather than writing `-00`.
 */
export function formatFiscalYear(startYear: number): string {
  if (!isWholeNumber(startYear) || startYear < 1000 || startYear > 9998) throw refusal(PRECISION_NOT_APPLIED, "a fiscal year is labelled from a whole four-digit start year whose following year is four digits too (L-FMT-01)");
  return `${BD_DOCUMENT.fiscalYearPrefix}${startYear}-${pad((startYear + 1) % 100, 2)}`;
}

/**
 * The text back unchanged when the pinned document font covers every character of it; otherwise a
 * `CHARACTER_NOT_COVERED` refusal (L-FMT-02) — a document never renders a character as a blank box.
 */
export function assertCharactersCovered(text: string): string {
  if (typeof text !== "string") throw refusal(CHARACTER_NOT_COVERED, "only text has a character repertoire to cover (L-FMT-02)");
  for (const character of text) {
    const point = character.codePointAt(0) ?? 0;
    if (!COVERED_RANGES.some(([from, to]) => point >= from && point <= to)) {
      throw refusal(CHARACTER_NOT_COVERED, `the pinned document font has no glyph for U+${point.toString(16).toUpperCase().padStart(4, "0")} (L-FMT-02)`);
    }
  }
  return text;
}

/**
 * A decimal string taken apart against its kind's shape. Everything the shape does not admit —
 * a short fraction, a long one, a thousands separator already applied, an empty string, a value
 * that is not a string at all — is one refusal, never a code per malformation (L-FMT-02).
 */
function decimalParts(value: string, shape: RegExp): DecimalParts {
  const matched = typeof value === "string" ? shape.exec(value) : null;
  if (matched === null) throw refusal(PRECISION_NOT_APPLIED, "the figure is not a decimal at exactly the stated precision — the seam refuses rather than rounding or padding (L-FMT-02)");
  const sign = matched[1] ?? "";
  const integer = matched[2] ?? "";
  const fraction = matched[3];
  // Zero carries no sign. `-0.00` is a figure at no quantity wearing a direction, and rendering it
  // as `-৳0.00` would put a minus on a document in front of nothing (L-FMT-02).
  if (sign === "-" && !/[1-9]/.test(`${integer}${fraction ?? ""}`)) {
    throw refusal(PRECISION_NOT_APPLIED, "a zero figure carries no sign — the seam refuses a negative zero rather than rendering one (L-FMT-02)");
  }
  return { sign, integer, fraction };
}

/** The integer part, grouped lakh/crore in ASCII digits (L-FMT-01). */
function group(integer: string): string {
  return GROUPING.format(BigInt(integer));
}

/**
 * An error carrying the core refusal marker `faults/refusal-marker.ts` reads (ARCH-03, B-21). The
 * code is taken from the closed taxonomy (R-SPINE-062): `refusalOf` answers only for a registered
 * code, so a refusal this seam throws is one the registry can put a message and a remedy to. The
 * `message` here is the operator's detail and stays out of the registry.
 */
function refusal(refusalCode: RefusalCode, message: string): Error {
  return Object.assign(new Error(message), { refusalCode: refusalOf(refusalCode).code });
}

/** A part of a date is a count of days or months, so a fraction of one is not a part at all. */
function isWholeNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value);
}

/** How many days that month has, leap years included — the Gregorian rule, stated once. */
function daysInMonth(year: number, month: number): number {
  if (month === 2) return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 29 : 28;
  return month === 4 || month === 6 || month === 9 || month === 11 ? 30 : 31;
}

/** Zero-padding for the fixed-width parts of a label — `05`, `2026`, `26`. */
function pad(value: number, width: number): string {
  return String(value).padStart(width, "0");
}
