/**
 * The stage the register workspace's READING, its DOORS and its two acts are judged over
 * (inc-214-register-workspace: R-TO-050, R-TO-051, L-ACT-01, L-ACT-02).
 *
 * Mechanics only — nothing here judges the product. A campaign is staged exactly as the gate's own
 * suites stage one, through the shipped seams and never around them: a project made through its
 * door, a level inserted by act, a drawing set pinned by act (which is what opens the campaign),
 * column sightings registered at the register's door, and the gate publishing the rail's offers.
 * What this file adds is what the REGISTER WORKSPACE needs beyond a measured campaign — a queue item
 * and a refused sighting standing beside the published lines, and one transcribed reading to
 * corroborate against.
 *
 * Product modules are loaded by absolute path (`productModule`), so a file the Builder has not
 * written yet fails as an assertion naming it rather than as a collection death that would read as a
 * defect in the acceptance. Every type of a not-yet-written surface is a loose local shape, so this
 * file typechecks against today's tree and grades tomorrow's.
 *
 * Nothing here reads product source: every name below is one the increment's interfaces, its test
 * contract or the Bible publishes.
 *
 * This file serves both lanes — the public suites beside it and the held-out set, which loads it
 * from the checkout by absolute path. Keep it free of judgement so neither lane can hide one here.
 */
import { randomUUID } from "node:crypto";
import { expect } from "vitest";
import {
  COLUMN_C1,
  COLUMN_CLASS,
  COLUMN_CONCRETE_PAIR,
  MEMBER_FAMILY,
  QUANTITY_LINES_TABLE,
  QUEUE_ITEMS_TABLE,
  RCC_CONCRETE,
  closeStage,
  columnRailDoor,
  field,
  gateSeam,
  productModule,
  railInput,
  rowsOfCampaign,
  setupForRows,
  stageCampaign,
  storeRows,
  type ColumnOfferShape,
  type StagedCampaign,
  type StoreRow,
} from "../../rails/support/column-rail-stage";
import { writtenAtV3 } from "../../../cad/support/entitygraph-versions";
import { measureSeam, type MeasureSeam } from "../../gate/support/gate-stage";
import { INGEST_JOB_MODULE, INGEST_MODULE, UPLOADS_MODULE, stubCli, tempDir, withCadCommand } from "../../support/ingest-stage";
import { PRINCIPAL, actorOf, grantRole, joinWorkspace, rejection, stagePerson, unique, type ActorCtx, type Person } from "../../support/sheets-stage";
import { sql } from "../../../spine/uploads/support/upload-stage";
import { TENANT_COLUMN } from "../../../../db/__tests__/support/fixtures";
import { ident, lit } from "../../../../db/__tests__/support/live-sql";

/** The partition's placement store and the tenant seam, which the drawn plan's members are written through. */
const PLACEMENT_STORE_MODULE = "src/modules/takeoff/partition/placement/store.ts";
const DB_SEAM_MODULE = "src/core/db.ts";

export { COLUMN_CLASS, QUANTITY_LINES_TABLE, QUEUE_ITEMS_TABLE, RCC_CONCRETE, actorOf, closeStage, field, gateSeam, measureSeam, productModule, rejection, rowsOfCampaign, sql, stagePerson, storeRows, unique };
export type { ActorCtx, MeasureSeam, Person, StagedCampaign, StoreRow };

/* ------------------------------------------------------------------ the homes the spec names */

/** The takeoff lane's router — the one home of this screen's eight doors (test contract). */
export const TAKEOFF_ROUTER_MODULE = "src/server/routers/takeoff.ts";

/** The reading the workspace renders (goal, interfaces). */
export const REGISTER_UI_SERVER_MODULE = "src/modules/takeoff/register-ui/server.ts";

/** The register's door, which the CORROBORATE act appends through (interfaces). */
export const REGISTER_MODULE = "src/modules/takeoff/register/index.ts";

/** The two act renderings this increment lands (interfaces). */
export const CORROBORATE_MODULE = "src/core/acts/corroborate.ts";
export const REPUDIATE_MODULE = "src/core/acts/repudiate.ts";

/** The act law and the total map the two act types join (interfaces, L-ACT-02). */
export const ACTS_MODULE = "src/core/acts/index.ts";
export const ACTS_LAW_MODULE = "src/core/acts/law.ts";

/** The measure door inc-209 landed, which the Measure door on this screen asks through (AC-8). */
export const MEASURE_MODULE = "src/modules/takeoff/measure/index.ts";

/** The refusal register — the one home of a code's message and remedy. */
export const ERRORS_MODULE = "src/core/errors.ts";

/** The marker a refusal is carried to its caller by (ARCH-03). */
export const REFUSAL_MARKER_MODULE = "src/core/faults/refusal-marker.ts";

/* ------------------------------------------------------------ the vocabulary the spec spells */

/** The two act types this increment adds, and the permission both move (interfaces, AC-5). */
export const CORROBORATE = "CORROBORATE";
export const REPUDIATE = "REPUDIATE";
export const MEASURE = "MEASURE";

/** The act the level stack confirms as (AC-8), and the permission it moves. */
export const INSERT_LEVEL = "INSERT_LEVEL";

/** The codes the seam and the doors answer by name. */
export const CONSEQUENCES_NOT_CARRIED = "CONSEQUENCES_NOT_CARRIED";
export const ACT_CHANGES_NOTHING = "ACT_CHANGES_NOTHING";
export const PERMISSION_NOT_HELD = "PERMISSION_NOT_HELD";
export const READING_NOT_NUMERIC = "READING_NOT_NUMERIC";
export const CAMPAIGN_NOT_FOUND = "CAMPAIGN_NOT_FOUND";
export const INTERPRETED_UNCORROBORATED = "INTERPRETED_UNCORROBORATED";
export const DUPLICATE_IDENTITY = "DUPLICATE_IDENTITY";

/** The role that holds nothing this screen's acts move (AC-5's denial). */
export const REVIEWER = "REVIEWER";

/** How a reading says where it came from (AC-5: a CORROBORATE appends at basis ENTERED). */
export const TRANSCRIBED = "TRANSCRIBED";
export const ENTERED = "ENTERED";

/** The basis a rail offers an uncorroborated reading at — what the gate queues (AC-4). */
export const INTERPRETED = "INTERPRETED";

/** The one attribute these criteria read and write, and the reading it is first transcribed as. */
export const SIZE = "size";
export const FIRST_VALUE = "300";
export const FIRST_UNIT = "mm";

/** The store this increment's two acts are read out of. */
export const ACTS_TABLE = "acts";
export const REGISTER_OBSERVATIONS_TABLE = "register_observations";
export const REGISTER_OBJECTS_TABLE = "register_objects";
export const REPUDIATED_OBJECTS_TABLE = "repudiated_objects";
export const REFUSED_SIGHTINGS_TABLE = "refused_sightings";
export const LEVELS_TABLE = "levels";
export const JOBS_TABLE = "jobs";

/* ------------------------------------------------------------------------- loading the doors */

/** What one call at the register's door answers, however the store spells its columns (C-05). */
export type Answer = Record<string, unknown>;

/** The register door this stage drives (shipped, inc-208). */
export type RegisterSeam = {
  registerSighting: (scope: { tenantId: string; projectId: string; setRevisionId: string }, sighting: Record<string, unknown>) => Promise<Answer>;
  registerObjectsOf: (scope: { tenantId: string; projectId: string; setRevisionId: string }) => Promise<Answer[]>;
  appendObservation: (scope: { tenantId: string; projectId: string; setRevisionId: string }, input: Record<string, unknown>) => Promise<Answer>;
  attributeStanding: (scope: { tenantId: string; projectId: string; setRevisionId: string }, objectKey: string, attribute: string) => Promise<Answer>;
  observationsOf: (scope: { tenantId: string; projectId: string; setRevisionId: string }, objectKey: string, attribute: string) => Promise<Answer[]>;
};

export async function registerSeam(): Promise<RegisterSeam> {
  return productModule<RegisterSeam>(REGISTER_MODULE);
}

/** The refusal register, read from its one home so nothing here re-spells a code (ARCH-02). */
export type RefusalEntryShape = { code: string; message: string; remedy: string; severity: string; surface: string };

export async function refusalRegister(): Promise<Readonly<Record<string, RefusalEntryShape | undefined>>> {
  const errors = await productModule<{ REFUSALS: Readonly<Record<string, RefusalEntryShape | undefined>> }>(ERRORS_MODULE);
  return errors.REFUSALS;
}

/** The refusal code a failure carries, whether it arrived bare or wrapped by a transport. */
export async function codeOf(failure: unknown): Promise<string | null> {
  const { refusalCodeOf } = await productModule<{ refusalCodeOf: (e: unknown) => string | null }>(REFUSAL_MARKER_MODULE);
  const direct = refusalCodeOf(failure);
  if (direct !== null) return direct;
  const cause = (failure as { cause?: unknown } | null)?.cause;
  return cause === undefined ? null : refusalCodeOf(cause);
}

/** Every door of the takeoff lane, as a caller wearing one person's session reaches them. */
export type TakeoffCaller = Record<string, (input: unknown) => Promise<unknown>>;

/**
 * The takeoff lane, called as a signed-in person — the transport the screen itself uses, so a door
 * asserted here is the door the reader presses (the confirm-discipline precedent).
 */
export async function takeoffCaller(person: Person): Promise<TakeoffCaller> {
  const router = await productModule<{ takeoffRouter?: { createCaller: (ctx: unknown) => TakeoffCaller } }>(TAKEOFF_ROUTER_MODULE);
  expect(typeof router.takeoffRouter?.createCaller, `${TAKEOFF_ROUTER_MODULE} publishes the takeoff lane's router`).toBe("function");
  const here = "http://127.0.0.1";
  return (router.takeoffRouter as { createCaller: (ctx: unknown) => TakeoffCaller }).createCaller({
    requestId: randomUUID(),
    actor: "an-account",
    origin: here,
    statedOrigin: null,
    requestOrigin: here,
    deviceLabel: "acceptance",
    client: "an unobserved caller",
    session: { sessionId: randomUUID(), userId: person.userId },
    secureCookies: false,
    cookies: [],
  });
}

/** One door of the lane, asserted to be on the wire before it is called (test contract). */
export function door(caller: TakeoffCaller, name: string): (input: unknown) => Promise<unknown> {
  const call = caller[name];
  expect(typeof call, `takeoff.${name} is on the wire (the increment's test contract)`).toBe("function");
  return call as (input: unknown) => Promise<unknown>;
}

/* ------------------------------------------------------------------------- staging a campaign */

/** A pinned, measured campaign and everything a criterion of this increment is driven against. */
export type StagedRegisterCampaign = StagedCampaign & {
  /** The register objects of the revision, in the order they were registered. */
  objectKeys: string[];
  /** The source key each object cites, by object key — what the inspector shows as text. */
  sourceKeys: Record<string, string>;
  /** The object whose sighting was refused as a double count (AC-4). */
  refusedObjectKey: string;
  /** The object whose only standing is a queue item (AC-4). */
  queuedObjectKey: string;
  /** The drawing the lines were measured on, as its pinned record reads (VD-1: production's shapes). */
  drawn: DrawnPlan;
};

/* ------------------------------------------------------- the drawing the lines were read on (VD-1) */

/**
 * The drawing a staged campaign's lines are measured on, recorded the way production records one
 * (VD-1, walk-0): an ingest of the very bytes the pin recorded, whose artifact draws a column layout
 * plan in MODEL space — its caption, each column's outline and mark — framed by one paper sheet's
 * window, a schedule cell framed by another sheet's, and a level note no window frames. The rails'
 * lines then cite what real lines cite: a view key anchored at the caption, a placement key per
 * member, and the entities each variable was read at. The placements are written by the partition's
 * own store call (`rewritePlacementRows`, the pile-cap store test's precedent), each with the outline
 * and the mark it was read off.
 */
export type DrawnPlan = {
  readonly drawingId: string;
  readonly ingestId: string;
  /** The view the members were placed in: `LAYOUT_PLAN`, anchored at the caption's own handle. */
  readonly view: { readonly viewClass: string; readonly captionAnchorSourceKey: string };
  /** The paper sheet whose window frames the plan — where a member's Trace opens. */
  readonly planSheet: string;
  /** The paper sheet whose window frames the schedule cell the section was read at. */
  readonly scheduleSheet: string;
  /** Model space, as the artifact's own inventory spells it. */
  readonly modelSheet: string;
  /** The schedule cell every member's section was read at, and the level note its height was read at. */
  readonly sectionCell: string;
  readonly levelNote: string;
  /** Each staged mark's outline and mark entities, by mark. */
  readonly members: Readonly<Record<string, { readonly outlineKey: string; readonly markKey: string }>>;
};

/** The marks the campaign registers, in the order it registers them. */
const STAGED_MARKS: readonly string[] = ["C1", "C2", "C3"];

/** Where each staged column stands in the drawing's world — the register's own sighting coordinates. */
function columnAt(at: number): readonly [number, number] {
  return [1000 + at * 100, (COLUMN_C1 as unknown as { y: number }).y];
}

/** The spaces and sheets the built artifact carries, spelled as the ingest seam spells them. */
const MODEL_SHEET = "model";
const PLAN_SHEET = "S-101 COLUMN LAYOUT PLAN";
const SCHEDULE_SHEET = "S-102 COLUMN SCHEDULE";

/** A source key of the DXF-handle scheme, from an ordinal (L-CAD-02). */
function handleKey(ordinal: number): string {
  return `DXF_HANDLE:${ordinal.toString(16).toUpperCase()}`;
}

/**
 * The artifact the stood-in extractor answers: EntityGraph v2, validated by the product's own mirror
 * at ingest. Returned with the handles it minted, so every expectation is read off it (B-19).
 */
function drawnArtifact(): { json: string; keys: { caption: string; sectionCell: string; levelNote: string; members: Record<string, { outlineKey: string; markKey: string }> } } {
  let ordinal = 0;
  const next = (): string => handleKey((ordinal += 1));
  const colour = { rgb: [0, 0, 0], source: "bylayer" };
  const entities: Record<string, unknown>[] = [];

  const caption = next();
  entities.push({ key: caption, type: "TEXT", space: MODEL_SHEET, layer: "CAPTIONS", colour, text: "COLUMN LAYOUT PLAN", height: 5, points: [[1000, 150]] });
  const members: Record<string, { outlineKey: string; markKey: string }> = {};
  STAGED_MARKS.forEach((mark, at) => {
    const [x, y] = columnAt(at);
    const outlineKey = next();
    entities.push({ key: outlineKey, type: "LWPOLYLINE", space: MODEL_SHEET, layer: "COLUMNS", colour, closed: true, points: [[x - 15, y - 20], [x + 15, y - 20], [x + 15, y + 20], [x - 15, y + 20]] });
    const markKey = next();
    entities.push({ key: markKey, type: "TEXT", space: MODEL_SHEET, layer: "MARKS", colour, text: mark, height: 2, points: [[x, y + 25]] });
    members[mark] = { outlineKey, markKey };
  });
  const sectionCell = next();
  entities.push({ key: sectionCell, type: "TEXT", space: MODEL_SHEET, layer: "SCHEDULE", colour, text: "300x450", height: 2, points: [[5000, 5000]] });
  const levelNote = next();
  entities.push({ key: levelNote, type: "TEXT", space: MODEL_SHEET, layer: "LEVELS", colour, text: "EL +3.000", height: 2, points: [[9000, 9000]] });
  entities.push({ key: next(), type: "TEXT", space: PLAN_SHEET, layer: "TITLEBLOCK", colour, text: PLAN_SHEET, height: 3, points: [[10, 10]] });
  entities.push({ key: next(), type: "TEXT", space: SCHEDULE_SHEET, layer: "TITLEBLOCK", colour, text: SCHEDULE_SHEET, height: 3, points: [[10, 10]] });

  // Each window at 1:2 — `size[1] / view_height` — so a 200 × 125 frame looks at 400 × 250 of model.
  const window = (handle: string, viewCentre: readonly [number, number]) => ({
    handle,
    on: true,
    centre: [148.5, 105],
    size: [200, 125],
    view_centre: [viewCentre[0], viewCentre[1]],
    view_height: 250,
    twist: 0,
    clipped: false,
  });
  const paper = { min: [0, 0], max: [297, 210] };
  // Written as the current extractor writes (EntityGraph v3): the ingest door refuses an older
  // artifact as a stale extractor's before it judges the drawing (FRM3-A, I-415).
  const graph = writtenAtV3({
    entitygraph_version: 3,
    ingest: { scheme: "DXF_HANDLE", tool: "cubit-register-ui-stage", tool_version: "0.0.0", parameter_set_hash: "0".repeat(64) },
    insunits: { code: 4, unit: "mm", unmapped: false },
    layouts: [
      { name: MODEL_SHEET, kind: "model", bbox: { min: [900, 100], max: [9100, 9100] }, strays_rejected: 0, viewports: [] },
      // The plan's window frames x 900..1300, y 100..350: the caption and every column, and nothing else.
      { name: PLAN_SHEET, kind: "paper", bbox: paper, strays_rejected: 0, viewports: [window("A1", [1100, 225])] },
      // The schedule's window frames the section cell alone; the level note stands in no window.
      { name: SCHEDULE_SHEET, kind: "paper", bbox: paper, strays_rejected: 0, viewports: [window("A2", [5000, 5000])] },
    ],
    dropped_layouts: [],
    entities,
    derived: [],
    block_attributes: [],
    counters: [],
  });
  return { json: JSON.stringify(graph), keys: { caption, sectionCell, levelNote, members } };
}

/** The ingest door and job, as this stage drives them (the sheets stage's own shapes). */
type IngestDoor = { ingestRecordOf: (scope: { tenantId: string; drawingId: string }) => Promise<{ ingestId: string } | null> };
type IngestJobDoor = { runIngestJob: (payload: unknown, progress: unknown, deps: { storage: unknown }) => Promise<void> };
type UploadsDoor = { uploadStorage: () => unknown };
type PlacementStore = { rewritePlacementRows: (tx: unknown, write: Record<string, unknown>) => Promise<void> };
type DbSeam = { forTenant: (ctx: { tenantId: string }) => { transaction: (work: (tx: unknown) => Promise<unknown>) => Promise<unknown> } };

/** The drawing the pinned revision names first, and the bytes it recorded (L-REG-06). */
function pinnedDrawingOf(tenantId: string, setRevisionId: string): string {
  const held = sql(
    `select manifest::text from drawing_set_revisions where ${ident(TENANT_COLUMN)} = ${lit(tenantId)}::uuid and set_revision_id = ${lit(setRevisionId)}::uuid;`,
  );
  const manifest = JSON.parse(held[0]?.[0] ?? "[]") as { drawingId: string }[];
  expect(manifest.length, `the pinned revision ${setRevisionId} names the drawings the set holds`).toBeGreaterThan(0);
  return (manifest[0] as { drawingId: string }).drawingId;
}

/** Record the pinned drawing's reading: the shipped ingest job, over the built artifact. */
async function stageDrawnRecord(staged: StagedCampaign, label: string): Promise<{ drawingId: string; ingestId: string; keys: ReturnType<typeof drawnArtifact>["keys"] }> {
  const drawingId = pinnedDrawingOf(staged.tenantId, staged.setRevisionId);
  const artifact = drawnArtifact();
  const stub = stubCli({ artifact: artifact.json, stderr: "", exitCode: 0 });
  const job = await productModule<IngestJobDoor>(INGEST_JOB_MODULE);
  const storage = (await productModule<UploadsDoor>(UPLOADS_MODULE)).uploadStorage();
  await withCadCommand(stub.command, async () => {
    await job.runIngestJob(
      { tenantId: staged.tenantId, drawingId, requestedBy: staged.person.userId, declared: null },
      { jobId: randomUUID(), tempDir: tempDir(`ingest-${label}`), step: async () => undefined },
      { storage },
    );
  });
  const record = await (await productModule<IngestDoor>(INGEST_MODULE)).ingestRecordOf({ tenantId: staged.tenantId, drawingId });
  expect(record, `staging ${label}'s drawing left an ingest record — the lines are read on a recorded reading`).not.toBeNull();
  return { drawingId, ingestId: (record as { ingestId: string }).ingestId, keys: artifact.keys };
}

/** Write the members the plan placed, through the partition's own store call, one per register row. */
async function placeMembers(staged: StagedCampaign, drawn: { drawingId: string; ingestId: string }, rows: readonly Record<string, unknown>[], members: Record<string, { outlineKey: string; markKey: string }>): Promise<void> {
  const store = await productModule<PlacementStore>(PLACEMENT_STORE_MODULE);
  const seam = await productModule<DbSeam>(DB_SEAM_MODULE);
  const placed = rows.map((row) => {
    const mark = String(field(row, "mark", "mark"));
    const member = members[mark];
    expect(member, `the drawn plan carries an outline and a mark for ${mark}`).toBeDefined();
    const [x, y] = columnAt(STAGED_MARKS.indexOf(mark));
    return {
      placementKey: String(field(row, "placementKey", "placement_key")),
      viewKey: String(field(row, "viewKey", "view_key")),
      mark,
      markText: mark,
      elementType: COLUMN_CLASS,
      x,
      y,
      gridLetter: null,
      gridNumeral: null,
      outlineKey: (member as { outlineKey: string }).outlineKey,
      markKey: (member as { markKey: string }).markKey,
      memberFamily: MEMBER_FAMILY,
    };
  });
  await seam.forTenant({ tenantId: staged.tenantId }).transaction(async (tx) =>
    store.rewritePlacementRows(tx, {
      tenantId: staged.tenantId,
      projectId: staged.projectId,
      drawingId: drawn.drawingId,
      ingestId: drawn.ingestId,
      placements: { views: 1, placements: placed, ungridded: [], runs: [], outlines: [] },
    }),
  );
}

/**
 * The rails' setup, read against the drawn record rather than surrogates: each placement on the
 * pinned drawing's ingest, the section read at the schedule cell, the storey height at the level
 * note — so what the published lines cite is what the artifact holds (B-19).
 */
function drawnSetup(setup: ReturnType<typeof setupForRows>, drawn: { drawingId: string; ingestId: string; keys: ReturnType<typeof drawnArtifact>["keys"] }) {
  const placements = Object.fromEntries(Object.entries(setup.placements).map(([key, placement]) => [key, { ...placement, drawingId: drawn.drawingId, ingestId: drawn.ingestId }]));
  const families = Object.values(setup.memberTypes)[0] ?? {};
  const memberTypes = { [drawn.ingestId]: Object.fromEntries(Object.entries(families).map(([family, variants]) => [family, variants.map((one) => ({ ...one, sourceKeys: [drawn.keys.sectionCell] }))])) };
  const levels = setup.levels.map((level) => ({ ...level, height: { ...level.height, sourceKey: level.height.sourceKey === null ? null : drawn.keys.levelNote } }));
  const calibrations = { [drawn.ingestId]: Object.values(setup.calibrations)[0] ?? {} };
  return { placements, memberTypes, levels, calibrations };
}

/** The scope the register's door is called in. */
export function registerScopeOf(staged: StagedRegisterCampaign): { tenantId: string; projectId: string; setRevisionId: string } {
  return staged.registerScope;
}

/**
 * A measured campaign of column objects with a queue item and a refused sighting beside its lines,
 * and one TRANSCRIBED reading of `size` — `300 mm` at precedence 0 — on the first object.
 *
 * Every arm is the product's own: the gate queues the INTERPRETED offer because the offer says
 * INTERPRETED, and the register refuses the second sighting of one identity because the identity is
 * the same one. Nothing is written to a table here by hand.
 */
export async function stageRegisterCampaign(label: string = "register"): Promise<StagedRegisterCampaign> {
  const staged = await stageCampaign(label, { methods: [COLUMN_CONCRETE_PAIR], objects: 0 });
  const register = await registerSeam();
  const rail = await columnRailDoor();
  const gate = await gateSeam();

  /* --- the drawing the pin recorded, read as production reads one (VD-1): its ingest, its artifact --- */
  const record = await stageDrawnRecord(staged, label);
  const view = { viewClass: "LAYOUT_PLAN", captionAnchorSourceKey: record.keys.caption };

  /* --- the objects: three columns of one mark family, sighted at the register's door, in the view
     the drawn plan's caption anchors (a view key production spells: `v:LAYOUT_PLAN:DXF_HANDLE:…`) --- */
  const marks = [...STAGED_MARKS];
  const sightings = marks.map((mark, at) => ({ ...COLUMN_C1, elementType: COLUMN_CLASS, label: `${label}-${mark}`, mark, view, x: columnAt(at)[0], y: columnAt(at)[1] }));
  for (const sighting of sightings) {
    const answer = await register.registerSighting(staged.registerScope, sighting);
    expect(field(answer, "registered", "registered"), `the sighting of ${String(sighting["mark"])} registered: ${JSON.stringify(answer)}`).toBe(true);
  }

  const rows = (await register.registerObjectsOf(staged.registerScope)) as unknown as Record<string, unknown>[];
  expect(rows.length, `the staged campaign ${label} carries the three column rows the rail reads`).toBe(marks.length);
  const objectKeys = rows.map((row) => String(field(row, "objectKey", "object_key")));
  const sourceKeys: Record<string, string> = {};
  for (const row of rows) sourceKeys[String(field(row, "objectKey", "object_key"))] = String(field(row, "placementKey", "placement_key"));

  /* --- the same identity, sighted twice: the register's own double-count refusal (L-REG-03) --- */
  const duplicate = await register.registerSighting(staged.registerScope, sightings[0] as Record<string, unknown>);
  expect(String(field(duplicate, "refusal", "refusal")), `a second sighting of one identity is refused ${DUPLICATE_IDENTITY}: ${JSON.stringify(duplicate)}`).toBe(DUPLICATE_IDENTITY);
  const refusedObjectKey = String(field(duplicate, "objectKey", "object_key"));

  /* --- the members the plan placed, each with the outline and the mark it was read off --- */
  await placeMembers(staged, record, rows, record.keys.members);

  /* --- the lines: the rail's offers, published by the gate; the last one INTERPRETED. Each cites
     what a real line cites: its placement key for the count, the schedule cell for the section, the
     level note for the height (setup.ts:271's `sourceEntity`, VD-1) --- */
  const setup = drawnSetup(setupForRows(rows), record);
  const offered = rail.columnConcreteRail(
    railInput({
      campaignId: staged.campaignId,
      setRevisionId: staged.setRevisionId,
      objects: rows,
      placements: setup.placements,
      memberTypes: setup.memberTypes,
      levels: setup.levels,
      calibrations: setup.calibrations,
    }),
  ).offers;
  expect(offered.length, `the three staged rows are offered once each: ${offered.length}`).toBe(marks.length);

  const measured = offered.slice(0, -1);
  const last = offered[offered.length - 1] as ColumnOfferShape;
  const interpreted = interpretedOffer(last);
  const verdict = await gate.evaluateOffers(staged.gateScope, { offers: [...measured, interpreted], observations: [] });
  expect(JSON.stringify(verdict.refusals ?? []), `the staged batch published and queued rather than refusing: ${JSON.stringify(verdict.refusals ?? [])}`).toBe("[]");

  const lines = rowsOfCampaign(QUANTITY_LINES_TABLE, staged.tenantId, staged.campaignId);
  expect(lines.length, `the campaign holds one published line per measured offer: ${lines.length}`).toBe(measured.length);
  const queued = rowsOfCampaign(QUEUE_ITEMS_TABLE, staged.tenantId, staged.campaignId);
  expect(queued.length, `the INTERPRETED offer stands as one queue item: ${JSON.stringify(queued)}`).toBe(1);
  expect(String(field(queued[0] as StoreRow, "cause", "cause")), `the queue item's cause is ${INTERPRETED_UNCORROBORATED}`).toBe(INTERPRETED_UNCORROBORATED);
  const queuedObjectKey = String(field(queued[0] as StoreRow, "objectKey", "object_key"));

  /* --- the reading a corroboration disagrees or agrees with: `300 mm` at precedence 0 --- */
  const appended = await register.appendObservation(staged.registerScope, {
    objectKey: objectKeys[0] as string,
    attribute: SIZE,
    valueAsWritten: FIRST_VALUE,
    unitAsWritten: FIRST_UNIT,
    basis: TRANSCRIBED,
    sourceKey: sourceKeys[objectKeys[0] as string] as string,
    precedence: 0,
    actId: null,
  });
  expect(field(appended, "appended", "appended"), `the transcribed reading of ${SIZE} was appended: ${JSON.stringify(appended)}`).toBe(true);

  const drawn: DrawnPlan = {
    drawingId: record.drawingId,
    ingestId: record.ingestId,
    view,
    planSheet: PLAN_SHEET,
    scheduleSheet: SCHEDULE_SHEET,
    modelSheet: MODEL_SHEET,
    sectionCell: record.keys.sectionCell,
    levelNote: record.keys.levelNote,
    members: record.keys.members,
  };
  return { ...staged, objectKeys, sourceKeys, refusedObjectKey, queuedObjectKey, drawn };
}

/**
 * One offer, said to be INTERPRETED: the geometry and every binding carry the basis, so the roll-up
 * L-QTY-01 takes over the offer is INTERPRETED however the gate weighs its inputs.
 */
export function interpretedOffer(offer: ColumnOfferShape): ColumnOfferShape {
  const bindings: Record<string, unknown> = {};
  for (const [name, measure] of Object.entries(offer.bindings)) bindings[name] = { ...(measure as Record<string, unknown>), basis: INTERPRETED };
  return { ...offer, geometry: { ...offer.geometry, basis: INTERPRETED }, bindings } as ColumnOfferShape;
}

/** A second person on the project holding REVIEWER and nothing else (AC-5's denial). */
export async function stageReviewer(staged: StagedRegisterCampaign, label: string = "reviewer"): Promise<Person> {
  const { person } = await stagePerson(`${label}-${staged.projectId.slice(0, 8)}`);
  joinWorkspace(staged.tenantId, person.userId);
  grantRole(staged.tenantId, staged.projectId, person.userId, REVIEWER);
  return person;
}

/** The principal of the staged project — the person every act below is performed by. */
export function principalOf(staged: StagedRegisterCampaign): Person {
  return staged.person;
}

export { PRINCIPAL };

/* -------------------------------------------------------------------------- the acts, as input */

/** One CORROBORATE, as the door is given one (test contract: `CorroborateInput`). */
export function corroboration(o: { projectId: string; objectKey: string; attribute?: string; valueAsWritten: string; unitAsWritten: string; precedence: number; sourceKey: string }): Record<string, unknown> {
  return {
    type: CORROBORATE,
    projectId: o.projectId,
    objectKey: o.objectKey,
    attribute: o.attribute ?? SIZE,
    valueAsWritten: o.valueAsWritten,
    unitAsWritten: o.unitAsWritten,
    precedence: o.precedence,
    sourceKey: o.sourceKey,
  };
}

/** One REPUDIATE, as the door is given one (test contract: `RepudiateInput`). */
export function repudiation(projectId: string, objectKey: string): Record<string, unknown> {
  return { type: REPUDIATE, projectId, objectKey };
}

/** One INSERT_LEVEL over the levels an offered stack proposes (AC-8: one act, N subjects). */
export function insertion(projectId: string, levels: readonly { label: string; ordinal: number }[]): Record<string, unknown> {
  return { type: INSERT_LEVEL, projectId, levels };
}

/* ------------------------------------------------------------------------- reading the answers */

/** What a preview answered, unwrapped: the Consequence and the digest the commit carries back. */
export type Previewed = { consequence: Record<string, unknown>; consequenceDigest: string };

export function previewed(answer: unknown, where: string): Previewed {
  expect(answer, `${where} answered a preview: ${JSON.stringify(answer)}`).toBeTypeOf("object");
  const held = answer as Record<string, unknown>;
  expect(held["consequence"], `${where} answers the Consequence it computed (L-ACT-02)`).toBeTypeOf("object");
  expect(typeof held["consequenceDigest"], `${where} answers the digest of the Consequence it showed (L-ACT-02)`).toBe("string");
  return { consequence: held["consequence"] as Record<string, unknown>, consequenceDigest: String(held["consequenceDigest"]) };
}

/** The subjects one Consequence names. */
export function subjectsOf(consequence: Record<string, unknown>): { subjectId: string; before: string[]; after: string[] }[] {
  const subjects = consequence["subjects"];
  expect(Array.isArray(subjects), `the Consequence names its subjects: ${JSON.stringify(consequence)}`).toBe(true);
  return (subjects as Record<string, unknown>[]).map((subject) => ({
    subjectId: String(subject["subjectId"]),
    before: (subject["before"] as string[]) ?? [],
    after: (subject["after"] as string[]) ?? [],
  }));
}

/** The act id a commit answered. */
export function actIdOf(answer: unknown, where: string): string {
  const held = (answer ?? {}) as Record<string, unknown>;
  expect(typeof held["actId"], `${where} answers the act it wrote: ${JSON.stringify(answer)}`).toBe("string");
  return String(held["actId"]);
}

/** Every act row of one workspace, whole — the acceptance's own audit read. */
export function actsOf(tenantId: string, actType?: string): StoreRow[] {
  const rows = storeRows(ACTS_TABLE, tenantId);
  return actType === undefined ? rows : rows.filter((row) => String(field(row, "actType", "act_type")) === actType);
}

/** Every row of one table in one workspace. */
export function rowsOf(table: string, tenantId: string): StoreRow[] {
  return storeRows(table, tenantId);
}

/** One row's fields, sorted and stringified — what "byte-identical after" is measured over. */
export function frozen(rows: readonly StoreRow[], key: string): string {
  return JSON.stringify(
    [...rows]
      .map((row) => Object.fromEntries(Object.entries(row).sort(([a], [b]) => (a < b ? -1 : 1))))
      .sort((a, b) => (String(a[key] ?? JSON.stringify(a)) < String(b[key] ?? JSON.stringify(b)) ? -1 : 1)),
  );
}
