// The version an author might state next, offered as the field's example rather than as a value
// (R-UI-021: the act states what it needs before it is pressed). A placeholder is never submitted —
// the field stays empty until a person types, and a version the project already holds is still
// refused by name (EDITION_VERSION_TAKEN) — so this only has to be a plausible next spelling.
//
// A `YYYY.MM` version (the seed's own form, `2027.03`) advances by one month, rolling December into
// the next year; any other version ending in digits advances that last run of digits, keeping its
// width. A version with no trailing digits has no obvious successor and offers no example.

/** `YYYY.MM` — the form every edition of the seed is versioned in. */
const YEAR_MONTH = /^(\d{4})\.(\d{2})$/;

/** Any version that ends in a run of digits: the prefix, and the run. */
const TRAILING_DIGITS = /^(.*?)(\d+)$/;

/** The next version after `pinned`, as an example for the version field, or null where none is obvious. */
export function suggestedVersion(pinned: string): string | null {
  const yearMonth = YEAR_MONTH.exec(pinned);
  if (yearMonth !== null) {
    const year = Number(yearMonth[1]);
    const month = Number(yearMonth[2]);
    if (month >= 1 && month <= 12) {
      return month === 12 ? `${year + 1}.01` : `${year}.${String(month + 1).padStart(2, "0")}`;
    }
  }
  const trailing = TRAILING_DIGITS.exec(pinned);
  if (trailing === null) return null;
  const digits = trailing[2] as string;
  const next = (BigInt(digits) + 1n).toString();
  return `${trailing[1] ?? ""}${next.padStart(digits.length, "0")}`;
}
