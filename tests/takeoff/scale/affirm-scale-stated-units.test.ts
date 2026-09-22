/**
 * I-295b — the act seam derives over the SAME evidence the panel's door offers (L-MEA-05, L-ACT-02,
 * R-TO-020). DATABASE LANE: this suite stages an ingest, rebuilds a partition over it and performs
 * an act through the shipped seam, so it is collected by `pnpm test:db` and never by `pnpm test`
 * (scripts/lib/pg-suites.mjs derives that from the import graph — it reaches the harness through
 * ./support/scale-stage).
 *
 * The drawing is F-RCC6-BNBC's own case: `$INSUNITS = 0` — a header that names no unit — and every
 * dimension text naming its own (`15'-0"`). The panel proposes DIMENSION_RATIO off those words
 * (I-295); what this suite grades is the seam BEHIND the panel, because AFFIRM_SCALE is rendered in
 * core, gathers its own evidence inside the transaction it writes in, and may not reach the takeoff
 * module for the notation grammar (ARCH-01). Before I-295b the act gathered the header-only reading
 * and refused SCALE_UNIT_UNMAPPED a rank the panel had just offered — a door offering what the act
 * behind it will not take.
 *
 * It grades the override beside it (T-DIM-OVERRIDE): the plan prints `14'-2"` across a span its
 * geometry draws as fourteen feet, and three dimensions of the same axis say otherwise. The majority
 * is what the axis measures at, the printed one is named on the proposal as a DIMENSION_OVERRIDE
 * observation, and the act stands on the same factor the panel showed.
 */
import { afterAll, describe, expect, test } from "vitest";
import {
  AFFIRM_SCALE,
  DIMENSION_RATIO,
  FEET_INCHES_METRES_PER_UNIT,
  FEET_INCHES_OVERRIDE_TEXT,
  FILE_UNITS,
  PRINCIPAL,
  SCENARIO,
  actorOf,
  actsDoor,
  affirmedOf,
  affirming,
  answerFor,
  closeStage,
  grantRole,
  openSheetsStage,
  proposalsOf,
  scaleCore,
  scaleDoor,
  scopeOf,
  stagePerson,
  stageScaleIngest,
  storageOf,
  viewKeysOf,
  type Person,
  type StagedScale,
} from "./support/scale-stage";

/** How long a staged case may take: an ingest recorded and a partition rebuilt over it. */
const BUDGET_MS = 600_000;

/** The observation a reading overruled by its axis's majority is recorded as (T-DIM-OVERRIDE). */
const DIMENSION_OVERRIDE = "DIMENSION_OVERRIDE";

interface Staged {
  person: Person;
  projectId: string;
  staged: StagedScale;
  /** The one view of the staged drawing — the plan its dimensions are drawn in. */
  viewKey: string;
}

let staging: Promise<Staged> | undefined;

function staged(): Promise<Staged> {
  return (staging ??= (async () => {
    await openSheetsStage();
    const { person, projectId } = await stagePerson("affirm-scale-stated-units");
    grantRole(person.tenantId, projectId, person.userId, PRINCIPAL);
    const ingest = await stageScaleIngest(person, projectId, SCENARIO.FEET_INCHES, 31);
    const views = viewKeysOf(person, ingest);
    expect(views.length, "the staged drawing carries one captioned plan, dimensioned in the unit its own texts name").toBe(1);
    return { person, projectId, staged: ingest, viewKey: views[0] as string };
  })());
}

afterAll(async () => {
  await closeStage();
}, 120_000);

/** What the panel's door offers for the staged plan. */
async function offered(): Promise<ReturnType<typeof proposalsOf>> {
  const stage = await staged();
  const door = await scaleDoor();
  const answered = await door.scaleProposalsOf(scopeOf(stage.person, stage.projectId, stage.staged), { storage: await storageOf() });
  return proposalsOf(answerFor(answered, stage.viewKey));
}

describe("I-295b: what the panel offers on a header that names no unit, the act behind it stands on", () => {
  test("the door proposes DIMENSION_RATIO off the drawing's own words, and no rank 4 at all", async () => {
    const rows = await offered();

    expect(
      rows.map((row) => row.rank),
      "the texts state their unit, so rank 3 stands; the header states none, so rank 4 is absent and no unit is invented for the file (I-295)",
    ).toEqual([DIMENSION_RATIO]);
    expect([rows[0]?.factorX, rows[0]?.factorY], "a tenth of a metre per drawing unit, read along each axis from its own dimensions").toEqual([
      FEET_INCHES_METRES_PER_UNIT,
      FEET_INCHES_METRES_PER_UNIT,
    ]);
  }, BUDGET_MS);

  test("the dimension the drawing printed over its own geometry is named as overridden, not averaged in and not a refusal", async () => {
    const rows = await offered();
    const overridden = ((rows[0] as Record<string, unknown>)["overridden"] ?? []) as Record<string, unknown>[];

    expect(overridden.length, "one dimension of the axis disagrees with the three that agree, and it is named — never silently dropped (T-DIM-OVERRIDE)").toBe(1);
    expect(String(overridden[0]?.["observation"]), "as the observation the trap names").toBe(DIMENSION_OVERRIDE);
    expect(String(overridden[0]?.["stated"]), "carrying the words it printed, verbatim, for the person affirming to read").toBe(FEET_INCHES_OVERRIDE_TEXT);
    expect(String(overridden[0]?.["axis"]), "on the axis whose majority overruled it").toBe("x");
    expect(rows[0]?.evidence, "and it is still evidence this proposal was read off — evidence is what was measured, overruled or not (L-CAD-03)").toContain(
      String(overridden[0]?.["sourceKey"]),
    );
  }, BUDGET_MS);

  test("AFFIRM_SCALE at that rank commits, and the calibration of record is the factor the panel showed", async () => {
    const stage = await staged();
    const acts = await actsDoor();
    const core = await scaleCore();
    const asked = affirming({ projectId: stage.projectId, drawingId: stage.staged.drawing.drawingId, rank: DIMENSION_RATIO, viewKeys: [stage.viewKey] });

    const consequence = await acts.preview(actorOf(stage.person), asked);
    expect(consequence.actType, "the act the seam computed is the one asked for").toBe(AFFIRM_SCALE);
    expect(
      consequence.subjects.map((subject) => [...subject.after]),
      "the view would take the calibration its own factor pair names — derived by the act from the state it read, never typed by a caller (L-ACT-02)",
    ).toEqual([[core.calibrationKey(stage.viewKey, FEET_INCHES_METRES_PER_UNIT, FEET_INCHES_METRES_PER_UNIT)]]);

    await acts.commit(actorOf(stage.person), asked, acts.consequenceDigest(consequence));

    const door = await scaleDoor();
    const answered = await door.scaleProposalsOf(scopeOf(stage.person, stage.projectId, stage.staged), { storage: await storageOf() });
    const affirmed = affirmedOf(answerFor(answered, stage.viewKey));
    expect(affirmed?.rank, "the view's scale of record stands at the rank the act named (L-MEA-05: a view's scale is the rank it stood on)").toBe(DIMENSION_RATIO);
    expect([affirmed?.factorX, affirmed?.factorY], "at the very factors the panel offered — one reading of one drawing, on both sides of the seam").toEqual([
      FEET_INCHES_METRES_PER_UNIT,
      FEET_INCHES_METRES_PER_UNIT,
    ]);
    expect(affirmed?.rank, "and never rank 4, which a header naming no unit carries no factor for").not.toBe(FILE_UNITS);
  }, BUDGET_MS);
});
