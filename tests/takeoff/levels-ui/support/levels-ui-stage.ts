/**
 * The LIVE-DATABASE half of the stage S-Levels is judged over: a pinned campaign whose register
 * objects stand on the project's OWN levels, with the gate's published `rcc.concrete` lines beside
 * them, and the takeoff lane called as a signed-in person (inc-302-levels-editor: L-MEA-07, L-ACT-02,
 * L-ACT-03, R-TO-033, R-UI-021).
 *
 * MECHANICS ONLY — nothing here judges the product. Everything is staged through the shipped doors
 * and never around them: a project through its own door, the levels by act, the sightings at the
 * register's door, the lines by the rail and the gate. What this file adds beyond the stages it
 * stands on is what THIS screen needs: register objects standing on a REAL level of the stack (so a
 * line can be rolled up under one), a level bearing no line at all, and the people who hold one role.
 *
 * Product modules are loaded by absolute path (`productModule`), so a file the Builder has not
 * written yet fails as an assertion naming it rather than as a collection death that would read as a
 * defect in the acceptance. Every type of a not-yet-written surface is a loose local shape.
 *
 * Nothing here reads product source: every name below is one the increment's goal, its interfaces,
 * its acceptance criteria or the test contract publishes.
 *
 * This file serves both lanes — the public suites beside it and the held-out set, which loads it
 * from the checkout by absolute path. Keep it free of judgement so neither lane can hide one here.
 */
import { expect } from "vitest";
import {
  COLUMN_CLASS,
  COLUMN_CONCRETE_PAIR,
  HEIGHT_SOURCE,
  QUANTITY_LINES_TABLE,
  RCC_CONCRETE,
  closeStage,
  columnRailDoor,
  field,
  gateSeam,
  levelStanding,
  railInput,
  rowsOfCampaign,
  setupForRows,
  stageCampaign,
  storeRows,
  type StagedCampaign,
  type StoreRow,
} from "../../rails/support/column-rail-stage";
import { COLUMN_C1 as COLUMN_SIGHTING, registerSeam } from "../../register/support/register-stage";
import { actorOf, grantRole, joinWorkspace, stagePerson, type Person } from "../../support/sheets-stage";
import {
  ACT_CHANGES_NOTHING,
  AUTHOR_LEVEL_STACK,
  AUTHOR_PROJECT_FACT,
  AUTHOR_STOREY_HEIGHT,
  ENTERED,
  INSERT_LEVEL,
  MEASURE,
  PERMISSION_NOT_HELD,
  REPUDIATE_LEVEL,
  REQUEST_MALFORMED,
  TRANSCRIBED,
  productModule,
} from "./levels-ui-view";

export {
  ACT_CHANGES_NOTHING,
  AUTHOR_LEVEL_STACK,
  AUTHOR_PROJECT_FACT,
  AUTHOR_STOREY_HEIGHT,
  ENTERED,
  INSERT_LEVEL,
  MEASURE,
  PERMISSION_NOT_HELD,
  QUANTITY_LINES_TABLE,
  RCC_CONCRETE,
  REPUDIATE_LEVEL,
  REQUEST_MALFORMED,
  TRANSCRIBED,
  closeStage,
  field,
  productModule,
  storeRows,
};
export type { Person, StoreRow };

/* --------------------------------------------------------------------- the homes the spec names */

/** The takeoff lane's router — the one home of this screen's nine doors (test contract). */
export const TAKEOFF_ROUTER_MODULE = "src/server/routers/takeoff.ts";

/** The read-only door onto the stack, and SEAM-ACT. */
export const LEVELS_MODULE = "src/modules/takeoff/levels/index.ts";
export const ACTS_MODULE = "src/core/acts/index.ts";

/** The marker a refusal is carried to its caller by (ARCH-03). */
export const REFUSAL_MARKER_MODULE = "src/core/faults/refusal-marker.ts";

/** The roles a participant of the staged project is granted one of (L-ACT-03). */
export const MEASURER = "MEASURER";
export const REVIEWER = "REVIEWER";

/* ------------------------------------------------------------------------- calling the doors */

/** Every door of the takeoff lane, as a caller wearing one person's session reaches them. */
export type TakeoffCaller = Record<string, (input: unknown) => Promise<unknown>>;

/** What a preview answers (L-ACT-02): the Consequence, and the digest a commit carries back. */
export type Previewed = { consequence: Record<string, unknown>; consequenceDigest: string };

type Actor = { tenantId: string; userId: string; actorKind: string };

/** SEAM-ACT, as L-ACT-02 renders it: a preview, a commit that carries the digest, and the digest. */
type ActsSeam = {
  preview: (actor: Actor, input: Record<string, unknown>) => Promise<Record<string, unknown>>;
  commit: (actor: Actor, input: Record<string, unknown>, consequenceDigest: string) => Promise<Record<string, unknown>>;
  consequenceDigest: (consequence: unknown) => string;
};

export async function actsSeam(): Promise<ActsSeam> {
  return productModule<ActsSeam>(ACTS_MODULE);
}

type LevelsSeam = {
  levelStackOf: (scope: { tenantId: string; projectId: string }) => Promise<Record<string, unknown>[]>;
  readingsOf: (scope: { tenantId: string; projectId: string }, levelId: string) => Promise<Record<string, unknown>[]>;
};

export async function levelsSeam(): Promise<LevelsSeam> {
  return productModule<LevelsSeam>(LEVELS_MODULE);
}

/**
 * The takeoff lane, called as a signed-in person — the transport the screen itself uses, so a door
 * asserted here is the door the reader presses.
 */
export async function takeoffCaller(person: Person): Promise<TakeoffCaller> {
  const { randomUUID } = await import("node:crypto");
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

/** What a preview answered, unwrapped. */
export function previewed(answer: unknown, where: string): Previewed {
  expect(answer, `${where} answered a preview: ${JSON.stringify(answer)}`).toBeTypeOf("object");
  const held = answer as Record<string, unknown>;
  expect(held["consequence"], `${where} answers the Consequence it computed (L-ACT-02)`).toBeTypeOf("object");
  expect(typeof held["consequenceDigest"], `${where} answers the digest of the Consequence it showed (L-ACT-02)`).toBe("string");
  return { consequence: held["consequence"] as Record<string, unknown>, consequenceDigest: String(held["consequenceDigest"]) };
}

/** The refusal code a failure carries, whether it arrived bare or wrapped by a transport. */
export async function codeOf(failure: unknown): Promise<string | null> {
  const { refusalCodeOf } = await productModule<{ refusalCodeOf: (e: unknown) => string | null }>(REFUSAL_MARKER_MODULE);
  const direct = refusalCodeOf(failure);
  if (direct !== null) return direct;
  const cause = (failure as { cause?: unknown } | null)?.cause;
  return cause === undefined ? null : refusalCodeOf(cause);
}

/** What a door refused with, and everything the refusal said — asserted to have refused at all. */
export async function refusalOf(call: () => Promise<unknown>, where: string): Promise<{ code: string | null; said: string }> {
  try {
    const answer = await call();
    expect.fail(`${where} was expected to refuse, and answered ${JSON.stringify(answer)}`);
  } catch (failure) {
    if ((failure as { message?: string }).message?.startsWith(`${where} was expected to refuse`) === true) throw failure;
    return { code: await codeOf(failure), said: JSON.stringify(failure, Object.getOwnPropertyNames(failure as object)) };
  }
  throw new Error("unreachable");
}

/* ------------------------------------------------------------------------- the act inputs */

export function insertion(projectId: string, levels: readonly { label: string; ordinal: number }[]): Record<string, unknown> {
  return { type: INSERT_LEVEL, projectId, levels };
}

export function repudiation(projectId: string, levelId: string): Record<string, unknown> {
  return { type: REPUDIATE_LEVEL, projectId, levelId };
}

export function heightReading(o: { projectId: string; levelId: string; value: string; unit: string; basis?: string; sourceKey?: string | null }): Record<string, unknown> {
  return {
    type: AUTHOR_STOREY_HEIGHT,
    projectId: o.projectId,
    levelId: o.levelId,
    basis: o.basis ?? ENTERED,
    sourceKey: o.sourceKey ?? null,
    valueAsWritten: o.value,
    unitAsWritten: o.unit,
  };
}

/* --------------------------------------------------------------------- staging the campaign */

/** A pinned campaign whose lines stand on a real level, and a level bearing none. */
export type StagedLevelsUi = StagedCampaign & {
  /** The level the register objects stand on, and the campaign's lines roll up under. */
  bearingLevelId: string;
  bearingLabel: string;
  /** A live level of the same stack that bears no register object at all. */
  bareLevelId: string;
  bareLabel: string;
  /** The register objects staged on the bearing level, by key. */
  objectLevels: Record<string, string>;
};

/** One level of the live stack, however the door spells its columns. */
export function stackRow(row: Record<string, unknown>): { levelId: string; label: string; ordinal: number } {
  return {
    levelId: String(field(row, "levelId", "level_id")),
    label: String(field(row, "label", "label")),
    ordinal: Number(field(row, "ordinal", "ordinal")),
  };
}

/** The live stack of a staged project, as the shipped read-only door answers it. */
export async function liveStack(staged: { tenantId: string; projectId: string }): Promise<{ levelId: string; label: string; ordinal: number }[]> {
  const levels = await levelsSeam();
  return (await levels.levelStackOf({ tenantId: staged.tenantId, projectId: staged.projectId })).map(stackRow);
}

/**
 * A campaign with published `rcc.concrete` lines standing on the project's own ground floor, and a
 * second live level above it bearing nothing.
 *
 * The register's door is given the REAL surrogate of the level the sightings stand on, which is what
 * lets a line be rolled up under a level at all: the stages this one builds on cite a placeholder
 * surrogate that belongs to no project.
 */
export async function stageLevelsUi(label: string): Promise<StagedLevelsUi> {
  const staged = await stageCampaign(`levels-ui-${label}`, { methods: [COLUMN_CONCRETE_PAIR], objects: 0 });
  const acts = await actsSeam();
  const actor = actorOf(staged.person);

  /* --- the stack: the ground floor the campaign opened on, and one bare level above it --- */
  const first = await liveStack(staged);
  expect(first.length, `the staged project stands on one level before this stage adds another: ${JSON.stringify(first)}`).toBe(1);
  const bearing = first[0] as { levelId: string; label: string; ordinal: number };
  const proposed = insertion(staged.projectId, [{ label: "L1", ordinal: bearing.ordinal + 1 }]);
  await acts.commit(actor, proposed, acts.consequenceDigest(await acts.preview(actor, proposed)));
  const stack = await liveStack(staged);
  const bare = stack.find((level) => level.levelId !== bearing.levelId);
  expect(bare, `the stage inserted a second live level: ${JSON.stringify(stack)}`).toBeTruthy();

  /* --- the objects: three columns sighted on the bearing level, at the register's own door --- */
  const register = await registerSeam();
  const objectLevels: Record<string, string> = {};
  for (const [at, mark] of ["C1", "C2", "C3"].entries()) {
    const answer = await register.registerSighting(staged.registerScope, {
      ...columnSighting(),
      elementType: COLUMN_CLASS,
      label: `${label}-${mark}`,
      mark,
      x: 1000 + at * 100,
      level: { levelId: bearing.levelId },
    } as never);
    expect(field(answer as Record<string, unknown>, "registered", "registered"), `the sighting of ${mark} registered: ${JSON.stringify(answer)}`).toBe(true);
    objectLevels[String(field(answer as Record<string, unknown>, "objectKey", "object_key"))] = bearing.levelId;
  }

  /* --- the lines: the rail's offers over those objects, published by the gate --- */
  const rows = (await register.registerObjectsOf(staged.registerScope)) as unknown as Record<string, unknown>[];
  expect(rows.length, `the staged campaign holds the three column rows the rail reads: ${rows.length}`).toBe(3);
  const setup = setupForRows(rows);
  const rail = await columnRailDoor();
  const offers = rail.columnConcreteRail(
    railInput({
      campaignId: staged.campaignId,
      setRevisionId: staged.setRevisionId,
      objects: rows,
      placements: setup.placements,
      memberTypes: setup.memberTypes,
      calibrations: setup.calibrations,
      levels: [levelStanding({ levelId: bearing.levelId, label: bearing.label, ordinal: bearing.ordinal, value: "3", unit: "M", sourceKey: HEIGHT_SOURCE })],
    }),
  ).offers;
  expect(offers.length, `the rail offers one line per staged object: ${offers.length}`).toBe(rows.length);

  const gate = await gateSeam();
  const verdict = await gate.evaluateOffers(staged.gateScope, { offers, observations: [] });
  expect(JSON.stringify(verdict.refusals ?? []), `the staged batch published rather than refusing: ${JSON.stringify(verdict.refusals ?? [])}`).toBe("[]");
  expect(linesOf({ ...staged, bearingLevelId: bearing.levelId } as StagedLevelsUi).length, "and the campaign holds the lines it published").toBeGreaterThan(0);

  return {
    ...staged,
    bearingLevelId: bearing.levelId,
    bearingLabel: bearing.label,
    bareLevelId: (bare as { levelId: string }).levelId,
    bareLabel: (bare as { label: string }).label,
    objectLevels,
  };
}

/** The sighting shape the register's door is given, as the register's own stage spells one (B-17). */
function columnSighting(): Record<string, unknown> {
  return { ...(COLUMN_SIGHTING as unknown as Record<string, unknown>) };
}

/** Every published quantity line of the staged campaign, whole. */
export function linesOf(staged: { tenantId: string; campaignId: string }): StoreRow[] {
  return rowsOfCampaign(QUANTITY_LINES_TABLE, staged.tenantId, staged.campaignId);
}

/** One line's id and the register object it was measured from. */
export function lineRow(row: StoreRow): { lineId: string; objectKey: string; kind: string } {
  return {
    lineId: String(field(row, "lineId", "line_id")),
    objectKey: String(field(row, "objectKey", "object_key")),
    kind: String(field(row, "kind", "kind")),
  };
}

/**
 * The lines of the campaign whose register object stands on one of these levels, code-point sorted —
 * the set `effects.linesRederiving` names, derived from the store rather than typed here (B-19).
 */
export function lineIdsOnLevels(staged: StagedLevelsUi, levelIds: readonly string[]): string[] {
  const wanted = new Set(levelIds);
  return linesOf(staged)
    .map(lineRow)
    .filter((line) => wanted.has(staged.objectLevels[line.objectKey] ?? ""))
    .map((line) => line.lineId)
    .sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
}

/* ------------------------------------------------------------------------------ the people */

/** A second person on the staged project holding exactly one role there (L-ACT-03). */
export async function stageParticipant(staged: StagedLevelsUi, label: string, role: string): Promise<Person> {
  const { person } = await stagePerson(`levels-ui-${label}`);
  joinWorkspace(staged.tenantId, person.userId);
  grantRole(staged.tenantId, staged.projectId, person.userId, role);
  return person;
}

/** A person of another workspace entirely — no member of this project at all. */
export async function stageStranger(label: string): Promise<Person> {
  return (await stagePerson(`levels-ui-stranger-${label}`)).person;
}
