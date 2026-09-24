// The formula sentence a published line states, read back into its parts (s-measure I-662).
//
// The gate writes it (`src/core/gate/template.ts`, `renderFormula`): the method's template, then —
// in one closing parenthesis — every variable the method declares, `name = value unit`, or
// `name omitted: CODE`, joined by ", ". A surface that says a formula in a QS's words (the card at a
// hand measurement's closing point, the Trace) needs the parts, and the gate is unreachable from a
// screen (SEAM-GATE), so the reading lives here, beside the offer contract, and a round-trip test
// over the gate's own renderer pins the two to one grammar (`tests/takeoff/manual/formula-words.test.ts`).
//
// It reads, it never re-writes: a sentence this does not recognise answers null, and the surface
// shows the sentence verbatim — never a half-parsed formula.

/** One variable of a formula, as the sentence states it: its value and unit, or the omission it stands under. */
export type FormulaVariable =
  | { readonly name: string; readonly state: "bound"; readonly value: string; readonly unit: string }
  | { readonly name: string; readonly state: "omitted"; readonly code: string };

/** A formula sentence taken apart: the template, then each variable in the order stated. */
export type FormulaParts = { readonly template: string; readonly variables: readonly FormulaVariable[] };

const BOUND = /^(\S+) = (-?\d+(?:\.\d+)?) (\S+)$/u;
const OMITTED = /^(\S+) omitted: (\S+)$/u;

/** The index of the parenthesis that opens the sentence's closing group, or -1 where it ends in none. */
function closingGroupAt(formula: string): number {
  if (!formula.endsWith(")")) return -1;
  let depth = 0;
  for (let at = formula.length - 1; at >= 0; at -= 1) {
    const character = formula[at];
    if (character === ")") depth += 1;
    else if (character === "(") {
      depth -= 1;
      if (depth === 0) return at;
    }
  }
  return -1;
}

/**
 * The parts of a formula sentence the gate rendered, or null where the sentence is not one it
 * renders with variables (a method that declares none states its template alone). Pure.
 */
export function readFormula(formula: string): FormulaParts | null {
  const open = closingGroupAt(formula);
  if (open <= 0 || formula[open - 1] !== " ") return null;
  const template = formula.slice(0, open - 1);
  const variables: FormulaVariable[] = [];
  for (const piece of formula.slice(open + 1, -1).split(", ")) {
    const bound = BOUND.exec(piece);
    if (bound !== null) {
      variables.push({ name: bound[1] as string, state: "bound", value: bound[2] as string, unit: bound[3] as string });
      continue;
    }
    const omitted = OMITTED.exec(piece);
    if (omitted === null) return null;
    variables.push({ name: omitted[1] as string, state: "omitted", code: omitted[2] as string });
  }
  return template === "" || variables.length === 0 ? null : { template, variables };
}
