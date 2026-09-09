/**
 * AC-7: the machine proposes a STACK, never a level.
 *
 * The seventh stage reads a long section's level marks into `proposed_levels` — never into `levels` —
 * and the module door offers them as ONE `INSERT_LEVEL` input. Every expectation is derived from the
 * marks the artifact really drew: the labels they say, the elevations they stand at and the storey
 * heights those elevations come to (B-19).
 */
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import {
  HEIGHT_UNIT,
  LEVELS_PROPOSAL_STAGE,
  PLACEMENT_DOOR_MODULE,
  PROPOSED_LEVELS,
  PROPOSED_LEVEL_STACK,
  SCENARIO,
  STOREY_HEIGHT,
  TRANSCRIBED,
  closeStage,
  field,
  insertion,
  levelRowsOf,
  levelsOfProject,
  ordered,
  performAct,
  productModule,
  proposedLevelRows,
  readingRowsOf,
  runPlacementPartition,
  said,
  stagePlacementIngest,
  stagePlacementProject,
  stepDetail,
  tableStands,
  type PlacementStage,
  type ProposedLevel,
  type StagedPlacementIngest,
  type StepRecord,
} from "../support/placement-stage";

/** What the door answers for a drawing whose sections were read (AC-7). */
type ProposedStack = { group: { kind: string; drawingId: string; ingestId: string }; levels: readonly ProposedLevel[] } | null;

/** The door the levels editor is offered the proposed stack through. */
type ProposalDoor = { proposedLevelStackOf: (scope: { tenantId: string; projectId: string; drawingId: string }) => Promise<ProposedStack> };

let stage: PlacementStage;
let staged: StagedPlacementIngest;
let plain: StagedPlacementIngest;
let steps: StepRecord[];
let door: ProposalDoor;

/** The stack the drawing itself states: label, ordinal by ascending elevation, and storey height. */
function drawnStack(): { label: string; ordinal: number; markKey: string; height: number | null }[] {
  const marks = [...staged.artifact.levelMarks].sort((left, right) => left.elevation - right.elevation);
  return marks.map((mark, index) => ({
    label: mark.label,
    ordinal: index,
    markKey: mark.markKey,
    height: index + 1 < marks.length ? (marks[index + 1] as { elevation: number }).elevation - mark.elevation : null,
  }));
}

beforeAll(async () => {
  stage = await stagePlacementProject("levels-proposal");
  staged = await stagePlacementIngest(stage, SCENARIO.SECTIONS, 0x26);
  steps = await runPlacementPartition(stage, staged, "levels-proposal");
  plain = await stagePlacementIngest(stage, SCENARIO.TYPICAL_RANGE, 0x27);
  await runPlacementPartition(stage, plain, "levels-proposal-plain");
  door = await productModule<ProposalDoor>(PLACEMENT_DOOR_MODULE);
  expect(typeof door.proposedLevelStackOf, `${PLACEMENT_DOOR_MODULE} publishes \`proposedLevelStackOf\``).toBe("function");
}, 600_000);

afterAll(async () => {
  await closeStage();
});

describe("AC-7: the machine proposes a stack, never a level", () => {
  test("AC-7: the section's level marks land in proposed_levels, and no level is authored", () => {
    expect(tableStands(PROPOSED_LEVELS), `the product's migration lane lands public.${PROPOSED_LEVELS}`).toBe(true);
    const drawn = drawnStack();
    const rows = proposedLevelRows(stage.person.tenantId, staged.ingestId);
    expect(rows.length, `one proposed level per level mark the section drew (${drawn.length})`).toBe(drawn.length);

    const comparable = rows
      .map((row) => ({
        label: said(row, "label", "label"),
        ordinal: Number(field(row, "ordinal", "ordinal")),
        markKey: said(row, "markKey", "mark_key"),
        height: field(row, "heightAsWritten", "height_as_written") === null || field(row, "heightAsWritten", "height_as_written") === undefined ? null : Number(field(row, "heightAsWritten", "height_as_written")),
        unit: field(row, "heightUnit", "height_unit") === null || field(row, "heightUnit", "height_unit") === undefined ? null : said(row, "heightUnit", "height_unit"),
      }))
      .sort((left, right) => left.ordinal - right.ordinal);

    expect(comparable.map((row) => row.label), "the labels the marks say, ordered by the elevation they stand at").toEqual(drawn.map((level) => level.label));
    expect(comparable.map((row) => row.ordinal), "ordinals run from zero up the section").toEqual(drawn.map((level) => level.ordinal));
    expect(comparable.map((row) => row.markKey), "each row cites the level mark it was read off (L-CAD-03)").toEqual(drawn.map((level) => level.markKey));
    for (const [index, level] of drawn.entries()) {
      const row = comparable[index] as { height: number | null; unit: string | null };
      if (level.height === null) {
        expect(row.height, `${level.label} is the top of the section: it states no storey height`).toBeNull();
        expect(row.unit, `${level.label} states no unit either`).toBeNull();
      } else {
        expect(row.height, `${level.label} stands ${level.height} below the level above it`).toBeCloseTo(level.height, 6);
        expect(row.unit, "the unit the mark was written in is kept as written (B-07)").toBe(HEIGHT_UNIT);
      }
    }
    // The drawing's own arithmetic and the contract's spelling of it agree.
    expect((drawn[0] as { height: number }).height.toFixed(2), "the section states a storey height of 3.05").toBe(STOREY_HEIGHT);

    expect(levelRowsOf(stage.person.tenantId).filter((row) => said(row, "projectId", "project_id") === stage.projectId), "a proposal authors nothing: the level stack is a human's (L-ACT-03)").toEqual([]);
    const detail = stepDetail(steps, LEVELS_PROPOSAL_STAGE);
    expect(Number(detail["proposed"]), "the step reports the levels it proposed").toBe(rows.length);
  });

  test("AC-7: the door offers the whole stack as one INSERT_LEVEL input", async () => {
    const answered = await door.proposedLevelStackOf({ tenantId: stage.person.tenantId, projectId: stage.projectId, drawingId: staged.drawingId });
    expect(answered, "the drawing's sections were read, so a stack is offered").not.toBeNull();
    const stack = answered as NonNullable<ProposedStack>;
    expect(stack.group.kind, "the group is the closed kind this offer is made under (L-ACT-02)").toBe(PROPOSED_LEVEL_STACK);
    expect(stack.group.drawingId, "the group names the drawing it was read off").toBe(staged.drawingId);
    expect(stack.group.ingestId, "and the record it was read from").toBe(staged.ingestId);

    const drawn = drawnStack();
    expect(stack.levels.length, "one proposed level per mark — a stack is offered whole (R-UI-023)").toBe(drawn.length);
    expect(stack.levels.map((level) => level.label), "the labels of the marks, in the order they stand").toEqual(drawn.map((level) => level.label));
    expect(stack.levels.map((level) => level.ordinal), "and the ordinals the section gives them").toEqual(drawn.map((level) => level.ordinal));
    for (const [index, level] of drawn.entries()) {
      const readings = (stack.levels[index] as ProposedLevel).readings ?? [];
      if (level.height === null) {
        expect(readings.length, `${level.label} carries no reading: the section states no height for it`).toBe(0);
        continue;
      }
      expect(readings.length, `${level.label} carries the reading the section states`).toBe(1);
      const reading = readings[0] as { valueAsWritten: string; unitAsWritten: string; sourceKey: string };
      expect(Number(reading.valueAsWritten), "the value as the section wrote it").toBeCloseTo(level.height, 6);
      expect(reading.unitAsWritten, "the unit as the section wrote it").toBe(HEIGHT_UNIT);
      expect(reading.sourceKey, "and the entity it was read off (L-CAD-03)").toBeTruthy();
    }
  });

  test("AC-7: a drawing with no section view answers null", async () => {
    const answered = await door.proposedLevelStackOf({ tenantId: stage.person.tenantId, projectId: stage.projectId, drawingId: plain.drawingId });
    expect(answered, "a plan-only drawing proposes no stack — an absence, never an empty offer").toBeNull();
    expect(proposedLevelRows(stage.person.tenantId, plain.ingestId), "and it stores no proposed level").toEqual([]);
  });

  test("AC-7: committing the offer as one INSERT_LEVEL mints the stack and its readings", async () => {
    const answered = await door.proposedLevelStackOf({ tenantId: stage.person.tenantId, projectId: stage.projectId, drawingId: staged.drawingId });
    const stack = answered as NonNullable<ProposedStack>;
    await performAct(stage.actor, insertion(stage.projectId, stack.levels));

    const drawn = drawnStack();
    const authored = levelsOfProject(stage);
    expect(ordered(authored.map((level) => level.label)), "one act, N levels (L-ACT-02: bulk is offered, never assembled)").toEqual(ordered(drawn.map((level) => level.label)));

    const owed = drawn.filter((level) => level.height !== null);
    const readings = readingRowsOf(stage.person.tenantId).filter((row) => said(row, "projectId", "project_id") === stage.projectId);
    expect(readings.length, "one reading per level the section states a height for").toBe(owed.length);
    expect(new Set(readings.map((row) => said(row, "basis", "basis"))), "a reading off the drawing is transcribed (L-REG-02)").toEqual(new Set([TRANSCRIBED]));
    for (const row of readings) {
      expect(Number(field(row, "canonicalMetres", "canonical_metres")), "carried to canonical metres (B-07)").toBeCloseTo(Number(STOREY_HEIGHT), 6);
    }
  });
});
