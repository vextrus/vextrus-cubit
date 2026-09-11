/**
 * L-QTY-03's one statement, proved over the WHOLE registry: a printed formula cannot drift from the
 * figure the gate computed, because there is only one tree and both are taken from it.
 *
 * The proof is the round trip. For every formula method in force: print the tree, READ THE PRINTED
 * STRING BACK with the grammar, evaluate what was read, and compare it with the figure the method
 * itself answers. A template kept beside a hand-written evaluator passes only while an author keeps
 * the two in step; a template that is `print(tree)` passes always — and this test is what would go
 * red the day someone puts a string back (B-17, B-19).
 *
 * Pure: the registry is data and the canon is arithmetic. Nothing here reaches a store or a clock.
 */
import Decimal from "decimal.js";
import { describe, expect, test } from "vitest";
import { evaluate, parse, print, variablesOf } from "@/core/rulesets/methods/expr";
import { enumerateMethods, implementationOf, methodKey, type FormulaMethod, type NormalisedBindings } from "@/core/rulesets/methods/registry";

/** How near two readings of ONE formula must stand. The acceptance's own figure. */
const TOLERANCE = 0.001;

/** Every formula in force, by the pair an edition cites it as. */
const FORMULAE: readonly (readonly [string, FormulaMethod])[] = enumerateMethods()
  .map((pair) => [methodKey(pair), implementationOf(pair)] as const)
  .filter((held): held is readonly [string, FormulaMethod] => held[1] !== undefined && held[1].role === "formula");

/** Bindings the tree can be evaluated over: a distinct, awkward decimal per variable, so a formula
 * that dropped a factor or swapped two of them cannot agree with one that did not by luck. */
function bindingsFor(method: FormulaMethod): NormalisedBindings {
  const named = variablesOf(method.tree.expr);
  const bound: Record<string, { value: string; unit: never }> = {};
  named.forEach((name, index) => {
    bound[name] = { value: new Decimal(1.7).plus(index * 0.43).toString(), unit: "m" as never };
  });
  return bound;
}

describe("every formula prints what it computes", () => {
  test("the registry holds at least one formula to prove this over", () => {
    expect(FORMULAE.length, "a proof over an empty roster proves nothing").toBeGreaterThan(0);
  });

  test.each(FORMULAE.map(([key, method]) => [key, method] as const))("%s", (key, method) => {
    const bindings = bindingsFor(method);

    expect(method.template, `${key} prints its template from its own tree`).toBe(print(method.tree));

    const reread = parse(method.template);
    expect(reread.result, `${key}'s printed formula names the same answer`).toBe(method.tree.result);

    const fromPrinted = evaluate(reread.expr, bindings, method.ruleId);
    const fromTree = evaluate(method.tree.expr, bindings, method.ruleId);
    const answered = new Decimal(method.evaluate(bindings));

    expect(
      fromPrinted.minus(fromTree).abs().toNumber(),
      `${key}: what the line PRINTS, re-read and evaluated, is what the tree computes`,
    ).toBeLessThanOrEqual(TOLERANCE);
    expect(
      answered.minus(fromTree).abs().toNumber(),
      `${key}: what the method ANSWERS is what its tree computes — the evaluator is the tree's`,
    ).toBeLessThanOrEqual(TOLERANCE);
  });

  test.each(FORMULAE.map(([key, method]) => [key, method] as const))("%s declares every variable its tree names", (key, method) => {
    const declared = method.variables.map((variable) => variable.name);
    expect([...variablesOf(method.tree.expr)].sort(), `${key}: a variable in the algebra nobody declared is a binding the gate would never carry (L-MEA-08)`).toStrictEqual([...declared].sort());
  });

  test.each(FORMULAE.map(([key, method]) => [key, method] as const))("%s refuses to answer a binding it was not given", (key, method) => {
    const short = bindingsFor(method);
    const dropped = Object.keys(short)[0] as string;
    const missing = Object.fromEntries(Object.entries(short).filter(([name]) => name !== dropped));
    expect(() => method.evaluate(missing), `${key} cannot state what it was not given`).toThrow(dropped);
  });
});

describe("the grammar reads back what the printer writes", () => {
  /** The shapes a later edition will state — proved here so the printer's parentheses are the
   * algebra's own and not an accident of the two methods in force today. */
  const SHAPES = [
    "V = a × b × c",
    "V = (a + b) × c",
    "V = a − (b + c)",
    "V = a ÷ (b × c)",
    "V = a × b − c ÷ d",
    "V = (a − b) × (c + 2)",
  ] as const;

  test.each(SHAPES)("%s prints back as itself", (text) => {
    expect(print(parse(text)), "a printed formula read back and printed again is the same string — the round trip adds no parentheses and drops none").toBe(text);
  });

  test("a string the grammar cannot read is refused, never half-read", () => {
    expect(() => parse("V = a ×"), "a template nobody can read back has already drifted").toThrow();
    expect(() => parse("a × b"), "a printed formula names its result").toThrow();
  });
});
