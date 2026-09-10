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
  productModule,
  rowsOf,
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

/**
 * The queue, through the seam the measure door itself enqueues through (SEAM-JOBS, `@/core/jobs`).
 * The claim a key holds is read by asking the queue rather than by reading its tables: the queue owns
 * its own storage and nothing outside it may read those tables (ARCH-02), so what a job "standing
 * under a key" means is exactly what the seam answers about that key.
 */
interface JobsSeam {
  enqueue: (kind: string, payload: Record<string, unknown>, options: { key: string }) => Promise<{ jobId: string; deduplicated: boolean }>;
  isKnownJob: (jobId: string) => Promise<boolean>;
}

const jobsSeam = (): Promise<JobsSeam> => productModule<JobsSeam>("src/core/jobs/index.ts");

/**
 * Does a job stand under this key? Asked by enqueuing under the key and reading the answer: a claim
 * already standing dedupes onto the job that holds it, and one that is not there does not. The probe
 * is the door's own seam, so nothing here can be true of the probe and false of the door.
 */
async function standingUnder(kind: string, key: string, payload: Record<string, unknown>): Promise<{ deduplicated: boolean; jobId: string }> {
  const jobs = await jobsSeam();
  return jobs.enqueue(kind, payload, { key });
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
    expect(await (await jobsSeam()).isKnownJob(String(answer["jobId"])), "the queue holds the job the door answered").toBe(true);

    const probe = await standingUnder(measure.MEASURE_KIND, key, { tenantId: it.tenantId, projectId: it.projectId, campaignId: it.campaignId, requestedBy: it.person.userId });
    expect(probe.deduplicated, "and it stands under the key this campaign's measurement is keyed on — asking for that key again reaches it").toBe(true);
    expect(probe.jobId, "which is the job the door answered, not a second run of the same campaign").toBe(answer["jobId"]);

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
    // Nothing stands under the campaign's key: the probe that enqueues under it is the FIRST job to,
    // so it is deduplicated onto nothing. A door that had queued a run for a campaign the project
    // does not hold would already be standing there, and the probe would say so.
    const probe = await standingUnder(measure.MEASURE_KIND, key, { tenantId: fresh.person.tenantId, projectId: fresh.projectId, campaignId, requestedBy: fresh.person.userId });
    expect(probe.deduplicated, "and enqueues nothing at all").toBe(false);
    expect(rowsOf(ACTS_TABLE, fresh.person.tenantId).length, "and asking to measure writes no act: enqueueing a job is not an act (Decision §1)").toBe(0);
  }, BUDGET_MS);
});
