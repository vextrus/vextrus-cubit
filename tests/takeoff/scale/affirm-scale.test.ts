/**
 * AC-5 — AFFIRM_SCALE: the act that gives a set of views a scale, previewed as a Consequence with a
 * subject per view and typed consequence slots, committed through the act seam, and read back as
 * each view's affirmed calibration (L-MEA-05, L-ACT-01, L-ACT-02, R-TO-020).
 *
 * The act is driven through the shipped seam: `preview` answers a Consequence, its digest is carried
 * back to `commit`, and what the store then holds is read as this suite's own audit read — whole
 * rows, so what is graded is that a row CARRIES the fact rather than which column spells it.
 */
import { afterAll, describe, expect, test } from "vitest";
import {
  AFFIRM_SCALE,
  CALIBRATIONS,
  FILE_UNITS,
  MEASURE,
  MM,
  PRINCIPAL,
  SCALE_AFFIRMATIONS,
  SCALE_NO_EVIDENCE,
  SCENARIO,
  SUBJECTS,
  actorOf,
  actsDoor,
  affirmedOf,
  affirming,
  answerFor,
  byCodePoint,
  closeStage,
  grantRole,
  metresPerString,
  openSheetsStage,
  rowsNaming,
  saidBy,
  scaleCore,
  scaleDoor,
  scopeOf,
  stagePerson,
  stageScaleIngest,
  storageOf,
  viewKeysOf,
  type ConsequenceLike,
  type Person,
  type StagedScale,
} from "./support/scale-stage";

/** How long a staged case may take: an ingest recorded and a partition rebuilt over it. */
const BUDGET_MS = 600_000;

interface Staged {
  person: Person;
  projectId: string;
  staged: StagedScale;
  /** The views this act names — one scale group — and the sibling view it does not. */
  named: string[];
  sibling: string;
  /** The factor a millimetre header alone yields, along either axis. */
  factor: string;
}

let staging: Promise<Staged> | undefined;

function staged(): Promise<Staged> {
  return (staging ??= (async () => {
    await openSheetsStage();
    const { person, projectId } = await stagePerson("affirm-scale");
    grantRole(person.tenantId, projectId, person.userId, PRINCIPAL);
    const ingest = await stageScaleIngest(person, projectId, SCENARIO.UNITS_ONLY, 21);
    const views = viewKeysOf(person, ingest);
    expect(views.length, "the staged drawing carries three captioned views, so an act can name some and leave another out").toBe(3);
    expect(new Set(views).size, "and they are three different views").toBe(3);
    return { person, projectId, staged: ingest, named: views.slice(0, 2), sibling: views[2] as string, factor: metresPerString(MM) };
  })());
}

afterAll(async () => {
  await closeStage();
}, 120_000);

/** The act, as this suite asks for it: the two named views, at the rank the header alone supports. */
async function input(): Promise<Record<string, unknown>> {
  const stage = await staged();
  return affirming({ projectId: stage.projectId, drawingId: stage.staged.drawing.drawingId, rank: FILE_UNITS, viewKeys: stage.named });
}

/** What the act would do, computed by the committing code path from the state it read. */
async function previewed(): Promise<ConsequenceLike> {
  const stage = await staged();
  const acts = await actsDoor();
  return acts.preview(actorOf(stage.person), await input());
}

/** The act, performed once and remembered: a second commit would be a second act. */
let committing: Promise<{ actId: string; consequenceDigest: string }> | undefined;

function committed(): Promise<{ actId: string; consequenceDigest: string }> {
  return (committing ??= (async () => {
    const stage = await staged();
    const acts = await actsDoor();
    const asked = await input();
    const consequence = await acts.preview(actorOf(stage.person), asked);
    const written = await acts.commit(actorOf(stage.person), asked, acts.consequenceDigest(consequence));
    return { actId: written.actId, consequenceDigest: written.consequenceDigest };
  })());
}

describe("AC-5: AFFIRM_SCALE previews one subject per named view, and commits the calibrations", () => {
  test("AC-5: the act joins the enum and moves MEASURE", async () => {
    const acts = await actsDoor();
    expect(acts.ACT_TYPES, "AFFIRM_SCALE is an act this increment renders (L-ACT-02's map is total over the closed enum)").toContain(AFFIRM_SCALE);
    expect(acts.ACT_PERMISSION[AFFIRM_SCALE], "establishing what a drawing measures is what a measurer does before anything is measured (L-ACT-03)").toBe(MEASURE);
  }, BUDGET_MS);

  test("AC-5: preview answers a SUBJECTS Consequence naming each view and the calibration it would take", async () => {
    const stage = await staged();
    const core = await scaleCore();
    const consequence = await previewed();

    expect(consequence.rendering, "the Consequence renders through the shipped SUBJECTS arm (L-ACT-02)").toBe(SUBJECTS);
    expect(consequence.actType, "and it names the act it was computed for").toBe(AFFIRM_SCALE);
    expect(
      byCodePoint(consequence.subjects.map((subject) => subject.subjectId)),
      "one subject per view the act names — a scale group is the subject set of one act (L-MEA-05)",
    ).toEqual(byCodePoint(stage.named));

    for (const subject of consequence.subjects) {
      expect(
        { before: [...subject.before], after: [...subject.after] },
        `${subject.subjectId} holds no calibration and would hold the one its own key names — before-images are rejected (L-ACT-01)`,
      ).toStrictEqual({ before: [], after: [core.calibrationKey(subject.subjectId, stage.factor, stage.factor)] });
    }
  }, BUDGET_MS);

  test("AC-5: the Consequence carries the typed consequence slots the panel previews, empty until they are filled", async () => {
    const consequence = await previewed();
    const effects = consequence.effects;
    expect(effects, "R-TO-020 previews the consequences of an affirmation, so the Consequence carries them as typed slots").toBeTruthy();
    expect(Array.isArray(effects?.linesRederiving), "the lines that would re-derive are a list — empty here, since no quantity line exists yet (inc-209)").toBe(true);
    expect(Array.isArray(effects?.signaturesVoiding), "the signatures that would void are a list — empty here, since nothing is signed yet (M7)").toBe(true);
    expect(
      { linesRederiving: effects?.linesRederiving, signaturesVoiding: effects?.signaturesVoiding },
      "and both stand empty over a project that holds neither: an empty slot is a stated nothing, never an absent field",
    ).toStrictEqual({ linesRederiving: [], signaturesVoiding: [] });
  }, BUDGET_MS);

  test("AC-5: commit writes one affirmation naming the views and one calibration per view", async () => {
    const stage = await staged();
    const core = await scaleCore();
    const written = await committed();

    const affirmations = rowsNaming(SCALE_AFFIRMATIONS, stage.person.tenantId, written.actId);
    expect(affirmations.length, "one affirmation stands for the act — the act names its views, and a scale group is one act (L-MEA-05)").toBe(1);
    const said = saidBy(affirmations[0] as Record<string, unknown>);
    expect(said, "the affirmation says which rank it stood on").toContain(FILE_UNITS);
    expect(said, "and which views it covered — every one of them").toEqual(expect.arrayContaining(stage.named));

    const calibrations = rowsNaming(CALIBRATIONS, stage.person.tenantId, written.actId);
    expect(calibrations.length, "and one calibration per view the act named").toBe(stage.named.length);
    for (const viewKey of stage.named) {
      const own = calibrations.filter((row) => saidBy(row).includes(viewKey));
      expect(own.length, `exactly one calibration stands for ${viewKey}`).toBe(1);
      const values = saidBy(own[0] as Record<string, unknown>);
      expect(values, `${viewKey}'s calibration is filed under the content address of what it says (L-MEA-05)`).toContain(
        core.calibrationKey(viewKey, stage.factor, stage.factor),
      );
      expect(
        values.filter((value) => value === stage.factor).length,
        `and carries the millimetre header's own factor along both axes — X and Y are stored apart, never averaged`,
      ).toBeGreaterThanOrEqual(2);
    }
  }, BUDGET_MS);

  test("AC-5: each named view then reads its affirmed calibration, and the view no act named still has none", async () => {
    const stage = await staged();
    const core = await scaleCore();
    const written = await committed();
    const door = await scaleDoor();
    const answered = await door.scaleProposalsOf(scopeOf(stage.person, stage.projectId, stage.staged), { storage: await storageOf() });

    for (const viewKey of stage.named) {
      const answer = answerFor(answered, viewKey);
      const affirmed = affirmedOf(answer);
      expect(affirmed, `${viewKey} was named by an act, so it has a scale`).toBeTruthy();
      expect(
        {
          calibrationKey: affirmed?.calibrationKey,
          rank: affirmed?.rank,
          factorX: affirmed?.factorX,
          factorY: affirmed?.factorY,
          actId: affirmed?.actId,
          placeable: affirmed?.placeable,
        },
        `${viewKey} reads back the calibration the act took, the rank it stood on and the act that carried it (L-MEA-05: the rank and the source keys under it)`,
      ).toStrictEqual({
        calibrationKey: core.calibrationKey(viewKey, stage.factor, stage.factor),
        rank: FILE_UNITS,
        factorX: stage.factor,
        factorY: stage.factor,
        actId: written.actId,
        placeable: true,
      });
      expect(
        Object.keys((answer.affirmed ?? {}) as Record<string, unknown>),
        "and it states its anisotropy — a pair equal on both axes is isotropic, which is a judgement the answer makes rather than omits",
      ).toContain("anisotropy");
      expect(answer.refusal ?? null, "a view with a scale refuses nothing").toBeNull();
    }

    const sibling = answerFor(answered, stage.sibling);
    expect(affirmedOf(sibling), "the view the act did not name has no scale: membership is positive, never residual (L-MEA-05)").toBeNull();
    expect(sibling.refusal, "and it says so by name, so a person is told rather than left with a silent view").toBe(SCALE_NO_EVIDENCE);
  }, BUDGET_MS);
});
