/**
 * AC-5 — the unit canon: one exact factor per unit, every pair a quotient, and two structural
 * refusals that carry no number at all (L-FRM-06).
 *
 * L-FRM-06 fixes five constants by hand — 0.028316846592 m³/cft, 0.3048 m/ft, 0.09290304 m²/sft,
 * 1000 kg/MT, 0.45359237 kg/lb — and those five are the only literals this file spells: they are the
 * law's own text, not a snapshot of the tree. Everything else is derived. Which units exist, which
 * dimension each stands in and what every pair converts to are read out of `UNITS`, `DIMENSIONS`,
 * `CANONICAL_UNIT` and `factorOf`, so a unit the canon gains tomorrow is held to the same quotient
 * rule with no edit here (B-19).
 *
 * The arithmetic is the seam's own (B-07, riskNotes 2): decimal.js at precision 40, rounded half to
 * even — the same clone `src/core/scale/law.ts` already renders a factor through. A double would not
 * answer 1000 ÷ 0.45359237 the way a decimal does, so the expectation is computed here in decimals
 * rather than checked to a tolerance.
 */
import Decimal from "decimal.js";
import { describe, expect, test } from "vitest";
import { REFUSALS } from "../../src/core/errors";
import { byCodePoint, canon, named } from "./support/canon";

const UNITS_HOME = "src/core/units";

/** The arithmetic every conversion is spoken in (riskNotes 2 — the clone the scale law already uses). */
const Exact = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_EVEN });

/** The two structural refusals L-FRM-06 names, as the register spells them. */
const DIMENSION_MISMATCH = "DIMENSION_MISMATCH";
const PRODUCT_FACTOR_MISSING = "PRODUCT_FACTOR_MISSING";

/** The packaging unit AC-5 names, so a packaging unit is asked for by name as well as by roster. */
const BAG = "bag";

/**
 * The exact constants L-FRM-06 writes out, and the canonical units it fixes at one. These are the
 * clause's own text — the one thing in this file that is transcribed, because the clause is what
 * defines them.
 */
const EXACT_FACTORS: readonly { readonly unit: string; readonly dimension: string; readonly factor: string }[] = [
  { unit: "cft", dimension: "VOLUME", factor: "0.028316846592" },
  { unit: "ft", dimension: "LENGTH", factor: "0.3048" },
  { unit: "sft", dimension: "AREA", factor: "0.09290304" },
  { unit: "MT", dimension: "MASS", factor: "1000" },
  { unit: "lb", dimension: "MASS", factor: "0.45359237" },
  { unit: "kg", dimension: "MASS", factor: "1" },
  { unit: "m3", dimension: "VOLUME", factor: "1" },
  { unit: "m", dimension: "LENGTH", factor: "1" },
  { unit: "m2", dimension: "AREA", factor: "1" },
  { unit: "pcs", dimension: "COUNT", factor: "1" },
];

type Answer = Record<string, unknown> & { readonly ok?: unknown };

type Canon = {
  readonly DIMENSIONS: readonly string[];
  readonly UNITS: readonly string[];
  readonly PACKAGING_UNITS: readonly string[];
  readonly CANONICAL_UNIT: Readonly<Record<string, string>>;
  readonly factorOf: (unit: string) => unknown;
  readonly toCanonical: (unit: string) => Answer;
  readonly convert: (value: number, from: string, to: string) => Answer;
};

let loading: Promise<Canon> | undefined;

const theCanon = (): Promise<Canon> =>
  (loading ??= (async () => {
    const units = await canon();
    return {
      DIMENSIONS: named<readonly string[]>(units, "DIMENSIONS", UNITS_HOME),
      UNITS: named<readonly string[]>(units, "UNITS", UNITS_HOME),
      PACKAGING_UNITS: named<readonly string[]>(units, "PACKAGING_UNITS", UNITS_HOME),
      CANONICAL_UNIT: named<Readonly<Record<string, string>>>(units, "CANONICAL_UNIT", UNITS_HOME),
      factorOf: named<(unit: string) => unknown>(units, "factorOf", UNITS_HOME),
      toCanonical: named<(unit: string) => Answer>(units, "toCanonical", UNITS_HOME),
      convert: named<(value: number, from: string, to: string) => Answer>(units, "convert", UNITS_HOME),
    };
  })());

/** A refusing answer, judged whole: the code it names, and the numbers it must not carry. */
function refuses(answer: Answer, code: string, what: string): void {
  expect(answer.ok, `${what} is refused, not answered`).toBe(false);
  expect(answer["code"], `${what} refuses ${code} (L-FRM-06)`).toBe(code);
  expect("value" in answer, `${what}: a refusal carries no value — never a silent number`).toBe(false);
  expect("factor" in answer, `${what}: a refusal carries no factor — never a silent 1.0`).toBe(false);
}

/** The factor a unit carries, as the canon states it. */
const factorText = (canonical: Answer): string => String(canonical["factor"]);

describe("AC-5: the unit canon carries one exact factor per unit", () => {
  test("AC-5: each unit L-FRM-06 names canonicalises through its exact constant", async () => {
    const { toCanonical } = await theCanon();

    for (const expected of EXACT_FACTORS) {
      const answer = toCanonical(expected.unit);
      expect(answer.ok, `toCanonical(${JSON.stringify(expected.unit)}) answers a factor`).toBe(true);
      expect(answer["dimension"], `${expected.unit} is a ${expected.dimension}`).toBe(expected.dimension);
      expect(answer["factor"], `${expected.unit} carries exactly ${expected.factor} of its canonical unit (L-FRM-06)`).toBe(expected.factor);
    }
  });

  test("AC-5: every unit of the canon canonicalises, and its canonical unit is the one at 1", async () => {
    const { DIMENSIONS, UNITS, CANONICAL_UNIT, factorOf, toCanonical } = await theCanon();

    expect(byCodePoint(UNITS).length, "the canon names each unit once").toBe(new Set(UNITS).size);
    for (const unit of UNITS) {
      const answer = toCanonical(unit);
      expect(answer.ok, `toCanonical(${JSON.stringify(unit)}): a physical unit converts (L-FRM-06)`).toBe(true);
      expect(DIMENSIONS, `${unit} stands in one of the physical dimensions`).toContain(answer["dimension"]);
      expect(factorText(answer), `${unit}: the factor is a decimal string, not a float (B-07)`).toMatch(/^[0-9]+(\.[0-9]+)?$/);
      expect(String(factorOf(unit)), `factorOf(${JSON.stringify(unit)}) is the same one factor toCanonical carries — one factor per unit`).toBe(factorText(answer));
    }

    for (const dimension of DIMENSIONS) {
      const canonical = CANONICAL_UNIT[dimension];
      expect(UNITS, `CANONICAL_UNIT[${dimension}] names a unit of the canon`).toContain(canonical);
      const answer = toCanonical(String(canonical));
      expect(answer["dimension"], `${String(canonical)} is the canonical unit of ${dimension}`).toBe(dimension);
      expect(answer["factor"], `a canonical unit is one of itself — kg · m3 · m · m2 · pcs (L-FRM-06)`).toBe("1");
    }
  });

  test("AC-5: every pair within a dimension derives as the quotient of the two factors", async () => {
    const { UNITS, factorOf, toCanonical, convert } = await theCanon();
    const dimensionOf = new Map(UNITS.map((unit) => [unit, String(toCanonical(unit)["dimension"])]));

    for (const from of UNITS) {
      for (const to of UNITS) {
        if (dimensionOf.get(from) !== dimensionOf.get(to)) continue;
        const answer = convert(1, from, to);
        expect(answer.ok, `convert(1, ${JSON.stringify(from)}, ${JSON.stringify(to)}) answers`).toBe(true);
        expect(
          answer["value"],
          `one ${from} is factorOf(${from}) ÷ factorOf(${to}) of a ${to} — every pair derives as a quotient, and no pair carries a table of its own (L-FRM-06)`,
        ).toBe(new Exact(String(factorOf(from))).div(String(factorOf(to))).toString());
      }
    }
  });

  test("AC-5: one tonne is a thousand kilogrammes' worth of pounds, to the decimal the seam speaks in", async () => {
    const { convert } = await theCanon();

    expect(
      convert(1, "MT", "lb")["value"],
      "1000 ÷ 0.45359237, evaluated at precision 40 rounded half to even and spoken as its own string (riskNotes 2)",
    ).toBe(new Exact("1000").div("0.45359237").toString());
  });

  test("AC-5: a pair across two dimensions is refused DIMENSION_MISMATCH, carrying no number", async () => {
    const { UNITS, toCanonical, convert } = await theCanon();

    refuses(convert(1, "cft", "sft"), DIMENSION_MISMATCH, "convert(1, cft, sft)");

    const dimensionOf = new Map(UNITS.map((unit) => [unit, String(toCanonical(unit)["dimension"])]));
    for (const from of UNITS) {
      for (const to of UNITS) {
        if (dimensionOf.get(from) === dimensionOf.get(to)) continue;
        refuses(convert(1, from, to), DIMENSION_MISMATCH, `convert(1, ${from}, ${to}) — a ${dimensionOf.get(from)} is not a ${dimensionOf.get(to)}`);
      }
    }
  });

  test("AC-5: a packaging unit is refused PRODUCT_FACTOR_MISSING until a product says otherwise", async () => {
    const { PACKAGING_UNITS, toCanonical, convert } = await theCanon();

    expect(PACKAGING_UNITS, "the bag is one of the packaging units L-FRM-06 names").toContain(BAG);
    refuses(toCanonical(BAG), PRODUCT_FACTOR_MISSING, "toCanonical(bag)");
    refuses(convert(1, BAG, "kg"), PRODUCT_FACTOR_MISSING, "convert(1, bag, kg) — a packaging unit needs a product property, never a silent 1.0");

    for (const packaging of PACKAGING_UNITS) {
      refuses(toCanonical(packaging), PRODUCT_FACTOR_MISSING, `toCanonical(${packaging})`);
    }
  });

  test("AC-5: both refusals are registered, and the canon answers with the register's own codes", async () => {
    const { convert, toCanonical } = await theCanon();
    const register = REFUSALS as unknown as Record<string, { code?: unknown; message?: unknown; remedy?: unknown } | undefined>;

    for (const code of [DIMENSION_MISMATCH, PRODUCT_FACTOR_MISSING]) {
      const entry = register[code];
      expect(entry, `${code} is registered in src/core/errors.ts — the taxonomy is closed, so a code it lacks does not exist (Q-07, R-SPINE-062)`).toBeDefined();
      expect(entry?.code, `${code} is filed under its own name`).toBe(code);
      expect(String(entry?.message ?? "").trim().length, `${code} carries a message`).toBeGreaterThan(0);
      expect(String(entry?.remedy ?? "").trim().length, `${code} carries a remedy`).toBeGreaterThan(0);
    }

    expect(convert(1, "cft", "sft")["code"], "the canon speaks the registered code, never a spelling of its own").toBe(register[DIMENSION_MISMATCH]?.code);
    expect(toCanonical(BAG)["code"], "the canon speaks the registered code, never a spelling of its own").toBe(register[PRODUCT_FACTOR_MISSING]?.code);
  });
});
