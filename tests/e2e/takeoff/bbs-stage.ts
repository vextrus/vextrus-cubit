/**
 * The stage J-032's bar-schedule leg stands on (test contract: `stageBbs`, `measureStaged`).
 *
 * Mechanics only — nothing here judges the product. The project, the drawing with its reconstructed
 * COLUMN SCHEDULE and its general-notes sheet, and the pinned revision are `stageSchedules`' (B-17:
 * one home for each), staged with `contest: false` so the sheet's own LAP note stands AGREED once the
 * walk transcribes it. What this file adds is what a BILL OF BARS needs beyond a read schedule: a
 * level with a storey height in millimetres — the run a vertical bar is cut to (L-MEA-09) — and one
 * register object per mark the schedule states, so the rebar rail has members to read.
 *
 * ONE SEAM IS STOOD IN FOR, and it is named here rather than hidden: the staged drawing is a schedule
 * sheet, so the partition stored no PLACEMENTS for its marks — no plan view was drawn for them. This
 * stage builds that one map from the register rows it staged and folds it into the setup the JOB
 * loaded, exactly as the rebar rail's own live stage does. Everything else of that setup — the level
 * and its height, the member types and their rebar zones as the partition read them off the schedule,
 * the edition digest and the detailing values the notes door answered — is the product's own.
 *
 * `DATABASE_URL` is pointed at the journeys' database by the stage this file builds on, BEFORE any
 * product module here opens a pool — hence the import order below.
 */
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, type Page } from "@playwright/test";
import { stageSchedules, userIdOf } from "./schedules-stage";
import { laneRows } from "../viewer/viewer-partition-stage";

export { stageBareProject } from "./schedules-stage";

/** The checkout these journeys run against. */
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

/** A product module of the checkout, by repo-relative path (the journey lane's own idiom). */
async function productModule<T>(relative: string): Promise<T> {
  const specifier: string = join(REPO_ROOT, relative);
  return (await import(specifier)) as T;
}

/** The discipline and class the staged marks are sighted under (the catalogue's own spelling). */
const DISCIPLINE = "STRUCTURAL";
const CLASS_COLUMN = "column";

/**
 * The stack the staged schedule's bands are read against, lowest first.
 *
 * A band is a range over a BUILDING: a schedule row banded `GF TO 3RD` selects nothing at all where
 * the project's stack carries no level called `3RD`, because a band whose endpoints cannot be placed
 * is a statement nothing can judge (L-MEA-07, `bandJudgeable`). So the stack is the one the drawing's
 * own bands name, and `bandsStood` below fails by name where the schedule ever names another.
 */
const STACK: readonly string[] = Object.freeze(["GF", "3RD", "4TH", "ROOF"]);

/** The level the staged columns stand on, and the storey height a bar is cut to run through. */
const LEVEL_LABEL = STACK[0] as string;
const STOREY_HEIGHT = Object.freeze({ value: "3048", unit: "mm" } as const);
const TRANSCRIBED = "TRANSCRIBED";

/** The calibration the view the marks were sighted in stands affirmed at. */
const CALIBRATION_KEY = "S-101:PLAN:scale";

/** The kind the rebar rail publishes its lines under, and the coverage that leaves one PARTIAL. */
const RCC_REBAR = "rcc.rebar";
const PARTIAL_DECLARED = "PARTIAL_DECLARED";

type ActorCtx = { tenantId: string; userId: string; actorKind: string };

type ActsSeam = {
  preview: (ctx: ActorCtx, input: Record<string, unknown>) => Promise<Record<string, unknown>>;
  commit: (ctx: ActorCtx, input: Record<string, unknown>, digest: string) => Promise<Record<string, unknown>>;
  consequenceDigest: (consequence: Record<string, unknown>) => string;
};

type LevelsSeam = { levelStackOf: (scope: { tenantId: string; projectId: string }) => Promise<{ levelId: string; label: string; ordinal: number }[]> };

type CampaignsSeam = { campaignsOf: (scope: { tenantId: string; projectId: string }) => Promise<Record<string, unknown>[]> };

type RegisterSeam = {
  registerSighting: (scope: { tenantId: string; projectId: string; setRevisionId: string }, sighting: Record<string, unknown>) => Promise<Record<string, unknown>>;
  registerObjectsOf: (scope: { tenantId: string; projectId: string; setRevisionId: string }) => Promise<Record<string, unknown>[]>;
};

/** One variant of a family, as the store holds one: the band it stands in, and the bars it states. */
type StoredVariantShape = { variantKey: string; bandFrom: string | null; bandTo: string | null; zones: { zone: string; bars: readonly unknown[] | null }[] };

type MemberTypesSeam = {
  memberTypesOf: (scope: { tenantId: string; projectId: string; drawingId: string }) => Promise<{
    families: { family: string; variants: StoredVariantShape[] }[];
  } | null>;
};

/** One placement, as the setup carries one (`src/core/offers/contract.ts`'s `PlacementSetup`). */
type PlacementSetup = {
  drawingId: string;
  ingestId: string;
  viewKey: string;
  memberFamily: string;
  engine: string;
  sourceEntity: string;
  outline: null;
};

/** The setup a rail is handed, in the two coordinates this stage stands in for. */
type RailSetupShape = {
  placements: Record<string, PlacementSetup>;
  calibrations: Record<string, Record<string, string>>;
  memberTypes: Record<string, Record<string, readonly unknown[]>>;
  levels: readonly unknown[];
};

type RailInputShape = { setup: RailSetupShape };

type MeasureJobSeam = {
  runMeasureJob: (
    payload: Record<string, unknown>,
    progress: { step: (name: string, detail?: Record<string, unknown>) => Promise<void> },
    deps: { rails: Record<string, unknown>; gate: unknown },
  ) => Promise<void>;
};

type RailsSeam = { RAILS: Record<string, unknown> };

type GateSeam = { evaluateOffers: (scope: unknown, batch: unknown) => Promise<unknown> };

/** One row of the campaign's bill of bars, as the ONE door answers one (`BbsDocument`). */
type BbsDocumentShape = { rows: readonly Record<string, unknown>[] };

type RebarSeam = { bbsOf: (scope: { tenantId: string; projectId: string; campaignId: string }) => Promise<BbsDocumentShape> };

/** What the bar-schedule leg is driven against (test contract). */
export type StagedBbs = {
  tenantId: string;
  projectId: string;
  /** The sheet the schedule and the general notes were read on. */
  drawingId: string;
  ingestId: string;
  /** The paper layout the notes stand on — the sheet the walk transcribes. */
  notesLayout: string;
  /** The campaign the pinned revision opened, and the revision its register rows stand on. */
  campaignId: string;
  setRevisionId: string;
  /** The figure the grammar canonicalised each written note to — the LAP multiple among them. */
  noteCanonicals: Record<string, string>;
  /** The person the walk is signed in as: who the measurement is requested by. */
  userId: string;
  /** The level the staged marks stand on, at the storey height they run through. */
  levelId: string;
  /** The one seam this stage stands in for, folded into whatever setup the job loads. */
  placements: Record<string, PlacementSetup>;
  calibrations: Record<string, string>;
};

/** What the measurement left behind: the door's own bill, and the state the screen owes it. */
export type MeasuredBbs = { document: BbsDocumentShape; expectedState: "partial" | "ready" };

/**
 * A project whose pinned revision holds the reconstructed COLUMN SCHEDULE, the general notes nobody
 * has contested, a level with its storey height, and one register object per mark the schedule
 * states — everything a bill of bars is read from, and nothing measured yet.
 */
export async function stageBbs(page: Page, options: { label?: string } = {}): Promise<StagedBbs> {
  const label = options.label ?? "bbs";
  const staged = await stageSchedules(page, { label, contest: false });
  const scope = { tenantId: staged.tenantId, projectId: staged.projectId };
  const actor: ActorCtx = { tenantId: staged.tenantId, userId: await userIdOf(page), actorKind: "human" };

  const acts = await productModule<ActsSeam>("src/core/acts/index.ts");
  const perform = async (input: Record<string, unknown>): Promise<Record<string, unknown>> => {
    const consequence = await acts.preview(actor, input);
    return acts.commit(actor, input, acts.consequenceDigest(consequence));
  };

  /* --- the stack the schedule's bands are read against, and the run a bar is cut to (L-MEA-07) --- */
  for (const [ordinal, label] of STACK.map((label, ordinal) => [ordinal, label] as const)) {
    await perform({ type: "INSERT_LEVEL", projectId: staged.projectId, levels: [{ label, ordinal }] });
  }
  const levels = await productModule<LevelsSeam>("src/modules/takeoff/levels/index.ts");
  const stack = await levels.levelStackOf(scope);
  expect(
    stack.map((level) => level.label),
    `the staged project stands on the levels the schedule's bands name: ${JSON.stringify(stack.map((level) => level.label))}`,
  ).toEqual([...STACK]);
  const ground = stack.find((level) => level.label === LEVEL_LABEL);
  expect(ground, `the level ${LEVEL_LABEL} stands on the staged project: ${JSON.stringify(stack.map((level) => level.label))}`).toBeTruthy();
  const levelId = (ground as { levelId: string }).levelId;

  // The height is read off a key of THIS drawing — the schedule's own cells cite the entities they
  // were reconstructed from, so the reading cites the sheet it was transcribed from (L-REG-01).
  const cited = staged.cells.find((cell) => cell.sourceKeys.length > 0);
  expect(cited, "the reconstructed schedule cites the entities it was read from, so a reading has a key of this sheet").toBeTruthy();
  await perform({
    type: "AUTHOR_STOREY_HEIGHT",
    projectId: staged.projectId,
    levelId,
    basis: TRANSCRIBED,
    sourceKey: (cited as { sourceKeys: string[] }).sourceKeys[0],
    valueAsWritten: STOREY_HEIGHT.value,
    unitAsWritten: STOREY_HEIGHT.unit,
  });

  /* --- the campaign the pin opened, which is what the measurement runs over (L-REG-07) --- */
  const campaigns = await productModule<CampaignsSeam>("src/core/campaigns/index.ts");
  const open = await campaigns.campaignsOf(scope);
  expect(open.length, `pinning the staged set opened a campaign: ${JSON.stringify(open)}`).toBeGreaterThan(0);
  const campaign = open[open.length - 1] as Record<string, unknown>;
  const campaignId = String(campaign["campaignId"]);
  const setRevisionId = String(campaign["setRevisionId"]);

  /* --- one object per mark the schedule states, through the register's own door (L-REG-01) --- */
  const register = await productModule<RegisterSeam>("src/modules/takeoff/register/index.ts");
  const registerScope = { ...scope, setRevisionId };
  expect(staged.families.length, `the reconstructed schedule states the marks this leg measures: ${JSON.stringify(staged.families)}`).toBeGreaterThan(0);
  for (const sighting of staged.families.map((family, at) => sightingOf(family, at, levelId))) {
    const answer = await register.registerSighting(registerScope, sighting);
    expect(answer["registered"], `the sighting of ${String(sighting["mark"])} registered: ${JSON.stringify(answer)}`).toBe(true);
  }
  const rows = await register.registerObjectsOf(registerScope);
  expect(rows.length, `the staged revision holds one row per mark sighted: ${JSON.stringify(rows.map((row) => row["mark"]))}`).toBe(staged.families.length);

  /* --- the schedule states a bar group for each of them, which is what there is to bill --- */
  const types = await productModule<MemberTypesSeam>("src/modules/takeoff/partition/index.ts");
  const registered = await types.memberTypesOf({ ...scope, drawingId: staged.drawingId });
  const families = registered?.families ?? [];
  const stating = families.filter((family) => family.variants.some((variant) => variant.zones.some((zone) => (zone.bars ?? []).length > 0)));
  expect(
    stating.map((family) => family.family).sort(),
    `each mark's schedule row states the bar group its steel is billed from: ${JSON.stringify(families)}`,
  ).toEqual([...staged.families].sort());

  // And every band those rows stand in is a band this stack can place: a schedule that banded its
  // rows over levels the project does not carry would select no row at all, and the rail would
  // report a schedule unread for every member rather than billing one (L-FRM-02).
  const named = families
    .flatMap((family) => family.variants.flatMap((variant) => [variant.bandFrom, variant.bandTo]))
    .filter((label): label is string => label !== null)
    .filter((label, at, all) => all.indexOf(label) === at);
  expect(named.filter((label) => !STACK.includes(label)), `the staged stack places every band endpoint the schedule names: ${JSON.stringify(named)}`).toEqual([]);

  /* --- the one seam this stage stands in for: a placement per register row, and its calibration --- */
  const placements: Record<string, PlacementSetup> = {};
  const calibrations: Record<string, string> = {};
  for (const row of rows) {
    const placementKey = String(row["placementKey"]);
    const viewKey = String(row["viewKey"]);
    // The family a placement names is the family the SCHEDULE states, so a register that spells a
    // mark its own way is seen here rather than measured as a member whose schedule nobody found.
    expect(
      staged.families,
      `the register keeps the mark the schedule states, so a placement can name the family it belongs to: ${String(row["mark"])}`,
    ).toContain(String(row["mark"]));
    placements[placementKey] = {
      drawingId: staged.drawingId,
      ingestId: staged.ingestId,
      viewKey,
      memberFamily: String(row["mark"]),
      engine: "VECTOR",
      sourceEntity: placementKey,
      outline: null,
    };
    calibrations[viewKey] = CALIBRATION_KEY;
  }

  return {
    ...scope,
    drawingId: staged.drawingId,
    ingestId: staged.ingestId,
    notesLayout: staged.notesLayout,
    campaignId,
    setRevisionId,
    noteCanonicals: staged.noteCanonicals,
    userId: actor.userId,
    levelId,
    placements,
    calibrations,
  };
}

/** One column sighting, as the register's door is given one (the door's own `Sighting`). */
function sightingOf(mark: string, at: number, levelId: string): Record<string, unknown> {
  return {
    discipline: DISCIPLINE,
    elementType: CLASS_COLUMN,
    mark,
    view: { viewClass: "PLAN", captionAnchorSourceKey: "S-101:t:12" },
    x: 1000 + at * 100,
    y: 250,
    level: { levelId },
    standing: "MEASURED",
    content: {
      evidence: ["S-101:e:41"],
      attributes: { concrete_grade: "C30/37" },
      geometry: { outline: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }], span: { length: "300.0", breadth: "300.0" } },
      source: { sheet: "S-101", anchor: "S-101:t:12" },
    },
  };
}

/**
 * The campaign, measured through the shipped job with the shipped rails and the real gate — and the
 * bill of bars read back through the ONE door the screen reads it through (`bbsOf`).
 *
 * The rebar rail is wrapped, and the wrapper does ONE thing: it folds this stage's placements and
 * their calibration into the setup the JOB loaded, before the rail is run over it. The detailing the
 * campaign applies is the notes door's own answer, so a lap the walk transcribed as `50d` is the lap
 * measured here (AM-03(h), L-BD-02).
 *
 * `expectedState` is read off what the measurement STORED, never off the screen's own reading: a
 * campaign any of whose reinforcement lines kept a component it could not declare is partly declared,
 * and the screen owes its reader that sentence (L-QTY-02).
 */
export async function measureStaged(staged: StagedBbs): Promise<MeasuredBbs> {
  const job = await productModule<MeasureJobSeam>("src/modules/takeoff/measure/job.ts");
  const roster = await productModule<RailsSeam>("src/modules/takeoff/rails/index.ts");
  const gate = await productModule<GateSeam>("src/core/gate/index.ts");
  const rail = roster.RAILS[RCC_REBAR];
  expect(typeof rail, `RAILS["${RCC_REBAR}"] is the rail the measure job runs for this kind (L-MEA-08)`).toBe("function");

  // What the rail made of the campaign, kept so a measurement that billed nothing says WHY: a member
  // it could not read is an observation under this area's own code (L-MEA-08).
  const seen: { observations: unknown[]; read: unknown } = { observations: [], read: null };
  const wrapped = (input: RailInputShape): unknown => {
    Object.assign(input.setup.placements, staged.placements);
    Object.assign(input.setup.calibrations, { [staged.ingestId]: { ...(input.setup.calibrations[staged.ingestId] ?? {}), ...staged.calibrations } });
    seen.read = {
      levels: input.setup.levels,
      placements: Object.keys(input.setup.placements),
      families: Object.keys(input.setup.memberTypes[staged.ingestId] ?? {}),
      memberTypes: input.setup.memberTypes[staged.ingestId],
      calibrations: input.setup.calibrations[staged.ingestId],
    };
    const batch = (rail as (one: RailInputShape) => { observations?: readonly unknown[] })(input);
    seen.observations = [...(batch.observations ?? [])];
    return batch;
  };

  // The gate is the real one; what it made of the batch is kept, so a campaign that published nothing
  // says whether the offers were refused, deferred or never made (SEAM-GATE).
  const verdicts: unknown[] = [];
  await job.runMeasureJob(
    { tenantId: staged.tenantId, projectId: staged.projectId, campaignId: staged.campaignId, requestedBy: staged.userId },
    { step: async () => undefined },
    {
      rails: { ...roster.RAILS, [RCC_REBAR]: wrapped },
      gate: async (gateScope: unknown, batch: unknown) => {
        const answer = await gate.evaluateOffers(gateScope, batch);
        verdicts.push(answer);
        return answer;
      },
    },
  );

  const rebar = await productModule<RebarSeam>("src/modules/takeoff/rebar/index.ts");
  const document = await rebar.bbsOf({ tenantId: staged.tenantId, projectId: staged.projectId, campaignId: staged.campaignId });
  expect(
    document.rows.length,
    `the measured campaign wrote the bar rows the schedule is drawn from (L-REG-04) — the rail observed ${JSON.stringify(seen.observations)} over ${JSON.stringify(seen.read)}`,
  ).toBeGreaterThan(0);

  const coverage = laneRows(
    `select coverage from quantity_lines
       where tenant_id = '${staged.tenantId}' and campaign_id = '${staged.campaignId}' and kind = '${RCC_REBAR}';`,
  ).map((row) => row[0] ?? "");
  expect(coverage.length, `the measurement published the campaign's ${RCC_REBAR} lines — the gate answered ${JSON.stringify(verdicts)}`).toBeGreaterThan(0);
  return { document, expectedState: coverage.includes(PARTIAL_DECLARED) ? "partial" : "ready" };
}
