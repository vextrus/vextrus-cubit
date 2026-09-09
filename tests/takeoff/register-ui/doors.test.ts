/**
 * AC-8's seam half — the level stack confirms WHOLE, and the Measure door enqueues the campaign's
 * run (R-UI-023, L-ACT-01/02, R-TO-050, inc-209's `requestMeasure`).
 *
 * Both doors are driven on the takeoff lane, as the screen presses them. The offer is confirmed as
 * ONE act with N subjects — the granularity L-ACT-01 records at — and the levels it inserted are
 * read back by the act that wrote them. The Measure door is asked twice: a campaign whose
 * measurement already stands under its key is the same ask, which is what makes the door idempotent
 * in the store rather than in a caller's memory.
 */
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, test } from "vitest";
import {
  ACTS_TABLE,
  CAMPAIGN_NOT_FOUND,
  INSERT_LEVEL,
  LEVELS_TABLE,
  actIdOf,
  actsOf,
  closeStage,
  door,
  field,
  insertion,
  measureSeam,
  previewed,
  rowsOf,
  sql,
  stagePerson,
  stageRegisterCampaign,
  subjectsOf,
  takeoffCaller,
  type StagedRegisterCampaign,
} from "./support/register-ui-stage";

/** How long a staged campaign may take: the shipped seams, driven end to end, over one database. */
const BUDGET_MS = 900_000;

afterAll(async () => {
  await closeStage();
}, 120_000);

let staging: Promise<StagedRegisterCampaign> | undefined;
const staged = (): Promise<StagedRegisterCampaign> => (staging ??= stageRegisterCampaign("doors"));

/** The levels one offered stack proposes — three, standing above the ground floor the stage inserted. */
const PROPOSED: readonly { label: string; ordinal: number }[] = [
  { label: "L1", ordinal: 1 },
  { label: "L2", ordinal: 2 },
  { label: "L3", ordinal: 3 },
];

/** How many claims stand under one job key — the row a request leaves behind (SEAM-JOBS). */
function claimsUnder(kind: string, key: string): number {
  const rows = sql(`select count(*) from cubit_jobs.job_claims where kind = '${kind}' and key = '${key}';`);
  return Number(rows[0]?.[0] ?? 0);
}

describe("AC-8 — the offered level stack confirms as one act", () => {
  test("AC-8: one INSERT_LEVEL with a subject per proposed level, and a levels row per subject", async () => {
    const it = await staged();
    const caller = await takeoffCaller(it.person);
    const before = actsOf(it.tenantId, INSERT_LEVEL).length;
    const input = insertion(it.projectId, PROPOSED);

    const shown = previewed(await door(caller, "previewInsertLevel")({ input }), "takeoff.previewInsertLevel");
    expect(subjectsOf(shown.consequence).length, "the offer is judged whole: one subject per level it proposes (L-ACT-01)").toBe(PROPOSED.length);

    const actId = actIdOf(await door(caller, "commitInsertLevel")({ input, consequenceDigest: shown.consequenceDigest }), "takeoff.commitInsertLevel");
    const after = actsOf(it.tenantId, INSERT_LEVEL);
    expect(after.length - before, "exactly one act row — a confirm-all is ONE act, never one per row (L-ACT-01)").toBe(1);

    const written = after.filter((row) => String(field(row, "actId", "act_id")) === actId);
    expect(written.length, "the act the door answered is the act the ledger holds").toBe(1);
    expect((field(written[0] as Record<string, unknown>, "subjects", "subjects") as unknown[]).length, `and it names its ${PROPOSED.length} subjects`).toBe(PROPOSED.length);

    const levels = rowsOf(LEVELS_TABLE, it.tenantId).filter((row) => String(field(row, "insertedActId", "inserted_act_id")) === actId);
    expect(levels.length, "one levels row per proposed level, each carrying the act that inserted it").toBe(PROPOSED.length);
    expect(
      levels.map((row) => String(field(row, "label", "label"))).sort(),
      "and the labels are the offer's own, verbatim — nothing is assembled from what a person clicked",
    ).toEqual(PROPOSED.map((level) => level.label).sort());
  }, BUDGET_MS);
});

describe("AC-8 — the Measure door", () => {
  test("AC-8: the door answers requestMeasure's own answer, and the campaign's job stands under its key", async () => {
    const it = await staged();
    const measure = await measureSeam();
    const caller = await takeoffCaller(it.person);
    const key = measure.measureJobKey(it.tenantId, it.campaignId);

    const answer = (await door(caller, "requestMeasure")({ projectId: it.projectId, campaignId: it.campaignId })) as Record<string, unknown>;
    expect(answer["requested"], `the door answers the measure door's own answer: ${JSON.stringify(answer)}`).toBe(true);
    expect(typeof answer["jobId"], "carrying the job that holds the campaign").toBe("string");
    expect(answer["deduplicated"], "the first ask is not a repeat of one already standing").toBe(false);
    expect(claimsUnder(measure.MEASURE_KIND, key), "and a job stands under the key this campaign's measurement is keyed on").toBeGreaterThan(0);

    const again = (await door(caller, "requestMeasure")({ projectId: it.projectId, campaignId: it.campaignId })) as Record<string, unknown>;
    expect(again["jobId"], "asking again while it stands is the same ask (SEAM-JOBS: every job idempotent on its key)").toBe(answer["jobId"]);
    expect(again["deduplicated"], "and the door says so rather than queueing a second run").toBe(true);
  }, BUDGET_MS);

  test("AC-8: a project with no campaign is answered CAMPAIGN_NOT_FOUND, and nothing is enqueued", async () => {
    const fresh = await stagePerson(`measure-none-${randomUUID().slice(0, 8)}`);
    const measure = await measureSeam();
    const caller = await takeoffCaller(fresh.person);
    const campaignId = randomUUID();
    const key = measure.measureJobKey(fresh.person.tenantId, campaignId);

    const answer = (await door(caller, "requestMeasure")({ projectId: fresh.projectId, campaignId })) as Record<string, unknown>;
    expect(answer["requested"], `a project holding no campaign has nothing to measure under: ${JSON.stringify(answer)}`).toBe(false);
    expect(answer["refusal"], `and the door answers ${CAMPAIGN_NOT_FOUND} by name, in the closed taxonomy`).toBe(CAMPAIGN_NOT_FOUND);
    expect(claimsUnder(measure.MEASURE_KIND, key), "and enqueues nothing at all").toBe(0);
    expect(rowsOf(ACTS_TABLE, fresh.person.tenantId).length, "and asking to measure writes no act: enqueueing a job is not an act (Decision §1)").toBe(0);
  }, BUDGET_MS);
});
