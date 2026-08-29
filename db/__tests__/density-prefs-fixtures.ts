/**
 * Shared acceptance support for inc-014-density-prefs' two database criteria (AC-1, AC-2).
 *
 * Every literal here is one the increment spec names in public — the table, the column, the two
 * modes, the seam's barrel path — so nothing an assertion leans on is hidden from the Builder
 * (B-12). Raw SQL is spoken through psql, never a driver import: SEAM-TENANT's ban binds this file
 * like the rest of the tree.
 */
import { expect } from "vitest";
import { BOOTSTRAP_URL } from "./support/fixtures";
import { ident, lit, requiredColumns, probeValue, scalar, type TableRef } from "./support/live-sql";

/** The table the increment lands (interfaces line). */
export const PREFS_TABLE = "user_prefs";

/** Its columns, as the test contract spells them. */
export const USER_ID_COLUMN = "user_id";
export const DENSITY_COLUMN = "density";
export const UPDATED_AT_COLUMN = "updated_at";

/** The parent every preference row belongs to (interfaces: `user_id` uuid primary key → `users`). */
export const USERS_TABLE = "users";

/**
 * R-UI-005's two modes, and the default. Closed by the clause itself — "two modes (comfortable
 * 36 px rows, compact 28 px)" — not a roster this file froze: a third mode is a Bible change.
 */
export const COMFORTABLE = "comfortable";
export const COMPACT = "compact";
export const DENSITY_MODES: readonly string[] = [COMFORTABLE, COMPACT];
export const DEFAULT_DENSITY = COMFORTABLE;

/** A value the CHECK must refuse — anything that is not one of the two modes. */
export const NOT_A_MODE = "roomy";

/** The migration this increment adds, matched as a glob fragment against db/migrations/*.sql. */
export const PREFS_MIGRATION = "user-prefs";

/** SEAM-PREFS' sole entry point (interfaces line). */
export const PREFS_MODULE = "src/core/prefs/index.ts";

/** What Postgres answers when a row a session tried to write fails the table's policies. */
export const RLS_REFUSAL = "42501";

/** What Postgres answers when a row fails a CHECK constraint. */
export const CHECK_VIOLATION = "23514";

/** The reason this suite runs its own system-scoped statements under — attributable, like any other. */
export const PROBE_REASON = "test: probe the user preference store's write posture";

export const prefsRef = (): TableRef => ({ schema: "public", table: PREFS_TABLE, sql: `public.${ident(PREFS_TABLE)}` });
export const usersRef = (): TableRef => ({ schema: "public", table: USERS_TABLE, sql: `public.${ident(USERS_TABLE)}` });

/**
 * The scratch database addressed as the cluster's bootstrap user. Reads and seeds go through it on
 * purpose: what the store HOLDS is a different question from what a policy admits, and a reading
 * that had to arm a scope to see a row would grade the policies twice and the rows not at all.
 */
export function bootstrapUrlFor(databaseUrl: string): string {
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
export function seedUser(bootstrapUrl: string, address: string): string {
  const table = usersRef();
  const columns = requiredColumns(bootstrapUrl, table);
  const values = columns.map((column) => (column.name === "email" ? lit(address) : probeValue(column)));
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
export function address(label: string): string {
  return `density-${label}-${process.pid.toString(36)}-${Date.now().toString(36)}@cubit.test`;
}
