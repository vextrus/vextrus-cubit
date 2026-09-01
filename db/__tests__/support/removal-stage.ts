// Staging for the member-removal acceptance (R-SPINE-003's "remove member" under SEAM-ACT's
// MEMBER_HAS_ACTS coupling): one live scratch workspace whose people are real accounts, whose
// memberships were written through the shipped doors, and whose act log holds rows somebody
// actually authored.
//
// Both lanes that grade this increment are driven from here — the public db-lane suite
// (db/__tests__/member-removal.live.test.ts) and the held-out set — so every identity either of
// them asserts is declared once and imported rather than re-spelled (B-19).
//
// Raw SQL is spoken through psql and never through a driver import: SEAM-TENANT binds this suite
// like the rest of the tree. Nothing is transcribed from the schema either — the columns a probe
// row must carry are read from the migrated database's own catalogue, so a column a later increment
// adds to `acts`, `projects` or `participants` is filled the day it lands rather than breaking the
// staging.
//
// No vitest import lives here on purpose: the held-out set loads this file from the checkout while
// running under its own vitest instance, and a second `expect` bound to the checkout's instance has
// no test context to report into. Staging failures are thrown, and the test that awaits them fails.
//
// NOTE: product modules are loaded by absolute path, so the `@/*` alias is never resolved inside
// them — imports between `src/` files stay relative.
import { randomUUID } from "node:crypto";
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { provisionScratchDb, type ScratchDb } from "../harness";
import { GUC_SYSTEM_REASON, TENANT_COLUMN } from "./fixtures";
import { deriveTenantScopedTables, ident, lit, probeValue, requiredColumns, run, scalar, withSession, type TableRef } from "./live-sql";

/** The checkout this staging loads product modules out of. */
export const REPO_ROOT = join(import.meta.dirname, "..", "..", "..");

/* ------------------------------------------------------------------ the modules under test */

/** The door an account arrives through (R-SPINE-002). */
export const AUTH_MODULE = "src/server/auth/session.ts";
/** The barrel every tenant-administration caller comes through (R-SPINE-003). */
export const TENANCY_MODULE = "src/modules/spine/tenancy";
/** The coupling's own module, which this increment adds. */
export const REMOVAL_MODULE = "src/modules/spine/tenancy/removal";
/** The act seam, whose barrel re-exports the act log's one read surface. */
export const ACTS_MODULE = "src/core/acts";
/** The one reader of the refusal marker (ARCH-03, B-21). */
export const REFUSAL_MARKER_MODULE = "src/core/faults/refusal-marker.ts";
/** The closed refusal taxonomy (R-SPINE-062). */
export const ERRORS_MODULE = "src/core/errors.ts";
/** The one database seam (SEAM-TENANT), reached only to open a tenant handle for the seam's read. */
export const DB_MODULE = "src/core/db.ts";

/* ------------------------------------------------------------------ the identities asserted */

/** The three refusal codes this increment's criteria quote, spelled once. */
export const MEMBER_HAS_ACTS = "MEMBER_HAS_ACTS";
export const ORIGIN_NOT_VERIFIED = "ORIGIN_NOT_VERIFIED";
export const RATE_LIMITED = "RATE_LIMITED";

/** The roster table and the column inc-010a1a put the workspace role in. */
export const MEMBERSHIPS = "memberships";
export const ROLE_COLUMN = "workspace_role";
export const ROLE_MEMBER = "MEMBER";

/** The three tables an authored act needs to exist at all (L-ACT-01, L-ACT-03). */
export const ACTS = "acts";
export const PROJECTS = "projects";
export const PARTICIPANTS = "participants";

/** The reason this staging's own system-scoped statements run under — attributable, like any other. */
export const STAGE_REASON = "test: stage the member-removal scenario";

/** The password every staged account is enrolled with. */
export const SIGNUP_PASSWORD = "correct horse battery staple";

/** An origin this deployment does not answer at, for the guard sequence's origin arm. */
export const FOREIGN_ORIGIN = "https://another-site.example";

/** The address this scratch deployment states it answers at — the harness names it, so it is read back. */
export function deploymentOrigin(): string {
  return process.env["CUBIT_PUBLIC_ORIGIN"]?.trim() || "https://cubit.example";
}

/* ------------------------------------------------------------------ loading the product */

export type AnyFn = (...args: never[]) => unknown;

/** Import a product module by repo-relative path; a module the product lacks says so by name. */
export async function productModule<T = Record<string, unknown>>(relative: string): Promise<T> {
  const named = join(REPO_ROOT, relative);
  // A specifier written without its extension is resolved the way the tree writes them, so a path
  // this staging names cannot miss for a reason that has nothing to do with the product.
  let abs = [named, `${named}.ts`, `${named}.tsx`, `${named}.mts`].find((candidate) => existsSync(candidate)) ?? named;
  if (!existsSync(abs)) throw new Error(`${relative} is missing from the checkout — the product does not provide it yet`);
  if (statSync(abs).isDirectory()) {
    const barrel = ["index.ts", "index.tsx", "index.mts"].map((file) => join(abs, file)).find((file) => existsSync(file));
    if (barrel === undefined) throw new Error(`${relative} is a directory with no index barrel`);
    abs = barrel;
  }
  const specifier: string = abs;
  return (await import(specifier)) as T;
}

/** A function a module must export, or a failure naming the interface that is missing. */
export function exported(bag: Record<string, unknown>, name: string, home: string): AnyFn {
  const value = bag[name];
  if (typeof value !== "function") throw new Error(`${home} must export ${name} — the increment's declared interface`);
  return value as AnyFn;
}

export const callFn = (fn: AnyFn, ...args: unknown[]): unknown => (fn as unknown as (...rest: unknown[]) => unknown)(...args);

/* ------------------------------------------------------------------ the stage */

/** One staged account: the person, and the personal workspace their sign-up created. */
export type Person = { readonly userId: string; readonly email: string; readonly tenantId: string };

/** What a seeded act was written as, so a case can point at the row it means. */
export type SeededAct = { readonly actId: string; readonly tenantId: string; readonly projectId: string; readonly actorId: string };

/** A live workspace, its people, its act log, and the reads a case asks the database itself. */
export type Stage = {
  /** The scratch database as the migrate role — under FORCE RLS, so every read names a scope. */
  readonly url: string;
  /** The same database as the runtime role, which is what the product's own handles connect as. */
  readonly appUrl: string;
  /** Load a product module, memoised. */
  product<T = Record<string, unknown>>(relative: string): Promise<T>;
  /** One real account with its own personal workspace, through the shipped sign-up door. */
  enrol(label: string): Promise<Person>;
  /** Put a person on somebody else's workspace with the given workspace role. */
  join(tenantId: string, person: Person, role: string): void;
  /** One act in a tenant's log, with its actor's participation and project made first. */
  seedAct(where: { tenantId: string; actorId: string; subjectIds: readonly string[] }): Promise<SeededAct>;
  /** Is this membership still on the workspace? Read back live, so no case believes its own staging. */
  membershipCount(tenantId: string, userId: string): number;
  /** How many rows the tenant's act log holds — the number SEAM-ACT says administration never moves. */
  actCount(tenantId: string): number;
  /** The acts of this tenant that name the person as actor or among subjects, derived from the log. */
  actIdsHeldBy(tenantId: string, userId: string): string[];
  drop(): Promise<void>;
};

/**
 * Provision, migrate and open a stage. Called lazily by each suite — a throwing hook would leave
 * every case skipped, and a skipped case judges nothing.
 */
export async function openStage(): Promise<Stage> {
  const scratch: ScratchDb = await provisionScratchDb();
  // Every product handle opened from here connects as the runtime role, exactly as the app does.
  process.env["DATABASE_URL"] = scratch.urlApp;
  const url = scratch.urlMigrate;

  const loaded = new Map<string, Promise<unknown>>();
  const product = <T = Record<string, unknown>,>(relative: string): Promise<T> => {
    const already = loaded.get(relative);
    if (already !== undefined) return already as Promise<T>;
    const pending = productModule<T>(relative);
    loaded.set(relative, pending as Promise<unknown>);
    return pending;
  };

  const system = (script: string): string[][] => run(url, withSession({ [GUC_SYSTEM_REASON]: STAGE_REASON }, script));
  const systemScalar = (script: string): string => scalar(url, withSession({ [GUC_SYSTEM_REASON]: STAGE_REASON }, script));

  const tables = new Map(deriveTenantScopedTables(url).map((table) => [table.table, table]));
  const tableRef = (name: string): TableRef => {
    const table = tables.get(name);
    if (table === undefined) throw new Error(`the migrated database holds no tenant-scoped table named ${name}`);
    return table;
  };

  /**
   * One row of a tenant-scoped table, with the values a case cares about stated and every other
   * column the catalogue says is mandatory filled by its own type's probe value.
   */
  const insertRow = (table: TableRef, tenantId: string, values: Record<string, string>, returning: string): string => {
    const chosen = new Map<string, string>([[TENANT_COLUMN, `${lit(tenantId)}::uuid`]]);
    for (const column of requiredColumns(url, table)) chosen.set(column.name, values[column.name] ?? probeValue(column));
    for (const [name, value] of Object.entries(values)) chosen.set(name, value);
    return systemScalar(
      `insert into ${table.sql} (${[...chosen.keys()].map(ident).join(", ")}) values (${[...chosen.values()].join(", ")}) returning ${returning};`,
    );
  };

  const enrol = async (label: string): Promise<Person> => {
    const auth = await product<Record<string, unknown>>(AUTH_MODULE);
    const signUp = exported(auth, "signUp", AUTH_MODULE);
    const marker = `${label}-${randomUUID().slice(0, 8)}`.toLowerCase();
    const email = `${marker}@cubit.test`;
    const answer = (await callFn(signUp, {
      email,
      password: SIGNUP_PASSWORD,
      tenantName: `Removal ${marker}`,
      deviceLabel: "acceptance",
      origin: deploymentOrigin(),
      requestId: randomUUID(),
    })) as { sessionToken?: string };
    if (typeof answer?.sessionToken !== "string") throw new Error(`the sign-up door answered no session token for ${email} (R-SPINE-002)`);
    const userId = systemScalar(`select user_id::text from users where email like ${lit(`%${marker}%`)} limit 1;`);
    const tenantId = systemScalar(`select ${ident(TENANT_COLUMN)}::text from ${ident(MEMBERSHIPS)} where user_id = ${lit(userId)} limit 1;`);
    return { userId, email, tenantId };
  };

  const join = (tenantId: string, person: Person, role: string): void => {
    system(
      `insert into ${ident(MEMBERSHIPS)} (${ident(TENANT_COLUMN)}, user_id, ${ident(ROLE_COLUMN)})
         values (${lit(tenantId)}, ${lit(person.userId)}, ${lit(role)}) on conflict do nothing;`,
    );
  };

  const seedAct = async (where: { tenantId: string; actorId: string; subjectIds: readonly string[] }): Promise<SeededAct> => {
    // The act type is read off the seam's own closed enum rather than invented, so the row is one
    // the log could really hold (L-ACT-02).
    const seam = await product<{ ACT_TYPES?: readonly string[] }>(ACTS_MODULE);
    const actType = seam.ACT_TYPES?.[0];
    if (typeof actType !== "string") throw new Error(`${ACTS_MODULE} exports no ACT_TYPES to stage an act row with (L-ACT-02)`);

    const projectId = insertRow(tableRef(PROJECTS), where.tenantId, { name: lit(`removal probe ${randomUUID().slice(0, 8)}`) }, "project_id::text");
    // L-ACT-03: the actor's participation is a foreign key of the log, so it exists before the act.
    insertRow(tableRef(PARTICIPANTS), where.tenantId, { project_id: `${lit(projectId)}::uuid`, user_id: `${lit(where.actorId)}::uuid` }, "user_id::text");
    const subjects = `to_jsonb(array[${where.subjectIds.map(lit).join(", ")}]::text[])`;
    const actId = insertRow(
      tableRef(ACTS),
      where.tenantId,
      {
        project_id: `${lit(projectId)}::uuid`,
        actor_id: `${lit(where.actorId)}::uuid`,
        act_type: lit(actType),
        subjects,
        consequence_digest: lit(randomUUID()),
      },
      "act_id::text",
    );
    return { actId, tenantId: where.tenantId, projectId, actorId: where.actorId };
  };

  const membershipCount = (tenantId: string, userId: string): number =>
    Number(systemScalar(`select count(*) from ${ident(MEMBERSHIPS)} where ${ident(TENANT_COLUMN)} = ${lit(tenantId)} and user_id = ${lit(userId)};`));

  const actCount = (tenantId: string): number =>
    Number(systemScalar(`select count(*) from ${tableRef(ACTS).sql} where ${ident(TENANT_COLUMN)} = ${lit(tenantId)};`));

  const actIdsHeldBy = (tenantId: string, userId: string): string[] =>
    system(
      `select act_id::text from ${tableRef(ACTS).sql}
        where ${ident(TENANT_COLUMN)} = ${lit(tenantId)}
          and (actor_id = ${lit(userId)}::uuid or subjects @> to_jsonb(array[${lit(userId)}]::text[]))
        order by act_id;`,
    ).map((row) => row[0] ?? "");

  return { url, appUrl: scratch.urlApp, product, enrol, join, seedAct, membershipCount, actCount, actIdsHeldBy, drop: scratch.drop };
}

/* ------------------------------------------------------------------ driving the guarded entry */

/** The slot the server fills with the shipped limiter, as a case binds it. */
export type Hardening = { admit(identity: string): Promise<void> };

/** A limiter that admits every identity — the door's allowance is not what a case about removal moves. */
export const admitsEveryone: Hardening = { admit: async () => {} };

/** The guarded entry itself, bound to the hardening a case supplies (R-SPINE-006, ARCH-02). */
export async function guardedEntry(stage: Stage, hardening: Hardening): Promise<(request: unknown, mutation: unknown) => Promise<unknown>> {
  const tenancy = await stage.product<Record<string, unknown>>(TENANCY_MODULE);
  const guard = exported(tenancy, "guardTenancyMutation", `${TENANCY_MODULE}/index.ts`);
  return callFn(guard, hardening) as (request: unknown, mutation: unknown) => Promise<unknown>;
}

/**
 * A well-formed request at that entry: who is asking, from where, and under whose allowance. The
 * stated origin defaults to the address the deployment answers at — a page this deployment serves.
 */
export function requestFrom(actor: { tenantId: string; userId: string }, statedOrigin: string | null = deploymentOrigin()): Record<string, unknown> {
  return { actor, identity: actor.userId, statedOrigin, requestOrigin: deploymentOrigin(), configuredOrigin: deploymentOrigin() };
}

/** What a call at the entry answered with: the value it resolved to, or the error it rejected with. */
export type Outcome = { readonly answer: unknown; readonly rejected: false } | { readonly error: unknown; readonly rejected: true };

export async function outcomeOf(promise: Promise<unknown>): Promise<Outcome> {
  return promise.then(
    (answer) => ({ answer, rejected: false }) as Outcome,
    (error: unknown) => ({ error, rejected: true }) as Outcome,
  );
}

/** The refusal code an error carries, read by the tree's one reader of the marker (ARCH-03, B-21). */
export async function refusalCode(stage: Stage, error: unknown): Promise<string | null> {
  const marker = await stage.product<Record<string, unknown>>(REFUSAL_MARKER_MODULE);
  const read = exported(marker, "refusalCodeOf", REFUSAL_MARKER_MODULE);
  return callFn(read, error) as string | null;
}

/**
 * An Error marked the way this tree marks refusals, carrying a code read off the closed register
 * rather than re-spelled beside it (Q-07, R-SPINE-062) — what an injected limiter throws when the
 * window is already full.
 */
export async function markedRefusal(stage: Stage, code: string, message: string): Promise<Error> {
  const errors = await stage.product<{ REFUSALS?: Record<string, { code?: string } | undefined> }>(ERRORS_MODULE);
  const registered = errors.REFUSALS?.[code]?.code;
  if (typeof registered !== "string") throw new Error(`${code} is not registered in ${ERRORS_MODULE} — the taxonomy is closed (R-SPINE-062, B-06)`);
  return Object.assign(new Error(message), { refusalCode: registered });
}

/**
 * What the act seam's own read answers for a person, asked under that tenant's handle — the surface
 * the coupling is required to reach the log through, and the only one these suites ask it by.
 */
export async function actsHeldByThroughSeam(stage: Stage, tenantId: string, userId: string): Promise<readonly string[]> {
  const seam = await stage.product<Record<string, unknown>>(ACTS_MODULE);
  const read = exported(seam, "actsHeldBy", `${ACTS_MODULE} (src/core/acts/held.ts, re-exported by the barrel)`);
  const db = await stage.product<Record<string, unknown>>(DB_MODULE);
  const forTenant = exported(db, "forTenant", DB_MODULE) as unknown as (ctx: { tenantId: string }) => {
    transaction(fn: (tx: unknown) => Promise<readonly string[]>): Promise<readonly string[]>;
  };
  return forTenant({ tenantId }).transaction(async (tx) => (await callFn(read, tx, userId)) as readonly string[]);
}
