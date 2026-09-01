// L-FRM-06's refusals, exercised by name (Q-07): a conversion that has no meaning answers a
// registered code and no number.
//
// The point being proved is structural, not numeric. It is not enough that a bad conversion returns
// something falsy — the failure arm must carry no value at all, so that a caller who forgot to
// check `ok` cannot read a quantity that was never derived (B-21). Each case therefore asks what
// keys the answer actually has, not merely what they hold.
import { describe, expect, test } from "vitest";
import { CONVERSION_REFUSALS, convert, toCanonical } from "../canon";

/** A product that says what one bag of it holds — 50 kg of cement, the sack the trade buys. */
const CEMENT = { factors: { bag: 50 } };

describe("L-FRM-06: cross-dimension conversion refuses with DIMENSION_MISMATCH", () => {
  test("a mass in a length's unit is DIMENSION_MISMATCH, and the answer carries no value", () => {
    const answered = convert(1, "kg", "m");
    expect(answered.ok, "kg and m measure different things, so there is nothing to convert").toBe(false);
    if (answered.ok) return;
    expect(answered.code).toBe("DIMENSION_MISMATCH");
    expect(Object.hasOwn(answered, "value"), "the failure arm of a conversion carries no value (L-FRM-06)").toBe(false);
  });

  test("DIMENSION_MISMATCH is a registered refusal, with a message and a remedy", () => {
    const entry = CONVERSION_REFUSALS.DIMENSION_MISMATCH;
    expect(entry.code).toBe("DIMENSION_MISMATCH");
    expect(entry.message.trim(), "a registered refusal says what was refused").not.toBe("");
    expect(entry.remedy.trim(), "a registered refusal says what resolves it").not.toBe("");
  });
});

describe("L-FRM-06: a packaging unit refuses with PRODUCT_FACTOR_MISSING rather than assuming 1.0", () => {
  test("toCanonical of a bag with no product carries no factor and no dimension", () => {
    const answered = toCanonical("bag");
    expect(answered.ok, "a bag holds nothing until a product says how much").toBe(false);
    if (answered.ok) return;
    expect(answered.code).toBe("PRODUCT_FACTOR_MISSING");
    expect(Object.hasOwn(answered, "factor"), "the failure arm carries no factor — never a silent 1.0 (L-FRM-06)").toBe(false);
    expect(Object.hasOwn(answered, "dimension"), "a unit that did not resolve has no dimension either").toBe(false);
  });

  test("a product whose factors say nothing about this packaging refuses the same way", () => {
    const answered = toCanonical("drum", CEMENT);
    expect(answered.ok, "cement states what a bag holds, not what a drum holds").toBe(false);
    if (!answered.ok) expect(answered.code).toBe("PRODUCT_FACTOR_MISSING");
  });

  test("convert through a packaging unit refuses with PRODUCT_FACTOR_MISSING and no value", () => {
    const answered = convert(2, "bag", "kg");
    expect(answered.ok).toBe(false);
    if (answered.ok) return;
    expect(answered.code).toBe("PRODUCT_FACTOR_MISSING");
    expect(Object.hasOwn(answered, "value"), "a refused conversion carries no value").toBe(false);
  });

  test("with the product's factor the same conversion resolves, and it is the stated factor", () => {
    const resolved = toCanonical("bag", CEMENT);
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    expect(resolved.factor, "one bag of this product is what the product says it is").toBe(50);
    expect(resolved.dimension).toBe("MASS");

    const converted = convert(2, "bag", "kg", CEMENT);
    expect(converted.ok && converted.value, "two bags of a 50 kg product are 100 kg").toBe(100);
  });

  test("PRODUCT_FACTOR_MISSING is a registered refusal, with a message and a remedy", () => {
    const entry = CONVERSION_REFUSALS.PRODUCT_FACTOR_MISSING;
    expect(entry.code).toBe("PRODUCT_FACTOR_MISSING");
    expect(entry.message.trim()).not.toBe("");
    expect(entry.remedy.trim()).not.toBe("");
  });
});

describe("L-FRM-06: a unit the canon does not know, and a rate basis, are UNIT_UNKNOWN", () => {
  test("a rate basis has no factor — it says how a price is quoted, not how work is measured", () => {
    for (const basis of ["job", "LS", "hour", "per % cft"]) {
      const answered = toCanonical(basis);
      expect(answered.ok, `"${basis}" is a rate basis, not a unit`).toBe(false);
      if (!answered.ok) expect(answered.code, `"${basis}" is not a unit the canon knows`).toBe("UNIT_UNKNOWN");
    }
  });

  test("UNIT_UNKNOWN is a registered refusal, and its failure arm carries nothing else", () => {
    const entry = CONVERSION_REFUSALS.UNIT_UNKNOWN;
    expect(entry.code).toBe("UNIT_UNKNOWN");
    expect(entry.message.trim()).not.toBe("");
    const answered = convert(1, "furlong", "m");
    expect(answered.ok).toBe(false);
    if (answered.ok) return;
    expect(answered.code).toBe("UNIT_UNKNOWN");
    expect(Object.hasOwn(answered, "value")).toBe(false);
  });
});
