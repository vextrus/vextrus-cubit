/**
 * The mechanics F-RCC6 is measured end to end through (R-TO-031's M2 exit, L-QTY-06).
 *
 * Mechanics only — nothing here judges the product. Every step is a door the product ships and the
 * stages beside it already drive: the corpus is ingested by the real `cad/` CLI and the shipped
 * ingest job (`../../partition/support/placement-stage`), the level stack and its storey heights are
 * authored by acts (`../../levels/support/levels-stage`), the set is pinned by the pin act, the
 * partition job runs placements, member types and expansion, the scale of every layout-plan view
 * carrying columns is affirmed by `AFFIRM_SCALE`, and the campaign is measured by `runMeasureJob`
 * with the shipped `RAILS` roster and the gate.
 *
 * Two facts about the corpus decide what this stage has to author. The TYPICAL FLOOR PLAN's caption
 * states its own range ("1F TO 5F"), and the ROOF PLAN's caption states none for its columns — so
 * `AUTHOR_TYPICAL_RANGE`, the act R-TO-031 names "when unstated", is offered for every layout-plan
 * view carrying columns, with endpoints read from the fixture's own inputs (the levels each mark is
 * stated at) rather than typed here. An act the product answers rather than performs is recorded and
 * stepped past: what the levels of a view are is the product's to decide, not this stage's.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect } from "vitest";
import {
  actorOf,
  closeStage,
  field,
  levelsOfProject,
  performAct,
  pinRevisionNaming,
  productModule,
  runPlacementPartition,
  stageCorpusIngest,
  stagePlacementProject,
  stageStack,
  storeRows,
  type ActorCtx,
  type PlacementStage,
  type StackedLevel,
  type StoreRow,
} from "../../partition/support/placement-stage";
import { storageOf } from "../../partition/support/partition-stage";
import { heightReading } from "../../levels/support/levels-stage";
import { COLUMN_CLASS, INPUTS_FIXTURE, REPO_ROOT, columnLinesOf, fixtureLevels, railsRoster, said } from "./column-rail-stage";

export { closeStage, columnLinesOf, field, said, storeRows };
export type { PlacementStage, StackedLevel, StoreRow };

/* ------------------------------------------------------------------ the doors this stage drives */

/** The partition's read door — where the placements a view carries are read back from. */
const PARTITION_MODULE = "src/modules/takeoff/partition/index.ts";

/** The scale door, and the act that affirms a view's calibration (test contract: `AFFIRM_SCALE`). */
const SCALE_MODULE = "src/modules/takeoff/scale/index.ts";
const AFFIRM_SCALE = "AFFIRM_SCALE";

/** The act R-TO-031 names for a view whose caption states no level range (L-CAD-07). */
const AUTHOR_TYPICAL_RANGE = "AUTHOR_TYPICAL_RANGE";

/** The campaign core, the measure job and the gate the campaign is judged by (test contract). */
const CAMPAIGNS_MODULE = "src/core/campaigns/index.ts";
const MEASURE_JOB_MODULE = "src/modules/takeoff/measure/job.ts";
const GATE_MODULE = "src/core/gate/index.ts";

/** The exact-decimal canon a per-level sum is added up in (B-07). */
const UNITS_MODULE = "src/core/units/canon.ts";

/** The basis a storey height read off the fixture's own statement is authored on (L-MEA-07). */
const TRANSCRIBED_BASIS = "TRANSCRIBED";

/** An act input of a type the level stage's helper is not typed for, handed to the same seam. */
type ActInput = Parameters<typeof performAct>[1];
function asAct(input: Record<string, unknown>): ActInput {
  return input as unknown as ActInput;
}

/** One stored placement, as the partition's door answers one. */
type StoredPlacement = { viewKey: string; elementType: string; mark: string } & Record<string, unknown>;

/** One view's scale, as the scale door answers one. */
type ViewScale = { viewKey: string; proposals: readonly { rank: string }[]; affirmed: { calibrationKey: string } | null };

/** What one measured F-RCC6 project left behind. */
export type Rcc6Stage = {
  stage: PlacementStage;
  tenantId: string;
  projectId: string;
  drawingId: string;
  ingestId: string;
  setRevisionId: string;
  campaignId: string;
  levels: StackedLevel[];
  verdict: { published: number; refused: number; queued: number; refusals: readonly { objectKey: string; code: string }[] };
  /** What the partition run read off the corpus: its steps, and the column placements it stored. */
  partition: { steps: { step: string; detail?: Record<string, unknown> }[]; columnViews: string[]; placements: number };
  /** What every act this stage offered answered with — a refusal is recorded, never hidden. */
  authored: { viewKey: string; from: string; to: string; performed: boolean; answer: string }[];
};

/** The level stack AC-2 names, in the order the fixture states it (GF at the bottom). */
export function stackLabels(): string[] {
  return fixtureLevels()
    .map((level) => level.label)
    .filter((label) => label !== FOUNDATION_LABEL);
}

/** The fixture's foundation level — no column stands on it, and AC-2's stack does not carry it. */
const FOUNDATION_LABEL = "FDN";

/** The storey height the fixture states for a level, in metres, as written. */
export function fixtureHeight(label: string): string {
  const held = fixtureLevels().find((level) => level.label === label);
  expect(held, `fixtures/rcc6/inputs.json states a storey height for ${label}`).toBeTruthy();
  return (held as { heightMetres: string }).heightMetres;
}

/** The levels the fixture states each column mark stands at — what a view's range is authored from. */
export function fixtureColumnLevels(): Map<string, string[]> {
  // The fixture's own inputs, read as data: the acceptance authors what a caption does not state.
  const parsed = JSON.parse(readFileSync(join(REPO_ROOT, INPUTS_FIXTURE), "utf8")) as { columns: { mark: string; levels: string[] }[] };
  return new Map(parsed.columns.map((column) => [column.mark, column.levels]));
}

/**
 * F-RCC6, measured. Memoised per label: the corpus ingest and the partition run are the expensive
 * part of this acceptance, and every criterion reads the same measured campaign.
 */
export async function stageRcc6(label: string): Promise<Rcc6Stage> {
  const stage = await stagePlacementProject(label);
  const tenantId = stage.person.tenantId;
  const scope = { tenantId, projectId: stage.projectId };
  const actor: ActorCtx = actorOf(stage.person);

  // The stack AC-2 names, and the storey height the fixture states for each of its levels, authored
  // by the act L-MEA-07 gives that statement (`AUTHOR_STOREY_HEIGHT`).
  const labels = stackLabels();
  await stageStack(stage, labels, 0);
  const levels = levelsOfProject(stage).filter((level) => labels.includes(level.label));
  expect(levels.map((level) => level.label), "the project's live stack is the one the fixture states").toEqual(labels);
  for (const level of levels) {
    await performAct(
      actor,
      heightReading({
        projectId: stage.projectId,
        levelId: level.levelId,
        valueAsWritten: fixtureHeight(level.label),
        unitAsWritten: "m",
        basis: TRANSCRIBED_BASIS,
        sourceKey: `${INPUTS_FIXTURE}#levels:${level.label}`,
      }),
    );
  }

  // The corpus, ingested and pinned before the partition runs: a set revision is what a register
  // object is scoped to, and the expansion registers its rows against the revisions naming the
  // drawing (L-REG-03, L-REG-06).
  const corpus = await stageCorpusIngest(stage, label);
  const setRevisionId = await pinRevisionNaming(stage, corpus.drawingId);
  const partitionSteps = await runPlacementPartition(stage, corpus, label);

  // Every layout-plan view carrying columns, read off the placements the partition stored.
  const partition = await productModule<{ placementsOf: (s: { tenantId: string; projectId: string; drawingId: string }) => Promise<StoredPlacement[] | null> }>(PARTITION_MODULE);
  const placements = (await partition.placementsOf({ ...scope, drawingId: corpus.drawingId })) ?? [];
  const columnViews = [...new Set(placements.filter((row) => row.elementType === COLUMN_CLASS).map((row) => row.viewKey))].sort();
  // Nothing is asserted about what the corpus gave: what the partition read is the product's answer,
  // and the criteria beside this stage are where it is judged (ARCH-03). What it gave is carried out
  // on `partition`, so a case that finds nothing can say what the run reported.

  // The range each of those views stands over, offered to the act R-TO-031 names for an unstated one.
  const marksByView = new Map<string, Set<string>>();
  for (const row of placements.filter((one) => one.elementType === COLUMN_CLASS)) {
    const held = marksByView.get(row.viewKey) ?? new Set<string>();
    held.add(row.mark);
    marksByView.set(row.viewKey, held);
  }
  const authored: Rcc6Stage["authored"] = [];
  for (const viewKey of columnViews) {
    const stated = [...(marksByView.get(viewKey) ?? new Set<string>())].flatMap((mark) => fixtureColumnLevels().get(mark) ?? []);
    const covered = labels.filter((one) => stated.includes(one));
    if (covered.length === 0) continue;
    const from = levels.find((level) => level.label === covered[0]) as StackedLevel;
    const to = levels.find((level) => level.label === covered[covered.length - 1]) as StackedLevel;
    const input = { type: AUTHOR_TYPICAL_RANGE, projectId: stage.projectId, viewKey, fromLevelId: from.levelId, toLevelId: to.levelId };
    try {
      await performAct(actor, asAct(input));
      authored.push({ viewKey, from: from.label, to: to.label, performed: true, answer: "" });
    } catch (thrown) {
      // The product's own answer about the act: a view whose range already stands is the product's
      // judgement to make, and this stage records it rather than deciding it (ARCH-03).
      authored.push({ viewKey, from: from.label, to: to.label, performed: false, answer: String(thrown) });
    }
  }

  // Every one of those views, scale-affirmed at the rank the machine proposes for it: a rail cannot
  // mint a calibration reference it does not hold (L-MEA-05, riskNotes (3)).
  const scale = await productModule<{ scaleProposalsOf: (s: { tenantId: string; projectId: string; drawingId: string }, deps: { storage: unknown }) => Promise<ViewScale[]> }>(SCALE_MODULE);
  const storage = await storageOf();
  const scales = await scale.scaleProposalsOf({ ...scope, drawingId: corpus.drawingId }, { storage });
  const byRank = new Map<string, string[]>();
  for (const view of scales.filter((one) => columnViews.includes(one.viewKey) && one.affirmed === null)) {
    const rank = view.proposals[0]?.rank;
    expect(rank, `the machine proposes a scale for the layout-plan view ${view.viewKey} — a view with no proposal has nothing to affirm (L-MEA-05)`).toBeTruthy();
    const held = byRank.get(String(rank)) ?? [];
    held.push(view.viewKey);
    byRank.set(String(rank), held);
  }
  for (const [rank, viewKeys] of byRank) {
    await performAct(actor, asAct({ type: AFFIRM_SCALE, projectId: stage.projectId, drawingId: corpus.drawingId, rank, viewKeys, views: viewKeys, observations: [] }));
  }

  // The campaign the pin opened, measured through the shipped job with the shipped roster.
  const campaigns = await productModule<{ campaignsOf: (s: { tenantId: string; projectId: string }) => Promise<StoreRow[]> }>(CAMPAIGNS_MODULE);
  const held = (await campaigns.campaignsOf(scope)).filter((row) => String(field(row, "setRevisionId", "set_revision_id")) === setRevisionId);
  expect(held.length, "pinning the set opened exactly one campaign over the pinned revision").toBe(1);
  const campaignId = String(field(held[0], "campaignId", "campaign_id"));

  const job = await productModule<{
    runMeasureJob: (payload: Record<string, unknown>, progress: { step: (name: string, detail?: Record<string, unknown>) => Promise<void> }, deps: { rails: unknown; gate: unknown }) => Promise<void>;
  }>(MEASURE_JOB_MODULE);
  const gate = await productModule<{ evaluateOffers: (scope: unknown, batch: unknown) => Promise<Rcc6Stage["verdict"]> }>(GATE_MODULE);
  const rails = await railsRoster();

  const steps: { step: string; detail?: Record<string, unknown> }[] = [];
  const verdicts: Rcc6Stage["verdict"][] = [];
  await job.runMeasureJob(
    { tenantId, projectId: stage.projectId, campaignId, requestedBy: stage.person.userId },
    {
      step: async (name, detail) => {
        steps.push({ step: name, detail });
      },
    },
    {
      rails,
      gate: async (gateScope: unknown, batch: unknown) => {
        const answer = await gate.evaluateOffers(gateScope, batch);
        verdicts.push(answer);
        return answer;
      },
    },
  );
  expect(verdicts.length, "the measure job handed its batch to the gate exactly once (SEAM-GATE)").toBe(1);

  return {
    stage,
    tenantId,
    projectId: stage.projectId,
    drawingId: corpus.drawingId,
    ingestId: corpus.ingestId,
    setRevisionId,
    campaignId,
    levels,
    verdict: verdicts[0] as Rcc6Stage["verdict"],
    partition: { steps: partitionSteps.map((one) => ({ step: one.step, detail: one.detail })), columnViews, placements: placements.length },
    authored,
  };
}

/** Every register object of the pinned revision, by its key — where a line's level is read from. */
export function levelOfObjectKey(measured: Rcc6Stage): Map<string, string> {
  const byLevelId = new Map(measured.levels.map((level) => [level.levelId, level.label]));
  const rows = storeRows("register_objects", measured.tenantId).filter((row) => String(field(row, "setRevisionId", "set_revision_id")) === measured.setRevisionId);
  return new Map(
    rows.map((row) => [String(field(row, "objectKey", "object_key")), byLevelId.get(String(field(row, "levelId", "level_id"))) ?? String(field(row, "levelLabel", "level_label") ?? "")]),
  );
}

/** The exact-decimal sum of the column-concrete lines this campaign published, per level label. */
export async function publishedByLevel(measured: Rcc6Stage): Promise<Map<string, string>> {
  const canon = await productModule<{ exact: (value: string | number) => { add: (other: unknown) => unknown; toString: () => string } }>(UNITS_MODULE);
  const level = levelOfObjectKey(measured);
  const summed = new Map<string, { toString: () => string }>();
  for (const line of columnLinesOf(measured.tenantId, measured.campaignId)) {
    const at = level.get(said(line, "objectKey", "object_key")) ?? "";
    const value = (line as Record<string, unknown>)["value"];
    if (value === null || value === undefined) continue;
    const standing = summed.get(at) ?? canon.exact("0");
    summed.set(at, (standing as { add: (other: unknown) => { toString: () => string } }).add(canon.exact(String(value))));
  }
  return new Map([...summed].map(([at, total]) => [at, total.toString()]));
}
