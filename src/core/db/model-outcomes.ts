// L-AI-01, L-AI-02: the ledger's outcome column, written and read through the tenant's own handle
// (SEAM-TENANT). A model's proposal is answered by a person later — a disposition, a confirmation, a
// corroboration — and that answer is the labeled outcome the calibration line is read over. One
// writer and two readers, here, so the act seam and the AI module speak one spelling of it (B-17).
//
// The writer takes the caller's TRANSACTION where it has one: an outcome an act carried lands with
// the act row or neither (L-ACT-01), and a disposition's outcome lands with the disposition.
import { and, desc, eq, inArray } from "drizzle-orm";
import { MODEL_OUTCOMES, modelCallOutcomes, modelCalls, type ModelJudgmentRecord, type ModelOutcome } from "./schema";
import type { TenantDb, TenantTx } from "./seam";

/** The handle a write or a read goes through: a tenant's own, or the transaction it opened. */
type Handle = TenantDb | TenantTx;

/** How the ledger spells a call that answered — the only kind an outcome can be about. */
const PROPOSED = "proposed";

/** The question a call recorded before the column existed is filed under, on its outcomes and its line. */
export const UNNAMED_QUESTION = "unnamed";

/** How many of a project's calls the ledger panel lists: the newest, and the rest are the count's. */
const LEDGER_PANEL_LIMIT = 200;

/** What one outcome is recorded from: the call it judges, how, by whom, and the act that carried it. */
export type ModelOutcomeInput = {
  readonly tenantId: string;
  readonly projectId: string;
  readonly callId: string;
  readonly outcome: ModelOutcome;
  /** The act that carried the judgment, or null where a record and not an act did (L-ACT-01). */
  readonly actId: string | null;
  readonly actorUserId: string;
};

/** One row of the ledger, as the audit's panel and the calibration line read it. */
export type ModelLedgerEntry = {
  readonly callId: string;
  readonly modelId: string;
  readonly question: string | null;
  readonly transport: string;
  readonly outcome: string;
  readonly refusalCode: string | null;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly attributedCost: string;
  readonly judgment: ModelJudgmentRecord | null;
  readonly calledAt: Date;
};

/** One recorded outcome, as the store holds it. */
export type ModelOutcomeEntry = {
  readonly outcomeId: string;
  readonly callId: string;
  readonly question: string;
  readonly outcome: ModelOutcome;
  readonly actId: string | null;
  readonly actorUserId: string;
  readonly recordedAt: Date;
  readonly recordedSeq: number;
};

/**
 * Record what a person did with a proposed call. The call is looked up on the writing handle: an
 * outcome of a call this tenant and project never made would be a record pointing at nothing, and
 * a refused call proposed nothing a person could judge (L-AI-02) — both are caller defects, never
 * refusals (ARCH-03), because no person can act differently in response to them.
 */
export async function recordModelOutcome(db: Handle, input: ModelOutcomeInput): Promise<{ outcomeId: string }> {
  const outcome = pinned(input.outcome);
  const [call] = await db
    .select({ outcome: modelCalls.outcome, question: modelCalls.question })
    .from(modelCalls)
    .where(and(eq(modelCalls.tenantId, input.tenantId), eq(modelCalls.projectId, input.projectId), eq(modelCalls.callId, input.callId)));
  if (call === undefined) {
    throw new Error(`the model-call ledger holds no call ${input.callId} for project ${input.projectId} — an outcome judges a call that was made (L-AI-01)`);
  }
  if (call.outcome !== PROPOSED) {
    throw new Error(`call ${input.callId} was ${call.outcome} and proposed nothing — an outcome judges a proposal (L-AI-02)`);
  }
  const [written] = await db
    .insert(modelCallOutcomes)
    .values({
      tenantId: input.tenantId,
      projectId: input.projectId,
      callId: input.callId,
      // A call the ledger recorded before questions were named is judged under the name a reader
      // can still file it by: the one word the ledger holds for "no question was named".
      question: call.question ?? UNNAMED_QUESTION,
      outcome,
      actId: input.actId,
      actorUserId: input.actorUserId,
    })
    .returning({ outcomeId: modelCallOutcomes.outcomeId });
  if (written === undefined) throw new Error(`the ${outcome} outcome of call ${input.callId} was written and answered no outcome id`);
  return { outcomeId: written.outcomeId };
}

/**
 * One project's ledger, newest first, capped at the panel's window: the audit's model ledger lists
 * the newest calls and states the count of all of them, and a read of every row of a project that
 * has called a model ten thousand times would be a read nobody asked for.
 */
export async function modelLedgerRowsOf(db: Handle, scope: { tenantId: string; projectId: string }, limit: number = LEDGER_PANEL_LIMIT): Promise<ModelLedgerEntry[]> {
  const rows = await db
    .select({
      callId: modelCalls.callId,
      modelId: modelCalls.modelId,
      question: modelCalls.question,
      transport: modelCalls.transport,
      outcome: modelCalls.outcome,
      refusalCode: modelCalls.refusalCode,
      inputTokens: modelCalls.inputTokens,
      outputTokens: modelCalls.outputTokens,
      attributedCost: modelCalls.attributedCost,
      judgment: modelCalls.judgment,
      calledAt: modelCalls.calledAt,
    })
    .from(modelCalls)
    .where(and(eq(modelCalls.tenantId, scope.tenantId), eq(modelCalls.projectId, scope.projectId)))
    .orderBy(desc(modelCalls.calledAt), desc(modelCalls.callId))
    .limit(limit);
  return rows.map((row) => ({ ...row, judgment: row.judgment ?? null }));
}

/**
 * What one call's model said about its own answer, read back by the call id (L-AI-02 closes a
 * Proposal's list at payload, sources, model and callId, so the judgment is a LEDGER fact and never
 * a member of the proposal — the seam's own recorded Interpretation).
 *
 * A caller reads it to apply its own threshold policy: whether a proposal carrying this confidence
 * is shown to a person at all is the caller's decision and never the seam's. A call this tenant and
 * project never made answers `null` — an absence, not a fault, because a caller may hold the id of a
 * call whose row another tenant's handle wrote and must be told nothing about it (SEAM-TENANT).
 */
export async function modelJudgmentOf(db: Handle, scope: { tenantId: string; projectId: string }, callId: string): Promise<ModelJudgmentRecord | null> {
  const [row] = await db
    .select({ judgment: modelCalls.judgment })
    .from(modelCalls)
    .where(and(eq(modelCalls.tenantId, scope.tenantId), eq(modelCalls.projectId, scope.projectId), eq(modelCalls.callId, callId)))
    .limit(1);
  return row?.judgment ?? null;
}

/**
 * The outcomes recorded against some calls, newest first — the instant, then the store's own count,
 * so two outcomes inside one tick still stand in one order. An empty list of calls asks nothing.
 */
export async function modelOutcomeRowsOf(db: Handle, scope: { tenantId: string; projectId: string }, callIds?: readonly string[]): Promise<ModelOutcomeEntry[]> {
  if (callIds !== undefined && callIds.length === 0) return [];
  const rows = await db
    .select()
    .from(modelCallOutcomes)
    .where(
      and(
        eq(modelCallOutcomes.tenantId, scope.tenantId),
        eq(modelCallOutcomes.projectId, scope.projectId),
        ...(callIds === undefined ? [] : [inArray(modelCallOutcomes.callId, [...callIds])]),
      ),
    )
    .orderBy(desc(modelCallOutcomes.createdAt), desc(modelCallOutcomes.recordedSeq));
  return rows.map((row) => ({
    outcomeId: row.outcomeId,
    callId: row.callId,
    question: row.question,
    outcome: row.outcome,
    actId: row.actId,
    actorUserId: row.actorUserId,
    recordedAt: row.createdAt,
    recordedSeq: row.recordedSeq,
  }));
}

/** The outcome as one of the closed roster's, checked at runtime too (the column is closed too). */
function pinned(outcome: string): ModelOutcome {
  if (!(MODEL_OUTCOMES as readonly string[]).includes(outcome)) {
    throw new Error(`${JSON.stringify(outcome)} is no model outcome — a proposal is ${MODEL_OUTCOMES.join(", ")} (L-AI-02)`);
  }
  return outcome as ModelOutcome;
}
