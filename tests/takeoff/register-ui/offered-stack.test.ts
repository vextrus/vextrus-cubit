/**
 * The offered level stack is confirmed by its KEY, and the server resolves what the key names
 * (L-ACT-02: "bulk is offered, never assembled … typed grouping key over a closed enum + resolved
 * membership in the Consequence"; L-MEA-07; D-001).
 *
 * Before this door existed, the register handed the browser the offer's `{ label, ordinal }` list and
 * the browser posted that list back as the act's input. The readings the drawing stated for each
 * level were dropped on the way: a J-000 run stored F-RCC6-BNBC's `GF 132 in @1D90` proposal and still
 * stood GF at 3.353 m on one reading. The same door also took any `readings` a client made up, citing
 * any source key it liked.
 *
 * Every door is called here as a signed-in person, the way the screens call them: the register's
 * reading, INSERT_LEVEL's pair, AUTHOR_STOREY_HEIGHT's pair and the levels reading. The offer is
 * staged as the partition's seventh stage writes it, from the COMMITTED DXF's own section texts
 * (`../partition/support/section-texts`), through the partition's one writer
 * (`rewritePartition`). Nothing is typed in beside the drawing. The rosters the figures come from
 * are named at each assertion: F-RCC6-BNBC's S-25 (AM-01's M3 yardstick) and F-RCC6's section A-A
 * (the frozen v1.1 fixture).
 */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { exact } from "@/core/units/canon";
import { rcc6Section, s25Section, type Section } from "../partition/support/section-texts";
import {
  INSERT_LEVEL,
  PLACEMENT_DOOR_MODULE,
  PROPOSED_LEVEL_STACK,
  SCENARIO,
  STOREY_HEIGHT_READINGS,
  TRANSCRIBED,
  actRowsOf,
  closeStage,
  field,
  levelRowsOf,
  pinRevisionNaming,
  productModule,
  said,
  stagePlacementIngest,
  stagePlacementProject,
  storeRows,
  type PlacementStage,
  type StagedPlacementIngest,
} from "../partition/support/placement-stage";
import { door, heightReading, previewed, refusalOf, takeoffCaller, type TakeoffCaller } from "../levels-ui/support/levels-ui-stage";

const BUDGET_MS = 900_000;

/** The partition's one writer: every stage's rows for one record, in one transaction. */
const PARTITION_STORE_MODULE = "src/modules/takeoff/partition/store.ts";

/** The refusals this door answers with, by name. */
const REQUEST_MALFORMED = "REQUEST_MALFORMED";
const GROUP_NOT_OFFERED = "GROUP_NOT_OFFERED";

/** How a storey height stands over its readings (L-MEA-07). */
const AGREED = "AGREED";
const NONE = "NONE";

/** F-RCC6-BNBC S-25's imperial mark beside GF (`P.L= +0'-0"`), which states GF's height in inches (D-001). */
const GF_IMPERIAL_MARK = "DXF_HANDLE:1D90";

/** The key an offered stack is confirmed by (`LevelStackGroupKey`). */
type StackKey = { kind: string; drawingId: string; ingestId: string };

/** One level of the levels reading, and one reading of its height, as S-Levels renders them. */
type ViewReading = { basis: string; sourceKey: string | null; valueAsWritten: string; unitAsWritten: string; canonicalMetres: string; superseded: boolean };
type ViewLevel = { levelId: string; label: string; ordinal: number; standing: string; canonicalMetres: string | null; readings: ViewReading[] };

type PartitionStore = { rewritePartition: (write: Record<string, unknown>) => Promise<unknown> };
type ProposalDoor = {
  proposedLevelStackOf: (scope: { tenantId: string; projectId: string; drawingId: string }) => Promise<{ group: StackKey; levels: { label: string; ordinal: number; readings?: unknown[] }[] } | null>;
};

/**
 * One record's partition, standing, whose seventh stage proposed what this section states. It goes
 * through the partition's own writer, so `proposed_levels` and the rebuild marker land together, as a
 * rebuild writes them.
 */
async function stageOffer(stage: PlacementStage, ingest: StagedPlacementIngest, section: Section | null): Promise<void> {
  const store = await productModule<PartitionStore>(PARTITION_STORE_MODULE);
  await store.rewritePartition({
    tenantId: stage.person.tenantId,
    projectId: stage.projectId,
    drawingId: ingest.drawingId,
    ingestId: ingest.ingestId,
    views: section === null ? [] : [section.view],
    assignments: new Map(),
    proposals: new Map(),
    conventions: null,
    grid: null,
    schedules: null,
    placements: null,
    expansion: null,
    proposal: section === null ? null : section.stack,
  });
}

/** The live stack as S-Levels reads it, through the lane's `levels` door. */
async function levelsRead(caller: TakeoffCaller, projectId: string): Promise<ViewLevel[]> {
  const answer = (await door(caller, "levels")({ projectId })) as { stack?: ViewLevel[] };
  return answer.stack ?? [];
}

/** One level of the stack by label, asserted present. */
function levelLabelled(stack: readonly ViewLevel[], label: string): ViewLevel {
  const found = stack.find((level) => level.label === label);
  expect(found, `the stack carries ${label} (it carries ${stack.map((level) => level.label).join(", ")})`).toBeTruthy();
  return found as ViewLevel;
}

/** Every storey-height reading one project holds, straight off the store. */
function readingRowsOfProject(stage: PlacementStage): Record<string, unknown>[] {
  return storeRows(STOREY_HEIGHT_READINGS, stage.person.tenantId).filter((row) => said(row, "projectId", "project_id") === stage.projectId);
}

/** Every `levels` row one project holds, straight off the store. */
function levelRowsOfProject(stage: PlacementStage): Record<string, unknown>[] {
  return levelRowsOf(stage.person.tenantId).filter((row) => said(row, "projectId", "project_id") === stage.projectId);
}

afterAll(async () => {
  await closeStage();
}, 120_000);

describe("F-RCC6-BNBC S-25: the offered stack, confirmed by its key, carries the readings the drawing stated", () => {
  const S25 = s25Section();
  let stage: PlacementStage;
  let staged: StagedPlacementIngest;
  let silent: StagedPlacementIngest;
  let caller: TakeoffCaller;
  let key: StackKey;

  beforeAll(async () => {
    stage = await stagePlacementProject("offered-stack-bnbc");
    staged = await stagePlacementIngest(stage, SCENARIO.SECTIONS, 0x3101);
    await stageOffer(stage, staged, S25);
    // A second drawing of the same project whose partition stands and proposes no stack.
    silent = await stagePlacementIngest(stage, SCENARIO.SECTIONS, 0x3102);
    await stageOffer(stage, silent, null);
    await pinRevisionNaming(stage, staged.drawingId);
    caller = await takeoffCaller(stage.person);
  }, BUDGET_MS);

  test("the register hands the browser the offer's key and its count, and never its levels", async () => {
    const view = (await door(caller, "register")({ projectId: stage.projectId })) as { levelStacks?: Record<string, unknown>[] };
    const stacks = view.levelStacks ?? [];
    expect(stacks.length, `the pinned revision's one drawing offers one stack: ${JSON.stringify(stacks)}`).toBe(1);
    const offered = stacks[0] as Record<string, unknown>;
    expect(offered["key"], "keyed on the fact judged — the drawing and the reading of it the stack was read out of (L-ACT-02)").toStrictEqual({
      kind: PROPOSED_LEVEL_STACK,
      drawingId: staged.drawingId,
      ingestId: staged.ingestId,
    });
    expect(offered["count"], "S-25 states eight storeys, once each (T-NOT-LEVEL)").toBe(S25.proposed.length);
    expect(Object.hasOwn(offered, "levels"), "a list the browser could post back as the stack is not handed to it").toBe(false);
    key = offered["key"] as StackKey;
  }, BUDGET_MS);

  test("a reading a client states beside a level is refused REQUEST_MALFORMED, never trusted — and nothing is written", async () => {
    const invented = { valueAsWritten: "11", unitAsWritten: "ft", sourceKey: GF_IMPERIAL_MARK };
    const handed = { type: INSERT_LEVEL, projectId: stage.projectId, levels: [{ label: "GF", ordinal: 0, readings: [invented] }] };

    const shown = await refusalOf(() => door(caller, "previewInsertLevel")({ input: handed }), "takeoff.previewInsertLevel with a client-stated reading");
    expect(shown.code, `the one zod schema refuses it by name: ${shown.said}`).toBe(REQUEST_MALFORMED);
    expect(shown.said, "and the operator detail names the field it would not read").toContain("readings");

    const committed = await refusalOf(() => door(caller, "commitInsertLevel")({ input: handed, consequenceDigest: "0".repeat(64) }), "takeoff.commitInsertLevel with a client-stated reading");
    expect(committed.code, `the commit reads the same schema: ${committed.said}`).toBe(REQUEST_MALFORMED);

    // Not even beside the key: a statement naming the offer AND a list of its own is not an insert.
    const both = { type: INSERT_LEVEL, projectId: stage.projectId, group: key, levels: [{ label: "GF", ordinal: 0 }] };
    const mixed = await refusalOf(() => door(caller, "previewInsertLevel")({ input: both }), "takeoff.previewInsertLevel naming a group and levels");
    expect(mixed.code, `exactly one of the two statements: ${mixed.said}`).toBe(REQUEST_MALFORMED);

    expect(levelRowsOfProject(stage).length, "no level was authored").toBe(0);
    expect(readingRowsOfProject(stage).length, "and no reading was written").toBe(0);
  }, BUDGET_MS);

  test("a key whose offer no longer stands is GROUP_NOT_OFFERED, by name — never an empty act", async () => {
    // Another reading of the drawing: the key names an ingest that is not the one its offer stands on.
    const elsewhere = { ...key, ingestId: silent.ingestId };
    // A drawing of the project whose partition stands and proposes no stack at all.
    const unproposed = { kind: PROPOSED_LEVEL_STACK, drawingId: silent.drawingId, ingestId: silent.ingestId };
    // A record nobody has ever read.
    const unread = { ...key, ingestId: randomUUID() };

    for (const [named, group] of [["another ingest", elsewhere], ["a partition proposing no stack", unproposed], ["a record nobody read", unread]] as const) {
      const input = { type: INSERT_LEVEL, projectId: stage.projectId, group };
      const shown = await refusalOf(() => door(caller, "previewInsertLevel")({ input }), `takeoff.previewInsertLevel over ${named}`);
      expect(shown.code, `the preview over ${named} is refused by name: ${shown.said}`).toBe(GROUP_NOT_OFFERED);
      const committed = await refusalOf(() => door(caller, "commitInsertLevel")({ input, consequenceDigest: "0".repeat(64) }), `takeoff.commitInsertLevel over ${named}`);
      expect(committed.code, `and so is the commit: ${committed.said}`).toBe(GROUP_NOT_OFFERED);
    }
    expect(levelRowsOfProject(stage).length, "no level was authored by any of them").toBe(0);
    expect(actRowsOf(stage.person.tenantId).filter((row) => said(row, "actType", "act_type") === INSERT_LEVEL).length, "and no act was written").toBe(0);
  }, BUDGET_MS);

  test("confirming by the key authors the stack with GF's imperial reading: 132 in, cited to 1D90, worth 3.3528 m", async () => {
    const offer = await (await productModule<ProposalDoor>(PLACEMENT_DOOR_MODULE)).proposedLevelStackOf({ tenantId: stage.person.tenantId, projectId: stage.projectId, drawingId: staged.drawingId });
    expect(offer, "the partition offers S-25's stack").not.toBeNull();
    const offered = (offer as NonNullable<typeof offer>).levels;

    const input = { type: INSERT_LEVEL, projectId: stage.projectId, group: key };
    const shown = previewed(await door(caller, "previewInsertLevel")({ input }), "takeoff.previewInsertLevel by key");
    const subjects = (shown.consequence["subjects"] ?? []) as { subjectLabel: string }[];
    expect(subjects.map((subject) => subject.subjectLabel), "the Consequence names every level of the offer, in the order it stands").toEqual(offered.map((level) => level.label));

    await door(caller, "commitInsertLevel")({ input, consequenceDigest: shown.consequenceDigest });
    expect(actRowsOf(stage.person.tenantId).filter((row) => said(row, "actType", "act_type") === INSERT_LEVEL).length, "one act — the stack is confirmed whole (L-ACT-01)").toBe(1);

    const stack = await levelsRead(caller, stage.projectId);
    expect(stack.map((level) => [level.label, level.ordinal]), "the stack stands as S-25 states it").toEqual(offered.map((level) => [level.label, level.ordinal]));

    const gf = levelLabelled(stack, "GF");
    expect(gf.readings.length, "GF arrives carrying the one reading the drawing states for it").toBe(1);
    const imperial = gf.readings[0] as ViewReading;
    expect(
      { basis: imperial.basis, sourceKey: imperial.sourceKey, valueAsWritten: imperial.valueAsWritten, unitAsWritten: imperial.unitAsWritten },
      "S-25's P.L= +0'-0\" → EL +11'-0\": 132 in, as written, cited to GF's own imperial mark (D-001, T-NOT-LEVEL)",
    ).toStrictEqual({ basis: TRANSCRIBED, sourceKey: GF_IMPERIAL_MARK, valueAsWritten: "132", unitAsWritten: "in" });
    expect(imperial.canonicalMetres, "which is exactly 3.3528 m — F-RCC6-BNBC model.json's GF storey").toBe("3.3528");
    expect(gf.standing, "one reading, so GF already stands agreed").toBe(AGREED);
    expect(gf.canonicalMetres, "at that height").toBe("3.3528");

    for (const level of stack.filter((held) => held.label !== "GF")) {
      expect(level.readings, `${level.label}'s metric mark writes no unit, so nothing is read for it yet (B-07)`).toEqual([]);
      expect(level.standing, `and ${level.label}'s height stands unstated`).toBe(NONE);
    }
  }, BUDGET_MS);

  test("transcribing 3.353 m off 1F's mark, as J-000 does, leaves GF AGREED at 3.3528 on two readings", async () => {
    // What J-000's walk transcribes for GF: the distance to the mark above, in the metres the section's
    // EL figures are printed in, citing that mark. Derived from S-25's own marks.
    const [ground, first] = S25.proposed as [(typeof S25.proposed)[number], (typeof S25.proposed)[number]];
    const printed = exact(first.elevation).sub(ground.elevation).toString();
    expect([printed, first.markKey], "S-25 prints 1F at +3.353, on the mark 1D4C").toEqual(["3.353", "DXF_HANDLE:1D4C"]);

    const before = await levelsRead(caller, stage.projectId);
    const gfId = levelLabelled(before, "GF").levelId;
    const input = heightReading({ projectId: stage.projectId, levelId: gfId, value: printed, unit: "m", basis: TRANSCRIBED, sourceKey: first.markKey });
    const shown = previewed(await door(caller, "previewAuthorStoreyHeight")({ input }), "takeoff.previewAuthorStoreyHeight");
    await door(caller, "commitAuthorStoreyHeight")({ input, consequenceDigest: shown.consequenceDigest });

    const gf = levelLabelled(await levelsRead(caller, stage.projectId), "GF");
    expect(gf.readings.filter((reading) => !reading.superseded).length, "two current readings: the section's metric print and its imperial design").toBe(2);
    const bySource = new Map(gf.readings.map((reading) => [reading.sourceKey, reading.canonicalMetres]));
    expect(bySource.get(first.markKey), "the metric print is worth what it says").toBe("3.353");
    expect(bySource.get(GF_IMPERIAL_MARK), "the imperial design is worth 11'-0\"").toBe("3.3528");
    expect(gf.standing, "they agree at the three places +3.353 is printed to (D-001), so GF is agreed, not contested").toBe(AGREED);
    expect(gf.canonicalMetres, "and it stands at the finer print — the storey F-RCC6-BNBC's model states").toBe("3.3528");
  }, BUDGET_MS);
});

describe("F-RCC6 section A-A: its offer carries no reading, so confirming it by key writes what the list did", () => {
  const RCC6 = rcc6Section();
  let stage: PlacementStage;
  let staged: StagedPlacementIngest;
  let caller: TakeoffCaller;

  beforeAll(async () => {
    stage = await stagePlacementProject("offered-stack-rcc6");
    staged = await stagePlacementIngest(stage, SCENARIO.SECTIONS, 0x3103);
    await stageOffer(stage, staged, RCC6);
    caller = await takeoffCaller(stage.person);
  }, BUDGET_MS);

  test("the same Consequence and digest as the register's old { label, ordinal } post, the same levels, and no reading", async () => {
    const offer = await (await productModule<ProposalDoor>(PLACEMENT_DOOR_MODULE)).proposedLevelStackOf({ tenantId: stage.person.tenantId, projectId: stage.projectId, drawingId: staged.drawingId });
    expect(offer, "F-RCC6's section offers its stack").not.toBeNull();
    const { group, levels } = offer as NonNullable<typeof offer>;
    expect(levels.flatMap((level) => level.readings ?? []), "F-RCC6's marks write no unit, so the offer carries no reading at all").toEqual([]);

    // What the register used to post: the offer's labels and ordinals, and nothing else.
    const list = { type: INSERT_LEVEL, projectId: stage.projectId, levels: levels.map((level) => ({ label: level.label, ordinal: level.ordinal })) };
    const byKey = { type: INSERT_LEVEL, projectId: stage.projectId, group };
    const listed = previewed(await door(caller, "previewInsertLevel")({ input: list }), "takeoff.previewInsertLevel by list");
    const keyed = previewed(await door(caller, "previewInsertLevel")({ input: byKey }), "takeoff.previewInsertLevel by key");
    expect(keyed.consequence, "the key resolves to exactly the Consequence the list stated").toStrictEqual(listed.consequence);
    expect(keyed.consequenceDigest, "under the same digest").toBe(listed.consequenceDigest);

    // The commit by KEY carries the LIST's digest: the act it writes is the act the old path described.
    await door(caller, "commitInsertLevel")({ input: byKey, consequenceDigest: listed.consequenceDigest });
    const written = levelRowsOfProject(stage)
      .map((row) => [said(row, "label", "label"), Number(field(row, "ordinal", "ordinal"))])
      .sort((left, right) => (left[1] as number) - (right[1] as number));
    expect(written, "the eight levels of section A-A, at the ordinals the section stacks them in").toEqual(levels.map((level) => [level.label, level.ordinal]));
    expect(readingRowsOfProject(stage).length, "and not one storey-height reading — byte for byte what the list wrote").toBe(0);
  }, BUDGET_MS);
});
