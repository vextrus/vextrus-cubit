/**
 * AC-3 — the two boundary acts, over a real campaign (L-ACT-02, R-TO-052, L-QTY-05).
 *
 * A person may say two things about a cell the campaign did not measure: it is not in this bill, and
 * it is not in this project's scope. Each is an ACT with a consequence, previewed before it is
 * carried, written once, and READ BACK BY THE RESIDUE — the cell states the cause a person gave it,
 * on the axis that person moved.
 *
 * The cell the acts are carried over is not named here: it is taken from the residue the staged
 * campaign really holds, so what is asserted is that the residue's own cell can be declared over
 * rather than that a hand-picked address happens to work (B-19).
 *
 * The migration half of this criterion — the store the declarations stand in — is db/__tests__/
 * scope-acts.migration.test.ts, on the lane that owns it (`pnpm test:db`).
 */
import { afterAll, describe, expect, test } from "vitest";
import {
  ACTS_LAW_MODULE,
  ACTS_TABLE,
  DECLARE_NOT_IN_PROJECT_SCOPE,
  HOLD_OUT_OF_BILL,
  NOT_IN_PROJECT_SCOPE,
  NOT_IN_THIS_BILL,
  QUANTITY_BEARING,
  SCOPE_DECLARATIONS_TABLE,
  SET_BILL_BOUNDARY,
  actsSeam,
  boundary,
  closeCoverageStage,
  fieldOf,
  productModule,
  residueSeam,
  rowsOf,
  stageCoverageCampaign,
  subjectsOf,
  type ResidueCellShape,
  type StagedCoverage,
} from "./support/coverage-stage";

/** How long a staged campaign may take: the shipped seams, driven end to end, over one database. */
const BUDGET_MS = 900_000;

let staging: Promise<StagedCoverage> | undefined;
const staged = (): Promise<StagedCoverage> => (staging ??= stageCoverageCampaign("coverage-acts"));

afterAll(async () => {
  await closeCoverageStage();
}, 120_000);

/** The cell of the staged campaign's own residue the two acts are carried over. */
async function unmeasuredCell(it: StagedCoverage): Promise<ResidueCellShape> {
  const residue = await residueSeam();
  const held = await residue.residueOf(it.scope);
  const open = held.cells.filter((cell) => cell.grain === "CELL" && cell.measurement !== QUANTITY_BEARING);
  expect(
    open.length,
    `the staged campaign's residue holds a cell a boundary act can be carried over — a class sighted on a level of the stack, bearing a kind nothing published: ${JSON.stringify(held.cells)}`,
  ).toBeGreaterThan(0);
  return open[0] as ResidueCellShape;
}

/** The cell as the residue reads it now, by the address it was taken at. */
async function readBack(it: StagedCoverage, cell: ResidueCellShape): Promise<ResidueCellShape> {
  const residue = await residueSeam();
  const held = await residue.residueOf(it.scope);
  const found = held.cells.filter((c) => c.kind === cell.kind && c.class === cell.class && c.levelId === cell.levelId);
  expect(found.length, `the residue still holds one cell for ${residue.cellRef(cell)} after the act`).toBe(1);
  return found[0] as ResidueCellShape;
}

/** Every declaration row of one workspace standing over one cell. */
async function declarationsOver(it: StagedCoverage, cell: ResidueCellShape): Promise<Record<string, unknown>[]> {
  const rows = await rowsOf(SCOPE_DECLARATIONS_TABLE, it.tenantId);
  const over: Record<string, unknown>[] = [];
  for (const row of rows) {
    const sameCell =
      String(await fieldOf(row, "class", "class")) === String(cell.class) &&
      String(await fieldOf(row, "kind", "kind")) === cell.kind &&
      String(await fieldOf(row, "levelId", "level_id")) === String(cell.levelId);
    if (sameCell) over.push(row);
  }
  return over;
}

describe("AC-3: the two act types stand in the law, under the permission that moves them", () => {
  test("AC-3: both are ACT_TYPES, and ACT_PERMISSION maps both to SET_BILL_BOUNDARY", async () => {
    const law = await productModule<{ ACT_TYPES: readonly string[]; ACT_PERMISSION: Readonly<Record<string, string>> }>(ACTS_LAW_MODULE);
    for (const type of [HOLD_OUT_OF_BILL, DECLARE_NOT_IN_PROJECT_SCOPE]) {
      expect(law.ACT_TYPES, `${type} is an act of the closed vocabulary — a boundary is declared by act, never by a flag (L-ACT-02)`).toContain(type);
      expect(law.ACT_PERMISSION[type], `${type} moves ${SET_BILL_BOUNDARY}, the permission the bill boundary is held under`).toBe(SET_BILL_BOUNDARY);
    }
  });
});

describe("AC-3: a boundary act previews its subject, writes one row, and is read back by the residue", () => {
  test("AC-3: holding a cell out of this bill", async () => {
    const it = await staged();
    const residue = await residueSeam();
    const acts = await actsSeam();
    const cell = await unmeasuredCell(it);
    const input = boundary(HOLD_OUT_OF_BILL, { projectId: it.projectId, campaignId: it.campaignId, class: String(cell.class), kind: cell.kind, levelId: String(cell.levelId) });

    const consequence = await acts.preview(it.actor, input);
    expect(consequence["rendering"], `a boundary act is shown as its SUBJECTS — the cell it moves (L-ACT-02): ${JSON.stringify(consequence)}`).toBe("SUBJECTS");
    const subjects = subjectsOf(consequence);
    expect(subjects.length, "one act over one cell names one subject — a declaration is never a bulk offer").toBe(1);
    expect(subjects[0]?.subjectId, "and the subject is the cell itself, by the reference the whole increment addresses cells by").toBe(residue.cellRef(cell));

    const before = (await rowsOf(ACTS_TABLE, it.tenantId)).length;
    const written = await acts.commit(it.actor, input, acts.consequenceDigest(consequence));
    const actId = String(written["actId"]);
    expect(actId.length, `committing the hold answered the act it wrote: ${JSON.stringify(written)}`).toBeGreaterThan(0);
    expect((await rowsOf(ACTS_TABLE, it.tenantId)).length - before, "exactly one act row — one act, one cell").toBe(1);

    const rows = await declarationsOver(it, cell);
    const held = rows.filter((row) => String(row["cause"] ?? "") === NOT_IN_THIS_BILL);
    expect(held.length, `one ${SCOPE_DECLARATIONS_TABLE} row stands over the cell under ${NOT_IN_THIS_BILL}: ${JSON.stringify(rows)}`).toBe(1);
    const row = held[0] as Record<string, unknown>;
    expect(await fieldOf(row, "inForce", "in_force"), "in force, as the act that wrote it left it").toBe(true);
    expect(String(await fieldOf(row, "actId", "act_id")), "and citing the act that wrote it — a declaration without its act is a flag").toBe(actId);

    const after = await readBack(it, cell);
    expect(after.bill, "the residue reads the cell under the cause the person gave it").toBe(NOT_IN_THIS_BILL);
    expect(after.billActId, "naming the act it was declared by").toBe(actId);
    expect(after.measurement, "and the measurement axis is unmoved: holding a cell out of a bill measures nothing").toBe(cell.measurement);
  }, BUDGET_MS);

  test("AC-3: declaring the same cell out of the project scope moves the other axis", async () => {
    const it = await staged();
    const residue = await residueSeam();
    const acts = await actsSeam();
    const cell = await unmeasuredCell(it);
    const input = boundary(DECLARE_NOT_IN_PROJECT_SCOPE, { projectId: it.projectId, campaignId: it.campaignId, class: String(cell.class), kind: cell.kind, levelId: String(cell.levelId) });

    const consequence = await acts.preview(it.actor, input);
    expect(consequence["rendering"], `the declaration is shown as its SUBJECTS too: ${JSON.stringify(consequence)}`).toBe("SUBJECTS");
    expect(subjectsOf(consequence)[0]?.subjectId, "over the same cell, by the same reference").toBe(residue.cellRef(cell));

    const written = await acts.commit(it.actor, input, acts.consequenceDigest(consequence));
    const actId = String(written["actId"]);

    const rows = await declarationsOver(it, cell);
    const scoped = rows.filter((row) => String(row["cause"] ?? "") === NOT_IN_PROJECT_SCOPE);
    expect(scoped.length, `one ${SCOPE_DECLARATIONS_TABLE} row stands over the cell under ${NOT_IN_PROJECT_SCOPE} — the two causes are two rows, never one row rewritten`).toBe(1);
    expect(String(await fieldOf(scoped[0] as Record<string, unknown>, "actId", "act_id")), "citing the act that wrote it").toBe(actId);

    const after = await readBack(it, cell);
    expect(after.measurement, "the measurement axis now states what a person declared").toBe(NOT_IN_PROJECT_SCOPE);
    expect(after.measurementActId, "naming the act it was declared by").toBe(actId);
    expect(after.bill, "and the bill axis still reads what the earlier hold left there — two orthogonal axes over one cell (L-QTY-05)").toBe(NOT_IN_THIS_BILL);
  }, BUDGET_MS);
});
