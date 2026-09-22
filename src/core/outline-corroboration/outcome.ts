// L-AI-02's labeled outcome for this question: what a person's act did with the proposal that stood
// beside the object they acted on, written INSIDE the act's own transaction (L-ACT-01: it lands with
// the act row, or neither) — the CONFIRM_VIEW_TYPE precedent, over the two acts the register's
// inspector already presses.
//
// The model's own figure is read off the ledger row rather than carried on the act's input, so that
// nothing a caller states about a model's answer can disagree with what the ledger recorded. The
// figure is the Noul's PROBABILITY, which is the answer's `value`: a Noul states no confidence at
// all (`../model/typesafe.ts`'s `answerJudgmentOf`), so this call's `judgment.confidence` is null
// and the probability has exactly one home. Reading it off the confidence would be reading a
// different quantity — a model certain the outline is NOT the member states a low probability.
//
// An act is the person's and never fails because a proposal moved: a call this project did not make,
// a call that refused, a call put under another question, and a proposal in the uncertain band all
// write NOTHING and answer null. The act itself stands in every one of those cases.
import { and, eq, modelCalls, recordModelOutcome, type ModelOutcome, type TenantTx } from "../db";
import { MODEL_QUESTIONS, OUTLINE_QUESTION_ID } from "../model";
import { corroborationOutcomeOf, corroborationReadingOf, type CorroborationAct } from "./law";

/** How the ledger spells a call that answered — the only kind an outcome can judge (L-AI-02). */
const PROPOSED = "proposed";

/** What one act judges: the proposal it stood beside, and the act that carried the judgment. */
export type CorroborationJudgment = {
  readonly tenantId: string;
  readonly projectId: string;
  /** The proposal the person acted on, as the screen showed it. */
  readonly callId: string;
  readonly act: CorroborationAct;
  readonly actId: string;
  readonly actorUserId: string;
};

/**
 * Record what this act did with the outline-corroboration proposal it judged, or nothing where there
 * is nothing to file. Answers the outcome it wrote, so a caller and a test can say which way it fell
 * without reading the store back.
 */
export async function recordCorroborationOutcomeIn(tx: TenantTx, judgment: CorroborationJudgment): Promise<ModelOutcome | null> {
  const [call] = await tx
    .select({ outcome: modelCalls.outcome, question: modelCalls.question, judgment: modelCalls.judgment })
    .from(modelCalls)
    .where(and(eq(modelCalls.tenantId, judgment.tenantId), eq(modelCalls.projectId, judgment.projectId), eq(modelCalls.callId, judgment.callId)));
  // A proposal that is not this project's, not this question's, or that refused, is a proposal this
  // act judged nothing of: the person still acted, and the ledger is left saying what it said.
  if (call === undefined || call.outcome !== PROPOSED || call.question !== MODEL_QUESTIONS.outlineCorroboration) return null;

  // The one answer this question has, by the id its arm asked under — never a second spelling of it.
  // A value that is not a number is no probability, and a call that recorded no judgment at all (a
  // generative transport states none) holds none: both read as silence, and silence files nothing.
  const answered = call.judgment?.answers[OUTLINE_QUESTION_ID]?.value ?? null;
  const outcome = corroborationOutcomeOf(corroborationReadingOf(typeof answered === "number" ? answered : null), judgment.act);
  // The band: the model stated it could not tell, so the act files the proposal neither right nor
  // wrong — the calibration line this threshold is set from would be poisoned by either (`./law`).
  if (outcome === null) return null;

  await recordModelOutcome(tx, {
    tenantId: judgment.tenantId,
    projectId: judgment.projectId,
    callId: judgment.callId,
    outcome,
    actId: judgment.actId,
    actorUserId: judgment.actorUserId,
  });
  return outcome;
}
