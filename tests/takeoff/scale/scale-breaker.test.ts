/**
 * Breaker acceptance for inc-204's scale engine — two defects found by attacking the shipped
 * surfaces, each stated as the behaviour L-MEA-05 promises rather than as the shape of a fix.
 *
 * (1) A calibration is content-addressed over (view key, factorX, factorY) alone, and a view key is
 *     `<type>:<the caption's own DXF handle>` — a handle the file mints, not a key scoped to the
 *     drawing. Two drawings that carry a caption at the same handle therefore name the SAME
 *     calibration, and `writeAffirmation`'s `onConflictDoNothing` drops the second act's row: the
 *     `calibrations` table then holds no row for the ingest that filed it, and the one row it does
 *     hold names the other drawing, the other ingest and the other act. The table's own columns
 *     (`drawing_id`, `ingest_id`, `act_id`, NOT NULL every one) promise a provenance the key cannot
 *     carry (L-ACT-01: an act's state change is recorded at the granularity performed; AC-5).
 *
 * (2) `citeObservation` is the one place a person's typed numbers cross into the engine, and it
 *     documents itself as answering "the refusal L-MEA-05 names rather than a type the caller
 *     vouched for". It does not: an entered distance that is small against the drawn span renders a
 *     factor of "0.000000000000", which the law's own `isFactorString` rejects, and the very next
 *     step the act takes (`verifyAxis`, then `factorPair`) throws a PLAIN Error carrying no refusal
 *     code — a fault where the law promises an answer (ARCH-03, B-21).
 *
 * Both expectations are derived from the tree: the calibration key is minted by the shipped
 * `calibrationKey`, and the factor is judged by the shipped `isFactorString` (B-19).
 */
import { afterAll, describe, expect, test } from "vitest";
import {
  CALIBRATIONS,
  FILE_UNITS,
  MM,
  PRINCIPAL,
  SCALE_AFFIRMATIONS,
  SCENARIO,
  actorOf,
  actsDoor,
  affirming,
  closeStage,
  grantRole,
  metresPerString,
  openSheetsStage,
  rowsOf,
  stagePerson,
  stageScaleIngest,
  viewKeysOf,
  type Person,
  type StagedScale,
} from "./support/scale-stage";
import { calibrationKey, citeObservation, factorPair, isFactorString, verifyAxis } from "@/core/scale";
import { refusalCodeOf } from "@/core/faults/refusal-marker";

/** How long a staged case may take: two ingests recorded and two partitions rebuilt over them. */
const BUDGET_MS = 900_000;

/** The salt both artifacts are built from — the same file, uploaded twice, as a person may do. */
const ONE_FILE = 77;

interface Staged {
  person: Person;
  projectId: string;
  first: StagedScale;
  second: StagedScale;
  /** The one view key both drawings carry, and the act names in each. */
  viewKey: string;
}

let staging: Promise<Staged> | undefined;

function staged(): Promise<Staged> {
  return (staging ??= (async () => {
    await openSheetsStage();
    const { person, projectId } = await stagePerson("scale-breaker");
    grantRole(person.tenantId, projectId, person.userId, PRINCIPAL);

    const first = await stageScaleIngest(person, projectId, SCENARIO.UNITS_ONLY, ONE_FILE);
    const second = await stageScaleIngest(person, projectId, SCENARIO.UNITS_ONLY, ONE_FILE);
    expect(second.drawing.drawingId, "the two uploads are two drawings").not.toBe(first.drawing.drawingId);
    expect(second.ingestId, "and two ingest records").not.toBe(first.ingestId);

    const shared = viewKeysOf(person, first).filter((key) => viewKeysOf(person, second).includes(key));
    expect(
      shared.length,
      "a view key is minted over the caption's own file handle, so one file uploaded twice partitions into views of the same key — the collision this suite attacks",
    ).toBeGreaterThan(0);

    return { person, projectId, first, second, viewKey: shared[0] as string };
  })());
}

afterAll(async () => {
  await closeStage();
}, 120_000);

/** Affirm one view of one staged drawing at the rank the header alone supports, through the shipped seam. */
async function affirm(stage: Staged, drawing: StagedScale): Promise<string> {
  const acts = await actsDoor();
  const ctx = actorOf(stage.person);
  const asked = affirming({ projectId: stage.projectId, drawingId: drawing.drawing.drawingId, rank: FILE_UNITS, viewKeys: [stage.viewKey] });
  const consequence = await acts.preview(ctx, asked);
  const written = await acts.commit(ctx, asked, acts.consequenceDigest(consequence));
  return written.actId;
}

/** Both acts, performed once and remembered: an act is performed, never re-performed. */
let affirming2: Promise<{ firstActId: string; secondActId: string }> | undefined;

function affirmedBoth(): Promise<{ firstActId: string; secondActId: string }> {
  return (affirming2 ??= (async () => {
    const stage = await staged();
    const firstActId = await affirm(stage, stage.first);
    const secondActId = await affirm(stage, stage.second);
    expect(secondActId, "the two affirmations are two acts").not.toBe(firstActId);
    return { firstActId, secondActId };
  })());
}

describe("breaker: a calibration filed by one drawing's act is not another drawing's calibration", () => {
  test("each affirmation files a calibration row of its own ingest", async () => {
    const stage = await staged();
    await affirmedBoth();

    const held = rowsOf(CALIBRATIONS, stage.person.tenantId);
    const ofSecond = held.filter((row) => row["ingest_id"] === stage.second.ingestId);
    expect(
      ofSecond.length,
      `the second drawing's act affirmed ${stage.viewKey} of ingest ${stage.second.ingestId}, so the store holds that ingest's calibration — a row nothing can find by the ingest that filed it is a calibration the drawing does not have (L-ACT-01, AC-5)`,
    ).toBe(1);
  }, BUDGET_MS);

  test("a calibration row names the act that filed it", async () => {
    const stage = await staged();
    const { secondActId } = await affirmedBoth();
    const factor = metresPerString(MM);
    const key = calibrationKey(stage.viewKey, factor, factor);

    const held = rowsOf(CALIBRATIONS, stage.person.tenantId).filter((row) => row["key"] === key);
    expect(held.length, "the calibration the two acts both name is held under its content key").toBe(1);

    const affirmations = rowsOf(SCALE_AFFIRMATIONS, stage.person.tenantId).filter((row) => row["ingest_id"] === stage.second.ingestId);
    expect(affirmations.length, "the second act left its own affirmation row").toBe(1);
    expect(
      (affirmations[0] as Record<string, unknown>)["incoming_keys"],
      "and that row takes the view to this very calibration — which is why the calibration must answer for it too",
    ).toContain(key);

    const row = held[0] as Record<string, unknown>;
    expect(
      [row["act_id"], row["drawing_id"], row["ingest_id"]],
      `the calibration ${key} is what the second act (${secondActId}) filed for drawing ${stage.second.drawing.drawingId}, and the row's own NOT NULL provenance columns name the first drawing's act instead`,
    ).toEqual([secondActId, stage.second.drawing.drawingId, stage.second.ingestId]);
  }, BUDGET_MS);
});

describe("breaker: an observation the law admits carries a factor the law can read", () => {
  /** One lawful two-point observation along x: two cited points on the lattice and an entered distance. */
  function observation(fromX: string, toX: string, value: string, unit: string): Record<string, unknown> {
    return {
      points: [
        { sourceKey: "DXF_HANDLE:4D0001", x: fromX, y: "0" },
        { sourceKey: "DXF_HANDLE:4D0002", x: toX, y: "0" },
      ],
      distance: { value, unit },
      distanceBasis: "ENTERED",
    };
  }

  test("citeObservation answers a factor `isFactorString` admits, or refuses by name", () => {
    // A person's own numbers: two points a long way apart on the lattice, and a distance entered in
    // millimetres. Nothing here is outside what the law admits — every field is the shape AC-3 names.
    const raw = observation("0", "2000000000", "1", MM);

    let answered: { factor: string } | null = null;
    let refused: unknown = null;
    try {
      answered = citeObservation(raw);
    } catch (error) {
      refused = error;
    }

    if (answered === null) {
      expect(refusalCodeOf(refused), "an observation the law will not stand on is refused by a code L-MEA-05 names, never a fault (ARCH-03)").not.toBeNull();
      return;
    }
    expect(
      isFactorString(answered.factor),
      `citeObservation answered the factor ${JSON.stringify(answered.factor)}, which the law's own isFactorString rejects — the act feeds it straight to verifyAxis and factorPair, both of which admit factor strings and nothing else (L-MEA-05)`,
    ).toBe(true);
  });

  test("the step the act takes next answers, and does not fault", () => {
    const raw = observation("0", "2000000000", "1", MM);

    let thrown: unknown = null;
    try {
      const cited = citeObservation(raw);
      // Exactly what `judgeRank` does at rank QS_TWO_POINT: verify the axis against the machine's
      // own reading, then render the pair. The header of a millimetre drawing is the corroboration.
      const verified = verifyAxis(cited.axis, [cited.factor], [metresPerString(MM)], "0.01");
      factorPair(verified.factor, verified.factor);
    } catch (error) {
      thrown = error;
    }

    if (thrown !== null) {
      expect(
        refusalCodeOf(thrown),
        `a person's own two-point observation ended in an unmarked Error ("${(thrown as Error).message.slice(0, 90)}") — a refusal is an answer and a fault is not, and every field of this observation is one the law admits (ARCH-03, B-21)`,
      ).not.toBeNull();
    }
  });
});
