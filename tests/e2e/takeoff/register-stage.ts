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
import { TESTIDS, testIdSelector } from "../../../src/ui/testids";

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

/** Every mark this stage registers, in the order it registers them. */
export const STAGED_MARKS: readonly string[] = [...MARKS, INTERPRETED_MARK];

/**
 * The key ONE PLACEMENT is read at in its own right, defaulted — one per staged mark, DERIVED from
 * the mark rather than transcribed, declared here once and imported wherever it is asserted (B-19).
 *
 * A staged line therefore cites both a key that is its own and keys its siblings share (the view it
 * was read in, the section of its family, its storey height), which is what lets an ask SEPARATE
 * them: over a corpus where every line cited the same keys, "the lines whose keys meet the ask" and
 * "every published line of this drawing" are the same list, and neither the withholding leg nor the
 * de-duplication leg of `linesCiting` is exercised at all. Over a corpus of per-placement keys
 * alone, no ask ever answers more than one line and de-duplication is equally unproved. The union
 * proves both.
 */
export function placementSourceOf(mark: string): string {
  return `S-101:e:${mark}`;
}

/** That rule as a map, over every mark this stage registers — the fixture surface's own home. */
export const PLACEMENT_SOURCES: Readonly<Record<string, string>> = Object.freeze(
  Object.fromEntries(STAGED_MARKS.map((mark) => [mark, placementSourceOf(mark)])),
);

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
  /** The sheet the staged columns were read on — where a Trace from one of their lines lands. */
  drawingId: string;
  layoutName: string;
  /** Where this run's lines cite their evidence: synthetic by default, real handles under `cite`. */
  cited: CitedSources;
  /** The key each placement is read at in its own right, by mark (`PLACEMENT_SOURCES`). */
  placementSources: Readonly<Record<string, string>>;
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
    lines: { lineId: string; objectKey: string; kind: string; formula: string; sourceKeys: string[]; variables: Record<string, { value: string; unit: string }> }[];
    refusals: { code: string; objectKey: string; kind: string | null }[];
  }>;
};

/** The user the browser is signed in as, read from the session the partition stage established. */
async function userIdOf(page: Page): Promise<string> {
  const held = await page.evaluate(() => document.querySelector(testIdSelector(TESTIDS.shell.user))?.getAttribute("data-user-id") ?? null);
  expect(held, "the shell states which account is signed in — the actor every act below is performed by").toBeTruthy();
  return held as string;
}

/**
 * Where a staged line's evidence is cited. The defaults are synthetic keys the served sheet does not
 * hold, which is all `tests/e2e/register.spec.ts` ever needed; J-021 hands in REAL `DXF_HANDLE:` keys
 * read off the layer feed (j-020's idiom, risk note 1), so a Trace from one of these lines lands on
 * entities the sheet in fact holds rather than in I-88's "Not on this sheet" cell.
 */
export type CitedSources = {
  /** What the sighting was read at — the entity the register's own content stands on. */
  evidence: string;
  /** Where the family's section was read: a key EVERY staged line cites, whatever its mark. */
  section: string;
  /** Where the level's storey height was transcribed: the second key they all share. */
  height: string;
};

/** The synthetic defaults: keys of the register's own grammar, on no sheet the viewer serves. */
export const SYNTHETIC_SOURCES: CitedSources = Object.freeze({ evidence: "S-101:e:41", section: "S-101:e:7", height: "S-101:e:3" });

/**
 * How many keys a caller's `cite` list is read for: the three shared ones above, then one per staged
 * mark — the key that placement alone was read at. Derived from both rosters rather than counted by
 * hand, so a mark added to the stage asks the sheet for one more entity (B-19).
 */
export const CITE_KEYS: number = Object.keys(SYNTHETIC_SOURCES).length + STAGED_MARKS.length;

/**
 * What a caller's `cite` list means, position by position, defaulted where it is short. It arrives
 * as a callback because the keys are read off the SERVED SHEET, which only exists once the stage
 * below has built it — the journey asks the layer feed, and hands back what the sheet in fact holds.
 */
export type CiteKeys = (sheet: { tenantId: string; drawingId: string; layoutName: string; ingestId: string }) => Promise<readonly string[]>;

/** The shared keys and the per-placement ones, as this run cites them. */
type StagedCitations = { cited: CitedSources; placementSources: Readonly<Record<string, string>> };

function citationsFrom(cite: readonly string[] | undefined): StagedCitations {
  const keys = cite ?? [];
  const shared = Object.keys(SYNTHETIC_SOURCES).length;
  const cited: CitedSources =
    keys.length === 0
      ? SYNTHETIC_SOURCES
      : { evidence: keys[0] as string, section: (keys[1] ?? keys[0]) as string, height: (keys[2] ?? keys[0]) as string };
  return {
    cited,
    placementSources: Object.freeze(
      Object.fromEntries(STAGED_MARKS.map((mark, at) => [mark, keys[shared + at] ?? (PLACEMENT_SOURCES[mark] as string)])),
    ),
  };
}

/** One column sighting, as the register's door is given one (the door's own `Sighting`). */
function sightingOf(mark: string, at: number, levelId: string, cited: CitedSources): Record<string, unknown> {
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
      evidence: [cited.evidence],
      attributes: { concrete_grade: "C30/37" },
      geometry: { outline: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }], span: { length: "300.0", breadth: "300.0" } },
      source: { sheet: "S-101", anchor: "S-101:t:12" },
    },
  };
}

/** The family the staged columns belong to, and the calibration the view was scaled by. */
const MEMBER_FAMILY = "COL-300x450";
const CALIBRATION_KEY = "S-101:PLAN:scale";

/**
 * What the register's rows are read against (`RailSetup`): one placement per row on the staged
 * drawing and its ingest, one section for the family they share, the level they stand on with its
 * storey height AGREED, and the affirmed calibration of the view they were sighted in.
 *
 * Each placement's GEOMETRY is read at a key of its own (`placementSourceOf`), while the section it
 * takes and the storey height it stands at are read at keys its siblings share — so a published
 * line's cited keys compose to {its own key, the view, the section, the height} and the staged lines
 * differ in exactly one coordinate. That is what a `linesCiting` ask needs in order to separate them.
 *
 * The ids are the ones this run staged — a rail is handed data, so nothing here is invented that the
 * journey does not already hold.
 */
function setupFor(
  rows: readonly Record<string, unknown>[],
  ids: { drawingId: string; ingestId: string; levelId: string },
  cited: CitedSources,
  placementSources: Readonly<Record<string, string>>,
): Record<string, unknown> {
  const placements: Record<string, Record<string, unknown>> = {};
  const views: Record<string, string> = {};
  for (const row of rows) {
    const mark = String(row["mark"]);
    const viewKey = String(row["viewKey"]);
    placements[String(row["placementKey"])] = {
      drawingId: ids.drawingId,
      ingestId: ids.ingestId,
      viewKey,
      memberFamily: MEMBER_FAMILY,
      engine: "VECTOR",
      sourceEntity: placementSources[mark] ?? placementSourceOf(mark),
    };
    views[viewKey] = CALIBRATION_KEY;
  }
  return {
    placements,
    memberTypes: {
      [ids.ingestId]: {
        [MEMBER_FAMILY]: [
          { variantKey: MEMBER_FAMILY, bandFrom: null, bandTo: null, sectionText: "300x450", sectionWidth: 300, sectionDepth: 450, sectionUnit: "mm", sourceKeys: [cited.section] },
        ],
      },
    },
    levels: [{ levelId: ids.levelId, label: LEVEL_LABEL, ordinal: 0, height: { standing: "AGREED", value: "3", unit: "M", basis: "TRANSCRIBED", sourceKey: cited.height } }],
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
export async function stageRegister(page: Page, options: { label?: string; cite?: CiteKeys } = {}): Promise<StagedRegister> {
  const label = options.label ?? "register";
  const sheet = await stagePartitionedSheet(page, { label });
  const { cited, placementSources } = citationsFrom(options.cite === undefined ? undefined : [...(await options.cite(sheet))]);
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
  const sightings = STAGED_MARKS.map((mark, at) => sightingOf(mark, at, levelId, cited));
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
    setup: setupFor(rows, { drawingId: sheet.drawingId, ingestId: sheet.ingestId, levelId }, cited, placementSources),
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

  /*
   * And the staged lines must be SEPARABLE, which is what makes the Trace's other direction an
   * answer rather than a list of the sheet: each published line cites a key no sibling cites (so an
   * ask can withhold the others) and a key its siblings share (so an ask can gather them all, each
   * once). Read off what the reading in fact answered, so a stage that stopped discriminating fails
   * here rather than standing a checkpoint on a predicate nothing exercised.
   */
  expect(published.length, `the staged campaign publishes a line per measured mark, so an ask has lines to tell apart: ${JSON.stringify(published.map((row) => row.objectKey))}`).toBeGreaterThan(1);
  for (const held of published) {
    const siblings = published.filter((row) => row.lineId !== held.lineId).flatMap((row) => row.sourceKeys);
    expect(
      held.sourceKeys.filter((key) => !siblings.includes(key)),
      `${held.objectKey} cites a key no other staged line cites: ${JSON.stringify(held.sourceKeys)}`,
    ).not.toEqual([]);
    expect(
      held.sourceKeys.filter((key) => siblings.includes(key)),
      `and a key its siblings cite too: ${JSON.stringify(held.sourceKeys)}`,
    ).not.toEqual([]);
  }

  const deferred = view.refusals.filter((refusal) => refusal.code === INTERPRETED_UNCORROBORATED);
  expect(deferred.length, `exactly one sighting stands deferred as ${INTERPRETED_UNCORROBORATED}: ${JSON.stringify(view.refusals)}`).toBe(1);
  expect((deferred[0] as { objectKey: string }).objectKey, `and it is the column ${INTERPRETED_MARK} whose offer was INTERPRETED`).toBe(queuedObjectKey);
  expect(
    view.refusals.filter((refusal) => refusal.code === DUPLICATE_IDENTITY).length,
    `and one sighting stands refused as ${DUPLICATE_IDENTITY}: ${JSON.stringify(view.refusals)}`,
  ).toBe(1);

  return {
    tenantId: sheet.tenantId,
    projectId: sheet.projectId,
    drawingId: sheet.drawingId,
    layoutName: sheet.layoutName,
    campaignId,
    setRevisionId,
    objectKeys,
    queuedObjectKey,
    refusedObjectKey,
    cited,
    placementSources,
    line,
  };
}
