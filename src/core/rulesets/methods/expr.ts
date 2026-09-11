// L-QTY-03's one statement: "the human-auditable formula string with named variables, rendered from
// the same registry template the gate evaluates". This file is what makes that ONE — an expression
// tree that prints and evaluates, so a line's printed formula and its figure cannot part.
//
// They could part before. A method carried a `TEMPLATE` string beside a hand-written `evaluate`, and
// the two were the same only while an author kept them so: an edition that gained a factor, a
// deduction, a divisor — anything that changes the arithmetic — changes one of the pair, and the
// line goes on printing what it no longer computes. That is the fault of one shape this tree closes:
// one fact kept twice, and the copies parted. The template is now `print(tree)` and the figure is
// `evaluate(tree, …)`; there is nowhere for a second reading to live (B-17, B-19).
//
// The arithmetic is the canon's exact decimal, so a figure is exact from the drawing to the page
// (B-07). Nothing here reaches a store, a clock or a model.
import { exact } from "@/core/units/canon";

/**
 * What a tree is evaluated over, stated structurally rather than imported: the gate's
 * `NormalisedBindings` satisfies this, and this file stays under the vocabulary that types a method
 * instead of importing it back — a cycle at file grain is a fault, not a detail (ARCH-01).
 */
export type BoundValues = Readonly<Record<string, { readonly value: string } | undefined>>;

/**
 * One node of a formula. A closed roster: a variable the method declared, a constant the law states,
 * and the four arithmetics a measurement is written with. A product and a sum hold a LIST rather
 * than two sides, because `count × L × B × H` is one product of four and printing it as three nested
 * pairs would print parentheses the law never wrote.
 */
export type Expr =
  | { readonly node: "var"; readonly name: string }
  | { readonly node: "const"; readonly value: string }
  | { readonly node: "product"; readonly factors: readonly Expr[] }
  | { readonly node: "sum"; readonly terms: readonly Expr[] }
  | { readonly node: "difference"; readonly minuend: Expr; readonly subtrahend: Expr }
  | { readonly node: "quotient"; readonly dividend: Expr; readonly divisor: Expr };

/** A whole formula as a method states one: what it names the answer, and the tree that answers it. */
export type Statement = { readonly result: string; readonly expr: Expr };

/** The builders, so a method states its algebra and never a string. */
export const V = (name: string): Expr => Object.freeze({ node: "var" as const, name });
export const K = (value: string): Expr => Object.freeze({ node: "const" as const, value });
export const times = (...factors: readonly Expr[]): Expr => Object.freeze({ node: "product" as const, factors: Object.freeze([...factors]) });
export const plus = (...terms: readonly Expr[]): Expr => Object.freeze({ node: "sum" as const, terms: Object.freeze([...terms]) });
export const minus = (minuend: Expr, subtrahend: Expr): Expr => Object.freeze({ node: "difference" as const, minuend, subtrahend });
export const over = (dividend: Expr, divisor: Expr): Expr => Object.freeze({ node: "quotient" as const, dividend, divisor });

/** The signs a formula is printed with — the ones a drawing's own notes are written in (L-FRM-02). */
const TIMES = " × ";
const PLUS = " + ";
const MINUS = " − ";
const OVER = " ÷ ";

/** How tightly a node binds. A child that binds LOOSER than its parent is printed in parentheses,
 * and one that binds as tightly or tighter is not: the printed form is the algebra's own shape. */
function binding(expr: Expr): number {
  if (expr.node === "sum" || expr.node === "difference") return 1;
  if (expr.node === "product" || expr.node === "quotient") return 2;
  return 3;
}

/** One node as a reader reads it, parenthesised only where the arithmetic needs it. */
function printed(expr: Expr, outer: number): string {
  const said = spell(expr);
  return binding(expr) < outer ? `(${said})` : said;
}

function spell(expr: Expr): string {
  switch (expr.node) {
    case "var":
      return expr.name;
    case "const":
      return expr.value;
    case "product":
      return expr.factors.map((factor) => printed(factor, 2)).join(TIMES);
    case "sum":
      return expr.terms.map((term) => printed(term, 1)).join(PLUS);
    case "difference":
      // The subtrahend binds one tighter than the minuend: `a − (b + c)` keeps its parentheses.
      return `${printed(expr.minuend, 1)}${MINUS}${printed(expr.subtrahend, 2)}`;
    case "quotient":
      return `${printed(expr.dividend, 2)}${OVER}${printed(expr.divisor, 3)}`;
  }
}

/** The formula as a person reads it on the line: `V = count × L × B × H` (L-QTY-03). */
export function print(statement: Statement): string {
  return `${statement.result} = ${spell(statement.expr)}`;
}

/** Every variable the tree names, in the order the printed form spells them. */
export function variablesOf(expr: Expr): readonly string[] {
  const named: string[] = [];
  const walk = (node: Expr): void => {
    switch (node.node) {
      case "var":
        if (!named.includes(node.name)) named.push(node.name);
        return;
      case "const":
        return;
      case "product":
        node.factors.forEach(walk);
        return;
      case "sum":
        node.terms.forEach(walk);
        return;
      case "difference":
        walk(node.minuend);
        walk(node.subtrahend);
        return;
      case "quotient":
        walk(node.dividend);
        walk(node.divisor);
    }
  };
  walk(expr);
  return Object.freeze(named);
}

/**
 * The tree's value over bindings the gate has already carried into the canonical unit of each
 * variable's dimension (L-MEA-08). A variable the tree names and the caller did not bind is the
 * caller's defect and not an answer anyone is owed: the gate refuses such an offer
 * `OFFER_NOT_TO_CONTRACT` before it reaches here, so reaching here without one means the
 * declaration and the offer disagree (ARCH-03).
 */
export function evaluate(expr: Expr, bindings: BoundValues, ruleId: string): ReturnType<typeof exact> {
  switch (expr.node) {
    case "var": {
      const bound = bindings[expr.name];
      if (bound === undefined) {
        throw new Error(`${ruleId} names ${expr.name} and was evaluated without it — a formula cannot state what it was not given (L-MEA-08)`);
      }
      return exact(bound.value);
    }
    case "const":
      return exact(expr.value);
    case "product":
      return expr.factors.reduce((product, factor) => product.mul(evaluate(factor, bindings, ruleId)), exact("1"));
    case "sum":
      return expr.terms.reduce((total, term) => total.add(evaluate(term, bindings, ruleId)), exact("0"));
    case "difference":
      return evaluate(expr.minuend, bindings, ruleId).sub(evaluate(expr.subtrahend, bindings, ruleId));
    case "quotient": {
      const divisor = evaluate(expr.divisor, bindings, ruleId);
      if (divisor.isZero()) throw new Error(`${ruleId} divides by ${spell(expr.divisor)}, which the bindings make zero — there is no figure to publish (L-QTY-02)`);
      return evaluate(expr.dividend, bindings, ruleId).div(divisor);
    }
  }
}

/**
 * A printed formula, read back as the tree it was printed from. This is not a second grammar for
 * anyone to author in: it exists so the proof can be taken — what is printed on a line is re-read
 * and re-evaluated, and the two answers are the same figure (the drift test). A string it cannot
 * read throws, because a template nobody can read back is a template that has already drifted.
 */
export function parse(text: string): Statement {
  const [head, ...rest] = text.split("=");
  if (head === undefined || rest.length !== 1) throw new Error(`a printed formula names its result once: "${text}"`);
  const tokens = String(rest[0]).match(/[()]|[×*]|[÷/]|[−-]|\+|[0-9]+(?:\.[0-9]+)?|[A-Za-z_][A-Za-z0-9_.]*/g) ?? [];
  let at = 0;
  const peek = (): string | undefined => tokens[at];
  const take = (): string => {
    const token = tokens[at];
    if (token === undefined) throw new Error(`"${text}" ends where the grammar wants a term`);
    at += 1;
    return token;
  };
  const atom = (): Expr => {
    const token = take();
    if (token === "(") {
      const inner = sum();
      if (take() !== ")") throw new Error(`"${text}" opens a parenthesis it does not close`);
      return inner;
    }
    if (/^[0-9]/.test(token)) return K(token);
    if (/^[A-Za-z_]/.test(token)) return V(token);
    throw new Error(`"${text}" states ${token} where the grammar wants a term`);
  };
  const product = (): Expr => {
    let left = atom();
    const factors: Expr[] = [left];
    for (;;) {
      const sign = peek();
      if (sign === "×" || sign === "*") {
        at += 1;
        factors.push(atom());
        continue;
      }
      if (sign === "÷" || sign === "/") {
        at += 1;
        left = over(factors.length === 1 ? (factors[0] as Expr) : times(...factors), atom());
        factors.length = 0;
        factors.push(left);
        continue;
      }
      break;
    }
    return factors.length === 1 ? (factors[0] as Expr) : times(...factors);
  };
  const sum = (): Expr => {
    let left = product();
    for (;;) {
      const sign = peek();
      if (sign === "+") {
        at += 1;
        left = plus(left, product());
        continue;
      }
      if (sign === "−" || sign === "-") {
        at += 1;
        left = minus(left, product());
        continue;
      }
      break;
    }
    return left;
  };
  const expr = sum();
  if (at !== tokens.length) throw new Error(`"${text}" carries ${String(tokens[at])} after the formula ends`);
  return { result: head.trim(), expr };
}

/**
 * The template and the evaluator a formula method publishes, BOTH taken from the one tree. A method
 * states its algebra and never a string: there is no second place for a reading to live (B-17).
 */
export function formulaFrom(statement: Statement, ruleId: string): {
  readonly template: string;
  readonly evaluate: (bindings: BoundValues) => string;
} {
  return Object.freeze({
    template: print(statement),
    evaluate: (bindings: BoundValues): string => evaluate(statement.expr, bindings, ruleId).toString(),
  });
}
