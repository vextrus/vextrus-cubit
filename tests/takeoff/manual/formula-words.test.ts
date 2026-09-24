/**
 * The formula sentence read back into its parts (s-measure I-662): what the gate's own
 * `renderFormula` writes for the hand blinding's traced plate, `readFormula` takes apart into the
 * template and each variable — so the card and the Trace can say "Area 328.838 m²" rather than the
 * sentence's 28 digits, and one grammar stands on both sides.
 */
import { describe, expect, test } from "vitest";
import { renderFormula } from "@/core/gate/template";
import { readFormula } from "@/core/offers/formula";
import { MANUAL_BLINDING_FORMULA } from "@/core/rulesets/methods/manual/blinding";

describe("I-662: the formula sentence, read back", () => {
  test("the traced plate's sentence round-trips through the gate's renderer", () => {
    const sentence = renderFormula(MANUAL_BLINDING_FORMULA, {
      count: { value: "1", unit: "pcs" },
      A: { value: "328.8383712443629162090408955", unit: "m2" },
      openings: { value: "19.5", unit: "m2" },
      junctions: { value: "0", unit: "m2" },
      t: { value: "0.075", unit: "m" },
      threshold: { value: "0.5", unit: "m2" },
    });
    const parts = readFormula(sentence);
    expect(parts?.template).toBe(MANUAL_BLINDING_FORMULA.template);
    expect(parts?.variables).toEqual([
      { name: "count", state: "bound", value: "1", unit: "pcs" },
      { name: "A", state: "bound", value: "328.8383712443629162090408955", unit: "m2" },
      { name: "openings", state: "bound", value: "19.5", unit: "m2" },
      { name: "junctions", state: "bound", value: "0", unit: "m2" },
      { name: "t", state: "bound", value: "0.075", unit: "m" },
      { name: "threshold", state: "bound", value: "0.5", unit: "m2" },
    ]);
  });

  test("an omitted variable is read as the omission and its code", () => {
    const sentence = renderFormula(MANUAL_BLINDING_FORMULA, { count: { value: "1", unit: "pcs" }, A: { value: "2", unit: "m2" }, openings: { value: "0", unit: "m2" }, junctions: { value: "0", unit: "m2" }, threshold: { value: "0.5", unit: "m2" } }, [
      { variable: "t", code: "READING_UNSTATED" } as never,
    ]);
    expect(readFormula(sentence)?.variables.find((variable) => variable.name === "t")).toEqual({ name: "t", state: "omitted", code: "READING_UNSTATED" });
  });

  test("a sentence it does not recognise answers null, never half a formula", () => {
    expect(readFormula("V = A × t")).toBeNull();
    expect(readFormula("V = A × t (A = about ten m2)")).toBeNull();
    expect(readFormula("")).toBeNull();
  });
});
