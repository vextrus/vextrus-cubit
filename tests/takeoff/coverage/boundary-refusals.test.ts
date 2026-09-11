/**
 * AC-3 — the answers the two boundary acts give instead of writing (L-ACT-01, L-REG-07, ARCH-03).
 *
 * The acts beside this file are proved where they WRITE (boundary-acts.test.ts). This one drives the
 * three addresses at which they must not: a campaign the project does not hold, an address the
 * campaign's residue holds no cell at, and a cell whose boundary a person has already moved. Each is
 * a refusal — a registered code with words a reader can act on — and not a driver fault, because a
 * fact about an address is an answer about the address (B-21, R-UI-020).
 *
 * The campaign, the cell and the acts are all the product's own: the cell is taken from the residue
 * the staged campaign really holds, so what is asserted is that the real arms answer these addresses
 * rather than that a hand-picked one happens to.
 */
import { afterAll, describe, expect, test } from "vitest";
import {
  ACT_CHANGES_NOTHING,
  CELL_NOT_IN_RESIDUE,
  DECLARE_NOT_IN_PROJECT_SCOPE,
  HOLD_OUT_OF_BILL,
  QUANTITY_BEARING,
  actsSeam,
  boundary,
  closeCoverageStage,
  codeOf,
  refusalRegister,
  rejection,
  residueSeam,
  stageCoverageCampaign,
  subjectsOf,
  type ResidueCellShape,
  type StagedCoverage,
} from "./support/coverage-stage";

/** How long a staged campaign may take: the shipped seams, driven end to end, over one database. */
const BUDGET_MS = 900_000;

/**
 * The refusal the interfaces assign to "campaignId not this project's" (the settled reading of
 * L-ACT-01 / L-REG-07). The stage names the other two; this one is spelled here and checked against
 * the register below, so the code asserted is the code the product publishes.
 */
const CAMPAIGN_NOT_FOUND = "CAMPAIGN_NOT_FOUND";

/** A campaign id of the right shape that no project holds, and a level no stack holds. */
const UNHELD_CAMPAIGN = "99999999-9999-4999-8999-999999999999";
const UNHELD_LEVEL = "88888888-8888-4888-8888-888888888888";

let staging: Promise<StagedCoverage> | undefined;
const staged = (): Promise<StagedCoverage> => (staging ??= stageCoverageCampaign("coverage-refusals"));

afterAll(async () => {
  await closeCoverageStage();
}, 120_000);

/** The cell of the staged campaign's own residue a boundary act can really be carried over. */
async function unmeasuredCell(it: StagedCoverage): Promise<ResidueCellShape> {
  const residue = await residueSeam();
  const held = await residue.residueOf(it.scope);
  const open = held.cells.filter((cell) => cell.grain === "CELL" && cell.measurement !== QUANTITY_BEARING && cell.levelId !== null);
  expect(open.length, `the staged campaign's residue holds a cell a boundary act can be carried over: ${JSON.stringify(held.cells)}`).toBeGreaterThan(0);
  return open[0] as ResidueCellShape;
}

/** One boundary act's input over one cell of the staged campaign, with whatever is overridden. */
function inputOver(it: StagedCoverage, cell: ResidueCellShape, type: string, over: { campaignId?: string; levelId?: string } = {}): Record<string, unknown> {
  return boundary(type, {
    projectId: it.projectId,
    campaignId: over.campaignId ?? it.campaignId,
    class: String(cell.class),
    kind: cell.kind,
    levelId: over.levelId ?? String(cell.levelId),
  });
}

describe("AC-3: the addresses a boundary act refuses rather than writes", () => {
  test("AC-3: a campaign this project does not hold is answered CAMPAIGN_NOT_FOUND, by both acts", async () => {
    const it = await staged();
    const acts = await actsSeam();
    const cell = await unmeasuredCell(it);
    const register = await refusalRegister();

    expect(register[CAMPAIGN_NOT_FOUND]?.code, `${CAMPAIGN_NOT_FOUND} is a registered refusal with words and a remedy, not a bare string`).toBe(CAMPAIGN_NOT_FOUND);

    for (const type of [HOLD_OUT_OF_BILL, DECLARE_NOT_IN_PROJECT_SCOPE]) {
      const thrown = await rejection(acts.preview(it.actor, inputOver(it, cell, type, { campaignId: UNHELD_CAMPAIGN })));
      expect(
        await codeOf(thrown),
        `${type} under a campaign this project does not hold names no residue to declare anything about, so it is answered by name and never attempted: ${String(thrown)}`,
      ).toBe(CAMPAIGN_NOT_FOUND);
    }
  }, BUDGET_MS);

  test("AC-3: an address the campaign's residue holds no cell at is answered CELL_NOT_IN_RESIDUE", async () => {
    const it = await staged();
    const acts = await actsSeam();
    const cell = await unmeasuredCell(it);
    const register = await refusalRegister();

    expect(register[CELL_NOT_IN_RESIDUE]?.code, `${CELL_NOT_IN_RESIDUE} is a registered refusal with words and a remedy`).toBe(CELL_NOT_IN_RESIDUE);

    for (const type of [HOLD_OUT_OF_BILL, DECLARE_NOT_IN_PROJECT_SCOPE]) {
      const thrown = await rejection(acts.preview(it.actor, inputOver(it, cell, type, { levelId: UNHELD_LEVEL })));
      expect(
        await codeOf(thrown),
        `${type} over a level this campaign sighted nothing on is a declaration no reading would ever show anybody, so the residue's own query answers it: ${String(thrown)}`,
      ).toBe(CELL_NOT_IN_RESIDUE);
    }
  }, BUDGET_MS);

  test("AC-3: the same boundary carried twice is answered ACT_CHANGES_NOTHING, and writes nothing the second time", async () => {
    const it = await staged();
    const residue = await residueSeam();
    const acts = await actsSeam();
    const cell = await unmeasuredCell(it);
    const input = inputOver(it, cell, HOLD_OUT_OF_BILL);

    const first = await acts.preview(it.actor, input);
    expect(subjectsOf(first)[0]?.subjectId, "the first hold stands over the cell itself").toBe(residue.cellRef(cell));
    await acts.commit(it.actor, input, acts.consequenceDigest(first));

    // The preview stands: a person may always ask what a door would do. What it answers is that the
    // boundary is already where this act would put it, and the seam refuses the commit by name rather
    // than writing a second act recording nothing (L-ACT-01).
    const again = await acts.preview(it.actor, input);
    const thrown = await rejection(acts.commit(it.actor, input, acts.consequenceDigest(again)));
    expect(
      await codeOf(thrown),
      `holding a cell out of this bill a second time leaves it exactly as it was found, so it is answered by name — the reader sees the code in place, not a driver error from the store's one-per-cell belt: ${String(thrown)}`,
    ).toBe(ACT_CHANGES_NOTHING);
  }, BUDGET_MS);
});
