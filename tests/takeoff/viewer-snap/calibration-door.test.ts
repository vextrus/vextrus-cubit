/**
 * AC-4's door half — `snapCalibrationsOfSheet` and the `?part=calibration` the viewer feed grows,
 * over a really partitioned, really affirmed drawing (R-UI-041, L-MEA-05, I-150).
 *
 * The drawing is staged through the scale engine's own stage: the shipped ingest job records a real
 * artifact, the shipped partition job reads it into views, and the shipped act seam affirms a scale
 * over some of those views and not others. What the door then answers is graded against the partition
 * and the affirmations the product itself wrote — never against a transcription (B-19).
 */
import { afterAll, describe, expect, test } from "vitest";
import { VIEWER_ROUTE_MODULE, productModule, snapServer } from "./support/snap-support";
import {
  FILE_UNITS,
  MM,
  MODEL_SPACE,
  PAPER_SPACE,
  PRINCIPAL,
  SCENARIO,
  actorOf,
  actsDoor,
  affirming,
  closeStage,
  grantRole,
  metresPerString,
  openSheetsStage,
  stagePerson,
  stageScaleIngest,
  viewKeysOf,
  type Person,
  type StagedScale,
} from "../scale/support/scale-stage";

/** How long a staged case may take: an ingest recorded, a partition rebuilt and an act committed. */
const BUDGET_MS = 600_000;

/** A drawing nobody in this workspace has ever recorded, let alone partitioned. */
const UNKNOWN_DRAWING = "0f9b1b7c-2f3a-4c2e-9d1a-2b3c4d5e6f70";

interface Staged {
  person: Person;
  projectId: string;
  staged: StagedScale;
  /** The views one act affirmed, and the sibling view it left alone. */
  affirmed: string[];
  unaffirmed: string;
  /** The 12-place factor a millimetre header alone yields, along either axis. */
  factor: string;
}

let staging: Promise<Staged> | undefined;

function staged(): Promise<Staged> {
  return (staging ??= (async () => {
    await openSheetsStage();
    const { person, projectId } = await stagePerson("snap-calibration");
    grantRole(person.tenantId, projectId, person.userId, PRINCIPAL);
    const ingest = await stageScaleIngest(person, projectId, SCENARIO.UNITS_ONLY, 206);
    const views = viewKeysOf(person, ingest);
    expect(views.length, "the staged drawing carries three captioned views, so an act can affirm some and leave another out").toBe(3);
    expect(new Set(views).size, "and they are three different views").toBe(3);

    const acts = await actsDoor();
    const affirmed = views.slice(0, 2);
    const asked = affirming({ projectId, drawingId: ingest.drawing.drawingId, rank: FILE_UNITS, viewKeys: affirmed });
    const consequence = await acts.preview(actorOf(person), asked);
    await acts.commit(actorOf(person), asked, acts.consequenceDigest(consequence));

    return { person, projectId, staged: ingest, affirmed, unaffirmed: views[2] as string, factor: metresPerString(MM) };
  })());
}

afterAll(async () => {
  await closeStage();
}, 120_000);

/** The scope the door is asked in, for one sheet of the staged drawing. */
async function scopeOf(layoutName: string): Promise<{ tenantId: string; drawingId: string; layoutName: string }> {
  const stage = await staged();
  return { tenantId: stage.person.tenantId, drawingId: stage.staged.drawing.drawingId, layoutName };
}

describe("AC-4: the door answers the views of this sheet that a scale of record measures", () => {
  test("AC-4: exactly the affirmed views with a box on this layout, with the stored factors", async () => {
    const stage = await staged();
    const { snapCalibrationsOfSheet } = await snapServer();
    const answered = await snapCalibrationsOfSheet(await scopeOf(MODEL_SPACE));

    expect(answered, "the drawing is partitioned and affirmed, so this sheet has a calibration to read").not.toBeNull();
    const held = answered as NonNullable<typeof answered>;
    expect(held.ingestId, "the answer names the record it was read off — a calibration is a reading of a record").toBe(stage.staged.ingestId);

    expect(
      held.views.map((view) => view.viewKey).sort(),
      "exactly the views an affirmation of record names AND whose members stand on this sheet — a view nobody affirmed measures nothing (L-MEA-05)",
    ).toEqual([...stage.affirmed].sort());
    expect(held.views.map((view) => view.viewKey), "and the view the act left alone is not among them").not.toContain(stage.unaffirmed);

    for (const view of held.views) {
      expect(view.box, `${view.viewKey} carries the world box its members stand in on this sheet — that is what a pick is judged inside`).not.toBeNull();
      const box = view.box as { min: [number, number]; max: [number, number] };
      expect(box.min[0] <= box.max[0] && box.min[1] <= box.max[1], "and it is a box, not an inversion").toBe(true);
      expect([view.factorX, view.factorY], "the factors are the stored 12-place strings, carried whole rather than re-derived (B-07)").toEqual([stage.factor, stage.factor]);
    }
  }, BUDGET_MS);

  test("AC-4: a sheet no affirmed view stands on answers a calibration naming no view", async () => {
    const { snapCalibrationsOfSheet } = await snapServer();
    const answered = await snapCalibrationsOfSheet(await scopeOf(PAPER_SPACE));
    expect(answered, "the drawing is partitioned, so the record is still read").not.toBeNull();
    expect(
      (answered as NonNullable<typeof answered>).views.map((view) => view.viewKey),
      "but the partitioned views' members stand on the model sheet, so none of them has a box on this one — and a view with no box measures nothing here",
    ).toEqual([]);
  }, BUDGET_MS);

  test("AC-4: a drawing nothing has partitioned answers null", async () => {
    const stage = await staged();
    const { snapCalibrationsOfSheet } = await snapServer();
    expect(
      await snapCalibrationsOfSheet({ tenantId: stage.person.tenantId, drawingId: UNKNOWN_DRAWING, layoutName: MODEL_SPACE }),
      "an absence is an answer, not a refusal and not a fault (R-UI-050, I-150)",
    ).toBeNull();
  }, BUDGET_MS);
});

describe("AC-4: the feed serves the calibration through the one door the partition is served by", () => {
  /** The feed asked one question, with no session presented. */
  async function ask(query: string): Promise<{ status: number; body: string }> {
    const { GET } = await productModule<{ GET: (request: Request, route: { params: Promise<{ drawing: string; layout: string }> }) => Promise<Response> }>(VIEWER_ROUTE_MODULE);
    const response = await GET(new Request(`http://127.0.0.1/api/viewer/${UNKNOWN_DRAWING}/${encodeURIComponent(MODEL_SPACE)}?${query}`), {
      params: Promise.resolve({ drawing: UNKNOWN_DRAWING, layout: MODEL_SPACE }),
    });
    return { status: response.status, body: await response.text() };
  }

  test("AC-4: ?part=calibration refuses a caller exactly as ?part=partition does", async () => {
    await staged();
    for (const tail of ["", `&tenant=${UNKNOWN_DRAWING}`]) {
      const calibration = await ask(`part=calibration${tail}`);
      const partition = await ask(`part=partition${tail}`);
      expect(
        [calibration.status, calibration.body],
        `the calibration is a part of the sheet's own feed, behind the sheet's own session (I-150) — asked as \`part=calibration${tail}\` it must answer what \`part=partition${tail}\` answers`,
      ).toEqual([partition.status, partition.body]);
      expect(calibration.status, "and with no live session that answer is a refusal, not an empty calibration").toBeGreaterThanOrEqual(400);
    }
  }, BUDGET_MS);

  test("AC-4: the sentence a caller is answered with names the part it may now ask for", async () => {
    const unknown = await ask("part=elevation");
    expect(unknown.status, "a part the feed does not serve is the caller's question being wrong").toBe(400);
    const sentence = String((JSON.parse(unknown.body) as { error?: unknown }).error ?? "");
    expect(sentence, "a client is told every part this feed serves, and `calibration` is now one of them (Decision §3)").toContain("calibration");
  }, BUDGET_MS);
});
