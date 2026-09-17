// What "what changed" MEANS when a rule-set edition is authored (L-MEA-01, R-SPINE-012) — one home
// for it, read by the screen that shows the diff and by the act that mints from it (B-17). Nothing
// here touches a database or a surface: it is the pin, the decimals an author stated, and the two
// answers that follow from them.
//
// Two rules the whole module rests on:
//
//  - Only VALUES are authored. Keys, units and the methods in force are the pin's and are copied
//    verbatim (L-MEA-01: the digest keys values × the (rule id, version) pairs, and a verbatim fork
//    shares its parent's digest by construction). A key the pin does not hold is not a parameter
//    this project's rule set has, so a caller stating one has made a mistake rather than authored
//    something, and it is a fault (ARCH-03) — the screen offers only the pin's keys.
//  - A row CHANGED when its authored decimal denotes a different quantity from its pinned one, not
//    when its field was typed in. `0.10` against `0.1` is the same quantity and no change at all,
//    so the comparison is over what the decimals denote rather than over their spelling.
import { isDecimalFigure } from "../../projects";
import { exact } from "../../units/canon";
import type { EditionContent, EditionParameter, MethodPair } from "./content";

/** One line of the diff: the pin's key and unit, the two decimals, and whether they differ. */
export interface ParameterDiffRow {
  readonly key: string;
  readonly unit: string;
  /** The pinned decimal, verbatim as the edition stores it. */
  readonly before: string;
  /** The authored decimal, verbatim as the author stated it — the pinned one where nothing was. */
  readonly after: string;
  readonly changed: boolean;
}

/**
 * Do two decimals denote the same quantity? Asked of the tree's one exact-decimal arithmetic
 * (`exact`, src/core/units/canon), so `0.10` and `0.1` are one quantity and no double is ever
 * involved — B-07 keeps a figure exact end to end, and a parse to double would make some pair of
 * distinct decimals equal. A value that is not a decimal at all never reaches here: the guard
 * below judges it first.
 */
export function sameDecimal(left: string, right: string): boolean {
  return exact(left).eq(exact(right));
}

/**
 * The diff a reader is shown: every parameter of the pin, in the pin's own order, whatever was
 * typed. A diff that hid what did not move could not be read against the pinned table beside it,
 * and could not be checked for the thing an author actually fears — a value moved by accident
 * (Design Decision I-264).
 *
 * A key `values` states that the pin does not hold is a fault, not a row: this is the same reading
 * the act takes, so the screen and the seam cannot disagree about what was authored.
 */
export function diffParameters(pin: Readonly<Record<string, EditionParameter>>, values: Readonly<Record<string, string>>): readonly ParameterDiffRow[] {
  refuseKeysThePinLacks(pin, values);
  return Object.entries(pin).map(([key, parameter]) => {
    const stated = values[key];
    const after = stated === undefined || stated.trim() === "" ? parameter.value : stated.trim();
    return { key, unit: parameter.unit, before: parameter.value, after, changed: !sameDecimal(parameter.value, after) };
  });
}

/**
 * The content the authored edition holds: the pin's keys in the pin's order, each carrying the
 * pin's unit and the decimal the author stated, beside the methods in force copied verbatim. This
 * is what `editionDigest` is taken over, so a fork with every field left as pinned digests to
 * exactly what its parent does (L-MEA-01).
 */
export function authoredContent(
  pin: Readonly<Record<string, EditionParameter>>,
  values: Readonly<Record<string, string>>,
  methods: readonly MethodPair[],
): EditionContent {
  const parameters: Record<string, EditionParameter> = {};
  for (const row of diffParameters(pin, values)) parameters[row.key] = { value: row.after, unit: row.unit };
  return { parameters, methods: methods.map((pair) => ({ ruleId: pair.ruleId, version: pair.version })) };
}

/**
 * The two ways a caller can state something this module cannot author: a key the pin has no
 * parameter under, and a value that is not a decimal at all. Neither is an answer the product gives
 * anyone — the screen offers the pin's keys and a decimal-only field — so both are faults rather
 * than registered refusals (ARCH-03), and both name what was wrong.
 */
function refuseKeysThePinLacks(pin: Readonly<Record<string, EditionParameter>>, values: Readonly<Record<string, string>>): void {
  for (const [key, stated] of Object.entries(values)) {
    if (!Object.prototype.hasOwnProperty.call(pin, key)) {
      throw new Error(`"${key}" is no parameter of the pinned rule-set edition — authoring states values for the pin's own keys and mints no new ones (L-MEA-01)`);
    }
    if (stated.trim() !== "" && !isDecimalFigure(stated.trim())) {
      throw new Error(`"${stated}" is not a decimal, so it is no value for the rule-set parameter "${key}" — a parameter is a quantity the store holds exactly (B-07)`);
    }
  }
}
