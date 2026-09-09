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
import { measureSeam, type MeasureSeam } from "../../gate/support/gate-stage";
import { PRINCIPAL, actorOf, grantRole, joinWorkspace, rejection, stagePerson, unique, type ActorCtx, type Person } from "../../support/sheets-stage";
import { sql } from "../../../spine/uploads/support/upload-stage";

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
};

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

  /* --- the objects: three columns of one mark family, sighted at the register's door --- */
  const marks = ["C1", "C2", "C3"];
  const sightings = marks.map((mark, at) => ({ ...COLUMN_C1, elementType: COLUMN_CLASS, label: `${label}-${mark}`, mark, x: 1000 + at * 100 }));
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

  /* --- the lines: the rail's offers, published by the gate; the last one INTERPRETED --- */
  const setup = setupForRows(rows);
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

  return { ...staged, objectKeys, sourceKeys, refusedObjectKey, queuedObjectKey };
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
