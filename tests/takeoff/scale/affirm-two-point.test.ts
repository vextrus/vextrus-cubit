/**
 * I-419 through the act seam — AFFIRM_SCALE at QS_TWO_POINT on a view the drawing offers NO
 * scale for: two agreeing observations per axis across different points commit, and the two ways a
 * person's readings can fail to be two measurements are refused by name (L-MEA-05, L-ACT-02).
 *
 * Staged over `scale-unmapped`: a plan whose header names a unit code no lane maps and which draws no
 * dimension, so no machine rank reads a factor off any view — the sheet walk-0 met on a fresh upload,
 * where "only a two-point calibration can scale it" and the calibration could never be affirmed.
 * Every point below cites an entity the partition put in that view, read off the staged artifact;
 * every factor is core's own `citeObservation` over the same points (B-19).
 */
import { afterAll, describe, expect, test } from "vitest";
import {
  PRINCIPAL,
  QS_TWO_POINT,
  SCALE_OBSERVATION_UNVERIFIED,
  SCENARIO,
  actorOf,
  actsDoor,
  affirmedOf,
  affirming,
  answerFor,
  attempt,
  citedPoint,
  closeStage,
  grantRole,
  observation,
  openSheetsStage,
  proposalsOf,
  refusalCodeOf,
  scaleCore,
  scaleDoor,
  scopeOf,
  stagePerson,
  stageScaleIngest,
  storageOf,
  viewKeysOf,
  type ObservationInput,
  type Person,
  type StagedScale,
} from "./support/scale-stage";

/** How long a staged case may take: an ingest recorded and a partition rebuilt over it. */
const BUDGET_MS = 600_000;

/** One grid bay's worth of millimetres per drawing unit, entered alike for every span (1:100 on a mm plan). */
const MM_PER_UNIT = 100;

interface Staged {
  person: Person;
  projectId: string;
  staged: StagedScale;
  view: string;
  /** The plan's own grid line along x, and its grid line along y — what each pick stands on. */
  alongX: string;
  alongY: string;
}

let staging: Promise<Staged> | undefined;

function staged(): Promise<Staged> {
  return (staging ??= (async () => {
    await openSheetsStage();
    const { person, projectId } = await stagePerson("affirm-two-point");
    grantRole(person.tenantId, projectId, person.userId, PRINCIPAL);
    const ingest = await stageScaleIngest(person, projectId, SCENARIO.UNMAPPED, 47);
    const [view] = viewKeysOf(person, ingest);
    const cluster = ingest.artifact.clusters[0];
    expect(view, "the staged drawing carries its one captioned plan").toBeTruthy();
    expect(cluster?.lineKeys.length, "and the plan draws a grid line along each axis").toBe(2);
    return { person, projectId, staged: ingest, view: view as string, alongX: cluster?.lineKeys[0] as string, alongY: cluster?.lineKeys[1] as string };
  })());
}

afterAll(async () => {
  await closeStage();
}, 120_000);

/** A span along x on the plan's x grid line (it runs y = −30 from x = −5 to 55). */
function acrossX(stage: Staged, from: number, to: number, millimetres = String(Math.abs(to - from) * MM_PER_UNIT)): ObservationInput {
  return observation(citedPoint(stage.alongX, from.toFixed(1), "-30.0"), citedPoint(stage.alongX, to.toFixed(1), "-30.0"), { value: millimetres, unit: "mm" });
}

/** A span along y on the plan's y grid line (it runs x = −30 from y = −5 to −69). */
function acrossY(stage: Staged, from: number, to: number, millimetres = String(Math.abs(to - from) * MM_PER_UNIT)): ObservationInput {
  return observation(citedPoint(stage.alongY, "-30.0", from.toFixed(1)), citedPoint(stage.alongY, "-30.0", to.toFixed(1)), { value: millimetres, unit: "mm" });
}

/** The act at the two-point rank over the one plan, standing on the observations given. */
async function asked(observations: readonly ObservationInput[]): Promise<Record<string, unknown>> {
  const stage = await staged();
  return affirming({ projectId: stage.projectId, drawingId: stage.staged.drawing.drawingId, rank: QS_TWO_POINT, viewKeys: [stage.view], observations });
}

describe("I-419: a view with no machine proposal is affirmed at QS_TWO_POINT by two agreeing observations per axis", () => {
  test("I-419: the staged plan is offered no scale at any rank — the sheet walk-0 could not scale", async () => {
    const stage = await staged();
    const door = await scaleDoor();
    const answered = await door.scaleProposalsOf(scopeOf(stage.person, stage.projectId, stage.staged), { storage: await storageOf() });
    expect(proposalsOf(answerFor(answered, stage.view)), "an unmapped header and no dimension: nothing machine-made stands under this view").toEqual([]);
  }, BUDGET_MS);

  test("I-419: two bays along x and two along y, agreeing, commit the view at QS_TWO_POINT at the first observation's factors", async () => {
    const stage = await staged();
    const core = await scaleCore();
    const acts = await actsDoor();
    const observations = [acrossX(stage, 0, 20), acrossY(stage, -10, -25), acrossX(stage, 20, 50), acrossY(stage, -25, -45)];
    const factorX = core.citeObservation(observations[0]).factor;
    const factorY = core.citeObservation(observations[1]).factor;

    const input = await asked(observations);
    const consequence = await acts.preview(actorOf(stage.person), input);
    expect(consequence.subjects.map((subject) => [...subject.after]), "the view would stand under the calibration its own factors name").toEqual([[core.calibrationKey(stage.view, factorX, factorY)]]);
    await acts.commit(actorOf(stage.person), input, acts.consequenceDigest(consequence));

    const door = await scaleDoor();
    const affirmed = affirmedOf(answerFor(await door.scaleProposalsOf(scopeOf(stage.person, stage.projectId, stage.staged), { storage: await storageOf() }), stage.view));
    expect(
      { rank: affirmed?.rank, factorX: affirmed?.factorX, factorY: affirmed?.factorY },
      "the view reads back a scale of record at the person's own rank — X and Y each at its first observation, never an average (L-MEA-05)",
    ).toStrictEqual({ rank: QS_TWO_POINT, factorX, factorY });
  }, BUDGET_MS);

  test("I-419: the same span taken twice per axis is one measurement per axis, and the act refuses it by name", async () => {
    const stage = await staged();
    const acts = await actsDoor();
    const input = await asked([acrossX(stage, 0, 20), acrossX(stage, 20, 0), acrossY(stage, -10, -25), acrossY(stage, -25, -10)]);
    const tried = await attempt(() => acts.preview(actorOf(stage.person), input));
    expect(await refusalCodeOf(tried.failure), "a repeated click verifies nothing (L-MEA-05: a single observation is verified or rejected)").toBe(SCALE_OBSERVATION_UNVERIFIED);
  }, BUDGET_MS);

  test("I-419: a second figure entered for one span that disagrees is refused, never set aside", async () => {
    const stage = await staged();
    const acts = await actsDoor();
    const input = await asked([acrossX(stage, 0, 20), acrossX(stage, 0, 20, "200"), acrossX(stage, 20, 50), acrossY(stage, -10, -25), acrossY(stage, -25, -45)]);
    const tried = await attempt(() => acts.preview(actorOf(stage.person), input));
    expect(await refusalCodeOf(tried.failure), "a dropped digit on a repeated span is a disagreement the act names").toBe(SCALE_OBSERVATION_UNVERIFIED);
  }, BUDGET_MS);
});
