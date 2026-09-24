/**
 * The gate writes nothing on a key a lawful act carries elsewhere, and a fresh campaign's lines all
 * join the register (Interpretation I-368; L-CAD-07, L-REG-04, L-QTY-03, SEAM-GATE).
 *
 * WHY. Every J-000 BNBC campaign since 788c1e8a held 50 quantity lines on keys ending `@UNRESOLVED`
 * that no register row carries. S-14's bare `TYPICAL FLOOR BEAM LAYOUT` leaves its beams in the
 * UNRESOLVED slot; the first Measure runs every rail over every register row, and the frame rail finds
 * a section for a beam standing on no level because a strip family states one variant. The gate
 * published. `AUTHOR_TYPICAL_RANGE` then re-keys each placeholder in place and never touches the lines,
 * which are append-only with no foreign key to the register — so the second Measure published the
 * carried keys' lines beside them, and a reader summing the campaign by campaign alone would count the
 * typical floor twice. L-CAD-07: "a bare typical caption ... registers UNRESOLVED rows with no line".
 *
 * Staged whole through the product's doors, on a drawing built for it
 * (`./support/placeholder-lines-artifact`): a bare-caption beam layout whose two beam families each
 * state ONE strip variant, and a foundation plan whose footings stand in the FOUNDATION slot, under one
 * pinned set and a three-storey stack. Its views are scale-affirmed, the campaign is pressed, the range
 * is authored and the lane's re-expansion run after it (the router's path), and it is pressed again.
 */
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { storageOf } from "../partition/support/partition-stage";
import {
  AUTHOR_TYPICAL_RANGE,
  FOUNDATION,
  QUANTITY_LINES,
  UNRESOLVED,
  closeStage,
  expansionDeferralRows,
  field,
  levelNamed,
  levelsOfProject,
  performAct,
  pinRevisionNaming,
  productModule,
  registerObjectRows,
  runPlacementPartition,
  said,
  stageArtifactIngest,
  stagePlacementProject,
  stageStack,
  storeRows,
  type PlacementStage,
  type StackedLevel,
  type StoreRow,
} from "../partition/support/placement-stage";
import { STACK, buildPlaceholderLinesArtifact, type PlaceholderLinesArtifact } from "./support/placeholder-lines-artifact";

const CAMPAIGNS_MODULE = "src/core/campaigns/index.ts";
const MEASURE_JOB_MODULE = "src/modules/takeoff/measure/job.ts";
const GATE_MODULE = "src/core/gate/index.ts";
const RAILS_MODULE = "src/modules/takeoff/rails/index.ts";
const PARTITION_MODULE = "src/modules/takeoff/partition/index.ts";
const REEXPAND_MODULE = "src/modules/takeoff/partition/expansion/reexpand.ts";
const SCALE_MODULE = "src/modules/takeoff/scale/index.ts";

/** The act that affirms a view's scale, and the queue the gate's deferrals stand in. */
const AFFIRM_SCALE = "AFFIRM_SCALE";
const QUEUE_ITEMS = "queue_items";

/** The two kinds the frame rail measures a beam for, and the classes the drawing places. */
const RCC_CONCRETE = "rcc.concrete";
const RCC_FORMWORK = "rcc.formwork";
const BEAM = "beam";
const FOOTING = "footing";

/** The code a member in the UNRESOLVED slot is answered with (I-368, I-667) — the Bible's own, L-CAD-07. */
const TYPICAL_RANGE_UNSTATED = "TYPICAL_RANGE_UNSTATED";

/** One verdict of the gate, as far as this suite reads one. */
type Verdict = { published: number; refused: number; queued: number; refusals: readonly { objectKey: string; code: string }[] };

/** One stored placement, and one view's scale, as their doors answer them. */
type StoredPlacement = { viewKey: string } & Record<string, unknown>;
type ViewScale = { viewKey: string; proposals: readonly { rank: string }[]; affirmed: unknown };

let stage: PlacementStage;
let built: PlaceholderLinesArtifact;
let drawingId: string;
let ingestId: string;
let setRevisionId: string;
let campaignId: string;
let levels: StackedLevel[];
/** What each press of the campaign was answered, in the order they were pressed. */
const verdicts: Verdict[] = [];
/** What each press handed the gate beside its offers: the rails' reports (L-MEA-08). */
type Observation = { class: string; kind: string; code: string; objectKey?: string; sourceEntity?: string };
const reports: Observation[][] = [];

/** One press of the campaign: the measure job, with the roster and the gate the product ships. */
async function press(): Promise<Verdict> {
  const job = await productModule<{
    runMeasureJob: (payload: Record<string, unknown>, progress: { step: (name: string, detail?: Record<string, unknown>) => Promise<void> }, deps: { rails: unknown; gate: unknown }) => Promise<void>;
  }>(MEASURE_JOB_MODULE);
  const gate = await productModule<{ evaluateOffers: (scope: unknown, batch: unknown) => Promise<Verdict> }>(GATE_MODULE);
  const { RAILS } = await productModule<{ RAILS: unknown }>(RAILS_MODULE);
  const answered: Verdict[] = [];
  await job.runMeasureJob(
    { tenantId: stage.person.tenantId, projectId: stage.projectId, campaignId, requestedBy: stage.person.userId },
    { step: async () => undefined },
    {
      rails: RAILS,
      gate: async (scope: unknown, batch: unknown) => {
        reports.push([...((batch as { observations?: readonly Observation[] }).observations ?? [])]);
        const answer = await gate.evaluateOffers(scope, batch);
        answered.push(answer);
        return answer;
      },
    },
  );
  expect(answered.length, "the measure job handed its batch to the gate exactly once (SEAM-GATE)").toBe(1);
  verdicts.push(answered[0] as Verdict);
  return answered[0] as Verdict;
}

/**
 * Every view the partition placed anything in, scale-affirmed at the rank the machine proposes for it:
 * a rail offers nothing off a view nobody affirmed (L-MEA-05), and an offer is what the gate is asked
 * about. A placement names its view by L-REG-04's address and the scale door by the partition's own
 * key, which the address is content of — so the two are joined by the tail they share.
 */
async function affirmPlacedViews(): Promise<void> {
  const scope = { tenantId: stage.person.tenantId, projectId: stage.projectId, drawingId };
  const partition = await productModule<{ placementsOf: (s: typeof scope) => Promise<StoredPlacement[] | null> }>(PARTITION_MODULE);
  const addresses = [...new Set(((await partition.placementsOf(scope)) ?? []).map((row) => row.viewKey))];
  const scale = await productModule<{ scaleProposalsOf: (s: typeof scope, deps: { storage: unknown }) => Promise<ViewScale[]> }>(SCALE_MODULE);
  const placed = (await scale.scaleProposalsOf(scope, { storage: await storageOf() })).filter((view) =>
    addresses.some((address) => address === view.viewKey || address.endsWith(`:${view.viewKey}`)),
  );
  expect(placed.length, "the beam layout and the foundation plan both carry placements, and the scale door answers both").toBe(2);
  const byRank = new Map<string, string[]>();
  for (const view of placed) {
    const rank = view.proposals[0]?.rank;
    expect(rank, `the machine proposes a scale for ${view.viewKey} — a view with no proposal has nothing to affirm (L-MEA-05)`).toBeTruthy();
    byRank.set(String(rank), [...(byRank.get(String(rank)) ?? []), view.viewKey]);
  }
  for (const [rank, viewKeys] of byRank) {
    await performAct(stage.actor, { type: AFFIRM_SCALE, projectId: stage.projectId, drawingId, rank, viewKeys, observations: [] } as never);
  }
}

/** The register rows of the pinned revision, whole, and those of one class. */
function registered(): StoreRow[] {
  return registerObjectRows(stage.person.tenantId, setRevisionId);
}
function registeredOf(klass: string): StoreRow[] {
  return registered().filter((row) => said(row, "elementType", "element_type") === klass);
}

/** Does this register row stand where a lawful act will carry it from — the UNRESOLVED slot, or a placeholder? */
function standsToBeCarried(row: StoreRow): boolean {
  return said(row, "levelSlot", "level_slot") === UNRESOLVED || said(row, "levelLabel", "level_label") !== "";
}

/** One row's object key. */
function keyOf(row: StoreRow): string {
  return said(row, "objectKey", "object_key");
}

/** Every row of one table the campaign holds. */
function campaignRows(table: string): StoreRow[] {
  return storeRows(table, stage.person.tenantId).filter((row) => said(row, "campaignId", "campaign_id") === campaignId);
}

/** The campaign's lines of one class, and of one class and kind. */
function linesOf(klass: string, kind?: string): StoreRow[] {
  return campaignRows(QUANTITY_LINES).filter((row) => said(row, "class", "class") === klass && (kind === undefined || said(row, "kind", "kind") === kind));
}

/**
 * The campaign's lines and queue items whose key no register row of the revision carries: L-QTY-03's
 * "provenance to a register row as a reference", read as the join a reader of the lines would make —
 * (tenant, revision, key) — and asked of every line and queue item the gate wrote. The rail
 * observations are not asked: the residue already reads past those whose key moved (`observationsOf`).
 */
function severed(): { lines: string[]; queued: string[] } {
  const standing = new Set(registered().map(keyOf));
  return {
    lines: campaignRows(QUANTITY_LINES)
      .filter((row) => said(row, "setRevisionId", "set_revision_id") !== setRevisionId || !standing.has(keyOf(row)))
      .map(keyOf),
    queued: campaignRows(QUEUE_ITEMS)
      .filter((row) => !standing.has(keyOf(row)))
      .map(keyOf),
  };
}

beforeAll(async () => {
  stage = await stagePlacementProject("placeholder-lines");
  await stageStack(stage, STACK);
  levels = levelsOfProject(stage).filter((level) => STACK.includes(level.label));
  expect(levels.map((level) => level.label), "the live stack is the three storeys the strip sheet's band names").toEqual([...STACK]);

  built = buildPlaceholderLinesArtifact(0x3a01);
  ({ drawingId, ingestId } = await stageArtifactIngest(stage, built.json, "placeholder-lines"));
  setRevisionId = await pinRevisionNaming(stage, drawingId);
  await runPlacementPartition(stage, { drawingId, ingestId }, "placeholder-lines");
  await affirmPlacedViews();

  const { campaignsOf } = await productModule<{ campaignsOf: (scope: { tenantId: string; projectId: string }) => Promise<Record<string, unknown>[]> }>(CAMPAIGNS_MODULE);
  const held = (await campaignsOf({ tenantId: stage.person.tenantId, projectId: stage.projectId })).filter((row) => String(field(row, "setRevisionId", "set_revision_id")) === setRevisionId);
  expect(held.length, "the pin opened one campaign over the revision").toBe(1);
  campaignId = String(field(held[0], "campaignId", "campaign_id"));

  // The first press, while the beams still wait in the unresolved slot.
  await press();
}, 240_000);

afterAll(async () => {
  await closeStage();
});

describe("I-368: a line is never keyed on the UNRESOLVED slot, and every line of a fresh campaign joins the register", () => {
  // TEST_AMENDED (I-667): the frame rail no longer offers a member in the UNRESOLVED slot for the
  // gate to refuse — a gate refusal is stored nowhere a reader looks, so the beams said nothing. It
  // reports each against its view under the same code, and the proof is the same: nothing publishes
  // on a placeholder, and every one of them is answered by name.
  test("the first press: every beam waits in the UNRESOLVED slot, the frame rail reports it against its view by TYPICAL_RANGE_UNSTATED and offers nothing", () => {
    const beams = registeredOf(BEAM);
    expect(beams.length, "one register row per drawn beam").toBe(built.beams);
    expect(beams.every((row) => said(row, "levelSlot", "level_slot") === UNRESOLVED), "each of them standing in the unresolved slot (L-CAD-07)").toBe(true);

    // What makes the rest of this suite a proof rather than a quiet store: the rail DID read each
    // placeholder, once per kind it measures a beam for, and answered each by name.
    const first = verdicts[0] as Verdict;
    const reported = (reports[0] ?? []).filter((one) => one.class === BEAM && one.code === TYPICAL_RANGE_UNSTATED);
    expect(
      reported.map((one) => `${String(one.objectKey)}|${one.kind}`).sort(),
      "every beam placeholder was reported for concrete and for formwork, by the Bible's own code",
    ).toEqual(beams.flatMap((row) => [`${keyOf(row)}|${RCC_CONCRETE}`, `${keyOf(row)}|${RCC_FORMWORK}`]).sort());
    expect(
      new Set(reported.map((one) => one.sourceEntity)),
      "each against its view — what a reader states a range for (L-CAD-07)",
    ).toEqual(new Set(beams.map((row) => said(row, "viewKey", "view_key"))));
    expect(first.refusals.filter((one) => one.code === TYPICAL_RANGE_UNSTATED), `and none was offered for the gate to refuse (the verdict was ${JSON.stringify(first)})`).toEqual([]);
    expect(linesOf(BEAM), "so no beam line stands at all").toEqual([]);
  });

  test("the first press writes no line and no queue item on a key a lawful act will move, and every line it wrote joins a register row", () => {
    const moving = new Set(registered().filter(standsToBeCarried).map(keyOf));
    expect(moving.size, "the beams are the placeholders this press stood over").toBe(built.beams);
    expect(campaignRows(QUANTITY_LINES).filter((row) => moving.has(keyOf(row))).map(keyOf), "no line on a placeholder").toEqual([]);
    expect(campaignRows(QUEUE_ITEMS).filter((row) => moving.has(keyOf(row))).map(keyOf), "and no declared exclusion on one either").toEqual([]);
    expect(severed(), "every line and queue item the gate wrote names a row the register carries (L-QTY-03)").toEqual({ lines: [], queued: [] });
  });

  test("an object standing in the FOUNDATION slot still publishes — nothing carries that slot", () => {
    const footings = registeredOf(FOOTING);
    expect(footings.length, "one register row per drawn footing").toBe(built.footings);
    expect(footings.every((row) => said(row, "levelSlot", "level_slot") === FOUNDATION), "each standing in the FOUNDATION slot (L-CAD-07)").toBe(true);
    expect(
      linesOf(FOOTING, RCC_CONCRETE).map(keyOf).sort(),
      `every footing's concrete was published on its own key (the verdict was ${JSON.stringify(verdicts[0])})`,
    ).toEqual(footings.map(keyOf).sort());
  });

  test("the range authored and the lane re-expanded: no placeholder is left, and each beam stands once on each storey of the range", async () => {
    const viewKey = said(expansionDeferralRows(stage.person.tenantId, ingestId)[0] as StoreRow, "viewKey", "view_key");
    expect(viewKey, "the beam layout is the view the expansion deferred").not.toBe("");
    await performAct(stage.actor, {
      type: AUTHOR_TYPICAL_RANGE,
      projectId: stage.projectId,
      viewKey,
      fromLevelId: levelNamed(levels, STACK[0] as string).levelId,
      toLevelId: levelNamed(levels, STACK[STACK.length - 1] as string).levelId,
    } as never);
    // The step the lane's door takes after the act (the router's path), so the register pressed next is
    // the one a customer's campaign is measured over.
    const reexpand = await productModule<{ reexpandProject: (scope: { tenantId: string; projectId: string }) => Promise<unknown> }>(REEXPAND_MODULE);
    await reexpand.reexpandProject({ tenantId: stage.person.tenantId, projectId: stage.projectId });

    expect(registered().filter(standsToBeCarried).map(keyOf), "no placeholder is left").toEqual([]);
    const beams = registeredOf(BEAM);
    expect(beams.length, "each drawn beam stands on each storey of the range").toBe(built.beams * STACK.length);
    const onLevels = new Set(levels.map((level) => level.levelId));
    expect(beams.every((row) => onLevels.has(said(row, "levelId", "level_id"))), "and on a surrogate of the live stack, every one").toBe(true);
  });

  test("the second press: every line of the campaign joins a register row, and each beam object carries exactly its two lines", async () => {
    const second = await press();
    expect(
      second.refusals.filter((one) => one.code === TYPICAL_RANGE_UNSTATED),
      "nothing stands on a placeholder any more, so nothing is refused for standing on one",
    ).toEqual([]);
    expect(severed(), "the join a reader of the lines makes is total over the campaign — the first press left nothing orphaned behind it").toEqual({ lines: [], queued: [] });

    const beams = registeredOf(BEAM).map(keyOf).sort();
    expect(linesOf(BEAM).length, `beam lines = 2 × beam objects (the verdict was ${JSON.stringify(second)})`).toBe(2 * beams.length);
    expect(linesOf(BEAM, RCC_CONCRETE).map(keyOf).sort(), "one concrete line per beam object, on its own key").toEqual(beams);
    expect(linesOf(BEAM, RCC_FORMWORK).map(keyOf).sort(), "and one formwork line per beam object").toEqual(beams);
  });

  test("the footings' lines stand as the first press wrote them — a FOUNDATION key is never carried", () => {
    expect(linesOf(FOOTING, RCC_CONCRETE).map(keyOf).sort(), "each footing keeps exactly its one concrete line").toEqual(registeredOf(FOOTING).map(keyOf).sort());
  });
});
