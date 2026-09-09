/**
 * AC-4 — AUTHOR_STOREY_HEIGHT: a reading is kept as written beside its canonical metres, and two
 * readings that agree corroborate (L-MEA-07, L-REG-02, R-TO-051, L-FRM-06).
 *
 * The value the store must hold is never transcribed here: what `10 ft` is in metres is asked of the
 * product's own unit canon, and the criterion's `3.048` is checked against that answer once (B-19,
 * B-17). Equality between two readings is equality of canonical metres, so the second actor states
 * the same height in another spelling and the two corroborate.
 */
import { afterAll, describe, expect, test } from "vitest";
import {
  AGREED,
  AUTHOR_STOREY_HEIGHT,
  DEFAULTED,
  DERIVED,
  ENTERED,
  MEASURER,
  NONE,
  STOREY_HEIGHT_UNSTATED,
  TRANSCRIBED,
  actsOfType,
  closeStage,
  codeOf,
  field,
  heightReading,
  insertion,
  levelIdOf,
  levelsCore,
  levelsSeam,
  metresOf,
  performAct,
  previewOf,
  readingRows,
  rejection,
  saidBy,
  sameValue,
  saysTheValue,
  stageActor,
  stageLevels,
  standingOf,
  subjectsOf,
  movedTo,
  type ActorCtx,
  type LevelsCore,
  type LevelsSeam,
  type Performed,
  type Person,
  type StagedLevels,
  type StoreRow,
  type SubjectLike,
} from "./support/levels-stage";

const BUDGET_MS = 300_000;

const GF = "GF";
const ONE_F = "1F";

/** The criterion's own numbers: what one person entered, and what the canon carries it to. */
const ENTERED_VALUE = "10";
const ENTERED_UNIT = "ft";
const CANONICAL_METRES = "3.048";
const SECOND_SOURCE = "e:h2";

/** The three bases a reading may carry, in the order AC-4 states them. */
const BASES: readonly string[] = [TRANSCRIBED, DERIVED, ENTERED];

type Staged = {
  levels: StagedLevels;
  door: LevelsSeam;
  core: LevelsCore;
  measurer: { person: Person; actor: ActorCtx };
  second: { person: Person; actor: ActorCtx };
  oneF: string;
  gf: string;
};

let staging: Promise<Staged> | undefined;

function staged(): Promise<Staged> {
  return (staging ??= (async () => {
    const door = await levelsSeam();
    const core = await levelsCore();
    const levels = await stageLevels("height");
    const measurer = await stageActor(levels, "height-measurer", MEASURER);
    const second = await stageActor(levels, "height-second", MEASURER);
    await performAct(levels.actor, insertion(levels.projectId, [{ label: GF, ordinal: 0 }, { label: ONE_F, ordinal: 1 }]));
    const stack = await door.levelStackOf(levels.scope);
    return { levels, door, core, measurer, second, oneF: levelIdOf(stack, ONE_F), gf: levelIdOf(stack, GF) };
  })());
}

let first: Promise<Performed> | undefined;

/** The measurer's own reading: entered as `10 ft`, with no source key behind it. */
function entered(): Promise<Performed> {
  return (first ??= (async () => {
    const { levels, measurer, oneF } = await staged();
    return performAct(measurer.actor, heightReading({ projectId: levels.projectId, levelId: oneF, valueAsWritten: ENTERED_VALUE, unitAsWritten: ENTERED_UNIT, basis: ENTERED }));
  })());
}

let corroboration: Promise<Performed> | undefined;

/** A second actor's transcription of the same height, in another unit — it agrees, so it corroborates. */
function transcribed(): Promise<Performed> {
  return (corroboration ??= (async () => {
    await entered();
    const { levels, second: actor, oneF } = await staged();
    return performAct(
      actor.actor,
      heightReading({ projectId: levels.projectId, levelId: oneF, valueAsWritten: CANONICAL_METRES, unitAsWritten: "m", basis: TRANSCRIBED, sourceKey: SECOND_SOURCE }),
    );
  })());
}

afterAll(async () => {
  await closeStage();
});

describe("AC-4: a storey height is authored, kept as written, and corroborated", () => {
  test(
    "AC-4: the preview names the reading key the act takes and states the metres it would stand at",
    async () => {
      const { core, measurer, oneF } = await staged();
      const { consequence } = await entered();

      const key = core.readingKey({ levelId: oneF, actorId: measurer.person.userId, basis: ENTERED, sourceKey: null });
      const subjects = subjectsOf(consequence);
      expect(subjects.map((subject) => String(subject.subjectId)), "one reading, keyed by level, actor, basis and source key").toEqual([key]);
      const moved = movedTo(subjects[0] as SubjectLike);
      expect(moved.before, "this actor had read nothing under that key").toEqual([]);
      expect(moved.after.length, "and now reads one value").toBe(1);
      expect(await sameValue(moved.after[0], await metresOf(ENTERED_VALUE, ENTERED_UNIT)), `which is ${ENTERED_VALUE} ${ENTERED_UNIT} in canonical metres`).toBe(true);
    },
    BUDGET_MS,
  );

  test(
    "AC-4: the commit writes one act and one reading, as written beside its canonical metres and the factor that carried it",
    async () => {
      const { levels, measurer, oneF } = await staged();
      const { actId } = await entered();

      expect(
        actsOfType(levels.tenantId, levels.projectId, AUTHOR_STOREY_HEIGHT).map((row) => row.actId),
        "one act for one reading (L-ACT-01)",
      ).toEqual([actId]);

      const rows = readingRows(levels.tenantId);
      expect(rows.length, "and one reading row").toBe(1);
      const row = rows[0] as StoreRow;
      const said = JSON.stringify(row);
      expect(await saysTheValue(row, ENTERED_VALUE), `the row keeps ${ENTERED_VALUE} as written: ${said}`).toBe(true);
      expect(saidBy(row), `and ${ENTERED_UNIT} as written: ${said}`).toContain(ENTERED_UNIT);
      const stated = await metresOf(ENTERED_VALUE, ENTERED_UNIT);
      expect(await sameValue(stated, CANONICAL_METRES), `the canon carries ${ENTERED_VALUE} ${ENTERED_UNIT} to ${CANONICAL_METRES} metres (L-FRM-06)`).toBe(true);
      expect(await saysTheValue(row, CANONICAL_METRES), `and the row holds that canonical value beside what was written: ${said}`).toBe(true);
      expect(String(field(row, "factor", "factor") ?? "").length, "with the factor that carried it (L-REG-01: a conversion carries its derivation)").toBeGreaterThan(0);
      expect(String(field(row, "factorProvenance", "factor_provenance") ?? "").length, "and where that factor came from").toBeGreaterThan(0);
      expect(field(row, "basis", "basis"), "on the basis the act declared").toBe(ENTERED);
      expect(String(field(row, "actorId", "actor_id")), "by the person who authored it").toBe(measurer.person.userId);
      expect(String(field(row, "levelId", "level_id")), "on the level it was read for").toBe(oneF);
      expect(String(field(row, "actId", "act_id")), "under the act that carried it").toBe(actId);
    },
    BUDGET_MS,
  );

  test(
    "AC-4: a second actor reading the same height in another unit corroborates it, and both readings stand",
    async () => {
      const { levels, door, oneF } = await staged();
      await transcribed();

      const standing = standingOf(await door.storeyHeightOf(levels.scope, oneF));
      expect(standing.standing, "two readings that agree corroborate (R-TO-051)").toBe(AGREED);
      expect(await sameValue(standing.canonicalMetres, CANONICAL_METRES), `at ${CANONICAL_METRES} metres — equality is on canonical metres, not on spelling`).toBe(true);
      expect(standing.refusal ?? null, "and nothing is refused about a height everybody agrees on").toBeNull();
      expect(standing.current.length, "both readings are current: one entered, one transcribed").toBe(2);
      expect((await door.readingsOf(levels.scope, oneF)).length, "and the store holds them both").toBe(2);
    },
    BUDGET_MS,
  );

  test(
    "AC-4: a level nobody has read stands at no height, and says so by name",
    async () => {
      const { levels, door, gf } = await staged();
      await transcribed();

      const standing = standingOf(await door.storeyHeightOf(levels.scope, gf));
      expect(standing.standing, `${GF} carries no reading at all`).toBe(NONE);
      expect(standing.canonicalMetres ?? null, "so it stands at no height — never a defaulted one (L-MEA-07)").toBeNull();
      expect(standing.refusal, "and the absence is stated by the name a line would report it under").toBe(STOREY_HEIGHT_UNSTATED);
    },
    BUDGET_MS,
  );

  test(
    "AC-4: DEFAULTED is barred at the act, and writes nothing",
    async () => {
      const { levels, measurer, oneF } = await staged();
      await transcribed();
      const before = readingRows(levels.tenantId).length;

      const input = heightReading({ projectId: levels.projectId, levelId: oneF, valueAsWritten: "3", unitAsWritten: "m", basis: DEFAULTED });
      const failure = await rejection(previewOf(measurer.actor, input));
      expect(failure, "a defaulted storey height is not a reading anybody made, and the act refuses to preview one").not.toBeNull();
      expect(await codeOf(failure), "by name (L-MEA-07: a height nobody stated is unstated)").toBe(STOREY_HEIGHT_UNSTATED);
      expect(readingRows(levels.tenantId).length, "and nothing reached the store").toBe(before);
    },
    BUDGET_MS,
  );

  test(
    "AC-4: the bases a reading may carry are transcribed, derived and entered — and nothing else",
    async () => {
      const { core } = await staged();
      expect([...core.STOREY_HEIGHT_BASES], "the closed roster a reading's basis is drawn from (AC-4)").toEqual([...BASES]);
      expect(core.STOREY_HEIGHT_BASES, "which does not admit a defaulted height at the store either").not.toContain(DEFAULTED);
    },
    BUDGET_MS,
  );
});
