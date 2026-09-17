// The diff a reader confirms before the act carries it (R-SPINE-012's diff view), as a pure
// function over two readings of one parameter roster: what the project reads today, and what the
// author has stated.
//
// I-264: the diff is the WHOLE pin, always — one row per parameter, in the pin's own order, whatever
// has been typed. A diff that hides what did not move cannot be read against the screen beside it.
//
// A row is CHANGED when its authored decimal differs from its pinned decimal AS A FIGURE, never when
// its field has been touched: L-MEA-01's edition keys content, so `0.10` authored against a pinned
// `0.1` moves nothing and marks nothing.
import type { EditionParameter } from "@/core/rulesets/editions";

/** One row of the diff: the parameter, what it reads now, and what it would read. */
export interface ParameterDiffRow {
  /** The pin's own key — the row's `data-param`, never body text (s-settings-ruleset I-207). */
  readonly key: string;
  /** The pin's unit, carried through verbatim: authoring states values only (I-265). */
  readonly unit: string;
  /** The pinned decimal, verbatim as stored. */
  readonly before: string;
  /** The authored decimal, verbatim as typed — the pinned one until something is typed. */
  readonly after: string;
  readonly changed: boolean;
}

/**
 * Two decimals compared as figures rather than as text. A decimal string is exact (B-07) and this
 * comparison never rounds: it lines the two up on their decimal points and asks whether the digits
 * say the same number, so trailing zeros, a leading zero and a stated sign are spelling rather than
 * content. A value that is not a decimal at all is compared as written — a reader who typed
 * something that is no figure is shown the difference rather than told there is none.
 */
export function sameFigure(left: string, right: string): boolean {
  const one = normalised(left);
  const other = normalised(right);
  return one === null || other === null ? left.trim() === right.trim() : one === other;
}

/** A decimal in one spelling: a sign, the digits, a decimal point, no leading or trailing zeros. */
function normalised(value: string): string | null {
  const written = value.trim();
  const read = /^([+-]?)(\d*)(?:\.(\d*))?$/.exec(written);
  if (read === null || (read[2] ?? "") === "" ) return null;
  const whole = (read[2] ?? "").replace(/^0+(?=\d)/, "");
  const fraction = (read[3] ?? "").replace(/0+$/, "");
  const figure = fraction === "" ? whole : `${whole}.${fraction}`;
  // Zero has one spelling however it was written: `-0` and `0.0` are the same figure as `0`.
  return figure === "0" ? "0" : `${read[1] === "-" ? "-" : ""}${figure}`;
}

/**
 * The diff grid's rows: the pin's parameters in the pin's own order, each beside the decimal the
 * author has stated for it. An unstated value is the pinned one — the field opens pre-filled with
 * what the project reads (I-263), so an author moves what they mean to move and nothing else.
 *
 * A field a reader has EMPTIED states nothing, which is the same as never having touched it: the
 * pinned decimal stands, the row is unmarked, and the act would mint what the project already reads
 * for that parameter. An empty box is not a figure, and reading it as one would put a row in the
 * diff that the author never authored (I-265, and `authoredContent`, which reads it the same way).
 */
export function diffParameters(pinned: Readonly<Record<string, EditionParameter>>, authored: Readonly<Record<string, string>>): readonly ParameterDiffRow[] {
  return Object.entries(pinned).map(([key, parameter]) => {
    const stated = authored[key];
    const after = stated === undefined || stated === "" ? parameter.value : stated;
    return { key, unit: parameter.unit, before: parameter.value, after, changed: !sameFigure(parameter.value, after) };
  });
}

/** The values an act states: every authored decimal, keyed by the pin's own parameter keys. */
export function authoredValues(rows: readonly ParameterDiffRow[]): Readonly<Record<string, string>> {
  return Object.fromEntries(rows.map((row) => [row.key, row.after]));
}
