/**
 * Breaker acceptance for inc-204's scale engine — two attacks on the shipped surfaces, each stated
 * as the behaviour L-MEA-05 promises rather than as the shape of a fix.
 *
 * (1) A calibration is content-addressed over (view key, factorX, factorY) alone, and a source key
 *     is scoped to (file bytes, extractor identity) — so one file uploaded twice mints the same
 *     caption handle, hence the same view key, hence at the same factors ONE calibration for two
 *     drawings, two ingests and two acts. That deduplication is the law's own design, and the store
 *     is faithful to it: one content, one row per workspace ((tenant_id, key), append-only). What
 *     the two acts may not lose is their granularity (L-ACT-01): each act's own `scale_affirmations`
 *     row must name it, the view it covered and the calibration it took, and the read-back AC-5
 *     promises must answer each ingest's view with the act that affirmed THAT ingest — resolved from
 *     the affirmation that named the view, never read off the shared row's one filer.
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
  affirmedOf,
  affirming,
  answerFor,
  closeStage,
  grantRole,
  metresPerString,
  openSheetsStage,
  rowsOf,
  saidBy,
  scaleDoor,
  scopeOf,
  stagePerson,
  stageScaleIngest,
  storageOf,
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
  test("a calibration is filed once and each act's own affirmation names it", async () => {
    const stage = await staged();
    const { firstActId, secondActId } = await affirmedBoth();
    const factor = metresPerString(MM);
    const key = calibrationKey(stage.viewKey, factor, factor);

    const held = rowsOf(CALIBRATIONS, stage.person.tenantId).filter((row) => row["key"] === key);
    expect(
      held.length,
      `both acts affirmed the same reading of ${stage.viewKey} at the same factors, and a calibration is addressed over (view key, factorX, factorY) alone: one content, one row per workspace (L-MEA-05)`,
    ).toBe(1);

    const affirmations = rowsOf(SCALE_AFFIRMATIONS, stage.person.tenantId).filter((row) => row["ingest_id"] === stage.second.ingestId);
    expect(
      affirmations.length,
      `the second act affirmed ingest ${stage.second.ingestId}, and an act's state change is recorded at the granularity performed — the affirmation row is new every time, because an act is (L-ACT-01)`,
    ).toBe(1);
    const affirmation = affirmations[0] as Record<string, unknown>;
    expect(
      { actId: affirmation["act_id"], rank: affirmation["rank"] },
      "and that row names the act that performed it and the rank it stood on (L-MEA-05)",
    ).toEqual({ actId: secondActId, rank: FILE_UNITS });
    expect(saidBy(affirmation), `it names the view it covers (${stage.viewKey})`).toContain(stage.viewKey);
    expect(affirmation["incoming_keys"], "and takes that view to the calibration it stood on").toContain(key);

    // The read-back AC-5 promises: each ingest's view answers the act that affirmed THAT ingest,
    // resolved from the affirmation which named the view — never read off the shared row's one filer.
    const door = await scaleDoor();
    const storage = await storageOf();
    for (const [drawn, actId] of [
      [stage.second, secondActId],
      [stage.first, firstActId],
    ] as const) {
      const answered = await door.scaleProposalsOf(scopeOf(stage.person, stage.projectId, drawn), { storage });
      const affirmed = affirmedOf(answerFor(answered, stage.viewKey));
      expect(affirmed, `an act named ${stage.viewKey} of ingest ${drawn.ingestId}, so that view has a scale`).toBeTruthy();
      expect(
        {
          calibrationKey: affirmed?.calibrationKey,
          rank: affirmed?.rank,
          factorX: affirmed?.factorX,
          factorY: affirmed?.factorY,
          actId: affirmed?.actId,
        },
        `ingest ${drawn.ingestId} reads back the shared calibration and the act that affirmed IT — the row is one because the reading is one, and the attribution stays each act's own (L-ACT-01, AC-5)`,
      ).toStrictEqual({ calibrationKey: key, rank: FILE_UNITS, factorX: factor, factorY: factor, actId });
    }
  }, BUDGET_MS);

  test("a calibration row names one of the acts that affirmed it", async () => {
    const stage = await staged();
    const { firstActId, secondActId } = await affirmedBoth();
    const factor = metresPerString(MM);
    const key = calibrationKey(stage.viewKey, factor, factor);

    const held = rowsOf(CALIBRATIONS, stage.person.tenantId).filter((row) => row["key"] === key);
    expect(held.length, "the calibration the two acts both name is held under its content key").toBe(1);

    const affirmations = rowsOf(SCALE_AFFIRMATIONS, stage.person.tenantId).filter((row) => row["ingest_id"] === stage.second.ingestId);
    expect(affirmations.length, "the second act left its own affirmation row").toBe(1);
    expect(
      (affirmations[0] as Record<string, unknown>)["incoming_keys"],
      "and that row takes the view to this very calibration — the reference an act carries with its own act id (L-MEA-05)",
    ).toContain(key);

    // Which act the one row names is not pinned here, and cannot be: a content address is a function
    // of the reading, so the filer is whichever act reached the row first. What is owed is that the
    // act it names is one that really affirmed this reading, and that the affirmation carrying that
    // act takes the same view to the same key — derived from the store, never transcribed (B-19).
    const affirmedBy = rowsOf(SCALE_AFFIRMATIONS, stage.person.tenantId)
      .filter((candidate) => ((candidate["incoming_keys"] ?? []) as unknown[]).some((entry) => entry === key))
      .map((candidate) => String(candidate["act_id"]));
    expect(
      [...affirmedBy].sort(),
      `the two acts both affirmed ${stage.viewKey} at these factors, and each said so in an affirmation of its own (L-ACT-01)`,
    ).toEqual([firstActId, secondActId].sort());

    const row = held[0] as Record<string, unknown>;
    expect(
      affirmedBy,
      `the calibration ${key} names an act that affirmed it, and that act's own affirmation lists the key it filed`,
    ).toContain(String(row["act_id"]));
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
