/**
 * AC-6(d) [debt-src-core-1qcgar] — a reading is signed; a published figure never is.
 *
 * L-QTY-04 forecloses a published quantity below zero — "a disclosure lets a reader add; nothing lets
 * a reader subtract" — and it forecloses it of the FIGURE, not of the readings a formula is answered
 * over. An elevation against a datum is a reading, and a site whose ground lies below the project
 * datum reads −152.4 mm: refusing it would refuse the site rather than the measurement (L-FRM-04,
 * L-MEA-06).
 *
 * The two halves stand in one file because they are one law read at two places, and the row this
 * closes is the doubt about which place is which. `admissibleFigure` is where the negative is
 * refused; `normaliseMeasure` is where it is carried — and the doc says which refusal of the gate
 * stands on the first, so a reader of this file is not left to find out by grepping.
 */
import { describe, expect, test } from "vitest";
import { QUANTITY_BASES, type Measure } from "../offers/contract";
// white-box: AC-6(d) — the criterion asks for a property of this module's TEXT: that its doc names
// the refusal `evaluate.ts` answers when a figure `admissibleFigure` calls inadmissible reaches a
// line. `admissibleFigure` answers a boolean and raises nothing, so which refusal stands on its
// `false` arm has no runtime observable at all — the comment is the only place that fact can be
// stated, and Q-17 requires a comment to cite the law it serves. The other three cases of this file
// are behaviour, driven at the two shipped functions.
import { commentsOf } from "../__tests__/support/read-source";
import { REFUSALS } from "../errors";
import { admissibleFigure, normaliseMeasure } from "./units";

/** The module whose doc is judged, and the refusal the gate answers on an inadmissible figure. */
const UNITS_MODULE = "src/core/gate/units.ts";
const STANDING_REFUSAL = REFUSALS.OFFER_NOT_TO_CONTRACT.code;

/** One reading as a rail offers one: the basis and the entity it was read from are the rail's, not this criterion's. */
const reading = (value: string, unit: string): Measure => ({ value, unit, basis: QUANTITY_BASES[0], source: "DXF_HANDLE:1" });

describe("the gate refuses a negative figure and carries a negative reading", () => {
  test("AC-6(d): a figure below zero is inadmissible, and zero is admissible", () => {
    expect(admissibleFigure("-1"), "a published line carrying a negative quantity is the one thing L-QTY-04 forecloses outright").toBe(false);
    expect(admissibleFigure("0"), "nothing measured is a lawful figure — zero is not below zero (L-QTY-04)").toBe(true);
  });

  test("AC-6(d): a reading below the datum still carries into the canonical unit", () => {
    const carried = normaliseMeasure(reading("-152.4", "mm"), "LENGTH");
    expect(carried.ok, "an existing ground level 152.4 mm below the project datum is a reading, and refusing it would refuse the site (L-FRM-04, L-MEA-06)").toBe(true);
    expect(carried.ok && carried.unit, "and it is carried into the dimension's canonical unit, exactly (L-FRM-06)").toBe("m");
  });

  test("AC-6(d): a value that is not a decimal figure at all is refused, not carried", () => {
    // The boundary the row is about, from the other side: what `normaliseMeasure` refuses is text
    // that is no quantity, never a sign.
    for (const value of ["", "NaN", "Infinity", "one"]) {
      expect(normaliseMeasure(reading(value, "mm"), "LENGTH").ok, `${JSON.stringify(value)} is not a decimal figure, so it is no reading (L-QTY-03)`).toBe(false);
    }
  });

  test("AC-6(d): the module's doc names the refusal that stands on an inadmissible figure", () => {
    // white-box: AC-6(d) — which refusal the gate answers on an inadmissible figure is a fact about
    // what this file SAYS, not about what it does: `admissibleFigure` answers a boolean and the
    // refusal is raised in evaluate.ts. Q-17 has a comment cite the law it serves, and the row this
    // closes is a reader of this file unable to tell which refusal stands on the `false` arm.
    const doc = commentsOf(UNITS_MODULE, "it is the gate's one normalisation home (L-MEA-08, B-17)");
    expect(
      doc,
      `${UNITS_MODULE}'s doc names ${STANDING_REFUSAL} — the refusal evaluate.ts answers when a figure this predicate calls inadmissible reaches a line (Q-17, ARCH-03)`,
    ).toContain(STANDING_REFUSAL);
  });
});
