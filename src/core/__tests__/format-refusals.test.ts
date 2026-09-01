/**
 * SEAM-FORMAT's refusal rules, each answering with a registered code (L-FMT-01, L-FMT-02,
 * R-SPINE-062) — and the boundary the zero rule sits on: a figure at no quantity is at its kind's
 * precision and is not malformed, so it renders, while a figure that is neither still refuses.
 */
import { describe, expect, test } from "vitest";
import { REFUSALS } from "../errors";
import { refusalCodeOf } from "../faults/refusal-marker";
import { assertCharactersCovered, formatDate, formatFiscalYear, formatMoney, formatSquareFeet, formatUserFigure } from "../format";

/** The code a call answered with, read off the marker rather than off the message. */
function refusalFrom(body: () => unknown): string | null {
  let thrown: unknown;
  let answered: unknown;
  let refused = false;
  try {
    answered = body();
  } catch (failure) {
    refused = true;
    thrown = failure;
  }
  expect(refused, `the call must refuse — it answered ${JSON.stringify(answered)}`).toBe(true);
  return refusalCodeOf(thrown);
}

describe("a figure at no quantity renders without a sign", () => {
  test("the signed spelling of zero answers what the unsigned one answers", () => {
    expect(formatMoney("-0.00"), "-0.00 is at money's stated precision and is not malformed, so L-FMT-02 gives the seam nothing to refuse").toBe(formatMoney("0.00"));
    expect(formatUserFigure("-0")).toBe(formatUserFigure("0"));
    expect(formatUserFigure("-0.000")).toBe(formatUserFigure("0.000"));
    expect(formatSquareFeet("-0.00")).toBe(formatSquareFeet("0.00"));
    expect(formatMoney("-0.00").includes("-"), "a document never prints a direction in front of nothing").toBe(false);
  });

  test("a figure carrying any non-zero digit keeps its sign", () => {
    expect(formatMoney("-0.01").startsWith("-"), "a paisa is a quantity").toBe(true);
    expect(formatUserFigure("-0.0001").startsWith("-"), "a non-zero digit anywhere in the fraction is a quantity (B-07)").toBe(true);
    expect(formatSquareFeet("-1.00").startsWith("-")).toBe(true);
  });
});

describe("every refusal rule the seam holds answers with its registered code", () => {
  test("a figure that is not a decimal at the stated precision refuses", () => {
    for (const malformed of ["0.0", "1,000.00", "07.00", "", "abc", "-"]) {
      expect(refusalFrom(() => formatMoney(malformed)), "the seam refuses rather than rounding or padding (L-FMT-02)").toBe(REFUSALS.PRECISION_NOT_APPLIED.code);
    }
  });

  test("formatDate refuses parts that are not wall-clock parts, and a day the month has not", () => {
    const handed = formatDate as unknown as (parts: unknown) => string;
    for (const parts of [null, "2026-02-30", { year: 2026, month: 2 }, { year: 2026, month: 13, day: 1 }, { year: 2026, month: 2, day: 29 }, { year: 2026, month: 4, day: 31 }]) {
      expect(refusalFrom(() => handed(parts)), "a 30th of February renders as no date at all (L-FMT-01)").toBe(REFUSALS.PRECISION_NOT_APPLIED.code);
    }
    expect(formatDate({ year: 2024, month: 2, day: 29 }), "2024 is a leap year, so the refusal is a rule and not a blanket").toContain("29");
  });

  test("formatFiscalYear refuses a start year it cannot label", () => {
    const handed = formatFiscalYear as unknown as (startYear: unknown) => string;
    for (const startYear of [9999, 999, 2025.5, Number.NaN, "2025", null]) {
      expect(refusalFrom(() => handed(startYear)), "a year beginning in 9999 ends in 10000, which the label's two-digit tail cannot say (L-FMT-01)").toBe(REFUSALS.PRECISION_NOT_APPLIED.code);
    }
    expect(formatFiscalYear(9998), "9998-99 is a label the seam can state").toContain("9998");
  });

  test("assertCharactersCovered refuses anything that is not text", () => {
    const handed = assertCharactersCovered as unknown as (text: unknown) => string;
    for (const value of [null, undefined, 42, ["a"], { toString: () => "a" }]) {
      expect(refusalFrom(() => handed(value)), "only text has a character repertoire to cover (L-FMT-02)").toBe(REFUSALS.CHARACTER_NOT_COVERED.code);
    }
  });
});
