/**
 * AC-1: the three new stages of the stored partition, and the placements the fifth one stores.
 *
 * Driven through the shipped job over a hand-authored artifact whose model space really carries a
 * georeferenced layout plan: nine closed column outlines, each anchored by a mark, on a grid of three
 * letter axes and three numeral axes. Every expectation is derived from the artifact that was built
 * and from the rows the earlier stages themselves left — nothing is transcribed (B-19).
 */
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import {
  COLUMN,
  EXPANSION_STAGE,
  EXPECTED_STAGES,
  LEVELS_PROPOSAL_STAGE,
  PLACEMENT_STAGE,
  REBUILD_MODULE,
  SCENARIO,
  SCHEDULES_STAGE,
  STORED_STEP,
  atPrecision,
  closeStage,
  field,
  identitySeam,
  lawfulViewKeys,
  oneViewKeyOfType,
  memberTypeRows,
  placedMembersOf,
  placementRows,
  productModule,
  runPlacementPartition,
  said,
  stagePlacementIngest,
  stagePlacementProject,
  stepNames,
  type IdentitySeam,
  type PlacementStage,
  type StagedPlacementIngest,
  type StepRecord,
  type StoreRow,
} from "../support/placement-stage";

/** One placement, as this acceptance compares one — the row's own reading of the drawing. */
type ComparablePlacement = {
  mark: string;
  markText: string;
  elementType: string;
  x: number;
  y: number;
  gridLetter: string;
  gridNumeral: string;
  outlineKey: string;
  markKey: string;
  memberFamily: string | null;
};

const LAYOUT_PLAN = "LAYOUT_PLAN";

let stage: PlacementStage;
let staged: StagedPlacementIngest;
let steps: StepRecord[];
let identity: IdentitySeam;

beforeAll(async () => {
  stage = await stagePlacementProject("stages");
  staged = await stagePlacementIngest(stage, SCENARIO.TYPICAL_RANGE, 0x21);
  steps = await runPlacementPartition(stage, staged, "stages");
  identity = await identitySeam();
}, 300_000);

afterAll(async () => {
  await closeStage();
});

/** The rows the run left for this ingest, in a comparable shape. */
function comparableOf(row: StoreRow): ComparablePlacement {
  const family = field(row, "memberFamily", "member_family");
  return {
    mark: said(row, "mark", "mark"),
    markText: said(row, "markText", "mark_text"),
    elementType: said(row, "elementType", "element_type"),
    x: atPrecision(Number(field(row, "x", "x"))),
    y: atPrecision(Number(field(row, "y", "y"))),
    gridLetter: said(row, "gridLetter", "grid_letter"),
    gridNumeral: said(row, "gridNumeral", "grid_numeral"),
    outlineKey: said(row, "outlineKey", "outline_key"),
    markKey: said(row, "markKey", "mark_key"),
    memberFamily: family === null || family === undefined ? null : String(family),
  };
}

/** Any list of placements, in one order: the outline each was read off is its own identity here. */
function byOutline<T extends { outlineKey: string }>(rows: readonly T[]): T[] {
  return [...rows].sort((left, right) => (left.outlineKey < right.outlineKey ? -1 : left.outlineKey > right.outlineKey ? 1 : 0));
}

describe("AC-1: stages and stored placements", () => {
  test("AC-1: the stage list carries placement, expansion and levels-proposal after schedules", async () => {
    const rebuild = await productModule<{ PARTITION_STAGES?: readonly string[] }>(REBUILD_MODULE);
    const stages = rebuild.PARTITION_STAGES ?? [];
    expect(Array.isArray(stages), `${REBUILD_MODULE} publishes PARTITION_STAGES`).toBe(true);
    // Every stage the increment names stands in the list, and in this order. A later leaf may append
    // a stage of its own; none of these may move (R-TO-030).
    for (const stageName of EXPECTED_STAGES) expect(stages, `PARTITION_STAGES carries ${stageName}`).toContain(stageName);
    const positions = EXPECTED_STAGES.map((stageName) => stages.indexOf(stageName));
    expect(positions, `the stages run in the order they are named: ${stages.join(", ")}`).toEqual([...positions].sort((left, right) => left - right));
  });

  test("AC-1: the run records the three steps in order, after schedules and before stored", () => {
    const recorded = stepNames(steps);
    // Every stage of the list records its own step: a stage that ran silently is a stage nobody can
    // see the result of (R-TO-030).
    for (const stageName of EXPECTED_STAGES) expect(recorded, `the run recorded a \`${stageName}\` step`).toContain(stageName);
    const order = [SCHEDULES_STAGE, PLACEMENT_STAGE, EXPANSION_STAGE, LEVELS_PROPOSAL_STAGE, STORED_STEP].map((step) => recorded.indexOf(step));
    expect(order, `the steps stand in order: ${recorded.join(", ")}`).toEqual([...order].sort((left, right) => left - right));
    expect(order.every((at) => at >= 0), `every step of the order was recorded: ${recorded.join(", ")}`).toBe(true);
  });

  test("AC-1: the layout-plan view's placements are the nine outlines their marks anchor", async () => {
    const drawn = placedMembersOf(staged.artifact);
    const rows = placementRows(stage.person.tenantId, staged.ingestId);
    expect(rows.length, `every anchored outline of the plan is placed once (the artifact drew ${drawn.length})`).toBe(drawn.length);

    // The families the ingest's own schedules named — what a placement's member_family joins to.
    const families = new Set(memberTypeRows(stage.person.tenantId, staged.ingestId).map((row) => said(row, "family", "family")));
    expect(families.size, "the ingest's schedules named at least one member family, so the join is not vacuous (AC-1)").toBeGreaterThan(0);

    const expected: ComparablePlacement[] = drawn.map((member) => ({
      mark: member.mark,
      markText: member.markText,
      elementType: COLUMN,
      x: atPrecision(member.x),
      y: atPrecision(member.y),
      gridLetter: member.gridLetter,
      gridNumeral: member.gridNumeral,
      outlineKey: member.outlineKey,
      markKey: member.markKey,
      memberFamily: families.has(member.mark) ? member.mark : null,
    }));
    // The drawing states both halves of the join: some marks the schedule names, and some it does not.
    expect(expected.some((one) => one.memberFamily !== null), "the artifact drew a mark its schedule names").toBe(true);
    expect(expected.some((one) => one.memberFamily === null), "the artifact drew a mark its schedule does not name").toBe(true);
    // And it spells one mark three ways, so a stored mark cannot be the text that was drawn.
    const spellings = drawn.filter((member) => member.mark === (drawn[0]?.mark ?? "")).map((member) => member.markText);
    expect(new Set(spellings).size, "the artifact spells one mark more than one way (AC-1: C-1, c1., C 1)").toBeGreaterThan(1);

    expect(byOutline(rows.map(comparableOf))).toEqual(byOutline(expected));
  });

  test("AC-1: every placement key is its view key, its mark and its quantised point", async () => {
    const rows = placementRows(stage.person.tenantId, staged.ingestId);
    const viewKey = await oneViewKeyOfType(stage.person.tenantId, staged.ingestId, LAYOUT_PLAN);
    const lawful = await lawfulViewKeys(identity, LAYOUT_PLAN, staged.artifact.captionKey);
    expect(lawful, `the layout-plan view's stored key is derived from its caption anchor (L-REG-04)`).toContain(viewKey);

    const cited = new Set(rows.map((row) => said(row, "viewKey", "view_key")));
    expect([...cited].length, "every placement of this ingest cites one view").toBe(1);
    expect(lawful, `a placement cites its view under a key derived from the view (it cited ${[...cited][0]})`).toContain([...cited][0]);

    for (const row of rows) {
      const key = said(row, "placementKey", "placement_key");
      const x = identity.quantise(Number(field(row, "x", "x")));
      const y = identity.quantise(Number(field(row, "y", "y")));
      expect(key, `the placement of ${said(row, "markText", "mark_text")} keys on its view, its mark and its quantised point (L-REG-04)`).toBe(
        `${said(row, "viewKey", "view_key")}|${said(row, "mark", "mark")}|${x},${y}`,
      );
    }
    expect(new Set(rows.map((row) => said(row, "placementKey", "placement_key"))).size, "no two placements of one view share a key").toBe(rows.length);
  });
});
