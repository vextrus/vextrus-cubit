/**
 * Public acceptance for AC-3 (L-FMT-02, R-SPINE-062): SEAM-FORMAT admits a lawful zero-magnitude
 * figure, and every refusal rule it holds answers with a registered code.
 *
 * The recorded reading (this increment's spec): L-FMT-02 refuses "a value not exactly at the stated
 * per-kind precision" and malformed input. `-0.00` is exactly at money's precision and is not
 * malformed, so refusing it is the seam inventing a rule the law does not carry — it renders as the
 * zero it is, with the sign dropped. Nothing is rounded: −0 and 0 are one quantity.
 *
 * `src/core/format.test.ts` is not touched by this file and is not read by it. The seam is loaded by
 * absolute path, the idiom that file and `src/core/acts/__tests__/act-map.acceptance.test.ts`
 * already use, so a member the product does not provide fails as an assertion naming it.
 *
 * B-19: no rendered string is transcribed here. Every zero assertion states the RULE — the signed
 * spelling answers exactly what the unsigned one answers — so the day the grouping or the symbol
 * changes, this file still says the same true thing.
 */
import { existsSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { REFUSALS } from "../errors";
import { refusalCodeOf } from "../faults/refusal-marker";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

const FORMAT_MODULE = "src/core/format.ts";

/** The seam's surface as tsc reads it — a type position, erased before the transform sees it. */
type Format = typeof import("../format");

/** The two codes the seam names, read out of the closed registry rather than spelled beside it. */
const PRECISION_NOT_APPLIED = REFUSALS.PRECISION_NOT_APPLIED.code;
const CHARACTER_NOT_COVERED = REFUSALS.CHARACTER_NOT_COVERED.code;

async function seam(): Promise<Format> {
  const abs = join(REPO_ROOT, FORMAT_MODULE);
  expect(existsSync(abs) && statSync(abs).isFile(), `${FORMAT_MODULE} is missing from the checkout — SEAM-FORMAT is the tree's one renderer of figures`).toBe(true);
  const specifier: string = abs;
  return (await import(specifier)) as Format;
}

interface Outcome {
  threw: boolean;
  thrown: unknown;
  returned: unknown;
}

/** Run a call and report what it did, so every assertion about it is made outside the catch. */
function outcomeOf(body: () => unknown): Outcome {
  try {
    return { threw: false, thrown: undefined, returned: body() };
  } catch (thrown) {
    return { threw: true, thrown, returned: undefined };
  }
}

/** The refusal code a call answered with, asserted to be a refusal at all (ARCH-03's marker). */
function refusalFrom(body: () => unknown, what: string): string | null {
  const outcome = outcomeOf(body);
  expect(outcome.threw, `${what} must refuse — it answered ${JSON.stringify(outcome.returned)} instead`).toBe(true);
  return refusalCodeOf(outcome.thrown);
}

/** What a call rendered, asserted to have rendered at all. */
function renderedBy(body: () => string, what: string): string {
  const outcome = outcomeOf(body);
  expect(outcome.threw, `${what} must render — it refused with ${String(refusalCodeOf(outcome.thrown))} instead`).toBe(false);
  return String(outcome.returned);
}

describe("AC-3: a figure at no quantity renders, without a sign", () => {
  test("AC-3: a signed zero renders exactly what the unsigned zero renders", async () => {
    const { formatMoney, formatUserFigure, formatSquareFeet } = await seam();

    const zeroMoney = renderedBy(() => formatMoney("0.00"), 'formatMoney("0.00")');
    expect(
      renderedBy(() => formatMoney("-0.00"), 'formatMoney("-0.00")'),
      '"-0.00" is exactly at money\'s stated precision and is not malformed, so L-FMT-02 gives the seam nothing to refuse — it renders as the zero it is',
    ).toBe(zeroMoney);

    const zeroFigure = renderedBy(() => formatUserFigure("0"), 'formatUserFigure("0")');
    expect(renderedBy(() => formatUserFigure("-0"), 'formatUserFigure("-0")'), "a user figure at no quantity renders without a sign").toBe(zeroFigure);

    const zeroArea = renderedBy(() => formatSquareFeet("0.00"), 'formatSquareFeet("0.00")');
    expect(renderedBy(() => formatSquareFeet("-0.00"), 'formatSquareFeet("-0.00")'), "an area at no quantity renders without a sign").toBe(zeroArea);
  });

  test("AC-3: the rule holds at every spelling of no quantity, and none of them wears a minus", async () => {
    const { formatUserFigure } = await seam();
    // The rule, not three exemplars: a figure whose digits are all zero is the same quantity however
    // many of them the writer wrote, and the seam keeps their fraction verbatim either way (B-07).
    for (const magnitude of ["0", "0.0", "0.00", "0.000000"]) {
      const unsigned = renderedBy(() => formatUserFigure(magnitude), `formatUserFigure("${magnitude}")`);
      const signed = renderedBy(() => formatUserFigure(`-${magnitude}`), `formatUserFigure("-${magnitude}")`);
      expect(signed, `"-${magnitude}" is the same quantity as "${magnitude}"`).toBe(unsigned);
      expect(signed.includes("-"), "a document never prints a minus in front of nothing (L-FMT-02)").toBe(false);
    }
  });

  test("AC-3: a figure carrying any non-zero digit still keeps its sign", async () => {
    const { formatMoney, formatUserFigure, formatSquareFeet } = await seam();
    expect(renderedBy(() => formatMoney("-0.01"), 'formatMoney("-0.01")').startsWith("-"), "a paisa is a quantity, and a negative one is signed").toBe(true);
    expect(renderedBy(() => formatMoney("-1.00"), 'formatMoney("-1.00")').startsWith("-"), "a negative amount keeps its direction").toBe(true);
    expect(renderedBy(() => formatUserFigure("-0.0001"), 'formatUserFigure("-0.0001")').startsWith("-"), "a non-zero digit anywhere in the fraction is a quantity (B-07)").toBe(true);
    expect(renderedBy(() => formatSquareFeet("-1.00"), 'formatSquareFeet("-1.00")').startsWith("-"), "a negative area keeps its direction").toBe(true);
  });
});

describe("AC-3: every refusal rule the seam holds answers with its registered code", () => {
  test("AC-3: input that is not a decimal at the stated precision still refuses with PRECISION_NOT_APPLIED", async () => {
    const { formatMoney, formatUserFigure, formatSquareFeet } = await seam();
    // The boundary the zero rule moves, stated in the same test as the rule it does not move: the
    // seam refuses a figure that is not at its kind's precision, and `-0.00` is not one of those.
    expect(outcomeOf(() => formatMoney("-0.00")).threw, "a figure at money's exact precision is not a refusal (L-FMT-02)").toBe(false);
    for (const malformed of ["0.0", "0.000", "1,000.00", "07.00", "", " 1.00", "1.00 ", "abc", "-", "1e3"]) {
      expect(refusalFrom(() => formatMoney(malformed), `formatMoney(${JSON.stringify(malformed)})`), "the seam refuses rather than rounding or padding").toBe(PRECISION_NOT_APPLIED);
    }
    for (const malformed of ["007", "1.2.3", "1,0", "--1"]) {
      expect(refusalFrom(() => formatUserFigure(malformed), `formatUserFigure(${JSON.stringify(malformed)})`), "a user figure is a decimal or it is refused").toBe(PRECISION_NOT_APPLIED);
      expect(refusalFrom(() => formatSquareFeet(malformed), `formatSquareFeet(${JSON.stringify(malformed)})`), "an area is a decimal or it is refused").toBe(PRECISION_NOT_APPLIED);
    }
  });

  test("AC-3: formatDate refuses parts that are not wall-clock parts, and a day the month has not", async () => {
    const { formatDate } = await seam();
    const handed = formatDate as unknown as (parts: unknown) => string;
    for (const parts of [null, undefined, "2026-02-30", 20260230, { year: 2026, month: 2 }, { year: 2026, month: 0, day: 1 }, { year: 2026, month: 13, day: 1 }, { year: 2026.5, month: 1, day: 1 }]) {
      expect(refusalFrom(() => handed(parts), `formatDate(${JSON.stringify(parts) ?? "undefined"})`), "a date renders from wall-clock parts or not at all (L-FMT-01)").toBe(PRECISION_NOT_APPLIED);
    }
    // A day the month has not: derived from the calendar rule rather than a table of exemplars, so
    // the leap-year arm is graded too — 2026 is not a leap year, 2024 is.
    for (const parts of [{ year: 2026, month: 2, day: 29 }, { year: 2024, month: 2, day: 30 }, { year: 2026, month: 4, day: 31 }, { year: 2026, month: 1, day: 32 }, { year: 2026, month: 1, day: 0 }]) {
      expect(refusalFrom(() => handed(parts), `formatDate(${JSON.stringify(parts)})`), "a 30th of February renders as no date at all (L-FMT-01)").toBe(PRECISION_NOT_APPLIED);
    }
    // …and the days those months DO have still render, so the refusal is a rule and not a blanket.
    expect(outcomeOf(() => formatDate({ year: 2024, month: 2, day: 29 })).threw, "2024 is a leap year, so the 29th is a day February has").toBe(false);
    expect(outcomeOf(() => formatDate({ year: 2026, month: 1, day: 31 })).threw, "January has 31 days").toBe(false);
  });

  test("AC-3: formatFiscalYear refuses a start year it cannot label", async () => {
    const { formatFiscalYear } = await seam();
    const handed = formatFiscalYear as unknown as (startYear: unknown) => string;
    // 9999 is the boundary the seam states: a year beginning in 9999 ends in 10000, which the
    // two-digit tail of the label cannot say, so the seam refuses rather than writing `-00`.
    for (const startYear of [9999, 999, 0, -2025, 2025.5, Number.NaN, Number.POSITIVE_INFINITY, "2025", null, undefined]) {
      expect(refusalFrom(() => handed(startYear), `formatFiscalYear(${String(startYear)})`), "the seam refuses a label it cannot state (L-FMT-01)").toBe(PRECISION_NOT_APPLIED);
    }
    expect(outcomeOf(() => formatFiscalYear(9998)).threw, "9998-99 is a label the seam can state, so the refusal is a boundary and not a blanket").toBe(false);
  });

  test("AC-3: assertCharactersCovered refuses a non-string with CHARACTER_NOT_COVERED", async () => {
    const { assertCharactersCovered } = await seam();
    const handed = assertCharactersCovered as unknown as (text: unknown) => string;
    for (const value of [null, undefined, 42, true, ["a"], { toString: () => "a" }]) {
      expect(
        refusalFrom(() => handed(value), `assertCharactersCovered(${JSON.stringify(value) ?? String(value)})`),
        "only text has a character repertoire to cover (L-FMT-02)",
      ).toBe(CHARACTER_NOT_COVERED);
    }
    expect(outcomeOf(() => assertCharactersCovered("Plot 42 — ৳1,00,000")).threw, "covered text is answered, not refused").toBe(false);
  });
});
