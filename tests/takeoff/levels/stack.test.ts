/**
 * AC-6 — the stack: the digest inc-209's campaign open will snapshot, and the live stack the module
 * door answers (L-MEA-07, L-REG-02, L-REG-04).
 *
 * The digest is over what a stack IS — its members' surrogate ids and the ordinals they stand at —
 * and blind to everything the law calls non-identifying: a label, a height. It is a property of a
 * set, so the order the members were handed over in cannot change it.
 *
 * The V-DB half of this criterion — the two tables, their posture and their constraints — is
 * `db/__tests__/levels.migration.test.ts`, which runs in the database lane.
 */
import { afterAll, describe, expect, test } from "vitest";
import {
  AGREED,
  NONE,
  closeStage,
  field,
  insertion,
  labelsOf,
  levelsCore,
  levelsSeam,
  ordinalsOf,
  performAct,
  stackEntry,
  stageLevels,
  standingOf,
  unheldLevelId,
  type LevelsCore,
  type LevelsSeam,
  type StackMember,
  type StagedLevels,
} from "./support/levels-stage";

const BUDGET_MS = 300_000;

/** A stack whose labels sort one way and whose ordinals sort another (AC-6). */
const GF = "GF";
const TWO_F = "2F";
const TEN_F = "10F";

/** The reading 2F is authored with, so the stack's heights are not all the same answer. */
const TWO_F_HEIGHT = { valueAsWritten: "3.048", unitAsWritten: "m", sourceKey: "e:h9" };

/** A 64-hex sha-256, as every content-derived address in this tree is spelled (L-REG-04). */
const SHA256_HEX = /^[0-9a-f]{64}$/;

type Staged = { levels: StagedLevels; door: LevelsSeam; core: LevelsCore };

let staging: Promise<Staged> | undefined;

function staged(): Promise<Staged> {
  return (staging ??= (async () => {
    const door = await levelsSeam();
    const core = await levelsCore();
    const levels = await stageLevels("stack");
    await performAct(
      levels.actor,
      insertion(levels.projectId, [
        { label: GF, ordinal: 0 },
        { label: TWO_F, ordinal: 2, readings: [TWO_F_HEIGHT] },
        { label: TEN_F, ordinal: 10 },
      ]),
    );
    return { levels, door, core };
  })());
}

/** Three members of a stack, built here because a digest is a pure function of what it is given. */
function membersOf(): StackMember[] {
  return [
    { levelId: unheldLevelId(), ordinal: 0, label: GF, height: { standing: NONE, canonicalMetres: null } },
    { levelId: unheldLevelId(), ordinal: 2, label: TWO_F, height: { standing: AGREED, canonicalMetres: "3.048" } },
    { levelId: unheldLevelId(), ordinal: 10, label: TEN_F, height: { standing: NONE, canonicalMetres: null } },
  ];
}

afterAll(async () => {
  await closeStage();
});

describe("AC-6: the level-stack digest, and the live stack the door answers", () => {
  test(
    "AC-6: the digest is a sha-256 over the members' ids and ordinals — blind to labels, heights and the order they arrived in",
    async () => {
      const { core } = await staged();
      const members = membersOf();
      const digest = core.levelStackDigest(members);
      expect(digest, "a stack digest is a 64-hex sha-256, like every other content-derived address here (L-REG-04)").toMatch(SHA256_HEX);

      const relabelled = members.map((member) => ({
        ...member,
        label: `${String(member["label"])} (renamed)`,
        height: { standing: AGREED, canonicalMetres: "9.999" },
      }));
      expect(core.levelStackDigest(relabelled), "a label and a height are non-identifying, so a stack that only renamed and re-measured is the same stack (L-REG-02)").toBe(digest);

      expect(core.levelStackDigest([...members].reverse()), "and a stack is what it holds, not the order somebody listed it in").toBe(digest);
    },
    BUDGET_MS,
  );

  test(
    "AC-6: the digest moves when a member's ordinal moves, and when a member is another level",
    async () => {
      const { core } = await staged();
      const members = membersOf();
      const digest = core.levelStackDigest(members);

      const moved = members.map((member, at) => (at === 1 ? { ...member, ordinal: 3 } : member));
      expect(core.levelStackDigest(moved), "an ordinal is what a level IS in the stack, so moving one is a different stack (L-MEA-07)").not.toBe(digest);

      const swapped = members.map((member, at) => (at === 1 ? { ...member, levelId: unheldLevelId() } : member));
      expect(core.levelStackDigest(swapped), "and so is a stack holding another level in its place").not.toBe(digest);
    },
    BUDGET_MS,
  );

  test(
    "AC-6: the live stack is in ordinal order — never code-point order — and each level carries its height's standing",
    async () => {
      const { levels, door } = await staged();
      const stack = await door.levelStackOf(levels.scope);

      expect(labelsOf(stack), "the stack is ordered by the ordinal each level physically stands at (L-MEA-07)").toEqual([GF, TWO_F, TEN_F]);
      expect(ordinalsOf(stack), "at the ordinals the act took, ascending").toEqual([0, 2, 10]);
      expect(labelsOf(stack), "and not by the code points of the labels, which would put 10F first (L-REG-02: a label is not identity)").not.toEqual([TEN_F, TWO_F, GF]);

      for (const entry of stack.map(stackEntry)) {
        const standing = standingOf(await door.storeyHeightOf(levels.scope, entry.levelId));
        expect(field(entry.height, "standing", "standing"), `${entry.label} carries the standing its readings amount to`).toBe(standing.standing);
        expect(field(entry.height, "canonicalMetres", "canonical_metres") ?? null, `and the metres that standing stands at`).toBe(standing.canonicalMetres ?? null);
        expect(field(entry.height, "refusal", "refusal") ?? null, `and the refusal it carries where it carries one`).toBe(standing.refusal ?? null);
      }
      const heights = stack.map((entry) => field(stackEntry(entry).height, "standing", "standing"));
      expect(heights, "the level that was read stands AGREED, the two that were not stand at NONE").toEqual([NONE, AGREED, NONE]);
    },
    BUDGET_MS,
  );
});
