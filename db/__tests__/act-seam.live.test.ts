// Live acceptance for the act seam (SEAM-ACT, L-ACT-01/02/03, V-DB): AC-2, AC-3, AC-4 and AC-6,
// against a self-provisioned, migrated scratch database — the same harness every other live suite
// runs on.
//
// Raw SQL is spoken through psql, never a driver import: SEAM-TENANT's ban binds this file like the
// rest of the tree. The act seam itself is loaded by absolute path rather than by a literal
// specifier, so a module the product does not provide yet fails as an assertion naming the file
// instead of killing collection at transform time.
//
// B-19: nothing here transcribes a schema. The tables' columns are read from information_schema and
// the link between a role grant and its participant is derived from the key columns the two tables
// actually share — so a Builder who spells the grant as (participant_id) and one who spells it as
// (project_id, user_id) are both judged by the same file. Each case mints its own project and user
// uuids, so no case can pass or fail on another's rows.
import { randomUUID } from "node:crypto";
import { existsSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { REFUSALS } from "../../src/core/errors";
import { refusalCodeOf } from "../../src/core/faults/refusal-marker";
import { provisionScratchDb } from "./harness";
import { AUDIT_REASON, GUC_SYSTEM_REASON, SEED_REASON, TENANT_ALPHA, TENANT_COLUMN } from "./support/fixtures";
import { ident, lit, probeValue, psql, requiredColumns, run, seedTenants, withSession, type TableRef } from "./support/live-sql";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

/** The seam's barrel — the sole entry point other increments import (SEAM-ACT). */
const ACTS_MODULE = "src/core/acts/index.ts";

/** The three tables this increment ships. Named by the increment's interfaces, not by inspection. */
const ACTS = "acts";
const PARTICIPANTS = "participants";
const PARTICIPANT_ROLES = "participant_roles";

/** The columns of `acts` the test contract fixes. */
const ACT_TYPE = "act_type";
const ACTOR_ID = "actor_id";
const CONSEQUENCE_DIGEST = "consequence_digest";

/** The act type this increment renders, and the roles the scenario moves. */
const ASSIGN_PARTICIPANT_ROLE = "ASSIGN_PARTICIPANT_ROLE";
const ADMINISTER_PROJECT = "ADMINISTER_PROJECT";
const PRINCIPAL = "PRINCIPAL";
const REVIEWER = "REVIEWER";
const MEASURER = "MEASURER";

/** The refusal codes this increment registers (B-17: spelled here, wired to the register below). */
const CONSEQUENCES_NOT_CARRIED = "CONSEQUENCES_NOT_CARRIED";
const PERMISSION_NOT_HELD = "PERMISSION_NOT_HELD";

/* ------------------------------------------------------------------ *
 * The seam, as its callers see it.
 * ------------------------------------------------------------------ */

type ActorKind = "human" | "machine" | "model";
type ActorCtx = { tenantId: string; userId: string; actorKind: ActorKind };
type AssignInput = { type: string; projectId: string; subjectUserId: string; role: string };

type ActSeam = {
  preview?: (ctx: ActorCtx, input: AssignInput) => unknown;
  commit?: (ctx: ActorCtx, input: AssignInput, consequenceDigest: string) => unknown;
  consequenceDigest?: (consequence: unknown) => string;
};

async function loadActSeam(databaseUrl: string): Promise<ActSeam> {
  process.env["DATABASE_URL"] = databaseUrl;
  const abs = join(REPO_ROOT, ACTS_MODULE);
  expect(
    existsSync(abs) && statSync(abs).isFile(),
    `${ACTS_MODULE} is missing from the checkout — SEAM-ACT names it the sole writer of the act log`,
  ).toBe(true);
  const specifier: string = abs;
  return (await import(specifier)) as ActSeam;
}

function previewOf(seam: ActSeam): NonNullable<ActSeam["preview"]> {
  const fn = seam.preview;
  if (typeof fn !== "function") throw new Error(`${ACTS_MODULE} exports no preview(ctx, input) — L-ACT-02 makes every act type a (preview, commit) pair`);
  return fn;
}

function commitOf(seam: ActSeam): NonNullable<ActSeam["commit"]> {
  const fn = seam.commit;
  if (typeof fn !== "function") throw new Error(`${ACTS_MODULE} exports no commit(ctx, input, consequenceDigest) — L-ACT-02 makes every act type a (preview, commit) pair`);
  return fn;
}

function digestOf(seam: ActSeam): NonNullable<ActSeam["consequenceDigest"]> {
  const fn = seam.consequenceDigest;
  if (typeof fn !== "function") throw new Error(`${ACTS_MODULE} exports no consequenceDigest(consequence) — ARCH-02 puts the consequence digest in exactly one home`);
  return fn;
}

/* ------------------------------------------------------------------ *
 * Reading and seeding the act tables, derived from the migrated database.
 * ------------------------------------------------------------------ */

const tableRef = (table: string): TableRef => ({ schema: "public", table, sql: `${ident("public")}.${ident(table)}` });

function columnNames(url: string, table: string): string[] {
  return run(
    url,
    `select column_name from information_schema.columns where table_schema = 'public' and table_name = ${lit(table)} order by ordinal_position;`,
  ).map((row) => row[0] ?? "");
}

/** The columns of a table the act-log migration is required to have created. */
function tableColumns(url: string, table: string): string[] {
  const columns = columnNames(url, table);
  expect(columns.length, `the migrated database has no "${table}" table — SEAM-ACT's act-log migration has not created it`).toBeGreaterThan(0);
  return columns;
}

/**
 * Insert one row under system scope, supplying the caller's values by column name and a value of the
 * column's own type for everything else the table cannot be built without. The whole row comes back
 * as text, so a key the caller never named — a generated participant id, say — is still in hand for
 * the rows that reference it.
 */
function insertRow(url: string, table: string, tenantId: string, known: Readonly<Record<string, string>>): Record<string, string> {
  const columns = tableColumns(url, table);
  const present = new Set(columns);
  const chosen = new Map<string, string>([[TENANT_COLUMN, lit(tenantId)]]);
  for (const column of requiredColumns(url, tableRef(table))) {
    if (!present.has(column.name)) continue;
    chosen.set(column.name, known[column.name] ?? probeValue(column));
  }
  for (const [name, value] of Object.entries(known)) {
    if (present.has(name)) chosen.set(name, value);
  }
  const rows = run(
    url,
    withSession(
      { [GUC_SYSTEM_REASON]: SEED_REASON },
      `insert into ${ident(table)} (${[...chosen.keys()].map(ident).join(", ")}) values (${[...chosen.values()].join(", ")}) returning ${columns.map((name) => `${ident(name)}::text`).join(", ")};`,
    ),
  );
  const row = rows[0];
  expect(row, `seeding a row into ${table} through the system channel returned nothing`).toBeDefined();
  const record: Record<string, string> = {};
  columns.forEach((name, index) => {
    record[name] = row?.[index] ?? "";
  });
  return record;
}

/** The column a grant carries its role in — `role`, or whatever else the table names it. */
function roleColumn(url: string): string {
  const columns = tableColumns(url, PARTICIPANT_ROLES);
  const named = columns.find((column) => column === "role") ?? columns.find((column) => column.includes("role") && !column.endsWith("_id"));
  expect(named, `${PARTICIPANT_ROLES} has no column naming the role granted — L-ACT-03's grants carry a role from the closed enum`).toBeDefined();
  return named ?? "";
}

/**
 * The key columns a role grant and a participant share — the FK L-ACT-03 requires, derived rather
 * than assumed, so `(participant_id)` and `(project_id, user_id)` are both read correctly.
 */
function linkColumns(url: string, participant: Readonly<Record<string, string>>): string[] {
  const present = new Set(tableColumns(url, PARTICIPANT_ROLES));
  const shared = Object.keys(participant).filter((name) => name !== TENANT_COLUMN && name.endsWith("_id") && present.has(name));
  expect(
    shared.length,
    `${PARTICIPANT_ROLES} shares no key column with ${PARTICIPANTS} — L-ACT-03 makes a role grant a grant TO a participant, and its FK to that participant is what makes it one`,
  ).toBeGreaterThan(0);
  return shared;
}

/** Seed a participant row for (project, user) in this tenant, and read the whole row back. */
function seedParticipant(url: string, tenantId: string, projectId: string, userId: string): Record<string, string> {
  return insertRow(url, PARTICIPANTS, tenantId, { project_id: lit(projectId), user_id: lit(userId) });
}

/** Seed a role grant for an already-seeded participant, past whatever key shape the grant carries. */
function seedRoleGrant(url: string, tenantId: string, participant: Readonly<Record<string, string>>, role: string): void {
  const known: Record<string, string> = { [roleColumn(url)]: lit(role) };
  for (const name of linkColumns(url, participant)) known[name] = lit(participant[name] ?? "");
  insertRow(url, PARTICIPANT_ROLES, tenantId, known);
}

/** Every role this participant holds, read under system scope. */
function rolesGrantedTo(url: string, tenantId: string, participant: Readonly<Record<string, string>>): string[] {
  const where = [`${ident(TENANT_COLUMN)} = ${lit(tenantId)}`, ...linkColumns(url, participant).map((name) => `${ident(name)} = ${lit(participant[name] ?? "")}`)].join(" and ");
  return run(
    url,
    withSession({ [GUC_SYSTEM_REASON]: AUDIT_REASON }, `select ${ident(roleColumn(url))}::text from ${ident(PARTICIPANT_ROLES)} where ${where} order by 1;`),
  ).map((row) => row[0] ?? "");
}

type ActRow = { actType: string; actorId: string; digest: string };

/** Every act this actor has written in this tenant, read under system scope. */
function actsBy(url: string, tenantId: string, actorId: string): ActRow[] {
  const columns = tableColumns(url, ACTS);
  for (const column of [ACT_TYPE, ACTOR_ID, CONSEQUENCE_DIGEST]) {
    expect(columns, `the ${ACTS} table owes a ${column} column — it is what makes the log readable`).toContain(column);
  }
  return run(
    url,
    withSession(
      { [GUC_SYSTEM_REASON]: AUDIT_REASON },
      `select ${ident(ACT_TYPE)}::text, ${ident(ACTOR_ID)}::text, ${ident(CONSEQUENCE_DIGEST)}::text
         from ${ident(ACTS)}
        where ${ident(TENANT_COLUMN)} = ${lit(tenantId)} and ${ident(ACTOR_ID)} = ${lit(actorId)};`,
    ),
  ).map((row) => ({ actType: row[0] ?? "", actorId: row[1] ?? "", digest: row[2] ?? "" }));
}

/* ------------------------------------------------------------------ *
 * Refusals, read the one way the tree reads them (ARCH-02).
 * ------------------------------------------------------------------ */

function readProperty(value: unknown, name: string): unknown {
  if (typeof value !== "object" || value === null) return undefined;
  return (value as Record<string, unknown>)[name];
}

/** A property carried by the thrown refusal or by its cause — the shape refusalCodeOf reads. */
function refusalProperty(thrown: unknown, name: string): unknown {
  const own = readProperty(thrown, name);
  return own === undefined ? readProperty(readProperty(thrown, "cause"), name) : own;
}

/** Run the work, require it to refuse, and hand back what it threw. */
async function refusalFrom(work: () => Promise<unknown>, what: string): Promise<unknown> {
  let thrown: unknown;
  let threw = false;
  try {
    await work();
  } catch (error) {
    threw = true;
    thrown = error;
  }
  expect(threw, `${what} — the seam answered instead of refusing`).toBe(true);
  return thrown;
}

/** The refusal's code, and the proof that the code is one the closed register holds (B-17, Q-07). */
function refusedWith(thrown: unknown, code: string, what: string): void {
  expect(Object.hasOwn(REFUSALS, code), `${code} must be registered in src/core/errors.ts — the taxonomy is closed (R-SPINE-062, B-17)`).toBe(true);
  expect(refusalCodeOf(thrown), `${what} must be refused ${code}, readable via refusalCodeOf — got ${String(thrown)}`).toBe(code);
}

/* ------------------------------------------------------------------ *
 * Staging.
 * ------------------------------------------------------------------ */

type Scratch = { urlMigrate: string; urlApp: string; drop(): Promise<void> };

let scratch: Scratch | undefined;

afterAll(async () => {
  await scratch?.drop();
});

type Stage = { seam: ActSeam; url: string; tenantId: string };

/** Lazy and memoised: a throwing hook would leave every case skipped, and judge nothing. */
let staging: Promise<Stage> | undefined;
const staged = (): Promise<Stage> =>
  (staging ??= (async () => {
    const provisioned = await provisionScratchDb();
    scratch = provisioned;
    const tenantIds = seedTenants(provisioned.urlMigrate);
    const tenantId = tenantIds[TENANT_ALPHA] ?? "";
    expect(tenantId, `the scenario seeded no ${TENANT_ALPHA}`).not.toBe("");
    return { seam: await loadActSeam(provisioned.urlApp), url: provisioned.urlMigrate, tenantId };
  })());

/**
 * One project, its PRINCIPAL and a subject who holds nothing — fresh uuids every time, so a case
 * never reads another's rows. Project and user ids are plain uuids this increment (the FK to the
 * tables that own them is an IOU on their increments).
 */
type Scenario = {
  projectId: string;
  principal: string;
  subject: string;
  stranger: string;
  principalRow: Record<string, string>;
  subjectRow: Record<string, string>;
};

async function scenario(): Promise<Scenario> {
  const { url, tenantId } = await staged();
  const projectId = randomUUID();
  const principal = randomUUID();
  const subject = randomUUID();
  const principalRow = seedParticipant(url, tenantId, projectId, principal);
  seedRoleGrant(url, tenantId, principalRow, PRINCIPAL);
  const subjectRow = seedParticipant(url, tenantId, projectId, subject);
  return { projectId, principal, subject, stranger: randomUUID(), principalRow, subjectRow };
}

const ctxFor = (tenantId: string, userId: string, actorKind: ActorKind = "human"): ActorCtx => ({ tenantId, userId, actorKind });

const assign = (projectId: string, subjectUserId: string, role: string): AssignInput => ({
  type: ASSIGN_PARTICIPANT_ROLE,
  projectId,
  subjectUserId,
  role,
});

/* ------------------------------------------------------------------ *
 * AC-2: preview → Consequence → commit, with the digest carried.
 * ------------------------------------------------------------------ */

describe("AC-2: the seam's first act type, previewed and committed", () => {
  it("AC-2: preview answers a Consequence and commit writes act + state with the carried digest", async () => {
    const { seam, url, tenantId } = await staged();
    const scene = await scenario();
    const ctx = ctxFor(tenantId, scene.principal);
    const input = assign(scene.projectId, scene.subject, REVIEWER);

    const consequence = await previewOf(seam)(ctx, input);
    expect(consequence === null || consequence === undefined, "preview(ctx, input) must answer a typed Consequence (L-ACT-02)").toBe(false);
    expect(typeof consequence, "a Consequence is a typed value, not a bare scalar (L-ACT-02)").toBe("object");

    const digest = digestOf(seam)(consequence);
    expect(typeof digest, "consequenceDigest(consequence) answers a string — the one digest home (ARCH-02)").toBe("string");
    expect(digest.length, "an empty digest binds nothing").toBeGreaterThan(0);

    expect(actsBy(url, tenantId, scene.principal), "preview writes nothing — only commit writes the log (L-ACT-01)").toEqual([]);

    await commitOf(seam)(ctx, input, digest);

    const written = actsBy(url, tenantId, scene.principal);
    expect(written.length, `commit must leave exactly one ${ACTS} row for the actor — the act is recorded at the granularity performed (L-ACT-01)`).toBe(1);
    expect(written[0]?.actType, `the act row's ${ACT_TYPE} is the act type performed`).toBe(ASSIGN_PARTICIPANT_ROLE);
    expect(written[0]?.actorId, `the act row's ${ACTOR_ID} is the human who performed it`).toBe(scene.principal);
    expect(written[0]?.digest, `the act row's ${CONSEQUENCE_DIGEST} is the digest the commit carried (L-ACT-02)`).toBe(digest);

    expect(rolesGrantedTo(url, tenantId, scene.subjectRow), `commit must leave exactly one ${PARTICIPANT_ROLES} row granting the subject ${REVIEWER}`).toEqual([REVIEWER]);
  }, 300_000);
});

/* ------------------------------------------------------------------ *
 * AC-3: a digest that is no longer the one current state produces.
 * ------------------------------------------------------------------ */

describe("AC-3: a stale digest is not carried", () => {
  it(`AC-3: a commit carrying a digest an intervening act invalidated is refused ${CONSEQUENCES_NOT_CARRIED}`, async () => {
    const { seam, url, tenantId } = await staged();
    const scene = await scenario();
    const ctx = ctxFor(tenantId, scene.principal);
    const asReviewer = assign(scene.projectId, scene.subject, REVIEWER);
    const asMeasurer = assign(scene.projectId, scene.subject, MEASURER);

    const stale = digestOf(seam)(await previewOf(seam)(ctx, asReviewer));

    // The intervening act moves exactly the state the stale digest bound: the subject's roles on
    // this project.
    await commitOf(seam)(ctx, asMeasurer, digestOf(seam)(await previewOf(seam)(ctx, asMeasurer)));

    const actsBefore = actsBy(url, tenantId, scene.principal).length;
    const rolesBefore = rolesGrantedTo(url, tenantId, scene.subjectRow);
    expect(rolesBefore, "the intervening act must have moved the subject's role state, or nothing was invalidated").toContain(MEASURER);

    const thrown = await refusalFrom(() => Promise.resolve(commitOf(seam)(ctx, asReviewer, stale)), "a commit carrying a digest the current state no longer produces");
    refusedWith(thrown, CONSEQUENCES_NOT_CARRIED, "a commit whose digest is not the one current state produces (L-ACT-02)");

    expect(actsBy(url, tenantId, scene.principal).length, `a refused commit writes no ${ACTS} row`).toBe(actsBefore);
    expect(rolesGrantedTo(url, tenantId, scene.subjectRow), `a refused commit writes no ${PARTICIPANT_ROLES} row`).toEqual(rolesBefore);
  }, 300_000);
});

/* ------------------------------------------------------------------ *
 * AC-4: the permission check lives in the act seam.
 * ------------------------------------------------------------------ */

describe(`AC-4: ${PERMISSION_NOT_HELD} names the act type and the missing permission`, () => {
  it("AC-4: a participant holding no ADMINISTER_PROJECT-bearing role is refused, previewing and committing", async () => {
    const { seam, url, tenantId } = await staged();
    const scene = await scenario();
    const input = assign(scene.projectId, scene.subject, REVIEWER);

    // A digest the current state really does produce, minted by the PRINCIPAL — so the only thing
    // left for the seam to refuse is the permission.
    const digest = digestOf(seam)(await previewOf(seam)(ctxFor(tenantId, scene.principal), input));

    const unarmed = ctxFor(tenantId, scene.subject);
    for (const [what, work] of [
      ["previewing", () => Promise.resolve(previewOf(seam)(unarmed, input))],
      ["committing", () => Promise.resolve(commitOf(seam)(unarmed, input, digest))],
    ] as const) {
      const thrown = await refusalFrom(work, `${what} ${ASSIGN_PARTICIPANT_ROLE} without ${ADMINISTER_PROJECT}`);
      refusedWith(thrown, PERMISSION_NOT_HELD, `${what} an act whose permission the actor does not hold (L-ACT-03)`);
      expect(refusalProperty(thrown, "actType"), `${PERMISSION_NOT_HELD} carries the act type (L-ACT-03: "carries the act type and missing permission")`).toBe(ASSIGN_PARTICIPANT_ROLE);
      expect(refusalProperty(thrown, "permission"), `${PERMISSION_NOT_HELD} carries the missing permission`).toBe(ADMINISTER_PROJECT);
    }

    expect(actsBy(url, tenantId, scene.subject), `a refused act writes no ${ACTS} row`).toEqual([]);
    expect(actsBy(url, tenantId, scene.principal), "the PRINCIPAL only previewed, so it wrote nothing either").toEqual([]);
    expect(rolesGrantedTo(url, tenantId, scene.subjectRow), `a refused act writes no ${PARTICIPANT_ROLES} row`).toEqual([]);
  }, 300_000);

  it("AC-4: a non-participant of the project is refused the same way", async () => {
    const { seam, url, tenantId } = await staged();
    const scene = await scenario();
    const input = assign(scene.projectId, scene.subject, REVIEWER);
    const digest = digestOf(seam)(await previewOf(seam)(ctxFor(tenantId, scene.principal), input));

    const outsider = ctxFor(tenantId, scene.stranger);
    for (const [what, work] of [
      ["previewing", () => Promise.resolve(previewOf(seam)(outsider, input))],
      ["committing", () => Promise.resolve(commitOf(seam)(outsider, input, digest))],
    ] as const) {
      const thrown = await refusalFrom(work, `${what} ${ASSIGN_PARTICIPANT_ROLE} as a non-participant`);
      refusedWith(thrown, PERMISSION_NOT_HELD, "a person who is not a participant of the project holds none of its permissions (L-ACT-03)");
      expect(refusalProperty(thrown, "actType"), `${PERMISSION_NOT_HELD} carries the act type`).toBe(ASSIGN_PARTICIPANT_ROLE);
      expect(refusalProperty(thrown, "permission"), `${PERMISSION_NOT_HELD} carries the missing permission`).toBe(ADMINISTER_PROJECT);
    }

    expect(actsBy(url, tenantId, scene.stranger), `a refused act writes no ${ACTS} row`).toEqual([]);
    expect(rolesGrantedTo(url, tenantId, scene.subjectRow), `a refused act writes no ${PARTICIPANT_ROLES} row`).toEqual([]);
  }, 300_000);
});

/* ------------------------------------------------------------------ *
 * AC-6: one transaction or neither.
 * ------------------------------------------------------------------ */

/** The breaker: an owner-installed trigger that makes the state write fail, and nothing else. */
const BREAKER_FUNCTION = "cubit_verifier_break_state_write";
const BREAKER_TRIGGER = "zzz_cubit_verifier_break_state_write";

function installStateWriteBreaker(url: string): void {
  run(
    url,
    `drop trigger if exists ${ident(BREAKER_TRIGGER)} on ${ident(PARTICIPANT_ROLES)};
     create or replace function ${ident(BREAKER_FUNCTION)}() returns trigger language plpgsql as $breaker$
     begin
       raise exception 'verifier breaker: the state write fails after the act insert';
     end
     $breaker$;
     create trigger ${ident(BREAKER_TRIGGER)} before insert on ${ident(PARTICIPANT_ROLES)}
       for each row execute function ${ident(BREAKER_FUNCTION)}();`,
  );
}

function removeStateWriteBreaker(url: string): void {
  psql(url, `drop trigger if exists ${ident(BREAKER_TRIGGER)} on ${ident(PARTICIPANT_ROLES)};\ndrop function if exists ${ident(BREAKER_FUNCTION)}();`);
}

describe("AC-6 (breaker): act row and state change commit in one transaction or neither", () => {
  it("AC-6: a state write that fails after the act insert leaves neither row behind", async () => {
    const { seam, url, tenantId } = await staged();
    const scene = await scenario();
    const ctx = ctxFor(tenantId, scene.principal);
    const input = assign(scene.projectId, scene.subject, REVIEWER);

    // A digest the current state produces: what breaks must be the state write, not the guard.
    const digest = digestOf(seam)(await previewOf(seam)(ctx, input));

    installStateWriteBreaker(url);
    try {
      const thrown = await refusalFrom(
        () => Promise.resolve(commitOf(seam)(ctx, input, digest)),
        "a commit whose state write the database refuses",
      );
      expect(thrown, "the failure must surface to the caller, never be swallowed into a half-written commit (L-ACT-01)").toBeDefined();
    } finally {
      removeStateWriteBreaker(url);
    }

    expect(
      actsBy(url, tenantId, scene.principal),
      `the ${ACTS} row survived a failed state write — L-ACT-01: "act row and state change commit in one transaction or neither, enforced at the act seam"`,
    ).toEqual([]);
    expect(rolesGrantedTo(url, tenantId, scene.subjectRow), `no ${PARTICIPANT_ROLES} row can survive either`).toEqual([]);

    // The control: with the breaker gone the very same commit goes through, so the case above
    // proved a rollback rather than a seam that cannot commit at all.
    await commitOf(seam)(ctx, input, digestOf(seam)(await previewOf(seam)(ctx, input)));
    expect(actsBy(url, tenantId, scene.principal).length, "with the breaker removed the same act commits — the refusal above was the rollback, not a broken seam").toBe(1);
    expect(rolesGrantedTo(url, tenantId, scene.subjectRow), "and the state change lands with it").toEqual([REVIEWER]);
  }, 300_000);
});
