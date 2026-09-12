/**
 * The drift proof's reader IS the printer's inverse (L-QTY-03, B-17). `formula-tree-no-drift` next
 * door proves the two agree on a FIGURE; this suite proves they agree on the TREE, which is the
 * stronger claim and the one that catches what a figure cannot:
 *
 *   - a variable named `L-clear` printed as `L-clear` and re-read as `L − clear` — a different tree
 *     that does not throw, so a proof taken on figures alone passes while the line prints a
 *     subtraction the method never wrote (P3 finding E1);
 *   - a negative constant printed as `A × -1`, which the reader threw on, so the first edition to
 *     gain a negative factor would have taken the drift proof down with it (E2);
 *   - a zero divisor thrown rather than refused, which escapes `evaluateOffers` as an exception and
 *     takes the other offers of its batch with it (E3).
 *
 * Pure: the registry is data and the canon is arithmetic. Nothing here reaches a store or a clock.
 */
import { describe, expect, test } from "vitest";
import { REFUSALS } from "@/core/errors";
import { K, V, attempt, formulaFrom, over, parse, print, times, type Statement } from "@/core/rulesets/methods/expr";
import { enumerateMethods, implementationOf, methodKey, type FormulaMethod } from "@/core/rulesets/methods/registry";

/** Every formula in force, by the pair an edition cites it as. */
const FORMULAE: readonly (readonly [string, FormulaMethod])[] = enumerateMethods()
  .map((pair) => [methodKey(pair), implementationOf(pair)] as const)
  .filter((held): held is readonly [string, FormulaMethod] => held[1] !== undefined && held[1].role === "formula");

const sameTree = (statement: Statement): void => {
  expect(JSON.stringify(parse(print(statement)))).toBe(JSON.stringify(statement));
};

describe("what a formula prints reads back as the tree it was printed from", () => {
  test("the registry holds at least one formula to prove this over", () => {
    expect(FORMULAE.length, "a proof over an empty roster proves nothing").toBeGreaterThan(0);
  });

  test.each(FORMULAE.map(([key, method]) => [key, method] as const))("%s round-trips as a TREE, not merely as a figure", (_key, method) => {
    sameTree(method.tree);
  });

  test.each([
    ["a product of two", { result: "V", expr: times(V("b"), V("d")) }],
    ["a negative factor (E2)", { result: "V", expr: times(V("A"), K("-1")) }],
    ["a negative constant standing first", { result: "V", expr: times(K("-1"), V("A")) }],
    ["a quotient", { result: "V", expr: over(V("A"), V("n")) }],
    ["a name with a dot", { result: "V", expr: times(V("L.clear"), V("b")) }],
  ])("%s", (_name, statement) => {
    sameTree(statement as Statement);
  });
});

describe("E1 — a name the reader cannot read back is refused where it is written", () => {
  test.each(["L-clear", "1st", "b d", "A−B", ""])("%s is not a variable name", (name) => {
    expect(() => V(name), `"${name}" prints as itself and re-reads as something else — a tree that drifted in silence`).toThrow(/variable name/);
  });

  test("every variable of every formula in force is a name the reader reads back whole", () => {
    for (const [key, method] of FORMULAE) {
      for (const variable of method.variables) {
        expect(() => V(variable.name), `${key} declares ${variable.name}`).not.toThrow();
      }
    }
  });
});

describe("E3 — a zero divisor is an answer, not an exception", () => {
  const RULE = "R-TEST-EXPR";

  test("the tree answers the registered refusal and names nothing else", () => {
    const answer = attempt(over(V("A"), V("n")), { A: { value: "1" }, n: { value: "0" } }, RULE);
    expect(answer.ok).toBe(false);
    expect(!answer.ok && answer.code).toBe("FORMULA_DIVISOR_ZERO");
    expect(REFUSALS.FORMULA_DIVISOR_ZERO.code, "the code is one of core's closed taxonomy — the gate hands it to a person unchanged").toBe("FORMULA_DIVISOR_ZERO");
  });

  test("the shape a method publishes for the gate to ask with refuses rather than throws", () => {
    const method = formulaFrom({ result: "V", expr: over(V("A"), V("n")) }, RULE);
    expect(() => method.attempt({ A: { value: "1" }, n: { value: "0" } })).not.toThrow();
    const answer = method.attempt({ A: { value: "1" }, n: { value: "0" } });
    expect(answer.ok).toBe(false);
    expect(answer.ok ? "" : answer.code).toBe(REFUSALS.FORMULA_DIVISOR_ZERO.code);
  });

  test("a divisor the readings make a figure still answers the figure", () => {
    const method = formulaFrom({ result: "V", expr: over(V("A"), V("n")) }, RULE);
    const answer = method.attempt({ A: { value: "3" }, n: { value: "4" } });
    expect(answer.ok && answer.value).toBe("0.75");
  });
});
