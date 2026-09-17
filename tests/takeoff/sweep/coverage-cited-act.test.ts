/**
 * AC-5(d): the act the coverage inspector cites is the act of the AXIS the cell is read under
 * (debt-src-modules-9gp0ot, L-QTY-05, R-UI-050).
 *
 * The rule is asked of its own home, over cells built here: each case differs in one field — which
 * axis moved, and which act stands on it — so an answer that always reaches for the measurement act
 * cannot pass.
 */
import { describe, expect, test } from "vitest";
import { MODULE, productModule } from "./support/sweep-stage";

/** One residue cell, as far as the citation reads one. */
type Cell = { measurement: string; bill: string; measurementActId: string | null; billActId: string | null };

type CitedActOf = (cell: Cell, axis: string) => string | null;

const BILL = "BILL";
const MEASUREMENT = "MEASUREMENT";

const MEASUREMENT_ACT = "act-measurement-1";
const BILL_ACT = "act-bill-1";

async function citedActOf(): Promise<CitedActOf> {
  const door = await productModule<Record<string, unknown>>(MODULE.citedAct);
  expect(typeof door["citedActOf"], `${MODULE.citedAct} publishes \`citedActOf\` — the one answer to which act a cell's reading was declared by (interfaces, B-17)`).toBe("function");
  return door["citedActOf"] as CitedActOf;
}

describe("AC-5: the inspector cites the act of the axis it is reading", () => {
  test("AC-5: under the bill axis the bill's act is cited — and where the bill declares none, no act at all", async () => {
    const cited = await citedActOf();
    const declared: Cell = { measurement: "NOT_ESTABLISHED", bill: "NOT_IN_THIS_BILL", measurementActId: MEASUREMENT_ACT, billActId: BILL_ACT };

    expect(
      cited(declared, BILL),
      "a cell read under the bill axis was declared out of the bill by the bill's own act: citing the measurement act would send a reader to an act that says nothing about why this cell reads as it does (L-QTY-05)",
    ).toBe(BILL_ACT);
    expect(
      cited({ ...declared, billActId: null }, BILL),
      "and where the bill axis stands under no act, the cell cites none — never the measurement act standing beside it (R-UI-050: an absence a reader can act on)",
    ).toBeNull();

    expect(cited(declared, MEASUREMENT), "while a cell read under the measurement axis cites the act of THAT axis").toBe(MEASUREMENT_ACT);
    expect(cited({ ...declared, measurementActId: null }, MEASUREMENT), "and none where the measurement axis stands under none").toBeNull();
  });
});
