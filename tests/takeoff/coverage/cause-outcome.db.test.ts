/**
 * DB LANE (`pnpm test:db`) — what a person did with a proposed boundary, written by the act that
 * judged it (s-coverage I-297, L-ACT-01, L-AI-02, R-TO-052).
 *
 * The outcome is not a screen's to record and not a disposition's: a boundary is always an ACT, so
 * the judgment lands in the act's own transaction with the declaration and the act row, or none of
 * the three does. CONFIRMED where the cause a person carried is the cause proposed; OVERRULED where
 * they drew the boundary on the other axis; nothing at all where they declared unaided. REPUDIATED
 * and AFFIRMED are never written on this question — this screen offers no door that dismisses a
 * proposal and no second reading that corroborates one (I-297).
 *
 * Nothing is asked of a model here: the ledger row a proposal names is minted through the seam's own
 * `dbModelLedger`, which is what the ledger holds after a call, so this suite opens a database and
 * no network. The calibration line is then derived off the rows the acts left, with no code of its
 * own — `model_calls.question` is the whole registration (src/core/model-calibration.ts).
 */
import { afterAll, describe, expect, test } from "vitest";
import {
  ACTS_TABLE,
  DECLARE_NOT_IN_PROJECT_SCOPE,
  HOLD_OUT_OF_BILL,
  NOT_IN_THIS_BILL,
  QUANTITY_BEARING,
  actsSeam,
  boundary,
  closeCoverageStage,
  fieldOf,
  productModule,
  residueSeam,
  rowsOf,
  stageCoverageCampaign,
  type ResidueCellShape,
  type StagedCoverage,
} from "./support/coverage-stage";

/** How long a staged campaign may take: the shipped seams, driven end to end, over one database. */
const BUDGET_MS = 900_000;

/** The ledger's two tables, as this suite reads them back. */
const MODEL_CALLS = "model_calls";
const MODEL_CALL_OUTCOMES = "model_call_outcomes";

/** The question every row this suite mints and reads is filed under. */
const QUESTION = "coverage-cause";

let staging: Promise<StagedCoverage> | undefined;
const staged = (): Promise<StagedCoverage> => (staging ??= stageCoverageCampaign("coverage-cause-outcome"));

afterAll(async () => {
  await closeCoverageStage();
}, 120_000);

type ModelSeam = {
  dbModelLedger: (db: unknown) => { record: (row: Record<string, unknown>) => Promise<{ callId: string }> };
};
type DbSeam = { forTenant: (ctx: { tenantId: string }) => unknown };
type CalibrationSeam = {
  calibrationLinesOf: (
    calls: readonly { callId: string; question: string | null; outcome: string; judgment: { confidence: number | null } | null }[],
    outcomes: readonly { callId: string; outcome: string }[],
  ) => {
    question: string;
    proposed: number;
    confirmed: number;
    overruled: number;
    repudiated: number;
    affirmed: number;
    awaiting: number;
    meanConfidenceWhenRight: string | null;
    meanConfidenceWhenWrong: string | null;
  }[];
};

/** One proposed call of this project, as the ledger holds one after a model answered (L-AI-01). */
async function proposedCall(it: StagedCoverage, confidence: number): Promise<string> {
  const model = await productModule<ModelSeam>("src/core/model/index.ts");
  const db = await productModule<DbSeam>("src/core/db.ts");
  const ledger = model.dbModelLedger(db.forTenant({ tenantId: it.tenantId }));
  const written = await ledger.record({
    tenantId: it.tenantId,
    projectId: it.projectId,
    modelId: "claude-sonnet-5",
    requestHash: `hash-${Math.random().toString(16).slice(2)}`,
    transport: "fixture",
    outcome: "proposed",
    refusalCode: null,
    inputTokens: 120,
    outputTokens: 0,
    attributedCost: "0.000000000",
    question: QUESTION,
    judgment: { provider: "jev-2026-09", confidence, answers: { cause: { value: NOT_IN_THIS_BILL, confidence, probabilities: null } } },
  });
  return written.callId;
}

/** The cell of the staged campaign's own residue the acts are carried over. */
/**
 * A cell the act a case is about to carry can still MOVE: no boundary yet stands on the axis that
 * act moves. The cases each carry one act, and an act over a cell an earlier case already held out
 * of the bill would change nothing and be refused as such (ACT_CHANGES_NOTHING); the residue is
 * re-read here so every case takes a cell its own act can move. The staged campaign holds two
 * CELL-grain cells (rcc.concrete and rcc.rebar on the registered column's storey), so the axis is
 * asked for rather than both: a cell held out of the bill can still be declared out of scope.
 */
async function unmeasuredCell(it: StagedCoverage, axis: "bill" | "measurement" | "any"): Promise<ResidueCellShape> {
  const residue = await residueSeam();
  const held = await residue.residueOf(it.scope);
  const open = held.cells.filter(
    (cell) =>
      cell.grain === "CELL" &&
      cell.measurement !== QUANTITY_BEARING &&
      cell.class !== null &&
      cell.levelId !== null &&
      (axis === "any" ? true : axis === "bill" ? cell.billActId === null : cell.measurementActId === null),
  );
  expect(open.length, `the staged campaign's residue holds a cell no ${axis}-axis act has yet been carried over: ${JSON.stringify(held.cells)}`).toBeGreaterThan(0);
  return open[0] as ResidueCellShape;
}

/** Every outcome row of one workspace naming one call. */
async function outcomesOf(it: StagedCoverage, callId: string): Promise<Record<string, unknown>[]> {
  const rows = await rowsOf(MODEL_CALL_OUTCOMES, it.tenantId);
  const named: Record<string, unknown>[] = [];
  for (const row of rows) if (String(await fieldOf(row, "callId", "call_id")) === callId) named.push(row);
  return named;
}

describe("the act judges the proposal, and only the act", () => {
  test("carrying the cause that was proposed writes one CONFIRMED outcome, in the act's own transaction", async () => {
    const it = await staged();
    const acts = await actsSeam();
    const cell = await unmeasuredCell(it, "bill");
    const callId = await proposedCall(it, 0.93);
    const input = {
      ...boundary(HOLD_OUT_OF_BILL, { projectId: it.projectId, campaignId: it.campaignId, class: String(cell.class), kind: cell.kind, levelId: String(cell.levelId) }),
      proposal: { callId, cause: NOT_IN_THIS_BILL },
    };

    const before = (await rowsOf(ACTS_TABLE, it.tenantId)).length;
    const consequence = await acts.preview(it.actor, input);
    const written = await acts.commit(it.actor, input, acts.consequenceDigest(consequence));
    expect((await rowsOf(ACTS_TABLE, it.tenantId)).length - before, "one act, one cell").toBe(1);

    const rows = await outcomesOf(it, callId);
    expect(rows.length, `one outcome stands against ${callId}: ${JSON.stringify(rows)}`).toBe(1);
    const row = rows[0] as Record<string, unknown>;
    expect(String(await fieldOf(row, "outcome", "outcome")), "the person took the boundary the model proposed").toBe("CONFIRMED");
    expect(String(await fieldOf(row, "actId", "act_id")), "the outcome names the act that carried it — L-ACT-01's one transaction").toBe(String(written["actId"]));
    expect(String(await fieldOf(row, "question", "question")), "filed under the question the calibration line is read by").toBe(QUESTION);
    expect(String(await fieldOf(row, "actorUserId", "actor_user_id")), "and the person who judged it").toBe(it.actor.userId);
  }, BUDGET_MS);

  test("carrying the OTHER axis over the same proposal writes OVERRULED", async () => {
    const it = await staged();
    const acts = await actsSeam();
    const cell = await unmeasuredCell(it, "measurement");
    const callId = await proposedCall(it, 0.84);
    const input = {
      ...boundary(DECLARE_NOT_IN_PROJECT_SCOPE, { projectId: it.projectId, campaignId: it.campaignId, class: String(cell.class), kind: cell.kind, levelId: String(cell.levelId) }),
      proposal: { callId, cause: NOT_IN_THIS_BILL },
    };
    const consequence = await acts.preview(it.actor, input);
    await acts.commit(it.actor, input, acts.consequenceDigest(consequence));

    const rows = await outcomesOf(it, callId);
    expect(rows.length).toBe(1);
    expect(String(await fieldOf(rows[0] as Record<string, unknown>, "outcome", "outcome")), "the person drew the boundary on the axis the model did not propose").toBe("OVERRULED");
  }, BUDGET_MS);

  test("a person who declared unaided writes no outcome at all — `awaiting` is the truth about a proposal nobody acted on", async () => {
    const it = await staged();
    const acts = await actsSeam();
    const cell = await unmeasuredCell(it, "bill");
    const callId = await proposedCall(it, 0.99);
    const input = boundary(HOLD_OUT_OF_BILL, { projectId: it.projectId, campaignId: it.campaignId, class: String(cell.class), kind: cell.kind, levelId: String(cell.levelId) });
    const consequence = await acts.preview(it.actor, input);
    await acts.commit(it.actor, input, acts.consequenceDigest(consequence));
    expect(await outcomesOf(it, callId), "no proposal was carried, so nothing was judged").toEqual([]);
  }, BUDGET_MS);

  test("a refused act writes neither the declaration nor the outcome — one transaction or neither", async () => {
    const it = await staged();
    const acts = await actsSeam();
    // Any cell's class and kind will do: the act is refused on its address before any axis is read,
    // and the cases before this one have carried a boundary along both axes of both staged cells.
    const cell = await unmeasuredCell(it, "any");
    const callId = await proposedCall(it, 0.91);
    const input = {
      ...boundary(HOLD_OUT_OF_BILL, { projectId: it.projectId, campaignId: it.campaignId, class: String(cell.class), kind: cell.kind, levelId: "00000000-0000-4000-8000-0000000000ff" }),
      proposal: { callId, cause: NOT_IN_THIS_BILL },
    };
    await expect(acts.preview(it.actor, input), "an address the residue holds no cell at is refused by name").rejects.toThrow();
    expect(await outcomesOf(it, callId), "a refused act judged nothing").toEqual([]);
  }, BUDGET_MS);
});

describe("the calibration line reads this question with no code of its own", () => {
  test("the rows the acts left derive `coverage-cause`'s confirmed, overruled and awaiting counts", async () => {
    const it = await staged();
    const calibration = await productModule<CalibrationSeam>("src/core/model-calibration.ts");
    const calls: { callId: string; question: string | null; outcome: string; judgment: { confidence: number | null } | null }[] = [];
    for (const row of await rowsOf(MODEL_CALLS, it.tenantId)) {
      const question = await fieldOf(row, "question", "question");
      if (String(question ?? "") !== QUESTION) continue;
      calls.push({
        callId: String(await fieldOf(row, "callId", "call_id")),
        question: QUESTION,
        outcome: String(await fieldOf(row, "outcome", "outcome")),
        judgment: (await fieldOf(row, "judgment", "judgment")) as { confidence: number | null } | null,
      });
    }
    const outcomes: { callId: string; outcome: string }[] = [];
    for (const row of await rowsOf(MODEL_CALL_OUTCOMES, it.tenantId)) {
      if (String(await fieldOf(row, "question", "question")) !== QUESTION) continue;
      outcomes.push({ callId: String(await fieldOf(row, "callId", "call_id")), outcome: String(await fieldOf(row, "outcome", "outcome")) });
    }

    const line = calibration.calibrationLinesOf(calls, outcomes).find((held) => held.question === QUESTION);
    expect(line, `the ledger holds ${QUESTION} rows, so the audit's panel reads a line for it: ${JSON.stringify(calls)}`).toBeTruthy();
    expect(line?.confirmed, "the cause the person took").toBe(1);
    expect(line?.overruled, "the cause they did not").toBe(1);
    expect(line?.awaiting, "and the proposals nobody acted on").toBeGreaterThanOrEqual(1);
    expect(line?.repudiated, "this question writes no REPUDIATED outcome, by design (I-297)").toBe(0);
    expect(line?.affirmed, "and no AFFIRMED one").toBe(0);
    expect(line?.meanConfidenceWhenRight, "the figure the confidence floor is set from").not.toBeNull();
    expect(line?.meanConfidenceWhenWrong).not.toBeNull();
  }, BUDGET_MS);
});
