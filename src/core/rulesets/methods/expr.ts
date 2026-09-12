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
import type { RefusalCode } from "@/core/errors";
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

/**
 * The names a variable may carry: exactly what `parse` reads back as ONE name. A name the printer
 * prints and the reader cannot read back as itself is the drift this file exists to close — `L-clear`
 * prints as `L-clear` and re-reads as `L − clear`, a DIFFERENT tree that does not throw, so the proof
 * passes while the line prints a subtraction the method never wrote. The name is refused where it is
 * written, at construction, because that is where a person can still choose another (ARCH-03, B-06).
 */
const NAMEABLE = /^[A-Za-z_][A-Za-z0-9_.]*$/;

/** The builders, so a method states its algebra and never a string. */
export const V = (name: string): Expr => {
  if (!NAMEABLE.test(name)) {
    throw new Error(`"${name}" is not a variable name a printed formula can be read back from — a name is a letter or _ followed by letters, digits, _ or . (L-QTY-03)`);
  }
  return Object.freeze({ node: "var" as const, name });
};
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
  const answer = attempt(expr, bindings, ruleId);
  // The throw is for the caller who asked for a figure where there is none and has nowhere to put a
  // refusal — a test, a tool. The gate does not ask this way: it asks `attempt` and answers by name.
  if (!answer.ok) throw new Error(answer.detail);
  return answer.value;
}

/** The code a formula answers with where the arithmetic itself has no figure. Registered in core's
 * closed taxonomy, so the gate can hand it to a person unchanged (ARCH-03). */
export const FORMULA_DIVISOR_ZERO = "FORMULA_DIVISOR_ZERO" as const satisfies RefusalCode;

/** What evaluating a tree answers: the figure, or the registered refusal and the sentence a person
 * reads — never an exception, because an exception in one offer takes a whole batch with it. */
export type Attempt =
  | { readonly ok: true; readonly value: ReturnType<typeof exact> }
  | { readonly ok: false; readonly code: typeof FORMULA_DIVISOR_ZERO; readonly detail: string };

/**
 * The tree's value, or the refusal the arithmetic answers with. A zero divisor is not a defect in the
 * caller — a count read as zero is a reading a drawing can carry — so it is an ANSWER: the offer is
 * refused by name and the batch's other offers still land (L-QTY-02, L-MEA-08).
 */
export function attempt(expr: Expr, bindings: BoundValues, ruleId: string): Attempt {
  switch (expr.node) {
    case "var": {
      const bound = bindings[expr.name];
      if (bound === undefined) {
        throw new Error(`${ruleId} names ${expr.name} and was evaluated without it — a formula cannot state what it was not given (L-MEA-08)`);
      }
      return { ok: true, value: exact(bound.value) };
    }
    case "const":
      return { ok: true, value: exact(expr.value) };
    case "product": {
      let product = exact("1");
      for (const factor of expr.factors) {
        const one = attempt(factor, bindings, ruleId);
        if (!one.ok) return one;
        product = product.mul(one.value);
      }
      return { ok: true, value: product };
    }
    case "sum": {
      let total = exact("0");
      for (const term of expr.terms) {
        const one = attempt(term, bindings, ruleId);
        if (!one.ok) return one;
        total = total.add(one.value);
      }
      return { ok: true, value: total };
    }
    case "difference": {
      const minuend = attempt(expr.minuend, bindings, ruleId);
      if (!minuend.ok) return minuend;
      const subtrahend = attempt(expr.subtrahend, bindings, ruleId);
      if (!subtrahend.ok) return subtrahend;
      return { ok: true, value: minuend.value.sub(subtrahend.value) };
    }
    case "quotient": {
      const divisor = attempt(expr.divisor, bindings, ruleId);
      if (!divisor.ok) return divisor;
      if (divisor.value.isZero()) {
        return {
          ok: false,
          code: FORMULA_DIVISOR_ZERO,
          detail: `${ruleId} divides by ${spell(expr.divisor)}, which the bindings make zero — there is no figure to publish (L-QTY-02)`,
        };
      }
      const dividend = attempt(expr.dividend, bindings, ruleId);
      if (!dividend.ok) return dividend;
      return { ok: true, value: dividend.value.div(divisor.value) };
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
    // A term may be a SIGNED constant: `A × -1` is a product of two, not a subtraction with a factor
    // missing. Only a constant takes the sign — `× -A` is not a form anything prints, and reading one
    // would read a shape no printer of this file's writes (B-19).
    if ((token === "-" || token === "−") && /^[0-9]/.test(String(peek() ?? ""))) return K(`-${take()}`);
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
  readonly attempt: (bindings: BoundValues) => { readonly ok: true; readonly value: string } | { readonly ok: false; readonly code: typeof FORMULA_DIVISOR_ZERO };
} {
  return Object.freeze({
    template: print(statement),
    evaluate: (bindings: BoundValues): string => evaluate(statement.expr, bindings, ruleId).toString(),
    // What the GATE asks with: a figure or a registered refusal, never an exception thrown through a
    // batch (ARCH-03). `evaluate` above stays for the caller who has nowhere to put a refusal.
    attempt: (bindings: BoundValues) => {
      const answer = attempt(statement.expr, bindings, ruleId);
      return answer.ok ? { ok: true as const, value: answer.value.toString() } : { ok: false as const, code: answer.code };
    },
  });
}
