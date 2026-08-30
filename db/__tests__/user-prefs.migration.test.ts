// Live acceptance for AC-1 of inc-014-density-prefs: the `user_prefs` table, the identity idiom it
// lands under (R-UI-005, SEAM-TENANT, V-DB), and the write posture proved behaviourally rather than
// read off a policy's text.
//
// Raw SQL is spoken through psql, never a driver import: SEAM-TENANT's ban binds this file like the
// rest of the tree.
//
// B-19: nothing here transcribes a schema. The migration is found by the glob fragment the spec
// names; the columns are read from information_schema; the primary key and the foreign key are read
// from pg_constraint; the grants are read from the ACL Postgres actually holds; and "the same
// `cubit.system_reason` predicate the identity migration uses" is read off a table that migration
// landed and compared, so a Builder who rewrites that predicate everywhere at once still passes and
// one who writes a looser one here does not.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { provisionScratchDb } from "./harness";
import { BOOTSTRAP_URL, GUC_SYSTEM_REASON, HANDWRITTEN_MARKER, ROLE_APP } from "./support/fixtures";
import { ident, isTrue, lit, probeValue, psql, requiredColumns, run, scalar, withSession, type TableRef } from "./support/live-sql";

const ROOT = join(import.meta.dirname, "..", "..");
const MIGRATIONS = join(ROOT, "db", "migrations");

/* ------------------------------------------------------------------ *
 * The names this suite asserts against. Every one is a literal the increment spec states in public
 * — the table, its columns, the two modes, the migration's glob fragment — so nothing an assertion
 * leans on is hidden from the Builder (B-12).
 * ------------------------------------------------------------------ */

/** The table the increment lands (interfaces line). */
const PREFS_TABLE = "user_prefs";

/** Its columns, as the test contract spells them. */
const USER_ID_COLUMN = "user_id";
const DENSITY_COLUMN = "density";
const UPDATED_AT_COLUMN = "updated_at";

/** The parent every preference row belongs to (interfaces: `user_id` uuid primary key → `users`). */
const USERS_TABLE = "users";

/**
 * R-UI-005's two modes, and the default. Closed by the clause itself — "two modes (comfortable
 * 36 px rows, compact 28 px)" — not a roster this file froze: a third mode is a Bible change.
 */
const COMFORTABLE = "comfortable";
const COMPACT = "compact";
const DENSITY_MODES: readonly string[] = [COMFORTABLE, COMPACT];
const DEFAULT_DENSITY = COMFORTABLE;

/** A value the CHECK must refuse — anything that is not one of the two modes. */
const NOT_A_MODE = "roomy";

/** The migration this increment adds, matched as a glob fragment against db/migrations/*.sql. */
const PREFS_MIGRATION = "user-prefs";

/** What Postgres answers when a row a session tried to write fails the table's policies. */
const RLS_REFUSAL = "42501";

/** What Postgres answers when a row fails a CHECK constraint. */
const CHECK_VIOLATION = "23514";

/** The reason this suite runs its own system-scoped statements under — attributable, like any other. */
const PROBE_REASON = "test: probe the user preference store's write posture";

const usersRef = (): TableRef => ({ schema: "public", table: USERS_TABLE, sql: `public.${ident(USERS_TABLE)}` });

/**
 * The scratch database addressed as the cluster's bootstrap user. Reads and seeds go through it on
 * purpose: what the store HOLDS is a different question from what a policy admits, and a reading
 * that had to arm a scope to see a row would grade the policies twice and the rows not at all.
 */
function bootstrapUrlFor(databaseUrl: string): string {
  const url = new URL(BOOTSTRAP_URL);
  url.pathname = new URL(databaseUrl).pathname;
  return url.toString();
}

/**
 * A real account for the preference to belong to. The row is built from the columns the catalogue
 * says a `users` row cannot exist without, exactly as the live suite's own seeder builds one, so a
 * column a later increment adds to `users` is satisfied the moment it lands (B-19) — with the
 * address overridden per call, since the door makes an account's address its name.
 */
function seedUser(bootstrapUrl: string, presented: string): string {
  const table = usersRef();
  const columns = requiredColumns(bootstrapUrl, table);
  const values = columns.map((column) => (column.name === "email" ? lit(presented) : probeValue(column)));
  const userId = scalar(
    bootstrapUrl,
    `insert into ${table.sql} (${columns.map((column) => ident(column.name)).join(", ")})
       values (${values.join(", ")})
       returning ${ident(USER_ID_COLUMN)};`,
  );
  expect(userId, `seeding an account into ${USERS_TABLE} returned no ${USER_ID_COLUMN}`).not.toBe("");
  return userId;
}

/** A unique address for one seeded account, so no case can pass or fail on another's rows. */
function address(label: string): string {
  return `density-${label}-${process.pid.toString(36)}-${Date.now().toString(36)}@cubit.test`;
}

/** The privileges that can take a row away — none of them may reach the runtime role. */
const WRITE_AWAY = ["DELETE", "TRUNCATE"];

/** The privileges the runtime role is owed on the preference store. */
const OWED = ["INSERT", "SELECT", "UPDATE"];

/* ------------------------------------------------------------------ *
 * The migration, as a file.
 * ------------------------------------------------------------------ */

function prefsMigration(): { name: string; text: string } {
  const files = existsSync(MIGRATIONS) ? readdirSync(MIGRATIONS).filter((name) => name.endsWith(".sql")) : [];
  const matches = files.filter((name) => name.includes(PREFS_MIGRATION));
  expect(
    matches.length,
    `exactly one db/migrations/*${PREFS_MIGRATION}*.sql is owed (drizzle-kit generate --name ${PREFS_MIGRATION}); found ${matches.length === 0 ? "none" : matches.join(", ")}`,
  ).toBe(1);
  const name = matches[0] ?? "";
  return { name, text: readFileSync(join(MIGRATIONS, name), "utf8") };
}

/* ------------------------------------------------------------------ *
 * Staging: one scratch database, one seeded account.
 * ------------------------------------------------------------------ */

type Scratch = { urlMigrate: string; urlApp: string; drop(): Promise<void> };
let scratch: Scratch | undefined;

afterAll(async () => {
  await new Promise((resolve) => setTimeout(resolve, 250));
  await scratch?.drop();
});

type Stage = { bootstrapUrl: string; appUrl: string; userId: string };

/** Lazy and memoised: a throwing hook would leave every case skipped, and judge nothing. */
let staging: Promise<Stage> | undefined;
const staged = (): Promise<Stage> =>
  (staging ??= (async () => {
    const provisioned = await provisionScratchDb();
    scratch = provisioned;
    const bootstrapUrl = bootstrapUrlFor(provisioned.urlMigrate);
    return { bootstrapUrl, appUrl: provisioned.urlApp, userId: seedUser(bootstrapUrl, address("migration")) };
  })());

/** One column of the store, as the catalogue describes it. */
function columnFacts(url: string, column: string): { type: string; nullable: string; fallback: string } {
  const row = run(
    url,
    `select data_type, is_nullable, coalesce(column_default, '')
       from information_schema.columns
      where table_schema = 'public' and table_name = ${lit(PREFS_TABLE)} and column_name = ${lit(column)};`,
  )[0];
  expect(row, `${PREFS_TABLE} has no ${column} column — the interfaces line fixes its three columns`).toBeTruthy();
  return { type: row?.[0] ?? "", nullable: row?.[1] ?? "", fallback: row?.[2] ?? "" };
}

/** The columns a constraint of this kind covers, and what it points at, read from pg_constraint. */
function constraintColumns(url: string, table: string, kind: string): { columns: string; parent: string; parentColumns: string }[] {
  return run(
    url,
    `select (select string_agg(a.attname, ',' order by k.ord)
               from unnest(c.conkey) with ordinality k(attnum, ord)
               join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum),
            coalesce(pc.relname, ''),
            coalesce((select string_agg(a.attname, ',' order by k.ord)
               from unnest(c.confkey) with ordinality k(attnum, ord)
               join pg_attribute a on a.attrelid = c.confrelid and a.attnum = k.attnum), '')
       from pg_constraint c
       join pg_class ch on ch.oid = c.conrelid
       join pg_namespace n on n.oid = ch.relnamespace
       left join pg_class pc on pc.oid = c.confrelid
      where c.contype = ${lit(kind)} and n.nspname = 'public' and ch.relname = ${lit(table)};`,
  ).map((row) => ({ columns: row[0] ?? "", parent: row[1] ?? "", parentColumns: row[2] ?? "" }));
}

/** Row security as the catalogue records it: enabled, and forced on the owner too. */
function rowSecurityOf(url: string, table: string): { enabled: boolean; forced: boolean } {
  const row = run(
    url,
    `select c.relrowsecurity, c.relforcerowsecurity
       from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = ${lit(table)};`,
  )[0];
  return { enabled: isTrue(row?.[0] ?? ""), forced: isTrue(row?.[1] ?? "") };
}

type Policy = { name: string; command: string; using: string; check: string };

function policiesOf(url: string, table: string): Policy[] {
  return run(
    url,
    `select p.polname, p.polcmd::text,
            coalesce(pg_get_expr(p.polqual, p.polrelid), ''),
            coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '')
       from pg_policy p join pg_class c on c.oid = p.polrelid join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = ${lit(table)}
      order by 1;`,
  ).map((row) => ({ name: row[0] ?? "", command: row[1] ?? "", using: row[2] ?? "", check: row[3] ?? "" }));
}

/** The privileges a role really holds on a table, read from the ACL Postgres stores. */
function privilegesOf(url: string, table: string, role: string): string[] {
  return run(
    url,
    `select distinct a.privilege_type
       from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
       cross join lateral aclexplode(c.relacl) a
       join pg_roles g on g.oid = a.grantee
      where n.nspname = 'public' and c.relname = ${lit(table)} and g.rolname = ${lit(role)}
      order by 1;`,
  ).map((row) => row[0] ?? "");
}

/** How many preference rows the store holds for one account, counted where no policy can hide one. */
function rowsFor(bootstrapUrl: string, userId: string): number {
  return Number(scalar(bootstrapUrl, `select count(*)::text from public.${ident(PREFS_TABLE)} where ${ident(USER_ID_COLUMN)} = ${lit(userId)};`));
}

/** One lawful preference row, attempted and then rolled back — asked of the running database, and left behind nowhere. */
function probeInsert(userId: string, density?: string): string {
  const columns = density === undefined ? [USER_ID_COLUMN] : [USER_ID_COLUMN, DENSITY_COLUMN];
  const values = density === undefined ? [`${lit(userId)}::uuid`] : [`${lit(userId)}::uuid`, lit(density)];
  return `begin;\ninsert into public.${ident(PREFS_TABLE)} (${columns.map(ident).join(", ")}) values (${values.join(", ")}) returning 1;\nrollback;`;
}

/* ------------------------------------------------------------------ *
 * AC-1 — the table, its shape and its posture.
 * ------------------------------------------------------------------ */

describe("AC-1: the user-prefs migration lands the store under the identity idiom", () => {
  it("AC-1: the migration keeps its generated DDL pure and its RLS and grants after the marker", () => {
    const { name, text } = prefsMigration();
    const marker = text.indexOf(HANDWRITTEN_MARKER);
    expect(
      marker,
      `${name} must carry the marker line ${JSON.stringify(HANDWRITTEN_MARKER)} — the schema-drift lane's self-proof needs the generated half pure (SEAM-TENANT)`,
    ).toBeGreaterThanOrEqual(0);
    expect(text.indexOf(HANDWRITTEN_MARKER, marker + 1), `${name} must carry the marker exactly once`).toBe(-1);

    const generated = text.slice(0, marker);
    expect(
      generated.toLowerCase().includes(`"${PREFS_TABLE}"`) || generated.toLowerCase().includes(` ${PREFS_TABLE} `),
      `${name} must CREATE ${PREFS_TABLE} in its GENERATED half — the table is declared in src/core/db.ts and generated from there, so the drift lane stays green`,
    ).toBe(true);
    for (const construct of [/row\s+level\s+security/i, /create\s+policy/i, /\bgrant\b/i]) {
      expect(generated, `${name} has ${String(construct)} before the marker — hand-written SQL lives after it, and nowhere else`).not.toMatch(construct);
    }
  });

  it("AC-1: user_prefs holds one row per account — user_id is its primary key and its reference to users", async () => {
    const { bootstrapUrl } = await staged();
    const present = scalar(bootstrapUrl, `select count(*)::text from information_schema.tables where table_schema = 'public' and table_name = ${lit(PREFS_TABLE)};`);
    expect(present, `the migrated database holds no ${PREFS_TABLE} table (interfaces line)`).not.toBe("0");

    const userId = columnFacts(bootstrapUrl, USER_ID_COLUMN);
    expect(userId.type, `${PREFS_TABLE}.${USER_ID_COLUMN} is a uuid — it names an account`).toBe("uuid");

    const keys = constraintColumns(bootstrapUrl, PREFS_TABLE, "p");
    expect(
      keys.map((key) => key.columns),
      `${PREFS_TABLE}'s primary key must be ${USER_ID_COLUMN} alone — one row per user is what makes setDensity an upsert rather than an append`,
    ).toStrictEqual([USER_ID_COLUMN]);

    const references = constraintColumns(bootstrapUrl, PREFS_TABLE, "f");
    expect(
      references.map((key) => `${key.columns}->${key.parent}(${key.parentColumns})`),
      `${PREFS_TABLE}.${USER_ID_COLUMN} must reference ${USERS_TABLE}(${USER_ID_COLUMN}) — a preference for nobody is unrepresentable`,
    ).toStrictEqual([`${USER_ID_COLUMN}->${USERS_TABLE}(${USER_ID_COLUMN})`]);
  });

  it("AC-1: density is NOT NULL, defaults to comfortable and is closed by a CHECK to exactly the two modes", async () => {
    const { bootstrapUrl, userId } = await staged();

    const density = columnFacts(bootstrapUrl, DENSITY_COLUMN);
    expect(density.type, `${PREFS_TABLE}.${DENSITY_COLUMN} is text (interfaces line)`).toBe("text");
    expect(density.nullable, `${PREFS_TABLE}.${DENSITY_COLUMN} must be NOT NULL — a stored preference with no mode is not a preference`).toBe("NO");
    expect(
      density.fallback,
      `${PREFS_TABLE}.${DENSITY_COLUMN} must carry a DEFAULT — the live seeder's requiredColumns() only probes NOT NULL columns without one, and a CHECK-closed column it probed would red the live suites`,
    ).not.toBe("");

    // The default, as the database applies it rather than as its text reads.
    const defaulted = run(
      bootstrapUrl,
      `begin;\ninsert into public.${ident(PREFS_TABLE)} (${ident(USER_ID_COLUMN)}) values (${lit(userId)}::uuid) returning ${ident(DENSITY_COLUMN)};\nrollback;`,
    );
    expect(
      defaulted.map((row) => row[0]),
      `a preference row written with no mode must land as ${DEFAULT_DENSITY} — R-UI-005's default is the store's, so densityFor has one honest answer for an account that never chose`,
    ).toStrictEqual([DEFAULT_DENSITY]);

    // Closure, both ways: every mode the clause names is lawful, and a value outside them is not.
    for (const mode of DENSITY_MODES) {
      const written = psql(bootstrapUrl, withSession({ [GUC_SYSTEM_REASON]: PROBE_REASON }, probeInsert(userId, mode)));
      expect(written.ok, `${PREFS_TABLE} refused ${mode}, which R-UI-005 names as one of its two modes:\n${written.stderr.slice(-600)}`).toBe(true);
    }
    const forged = psql(bootstrapUrl, withSession({ [GUC_SYSTEM_REASON]: PROBE_REASON }, probeInsert(userId, NOT_A_MODE)));
    expect(forged.ok, `${PREFS_TABLE} accepted ${NOT_A_MODE} — the column must be closed by a CHECK to ${DENSITY_MODES.join(" and ")}`).toBe(false);
    expect(forged.sqlstate, `${NOT_A_MODE} was refused, but not by a CHECK constraint:\n${forged.stderr.slice(-600)}`).toBe(CHECK_VIOLATION);

    // Every probe above was rolled back, so the closure was graded without changing the store.
    expect(rowsFor(bootstrapUrl, userId), "the closure probes must leave the store as they found it").toBe(0);
  });

  it("AC-1: updated_at is a defaulted, NOT NULL timestamptz", async () => {
    const { bootstrapUrl } = await staged();
    const updated = columnFacts(bootstrapUrl, UPDATED_AT_COLUMN);
    expect(updated.type, `${PREFS_TABLE}.${UPDATED_AT_COLUMN} is a timestamptz (interfaces line)`).toBe("timestamp with time zone");
    expect(updated.nullable, `${PREFS_TABLE}.${UPDATED_AT_COLUMN} must be NOT NULL`).toBe("NO");
    expect(updated.fallback, `${PREFS_TABLE}.${UPDATED_AT_COLUMN} must be defaulted — a write never has to remember to stamp it`).not.toBe("");
  });

  it("AC-1: the store carries FORCED row-level security and the identity migration's own system-scope predicate", async () => {
    const { bootstrapUrl } = await staged();
    const security = rowSecurityOf(bootstrapUrl, PREFS_TABLE);
    expect(security.enabled, `${PREFS_TABLE} has no row-level security — nothing stands between a handle and every account's preference (V-DB)`).toBe(true);
    expect(security.forced, `${PREFS_TABLE}'s row-level security is not FORCED — an owner that escapes its own policies is not a guarantee`).toBe(true);

    // The predicate the identity migration uses, read off a table it landed rather than transcribed.
    const identityPolicies = policiesOf(bootstrapUrl, USERS_TABLE).filter((policy) => policy.using.includes(GUC_SYSTEM_REASON) || policy.check.includes(GUC_SYSTEM_REASON));
    expect(
      identityPolicies.length,
      `${USERS_TABLE} carries no policy reading ${GUC_SYSTEM_REASON} — this case reads the identity migration's own predicate from the database, and there is none to read`,
    ).toBeGreaterThan(0);
    const identity = identityPolicies[0] as Policy;

    const policies = policiesOf(bootstrapUrl, PREFS_TABLE);
    const named = policies.map((policy) => `${policy.name} (${policy.command}) using=${policy.using} check=${policy.check}`).join(" | ") || "none";
    expect(
      policies.some((policy) => policy.using === identity.using && policy.check === identity.check),
      `${PREFS_TABLE} carries no policy on the same ${GUC_SYSTEM_REASON} predicate ${USERS_TABLE} carries (using=${identity.using} check=${identity.check}) — a preference belongs to a person, not a workspace, so the identity idiom is the posture it lands under; policies found: ${named}`,
    ).toBe(true);
  });

  it("AC-1: cubit_app may read and write a preference and may not take one away", async () => {
    const { bootstrapUrl } = await staged();
    const held = privilegesOf(bootstrapUrl, PREFS_TABLE, ROLE_APP);
    for (const privilege of OWED) {
      expect(held, `${ROLE_APP} must hold ${privilege} on ${PREFS_TABLE} — densityFor reads and setDensity upserts`).toContain(privilege);
    }
    for (const privilege of WRITE_AWAY) {
      expect(held, `${ROLE_APP} holds ${privilege} on ${PREFS_TABLE} — preferences are upserted, never deleted`).not.toContain(privilege);
    }
  });

  it("AC-1: through cubit_app, an unscoped write is refused and a named system scope carries the same row", async () => {
    const { bootstrapUrl, appUrl, userId } = await staged();
    const attempt = probeInsert(userId, COMFORTABLE);

    const unscoped = psql(appUrl, attempt);
    expect(
      unscoped.ok,
      `${ROLE_APP}, naming no system reason, wrote a preference into ${PREFS_TABLE} — the system-scope policy is what makes the seam the only writer (SEAM-TENANT)`,
    ).toBe(false);
    expect(unscoped.sqlstate, `that INSERT failed, but not as a policy refusal:\n${unscoped.stderr.slice(-800)}`).toBe(RLS_REFUSAL);
    expect(rowsFor(bootstrapUrl, userId), "the refused write must leave no row behind").toBe(0);

    const scoped = psql(appUrl, withSession({ [GUC_SYSTEM_REASON]: PROBE_REASON }, attempt));
    expect(
      scoped.ok,
      `${ROLE_APP} under a named system scope could not write ${PREFS_TABLE} at all, so the refusal above shows nothing about scope:\n${scoped.stderr.slice(-800)}`,
    ).toBe(true);
    expect(scoped.rows.some((row) => row[0] === "1"), `the system-scoped INSERT into ${PREFS_TABLE} returned no row`).toBe(true);
    expect(rowsFor(bootstrapUrl, userId), "the probe rolled back, so the store is as it was").toBe(0);

    // The same posture on the second mode, so neither branch can pass on the default alone.
    const other = psql(appUrl, withSession({ [GUC_SYSTEM_REASON]: PROBE_REASON }, probeInsert(userId, COMPACT)));
    expect(other.ok, `${ROLE_APP} under a named system scope could not store ${COMPACT}:\n${other.stderr.slice(-800)}`).toBe(true);
  });
});
