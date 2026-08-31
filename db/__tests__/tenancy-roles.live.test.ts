/**
 * Public acceptance for inc-010a1a, the ground half (AC-1 and AC-2), driven live against a scratch
 * database the committed migrations built (V-DB):
 *
 *   AC-1 — `memberships.workspace_role`: the migration that adds it, the column's declared facts,
 *          the CHECK that closes it over the exported roster, the DEFAULT an account enrolled
 *          through the shipped sign-up door lands under (R-SPINE-002), and the two limbs of
 *          `src/modules/spine/participants`' role-history guard the column arms.
 *   AC-2 — writes to `memberships` are system-only under FORCE row-level security, proved as the
 *          app role rather than read off a policy's text.
 *
 * Raw SQL is spoken through psql, never a driver import — SEAM-TENANT's ban binds this file like
 * the rest of the tree. The people are real: each is made through the shipped sign-up door, so the
 * membership whose role AC-1 reads is one the product itself wrote.
 *
 * B-19: nothing here transcribes a schema or a roster. The migration is found by the glob fragment
 * the spec names; the column's facts are read from information_schema; the closed set is read from
 * `pg_get_constraintdef` and compared against `WORKSPACE_ROLES` as the product exports it, so an
 * increment that widens the roster passes this file without an edit; and the write posture is
 * probed as the app role, with both an admitting control and the grants that prove the refusal is
 * the policy rather than a missing privilege.
 *
 * NOTE FOR THE BUILDER: product modules are loaded by absolute path, so the `@/*` tsconfig alias is
 * never resolved inside them — keep imports between `src/` files relative, as `src/core/db.ts` does.
 */
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { refusalCodeOf } from "../../src/core/faults/refusal-marker";
import { provisionScratchDb, type ScratchDb } from "./harness";
import { GUC_SYSTEM_REASON, GUC_TENANT, HANDWRITTEN_MARKER, ROLE_APP, TENANT_COLUMN } from "./support/fixtures";
import { count, deriveTenantScopedTables, ident, isTrue, lit, psql, qualified, run, scalar, withSession } from "./support/live-sql";

const REPO_ROOT = join(import.meta.dirname, "..", "..");
const MIGRATIONS = join(REPO_ROOT, "db", "migrations");

/* ------------------------------------------------------------------ the names the increment states */

/** The seam that declares the column and exports the roster (interfaces line). */
const DB_MODULE = "src/core/db.ts";

/** The module whose one role-history guard the column arms (AC-1's reserved limb). */
const PARTICIPANTS_MODULE = "src/modules/spine/participants";

/** The door an account arrives through (R-SPINE-002). */
const AUTH_MODULE = "src/server/auth/session.ts";

/** The table the column lands on, and the column itself. */
const MEMBERSHIPS = "memberships";
const ROLE_COLUMN = "workspace_role";

/** The roles, as the interfaces line spells them, and the default an account lands under. */
const OWNER = "OWNER";
const ADMIN = "ADMIN";
const MEMBER = "MEMBER";
const DEFAULT_ROLE = OWNER;

/** A value the CHECK must refuse: a role-shaped name the roster does not hold. */
const NOT_A_ROLE = "SUPERUSER";

/** The migration this increment adds, matched as a glob fragment against db/migrations/*.sql. */
const ROLES_MIGRATION = "tenancy-roles";

/** The refusal the participants guard answers a caller who may not read a project's history. */
const PERMISSION_NOT_HELD = "PERMISSION_NOT_HELD";

/** What Postgres answers when a statement is refused by a table's policies, and by a CHECK. */
const RLS_REFUSAL = "42501";
const CHECK_VIOLATION = "23514";

/** The reason this suite runs its own system-scoped statements under — attributable, like any other. */
const PROBE_REASON = "test: probe the workspace-role column and the memberships write posture";

/* ------------------------------------------------------------------ loading the product */

async function productModule<T = Record<string, unknown>>(relative: string): Promise<T> {
  let abs = join(REPO_ROOT, relative);
  expect(existsSync(abs), `${relative} is missing from the checkout — the product does not provide it yet`).toBe(true);
  if (statSync(abs).isDirectory()) {
    const barrel = ["index.ts", "index.tsx", "index.mts"].map((file) => join(abs, file)).find((file) => existsSync(file));
    expect(barrel, `${relative} is a directory with no index barrel`).toBeTruthy();
    abs = barrel ?? abs;
  }
  const specifier: string = abs;
  return (await import(specifier)) as T;
}

type AnyFn = (...args: never[]) => unknown;

function exported(bag: Record<string, unknown>, name: string, home: string): AnyFn {
  expect(typeof bag[name], `${home} must export ${name} — the increment's declared interface`).toBe("function");
  return bag[name] as AnyFn;
}

const callFn = (fn: AnyFn, ...args: unknown[]): unknown => (fn as unknown as (...rest: unknown[]) => unknown)(...args);

/* ------------------------------------------------------------------ the database, as the owner reads it */

let scratch: ScratchDb | undefined;

afterAll(async () => {
  await scratch?.drop();
});

const sysRun = (url: string, script: string): string[][] => run(url, withSession({ [GUC_SYSTEM_REASON]: PROBE_REASON }, script));
const sysScalar = (url: string, script: string): string => scalar(url, withSession({ [GUC_SYSTEM_REASON]: PROBE_REASON }, script));
const sysCount = (url: string, script: string): number => count(url, withSession({ [GUC_SYSTEM_REASON]: PROBE_REASON }, script));

/* ------------------------------------------------------------------ staging: real people, one workspace */

type Person = { userId: string; email: string };

type Stage = {
  /** The scratch database as the migrate role — under FORCE RLS, so every read names a scope. */
  url: string;
  /** The same database as the runtime role, which is who AC-2's probes speak as. */
  appUrl: string;
  tenantId: string;
  owner: Person;
  joiner: Person;
  outsider: Person;
  projectId: string;
  participants: () => Promise<Record<string, unknown>>;
};

let staging: Promise<Stage> | undefined;

/** Lazy and memoised: a throwing hook would leave every case skipped, and judge nothing. */
const staged = (): Promise<Stage> =>
  (staging ??= (async () => {
    const provisioned = await provisionScratchDb();
    scratch = provisioned;
    process.env["DATABASE_URL"] = provisioned.urlApp;
    const url = provisioned.urlMigrate;

    const auth = await productModule<Record<string, unknown>>(AUTH_MODULE);
    const signUp = exported(auth, "signUp", AUTH_MODULE);

    /** One real account, through the shipped door — and the door is never told a role (AC-1). */
    const enrol = async (label: string): Promise<Person> => {
      const marker = `${label}-${randomUUID().slice(0, 8)}`;
      const email = `inc010a1a-${marker}@cubit.test`;
      const request = {
        email,
        password: "correct horse battery staple",
        tenantName: `Roles ${marker}`,
        deviceLabel: "acceptance",
        origin: "https://cubit.example",
        requestId: randomUUID(),
      };
      expect(
        Object.keys(request).filter((field) => field.toLowerCase().includes("role")),
        "the sign-up door is asked for no role at all — R-SPINE-002's membership is written by the transaction, not by the caller",
      ).toEqual([]);
      const answer = (await callFn(signUp, request)) as { sessionToken?: string };
      expect(typeof answer?.sessionToken, "the sign-up door answers with a session token (R-SPINE-002)").toBe("string");
      const userId = sysScalar(url, `select user_id::text from users where email like ${lit(`%${marker}%`)} limit 1;`);
      return { userId, email };
    };

    const owner = await enrol("owner");
    const joiner = await enrol("joiner");
    const outsider = await enrol("outsider");

    const tenantId = sysScalar(url, `select ${ident(TENANT_COLUMN)}::text from ${ident(MEMBERSHIPS)} where user_id = ${lit(owner.userId)} limit 1;`);

    // The joiner joins the owner's workspace and states its role explicitly — the shape AC-1
    // re-bases participants-seam.live.test.ts's staging into, so a joiner is never an OWNER by
    // default of the column.
    sysRun(
      url,
      `insert into ${ident(MEMBERSHIPS)} (${ident(TENANT_COLUMN)}, user_id, ${ident(ROLE_COLUMN)})
         values (${lit(tenantId)}, ${lit(joiner.userId)}, ${lit(MEMBER)}) on conflict do nothing;`,
    );

    // A project of that workspace with the owner standing on it as PRINCIPAL, so its role history
    // has something in it to read — and the joiner deliberately does not participate.
    const projectId = sysScalar(url, `insert into projects (${ident(TENANT_COLUMN)}, name) values (${lit(tenantId)}, 'Workspace roles acceptance') returning project_id::text;`);
    sysRun(
      url,
      `insert into participants (${ident(TENANT_COLUMN)}, project_id, user_id) values (${lit(tenantId)}, ${lit(projectId)}, ${lit(owner.userId)});
       insert into participant_roles (${ident(TENANT_COLUMN)}, project_id, user_id, role) values (${lit(tenantId)}, ${lit(projectId)}, ${lit(owner.userId)}, 'PRINCIPAL');`,
    );

    let participantsModule: Promise<Record<string, unknown>> | undefined;
    return {
      url,
      appUrl: provisioned.urlApp,
      tenantId,
      owner,
      joiner,
      outsider,
      projectId,
      participants: () => (participantsModule ??= productModule<Record<string, unknown>>(PARTICIPANTS_MODULE)),
    };
  })());

/** The roster the product exports — the one home the CHECK and every guard derive from. */
async function workspaceRoles(): Promise<readonly string[]> {
  const db = await productModule<Record<string, unknown>>(DB_MODULE);
  const roster = db["WORKSPACE_ROLES"];
  expect(Array.isArray(roster), `${DB_MODULE} must export WORKSPACE_ROLES — the one roster the CHECK and every guard derive from (interfaces line)`).toBe(true);
  const values = (roster as unknown[]).map(String);
  expect(values.length, "WORKSPACE_ROLES names the workspace roles R-SPINE-003 states").toBeGreaterThan(0);
  return values;
}

/** What the workspace role of one membership reads, under system scope. */
function roleOf(url: string, tenantId: string, userId: string): string {
  return sysScalar(url, `select ${ident(ROLE_COLUMN)}::text from ${ident(MEMBERSHIPS)} where ${ident(TENANT_COLUMN)} = ${lit(tenantId)} and user_id = ${lit(userId)};`);
}

/** Set one membership's workspace role, so a case can stage the actor it needs. */
function setRole(url: string, tenantId: string, userId: string, role: string): void {
  sysRun(url, `update ${ident(MEMBERSHIPS)} set ${ident(ROLE_COLUMN)} = ${lit(role)} where ${ident(TENANT_COLUMN)} = ${lit(tenantId)} and user_id = ${lit(userId)};`);
}

/* ------------------------------------------------------------------ AC-1: the migration */

function migrationFiles(): string[] {
  return existsSync(MIGRATIONS) ? readdirSync(MIGRATIONS).filter((name) => name.endsWith(".sql")) : [];
}

function rolesMigration(): { name: string; text: string } {
  const matches = migrationFiles().filter((name) => name.includes(ROLES_MIGRATION));
  expect(
    matches.length,
    `exactly one db/migrations/*${ROLES_MIGRATION}*.sql is owed (drizzle-kit generate --name ${ROLES_MIGRATION}); found ${matches.length === 0 ? "none" : matches.join(", ")}`,
  ).toBe(1);
  const name = matches[0] ?? "";
  return { name, text: readFileSync(join(MIGRATIONS, name), "utf8") };
}

/** The constructs SEAM-TENANT keeps out of generated DDL — they are hand-written, after the marker. */
const HAND_WRITTEN = [/row\s+level\s+security/i, /create\s+policy/i, /drop\s+policy/i, /\bgrant\b/i, /\brevoke\b/i];

describe("AC-1: the tenancy-roles migration", () => {
  it("AC-1: it is journal-appended at the next free index", () => {
    const { name } = rolesMigration();
    const tag = name.replace(/\.sql$/, "");
    const prefix = /^(\d{4})_/.exec(name)?.[1];
    expect(prefix, `${name} must carry drizzle's four-digit index prefix`).toBeDefined();

    const journal = JSON.parse(readFileSync(join(MIGRATIONS, "meta", "_journal.json"), "utf8")) as { entries?: { idx?: number; tag?: string }[] };
    const entries = journal.entries ?? [];
    expect(entries.length, "db/migrations/meta/_journal.json holds the applied migrations").toBeGreaterThan(0);

    const entry = entries.find((held) => held.tag === tag);
    expect(entry, `the journal must name ${tag} — a migration the journal does not hold is a migration the lane never applies`).toBeDefined();
    expect(entry?.idx, `${tag}'s journal index must be the index its filename states`).toBe(Number(prefix));

    // "The next free index", stated as the rule rather than as today's number: the entries are
    // contiguous from zero and this one is the last of them, so the increment appended rather than
    // rewrote (history is append-only).
    expect(
      entries.map((held) => held.idx),
      "the journal's indexes are contiguous from 0 — a landed migration is superseded, never renumbered",
    ).toEqual(entries.map((_held, index) => index));
    expect(entry?.idx, `${tag} must be the last journal entry — it is appended at the next free index`).toBe(entries.length - 1);
  });

  it("AC-1: its generated DDL adds the column and stays pure, with any hand-written SQL after the marker", () => {
    const { name, text } = rolesMigration();
    const marker = text.indexOf(HANDWRITTEN_MARKER);
    const generated = marker === -1 ? text : text.slice(0, marker);

    expect(
      generated.replace(/\s+/g, " "),
      `${name}'s generated DDL must add ${ROLE_COLUMN} to ${MEMBERSHIPS} — the column is declared in src/core/db.ts's pgTable and generated from it`,
    ).toMatch(new RegExp(`alter table [^;]*${MEMBERSHIPS}[^;]*add column [^;]*${ROLE_COLUMN}`, "i"));

    for (const construct of HAND_WRITTEN) {
      expect(
        generated,
        `${name} has ${String(construct)} before the hand-written marker — the drift lane's self-proof needs the generated DDL pure (SEAM-TENANT)`,
      ).not.toMatch(construct);
    }

    // The marker is owed exactly when there is hand-written SQL to put after it: AC-2's tightening
    // is appended only if the shipped policy is looser than system-only, so a migration that needed
    // none owes no marker either.
    if (HAND_WRITTEN.some((construct) => construct.test(text))) {
      expect(marker, `${name} carries hand-written SQL, so it must carry the marker line ${JSON.stringify(HANDWRITTEN_MARKER)} before it`).toBeGreaterThanOrEqual(0);
      expect(text.indexOf(HANDWRITTEN_MARKER, marker + 1), `${name} must carry the marker exactly once`).toBe(-1);
    }
  });
});

/* ------------------------------------------------------------------ AC-1: the column, live */

describe("AC-1: workspace_role, as the migrated database holds it", () => {
  it("AC-1: it is text, NOT NULL, and defaulted to OWNER", async () => {
    const stage = await staged();
    const facts = run(
      stage.url,
      `select data_type, is_nullable, coalesce(column_default, '')
         from information_schema.columns
        where table_schema = 'public' and table_name = ${lit(MEMBERSHIPS)} and column_name = ${lit(ROLE_COLUMN)};`,
    )[0];
    expect(facts, `${MEMBERSHIPS}.${ROLE_COLUMN} is owed — R-SPINE-003's workspace roles have nowhere to live without it`).toBeDefined();
    expect(facts?.[0], `${MEMBERSHIPS}.${ROLE_COLUMN} is text (interfaces line)`).toBe("text");
    expect(facts?.[1], `${MEMBERSHIPS}.${ROLE_COLUMN} must be NOT NULL — a membership with no role is not a membership`).toBe("NO");
    expect(facts?.[2], `${MEMBERSHIPS}.${ROLE_COLUMN} must carry a DEFAULT of ${DEFAULT_ROLE}`).toContain(DEFAULT_ROLE);

    // The default as the database applies it, not as its text reads.
    const defaulted = sysRun(
      stage.url,
      `begin;
       insert into ${ident(MEMBERSHIPS)} (${ident(TENANT_COLUMN)}, user_id) values (${lit(stage.tenantId)}, ${lit(stage.outsider.userId)}) returning ${ident(ROLE_COLUMN)};
       rollback;`,
    );
    expect(
      defaulted.map((row) => row[0]),
      `a membership written with no role must land as ${DEFAULT_ROLE} — that DEFAULT is what serves R-SPINE-002 without touching the sign-up transaction`,
    ).toStrictEqual([DEFAULT_ROLE]);
  }, 300_000);

  it("AC-1: a CHECK closes it over exactly the exported WORKSPACE_ROLES", async () => {
    const stage = await staged();
    const roster = await workspaceRoles();

    const defs = run(
      stage.url,
      `select pg_get_constraintdef(c.oid)
         from pg_constraint c join pg_class t on t.oid = c.conrelid
        where t.relname = ${lit(MEMBERSHIPS)} and c.contype = 'c';`,
    ).map((row) => row[0] ?? "");
    const closing = defs.filter((def) => def.includes(ROLE_COLUMN));
    expect(closing, `${MEMBERSHIPS}.${ROLE_COLUMN} carries no CHECK constraint; the table's checks are: ${defs.join(" | ") || "none"}`).not.toEqual([]);

    const named = new Set<string>();
    for (const def of closing) {
      for (const match of def.matchAll(/'([^']*)'/g)) named.add(match[1] ?? "");
    }
    expect(
      [...named].sort(),
      `the CHECK on ${ROLE_COLUMN} must close it over exactly the roster src/core/db.ts exports, and over nothing else — one roster, derived (B-17, B-19): ${closing.join(" | ")}`,
    ).toEqual([...roster].sort());

    // Closure both ways, as the database applies it: every exported role is lawful, and a
    // role-shaped name outside the roster is refused by the CHECK itself.
    for (const role of roster) {
      const written = psql(
        stage.url,
        withSession(
          { [GUC_SYSTEM_REASON]: PROBE_REASON },
          `begin;
           insert into ${ident(MEMBERSHIPS)} (${ident(TENANT_COLUMN)}, user_id, ${ident(ROLE_COLUMN)}) values (${lit(stage.tenantId)}, ${lit(stage.outsider.userId)}, ${lit(role)});
           rollback;`,
        ),
      );
      expect(written.ok, `${MEMBERSHIPS} refused ${role}, which WORKSPACE_ROLES names:\n${written.stderr.slice(-600)}`).toBe(true);
    }

    expect(roster, `this case's counter-example must be outside the roster; ${NOT_A_ROLE} is not`).not.toContain(NOT_A_ROLE);
    const forged = psql(
      stage.url,
      withSession(
        { [GUC_SYSTEM_REASON]: PROBE_REASON },
        `begin;
         insert into ${ident(MEMBERSHIPS)} (${ident(TENANT_COLUMN)}, user_id, ${ident(ROLE_COLUMN)}) values (${lit(stage.tenantId)}, ${lit(stage.outsider.userId)}, ${lit(NOT_A_ROLE)});
         rollback;`,
      ),
    );
    expect(forged.ok, `${MEMBERSHIPS} accepted ${NOT_A_ROLE} — the column must be closed by a CHECK to the exported roster`).toBe(false);
    expect(forged.sqlstate, `${NOT_A_ROLE} was refused, but not by a CHECK constraint:\n${forged.stderr.slice(-600)}`).toBe(CHECK_VIOLATION);

    expect(
      sysCount(stage.url, `select count(*) from ${ident(MEMBERSHIPS)} where user_id = ${lit(stage.outsider.userId)} and ${ident(TENANT_COLUMN)} = ${lit(stage.tenantId)};`),
      "every closure probe rolled back, so the store is as it was",
    ).toBe(0);
  }, 300_000);

  it("AC-1: an account enrolled through the shipped sign-up door holds a membership reading OWNER", async () => {
    const stage = await staged();
    expect(
      roleOf(stage.url, stage.tenantId, stage.owner.userId),
      `the personal workspace R-SPINE-002 mints at sign-up makes its account the ${OWNER} — with no role named by any caller, because the door is never given one`,
    ).toBe(OWNER);
  }, 300_000);
});

/* ------------------------------------------------------------------ AC-1: the reserved limb, armed */

interface RefusalError extends Error {
  refusalCode: string;
}

function property(value: unknown, name: string): unknown {
  if (typeof value !== "object" || value === null) return undefined;
  const own = (value as Record<string, unknown>)[name];
  if (own !== undefined) return own;
  const cause = (value as { cause?: unknown }).cause;
  return typeof cause === "object" && cause !== null ? (cause as Record<string, unknown>)[name] : undefined;
}

const isRefusal = (thrown: unknown): thrown is RefusalError => typeof property(thrown, "refusalCode") === "string";

async function refusalFrom(work: () => Promise<unknown> | unknown, what: string): Promise<unknown> {
  try {
    await work();
  } catch (thrown) {
    return thrown;
  }
  expect.fail(`${what} — the seam answered instead of refusing`);
}

describe("AC-1: the participants role-history guard's OWNER/ADMIN limb, armed by the column", () => {
  it("AC-1: a workspace OWNER or ADMIN who does not participate reads a project's role history, and a MEMBER does not", async () => {
    const stage = await staged();
    const participants = await stage.participants();
    const roleHistory = exported(participants, "roleHistory", `${PARTICIPANTS_MODULE}/index.ts`);
    const ctx = { tenantId: stage.tenantId, userId: stage.joiner.userId, actorKind: "human" as const };
    const read = (): Promise<unknown> => callFn(roleHistory, ctx, { projectId: stage.projectId }) as Promise<unknown>;

    // The refusing limb first, so the admitting ones below cannot pass by a guard that admits all.
    setRole(stage.url, stage.tenantId, stage.joiner.userId, MEMBER);
    const thrown = await refusalFrom(read, `reading a project's role history as a workspace ${MEMBER} who does not participate`);
    expect(refusalCodeOf(thrown), `a workspace ${MEMBER} who neither participates nor holds ${OWNER} or ${ADMIN} stays refused (L-ACT-03): ${String(thrown)}`).toBe(PERMISSION_NOT_HELD);
    expect(isRefusal(thrown), `${PERMISSION_NOT_HELD} must travel as the settled refusal marker`).toBe(true);

    for (const role of [OWNER, ADMIN]) {
      setRole(stage.url, stage.tenantId, stage.joiner.userId, role);
      const history = await read();
      expect(
        Array.isArray(history),
        `a workspace ${role} who does not participate reads the project's role history — the limb src/modules/spine/participants/guard.ts reserved for this node, now reading ${ROLE_COLUMN} (L-ACT-03)`,
      ).toBe(true);
      expect((history as unknown[]).length, `and it is the project's real history, not an empty answer`).toBeGreaterThan(0);
    }

    setRole(stage.url, stage.tenantId, stage.joiner.userId, MEMBER);
  }, 300_000);
});

/* ------------------------------------------------------------------ AC-2: the write posture */

describe("AC-2: writes to memberships are system-only under FORCE row-level security", () => {
  it("AC-2: memberships is covered by the live suite's own enumeration, under FORCED row security", async () => {
    const stage = await staged();
    const enumerated = deriveTenantScopedTables(stage.url).map(qualified);
    expect(
      enumerated,
      `${MEMBERSHIPS} must be reached by the live suite's information_schema enumeration — coverage is derived from the ${TENANT_COLUMN} column, never from a roster this increment froze (B-19)`,
    ).toContain(`public.${MEMBERSHIPS}`);

    const security = run(
      stage.url,
      `select c.relrowsecurity, c.relforcerowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = ${lit(MEMBERSHIPS)};`,
    )[0];
    expect(isTrue(security?.[0] ?? ""), `${MEMBERSHIPS} has no row-level security`).toBe(true);
    expect(isTrue(security?.[1] ?? ""), `${MEMBERSHIPS}'s row-level security is not FORCED — an owner that escapes its own policies is not a guarantee (SEAM-TENANT)`).toBe(true);
  }, 300_000);

  it("AC-2: the runtime role still holds the privileges the seam writes with", async () => {
    const stage = await staged();
    const held = run(
      stage.url,
      `select privilege_type from information_schema.role_table_grants
        where table_schema = 'public' and table_name = ${lit(MEMBERSHIPS)} and grantee = ${lit(ROLE_APP)};`,
    ).map((row) => row[0] ?? "");
    for (const privilege of ["INSERT", "UPDATE", "SELECT"]) {
      expect(
        held,
        `${ROLE_APP} must hold ${privilege} on ${MEMBERSHIPS} — sign-up and the role law both write through the seam as this role, so the refusals below have to be the POLICY refusing and not a privilege nobody granted`,
      ).toContain(privilege);
    }
  }, 300_000);

  it("AC-2: under tenant scope the app role may not insert a membership, and under a named system scope it may", async () => {
    const stage = await staged();
    // A pair the table does not hold, so nothing but the policy can refuse it: the outsider is a
    // real account and this workspace is a real workspace, and they are not joined.
    const insert = `begin;
       insert into ${ident(MEMBERSHIPS)} (${ident(TENANT_COLUMN)}, user_id, ${ident(ROLE_COLUMN)}) values (${lit(stage.tenantId)}, ${lit(stage.outsider.userId)}, ${lit(MEMBER)}) returning user_id::text;
       rollback;`;

    const scoped = psql(stage.appUrl, withSession({ [GUC_TENANT]: stage.tenantId }, insert));
    expect(
      scoped.ok,
      `${ROLE_APP}, scoped to the workspace it was writing into, inserted a membership — a workspace's roster is written by the seam under a recorded system reason and by nothing else (R-SPINE-006, SEAM-TENANT)`,
    ).toBe(false);
    expect(
      scoped.sqlstate,
      `that INSERT failed, but not as a policy refusal — the tenant-scope policy's WITH CHECK is what has to refuse it, before any constraint fires:\n${scoped.stderr.slice(-800)}`,
    ).toBe(RLS_REFUSAL);

    const system = psql(stage.appUrl, withSession({ [GUC_SYSTEM_REASON]: PROBE_REASON }, insert));
    expect(
      system.ok,
      `${ROLE_APP} under a named system scope could not insert a membership at all, so the refusal above shows nothing about scope:\n${system.stderr.slice(-800)}`,
    ).toBe(true);
    expect(system.rows.some((row) => row[0] === stage.outsider.userId), "the system-scoped INSERT returned the row it wrote").toBe(true);

    expect(
      sysCount(stage.url, `select count(*) from ${ident(MEMBERSHIPS)} where user_id = ${lit(stage.outsider.userId)} and ${ident(TENANT_COLUMN)} = ${lit(stage.tenantId)};`),
      "both probes rolled back, so the roster is as it was",
    ).toBe(0);
  }, 300_000);

  it("AC-2: under tenant scope the app role may not update a workspace role, and under a named system scope it may", async () => {
    const stage = await staged();
    const before = roleOf(stage.url, stage.tenantId, stage.joiner.userId);
    const update = `begin;
       update ${ident(MEMBERSHIPS)} set ${ident(ROLE_COLUMN)} = ${lit(ADMIN)}
        where ${ident(TENANT_COLUMN)} = ${lit(stage.tenantId)} and user_id = ${lit(stage.joiner.userId)} returning ${ident(ROLE_COLUMN)};
       rollback;`;

    const scoped = psql(stage.appUrl, withSession({ [GUC_TENANT]: stage.tenantId }, update));
    expect(
      scoped.ok,
      `${ROLE_APP}, scoped to the workspace, rewrote a member's ${ROLE_COLUMN} — role changes are system-only writes, so a tenant-scoped session must be refused rather than silently moved out of the way`,
    ).toBe(false);
    expect(
      scoped.sqlstate,
      `that UPDATE failed, but not as a policy refusal (${RLS_REFUSAL}). A tenant-scoped session that simply cannot SEE the row updates nothing and is answered no error at all, which is not a refusal: the row stays visible under tenant scope and the WITH CHECK is what only a system scope satisfies.\n${scoped.stderr.slice(-800)}`,
    ).toBe(RLS_REFUSAL);

    const system = psql(stage.appUrl, withSession({ [GUC_SYSTEM_REASON]: PROBE_REASON }, update));
    expect(
      system.ok,
      `${ROLE_APP} under a named system scope could not update a workspace role at all, so the refusal above shows nothing about scope:\n${system.stderr.slice(-800)}`,
    ).toBe(true);
    expect(system.rows.some((row) => row[0] === ADMIN), `the system-scoped UPDATE moved the row it named to ${ADMIN}`).toBe(true);

    expect(roleOf(stage.url, stage.tenantId, stage.joiner.userId), "both probes rolled back, so the member's role is as it was").toBe(before);
  }, 300_000);
});
