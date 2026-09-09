/**
 * The mechanics the level model is graded on (L-MEA-07, L-ACT-02, L-ACT-03, L-REG-02, L-REG-04,
 * inc-211).
 *
 * Mechanics only — nothing here judges the product. The database, the accounts, the projects and
 * the pinned drawing-set revision a register object needs come from the stages the register already
 * runs on (`../../register/support/register-stage`): one invariant, one home (B-17, ARCH-02). What
 * this file adds is what a LEVEL needs beyond them — the three acts as the seam is given them, the
 * two stores read back whole, and the actors a contest between readings needs.
 *
 * Product modules are loaded by absolute path (`productModule`), so a file the Builder has not
 * written yet fails as an assertion naming it rather than as a collection death that reads as a
 * defect in the acceptance. Every type of a not-yet-written surface is a loose local shape, so this
 * file typechecks against today's tree and grades tomorrow's.
 *
 * Nothing here reads product source: every name below is one the increment's goal, its interfaces
 * or its acceptance criteria publish.
 *
 * This file serves both lanes — the public suites beside it and the held-out set, which loads it
 * from the checkout by absolute path. Keep it free of judgement so neither lane can hide one here.
 */
import { randomUUID } from "node:crypto";
import { expect } from "vitest";
import { lit } from "../../../../db/__tests__/support/live-sql";
import { codeOf } from "../../sets/support/sets-stage";
import { enrol, joinWorkspace, rejection, type Person } from "../../support/sheets-stage";
import {
  COLUMN_C1,
  MARK_FAMILY,
  MARK_FAMILY_KEYS,
  PRINCIPAL,
  actRows,
  actorOf,
  closeStage,
  field,
  grantRole,
  identitySeam,
  instanceKeyOf,
  ordinalMapOf,
  productModule,
  registerSeam,
  rowsOf,
  saidBy,
  sql,
  stageSetRevision,
  unique,
  type IdentitySeam,
  type LevelRef,
  type RegisterScope,
  type RegisterSeam,
  type Sighting,
  type StagedRevision,
  type StoreRow,
} from "../../register/support/register-stage";

export {
  MARK_FAMILY,
  MARK_FAMILY_KEYS,
  PRINCIPAL,
  actRows,
  actorOf,
  closeStage,
  codeOf,
  field,
  identitySeam,
  instanceKeyOf,
  ordinalMapOf,
  registerSeam,
  rejection,
  rowsOf,
  saidBy,
  sql,
  unique,
};
export type { IdentitySeam, LevelRef, Person, RegisterScope, RegisterSeam, Sighting, StoreRow };

/* ------------------------------------------------------------------ the homes the spec names */

/** The pure core the goal names: standing, digest and the refusal constructors (`src/core/levels`). */
export const LEVELS_CORE = "src/core/levels/index.ts";

/** The takeoff module's read-only door onto the stack (`src/modules/takeoff/levels`). */
export const LEVELS_MODULE = "src/modules/takeoff/levels/index.ts";

/** SEAM-ACT, and the law the three act types are appended to. */
export const ACTS_MODULE = "src/core/acts/index.ts";
export const ACTS_LAW_MODULE = "src/core/acts/law.ts";

/** The closed refusal taxonomy, and the unit canon a reading is carried through (B-17). */
export const ERRORS_MODULE = "src/core/errors.ts";
export const UNITS_MODULE = "src/core/units/canon.ts";

/* ------------------------------------------------------------------ the vocabulary the spec spells */

/** The three act types this increment lands (interfaces, AC-1). */
export const INSERT_LEVEL = "INSERT_LEVEL";
export const REPUDIATE_LEVEL = "REPUDIATE_LEVEL";
export const AUTHOR_STOREY_HEIGHT = "AUTHOR_STOREY_HEIGHT";

/** The two permissions they move (L-ACT-03, AC-1). */
export const AUTHOR_LEVEL_STACK = "AUTHOR_LEVEL_STACK";
export const AUTHOR_PROJECT_FACT = "AUTHOR_PROJECT_FACT";

/** The roles the criteria drive the acts as (L-ACT-03). */
export const LEAD = "LEAD";
export const MEASURER = "MEASURER";

/** The two tables this increment lands (goal, AC-6). */
export const LEVELS_TABLE = "levels";
export const READINGS_TABLE = "storey_height_readings";

/** The three bases a reading may carry, and the one barred at the act and at the store (goal, AC-4). */
export const TRANSCRIBED = "TRANSCRIBED";
export const DERIVED = "DERIVED";
export const ENTERED = "ENTERED";
export const DEFAULTED = "DEFAULTED";

/** How a storey height stands over its readings (AC-1, AC-4, AC-5). */
export const AGREED = "AGREED";
export const SUSPENDED = "SUSPENDED";
export const NONE = "NONE";

/** The refusals these criteria name. */
export const ACT_CHANGES_NOTHING = "ACT_CHANGES_NOTHING";
export const PERMISSION_NOT_HELD = "PERMISSION_NOT_HELD";
export const STOREY_HEIGHT_UNSTATED = "STOREY_HEIGHT_UNSTATED";
export const STOREY_HEIGHT_CONTESTED = "STOREY_HEIGHT_CONTESTED";
export const LEVEL_ORDINAL_UNMAPPED = "LEVEL_ORDINAL_UNMAPPED";
export const DIMENSION_MISMATCH = "DIMENSION_MISMATCH";

/** The three codes this increment registers (AC-5). */
export const NEW_REFUSAL_CODES: readonly string[] = [LEVEL_ORDINAL_UNMAPPED, STOREY_HEIGHT_UNSTATED, STOREY_HEIGHT_CONTESTED];

/** The canonical unit a storey height is carried to — asked of the canon, never re-spelled (B-17). */
export const CANONICAL_LENGTH_UNIT = "m";

/** The element types the two carried objects of AC-1 are of. */
export const COLUMN = "COLUMN";
export const BEAM = "BEAM";

/* ------------------------------------------------------------------ the shapes the acts take */

/** Which workspace and project a level read is scoped to — a level is project-scoped (L-MEA-07). */
export type LevelScope = { tenantId: string; projectId: string };

/** A human actor, as SEAM-ACT is given one. */
export type ActorCtx = { tenantId: string; userId: string; actorKind: string };

/** One reading proposed with a level (AC-1's `readings`). */
export type ProposedReading = { valueAsWritten: string; unitAsWritten: string; sourceKey: string };

/** One proposed level (interfaces: `ProposedLevel`). */
export type ProposedLevel = { label: string; ordinal: number; readings?: readonly ProposedReading[] };

/** What an act asks for, as the seam is given it — one shape per act type this increment lands. */
export type InsertLevelInput = { type: string; projectId: string; levels: readonly ProposedLevel[] };
export type RepudiateLevelInput = { type: string; projectId: string; levelId: string };
export type AuthorStoreyHeightInput = {
  type: string;
  projectId: string;
  levelId: string;
  basis: string;
  sourceKey: string | null;
  valueAsWritten: string;
  unitAsWritten: string;
};
export type LevelActInput = InsertLevelInput | RepudiateLevelInput | AuthorStoreyHeightInput;

/** One subject of a Consequence, as L-ACT-02 renders one (C-05: a shape is free to carry more). */
export type SubjectLike = { subjectId?: unknown; subjectLabel?: unknown; before?: unknown; after?: unknown } & Record<string, unknown>;

/** What an act would do, as the seam answers it. */
export type ConsequenceLike = { actType?: unknown; rendering?: unknown; subjects?: readonly SubjectLike[] } & Record<string, unknown>;

/** What a commit answers back. */
export type CommittedLike = { actId?: unknown; consequenceDigest?: unknown; consequence?: ConsequenceLike } & Record<string, unknown>;

/** SEAM-ACT and the law beside it, as this acceptance drives them. */
export type ActsSeam = {
  preview: (ctx: ActorCtx, input: LevelActInput) => Promise<ConsequenceLike>;
  commit: (ctx: ActorCtx, input: LevelActInput, carriedDigest: string) => Promise<CommittedLike>;
  consequenceDigest: (consequence: ConsequenceLike) => string;
  ACT_TYPES: readonly string[];
  ACT_PERMISSION: Readonly<Record<string, string>>;
};

/** One entry of the live stack (AC-1, AC-6: label, ordinal, level id and the height's standing). */
export type StackEntry = Record<string, unknown>;

/** How a storey height stands, as the door answers it (AC-4, AC-5). */
export type HeightStanding = Record<string, unknown>;

/** The door `src/modules/takeoff/levels` publishes (goal, acceptance criteria). */
export type LevelsSeam = {
  levelStackOf: (scope: LevelScope) => Promise<readonly StackEntry[]>;
  levelStackDigestOf: (scope: LevelScope) => Promise<string>;
  storeyHeightOf: (scope: LevelScope, levelId: string) => Promise<HeightStanding>;
  readingsOf: (scope: LevelScope, levelId: string) => Promise<readonly StoreRow[]>;
};

/** The names the door owes this acceptance. */
export const LEVELS_CALLS: readonly (keyof LevelsSeam & string)[] = ["levelStackOf", "levelStackDigestOf", "storeyHeightOf", "readingsOf"];

/** One member of a stack, as `levelStackDigest` is given one (AC-6: over level id and ordinal). */
export type StackMember = { levelId: string; ordinal: number } & Record<string, unknown>;

/** The pure core `src/core/levels` publishes (goal, AC-4, AC-5, AC-6). */
export type LevelsCore = {
  levelStackDigest: (members: readonly StackMember[]) => string;
  storeyHeightStanding: (...args: readonly unknown[]) => unknown;
  readingKey: (of: { levelId: string; actorId: string; basis: string; sourceKey: string | null }) => string;
  levelOrdinalUnmapped: (ordinal: number) => unknown;
  STOREY_HEIGHT_BASES: readonly string[];
};

/** The names the core owes this acceptance. */
export const CORE_CALLS: readonly string[] = ["levelStackDigest", "storeyHeightStanding", "readingKey", "levelOrdinalUnmapped"];

/** The unit canon, as this acceptance asks it what a reading is worth (B-17). */
export type UnitsSeam = {
  exact: (value: string | number) => { eq: (other: unknown) => boolean };
  convert: (value: string, from: string, to: string) => { ok: boolean; value?: string; code?: string };
};

/** One refusal entry of the closed taxonomy. */
export type RefusalEntryShape = { code: string; message: string; remedy: string; severity: string; surface: string };

/* ------------------------------------------------------------------ loading the doors */

/** SEAM-ACT, with the three renderings this increment appends behind it. */
export async function actsSeam(): Promise<ActsSeam> {
  const seam = await productModule<ActsSeam>(ACTS_MODULE);
  for (const call of ["preview", "commit", "consequenceDigest"]) {
    expect(typeof (seam as unknown as Record<string, unknown>)[call], `${ACTS_MODULE} publishes \`${call}\` (SEAM-ACT)`).toBe("function");
  }
  return seam;
}

/** The act law, where the three types and their permissions stand (L-ACT-03, AC-1). */
export async function actsLaw(): Promise<{ ACT_TYPES: readonly string[]; ACT_PERMISSION: Readonly<Record<string, string>>; PERMISSIONS: readonly string[] }> {
  return productModule<{ ACT_TYPES: readonly string[]; ACT_PERMISSION: Readonly<Record<string, string>>; PERMISSIONS: readonly string[] }>(ACTS_LAW_MODULE);
}

/** The takeoff module's door onto the level stack, with every call asserted by name. */
export async function levelsSeam(): Promise<LevelsSeam> {
  const door = await productModule<Record<string, unknown>>(LEVELS_MODULE);
  for (const call of LEVELS_CALLS) {
    expect(typeof door[call], `${LEVELS_MODULE} publishes \`${call}\` — a door this increment's goal names`).toBe("function");
  }
  return door as unknown as LevelsSeam;
}

/** The pure core, with every call and roster this acceptance drives asserted by name. */
export async function levelsCore(): Promise<LevelsCore> {
  const core = await productModule<Record<string, unknown>>(LEVELS_CORE);
  for (const call of CORE_CALLS) {
    expect(typeof core[call], `${LEVELS_CORE} publishes \`${call}\` — a name this increment's criteria drive`).toBe("function");
  }
  expect(Array.isArray(core["STOREY_HEIGHT_BASES"]), `${LEVELS_CORE} publishes \`STOREY_HEIGHT_BASES\` as a list — the bases a reading may carry (AC-4)`).toBe(true);
  return core as unknown as LevelsCore;
}

/** The unit canon — the one home a reading's canonical value is asked of (B-17). */
export async function unitsSeam(): Promise<UnitsSeam> {
  return productModule<UnitsSeam>(UNITS_MODULE);
}

/** The refusal register, read from its one home so nothing re-spells a code (ARCH-02, Q-07). */
export async function refusals(): Promise<Readonly<Record<string, RefusalEntryShape | undefined>>> {
  const errors = await productModule<{ REFUSALS: Record<string, RefusalEntryShape | undefined> }>(ERRORS_MODULE);
  return errors.REFUSALS;
}

/** What the product's own canon says one as-written reading is, in metres. */
export async function metresOf(value: string, unit: string): Promise<string> {
  const canon = await unitsSeam();
  const answer = canon.convert(value, unit, CANONICAL_LENGTH_UNIT);
  expect(answer.ok, `${UNITS_MODULE} carries ${value} ${unit} to ${CANONICAL_LENGTH_UNIT}: ${JSON.stringify(answer)}`).toBe(true);
  return String(answer.value);
}

/** Is this spelling one the canon's exact decimals can take at all? */
function readsAsANumber(value: string): boolean {
  return value.trim() !== "" && Number.isFinite(Number(value));
}

/** Does anything this value says equal `expected` as an exact decimal (AC-4: by `exact(...).eq`)? */
export async function saysTheValue(said: unknown, expected: string): Promise<boolean> {
  const canon = await unitsSeam();
  return saidBy(said)
    .filter((spelling) => readsAsANumber(spelling))
    .some((spelling) => canon.exact(spelling).eq(canon.exact(expected)));
}

/** Two decimal spellings of one value, compared as the canon compares them. */
export async function sameValue(left: unknown, right: string): Promise<boolean> {
  if (typeof left !== "string" && typeof left !== "number") return false;
  const spelling = String(left);
  if (!readsAsANumber(spelling)) return false;
  const canon = await unitsSeam();
  return canon.exact(spelling).eq(canon.exact(right));
}

/* ------------------------------------------------------------------ the acts, as the seam is given them */

/** One INSERT_LEVEL over N proposed levels (AC-1: one act, N subjects). */
export function insertion(projectId: string, levels: readonly ProposedLevel[]): InsertLevelInput {
  return { type: INSERT_LEVEL, projectId, levels };
}

/** One REPUDIATE_LEVEL (AC-3). */
export function repudiation(projectId: string, levelId: string): RepudiateLevelInput {
  return { type: REPUDIATE_LEVEL, projectId, levelId };
}

/** One AUTHOR_STOREY_HEIGHT (AC-4). */
export function heightReading(o: {
  projectId: string;
  levelId: string;
  valueAsWritten: string;
  unitAsWritten: string;
  basis?: string;
  sourceKey?: string | null;
}): AuthorStoreyHeightInput {
  return {
    type: AUTHOR_STOREY_HEIGHT,
    projectId: o.projectId,
    levelId: o.levelId,
    basis: o.basis ?? ENTERED,
    sourceKey: o.sourceKey ?? null,
    valueAsWritten: o.valueAsWritten,
    unitAsWritten: o.unitAsWritten,
  };
}

/** What performing one act left behind: what it said it would do, and the act row it wrote. */
export type Performed = { consequence: ConsequenceLike; actId: string };

/** Preview an act, exactly as a surface would (L-ACT-02: the digest is carried, never assembled). */
export async function previewOf(actor: ActorCtx, input: LevelActInput): Promise<ConsequenceLike> {
  const acts = await actsSeam();
  return acts.preview(actor, input);
}

/** Preview an act and commit the digest it answered — the whole L-ACT-02 pair, once. */
export async function performAct(actor: ActorCtx, input: LevelActInput): Promise<Performed> {
  const acts = await actsSeam();
  const consequence = await acts.preview(actor, input);
  const written = await acts.commit(actor, input, acts.consequenceDigest(consequence));
  const actId = written.actId;
  expect(typeof actId === "string" && actId.length > 0, `committing ${input.type} answered the act it wrote: ${JSON.stringify(written)}`).toBe(true);
  return { consequence, actId: String(actId) };
}

/** The code an act refused with, whichever half of the pair refused it. */
export async function refusalOfPerforming(actor: ActorCtx, input: LevelActInput): Promise<string | null> {
  const failure = await rejection(performAct(actor, input));
  expect(failure, `${input.type} was expected to refuse, and the act went through instead`).not.toBeNull();
  return codeOf(failure);
}

/** The failure an act refused with, whole — its code, and the facts the law says it names. */
export async function failureOfPerforming(actor: ActorCtx, input: LevelActInput): Promise<{ code: string | null; said: string[] }> {
  const failure = await rejection(performAct(actor, input));
  expect(failure, `${input.type} was expected to refuse, and the act went through instead`).not.toBeNull();
  const facts = failure as { message?: unknown } & Record<string, unknown>;
  const said = [String(facts?.message ?? ""), ...Object.values(facts ?? {}).map((value) => String(value))];
  return { code: await codeOf(failure), said };
}

/* ------------------------------------------------------------------ reading a Consequence */

/** The subjects a Consequence carries, in the order it carries them. */
export function subjectsOf(consequence: ConsequenceLike): SubjectLike[] {
  const subjects = consequence.subjects;
  expect(Array.isArray(subjects), `a Consequence carries its subjects: ${JSON.stringify(consequence)}`).toBe(true);
  return [...(subjects as readonly SubjectLike[])];
}

/** Every subject id a Consequence names. */
export function subjectIdsOf(consequence: ConsequenceLike): string[] {
  return subjectsOf(consequence).map((subject) => String(subject.subjectId));
}

/** One subject by the id it names, asserted present. */
export function subjectFor(consequence: ConsequenceLike, subjectId: string): SubjectLike {
  const found = subjectsOf(consequence).find((subject) => String(subject.subjectId) === subjectId);
  expect(found, `the Consequence names ${subjectId} among its subjects (it names ${subjectIdsOf(consequence).join(", ")})`).toBeTruthy();
  return found as SubjectLike;
}

/** One subject's `before` / `after`, as lists of what they say. */
export function movedTo(subject: SubjectLike): { before: string[]; after: string[] } {
  return { before: (subject.before as string[] | undefined ?? []).map(String), after: (subject.after as string[] | undefined ?? []).map(String) };
}

/* ------------------------------------------------------------------ reading the store directly */

/** Does the migrated database hold this table at all? */
export function tableStands(table: string): boolean {
  return (
    sql(
      `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind in ('r', 'p') and c.relname = ${lit(table)};`,
    ).length > 0
  );
}

/** Every row of one of this increment's tables in one workspace, whole — the acceptance's audit read. */
export function storeRows(table: string, tenantId: string): StoreRow[] {
  expect(tableStands(table), `the product's migration lane lands public.${table} — the store this increment's rows stand in (AC-6, V-DB)`).toBe(true);
  return rowsOf(table, tenantId);
}

/** Every `levels` row of one workspace. */
export function levelRows(tenantId: string): StoreRow[] {
  return storeRows(LEVELS_TABLE, tenantId);
}

/** Every `storey_height_readings` row of one workspace. */
export function readingRows(tenantId: string): StoreRow[] {
  return storeRows(READINGS_TABLE, tenantId);
}

/** The level row the store holds under this surrogate id, or nothing where none does. */
export function levelRowOf(tenantId: string, levelId: string): StoreRow | undefined {
  return levelRows(tenantId).find((row) => String(field(row, "levelId", "level_id")) === levelId);
}

/** How many act rows of one type one project holds — the "one act, never two" reading (L-ACT-01). */
export function actsOfType(tenantId: string, projectId: string, actType: string): { actId: string; actType: string; subjects: string[] }[] {
  return actRows(tenantId, projectId).filter((row) => row.actType === actType);
}

/** A surrogate id no project holds — what an act naming nothing is given (AC-3). */
export function unheldLevelId(): string {
  return randomUUID();
}

/** A uuid, as the store mints a level's surrogate id (L-MEA-07, AC-1). */
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* ------------------------------------------------------------------ staging a project and its people */

/** A project with a pinned set revision, its PRINCIPAL, and the scope a level read is made in. */
export type StagedLevels = {
  person: Person;
  actor: ActorCtx;
  projectId: string;
  tenantId: string;
  scope: LevelScope;
  registerScope: RegisterScope;
  revision: StagedRevision;
};

/** A fresh workspace, project and pinned set revision, with its PRINCIPAL holding every permission. */
export async function stageLevels(label: string): Promise<StagedLevels> {
  const revision = await stageSetRevision(`levels-${label}`);
  const tenantId = revision.person.tenantId;
  return {
    person: revision.person,
    actor: actorOf(revision.person),
    projectId: revision.projectId,
    tenantId,
    scope: { tenantId, projectId: revision.projectId },
    registerScope: revision.scope,
    revision,
  };
}

/** A second (third, fourth…) person on the SAME project, holding one role there (L-ACT-03). */
export async function stageActor(staged: StagedLevels, label: string, role: string): Promise<{ person: Person; actor: ActorCtx }> {
  const person = await enrol(`levels-${label}`);
  joinWorkspace(staged.tenantId, person.userId);
  grantRole(staged.tenantId, staged.projectId, person.userId, role);
  return { person, actor: { tenantId: staged.tenantId, userId: person.userId, actorKind: "human" } };
}

/* ------------------------------------------------------------------ staging register objects */

/** One measured sighting of this acceptance's corpus, standing on the level it names. */
export function sightingOf(o: { label: string; mark: string; elementType?: string; level: LevelRef; x?: number; y?: number }): Sighting {
  return {
    ...COLUMN_C1,
    label: o.label,
    mark: o.mark,
    elementType: o.elementType ?? COLUMN,
    level: o.level,
    x: o.x ?? COLUMN_C1.x,
    y: o.y ?? COLUMN_C1.y,
  };
}

/** Register one sighting through the shipped door, and answer the object key it stands on. */
export async function registerOne(staged: StagedLevels, sighting: Sighting): Promise<string> {
  const register = await registerSeam();
  const answer = await register.registerSighting(staged.registerScope, sighting);
  expect(field(answer, "registered", "registered"), `the sighting ${sighting.label} registered: ${JSON.stringify(answer)}`).toBe(true);
  return String(field(answer, "objectKey", "object_key"));
}

/** Every register object of the staged revision, as the door reads them back. */
export async function objectsOf(staged: StagedLevels): Promise<StoreRow[]> {
  const register = await registerSeam();
  return [...(await register.registerObjectsOf(staged.registerScope))] as StoreRow[];
}

/** One register object's key, level id and level label — the three columns a carry moves (L-REG-04). */
export function levelOf(row: StoreRow): { objectKey: string; levelId: unknown; levelLabel: unknown } {
  return {
    objectKey: String(field(row, "objectKey", "object_key")),
    levelId: field(row, "levelId", "level_id"),
    levelLabel: field(row, "levelLabel", "level_label"),
  };
}

/** Every register object of the revision, keyed by the key it stands on right now. */
export async function objectsByKey(staged: StagedLevels): Promise<Map<string, StoreRow>> {
  return new Map((await objectsOf(staged)).map((row) => [levelOf(row).objectKey, row]));
}

/* ------------------------------------------------------------------ reading the stack */

/** One stack entry's label, ordinal, level id and height standing (AC-1, AC-6). */
export function stackEntry(entry: StackEntry): { label: string; ordinal: unknown; levelId: string; height: Record<string, unknown> } {
  return {
    label: String(field(entry, "label", "label")),
    ordinal: field(entry, "ordinal", "ordinal"),
    levelId: String(field(entry, "levelId", "level_id")),
    height: (field(entry, "height", "height") ?? {}) as Record<string, unknown>,
  };
}

/** The labels of a live stack, in the order the door answers them. */
export function labelsOf(stack: readonly StackEntry[]): string[] {
  return stack.map((entry) => stackEntry(entry).label);
}

/** The ordinals of a live stack, in the order the door answers them. */
export function ordinalsOf(stack: readonly StackEntry[]): number[] {
  return stack.map((entry) => Number(stackEntry(entry).ordinal));
}

/** The level id the live stack holds under one label, asserted present. */
export function levelIdOf(stack: readonly StackEntry[], label: string): string {
  const found = stack.map(stackEntry).find((entry) => entry.label === label);
  expect(found, `the live stack holds ${label} (it holds ${labelsOf(stack).join(", ")})`).toBeTruthy();
  return (found as { levelId: string }).levelId;
}

/** How a standing answers: its standing, its canonical metres and the refusal it carries (AC-4). */
export function standingOf(answer: HeightStanding): { standing: unknown; canonicalMetres: unknown; refusal: unknown; current: unknown[]; superseded: unknown[] } {
  return {
    standing: field(answer, "standing", "standing"),
    canonicalMetres: field(answer, "canonicalMetres", "canonical_metres"),
    refusal: field(answer, "refusal", "refusal"),
    current: (field(answer, "current", "current") ?? []) as unknown[],
    superseded: (field(answer, "superseded", "superseded") ?? []) as unknown[],
  };
}
