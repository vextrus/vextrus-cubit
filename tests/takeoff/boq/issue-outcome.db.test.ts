// @vitest-environment node
/**
 * DB LANE — the judgment the draft's ISSUE passes on the descriptions it took (L-AI-02, L-AI-03,
 * I-298), live, against a scratch database the committed migrations built.
 *
 * What is graded is the WRITE, not the render: `confirmIssuedDescriptions` is handed the very
 * payload the document was rendered from and the readings the draft held, inside the tenant's own
 * transaction — the one the issue files its document in — and the `model_call_outcomes` rows it
 * leaves are read back through the store's own reader (B-17, never a hand-written SELECT).
 *
 * Four rulings:
 *   · CONFIRMED is written for a call whose chosen description the ISSUED payload actually carries:
 *     the document went out with that sentence, which is "taken as proposed".
 *   · NOTHING is written where the answer was the no-match outcome and the plain description stood —
 *     no reading of the model's reached the document, so the call waits on the calibration line.
 *   · NOTHING is written where a reading stands but the payload carries another sentence: what was
 *     issued is what is judged.
 *   · The outcome is a RECORD and not an act (AM-05, I-270): `act_id` is null and the actor is the
 *     person who asked for the render; a call of another project is refused by name by the store.
 *
 * The door itself — `takeoffBoq.exportDraft` under MEASURE — is judged by name in
 * `tests/takeoff/boq/export-door-guard.db.test.ts`, which this file does not repeat.
 */
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, test } from "vitest";
import { provisionScratchDb, type ScratchDb } from "../../../db/__tests__/harness";
import { TENANT_ALPHA } from "../../../db/__tests__/support/fixtures";
import { seedTenants } from "../../../db/__tests__/support/live-sql";
import { closePools, forTenant, modelOutcomeRowsOf } from "@/core/db";
import { MODEL_QUESTIONS, dbModelLedger } from "@/core/model";
import { modelCallCost } from "@/core/model-ledger.types";
import type { BoqDraftPayload } from "@/core/documents/kinds/boq-draft";
import { candidateItemsFor } from "@/core/catalogue/item-descriptions";
import { DEFAULTED, INTERPRETED, groupKeyOf, type GroupDescriptions } from "@/modules/takeoff/boq/description-basis";
import { confirmIssuedDescriptions } from "@/modules/takeoff/boq/job";

const SONNET = "claude-sonnet-5";
const REQUESTER = "00000000-0000-4000-8000-00000000f1f1";
const GROUP_KEY = groupKeyOf("brick_wall", "masonry.brickwork");

/** The description a model chose for the brick wall, out of the closed catalogue's own roster. */
const CHOSEN = candidateItemsFor("brick_wall", "masonry.brickwork")[0];

type Stage = { tenantId: string; projectId: string };

let scratch: ScratchDb | undefined;
let staging: Promise<Stage> | undefined;

const staged = (): Promise<Stage> =>
  (staging ??= (async () => {
    const provisioned = await provisionScratchDb();
    scratch = provisioned;
    const tenantId = seedTenants(provisioned.urlMigrate)[TENANT_ALPHA] ?? "";
    expect(tenantId, `the scenario seeded no ${TENANT_ALPHA}`).not.toBe("");
    // The seam pools per URL at connection time, so the app URL is named before the first query.
    process.env["DATABASE_URL"] = provisioned.urlApp;
    return { tenantId, projectId: randomUUID() };
  })());

afterAll(async () => {
  await closePools();
  await scratch?.drop();
});

/** One proposed call of this question, as the seam's own ledger writes one (L-AI-01). */
async function proposedCall(stage: Stage): Promise<string> {
  const ledger = dbModelLedger(forTenant({ tenantId: stage.tenantId }));
  const { callId } = await ledger.record({
    tenantId: stage.tenantId,
    projectId: stage.projectId,
    modelId: SONNET,
    requestHash: randomUUID().replace(/-/gu, "").padEnd(64, "0"),
    transport: "fixture",
    outcome: "proposed",
    refusalCode: null,
    inputTokens: 900,
    outputTokens: 0,
    attributedCost: modelCallCost(SONNET, 900, 0),
    question: MODEL_QUESTIONS.boqLineDescription,
    judgment: null,
  });
  return callId;
}

/** The draft as it was issued: one section, one group, billed under the description it carries. */
function issuedCarrying(description: string): BoqDraftPayload {
  return {
    title: "Bill of Quantities",
    project: "Scratch",
    campaignId: randomUUID(),
    setRevisionId: randomUUID(),
    taxonomyVersion: "0",
    coverage: "INCOMPLETE",
    sections: [
      {
        bill: "SUPERSTRUCTURE",
        label: "Superstructure",
        groups: [
          {
            class: "brick_wall",
            kind: "masonry.brickwork",
            description,
            unit: "m3",
            lines: [],
            subtotals: [{ unit: "m3", value: "0.000" }],
          },
        ],
        subtotals: [{ unit: "m3", value: "0.000" }],
      },
    ],
    unclassified: { label: "Unclassified", lines: [] },
  } as BoqDraftPayload;
}

/** The judgment, passed the way the issue passes it: inside the tenant's own transaction. */
async function judge(stage: Stage, issued: BoqDraftPayload, descriptions: GroupDescriptions): Promise<void> {
  await forTenant({ tenantId: stage.tenantId }).transaction(async (tx) => {
    await confirmIssuedDescriptions(tx, { tenantId: stage.tenantId, projectId: stage.projectId, campaignId: randomUUID(), requestedBy: REQUESTER }, issued, descriptions);
  });
}

describe("the draft's issue, judging the descriptions it took", () => {
  test("writes one CONFIRMED record for a chosen description the issued draft carries, with no act behind it", async () => {
    const stage = await staged();
    const callId = await proposedCall(stage);
    await judge(stage, issuedCarrying(CHOSEN?.text ?? ""), new Map([[GROUP_KEY, { text: CHOSEN?.text ?? null, basis: INTERPRETED, callId }]]));

    const [written] = await modelOutcomeRowsOf(forTenant({ tenantId: stage.tenantId }), stage, [callId]);
    expect(written, "the issue judged the call the description came from").toBeDefined();
    expect(written?.outcome, "the document went out carrying that sentence: taken as proposed").toBe("CONFIRMED");
    expect(written?.question, "the outcome is filed under the question the call was").toBe(MODEL_QUESTIONS.boqLineDescription);
    expect(written?.actId, "a draft is not an act, so the record carries none (AM-05, I-270)").toBeNull();
    expect(written?.actorUserId, "the person who asked for the render is who took it").toBe(REQUESTER);
  }, 300_000);

  test("writes nothing where the answer was the no-match outcome and the plain description stood", async () => {
    const stage = await staged();
    const callId = await proposedCall(stage);
    await judge(stage, issuedCarrying("Brick wall · Brickwork"), new Map([[GROUP_KEY, { text: null, basis: DEFAULTED, callId }]]));

    expect(await modelOutcomeRowsOf(forTenant({ tenantId: stage.tenantId }), stage, [callId]), "an abstention is judged by nobody — the call waits (L-AI-02)").toEqual([]);
  }, 300_000);

  test("writes nothing where the issued draft carries another sentence than the one proposed", async () => {
    const stage = await staged();
    const callId = await proposedCall(stage);
    await judge(stage, issuedCarrying("Brick wall · Brickwork"), new Map([[GROUP_KEY, { text: CHOSEN?.text ?? null, basis: INTERPRETED, callId }]]));

    expect(await modelOutcomeRowsOf(forTenant({ tenantId: stage.tenantId }), stage, [callId]), "what was ISSUED is what is judged, never what was merely read").toEqual([]);
  }, 300_000);

  test("refuses, by name, a judgment of a call this project never made", async () => {
    const stage = await staged();
    const stranger = randomUUID();
    let thrown: unknown;
    try {
      await judge(stage, issuedCarrying(CHOSEN?.text ?? ""), new Map([[GROUP_KEY, { text: CHOSEN?.text ?? null, basis: INTERPRETED, callId: stranger }]]));
    } catch (caught) {
      thrown = caught;
    }
    expect(thrown, "an outcome pointing at no call of this project is a caller defect, never a row").toBeInstanceOf(Error);
    expect(String((thrown as Error).message), "the store names the call it holds nothing for (L-AI-01)").toContain(stranger);
  }, 300_000);
});
