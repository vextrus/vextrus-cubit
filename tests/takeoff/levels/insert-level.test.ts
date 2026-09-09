/**
 * AC-1 — INSERT_LEVEL: the act that authors a stack, and carries the register objects standing
 * under `@unregistered:<label>` onto the surrogate it mints (L-MEA-07, L-ACT-02, L-ACT-03, L-REG-04).
 *
 * Everything below is observed by driving the shipped seam: one preview, one commit, and then the
 * stores and the module's own door read back. The level ids are never transcribed — a surrogate is
 * minted by the store at commit, so every expectation about them is derived from what the product
 * answered (B-19).
 *
 * Staged lazily and memoised: the preview a case reads and the commit another case reads are ONE
 * pair over one state, because a second preview of a project that now holds levels is a different
 * Consequence (L-ACT-02).
 */
import { afterAll, describe, expect, test } from "vitest";
import {
  AGREED,
  AUTHOR_LEVEL_STACK,
  AUTHOR_PROJECT_FACT,
  AUTHOR_STOREY_HEIGHT,
  BEAM,
  COLUMN,
  INSERT_LEVEL,
  NONE,
  REPUDIATE_LEVEL,
  TRANSCRIBED,
  UUID,
  actsLaw,
  actsOfType,
  closeStage,
  field,
  identitySeam,
  insertion,
  levelIdOf,
  levelRows,
  levelsSeam,
  labelsOf,
  levelOf,
  metresOf,
  objectsByKey,
  ordinalsOf,
  performAct,
  readingRows,
  registerOne,
  sameValue,
  sightingOf,
  stackEntry,
  stageLevels,
  standingOf,
  subjectFor,
  subjectsOf,
  movedTo,
  type IdentitySeam,
  type LevelsSeam,
  type Performed,
  type StagedLevels,
  type StoreRow,
} from "./support/levels-stage";

const BUDGET_MS = 300_000;

/** The two levels this act proposes, and the reading 1F arrives with (AC-1). */
const GF = "GF";
const ONE_F = "1F";
const READING_VALUE = "10";
const READING_UNIT = "ft";
const READING_SOURCE = "e:h1";

type Staged = {
  levels: StagedLevels;
  door: LevelsSeam;
  identity: IdentitySeam;
  /** The two objects standing under `@unregistered:1F` before the act, keyed by element type. */
  objectKeys: { column: string; beam: string };
};

let staging: Promise<Staged> | undefined;

function staged(): Promise<Staged> {
  return (staging ??= (async () => {
    const door = await levelsSeam();
    const identity = await identitySeam();
    const levels = await stageLevels("insert");
    const column = await registerOne(levels, sightingOf({ label: "c1-under-1f", mark: "C1", elementType: COLUMN, level: { unregistered: ONE_F } }));
    const beam = await registerOne(levels, sightingOf({ label: "b1-under-1f", mark: "B1", elementType: BEAM, level: { unregistered: ONE_F }, x: 2000, y: 500 }));
    return { levels, door, identity, objectKeys: { column, beam } };
  })());
}

let acting: Promise<Performed> | undefined;

/** The one act this file performs: previewed and committed once, over one state (L-ACT-02). */
function inserted(): Promise<Performed> {
  return (acting ??= (async () => {
    const { levels } = await staged();
    return performAct(
      levels.actor,
      insertion(levels.projectId, [
        { label: GF, ordinal: 0 },
        { label: ONE_F, ordinal: 1, readings: [{ valueAsWritten: READING_VALUE, unitAsWritten: READING_UNIT, sourceKey: READING_SOURCE }] },
      ]),
    );
  })());
}

afterAll(async () => {
  await closeStage();
});

/** The level rows this project's workspace holds, keyed by the ordinal each stands at. */
function levelsByOrdinal(tenantId: string): Map<number, StoreRow> {
  return new Map(levelRows(tenantId).map((row) => [Number(field(row, "ordinal", "ordinal")), row]));
}

describe("AC-1: INSERT_LEVEL authors a stack and carries the objects that were waiting for it", () => {
  test(
    "AC-1: the three act types stand in the law under the permissions L-ACT-03 cuts for them",
    async () => {
      const law = await actsLaw();
      for (const actType of [INSERT_LEVEL, REPUDIATE_LEVEL, AUTHOR_STOREY_HEIGHT]) {
        expect(law.ACT_TYPES, `${actType} stands in ACT_TYPES — an act type with no rendering is a compile error (L-ACT-02)`).toContain(actType);
      }
      expect(law.ACT_PERMISSION[INSERT_LEVEL], `INSERT_LEVEL moves ${AUTHOR_LEVEL_STACK} (L-ACT-03)`).toBe(AUTHOR_LEVEL_STACK);
      expect(law.ACT_PERMISSION[REPUDIATE_LEVEL], `REPUDIATE_LEVEL moves ${AUTHOR_LEVEL_STACK} (L-ACT-03)`).toBe(AUTHOR_LEVEL_STACK);
      expect(law.ACT_PERMISSION[AUTHOR_STOREY_HEIGHT], `AUTHOR_STOREY_HEIGHT moves ${AUTHOR_PROJECT_FACT} (L-ACT-03)`).toBe(AUTHOR_PROJECT_FACT);
    },
    BUDGET_MS,
  );

  test(
    "AC-1: the preview states the ordinals the act takes and the objects it would carry off the placeholder",
    async () => {
      const { objectKeys } = await staged();
      const { consequence } = await inserted();
      const subjects = subjectsOf(consequence);

      const proposed = ["proposed:0", "proposed:1"];
      expect(movedTo(subjectFor(consequence, "proposed:0")), "the first proposed level takes ordinal 0 and moves off nothing").toEqual({ before: [], after: ["ordinal:0"] });
      expect(movedTo(subjectFor(consequence, "proposed:1")), "the second proposed level takes ordinal 1").toEqual({ before: [], after: ["ordinal:1"] });

      const objectSubjects = subjects.filter((subject) => !proposed.includes(String(subject.subjectId)));
      expect(
        objectSubjects.map((subject) => String(subject.subjectId)).sort(),
        `the act states one subject per register object it carries — 2 objects, by the key each stands on now (L-REG-04)`,
      ).toEqual([objectKeys.beam, objectKeys.column].sort());
      expect(
        objectSubjects.map((subject) => String(subject.subjectLabel)).sort(),
        "and says what class each is — 2 objects across 2 classes, stated (AC-1)",
      ).toEqual([BEAM, COLUMN].sort());
      for (const subject of objectSubjects) {
        expect(movedTo(subject).after, `the object ${String(subject.subjectId)} is carried onto ${ONE_F}`).toEqual([ONE_F]);
      }
      expect(subjects.length, "and it states those four subjects and nothing else — one act, N subjects (L-ACT-01)").toBe(4);
    },
    BUDGET_MS,
  );

  test(
    "AC-1: the commit writes one act, two levels with distinct surrogate ids, and the reading 1F arrived with",
    async () => {
      const { levels } = await staged();
      const { actId } = await inserted();

      const written = actsOfType(levels.tenantId, levels.projectId, INSERT_LEVEL);
      expect(written.map((row) => row.actId), "one act row, for one act over N subjects (L-ACT-01)").toEqual([actId]);

      const rows = levelsByOrdinal(levels.tenantId);
      expect([...rows.keys()].sort((left, right) => left - right), "the two proposed ordinals, and nothing else").toEqual([0, 1]);
      const ids = [...rows.values()].map((row) => String(field(row, "levelId", "level_id")));
      for (const id of ids) expect(id, "a level's identity is a surrogate the store minted (L-MEA-07)").toMatch(UUID);
      expect(new Set(ids).size, "the two levels are two objects, not one").toBe(2);
      for (const row of rows.values()) {
        expect(String(field(row, "insertedActId", "inserted_act_id")), "each level cites the act that inserted it (L-ACT-01)").toBe(actId);
      }

      const readings = readingRows(levels.tenantId);
      expect(readings.length, `the reading proposed with ${ONE_F} was written, and ${GF} — which proposed none — carries none`).toBe(1);
      const reading = readings[0] as StoreRow;
      expect(String(field(reading, "levelId", "level_id")), `the reading stands on ${ONE_F}`).toBe(String(field(rows.get(1), "levelId", "level_id")));
      expect(field(reading, "basis", "basis"), "a reading proposed with the level was transcribed from the drawing").toBe(TRANSCRIBED);
      expect(String(field(reading, "actorId", "actor_id")), "and names the person who committed it").toBe(levels.person.userId);
      expect(field(reading, "sourceKey", "source_key"), "and the source key it was read off").toBe(READING_SOURCE);
      expect(String(field(reading, "actId", "act_id")), "and the act that carried it (L-ACT-01)").toBe(actId);
    },
    BUDGET_MS,
  );

  test(
    "AC-1: both register objects are carried onto the surrogate, one hop, and nothing else about them moves",
    async () => {
      const { levels, identity, objectKeys } = await staged();
      await inserted();
      const oneF = levelsByOrdinal(levels.tenantId).get(1);
      const levelId = String(field(oneF, "levelId", "level_id"));

      const held = await objectsByKey(levels);
      for (const [element, before] of [[COLUMN, objectKeys.column] as const, [BEAM, objectKeys.beam] as const]) {
        const carried = identity.carryLevel(before, { label: ONE_F, levelId });
        expect(carried.carried, `${before} stands under the placeholder ${ONE_F}, so the carry is the one hop L-REG-04 allows`).toBe(true);
        const row = held.get(carried.key);
        expect(row, `the ${element} now stands on ${carried.key} — the placeholder carried onto the surrogate (L-REG-04)`).toBeTruthy();
        const columns = levelOf(row as StoreRow);
        expect(String(columns.levelId), "and the row names the level it was carried onto").toBe(levelId);
        expect(columns.levelLabel ?? null, "and holds no placeholder label any more — a label never keys (L-REG-02)").toBeNull();
      }
    },
    BUDGET_MS,
  );

  test(
    "AC-1: the live stack answers GF then 1F, GF with no height stated and 1F agreed at what was read",
    async () => {
      const { levels, door } = await staged();
      await inserted();
      const stack = await door.levelStackOf(levels.scope);

      expect(labelsOf(stack), "the live stack, in ordinal order").toEqual([GF, ONE_F]);
      expect(ordinalsOf(stack), "at the ordinals the act took").toEqual([0, 1]);

      const gf = stack.map(stackEntry).find((entry) => entry.label === GF);
      expect(field(gf?.height, "standing", "standing"), `${GF} was proposed with no reading, so nobody has stated its storey height`).toBe(NONE);

      const oneF = stack.map(stackEntry).find((entry) => entry.label === ONE_F);
      expect(field(oneF?.height, "standing", "standing"), `${ONE_F} carries the one reading it arrived with, which agrees with itself`).toBe(AGREED);
      const stated = await metresOf(READING_VALUE, READING_UNIT);
      expect(
        await sameValue(field(oneF?.height, "canonicalMetres", "canonical_metres"), stated),
        `and it stands at ${READING_VALUE} ${READING_UNIT} in canonical metres, as the unit canon carries it`,
      ).toBe(true);
      expect(levelIdOf(stack, ONE_F), "the stack names each level by the surrogate it stands under").toMatch(UUID);
      expect(standingOf(await door.storeyHeightOf(levels.scope, levelIdOf(stack, ONE_F))).standing, "the stack's height is the standing the door answers for that level").toBe(AGREED);
    },
    BUDGET_MS,
  );
});
