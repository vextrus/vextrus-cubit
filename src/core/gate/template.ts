// L-QTY-03: a published line carries "the human-auditable formula string with named variables,
// rendered from the same registry template the gate evaluates".
//
// The SAME template, which is why this reads the method rather than a string beside it: the value
// and the sentence a reader audits it by come from one declaration, so a formula that changed and a
// figure that did not is unrepresentable (B-17). Nothing is prose — the template as the method spells
// it, then each declared variable with the value and unit it was actually evaluated at, so a reader
// can redo the arithmetic from the line alone.
import type { OmittedComponent } from "../offers/contract";
import type { FormulaMethod, NormalisedBindings } from "../rulesets/methods/registry";

/**
 * The formula a published line states: the method's template, followed by every variable it declares
 * with its normalised value and unit — or, where the row declared that variable omitted, the name of
 * the omission and the registered code it stands under.
 *
 * A PARTIAL_DECLARED row carries no quantity, so its sentence is the only place a reader can see
 * WHICH component of the item description is missing and why (L-QTY-02, L-QTY-03). It is rendered
 * from the same one template the value is evaluated from, so the two can never say different things.
 *
 * A variable the method declares that the bindings do not carry and the row does not declare omitted
 * is a disagreement between the gate and the method rather than something to render a blank for: the
 * gate refuses such an offer `OFFER_NOT_TO_CONTRACT` before it reaches here (ARCH-03).
 */
export function renderFormula(method: FormulaMethod, bindings: NormalisedBindings, omitted: readonly OmittedComponent[] = []): string {
  const left = new Map(omitted.map((component) => [component.variable, component.code]));
  const named = method.variables.map((variable) => {
    const code = left.get(variable.name);
    if (code !== undefined) return `${variable.name} omitted: ${code}`;
    const bound = bindings[variable.name];
    if (bound === undefined) {
      throw new Error(`${method.ruleId}@${method.version} declares ${variable.name} and was rendered without it — a formula cannot name what it was not given (L-QTY-03)`);
    }
    return `${variable.name} = ${bound.value} ${bound.unit}`;
  });
  return named.length === 0 ? method.template : `${method.template} (${named.join(", ")})`;
}
