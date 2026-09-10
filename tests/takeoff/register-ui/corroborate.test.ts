/**
 * AC-5 — CORROBORATE is an act that APPENDS and never overwrites (L-ACT-01, L-ACT-02, R-TO-051).
 *
 * The act is driven through the door the screen presses — `takeoff.previewCorroborate` and
 * `takeoff.commitCorroborate` on the takeoff lane — over a campaign staged through shipped seams.
 * What the store then holds is read as the acceptance's own audit read, and the readings that stood
 * before are compared byte for byte after: an act that rewrote one of them is not an append.
 *
 * Every refusal is asked for by name, with the ledger counted either side of the attempt: a refusal
 * that wrote an act row is not a refusal.
 */
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, test } from "vitest";
import {
  ACTS_LAW_MODULE,
  ACTS_MODULE,
  ACT_CHANGES_NOTHING,
  CONSEQUENCES_NOT_CARRIED,
  CORROBORATE,
  CORROBORATE_MODULE,
  ENTERED,
  FIRST_UNIT,
  FIRST_VALUE,
  MEASURE,
  PERMISSION_NOT_HELD,
  REGISTER_OBSERVATIONS_TABLE,
  REPUDIATE,
  REPUDIATE_MODULE,
  SIZE,
  actIdOf,
  actsOf,
  closeStage,
  codeOf,
  corroboration,
  door,
  field,
  frozen,
  previewed,
  productModule,
  registerSeam,
  rejection,
  rowsOf,
  stageRegisterCampaign,
  stageReviewer,
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
const staged = (): Promise<StagedRegisterCampaign> => (staging ??= stageRegisterCampaign("corroborate"));

describe("AC-5 — the act type, its permission and its rendering", () => {
  test("AC-5: CORROBORATE and REPUDIATE join the act-type enum, move MEASURE and are rendered", async () => {
    const law = await productModule<{ ACT_TYPES: readonly string[]; ACT_PERMISSION: Record<string, string> }>(ACTS_LAW_MODULE);
    const acts = await productModule<{ ACT_MAP: Record<string, unknown> }>(ACTS_MODULE);

    for (const actType of [CORROBORATE, REPUDIATE]) {
      expect(law.ACT_TYPES, `${actType} is an act this increment renders (L-ACT-02: the map is total over the enum)`).toContain(actType);
      expect(law.ACT_PERMISSION[actType], `${actType} moves what a measurer holds`).toBe(MEASURE);
      expect(acts.ACT_MAP[actType], `${ACTS_MODULE} renders ${actType} — a type without a rendering is a compile error (L-ACT-02)`).toBeTruthy();
    }

    const corroborate = await productModule<Record<string, unknown>>(CORROBORATE_MODULE);
    const repudiate = await productModule<Record<string, unknown>>(REPUDIATE_MODULE);
    expect(corroborate["corroborate"], `${CORROBORATE_MODULE} publishes \`corroborate\` (increment interfaces)`).toBeTruthy();
    expect(repudiate["repudiate"], `${REPUDIATE_MODULE} publishes \`repudiate\` (increment interfaces)`).toBeTruthy();
    expect(acts.ACT_MAP[CORROBORATE], "and the map renders the act through it").toBe(corroborate["corroborate"]);
    expect(acts.ACT_MAP[REPUDIATE], "and the map renders the act through it").toBe(repudiate["repudiate"]);
  }, BUDGET_MS);
});

describe("AC-5 — a reading is appended, and nothing is overwritten", () => {
  test("AC-5: the preview names the object, the standing now and the standing the reading would produce", async () => {
    const it = await staged();
    const register = await registerSeam();
    const caller = await takeoffCaller(it.person);
    const objectKey = it.objectKeys[0] as string;

    const before = await register.attributeStanding(it.registerScope, objectKey, SIZE);
    const answer = await door(caller, "previewCorroborate")({
      input: corroboration({ projectId: it.projectId, objectKey, valueAsWritten: FIRST_VALUE, unitAsWritten: FIRST_UNIT, precedence: 0, sourceKey: it.sourceKeys[objectKey] as string }),
    });

    const shown = previewed(answer, "takeoff.previewCorroborate");
    expect(shown.consequence["rendering"], "a corroboration judges subjects (L-ACT-02's closed arms)").toBe("SUBJECTS");
    const subjects = subjectsOf(shown.consequence);
    expect(subjects.length, "one object, one attribute — this act names exactly one (scope)").toBe(1);
    expect((subjects[0] as { subjectId: string }).subjectId, "and the subject is the object the reading is about").toBe(objectKey);
    expect(subjects[0]?.before.join(" "), `\`before\` names the attribute's standing NOW (${String(field(before, "standing", "standing"))})`).toContain(String(field(before, "standing", "standing")));
  }, BUDGET_MS);

  test("AC-5: the commit writes one act and one observation at basis ENTERED, and moves nothing else", async () => {
    const it = await staged();
    const register = await registerSeam();
    const caller = await takeoffCaller(it.person);
    const objectKey = it.objectKeys[0] as string;

    const observationsBefore = rowsOf(REGISTER_OBSERVATIONS_TABLE, it.tenantId);
    const actsBefore = actsOf(it.tenantId, CORROBORATE);
    const input = corroboration({ projectId: it.projectId, objectKey, valueAsWritten: FIRST_VALUE, unitAsWritten: FIRST_UNIT, precedence: 0, sourceKey: it.sourceKeys[objectKey] as string });

    const shown = previewed(await door(caller, "previewCorroborate")({ input }), "takeoff.previewCorroborate");
    const committed = await door(caller, "commitCorroborate")({ input, consequenceDigest: shown.consequenceDigest });
    const actId = actIdOf(committed, "takeoff.commitCorroborate");

    const actsAfter = actsOf(it.tenantId, CORROBORATE);
    expect(actsAfter.length - actsBefore.length, "exactly one act row of type CORROBORATE (L-ACT-01: one act, recorded once)").toBe(1);

    const observationsAfter = rowsOf(REGISTER_OBSERVATIONS_TABLE, it.tenantId);
    expect(observationsAfter.length - observationsBefore.length, "exactly one observation row is appended").toBe(1);
    const appended = observationsAfter.filter((row) => String(field(row, "actId", "act_id")) === actId);
    expect(appended.length, "and it carries the act that wrote it (L-ACT-01: the row and the act commit together)").toBe(1);
    expect(Number(field(appended[0] as Record<string, unknown>, "precedence", "precedence")), "at the precedence the reader declared").toBe(0);
    expect(String(field(appended[0] as Record<string, unknown>, "basis", "basis")), "and at basis ENTERED — a person typed it (interfaces)").toBe(ENTERED);

    const keptBefore = frozen(observationsBefore, "observation_id");
    const keptAfter = frozen(
      observationsAfter.filter((row) => observationsBefore.some((held) => String(field(held, "observationId", "observation_id")) === String(field(row, "observationId", "observation_id")))),
      "observation_id",
    );
    expect(keptAfter, "every reading that stood before stands byte for byte after — nothing overwrites (L-ACT-01)").toBe(keptBefore);

    const standing = await register.attributeStanding(it.registerScope, objectKey, SIZE);
    const preview = subjectsOf(shown.consequence)[0] as { after: string[] };
    expect(preview.after.join(" "), "and `after` named the standing the reading in fact produced").toContain(String(field(standing, "standing", "standing")));
  }, BUDGET_MS);

  test("AC-5: a digest that is not the one current state produces refuses CONSEQUENCES_NOT_CARRIED", async () => {
    const it = await staged();
    const caller = await takeoffCaller(it.person);
    const objectKey = it.objectKeys[0] as string;
    const before = actsOf(it.tenantId, CORROBORATE).length;

    const input = corroboration({ projectId: it.projectId, objectKey, valueAsWritten: FIRST_VALUE, unitAsWritten: FIRST_UNIT, precedence: 0, sourceKey: it.sourceKeys[objectKey] as string });
    const failure = await rejection(door(caller, "commitCorroborate")({ input, consequenceDigest: "0".repeat(64) }));
    expect(failure, "a commit carrying a digest of nothing was carried out").not.toBeNull();
    expect(await codeOf(failure), `it refuses ${CONSEQUENCES_NOT_CARRIED} by name (L-ACT-02)`).toBe(CONSEQUENCES_NOT_CARRIED);
    expect(actsOf(it.tenantId, CORROBORATE).length, "and writes no act row").toBe(before);
  }, BUDGET_MS);

  test("AC-5: an object the revision does not hold refuses ACT_CHANGES_NOTHING", async () => {
    const it = await staged();
    const caller = await takeoffCaller(it.person);
    const before = actsOf(it.tenantId, CORROBORATE).length;

    const input = corroboration({ projectId: it.projectId, objectKey: `no-such-object:${randomUUID()}`, valueAsWritten: FIRST_VALUE, unitAsWritten: FIRST_UNIT, precedence: 0, sourceKey: "S-101:t:12" });
    const failure = await rejection(door(caller, "previewCorroborate")({ input }));
    expect(failure, "a reading about nothing answered a Consequence").not.toBeNull();
    expect(await codeOf(failure), `it refuses ${ACT_CHANGES_NOTHING} by name (the seam's own guard)`).toBe(ACT_CHANGES_NOTHING);
    expect(actsOf(it.tenantId, CORROBORATE).length, "and writes no act row").toBe(before);
  }, BUDGET_MS);

  test("AC-5: a participant holding only REVIEWER is refused PERMISSION_NOT_HELD, naming the act and the permission", async () => {
    const it = await staged();
    const reviewer = await stageReviewer(it);
    const caller = await takeoffCaller(reviewer);
    const objectKey = it.objectKeys[0] as string;
    const before = actsOf(it.tenantId, CORROBORATE).length;

    const input = corroboration({ projectId: it.projectId, objectKey, valueAsWritten: FIRST_VALUE, unitAsWritten: FIRST_UNIT, precedence: 0, sourceKey: it.sourceKeys[objectKey] as string });
    const failure = await rejection(door(caller, "previewCorroborate")({ input }));
    expect(failure, "a reviewer previewed a reading they may not record").not.toBeNull();
    expect(await codeOf(failure), `it refuses ${PERMISSION_NOT_HELD} by name (L-ACT-03)`).toBe(PERMISSION_NOT_HELD);
    expect(JSON.stringify(failure), `and the refusal names ${CORROBORATE} — what was attempted`).toContain(CORROBORATE);
    expect(JSON.stringify(failure), `and ${MEASURE} — the permission that would carry it`).toContain(MEASURE);
    expect(actsOf(it.tenantId, CORROBORATE).length, "and writes no act row").toBe(before);
  }, BUDGET_MS);
});
