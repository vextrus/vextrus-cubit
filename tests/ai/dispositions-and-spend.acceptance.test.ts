// @vitest-environment node
/**
 * Public acceptance for AC-3 and AC-4 (R-AI-001, R-AI-005, L-AI-01, L-ACT-01): every
 * accepted/edited/rejected disposition of a proposal is recorded and read back newest-first, and
 * one project's calls, outcomes, tokens, money and disposition counts are visible together.
 *
 * A live stage: the database, the account and the project come from the upload seam's own stage
 * (P-1), and the ledger is the shipped `dbModelLedger` over the tenant's handle (P-2), so the call
 * ids a disposition is keyed by are ids the real `model_calls` table generated. Staged lazily so a
 * staging failure fails cases rather than skipping them, and `closePools()` runs before the drop —
 * the scratch drop races the pool.
 *
 * Every figure AC-4 expects is derived from the ledger rows the calls actually wrote, never
 * transcribed (B-19).
 */
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { afterAll, describe, expect, test } from "vitest";
import { closeStage, enrol, openStage, stageProject } from "../spine/uploads/support/upload-stage";
import { and, closePools, eq, forTenant, modelCalls } from "../../src/core/db";
import { refusalCodeOf } from "../../src/core/faults/refusal-marker";
import { minimalDecimal, modelCallCost } from "../../src/core/model-ledger.types";
import { readTitleBlock } from "../../src/core/sheets";
import {
  ACCEPTED,
  EDITED,
  FIXTURE_MISSING,
  FIXTURE_ROOT,
  OPUS,
  OUTCOME_PROPOSED,
  OUTCOME_REFUSED,
  REJECTED,
  REPO_ROOT,
  RESOLVED,
  SILENT_GRAPH,
  TRANSPORT_FIXTURE,
  builtGraph,
  contextFor,
  layoutsOfKind,
  productModule,
  projectAiSpend,
  rejectionOf,
  seamPort,
  silentCorpusGraph,
  understandingMember,
  type Context,
  type Ledger,
  type Reading,
  type Understanding,
} from "./support/understanding-stage";

/** The layout of the hand-built artifact the corpus deliberately does not answer for (AC-4's refusal). */
const UNANSWERED_SHEET = "S-UNANSWERED";

type Stage = {
  tenantId: string;
  actor: string;
  /** The project both calls and all three dispositions are made in (AC-4's project P). */
  projectId: string;
  /** A project of the same tenant nothing was ever called for (AC-4's empty answer). */
  quietProjectId: string;
  understanding: Understanding;
  ctx: Context;
  sheetId: string;
};

let staging: Promise<Stage> | undefined;

/**
 * One proposed call and one refused call in project P, both through the shipped ledger. The
 * proposed one replays from the committed corpus; the refused one asks about a hand-built silent
 * sheet no recording answers for, which is the refusal AC-4 counts.
 */
const staged = (): Promise<Stage> =>
  (staging ??= (async () => {
    const understandSheet = await understandingMember("understandSheet");
    await openStage();
    const person = await enrol("ai-spend");
    const projectId = stageProject(person.tenantId, "Sheet understanding");
    const quietProjectId = stageProject(person.tenantId, "No model calls");

    const barrel = await productModule<{ dbModelLedger?: (db: unknown) => Ledger }>("src/core/model/index.ts");
    expect(typeof barrel.dbModelLedger, "src/core/model/index.ts does not export dbModelLedger (L-AI-01)").toBe("function");
    const ledger = (barrel.dbModelLedger as NonNullable<typeof barrel.dbModelLedger>)(forTenant({ tenantId: person.tenantId }));
    const { port } = await seamPort(join(REPO_ROOT, FIXTURE_ROOT), ledger);

    const ctx = contextFor(person.tenantId, projectId, person.userId);

    const corpus = silentCorpusGraph();
    const layoutName = layoutsOfKind(corpus, "paper")[0]?.name ?? "";
    expect(layoutName, `${SILENT_GRAPH} carries the paper layout the proposed call is made about`).not.toBe("");
    const understanding = await understandSheet(ctx, { graph: corpus, layoutName, artifactDigest: randomUUID() }, port);
    expect(understanding.basis, "the corpus sheet is the proposed call AC-4 counts").toBe("MODEL");

    const unanswered = builtGraph({ paperLayout: UNANSWERED_SHEET, texts: [], salt: 7 });
    expect(readTitleBlock(unanswered, UNANSWERED_SHEET).basis, "the hand-built sheet carries no readable TEXT, so the grammar is silent and the model is asked").toBe("NONE");
    const refusal = await rejectionOf(understandSheet(ctx, { graph: unanswered, layoutName: UNANSWERED_SHEET, artifactDigest: randomUUID() }, port));
    expect(refusal, "a sheet the corpus does not answer for is refused, never sent to a provider").not.toBe(RESOLVED);
    expect(refusalCodeOf(refusal), "an unrecorded answer is FIXTURE_MISSING (L-AI-01)").toBe(FIXTURE_MISSING);

    return { tenantId: person.tenantId, actor: person.userId, projectId, quietProjectId, understanding, ctx, sheetId: `${randomUUID()}:${layoutName}` };
  })());

/** The three dispositions of AC-3, recorded once in the criterion's own order and memoised. */
let disposing: Promise<{ ids: string[]; proposed: Reading; resolved: Reading }> | undefined;

const disposed = (): Promise<{ ids: string[]; proposed: Reading; resolved: Reading }> =>
  (disposing ??= (async () => {
    const stage = await staged();
    const recordDisposition = await understandingMember("recordDisposition");
    const callId = stage.understanding.callId ?? "";
    expect(callId, "the proposed call names the ledger row a disposition is keyed by").not.toBe("");

    const proposed = stage.understanding.reading;
    const resolved: Reading = { ...proposed, title: `${proposed.title} (as edited)`, captions: [...proposed.captions] };

    const ids: string[] = [];
    for (const [disposition, extra] of [
      [ACCEPTED, {}],
      [EDITED, { resolved }],
      [REJECTED, {}],
    ] as const) {
      const answer = await recordDisposition(stage.ctx, { callId, sheetId: stage.sheetId, disposition, proposed, ...extra });
      expect(typeof answer.dispositionId, `recording the ${disposition} disposition answers a dispositionId`).toBe("string");
      ids.push(answer.dispositionId);
    }
    return { ids, proposed, resolved };
  })());

afterAll(async () => {
  await closePools();
  await closeStage();
});

/** The ledger rows one project holds, read back under the tenant's own handle (P-4). */
async function ledgerRowsOf(tenantId: string, projectId: string) {
  return forTenant({ tenantId })
    .select()
    .from(modelCalls)
    .where(and(eq(modelCalls.tenantId, tenantId), eq(modelCalls.projectId, projectId)));
}

describe("AC-3: every disposition is recorded", () => {
  test("AC-3: accepted, edited and rejected each land against the call id, and read back newest-first with the reading they dispositioned", async () => {
    const stage = await staged();
    const { ids, proposed, resolved } = await disposed();
    const dispositionsOf = await understandingMember("dispositionsOf");

    expect(new Set(ids).size, "three dispositions, three records — a later disposition is a newer record").toBe(3);

    const rows = await dispositionsOf({ tenantId: stage.tenantId, projectId: stage.projectId });
    expect(rows.length, "the project's three dispositions are all readable").toBe(3);
    expect(
      rows.map((row) => row.disposition),
      "reads take newest-first: rejected was recorded last",
    ).toEqual([REJECTED, EDITED, ACCEPTED]);

    for (const row of rows) {
      expect(row.callId, "every disposition is keyed by the ledger's callId").toBe(stage.understanding.callId);
      expect(row.sheetId, "every disposition names the sheet it was made about").toBe(stage.sheetId);
      expect(row.proposed, "the reading that was dispositioned is recorded as it was handed in").toEqual(proposed);
      expect(row.actorUserId, "the disposition records who made it").toBe(stage.ctx.actor);
    }

    const byDisposition = new Map(rows.map((row) => [row.disposition, row]));
    expect(byDisposition.get(EDITED)?.resolved, "an edited disposition records the reading the person settled on").toEqual(resolved);
    expect(byDisposition.get(ACCEPTED)?.resolved, "an accepted disposition resolved nothing of its own").toBeNull();
    expect(byDisposition.get(REJECTED)?.resolved, "a rejected disposition resolved nothing of its own").toBeNull();
  });
});

describe("AC-4: per-project AI spend is visible", () => {
  test("AC-4: one proposed call, one refused call and three dispositions add up — and a project with no calls answers zeros, never nothing", async () => {
    const stage = await staged();
    await disposed();
    const projectAiSpendOf = await projectAiSpend();

    const rows = await ledgerRowsOf(stage.tenantId, stage.projectId);
    expect(rows.length, "the project holds the two calls the stage made").toBe(2);
    const proposedRow = rows.find((row) => row.outcome === OUTCOME_PROPOSED);
    const refusedRow = rows.find((row) => row.outcome === OUTCOME_REFUSED);
    expect(proposedRow, "one of the two calls was proposed").toBeDefined();
    expect(refusedRow, "the other was refused").toBeDefined();
    expect(proposedRow, "the proposed row is the fixture-replayed opus call").toMatchObject({ transport: TRANSPORT_FIXTURE, modelId: OPUS, refusalCode: null });
    expect(refusedRow, "the refused row names the refusal and spends nothing").toMatchObject({ transport: TRANSPORT_FIXTURE, modelId: OPUS, refusalCode: FIXTURE_MISSING, inputTokens: 0, outputTokens: 0 });

    const inputTokens = rows.reduce((total, row) => total + row.inputTokens, 0);
    const outputTokens = rows.reduce((total, row) => total + row.outputTokens, 0);
    expect(minimalDecimal(proposedRow?.attributedCost ?? "0"), "the proposed row is charged at the opus rate for the tokens it spent (B-17)").toBe(
      modelCallCost(OPUS, proposedRow?.inputTokens ?? -1, proposedRow?.outputTokens ?? -1),
    );
    expect(minimalDecimal(refusedRow?.attributedCost ?? "1"), "nothing was spent on a call the transport refused").toBe("0");

    const spend = await projectAiSpend0(projectAiSpendOf, stage.tenantId, stage.projectId);
    expect(spend, "the project's calls, outcomes, tokens, money and dispositions, in one answer").toMatchObject({
      calls: 2,
      proposed: 1,
      refused: 1,
      inputTokens,
      outputTokens,
      accepted: 1,
      edited: 1,
      rejected: 1,
    });
    expect(spend.attributedCost, "the money is the sum of what the project's rows were charged, in the one spelling (B-17)").toBe(minimalDecimal(proposedRow?.attributedCost ?? "0"));

    const quiet = await projectAiSpend0(projectAiSpendOf, stage.tenantId, stage.quietProjectId);
    expect(quiet, "a project nothing was called for answers zeros — never null, never an empty answer").toMatchObject({
      calls: 0,
      proposed: 0,
      refused: 0,
      inputTokens: 0,
      outputTokens: 0,
      accepted: 0,
      edited: 0,
      rejected: 0,
    });
    expect(quiet.attributedCost, "a project that spent nothing has spent 0 — never null, never blank").toBe("0");
  });
});

/** The spend of one project, asked for the way R-AI-005's surface will ask (AC-4). */
async function projectAiSpend0(read: Awaited<ReturnType<typeof projectAiSpend>>, tenantId: string, projectId: string) {
  const answer = await read({ tenantId, projectId });
  expect(answer, `projectAiSpendOf answered nothing for project ${projectId}`).toBeTruthy();
  return answer;
}
