/**
 * AC-3 — REPUDIATE_LEVEL: a level with live rows is never deleted, only marked (L-MEA-07, L-ACT-01).
 *
 * The level is authored through the shipped act, two register objects are put on it through the
 * shipped register door, and the repudiation is driven by a LEAD holding AUTHOR_LEVEL_STACK. What
 * the criterion grades is what SURVIVES: the row, its ordinal, both objects' keys and level ids,
 * and every other level's ordinal — while the live stack and its digest move on.
 */
import { afterAll, describe, expect, test } from "vitest";
import {
  ACT_CHANGES_NOTHING,
  LEAD,
  REPUDIATE_LEVEL,
  actsOfType,
  closeStage,
  field,
  insertion,
  levelIdOf,
  levelRowOf,
  levelRows,
  levelsSeam,
  labelsOf,
  levelOf,
  movedTo,
  objectsByKey,
  ordinalsOf,
  performAct,
  refusalOfPerforming,
  registerOne,
  repudiation,
  sightingOf,
  stackEntry,
  stageActor,
  stageLevels,
  subjectsOf,
  unheldLevelId,
  type ActorCtx,
  type LevelsSeam,
  type Performed,
  type StagedLevels,
  type StoreRow,
  type SubjectLike,
} from "./support/levels-stage";

const BUDGET_MS = 300_000;

const GF = "GF";
const ONE_F = "1F";
const TWO_F = "2F";

type Staged = {
  levels: StagedLevels;
  door: LevelsSeam;
  lead: ActorCtx;
  levelId: string;
  /** Every level row as it stood before the repudiation, keyed by surrogate id. */
  before: Map<string, StoreRow>;
  /** Every register object as it stood before the repudiation, keyed by the key it stood on. */
  objects: Map<string, StoreRow>;
  digest: string;
};

let staging: Promise<Staged> | undefined;

function staged(): Promise<Staged> {
  return (staging ??= (async () => {
    const door = await levelsSeam();
    const levels = await stageLevels("repudiate");
    const { actor: lead } = await stageActor(levels, "repudiate-lead", LEAD);

    await performAct(levels.actor, insertion(levels.projectId, [{ label: GF, ordinal: 0 }, { label: ONE_F, ordinal: 1 }, { label: TWO_F, ordinal: 2 }]));
    const stack = await door.levelStackOf(levels.scope);
    const levelId = levelIdOf(stack, ONE_F);

    for (const [label, mark] of [["c1", "C1"] as const, ["c2", "C2"] as const]) {
      await registerOne(levels, sightingOf({ label: `${label}-on-1f`, mark, level: { levelId }, x: mark === "C1" ? 1000 : 2000 }));
    }

    return {
      levels,
      door,
      lead,
      levelId,
      before: new Map(levelRows(levels.tenantId).map((row) => [String(field(row, "levelId", "level_id")), row])),
      objects: await objectsByKey(levels),
      digest: await door.levelStackDigestOf(levels.scope),
    };
  })());
}

let acting: Promise<Performed> | undefined;

/** The one repudiation this file performs — previewed and committed over one state (L-ACT-02). */
function repudiated(): Promise<Performed> {
  return (acting ??= (async () => {
    const { levels, lead, levelId } = await staged();
    return performAct(lead, repudiation(levels.projectId, levelId));
  })());
}

afterAll(async () => {
  await closeStage();
});

describe("AC-3: a level with live rows is repudiated, never deleted", () => {
  test(
    "AC-3: a LEAD's repudiation previews the one level it marks, and commits one act",
    async () => {
      const { levels, levelId } = await staged();
      const { consequence, actId } = await repudiated();

      const subjects = subjectsOf(consequence);
      expect(subjects.map((subject) => String(subject.subjectId)), "one act, one subject: the level it marks").toEqual([levelId]);
      expect(movedTo(subjects[0] as SubjectLike), "which stood at ordinal 1 and is now repudiated").toEqual({ before: ["ordinal:1"], after: ["repudiated"] });

      expect(
        actsOfType(levels.tenantId, levels.projectId, REPUDIATE_LEVEL).map((row) => row.actId),
        "one act row for the one repudiation (L-ACT-01)",
      ).toEqual([actId]);
    },
    BUDGET_MS,
  );

  test(
    "AC-3: the row stays with its ordinal, marked by the act, and no other level is renumbered",
    async () => {
      const { levels, levelId, before } = await staged();
      const { actId } = await repudiated();

      const row = levelRowOf(levels.tenantId, levelId);
      expect(row, "the repudiated level's row still stands — a level with live rows is never deleted (L-MEA-07)").toBeTruthy();
      expect(String(field(row, "repudiatedActId", "repudiated_act_id")), "and cites the act that marked it").toBe(actId);
      expect(field(row, "ordinal", "ordinal"), "at the ordinal it always stood at — the ordinal is physical (L-MEA-07)").toBe(field(before.get(levelId), "ordinal", "ordinal"));

      const now = new Map(levelRows(levels.tenantId).map((held) => [String(field(held, "levelId", "level_id")), held]));
      expect([...now.keys()].sort(), "every level the project held is still held").toEqual([...before.keys()].sort());
      for (const [id, was] of before) {
        expect(field(now.get(id), "ordinal", "ordinal"), `${id} stands where it stood — repudiation renumbers nothing (settled reading 1)`).toBe(field(was, "ordinal", "ordinal"));
      }
    },
    BUDGET_MS,
  );

  test(
    "AC-3: both register objects still carry the level, byte for byte, and the live stack omits it while its digest moves",
    async () => {
      const { levels, door, levelId, objects, digest } = await staged();
      await repudiated();

      const now = await objectsByKey(levels);
      expect([...now.keys()].sort(), "every object stands on the key it stood on — nothing was re-keyed (L-REG-04)").toEqual([...objects.keys()].sort());
      for (const [key, row] of now) {
        expect(levelOf(row).levelId, `${key} still names the level it was measured on — nothing was deleted (L-MEA-07)`).toBe(levelOf(objects.get(key) as StoreRow).levelId);
      }
      const onTheLevel = [...now.values()].filter((row) => String(levelOf(row).levelId) === levelId);
      expect(onTheLevel.length, "and the two live rows the level held are both still there").toBe(2);

      const stack = await door.levelStackOf(levels.scope);
      expect(labelsOf(stack), "the live stack is the levels that were not repudiated").toEqual([GF, TWO_F]);
      expect(ordinalsOf(stack), "each still at the ordinal it took — a gap is lawful, the ordinal is physical (L-MEA-07)").toEqual([0, 2]);
      expect(stack.map(stackEntry).some((entry) => entry.levelId === levelId), "and the repudiated level is not in it").toBe(false);
      expect(await door.levelStackDigestOf(levels.scope), "a stack a member left is a different stack (L-MEA-07, inc-209 snapshots this)").not.toBe(digest);
    },
    BUDGET_MS,
  );

  test(
    "AC-3: repudiating it again, and repudiating a level the project does not hold, change nothing",
    async () => {
      const { levels, lead, levelId } = await staged();
      await repudiated();

      expect(await refusalOfPerforming(lead, repudiation(levels.projectId, levelId)), "a level already marked is not marked again (L-ACT-01)").toBe(ACT_CHANGES_NOTHING);
      expect(await refusalOfPerforming(lead, repudiation(levels.projectId, unheldLevelId())), "and an act naming a level this project does not hold moves nothing").toBe(ACT_CHANGES_NOTHING);

      const acts = actsOfType(levels.tenantId, levels.projectId, REPUDIATE_LEVEL);
      expect(acts.length, "so the log still holds the one repudiation that happened").toBe(1);
    },
    BUDGET_MS,
  );
});
