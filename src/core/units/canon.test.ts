/**
 * AC-2(d) [debt-src-core-16u7gf] — the seed edition's units are units of the canon.
 *
 * L-MEA-01's seed states two of its seventeen parameters in square centimetres, and L-FRM-06 gives
 * the canon one home for what a unit IS and what it is worth. `cm2` was spelled in the edition and
 * never in the canon, so a reader carrying one of those parameters into the unit a rail measures in
 * asks the canon about a unit it does not know — and `toCanonical` throws out of it rather than
 * converting.
 *
 * An edition is immutable (B-20, L-REG-07): a minted edition's content is what its digest was taken
 * over, so the seed is NOT respelled in m2 — the canon learns the unit the edition already writes.
 *
 * The parameter roster is read off the seed rather than typed out here, so a parameter a later
 * edition adds is judged by this file with no edit (B-19).
 */
import { describe, expect, test } from "vitest";
import { SEED_EDITION_CONTENT } from "../rulesets/seed";
import { CANONICAL_UNIT, convert, dimensionOf, isUnit, type Unit } from "./canon";

/**
 * The one pseudo-unit the seed states that is not a physical unit at all: a ratio is a bare number,
 * and L-FRM-06's canon carries factors for quantities. It is out of this sweep's scope by name.
 */
const RATIO = "ratio";

/** Every (parameter, unit) the seed states, read from the seed itself. */
const SEED_UNITS: readonly (readonly [string, string])[] = Object.entries(SEED_EDITION_CONTENT.parameters).map(([name, parameter]) => [name, parameter.unit] as const);

describe("the canon covers every unit the seed edition writes", () => {
  test("AC-2(d): the seed states some parameters, or this file grades nothing", () => {
    expect(SEED_UNITS.length, "the seed edition carries parameters to judge the canon against").toBeGreaterThan(0);
  });

  test("AC-2(d): every seed parameter unit other than the ratio is a unit of the canon", () => {
    const unknown = SEED_UNITS.filter(([, unit]) => unit !== RATIO && !isUnit(unit)).map(([name, unit]) => `${name}: ${unit}`);
    expect(
      unknown,
      `a value an edition states is read in the unit the edition wrote it in (L-MEA-01), so a unit the canon holds no factor for is a stored value nothing can carry (L-FRM-06, B-17)`,
    ).toEqual([]);
  });

  test("AC-2(d): cm2 converts to the canonical area unit exactly", () => {
    expect(convert("500", "cm2", "m2"), "500 cm2 is 0.05 m2 exactly — one factor, taken as the quotient of the two the canon holds (L-FRM-06)").toEqual({ ok: true, value: "0.05" });
  });

  test("AC-2(d): cm2 stands in AREA, so it carries into the area's canonical unit and no other", () => {
    expect(isUnit("cm2"), "the canon knows the unit before anything asks what it is worth").toBe(true);
    expect(dimensionOf("cm2" as Unit), "a square centimetre is an area").toBe("AREA");
    expect(convert("1", "cm2", CANONICAL_UNIT.AREA).ok, "an area carries into the area's canonical unit").toBe(true);
    expect(convert("1", "cm2", CANONICAL_UNIT.VOLUME).ok, "and across dimensions there is no quotient to take (L-FRM-06)").toBe(false);
  });

  test("AC-2(d): the seed is not respelled — the parameters written in cm2 still say cm2", () => {
    // Respelling a minted edition's content re-keys it: the digest a campaign was opened under is
    // taken over exactly these values (L-REG-07, B-20). The canon moved; the edition did not.
    const inCm2 = SEED_UNITS.filter(([, unit]) => unit === "cm2").map(([name]) => name);
    expect(inCm2.length, "the seed states at least one parameter in square centimetres — the unit this criterion is about").toBeGreaterThan(0);
    for (const name of inCm2) {
      const parameter = SEED_EDITION_CONTENT.parameters[name];
      expect(parameter?.unit, `${name} is stored as the edition minted it; carrying it into m2 here would re-key a minted edition (L-REG-07)`).toBe("cm2");
    }
  });
});
