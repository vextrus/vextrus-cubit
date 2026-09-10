/**
 * The stage J-021's REGISTER leg walks (test contract: `stageRegister`).
 *
 * Mechanics only — nothing here judges the product. The person, the project, the drawing and its
 * reading come from the stage J-021's own views leg already runs on (`../viewer/viewer-partition-stage`):
 * one invariant, one home (B-17, ARCH-02). What this file adds is what a REGISTER needs beyond a
 * partitioned sheet — a level, a pinned drawing-set revision (which is what opens the campaign), the
 * column sightings the workspace lists, the gate run that publishes their `rcc.concrete` lines and
 * defers the one INTERPRETED offer as a queue item, and the second sighting of one identity the
 * register refuses. A register with no lines is not the register J-021 walks: the lines are the
 * terminus of "partition → placements → member types → column concrete lines", and the partial cell
 * means "some rows refused" only where unrefused rows stand beside them (R-UI-050).
 *
 * Every step is a shipped seam, driven in-process under the journey lane's database exactly as the
 * partition stage drives its own: no table is written by hand and no id is invented.
 *
 * `DATABASE_URL` is pointed at the journeys' database by the stage this file builds on, BEFORE any
 * product module here opens a pool — hence the import order below.
 */
import { randomUUID } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, type Page } from "@playwright/test";
import { stagePartitionedSheet } from "../viewer/viewer-partition-stage";

/** The checkout these journeys run against. */
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

/** A product module of the checkout, by repo-relative path (the journey lane's own idiom). */
async function productModule<T>(relative: string): Promise<T> {
  const specifier: string = join(REPO_ROOT, relative);
  return (await import(specifier)) as T;
}

/** The discipline, level, class and marks the register leg reads (AC-1's checkpoint). */
export const DISCIPLINE = "STRUCTURAL";
export const LEVEL_LABEL = "GF";
export const CLASS_COLUMN = "column";
export const MARKS: readonly string[] = ["C1", "C2", "C3"];

/**
 * The fourth column, whose offer is made INTERPRETED so the gate defers it rather than publishing a
 * line for it: the queue item the workspace lists. Declared once here and imported wherever it is
 * asserted (B-19), so the leg names the row it walks to instead of guessing at an order.
 */
export const INTERPRETED_MARK = "C4";

/**
 * The two codes the register's refusal rows carry — the queue item's cause and the register's own
 * double-count refusal. Both are already registered in the closed taxonomy; the stage below asserts
 * the product answered exactly these, so a spelling that drifted fails at staging time (Q-07).
 */
export const INTERPRETED_UNCORROBORATED = "INTERPRETED_UNCORROBORATED";
export const DUPLICATE_IDENTITY = "DUPLICATE_IDENTITY";

/** The kind the column rail publishes its lines under (the catalogue's own spelling). */
export const RCC_CONCRETE = "rcc.concrete";

/** One published quantity line, as the screen's own reading answers one. */
export type StagedLine = {
  lineId: string;
  objectKey: string;
  formula: string;
  variables: Record<string, { value: string; unit: string }>;
};

/** What the leg is driven against. */
export type StagedRegister = {
  tenantId: string;
  projectId: string;
  campaignId: string;
  setRevisionId: string;
  objectKeys: string[];
  /** The object the INTERPRETED offer deferred — the row `INTERPRETED_UNCORROBORATED` stands on. */
  queuedObjectKey: string;
  /** The object whose second sighting the register refused as a double count. */
  refusedObjectKey: string;
  /** One published `rcc.concrete` line the lines table must show, formula and variables included. */
  line: StagedLine;
};

type ActorCtx = { tenantId: string; userId: string; actorKind: string };

type ActsSeam = {
  preview: (ctx: ActorCtx, input: Record<string, unknown>) => Promise<Record<string, unknown>>;
  commit: (ctx: ActorCtx, input: Record<string, unknown>, digest: string) => Promise<Record<string, unknown>>;
  consequenceDigest: (consequence: Record<string, unknown>) => string;
};

type SetsSeam = {
  drawingLineagesOf: (scope: { tenantId: string; projectId: string }) => Promise<{ drawingId: string; name: string }[]>;
  createSet: (scope: { tenantId: string; projectId: string }, by: { userId: string }, name: string) => Promise<Record<string, unknown>>;
  toggleMember: (scope: { tenantId: string; projectId: string }, setId: string, drawingId: string) => Promise<Record<string, unknown>>;
};

type RegisterSeam = {
  registerSighting: (scope: { tenantId: string; projectId: string; setRevisionId: string }, sighting: Record<string, unknown>) => Promise<Record<string, unknown>>;
  registerObjectsOf: (scope: { tenantId: string; projectId: string; setRevisionId: string }) => Promise<Record<string, unknown>[]>;
};

type CampaignsSeam = { campaignsOf: (scope: { tenantId: string; projectId: string }) => Promise<Record<string, unknown>[]> };

/** One offer, as the rail hands one to the gate (`src/core/offers/contract.ts`). */
type OfferShape = Record<string, unknown> & {
  register: { objectKey: string };
  geometry: Record<string, unknown>;
  bindings: Record<string, Record<string, unknown>>;
};

/** The column rail: a pure function from the register's rows and their setup to offers. */
type RailSeam = { columnConcreteRail: (input: Record<string, unknown>) => { offers: OfferShape[] } };

/** The gate, which judges a batch and writes what it publishes and what it defers, in one go. */
type GateSeam = {
  evaluateOffers: (
    scope: { tenantId: string; projectId: string; campaignId: string },
    batch: { offers: readonly OfferShape[]; observations: readonly unknown[] },
  ) => Promise<{ published: number; refused: number; queued: number; refusals: readonly { objectKey: string; code: string }[] }>;
};

/** The reading the workspace itself renders — used here to READ BACK what the gate wrote (B-19). */
type RegisterUiSeam = {
  registerViewOf: (scope: { tenantId: string; projectId: string }) => Promise<{
    lines: { lineId: string; objectKey: string; kind: string; formula: string; variables: Record<string, { value: string; unit: string }> }[];
    refusals: { code: string; objectKey: string; kind: string | null }[];
  }>;
};

/** The user the browser is signed in as, read from the session the partition stage established. */
async function userIdOf(page: Page): Promise<string> {
  const held = await page.evaluate(() => document.querySelector('[data-testid="shell-user"]')?.getAttribute("data-user-id") ?? null);
  expect(held, "the shell states which account is signed in — the actor every act below is performed by").toBeTruthy();
  return held as string;
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

/** The family the staged columns belong to, the section it carries, and where each was read. */
const MEMBER_FAMILY = "COL-300x450";
const SECTION_SOURCE = "S-101:e:7";
const HEIGHT_SOURCE = "S-101:e:3";
const CALIBRATION_KEY = "S-101:PLAN:scale";

/**
 * What the register's rows are read against (`RailSetup`): one placement per row on the staged
 * drawing and its ingest, one section for the family they share, the level they stand on with its
 * storey height AGREED, and the affirmed calibration of the view they were sighted in.
 *
 * The ids are the ones this run staged — a rail is handed data, so nothing here is invented that the
 * journey does not already hold.
 */
function setupFor(rows: readonly Record<string, unknown>[], ids: { drawingId: string; ingestId: string; levelId: string }): Record<string, unknown> {
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
      sourceEntity: String(row["placementKey"]),
    };
    views[viewKey] = CALIBRATION_KEY;
  }
  return {
    placements,
    memberTypes: {
      [ids.ingestId]: {
        [MEMBER_FAMILY]: [
          { variantKey: MEMBER_FAMILY, bandFrom: null, bandTo: null, sectionText: "300x450", sectionWidth: 300, sectionDepth: 450, sectionUnit: "mm", sourceKeys: [SECTION_SOURCE] },
        ],
      },
    },
    levels: [{ levelId: ids.levelId, label: LEVEL_LABEL, ordinal: 0, height: { standing: "AGREED", value: "3", unit: "M", basis: "TRANSCRIBED", sourceKey: HEIGHT_SOURCE } }],
    calibrations: { [ids.ingestId]: views },
    grades: {},
  };
}

/**
 * One offer, said to be INTERPRETED: the geometry carries the basis the gate defers on, and every
 * binding carries it too, so the roll-up says the same thing however the gate weighs its inputs.
 */
function interpretedOffer(offer: OfferShape): OfferShape {
  const bindings: Record<string, Record<string, unknown>> = {};
  for (const [name, measure] of Object.entries(offer.bindings)) bindings[name] = { ...measure, basis: "INTERPRETED" };
  return { ...offer, geometry: { ...offer.geometry, basis: "INTERPRETED" }, bindings };
}

/**
 * A project whose register holds four column objects on one level of a pinned revision — three
 * measured into published `rcc.concrete` lines, one deferred as a queue item — with one sighting
 * refused as a double count: the shape J-021's register leg reads.
 */
export async function stageRegister(page: Page, options: { label?: string } = {}): Promise<StagedRegister> {
  const label = options.label ?? "register";
  const sheet = await stagePartitionedSheet(page, { label });
  const userId = await userIdOf(page);
  const actor: ActorCtx = { tenantId: sheet.tenantId, userId, actorKind: "human" };
  const scope = { tenantId: sheet.tenantId, projectId: sheet.projectId };

  const acts = await productModule<ActsSeam>("src/core/acts/index.ts");
  const perform = async (input: Record<string, unknown>): Promise<Record<string, unknown>> => {
    const consequence = await acts.preview(actor, input);
    return acts.commit(actor, input, acts.consequenceDigest(consequence));
  };

  /* --- the level the sightings stand on --- */
  await perform({ type: "INSERT_LEVEL", projectId: sheet.projectId, levels: [{ label: LEVEL_LABEL, ordinal: 0 }] });
  const levels = await productModule<{ levelsOf?: (scope: { tenantId: string; projectId: string }) => Promise<Record<string, unknown>[]> }>("src/modules/takeoff/levels/index.ts");
  const stack = levels.levelsOf === undefined ? [] : await levels.levelsOf(scope);
  const ground = stack.find((level) => String(level["label"]) === LEVEL_LABEL);
  expect(ground, `the level ${LEVEL_LABEL} stands on the staged project: ${JSON.stringify(stack)}`).toBeTruthy();
  const levelId = String((ground as Record<string, unknown>)["levelId"]);

  /* --- the pinned revision, which is what opens the campaign (L-REG-07) --- */
  const sets = await productModule<SetsSeam>("src/modules/takeoff/sets/index.ts");
  const created = await sets.createSet(scope, { userId }, `${label}-set-${randomUUID().slice(0, 8)}`);
  const setId = String(created["setId"]);
  await sets.toggleMember(scope, setId, sheet.drawingId);
  await perform({ type: "PIN_DRAWING_SET", projectId: sheet.projectId, setId });

  const campaigns = await productModule<CampaignsSeam>("src/core/campaigns/index.ts");
  const open = await campaigns.campaignsOf(scope);
  expect(open.length, `pinning the set opened a campaign: ${JSON.stringify(open)}`).toBeGreaterThan(0);
  const campaign = open[open.length - 1] as Record<string, unknown>;
  const campaignId = String(campaign["campaignId"]);
  const setRevisionId = String(campaign["setRevisionId"]);

  /* --- the objects: the three the leg reads, and the fourth whose offer is INTERPRETED --- */
  const register = await productModule<RegisterSeam>("src/modules/takeoff/register/index.ts");
  const registerScope = { tenantId: sheet.tenantId, projectId: sheet.projectId, setRevisionId };
  const sightings = [...MARKS, INTERPRETED_MARK].map((mark, at) => sightingOf(mark, at, levelId));
  for (const sighting of sightings) {
    const answer = await register.registerSighting(registerScope, sighting);
    expect(answer["registered"], `the sighting of ${String(sighting["mark"])} registered: ${JSON.stringify(answer)}`).toBe(true);
  }

  const rows = await register.registerObjectsOf(registerScope);
  expect(rows.length, `the staged revision holds one row per column sighted: ${JSON.stringify(rows.map((row) => row["mark"]))}`).toBe(sightings.length);
  const objectKeys = rows.map((row) => String(row["objectKey"]));
  const interpretedRow = rows.find((row) => String(row["mark"]) === INTERPRETED_MARK);
  expect(interpretedRow, `the column ${INTERPRETED_MARK} stands in the register: ${JSON.stringify(rows.map((row) => row["mark"]))}`).toBeTruthy();
  const queuedObjectKey = String((interpretedRow as Record<string, unknown>)["objectKey"]);

  /* --- the lines: the rail's offers, published by the gate, the last of them deferred --- */
  const rail = await productModule<RailSeam>("src/modules/takeoff/rails/columns/index.ts");
  const gate = await productModule<GateSeam>("src/core/gate/index.ts");
  const offered = rail.columnConcreteRail({
    campaignId,
    setRevisionId,
    kind: RCC_CONCRETE,
    objects: rows,
    setup: setupFor(rows, { drawingId: sheet.drawingId, ingestId: sheet.ingestId, levelId }),
  }).offers;
  expect(offered.length, `the rail offers each staged column once: ${offered.length}`).toBe(sightings.length);

  const batch = offered.map((offer) => (offer.register.objectKey === queuedObjectKey ? interpretedOffer(offer) : offer));
  const verdict = await gate.evaluateOffers({ tenantId: sheet.tenantId, projectId: sheet.projectId, campaignId }, { offers: batch, observations: [] });
  expect(JSON.stringify(verdict.refusals ?? []), `the staged batch published and deferred rather than refusing: ${JSON.stringify(verdict)}`).toBe("[]");
  expect(verdict.published, `the measured offers were published as lines: ${JSON.stringify(verdict)}`).toBeGreaterThan(0);
  expect(verdict.queued, `and the INTERPRETED offer was deferred, not published: ${JSON.stringify(verdict)}`).toBe(1);

  /* --- the second sighting of one identity, which the register refuses as a double count --- */
  const twice = await register.registerSighting(registerScope, sightings[0] as Record<string, unknown>);
  expect(twice["registered"], `a second sighting of one identity is refused: ${JSON.stringify(twice)}`).toBe(false);
  expect(String(twice["refusal"]), `and the refusal is ${DUPLICATE_IDENTITY}: ${JSON.stringify(twice)}`).toBe(DUPLICATE_IDENTITY);
  const refusedObjectKey = String(twice["objectKey"]);

  /*
   * What the workspace will read, read here through the same seam it reads it with: the staged shape
   * is asserted as a RULE — a published line of this kind standing on a registered column, carrying a
   * formula and the bindings its variables are read from, and exactly one deferral of the registered
   * cause — rather than as a count or an order transcribed from today's fixture (B-19).
   */
  const registerUi = await productModule<RegisterUiSeam>("src/modules/takeoff/register-ui/server.ts");
  const view = await registerUi.registerViewOf(scope);

  const published = view.lines.filter((line) => line.kind === RCC_CONCRETE && objectKeys.includes(line.objectKey));
  expect(published.length, `the campaign's reading holds the published ${RCC_CONCRETE} lines of its registered columns: ${JSON.stringify(view.lines)}`).toBeGreaterThan(0);
  const line = published[0] as StagedLine;
  expect(line.formula.length, `a published line states the formula it was measured by: ${JSON.stringify(line)}`).toBeGreaterThan(0);
  expect(Object.keys(line.variables).length, `and the bindings its variables are read from: ${JSON.stringify(line)}`).toBeGreaterThan(0);
  for (const [name, binding] of Object.entries(line.variables)) {
    expect(`${binding.value}${binding.unit}`.length, `the variable ${name} was read as a value in a unit: ${JSON.stringify(binding)}`).toBeGreaterThan(0);
  }

  const deferred = view.refusals.filter((refusal) => refusal.code === INTERPRETED_UNCORROBORATED);
  expect(deferred.length, `exactly one sighting stands deferred as ${INTERPRETED_UNCORROBORATED}: ${JSON.stringify(view.refusals)}`).toBe(1);
  expect((deferred[0] as { objectKey: string }).objectKey, `and it is the column ${INTERPRETED_MARK} whose offer was INTERPRETED`).toBe(queuedObjectKey);
  expect(
    view.refusals.filter((refusal) => refusal.code === DUPLICATE_IDENTITY).length,
    `and one sighting stands refused as ${DUPLICATE_IDENTITY}: ${JSON.stringify(view.refusals)}`,
  ).toBe(1);

  return { tenantId: sheet.tenantId, projectId: sheet.projectId, campaignId, setRevisionId, objectKeys, queuedObjectKey, refusedObjectKey, line };
}
