/**
 * An observation whose object the revision's register no longer carries is not residue; one about an
 * object standing in a lawful-null slot still is (L-QTY-05, L-REG-04).
 *
 * WHY. A register key moves exactly once: `AUTHOR_TYPICAL_RANGE` carries each `@UNRESOLVED`
 * placeholder onto a level. What a press made of the placeholder BEFORE that carry is keyed on a key
 * that now stands for nothing, and the residue's join read it back with no level — which the cell
 * filter reads as "about every level". So every first-press observation hung on every level cell of
 * its class: 54 of them on each of F-RCC6-BNBC's column cells in the J-000 run (session 7 ledger).
 * A footing stands in the FOUNDATION slot and has no level by law; its observation joins, to no
 * level, and must stay where it is.
 *
 * Staged whole through the product's doors: a NOTED_BARE plan (its columns wait in the unresolved
 * slot) and a FOUNDATION plan (its footings stand in the FOUNDATION slot) under one pinned set, a
 * press, the range authored, the residue read, a second press, the residue read again.
 */
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { pinning, setsSeam } from "../sets/support/sets-stage";
import {
  AUTHOR_TYPICAL_RANGE,
  COLUMN,
  FOOTING,
  SCENARIO,
  STACK_LABELS,
  UNRESOLVED,
  closeStage,
  expansionDeferralRows,
  field,
  levelNamed,
  levelsOfProject,
  performAct,
  productModule,
  registerObjectRows,
  runPlacementPartition,
  said,
  stagePlacementIngest,
  stagePlacementProject,
  stageStack,
  storeRows,
  unique,
  type PlacementStage,
  type StagedPlacementIngest,
} from "../partition/support/placement-stage";

const CAMPAIGNS_MODULE = "src/core/campaigns/index.ts";
const MEASURE_JOB_MODULE = "src/modules/takeoff/measure/job.ts";
const GATE_MODULE = "src/core/gate/index.ts";
const RAILS_MODULE = "src/modules/takeoff/rails/index.ts";
const RESIDUE_MODULE = "src/core/residue/index.ts";

/** The kind both classes are pressed for here — the rail that sees a column and a footing alike. */
const RCC_CONCRETE = "rcc.concrete";

/** One residue cell, as far as this suite reads one. */
type Cell = { kind: string; class: string | null; levelId: string | null; observations: readonly { levelId: string | null; rail: string; reason: string }[] };

let stage: PlacementStage;
let columns: StagedPlacementIngest;
let footings: StagedPlacementIngest;
let setRevisionId: string;
let campaignId: string;

/** The set the two drawings are pinned under, through the sets seam and the pin act (L-REG-06). */
async function pinBoth(): Promise<string> {
  const sets = await setsSeam();
  const scope = { tenantId: stage.person.tenantId, projectId: stage.projectId };
  const created = await sets.createSet(scope, { userId: stage.person.userId }, unique("residue set"));
  expect(created.created, `the set was created: ${JSON.stringify(created)}`).toBe(true);
  const setId = (created as { created: true; setId: string }).setId;
  for (const drawingId of [columns.drawingId, footings.drawingId]) {
    const toggled = await sets.toggleMember(scope, setId, drawingId);
    expect(toggled.toggled, `the drawing ${drawingId} was toggled into the set`).toBe(true);
  }
  const before = new Set(revisionIds());
  await performAct(stage.actor, pinning(stage.projectId, setId) as never);
  const added = revisionIds().filter((id) => !before.has(id));
  expect(added.length, "pinning added exactly one revision").toBe(1);
  return added[0] as string;
}

function revisionIds(): string[] {
  return storeRows("drawing_set_revisions", stage.person.tenantId)
    .filter((row) => String(field(row, "projectId", "project_id")) === stage.projectId)
    .map((row) => String(field(row, "setRevisionId", "set_revision_id")));
}

/** One press of the campaign: the measure job, with the roster and the gate the product ships. */
async function press(): Promise<void> {
  const job = await productModule<{
    runMeasureJob: (payload: Record<string, unknown>, progress: { step: (name: string, detail?: Record<string, unknown>) => Promise<void> }, deps: { rails: unknown; gate: unknown }) => Promise<void>;
  }>(MEASURE_JOB_MODULE);
  const gate = await productModule<{ evaluateOffers: (scope: unknown, batch: unknown) => Promise<unknown> }>(GATE_MODULE);
  const { RAILS } = await productModule<{ RAILS: unknown }>(RAILS_MODULE);
  await job.runMeasureJob(
    { tenantId: stage.person.tenantId, projectId: stage.projectId, campaignId, requestedBy: stage.person.userId },
    { step: async () => undefined },
    { rails: RAILS, gate: gate.evaluateOffers },
  );
}

/** The residue's cells of one class for the kind pressed here. */
async function cellsOf(klass: string): Promise<Cell[]> {
  const { residueOf } = await productModule<{ residueOf: (scope: { tenantId: string; projectId: string; campaignId?: string }) => Promise<{ cells: readonly Cell[] }> }>(RESIDUE_MODULE);
  const residue = await residueOf({ tenantId: stage.person.tenantId, projectId: stage.projectId, campaignId });
  return residue.cells.filter((cell) => cell.class === klass && cell.kind === RCC_CONCRETE);
}

/** The rail observations the campaign holds for one class, whole. */
function observationRows(klass: string): Record<string, unknown>[] {
  return storeRows("rail_observations", stage.person.tenantId).filter(
    (row) => String(field(row, "campaignId", "campaign_id")) === campaignId && said(row, "class", "class") === klass && said(row, "kind", "kind") === RCC_CONCRETE,
  );
}

/** The register rows of one class standing for the revision. */
function registered(klass: string): Record<string, unknown>[] {
  return registerObjectRows(stage.person.tenantId, setRevisionId).filter((row) => said(row, "elementType", "element_type") === klass);
}

beforeAll(async () => {
  stage = await stagePlacementProject("residue-retired-keys");
  await stageStack(stage, STACK_LABELS);
  columns = await stagePlacementIngest(stage, SCENARIO.NOTED_BARE, 0x2f30);
  footings = await stagePlacementIngest(stage, SCENARIO.FOUNDATION, 0x2f31);
  setRevisionId = await pinBoth();
  await runPlacementPartition(stage, columns, "residue-columns");
  await runPlacementPartition(stage, footings, "residue-footings");

  const { campaignsOf } = await productModule<{ campaignsOf: (scope: { tenantId: string; projectId: string }) => Promise<Record<string, unknown>[]> }>(CAMPAIGNS_MODULE);
  const held = (await campaignsOf({ tenantId: stage.person.tenantId, projectId: stage.projectId })).filter((row) => String(field(row, "setRevisionId", "set_revision_id")) === setRevisionId);
  expect(held.length, "the pin opened one campaign over the revision").toBe(1);
  campaignId = String(field(held[0], "campaignId", "campaign_id"));

  // The first press, while the columns still wait in the unresolved slot.
  await press();
}, 240_000);

afterAll(async () => {
  await closeStage();
});

describe("residue: observations on keys the register no longer carries", () => {
  test("the first press observed every placeholder and every footing, each by its own key", () => {
    const placeholders = registered(COLUMN).map((row) => said(row, "objectKey", "object_key"));
    expect(placeholders.length > 0 && placeholders.every((key) => key.endsWith(`@${UNRESOLVED}`)), "the columns stand only as placeholders").toBe(true);
    expect(observationRows(COLUMN).map((row) => said(row, "objectKey", "object_key")).sort(), "one column observation per placeholder").toEqual([...placeholders].sort());
    expect(observationRows(FOOTING).length, "and one per footing").toBe(registered(FOOTING).length);
  });

  test("once the range carries the placeholders onto levels, what the press said of them hangs on no level cell", async () => {
    const levels = levelsOfProject(stage);
    const viewKey = said(expansionDeferralRows(stage.person.tenantId, columns.ingestId)[0] as Record<string, unknown>, "viewKey", "view_key");
    await performAct(stage.actor, {
      type: AUTHOR_TYPICAL_RANGE,
      projectId: stage.projectId,
      viewKey,
      fromLevelId: levelNamed(levels, STACK_LABELS[0] as string).levelId,
      toLevelId: levelNamed(levels, STACK_LABELS[STACK_LABELS.length - 1] as string).levelId,
    } as never);
    expect(registered(COLUMN).filter((row) => said(row, "objectKey", "object_key").endsWith(`@${UNRESOLVED}`)), "no placeholder is left").toEqual([]);

    const cells = await cellsOf(COLUMN);
    expect(cells.map((cell) => cell.levelId).sort(), "the columns are celled on the levels they now stand on").toEqual(
      [...new Set(registered(COLUMN).map((row) => said(row, "levelId", "level_id")))].sort(),
    );
    for (const cell of cells) expect(cell.observations, `level ${String(cell.levelId)}: an observation of a retired key is about nothing that stands`).toEqual([]);
  });

  test("an object standing in the FOUNDATION slot keeps its observation — a null level there is the law, not a miss", async () => {
    const cells = await cellsOf(FOOTING);
    expect(cells.map((cell) => cell.levelId), "one footing cell, in no level").toEqual([null]);
    expect(cells[0]?.observations.length, "every footing's observation still stands on it").toBe(registered(FOOTING).length);
  });

  test("a second press observes the carried keys, and each lands on its own level alone", async () => {
    await press();
    const byLevel = new Map<string, number>();
    for (const row of registered(COLUMN)) byLevel.set(said(row, "levelId", "level_id"), (byLevel.get(said(row, "levelId", "level_id")) ?? 0) + 1);
    const cells = await cellsOf(COLUMN);
    for (const cell of cells) {
      expect(cell.observations.length, `level ${String(cell.levelId)} carries its own columns' observations and no others`).toBe(byLevel.get(String(cell.levelId)) ?? 0);
      expect(cell.observations.every((observation) => observation.levelId === cell.levelId), "each of them names that level").toBe(true);
    }
  });
});
