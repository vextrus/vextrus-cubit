/**
 * AC-3 — the nine doors of the takeoff lane this screen presses, each behind `authorize()` and one
 * zod schema, each refusing BY NAME (L-ACT-02, L-ACT-03, R-UI-021, ARCH-03, the door law).
 *
 * Every door is driven as a signed-in person reaches it, which is how the screen reaches it. What is
 * judged is the answer: the reading the workspace renders, and the code a refusal carries with the
 * facts the law says it names. The roll-up counts and the stack's order are derived from the store
 * and from the shipped read-only door, never typed beside them (B-19, B-17).
 */
import { afterAll, describe, expect, test } from "vitest";
import {
  ACT_CHANGES_NOTHING,
  AUTHOR_LEVEL_STACK,
  AUTHOR_PROJECT_FACT,
  AUTHOR_STOREY_HEIGHT,
  INSERT_LEVEL,
  MEASURE,
  MEASURER,
  PERMISSION_NOT_HELD,
  REPUDIATE_LEVEL,
  REQUEST_MALFORMED,
  REVIEWER,
  closeStage,
  door,
  field,
  heightReading,
  insertion,
  lineRow,
  linesOf,
  liveStack,
  previewed,
  refusalOf,
  repudiation,
  stageLevelsUi,
  stageParticipant,
  stageStranger,
  takeoffCaller,
  type StagedLevelsUi,
} from "./support/levels-ui-stage";
import { TYPICAL_RANGE_UNSTATED } from "./support/levels-ui-view";

const BUDGET_MS = 900_000;

afterAll(async () => {
  await closeStage();
}, 120_000);

let staging: Promise<StagedLevelsUi> | undefined;
const staged = (): Promise<StagedLevelsUi> => (staging ??= stageLevelsUi("doors"));

/** One level of the answered view, however the reading spells its fields. */
function viewLevel(row: Record<string, unknown>): { levelId: string; ordinal: number; rollups: Record<string, unknown>[] } {
  return {
    levelId: String(field(row, "levelId", "level_id")),
    ordinal: Number(field(row, "ordinal", "ordinal")),
    rollups: ((field(row, "rollups", "rollups") ?? []) as Record<string, unknown>[]) ?? [],
  };
}

describe("AC-3: the reading door answers the LevelsView", () => {
  test("AC-3: `levels` answers the stack in ordinal order with its roll-ups, and the unstated ranges", async () => {
    const it = await staged();
    const caller = await takeoffCaller(it.person);
    const answer = (await door(caller, "levels")({ projectId: it.projectId })) as Record<string, unknown>;

    const stack = ((answer["stack"] ?? []) as Record<string, unknown>[]).map(viewLevel);
    const live = await liveStack(it);
    expect(
      stack.map((level) => level.levelId),
      "the reading answers the LIVE stack, in the order it physically stands in (L-MEA-07)",
    ).toEqual(live.map((level) => level.levelId));
    expect([...stack.map((level) => level.ordinal)].sort((a, b) => a - b), "which is ordinal order").toEqual(stack.map((level) => level.ordinal));

    /* The roll-up of each level states the STORED lines of the objects standing on it — the count is
       read off the campaign's own lines, never re-derived here or there (I-241). */
    const linesPerLevel = new Map<string, number>();
    for (const line of linesOf(it).map(lineRow)) {
      const levelId = it.objectLevels[line.objectKey];
      if (levelId !== undefined) linesPerLevel.set(`${levelId}|${line.kind}`, (linesPerLevel.get(`${levelId}|${line.kind}`) ?? 0) + 1);
    }
    expect(linesPerLevel.size, "the stage published lines, so a roll-up has something to state").toBeGreaterThan(0);
    for (const level of stack) {
      for (const held of level.rollups) {
        const kind = String(field(held, "kind", "kind"));
        expect(Number(field(held, "lines", "lines")), `${level.levelId}'s ${kind} roll-up counts the stored lines of the objects standing on it`).toBe(
          linesPerLevel.get(`${level.levelId}|${kind}`) ?? 0,
        );
      }
    }

    const ranges = (answer["unstatedRanges"] ?? null) as Record<string, unknown>[] | null;
    expect(Array.isArray(ranges), `the reading answers the views with no typical range as a list: ${JSON.stringify(answer["unstatedRanges"])}`).toBe(true);
    for (const range of ranges ?? []) {
      expect(String(field(range, "code", "code")), "each under the code the partition defers it by").toBe(TYPICAL_RANGE_UNSTATED);
      expect(String(field(range, "viewKey", "view_key")).length, "and each naming the view it stands for").toBeGreaterThan(0);
    }
  }, BUDGET_MS);

  test("AC-3: a statement missing projectId is a refusal by name, never a 500", async () => {
    const it = await staged();
    const caller = await takeoffCaller(it.person);
    for (const name of ["levels", "previewRepudiateLevel", "previewAuthorStoreyHeight", "previewAuthorTypicalRange"]) {
      const refused = await refusalOf(() => door(caller, name)(name === "levels" ? {} : { input: {} }), `takeoff.${name} with no projectId`);
      expect(refused.code, `takeoff.${name} parses its statement through one zod schema: ${refused.said}`).toBe(REQUEST_MALFORMED);
    }
  }, BUDGET_MS);

  test("AC-3: a person who is no member of the project is refused the reading", async () => {
    const it = await staged();
    const stranger = await stageStranger("levels");
    const caller = await takeoffCaller(stranger);
    const refused = await refusalOf(() => door(caller, "levels")({ projectId: it.projectId }), "takeoff.levels as a non-member");
    expect(refused.code, `every entry point resolves participation before it reads: ${refused.said}`).not.toBeNull();
  }, BUDGET_MS);
});

describe("AC-3: the act doors refuse the permission they need, by name", () => {
  test("AC-3: a MEASURER may not move the level stack", async () => {
    const it = await staged();
    const measurer = await stageParticipant(it, `measurer-${it.projectId.slice(0, 8)}`, MEASURER);
    const caller = await takeoffCaller(measurer);
    const live = await liveStack(it);

    const asked: readonly [string, Record<string, unknown>, string][] = [
      ["previewInsertLevel", insertion(it.projectId, [{ label: "MEZZ", ordinal: 1 }]), INSERT_LEVEL],
      ["previewRepudiateLevel", repudiation(it.projectId, (live[0] as { levelId: string }).levelId), REPUDIATE_LEVEL],
    ];
    for (const [name, input, actType] of asked) {
      const refused = await refusalOf(() => door(caller, name)({ input }), `takeoff.${name} as a MEASURER`);
      expect(refused.code, `takeoff.${name} is refused by name: ${refused.said}`).toBe(PERMISSION_NOT_HELD);
      expect(refused.said, `and the refusal names the act ${actType} it refused`).toContain(actType);
      expect(refused.said, `and the permission ${AUTHOR_LEVEL_STACK} that would have carried it`).toContain(AUTHOR_LEVEL_STACK);
    }
  }, BUDGET_MS);

  test("AC-3: a REVIEWER may neither read a height nor state a typical range", async () => {
    const it = await staged();
    const reviewer = await stageParticipant(it, `reviewer-${it.projectId.slice(0, 8)}`, REVIEWER);
    const caller = await takeoffCaller(reviewer);

    const height = await refusalOf(
      () => door(caller, "previewAuthorStoreyHeight")({ input: heightReading({ projectId: it.projectId, levelId: it.bearingLevelId, value: "3.2", unit: "m" }) }),
      "takeoff.previewAuthorStoreyHeight as a REVIEWER",
    );
    expect(height.code, `refused by name: ${height.said}`).toBe(PERMISSION_NOT_HELD);
    expect(height.said, `naming the act ${AUTHOR_STOREY_HEIGHT}`).toContain(AUTHOR_STOREY_HEIGHT);
    expect(height.said, `and the permission ${AUTHOR_PROJECT_FACT}`).toContain(AUTHOR_PROJECT_FACT);

    const range = await refusalOf(
      () => door(caller, "previewAuthorTypicalRange")({ input: { projectId: it.projectId, viewKey: "PLAN:S-102:t:4", fromLevelId: it.bearingLevelId, toLevelId: it.bareLevelId } }),
      "takeoff.previewAuthorTypicalRange as a REVIEWER",
    );
    expect(range.code, `refused by name: ${range.said}`).toBe(PERMISSION_NOT_HELD);
    expect(range.said, `and naming the permission ${MEASURE} a typical range needs`).toContain(MEASURE);
  }, BUDGET_MS);

  test("AC-3: repudiating a level twice is refused by the seam as a nothing-moving act", async () => {
    const it = await staged();
    const caller = await takeoffCaller(it.person);
    const input = repudiation(it.projectId, it.bareLevelId);

    const shown = previewed(await door(caller, "previewRepudiateLevel")({ input }), "takeoff.previewRepudiateLevel");
    await door(caller, "commitRepudiateLevel")({ input, consequenceDigest: shown.consequenceDigest });
    expect(
      (await liveStack(it)).map((level) => level.levelId),
      "the level a person judged to be nothing stands in the live stack no longer",
    ).not.toContain(it.bareLevelId);

    const again = await refusalOf(() => door(caller, "previewRepudiateLevel")({ input }), "takeoff.previewRepudiateLevel on a level already repudiated");
    expect(again.code, `a preview whose Consequence moves nothing is refused at the seam: ${again.said}`).toBe(ACT_CHANGES_NOTHING);
  }, BUDGET_MS);
});
