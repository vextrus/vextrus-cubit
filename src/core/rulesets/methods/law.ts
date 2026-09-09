// L-MEA-01's methods, as a shape: what a versioned method IS, said once, where both the registry
// that maps a pair to one and the method that is one can read it.
//
// It stands apart from `registry.ts` because a method declares itself in this vocabulary and the
// registry collects methods declared in it: a method importing the registry to be typed by it would
// close a cycle (ARCH-01), and a second copy of the shape beside each method would be a second home
// for the contract (B-17, ARCH-02). This file reaches the catalogue, the canon's types and the
// contract's channel roster, and nothing that reaches back.
import type { Kind } from "../../catalogue/kinds";
import type { DeductionChannel } from "../../offers/law";
import type { Dimension, Unit } from "../../units/canon";

/** One variable a formula declares: the name its template spells, and the dimension it stands in. */
export type MethodVariable = {
  readonly name: string;
  readonly dimension: Dimension;
};

/**
 * The bindings a formula is evaluated over: every declared variable, carried into the canonical unit
 * of its dimension by the gate's one normalisation (L-MEA-08). A method never converts anything.
 */
export type NormalisedBindings = Readonly<Record<string, { readonly value: string; readonly unit: Unit }>>;

/**
 * A formula method: one template, evaluated and rendered from the same declaration (L-QTY-03: "the
 * human-auditable formula string with named variables, rendered from the same registry template the
 * gate evaluates"). `evaluate` answers an exact decimal string in the canonical unit of `dimension`.
 */
export type FormulaMethod = {
  readonly role: "formula";
  readonly ruleId: string;
  readonly version: string;
  readonly kind: Kind;
  readonly dimension: Dimension;
  readonly variables: readonly MethodVariable[];
  readonly deductionChannels: readonly DeductionChannel[];
  readonly template: string;
  readonly evaluate: (bindings: NormalisedBindings) => string;
};

/**
 * A resolver method: versioned code that decides something about a drawing rather than measuring
 * one. It publishes no quantity, so it declares no variables and no template — an offer that cited
 * one would be an offer no line could be rendered from.
 */
export type ResolverMethod = {
  readonly role: "resolver";
  readonly ruleId: string;
  readonly version: string;
  readonly resolve: (...input: never[]) => unknown;
};

/** One implementation the registry maps a pair to. */
export type MethodImplementation = FormulaMethod | ResolverMethod;
