/**
 * Jev logic-point 6 — what a person's act does with the corroboration proposal that stood beside the
 * object they acted on (L-AI-02, L-AI-03, L-QTY-04, L-ACT-01).
 *
 * DB LANE: the acts are driven through the very doors the register's inspector presses, over a
 * staged campaign and one live database, and the proposals they judge are rows of the real
 * `model_calls` ledger — a judgment about a call is only a fact if the call is one.
 *
 * What is graded: the four-way table the caller's band states (`src/core/outline-corroboration/law`)
 * — corroborating what the machine read as the member AFFIRMS it, striking it REPUDIATES it,
 * striking what the machine read as something else CONFIRMS the reading it pointed to, and
 * corroborating that OVERRULES it — that the outcome lands with the act row and names it, and the
 * three silences: a proposal the machine could not tell about, a call put under another question,
 * and an act performed beside no proposal at all. The act itself stands in every one of those cases.
 */
import { afterAll, describe, expect, test } from "vitest";
import { randomUUID } from "node:crypto";
import {
  CORROBORATE,
  FIRST_UNIT,
  FIRST_VALUE,
  MEASURE,
  PERMISSION_NOT_HELD,
  REPUDIATE,
  actIdOf,
  closeStage,
  codeOf,
  corroboration,
  door,
  field,
  previewed,
  rejection,
  repudiation,
  rowsOf,
  sql,
  stageRegisterCampaign,
  stageReviewer,
  takeoffCaller,
  type StagedRegisterCampaign,
} from "./support/register-ui-stage";

/** How long a staged campaign may take: the shipped seams, driven end to end, over one database. */
const BUDGET_MS = 900_000;

/** The ledger table a proposal stands in, and the table an act's judgment of it is filed in. */
const MODEL_CALLS_TABLE = "model_calls";
const MODEL_CALL_OUTCOMES_TABLE = "model_call_outcomes";

/** The question this point asks, as the ledger files it (`MODEL_QUESTIONS.outlineCorroboration`). */
const QUESTION = "outline-corroboration";

/** The model the question is pinned to until the owner's Jev amendment lands (AS-05). */
const MODEL_ID = "claude-sonnet-5";

afterAll(async () => {
  await closeStage();
}, 120_000);

let staging: Promise<StagedRegisterCampaign> | undefined;
const staged = (): Promise<StagedRegisterCampaign> => (staging ??= stageRegisterCampaign("corroboration-outcome"));

/**
 * One proposed call in the ledger, with the probability Jev stated for it — a Noul's probability IS
 * its judgment, so the ledger's `confidence` is the figure the caller's band is applied to.
 */
function proposalStanding(it: StagedRegisterCampaign, probability: number, question: string = QUESTION): string {
  const callId = randomUUID();
  const judgment = JSON.stringify({
    provider: "jev-2026.09",
    confidence: probability,
    answers: { outline_corroborates: { type: "noul", value: probability, confidence: probability, probabilities: null } },
  });
  sql(
    `insert into ${MODEL_CALLS_TABLE} (call_id, tenant_id, project_id, model_id, request_hash, transport, outcome, input_tokens, output_tokens, attributed_cost, question, judgment)
     values ('${callId}', '${it.tenantId}', '${it.projectId}', '${MODEL_ID}', 'sha256:${callId}', 'fixture', 'proposed', 420, 12, 0.00129, '${question}', '${judgment}'::json);`,
  );
  return callId;
}

/** Every outcome filed against one call, as the store holds them. */
function outcomesOf(it: StagedRegisterCampaign, callId: string): Record<string, unknown>[] {
  return rowsOf(MODEL_CALL_OUTCOMES_TABLE, it.tenantId).filter((row) => String(field(row, "callId", "call_id")) === callId);
}

/** One reading recorded on an object, naming the proposal it was recorded beside. */
async function corroborate(it: StagedRegisterCampaign, objectKey: string, proposalCallId: string | undefined, value: string = FIRST_VALUE): Promise<string> {
  const caller = await takeoffCaller(it.person);
  const input = {
    ...corroboration({ projectId: it.projectId, objectKey, valueAsWritten: value, unitAsWritten: FIRST_UNIT, precedence: 0, sourceKey: it.sourceKeys[objectKey] as string }),
    ...(proposalCallId === undefined ? {} : { proposalCallId }),
  };
  const shown = previewed(await door(caller, "previewCorroborate")({ input }), "takeoff.previewCorroborate");
  return actIdOf(await door(caller, "commitCorroborate")({ input, consequenceDigest: shown.consequenceDigest }), "takeoff.commitCorroborate");
}

/** One object struck, naming the proposal the person struck it beside. */
async function repudiate(it: StagedRegisterCampaign, objectKey: string, proposalCallId: string): Promise<string> {
  const caller = await takeoffCaller(it.person);
  const input = { ...repudiation(it.projectId, objectKey), proposalCallId };
  const shown = previewed(await door(caller, "previewRepudiate")({ input }), "takeoff.previewRepudiate");
  return actIdOf(await door(caller, "commitRepudiate")({ input, consequenceDigest: shown.consequenceDigest }), "takeoff.commitRepudiate");
}

/** The outcomes filed against one call, in the order they were recorded. */
const outcomeWords = (rows: readonly Record<string, unknown>[]): string[] => rows.map((row) => String(field(row, "outcome", "outcome")));

describe("the machine said the outline IS the member its mark names", () => {
  test("corroborating the object files AFFIRMED, with the act that carried it and the person who acted", async () => {
    const it = await staged();
    const objectKey = it.objectKeys[0] as string;
    const callId = proposalStanding(it, 0.93);

    const actId = await corroborate(it, objectKey, callId);

    const filed = outcomesOf(it, callId);
    expect(filed.length, "one outcome, filed once (L-AI-02)").toBe(1);
    const row = filed[0] as Record<string, unknown>;
    expect(String(field(row, "outcome", "outcome")), "the person affirmed what the machine said").toBe("AFFIRMED");
    expect(String(field(row, "question", "question")), "filed under the question the call put — the line the calibration reads").toBe(QUESTION);
    expect(String(field(row, "actId", "act_id")), "the act that carried the judgment (the CONFIRM_VIEW_TYPE precedent)").toBe(actId);
    expect(String(field(row, "actorUserId", "actor_user_id")), "and the person who acted").toBe(it.person.userId);
  }, BUDGET_MS);
});

describe("the machine said it is something else the plan drew there", () => {
  test("corroborating the object anyway OVERRULES the reading it proposed", async () => {
    const it = await staged();
    const objectKey = it.objectKeys[0] as string;
    const callId = proposalStanding(it, 0.11);

    await corroborate(it, objectKey, callId, "305");

    expect(outcomeWords(outcomesOf(it, callId))).toEqual(["OVERRULED"]);
  }, BUDGET_MS);
});

describe("what is filed neither way", () => {
  test("a proposal in the band: the machine stated it could not tell, so the act judges nothing", async () => {
    const it = await staged();
    const objectKey = it.objectKeys[0] as string;
    const callId = proposalStanding(it, 0.5);

    const actId = await corroborate(it, objectKey, callId, "310");

    expect(actId, "the act itself stands — it is the person's, and it never fails because a proposal moved").toBeTruthy();
    expect(outcomesOf(it, callId), "and nothing is filed: an outcome from the band would poison the line the band is set from").toEqual([]);
  }, BUDGET_MS);

  test("a call put under another question is a proposal this act judged nothing of", async () => {
    const it = await staged();
    const objectKey = it.objectKeys[0] as string;
    const elsewhere = proposalStanding(it, 0.95, "view-caption");

    await corroborate(it, objectKey, elsewhere, "315");

    expect(outcomesOf(it, elsewhere)).toEqual([]);
  }, BUDGET_MS);

  test("an act performed beside no proposal at all writes no outcome and behaves exactly as it does today", async () => {
    const it = await staged();
    const objectKey = it.objectKeys[0] as string;
    const before = rowsOf(MODEL_CALL_OUTCOMES_TABLE, it.tenantId).length;

    const actId = await corroborate(it, objectKey, undefined, "320");

    expect(actId).toBeTruthy();
    expect(rowsOf(MODEL_CALL_OUTCOMES_TABLE, it.tenantId).length, "no outcome row of any kind").toBe(before);
  }, BUDGET_MS);

  test("a caller without MEASURE is refused by name, and files no outcome for the proposal they named", async () => {
    const it = await staged();
    const objectKey = it.objectKeys[0] as string;
    const callId = proposalStanding(it, 0.93);
    const reviewer = await stageReviewer(it, "no-measure");
    const caller = await takeoffCaller(reviewer);
    const input = {
      ...corroboration({ projectId: it.projectId, objectKey, valueAsWritten: FIRST_VALUE, unitAsWritten: FIRST_UNIT, precedence: 0, sourceKey: it.sourceKeys[objectKey] as string }),
      proposalCallId: callId,
    };

    const refused = await rejection(door(caller, "commitCorroborate")({ input, consequenceDigest: "not-the-digest" }));
    expect(refused, "a reviewer recorded a reading they may not record").not.toBeNull();
    expect(await codeOf(refused), `a caller who does not hold ${MEASURE} is refused ${PERMISSION_NOT_HELD} by name (L-ACT-03)`).toBe(PERMISSION_NOT_HELD);
    expect(JSON.stringify(refused), `and the refusal names ${CORROBORATE} — what was attempted`).toContain(CORROBORATE);
    expect(outcomesOf(it, callId), "a refusal that filed a judgment is not a refusal").toEqual([]);

    const struck = await rejection(door(caller, "commitRepudiate")({ input: { ...repudiation(it.projectId, objectKey), proposalCallId: callId }, consequenceDigest: "not-the-digest" }));
    expect(await codeOf(struck), `and the same at ${REPUDIATE}'s door`).toBe(PERMISSION_NOT_HELD);
    expect(outcomesOf(it, callId)).toEqual([]);
  }, BUDGET_MS);
});

/* The two strikes stand last: an object a person has struck is one no later act may corroborate
   (I-173), so they are performed on objects of their own and after everything above. */
describe("striking the object", () => {
  test("striking what the machine read as the member REPUDIATES what it said", async () => {
    const it = await staged();
    const objectKey = it.objectKeys[1] as string;
    const callId = proposalStanding(it, 0.88);

    const actId = await repudiate(it, objectKey, callId);

    const filed = outcomesOf(it, callId);
    expect(outcomeWords(filed)).toEqual(["REPUDIATED"]);
    expect(String(field(filed[0] as Record<string, unknown>, "actId", "act_id")), "carried by the act that struck it").toBe(actId);
  }, BUDGET_MS);

  test("striking what the machine read as something else CONFIRMS the reading it pointed to", async () => {
    const it = await staged();
    const objectKey = it.objectKeys[2] as string;
    const callId = proposalStanding(it, 0.04);

    await repudiate(it, objectKey, callId);

    expect(outcomeWords(outcomesOf(it, callId))).toEqual(["CONFIRMED"]);
  }, BUDGET_MS);
});
