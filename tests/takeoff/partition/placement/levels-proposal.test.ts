/**
 * AC-7: the machine proposes a STACK, never a level.
 *
 * The seventh stage reads a long section's level marks into `proposed_levels` — never into `levels` —
 * and the module door offers them as ONE `INSERT_LEVEL` input. Every expectation is derived from the
 * marks the artifact really drew: the labels they say, the elevations they stand at and the storey
 * heights those elevations come to (B-19).
 *
 * A storey height is a DISTANCE, so it is graded over two sections: the one the criterion spells,
 * whose marks stand evenly apart, and a second whose marks do not (`UNEVEN_LEVEL_MARKS` — differences
 * 3.05, 3.45, 2.65). Each height, each offered reading and each committed canonical metre is compared
 * to ITS OWN level's distance to the level above, and the uneven section is asserted to owe more than
 * one distinct height, so no constant can stand in for the subtraction.
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
  UNEVEN_LEVEL_MARKS,
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

/** One section under grading: the project it stands in, the ingest of it, and the run's own steps. */
type Section = { where: PlacementStage; ingest: StagedPlacementIngest; steps: StepRecord[] };

/** The section the criterion spells (even storeys), the one that makes a height a difference, and a plan. */
let even: Section;
let uneven: Section;
let stage: PlacementStage;
let plain: StagedPlacementIngest;
let door: ProposalDoor;

/** One level of the stack a section states: its label, its ordinal, its mark and its storey height. */
type DrawnLevel = { label: string; ordinal: number; markKey: string; height: number | null };

/** The stack a section itself states: label, ordinal by ascending elevation, and storey height. */
function drawnStack(ingest: StagedPlacementIngest): DrawnLevel[] {
  const marks = [...ingest.artifact.levelMarks].sort((left, right) => left.elevation - right.elevation);
  return marks.map((mark, index) => ({
    label: mark.label,
    ordinal: index,
    markKey: mark.markKey,
    height: index + 1 < marks.length ? (marks[index + 1] as { elevation: number }).elevation - mark.elevation : null,
  }));
}

/** The heights a section owes, at the precision two readings of one drawing are compared to. */
function owedHeights(drawn: readonly DrawnLevel[]): number[] {
  return drawn.flatMap((level) => (level.height === null ? [] : [Math.round(level.height * 1e6) / 1e6]));
}

beforeAll(async () => {
  stage = await stagePlacementProject("levels-proposal");
  const evenIngest = await stagePlacementIngest(stage, SCENARIO.SECTIONS, 0x26);
  even = { where: stage, ingest: evenIngest, steps: await runPlacementPartition(stage, evenIngest, "levels-proposal") };
  plain = await stagePlacementIngest(stage, SCENARIO.TYPICAL_RANGE, 0x27);
  await runPlacementPartition(stage, plain, "levels-proposal-plain");

  // The second section stands in its own project: a stack is authored once per project, and both
  // sections are committed below.
  const other = await stagePlacementProject("levels-proposal-uneven");
  const unevenIngest = await stagePlacementIngest(other, SCENARIO.SECTIONS, 0x28, { levelMarks: UNEVEN_LEVEL_MARKS });
  uneven = { where: other, ingest: unevenIngest, steps: await runPlacementPartition(other, unevenIngest, "levels-proposal-uneven") };

  door = await productModule<ProposalDoor>(PLACEMENT_DOOR_MODULE);
  expect(typeof door.proposedLevelStackOf, `${PLACEMENT_DOOR_MODULE} publishes \`proposedLevelStackOf\``).toBe("function");
}, 900_000);

afterAll(async () => {
  await closeStage();
});

describe("AC-7: the machine proposes a stack, never a level", () => {
  test("AC-7: the section's level marks land in proposed_levels, and no level is authored", () => {
    expect(tableStands(PROPOSED_LEVELS), `the product's migration lane lands public.${PROPOSED_LEVELS}`).toBe(true);

    for (const section of [even, uneven]) {
      const drawn = drawnStack(section.ingest);
      const rows = proposedLevelRows(section.where.person.tenantId, section.ingest.ingestId);
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
          expect(row.height, `${level.label} stands ${level.height} below the level above it — a distance, never a constant`).toBeCloseTo(level.height, 6);
          expect(row.unit, "the unit the mark was written in is kept as written (B-07)").toBe(HEIGHT_UNIT);
        }
      }

      const detail = stepDetail(section.steps, LEVELS_PROPOSAL_STAGE);
      expect(Number(detail["proposed"]), "the step reports the levels it proposed").toBe(rows.length);
      expect(levelRowsOf(section.where.person.tenantId).filter((row) => said(row, "projectId", "project_id") === section.where.projectId), "a proposal authors nothing: the level stack is a human's (L-ACT-03)").toEqual([]);
    }

    // The drawing's own arithmetic and the contract's spelling of it agree.
    expect((drawnStack(even.ingest)[0] as { height: number }).height.toFixed(2), "the section the criterion spells states a storey height of 3.05").toBe(STOREY_HEIGHT);
    // And the second section owes more than one height, so no single number can answer for them all.
    expect(new Set(owedHeights(drawnStack(uneven.ingest))).size, "the uneven section states storey heights that differ from one another").toBeGreaterThan(1);
  });

  test("AC-7: the door offers the whole stack as one INSERT_LEVEL input", async () => {
    for (const section of [even, uneven]) {
      const answered = await door.proposedLevelStackOf({ tenantId: section.where.person.tenantId, projectId: section.where.projectId, drawingId: section.ingest.drawingId });
      expect(answered, "the drawing's sections were read, so a stack is offered").not.toBeNull();
      const stack = answered as NonNullable<ProposedStack>;
      expect(stack.group.kind, "the group is the closed kind this offer is made under (L-ACT-02)").toBe(PROPOSED_LEVEL_STACK);
      expect(stack.group.drawingId, "the group names the drawing it was read off").toBe(section.ingest.drawingId);
      expect(stack.group.ingestId, "and the record it was read from").toBe(section.ingest.ingestId);

      const drawn = drawnStack(section.ingest);
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
        expect(Number(reading.valueAsWritten), `${level.label}'s own distance to the level above it, as the section wrote it`).toBeCloseTo(level.height, 6);
        expect(reading.unitAsWritten, "the unit as the section wrote it").toBe(HEIGHT_UNIT);
        expect(reading.sourceKey, `${level.label}'s reading cites ITS OWN level mark, and no other entity (L-CAD-03)`).toBe(level.markKey);
      }
    }
  });

  test("AC-7: a drawing with no section view answers null", async () => {
    const answered = await door.proposedLevelStackOf({ tenantId: stage.person.tenantId, projectId: stage.projectId, drawingId: plain.drawingId });
    expect(answered, "a plan-only drawing proposes no stack — an absence, never an empty offer").toBeNull();
    expect(proposedLevelRows(stage.person.tenantId, plain.ingestId), "and it stores no proposed level").toEqual([]);
  });

  test("AC-7: committing the offer as one INSERT_LEVEL mints the stack and its readings", async () => {
    for (const section of [even, uneven]) {
      const answered = await door.proposedLevelStackOf({ tenantId: section.where.person.tenantId, projectId: section.where.projectId, drawingId: section.ingest.drawingId });
      const stack = answered as NonNullable<ProposedStack>;
      await performAct(section.where.actor, insertion(section.where.projectId, stack.levels));

      const drawn = drawnStack(section.ingest);
      const authored = levelsOfProject(section.where);
      expect(ordered(authored.map((level) => level.label)), "one act, N levels (L-ACT-02: bulk is offered, never assembled)").toEqual(ordered(drawn.map((level) => level.label)));

      const owed = drawn.filter((level) => level.height !== null);
      const readings = readingRowsOf(section.where.person.tenantId).filter((row) => said(row, "projectId", "project_id") === section.where.projectId);
      expect(readings.length, "one reading per level the section states a height for").toBe(owed.length);
      expect(new Set(readings.map((row) => said(row, "basis", "basis"))), "a reading off the drawing is transcribed (L-REG-02)").toEqual(new Set([TRANSCRIBED]));

      // Each reading is carried to the metres of ITS OWN storey — the level it is filed under says
      // which distance it states, so a constant emitted for every level fails here.
      for (const level of owed) {
        const minted = authored.find((one) => one.label === level.label);
        expect(minted, `${level.label} was authored, so its reading has a level to stand on`).toBeTruthy();
        const held = readings.filter((row) => said(row, "levelId", "level_id") === (minted as { levelId: string }).levelId);
        expect(held.length, `${level.label} carries the one reading the section states for it`).toBe(1);
        expect(Number(field(held[0], "canonicalMetres", "canonical_metres")), `${level.label} stands ${level.height} m below the level above it, carried to canonical metres (B-07)`).toBeCloseTo(level.height as number, 6);
      }
    }

    // The section the criterion spells carries its 3.05; the other carries heights that differ.
    const evenMetres = readingRowsOf(even.where.person.tenantId)
      .filter((row) => said(row, "projectId", "project_id") === even.where.projectId)
      .map((row) => Number(field(row, "canonicalMetres", "canonical_metres")));
    expect(new Set(evenMetres), "every storey of the even section is the 3.05 it states").toEqual(new Set([Number(STOREY_HEIGHT)]));
    const unevenMetres = readingRowsOf(uneven.where.person.tenantId)
      .filter((row) => said(row, "projectId", "project_id") === uneven.where.projectId)
      .map((row) => Number(field(row, "canonicalMetres", "canonical_metres")));
    expect(new Set(unevenMetres).size, "and the uneven section's storeys are as many different metres as it drew").toBe(new Set(owedHeights(drawnStack(uneven.ingest))).size);
  });
});
