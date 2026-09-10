/**
 * AC-4 — the store the two boundary acts write into (L-ACT-02, SEAM-TENANT, R-TO-052).
 *
 * `scope_declarations` is a tenant-scoped table like any other, so the guarantees it must carry are
 * read from a PEER that already carries them rather than transcribed here: a policy named differently
 * but reading the same is the same guarantee, and a peer that changes changes the expectation with it
 * (B-19, the grids-migration precedent). What is this table's own — the cell it names and the closed
 * cause set it stands under — is asked of the store by trying to write a row it must refuse.
 *
 * The derived live seam suite (`db/__tests__/seam-tenant.live.test.ts`) enumerates every base table
 * carrying `tenant_id` and requires FORCED row-level security and a tenant policy of each; this file
 * proves the same two facts here, where the criterion names them, so a failure says which table.
 */
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { provisionScratchDb, type ScratchDb } from "./harness";
import { BOOTSTRAP_URL, GUC_SYSTEM_REASON, ROLE_APP, TENANT_COLUMN } from "./support/fixtures";
import { isTrue, lit, psql, run, withSession } from "./support/live-sql";

const REPO_ROOT = join(import.meta.dirname, "..", "..");

/** The table the two acts write one row into, and the migration the criterion names (AC-4). */
const TABLE = "scope_declarations";
const MIGRATION = "db/migrations/0039_scope-acts.sql";

/** A peer tenant-scoped store, whose scoping this one's is read against rather than transcribed. */
const PEER = "convention_profiles";

/** The columns AC-4 names — the cell ref, the cause, the act and whether it stands. */
const COLUMNS: readonly string[] = [TENANT_COLUMN, "project_id", "campaign_id", "class", "kind", "level_id", "cause", "act_id", "in_force"];

/** The closed cause set a declaration may stand under — one per axis (L-QTY-05, risk note 2). */
const CAUSES: readonly string[] = ["NOT_IN_PROJECT_SCOPE", "NOT_IN_THIS_BILL"];

const REASON = "test: probe the scope declaration store's closed cause set";

/** A CHECK violation, as Postgres names one. */
const CHECK_VIOLATION = "23514";

type Stage = { bootstrapUrl: string };

let scratch: ScratchDb | undefined;
let staging: Promise<Stage> | undefined;

/** Lazy and memoised: a throwing hook would leave every case skipped, and judge nothing. */
const staged = (): Promise<Stage> =>
  (staging ??= (async () => {
    const provisioned = await provisionScratchDb();
    scratch = provisioned;
    const url = new URL(BOOTSTRAP_URL);
    url.pathname = new URL(provisioned.urlMigrate).pathname;
    return { bootstrapUrl: url.toString() };
  })());

afterAll(async () => {
  await scratch?.drop();
});

async function holds(table: string): Promise<boolean> {
  const { bootstrapUrl } = await staged();
  return (
    run(
      bootstrapUrl,
      `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind in ('r', 'p') and c.relname = ${lit(table)};`,
    ).length === 1
  );
}

/** The table, asserted present first, so a case below reds as the absence rather than as psql. */
async function requireTable(): Promise<void> {
  expect(await holds(TABLE), `public.${TABLE} is missing from the migrated database — the product does not store a scope declaration yet`).toBe(true);
}

async function columnsOf(table: string): Promise<string[]> {
  const { bootstrapUrl } = await staged();
  return run(bootstrapUrl, `select column_name from information_schema.columns where table_schema = 'public' and table_name = ${lit(table)} order by 1;`).map((row) => row[0] ?? "");
}

async function securityOf(table: string): Promise<{ enabled: string; forced: string }> {
  const { bootstrapUrl } = await staged();
  const rows = run(bootstrapUrl, `select relrowsecurity::text, relforcerowsecurity::text from pg_class where oid = ${lit(`public.${table}`)}::regclass;`);
  return { enabled: rows[0]?.[0] ?? "", forced: rows[0]?.[1] ?? "" };
}

/** The policies a table wears, as what they SAY rather than as what they are called. */
async function policiesOf(table: string): Promise<string[]> {
  const { bootstrapUrl } = await staged();
  return run(
    bootstrapUrl,
    `select polcmd::text || ' | ' || coalesce(pg_get_expr(polqual, polrelid), '-') || ' | ' || coalesce(pg_get_expr(polwithcheck, polrelid), '-')
       from pg_policy where polrelid = ${lit(`public.${table}`)}::regclass order by 1;`,
  ).map((row) => (row[0] ?? "").replaceAll(`"${table}".`, "").replaceAll(table, ""));
}

async function privilegesOf(table: string, role: string): Promise<string[]> {
  const { bootstrapUrl } = await staged();
  return run(
    bootstrapUrl,
    `select distinct privilege_type from information_schema.role_table_grants
      where table_schema = 'public' and table_name = ${lit(table)} and grantee = ${lit(role)} order by 1;`,
  ).map((row) => row[0] ?? "");
}

/** One declaration, as the store is asked to accept it: lawful unless the case says otherwise. */
function insertDeclaration(cause: string): string {
  return `insert into "${TABLE}" (${COLUMNS.map((column) => `"${column}"`).join(", ")})
    values (${lit(randomUUID())}::uuid, ${lit(randomUUID())}::uuid, ${lit(randomUUID())}::uuid,
            ${lit("column")}, ${lit("rcc.concrete")}, ${lit(randomUUID())}::uuid,
            ${lit(cause)}, ${lit(randomUUID())}::uuid, true);`;
}

async function attempt(cause: string): Promise<ReturnType<typeof psql>> {
  const { bootstrapUrl } = await staged();
  return psql(bootstrapUrl, withSession({ [GUC_SYSTEM_REASON]: REASON }, insertDeclaration(cause)));
}

describe("AC-4: the scope declaration store is migrated, scoped and closed on its causes", () => {
  it("AC-4: the migration lands the table with the cell it names, the cause, the act and whether it stands", async () => {
    expect(existsSync(join(REPO_ROOT, MIGRATION)), `${MIGRATION} is the migration this store arrives in (AC-4)`).toBe(true);
    await requireTable();

    const held = await columnsOf(TABLE);
    const missing = COLUMNS.filter((column) => !held.includes(column));
    expect(missing, `a declaration names the cell it stands over, the cause it stands under, the act that made it and whether it is in force — ${TABLE} holds ${held.join(", ")}`).toEqual([]);
  });

  it("AC-4: it is tenant-scoped exactly as a peer store is — forced row-level security and a tenant policy", async () => {
    await requireTable();

    const mine = await securityOf(TABLE);
    expect(isTrue(mine.enabled), `row-level security is enabled on ${TABLE} (SEAM-TENANT)`).toBe(true);
    expect(isTrue(mine.forced), `and FORCED, so the owner is bound by it too — which is what the derived live seam suite enumerates and requires`).toBe(true);
    expect(mine, `and it stands exactly where ${PEER} stands, rather than at a scoping of its own`).toEqual(await securityOf(PEER));

    const policies = await policiesOf(TABLE);
    expect(policies.length, `${TABLE} wears at least one policy`).toBeGreaterThan(0);
    expect(policies, `and what its policies SAY is what ${PEER}'s say — a store scoped differently from its peers is a seam with two readings`).toEqual(await policiesOf(PEER));
    expect(await privilegesOf(TABLE, ROLE_APP), `and the application role holds on it exactly what it holds on ${PEER}`).toEqual(await privilegesOf(PEER, ROLE_APP));
  });

  it("AC-4: the cause is closed over the two axes — anything else the store refuses", async () => {
    await requireTable();

    for (const cause of CAUSES) {
      const lawful = await attempt(cause);
      expect(lawful.ok, `${cause} is one of the two causes a person may declare a cell under, so the store accepts it: ${lawful.stderr}`).toBe(true);
    }

    for (const cause of ["NOT_ESTABLISHED", "INGESTION_TRUNCATED", "not_in_this_bill", ""]) {
      const refused = await attempt(cause);
      expect(refused.ok, `'${cause}' is not a cause a PERSON declares — the machine's causes are read, never written — so the store refuses the row however it reached the insert`).toBe(false);
      expect(refused.sqlstate, `and it is a CHECK that refused '${cause}', not something else about the row`).toBe(CHECK_VIOLATION);
    }
  });
});
