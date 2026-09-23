/**
 * DLG-1 against the live store (docs/design/consequence-dialog.md I-445, I-446): what the act
 * seam's preview hands the ConsequenceDialog so it can say "GF: Agreed 3.3528 m → Suspended; 2
 * Column · Concrete lines on GF re-measure" instead of an enum and a wall of ids.
 *
 *   - the lines an AUTHOR_STOREY_HEIGHT would re-derive arrive COUNTED by class, kind and level,
 *     and the counts add up to exactly the ids the digest binds;
 *   - the standing the preview says the level will hold is the standing the stack reads once the
 *     act lands — the dialog promises what the product then does (B-17);
 *   - a commit carrying the digest of the counted, standing-bearing preview still lands (L-ACT-02).
 *
 * Nothing here freezes a count, a label or a figure: each expectation is derived from the stage and
 * from the product's own reads (B-19).
 */
import { afterAll, describe, expect, test } from "vitest";
import { actsSeam, closeStage, heightReading, lineIdsOnLevels, linesOf, lineRow, productModule, stageLevelsUi, type StagedLevelsUi } from "./support/levels-ui-stage";
import { actorOf } from "../support/sheets-stage";

/** How long a staged campaign may take: the shipped seams, driven end to end, over one database. */
const BUDGET_MS = 900_000;

afterAll(async () => {
  await closeStage();
}, 120_000);

let staging: Promise<StagedLevelsUi> | undefined;
const staged = (): Promise<StagedLevelsUi> => (staging ??= stageLevelsUi("words"));

type Group = { elementClass: string; kind: string; description: string; levelLabel: string | null; levelSlot: string | null; count: number };
type Standing = { standing: string; value: string | null; unit: string; readings: number };
type StackLevel = { levelId: string; height: { standing: string; canonicalMetres: string | null; current: readonly unknown[] } };

/** The stack as the shipped read-only door answers it — the product's own reading, not ours. */
async function stackOf(it: StagedLevelsUi): Promise<StackLevel[]> {
  const levels = await productModule<{ levelStackOf: (scope: { tenantId: string; projectId: string }) => Promise<StackLevel[]> }>("src/modules/takeoff/levels/index.ts");
  return levels.levelStackOf({ tenantId: it.tenantId, projectId: it.projectId });
}

async function standingOn(it: StagedLevelsUi, levelId: string): Promise<StackLevel["height"]> {
  const level = (await stackOf(it)).find((held) => held.levelId === levelId);
  expect(level, `the stack holds the level ${levelId}`).toBeDefined();
  return (level as StackLevel).height;
}

describe("I-446: the lines an act would re-derive arrive counted", () => {
  test("a storey height read on a bearing level counts its lines by class, kind and level, adding up to the bound ids", async () => {
    const it = await staged();
    const acts = await actsSeam();
    const shown = await acts.preview(actorOf(it.person), heightReading({ projectId: it.projectId, levelId: it.bearingLevelId, value: "3.2", unit: "m" }));

    const effects = shown["effects"] as { linesRederiving: string[]; lineGroups?: Group[] };
    const owed = lineIdsOnLevels(it, [it.bearingLevelId]);
    expect(effects.linesRederiving, "the ids are the ones the act always named (R-TO-020)").toEqual(owed);
    expect(Array.isArray(effects.lineGroups), `the seam counted them for the dialog: ${JSON.stringify(effects)}`).toBe(true);
    const groups = effects.lineGroups as Group[];
    expect(groups.reduce((sum, group) => sum + group.count, 0), "a group is a reading of the bound ids, never a filter of them").toBe(owed.length);

    const kinds = new Set(linesOf(it).map(lineRow).filter((line) => owed.includes(line.lineId)).map((line) => line.kind));
    for (const group of groups) {
      expect(group.levelLabel, "every line the reading re-derives stands on the level it reads").toBe(it.bearingLabel);
      expect(kinds.has(group.kind), `and each group is a kind the campaign published (${group.kind})`).toBe(true);
      expect(group.description.length, "said as the bill says the pair").toBeGreaterThan(0);
    }
  }, BUDGET_MS);

  test("a level no line stands on is counted as nothing, with no groups to show", async () => {
    const it = await staged();
    const acts = await actsSeam();
    const shown = await acts.preview(actorOf(it.person), heightReading({ projectId: it.projectId, levelId: it.bareLevelId, value: "3.2", unit: "m" }));
    const effects = shown["effects"] as { linesRederiving: string[]; lineGroups?: Group[] };
    expect(effects.linesRederiving, `${it.bareLabel} bears no line`).toEqual([]);
    expect(effects.lineGroups, "and nothing is counted where nothing moves — the slot says none").toBeUndefined();
  }, BUDGET_MS);
});

describe("I-445: the preview says how the level will stand, and the stack then stands so", () => {
  test("the standing before is the stack's now, the standing after is the stack's once the act lands, and the counted preview's digest commits", async () => {
    const it = await staged();
    const acts = await actsSeam();
    const actor = actorOf(it.person);
    const input = heightReading({ projectId: it.projectId, levelId: it.bearingLevelId, value: "3.175", unit: "m" });

    const now = await standingOn(it, it.bearingLevelId);
    const shown = await acts.preview(actor, input);
    const subject = (shown["subjects"] as { standing?: { before: Standing; after: Standing; recorded: { value: string; unit: string } } }[])[0];
    const standing = subject?.standing;
    expect(standing, `the reading states the level's standing, before and after: ${JSON.stringify(shown)}`).toBeDefined();
    expect(standing?.before.standing, "before: what the stack says now").toBe(now.standing);
    expect(standing?.before.value, "at the metres the stack carries now").toBe(now.canonicalMetres);
    expect(standing?.before.readings, "over the readings that stand now").toBe(now.current.length);
    expect(standing?.recorded, "and the figure the act records, in the canon's metre").toEqual({ value: "3.175", unit: "m" });

    const performed = await acts.commit(actor, input, acts.consequenceDigest(shown));
    expect(typeof performed["actId"], `the digest of the counted, standing-bearing preview commits: ${JSON.stringify(performed)}`).toBe("string");

    const then = await standingOn(it, it.bearingLevelId);
    expect(standing?.after.standing, "after: exactly what the stack says once the act has landed (B-17)").toBe(then.standing);
    expect(standing?.after.value, "at exactly the metres it then carries").toBe(then.canonicalMetres);
    expect(standing?.after.readings, "over exactly the readings that then stand").toBe(then.current.length);
  }, BUDGET_MS);
});
