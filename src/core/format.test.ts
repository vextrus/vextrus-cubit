/**
 * Public acceptance for SEAM-FORMAT (L-FMT-01, L-FMT-02, R-SPINE-061, B-07): AC-1 … AC-3.
 *
 * The seam is loaded by absolute path rather than by a static specifier, exactly as
 * `tests/server/support/wire.ts` loads product modules: a module the product does not provide yet
 * must fail as an assertion naming the file, never as an unreadable resolution error.
 *
 * Nothing here calls the platform's locale machinery — L-FMT-01 makes `src/core/format.ts` its sole
 * caller, and this file is not that file. Expectations are therefore the law's own exemplars and
 * the law's own rule (last three digits, then twos), never a second implementation of the seam.
 */
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { refusalCodeOf } from "./faults/refusal-marker";

const REPO_ROOT = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const FORMAT_MODULE = "src/core/format.ts";

/** The two refusal codes L-FMT-02 names, spelled once. */
const PRECISION_NOT_APPLIED = "PRECISION_NOT_APPLIED";
const CHARACTER_NOT_COVERED = "CHARACTER_NOT_COVERED";

/**
 * The locale tag L-FMT-01 bans everywhere, this file included — so it is built, never spelled
 * (`cubit/no-raw-intl` refuses the literal in every file of the tree).
 */
const BANNED_LOCALE_TAG = ["en", "BD"].join("-");

/** The document convention's locale (L-FMT-01: `en-IN` numbering, ASCII digits). */
const DOCUMENT_LOCALE = "en-IN";

/** The taka sign, prefixed with no space (L-FMT-01). */
const TAKA = "৳";

const REQUIRED_FUNCTIONS = ["formatMoney", "formatDate", "formatFiscalYear", "formatUserFigure", "assertCharactersCovered"] as const;

interface FormatModule {
  BD_DOCUMENT: Record<string, unknown>;
  formatMoney(amount: string): string;
  formatDate(parts: { year: number; month: number; day: number }): string;
  formatFiscalYear(startYear: number): string;
  formatUserFigure(value: string): string;
  assertCharactersCovered(text: string): string;
}

let pending: Promise<FormatModule> | undefined;

/** The seam, loaded once and memoised — a failure here is every test's failure, never a skip. */
const seam = (): Promise<FormatModule> =>
  (pending ??= (async (): Promise<FormatModule> => {
    const absolute = join(REPO_ROOT, FORMAT_MODULE);
    expect(existsSync(absolute), `${FORMAT_MODULE} is missing from the checkout — the product does not provide SEAM-FORMAT yet`).toBe(true);
    const specifier: string = absolute;
    const loaded = (await import(specifier)) as FormatModule;
    for (const name of REQUIRED_FUNCTIONS) {
      expect(loaded[name], `${FORMAT_MODULE} must export \`${name}\` (SEAM-FORMAT's declared interface)`).toBeTypeOf("function");
    }
    return loaded;
  })());

interface Outcome {
  threw: boolean;
  thrown: unknown;
  returned: unknown;
}

/** Run a call and report what it did, so the assertion about it is made outside the catch. */
function outcomeOf(body: () => unknown): Outcome {
  try {
    return { threw: false, thrown: undefined, returned: body() };
  } catch (thrown) {
    return { threw: true, thrown, returned: undefined };
  }
}

/** The refusal code a call answered with, asserted to be a refusal at all (ARCH-03's marker). */
function refusalOf(body: () => unknown, what: string): string | null {
  const outcome = outcomeOf(body);
  expect(outcome.threw, `${what} must refuse — it answered ${JSON.stringify(outcome.returned)} instead`).toBe(true);
  return refusalCodeOf(outcome.thrown);
}

describe("AC-1: money renders under the BD_DOCUMENT conventions", () => {
  test("AC-1: a crore and a lakh group as last-three-then-twos, in ASCII digits, behind a bare taka sign", async () => {
    const { formatMoney } = await seam();
    expect(formatMoney("10000000.00")).toBe(`${TAKA}1,00,00,000.00`);
    expect(formatMoney("100000.00")).toBe(`${TAKA}1,00,000.00`);
  });

  test("AC-1: the grouping rule holds beyond the two exemplars — three digits, then twos, at every magnitude", async () => {
    const { formatMoney } = await seam();
    // L-FMT-01 states the rule, not a table: the last three digits form one group and every group
    // above it is a pair. Western grouping (`10,000,000.00`) is what this refuses.
    for (const digits of ["0", "1", "12", "123", "1234", "12345", "123456", "1234567", "123456789", "1000000000000"]) {
      const rendered = formatMoney(`${digits}.00`);
      expect(rendered.startsWith(TAKA), `${digits}.00 must render behind the taka sign with no space`).toBe(true);
      expect(rendered.slice(TAKA.length), `${digits}.00 must group as lakh/crore`).toBe(`${groupLakhCrore(digits)}.00`);
    }
  });

  test("AC-1: the rendered figure carries ASCII digits and no letter — never a compact form", async () => {
    const { formatMoney } = await seam();
    for (const amount of ["1.00", "100000.00", "10000000.00", "1000000000000.00"]) {
      const rendered = formatMoney(amount);
      expect(rendered.slice(TAKA.length), `${amount} must render in ASCII digits, commas and one point only`).toMatch(/^[0-9,]+\.[0-9]{2}$/);
    }
  });

  test("AC-1: formatMoney takes one decimal string and no options bag", async () => {
    const { formatMoney } = await seam();
    expect(formatMoney.length, "formatMoney(amount: string) — conventions are read from BD_DOCUMENT, never passed in (L-FMT-01)").toBe(1);
  });

  test("AC-1: BD_DOCUMENT is the named convention record, and its locale is the CLDR one", async () => {
    const { BD_DOCUMENT } = await seam();
    expect(BD_DOCUMENT, "BD_DOCUMENT must be exported as a record of conventions (L-FMT-01)").toBeTypeOf("object");
    expect(BD_DOCUMENT).not.toBeNull();
    const values = Object.values(BD_DOCUMENT);
    expect(values, `BD_DOCUMENT must state the document locale "${DOCUMENT_LOCALE}"`).toContain(DOCUMENT_LOCALE);
    expect(values, `"${BANNED_LOCALE_TAG}" is not a CLDR locale — it falls to Western grouping and is banned (L-FMT-01)`).not.toContain(BANNED_LOCALE_TAG);
  });

  test("AC-1: the banned locale tag appears nowhere in the seam's source", () => {
    // white-box: AC-1 — "the string appears nowhere in src/core/format.ts" is a property of the
    // file's text; a tag that is never reached has no runtime observable at all.
    const absolute = join(REPO_ROOT, FORMAT_MODULE);
    expect(existsSync(absolute), `${FORMAT_MODULE} is missing from the checkout — the product does not provide SEAM-FORMAT yet`).toBe(true);
    const source = readFileSync(absolute, "utf8");
    expect(source.toLowerCase().includes(BANNED_LOCALE_TAG.toLowerCase()), `"${BANNED_LOCALE_TAG}" must appear nowhere in ${FORMAT_MODULE} (L-FMT-01)`).toBe(false);
  });
});

describe("AC-2: dates and fiscal years render from local parts", () => {
  test("AC-2: the exemplar renders as DD MMM YYYY", async () => {
    const { formatDate } = await seam();
    expect(formatDate({ year: 2026, month: 8, day: 5 })).toBe("05 Aug 2026");
  });

  test("AC-2: the month is 1-based and English three-letter, the day is zero-padded", async () => {
    const { formatDate } = await seam();
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    months.forEach((name, index) => {
      expect(formatDate({ year: 2026, month: index + 1, day: 9 }), `month ${index + 1} is ${name} — the caller hands the seam 1-based wall-clock parts`).toBe(`09 ${name} 2026`);
    });
    expect(formatDate({ year: 2025, month: 1, day: 1 })).toBe("01 Jan 2025");
    expect(formatDate({ year: 2025, month: 12, day: 31 })).toBe("31 Dec 2025");
  });

  test("AC-2: the fiscal-year label is derived from its start year, not tabulated", async () => {
    const { formatFiscalYear } = await seam();
    expect(formatFiscalYear(2025)).toBe("FY2025-26");
    expect(formatFiscalYear(2026)).toBe("FY2026-27");
    expect(formatFiscalYear(2030)).toBe("FY2030-31");
  });
});

describe("AC-3: the formatter refuses instead of rounding", () => {
  test("AC-3: a value off the stated precision refuses — it is never rounded and never padded", async () => {
    const { formatMoney } = await seam();
    const outcome = outcomeOf(() => formatMoney("1.5"));
    expect(outcome.threw, `formatMoney("1.5") must refuse — it answered ${JSON.stringify(outcome.returned)}, so it padded or rounded (L-FMT-02)`).toBe(true);
    expect(refusalCodeOf(outcome.thrown)).toBe(PRECISION_NOT_APPLIED);
  });

  test("AC-3: malformed input takes the same code, not a new one", async () => {
    const { formatMoney } = await seam();
    for (const input of ["", "abc", "1,000.00"]) {
      expect(refusalOf(() => formatMoney(input), `formatMoney(${JSON.stringify(input)})`), `malformed input takes ${PRECISION_NOT_APPLIED}, never a code of its own (L-FMT-02)`).toBe(PRECISION_NOT_APPLIED);
    }
  });

  test("AC-3: covered text passes through unchanged", async () => {
    const { assertCharactersCovered } = await seam();
    const covered = `ঢাকা ${TAKA}100`;
    expect(assertCharactersCovered(covered), "text the pinned font covers is returned as it came in").toBe(covered);
  });

  test("AC-3: a character the pinned font lacks refuses", async () => {
    const { assertCharactersCovered } = await seam();
    const uncovered = "\u{13000}";
    expect(refusalOf(() => assertCharactersCovered(uncovered), `assertCharactersCovered(${JSON.stringify(uncovered)})`)).toBe(CHARACTER_NOT_COVERED);
    expect(refusalOf(() => assertCharactersCovered(`ledger ${uncovered} line`), "assertCharactersCovered of text carrying an uncovered character")).toBe(CHARACTER_NOT_COVERED);
  });
});

/**
 * L-FMT-01's grouping, stated as the law states it: the last three digits are one group and every
 * group above them is a pair. An independent reading of the rule — not a second call into the seam.
 */
function groupLakhCrore(digits: string): string {
  if (digits.length <= 3) return digits;
  const groups = [digits.slice(-3)];
  let head = digits.slice(0, -3);
  while (head.length > 2) {
    groups.unshift(head.slice(-2));
    head = head.slice(0, -2);
  }
  if (head.length > 0) groups.unshift(head);
  return groups.join(",");
}
