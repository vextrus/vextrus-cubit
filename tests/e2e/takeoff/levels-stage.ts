/**
 * The stage J-031's LEVELS walk stands on (test contract: `stageLevels`, `publishLines`).
 *
 * Mechanics only — nothing here judges the product. The person, the project and the partitioned
 * sheet come from the stage the viewer journeys already run on (`../viewer/viewer-partition-stage`):
 * one invariant, one home (B-17, ARCH-02). What this file adds is what a LEVEL STACK needs and the
 * register's own stage does not leave behind:
 *
 *   - two live levels, GF at ordinal 0 and L1 at ordinal 1, so the walk's insert has a stack to be
 *     inserted into the middle of and a level to move up one (L-MEA-07);
 *   - GF's storey height TRANSCRIBED off the sheet as `3048` `mm`, so the height the walk then reads
 *     for itself COMPETES with one already standing rather than being the only reading there is;
 *   - a register object under the placeholder label `MEZZ`, which the walk's INSERT_LEVEL carries
 *     onto the level it inserts — the third subject its Consequence names;
 *   - a pinned drawing-set revision, which is what opens the campaign (L-REG-07);
 *   - and NO published line at all. The campaign is measured AFTER the contest, by `publishLines`,
 *     because the walk reads a roll-up that was published through a suspended height: a stage that
 *     measured first would publish the complete figure and prove nothing (L-QTY-02, R-TO-020).
 *
 * Every step is a shipped seam, driven in-process under the journey lane's database exactly as the
 * register's stage drives its own: no table is written by hand and no id is invented.
 *
 * `DATABASE_URL` is pointed at the journeys' database by the stage this file builds on, BEFORE any
 * product module here opens a pool — hence the import order below.
 */
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { expect, type Page } from "@playwright/test";
import { stagePartitionedSheet } from "../viewer/viewer-partition-stage";
import { CLASS_COLUMN, DISCIPLINE, RCC_CONCRETE, SYNTHETIC_SOURCES, placementSourceOf } from "./register-stage";
import { TESTIDS, testIdSelector } from "../../../src/ui/testids";
import { heldAttribute } from "../support/retrying-read";

/** The checkout these journeys run against. */
const REPO_ROOT = join(import.meta.dirname, "..", "..", "..");

/** A product module of the checkout, by repo-relative path (the journey lane's own idiom). */
async function productModule<T>(relative: string): Promise<T> {
  const specifier: string = join(REPO_ROOT, relative);
  return (await import(specifier)) as T;
}

/** The stack the walk begins on: the floor it contests a height on, and the one its insert moves. */
export const GROUND_LEVEL = "GF";
export const UPPER_LEVEL = "L1";

/**
 * The placeholder one register object already stands under: a level a drawing named before anybody
 * registered it (L-REG-02). The sheet writes the mezzanine as a dotted abbreviation and the person
 * inserting the level types `MEZZ`, which is the SAME label — L-CAD-07 compares labels dotless and
 * uppercase, and the one-hop carry finds the placeholder by that rule rather than by string equality
 * (L-REG-04). Staging the two spellings apart is what makes the carry prove anything.
 */
export const PLACEHOLDER_LEVEL = "M.E.Z.Z";

/** The two columns this stage sights: one on the ground floor, one under the placeholder label. */
export const GROUND_MARK = "C1";
export const PLACEHOLDER_MARK = "C2";

/**
 * GF's height as the sheet states it, and the basis it is read on. It is TRANSCRIBED off a drawing
 * entity, so it stands under a key of its own — a height somebody then ENTERS for themselves is a
 * second reading competing with it rather than an overwrite of it (L-MEA-07, R-TO-051).
 */
export const TRANSCRIBED = "TRANSCRIBED";
export const GROUND_HEIGHT = Object.freeze({ value: "3048", unit: "mm" } as const);

/** The family the staged columns belong to, and the calibration the view they were sighted in was scaled by. */
const MEMBER_FAMILY = "COL-300x450";
const CALIBRATION_KEY = "S-101:PLAN:scale";

/** The unit a carried height stands in — the canon's own for LENGTH, as the rail is handed one. */
const CANONICAL_LENGTH = "m";

/** What the walk is driven against. Beyond the four the journey reads, what `publishLines` needs. */
export type StagedLevels = {
  tenantId: string;
  projectId: string;
  /** The ground floor, whose height the walk contests and then settles. */
  groundLevelId: string;
  /** The level standing at ordinal 1 before the insert, which the insert moves to 2. */
  upperLevelId: string;
  /** The campaign the pinned revision opened, and the revision its register rows stand on. */
  campaignId: string;
  setRevisionId: string;
  /** The sheet the staged columns were read on, and the ingest its placements were read from. */
  drawingId: string;
  ingestId: string;
};

type ActorCtx = { tenantId: string; userId: string; actorKind: string };

type ActsSeam = {
  preview: (ctx: ActorCtx, input: Record<string, unknown>) => Promise<Record<string, unknown>>;
  commit: (ctx: ActorCtx, input: Record<string, unknown>, digest: string) => Promise<Record<string, unknown>>;
  consequenceDigest: (consequence: Record<string, unknown>) => string;
};

/** One live level, as the levels door answers one: where it stands and how its height stands. */
type StackLevel = {
  levelId: string;
  label: string;
  ordinal: number;
  height: {
    standing: string;
    canonicalMetres: string | null;
    current: readonly { basis: string; sourceKey: string | null }[];
  };
};

type LevelsSeam = { levelStackOf: (scope: { tenantId: string; projectId: string }) => Promise<StackLevel[]> };

type SetsSeam = {
  createSet: (scope: { tenantId: string; projectId: string }, by: { userId: string }, name: string) => Promise<Record<string, unknown>>;
  toggleMember: (scope: { tenantId: string; projectId: string }, setId: string, drawingId: string) => Promise<Record<string, unknown>>;
};

type RegisterSeam = {
  registerSighting: (scope: { tenantId: string; projectId: string; setRevisionId: string }, sighting: Record<string, unknown>) => Promise<Record<string, unknown>>;
  registerObjectsOf: (scope: { tenantId: string; projectId: string; setRevisionId: string }) => Promise<Record<string, unknown>[]>;
};

type CampaignsSeam = { campaignsOf: (scope: { tenantId: string; projectId: string }) => Promise<Record<string, unknown>[]> };

/** One offer, as the rail hands one to the gate (`src/core/offers/contract.ts`). */
type OfferShape = Record<string, unknown> & { register: { objectKey: string } };

/** The column rail: a pure function from the register's rows and their setup to offers. */
type RailSeam = { columnConcreteRail: (input: Record<string, unknown>) => { offers: OfferShape[] } };

/** The gate, which judges a batch and writes what it publishes and what it defers, in one go. */
type GateSeam = {
  evaluateOffers: (
    scope: { tenantId: string; projectId: string; campaignId: string },
    batch: { offers: readonly OfferShape[]; observations: readonly unknown[] },
  ) => Promise<{ published: number; refused: number; queued: number; refusals: readonly { objectKey: string; code: string }[] }>;
};

/** The reading the register's workspace renders — used here to READ BACK what the gate wrote (B-19). */
type RegisterUiSeam = {
  registerViewOf: (scope: { tenantId: string; projectId: string }) => Promise<{ lines: { lineId: string; objectKey: string; kind: string }[] }>;
};

/** The signed-in person, as the shell states them — the same read the register's stage makes. */
async function userIdOf(page: Page): Promise<string> {
  const userId = await heldAttribute(page.locator(testIdSelector(TESTIDS.shell.user)), "data-user-id");
  expect(userId, "the journey is signed in, so the shell names the person acting").toBeTruthy();
  return userId as string;
}

/** One column sighting, as the register's door is given one (the door's own `Sighting`). */
function sightingOn(level: Record<string, unknown>, mark: string, x: number): Record<string, unknown> {
  return {
    discipline: DISCIPLINE,
    elementType: CLASS_COLUMN,
    mark,
    view: { viewClass: "PLAN", captionAnchorSourceKey: "S-101:t:12" },
    x,
    y: 250,
    level,
    standing: "MEASURED",
    content: {
      evidence: [SYNTHETIC_SOURCES.evidence],
      attributes: { concrete_grade: "C30/37" },
      geometry: { outline: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }], span: { length: "300.0", breadth: "300.0" } },
      source: { sheet: "S-101", anchor: "S-101:t:12" },
    },
  };
}

/**
 * A level as the rail is handed one. The height is the LIVE standing, carried straight through: a
 * level whose readings agree binds its metres, and a level whose readings disagree — or that nobody
 * read at all — hands the rail no reading, which is what makes the rail omit H under the levels
 * law's own code and the gate publish the line as PARTIAL_DECLARED (L-MEA-07, L-QTY-02).
 */
function levelSetupOf(level: StackLevel): Record<string, unknown> {
  const read = level.height.current[0];
  const agreed = level.height.standing === "AGREED" && level.height.canonicalMetres !== null && read !== undefined;
  return {
    levelId: level.levelId,
    label: level.label,
    ordinal: level.ordinal,
    height: agreed
      ? { standing: level.height.standing, value: level.height.canonicalMetres, unit: CANONICAL_LENGTH, basis: read?.basis, sourceKey: read?.sourceKey ?? SYNTHETIC_SOURCES.height }
      : { standing: level.height.standing, value: null, unit: null, basis: null, sourceKey: null },
  };
}

/**
 * What the register's rows are measured against (`RailSetup`): one placement per row on the staged
 * drawing and its ingest, one section for the family they share, the levels of the LIVE stack with
 * the heights they stand at today, and the affirmed calibration of the view they were sighted in.
 */
function setupFor(rows: readonly Record<string, unknown>[], stack: readonly StackLevel[], ids: { drawingId: string; ingestId: string }): Record<string, unknown> {
  const placements: Record<string, Record<string, unknown>> = {};
  const views: Record<string, string> = {};
  for (const row of rows) {
    const viewKey = String(row["viewKey"]);
    placements[String(row["placementKey"])] = {
      drawingId: ids.drawingId,
      ingestId: ids.ingestId,
      viewKey,
      memberFamily: MEMBER_FAMILY,
      engine: "VECTOR",
      sourceEntity: placementSourceOf(String(row["mark"])),
    };
    views[viewKey] = CALIBRATION_KEY;
  }
  return {
    placements,
    memberTypes: {
      [ids.ingestId]: {
        [MEMBER_FAMILY]: [
          { variantKey: MEMBER_FAMILY, bandFrom: null, bandTo: null, sectionText: "300x450", sectionWidth: 300, sectionDepth: 450, sectionUnit: "mm", sourceKeys: [SYNTHETIC_SOURCES.section] },
        ],
      },
    },
    levels: stack.map(levelSetupOf),
    calibrations: { [ids.ingestId]: views },
    grades: {},
  };
}

/**
 * A project whose stack holds GF and L1, whose ground floor stands at one transcribed height, whose
 * register holds a column on GF and one under the placeholder label `MEZZ`, on a pinned revision
 * that opened a campaign — and which has measured nothing at all.
 */
export async function stageLevels(page: Page, options: { label?: string } = {}): Promise<StagedLevels> {
  const label = options.label ?? "levels";
  const sheet = await stagePartitionedSheet(page, { label });
  const scope = { tenantId: sheet.tenantId, projectId: sheet.projectId };
  const actor: ActorCtx = { tenantId: sheet.tenantId, userId: await userIdOf(page), actorKind: "human" };

  const acts = await productModule<ActsSeam>("src/core/acts/index.ts");
  const perform = async (input: Record<string, unknown>): Promise<Record<string, unknown>> => {
    const consequence = await acts.preview(actor, input);
    return acts.commit(actor, input, acts.consequenceDigest(consequence));
  };

  /* --- the stack the walk begins on: two levels, inserted by the act that inserts levels --- */
  await perform({ type: "INSERT_LEVEL", projectId: sheet.projectId, levels: [{ label: GROUND_LEVEL, ordinal: 0 }] });
  await perform({ type: "INSERT_LEVEL", projectId: sheet.projectId, levels: [{ label: UPPER_LEVEL, ordinal: 1 }] });

  const levels = await productModule<LevelsSeam>("src/modules/takeoff/levels/index.ts");
  const stack = await levels.levelStackOf(scope);
  const standing = (wanted: string): StackLevel => {
    const held = stack.find((level) => level.label === wanted);
    expect(held, `the level ${wanted} stands on the staged project: ${JSON.stringify(stack.map((level) => level.label))}`).toBeTruthy();
    return held as StackLevel;
  };
  const groundLevelId = standing(GROUND_LEVEL).levelId;
  const upperLevelId = standing(UPPER_LEVEL).levelId;

  /* --- GF's height, transcribed off the sheet: the reading the walk's own then competes with --- */
  await perform({
    type: "AUTHOR_STOREY_HEIGHT",
    projectId: sheet.projectId,
    levelId: groundLevelId,
    basis: TRANSCRIBED,
    sourceKey: SYNTHETIC_SOURCES.height,
    valueAsWritten: GROUND_HEIGHT.value,
    unitAsWritten: GROUND_HEIGHT.unit,
  });
  const read = (await levels.levelStackOf(scope)).find((level) => level.levelId === groundLevelId);
  expect(
    (read as StackLevel).height.current.length,
    `${GROUND_LEVEL} stands at exactly one reading before the walk makes its own: ${JSON.stringify(read)}`,
  ).toBe(1);

  /* --- the pinned revision, which is what opens the campaign (L-REG-07) --- */
  const sets = await productModule<SetsSeam>("src/modules/takeoff/sets/index.ts");
  const created = await sets.createSet(scope, { userId: actor.userId }, `${label}-set-${randomUUID().slice(0, 8)}`);
  const setId = String(created["setId"]);
  await sets.toggleMember(scope, setId, sheet.drawingId);
  await perform({ type: "PIN_DRAWING_SET", projectId: sheet.projectId, setId });

  const campaigns = await productModule<CampaignsSeam>("src/core/campaigns/index.ts");
  const open = await campaigns.campaignsOf(scope);
  expect(open.length, `pinning the set opened a campaign: ${JSON.stringify(open)}`).toBeGreaterThan(0);
  const campaign = open[open.length - 1] as Record<string, unknown>;
  const campaignId = String(campaign["campaignId"]);
  const setRevisionId = String(campaign["setRevisionId"]);

  /* --- one column on GF, and one under the placeholder label no act has inserted yet --- */
  const register = await productModule<RegisterSeam>("src/modules/takeoff/register/index.ts");
  const registerScope = { ...scope, setRevisionId };
  const sightings = [sightingOn({ levelId: groundLevelId }, GROUND_MARK, 1000), sightingOn({ unregistered: PLACEHOLDER_LEVEL }, PLACEHOLDER_MARK, 1100)];
  for (const sighting of sightings) {
    const answer = await register.registerSighting(registerScope, sighting);
    expect(answer["registered"], `the sighting of ${String(sighting["mark"])} registered: ${JSON.stringify(answer)}`).toBe(true);
  }
  const rows = await register.registerObjectsOf(registerScope);
  expect(rows.length, `the staged revision holds one row per column sighted: ${JSON.stringify(rows.map((row) => row["mark"]))}`).toBe(sightings.length);

  /* --- and nothing measured: the campaign's lines are published after the contest (AC-4) --- */
  const registerUi = await productModule<RegisterUiSeam>("src/modules/takeoff/register-ui/server.ts");
  const view = await registerUi.registerViewOf(scope);
  expect(view.lines, `the stage leaves the campaign unmeasured, so the walk's insert names no line re-deriving: ${JSON.stringify(view.lines)}`).toEqual([]);

  return { ...scope, groundLevelId, upperLevelId, campaignId, setRevisionId, drawingId: sheet.drawingId, ingestId: sheet.ingestId };
}

/**
 * The campaign's lines, published through the gate over the stack AS IT STANDS NOW — which is the
 * whole point of publishing here rather than at staging time: GF's height is contested by the time
 * this runs, so the rail omits H under `STOREY_HEIGHT_CONTESTED` and the gate publishes the ground
 * floor's line as PARTIAL_DECLARED (L-MEA-07, L-QTY-02).
 *
 * It answers the line ids standing on the GROUND FLOOR — the lines a further reading of that level's
 * height would re-derive, which is what the walk then looks for in the act's own Consequence.
 */
export async function publishLines(staged: StagedLevels): Promise<string[]> {
  const scope = { tenantId: staged.tenantId, projectId: staged.projectId };
  const register = await productModule<RegisterSeam>("src/modules/takeoff/register/index.ts");
  const rows = await register.registerObjectsOf({ ...scope, setRevisionId: staged.setRevisionId });
  const levels = await productModule<LevelsSeam>("src/modules/takeoff/levels/index.ts");
  const stack = await levels.levelStackOf(scope);

  const rail = await productModule<RailSeam>("src/modules/takeoff/rails/columns/index.ts");
  const offers = rail.columnConcreteRail({
    campaignId: staged.campaignId,
    setRevisionId: staged.setRevisionId,
    kind: RCC_CONCRETE,
    objects: rows,
    setup: setupFor(rows, stack, { drawingId: staged.drawingId, ingestId: staged.ingestId }),
  }).offers;
  expect(offers.length, `the rail offers the staged columns: ${offers.length}`).toBeGreaterThan(0);

  const gate = await productModule<GateSeam>("src/core/gate/index.ts");
  const verdict = await gate.evaluateOffers({ ...scope, campaignId: staged.campaignId }, { offers, observations: [] });
  expect(JSON.stringify(verdict.refusals ?? []), `the staged batch published rather than refusing: ${JSON.stringify(verdict)}`).toBe("[]");
  expect(verdict.published, `the offers were published as lines: ${JSON.stringify(verdict)}`).toBeGreaterThan(0);

  const registerUi = await productModule<RegisterUiSeam>("src/modules/takeoff/register-ui/server.ts");
  const view = await registerUi.registerViewOf(scope);
  const onGround = new Set(rows.filter((row) => String(row["levelId"] ?? "") === staged.groundLevelId).map((row) => String(row["objectKey"])));
  const published = view.lines.filter((line) => line.kind === RCC_CONCRETE && onGround.has(line.objectKey)).map((line) => line.lineId);
  expect(
    published.length,
    `the ground floor bears the published ${RCC_CONCRETE} lines the walk reads its roll-up off: ${JSON.stringify(view.lines)}`,
  ).toBeGreaterThan(0);
  return published;
}
