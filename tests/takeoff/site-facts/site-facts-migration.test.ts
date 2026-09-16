/**
 * AC-4 (V-DB) — the SITE-fact ledger as the store holds it (SEAM-TENANT, L-MEA-06, L-ACT-01, AM-06).
 *
 * It stands beside the ledger's behavioural suite rather than under db/__tests__ — that directory's
 * lane config computes its own include list, which no static reader of this tree can see, and a file
 * no config demonstrably collects is a question the gate cannot ask. Here `tests/**` collects it, and
 * the lane split still sends it to `pnpm test:db` because it opens a live cluster.
 *
 * The migration is judged by what it DOES. The database every case reads is built by the product's
 * own lane (`scripts/db-migrate.mjs`) over the committed migrations and their journal, so no file
 * under db/migrations is read here: a table standing in that database is the migration, observed.
 *
 * Raw SQL is spoken through psql, never a driver import: SEAM-TENANT's ban binds this file like the
 * rest of the tree. What is graded is the ledger's posture — tenant-scoped under forced RLS, reachable
 * by the runtime role for SELECT and INSERT and nothing else, and append-only against its own owner,
 * on rows and on a TRUNCATE alike — plus the two closed rosters it holds: the facts it admits, which
 * are `SITE_FACTS`, read from the product rather than transcribed (B-19).
 */
import { spawnSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { enumerateTenantScopedTables, provisionScratchDb, type ScratchDb } from "../../../db/__tests__/harness";
import { BOOTSTRAP_URL, GUC_TENANT, ROLE_APP, TENANT_COLUMN } from "../../../db/__tests__/support/fixtures";
import { count, isTrue, lit, run } from "../../../db/__tests__/support/live-sql";

const REPO_ROOT = join(import.meta.dirname, "..", "..", "..");

/** The lane that applies the committed migrations — the only way a table reaches a database. */
const MIGRATE_SCRIPT = join("scripts", "db-migrate.mjs");

/** The ledger this increment lands (interfaces). */
const SITE_FACTS = "site_facts";

/** The ledger the law files it beside — a fact is entered by an act (L-ACT-01). */
const ACTS = "acts";

/** The project a fact belongs to: a SITE fact is a fact about a site, and a site is a project's. */
const PROJECTS = "projects";

/** The closed enum the fact column is checked against, read from the product (interfaces, B-19). */
const SITE_FACTS_LAW = "src/core/site-facts/law.ts";

/** The function every append-only ledger of this tree wears its belts over (L-ACT-03). */
const APPEND_ONLY = "cubit_append_only";

/**
 * What `pg_trigger.tgtype` says a belt fires on, bit by bit, as Postgres itself packs it: FOR EACH
 * ROW, BEFORE, then one bit per event. The events are read rather than the catalogue's rendering of
 * them, which prints them in bit order and not in the order a migration wrote them.
 */
const TRIGGER_ROW = 1 << 0;
const TRIGGER_BEFORE = 1 << 1;
const TRIGGER_DELETE = 1 << 3;
const TRIGGER_UPDATE = 1 << 4;

type Stage = { bootstrapUrl: string; urlMigrate: string; tenantScoped: string[] };

let scratch: ScratchDb | undefined;
let staging: Promise<Stage> | undefined;

/** Lazy and memoised: a throwing hook would leave every case skipped, and judge nothing. */
const staged = (): Promise<Stage> =>
  (staging ??= (async () => {
    const provisioned = await provisionScratchDb();
    scratch = provisioned;
    const url = new URL(BOOTSTRAP_URL);
    url.pathname = new URL(provisioned.urlMigrate).pathname;
    const bootstrapUrl = url.toString();
    return { bootstrapUrl, urlMigrate: provisioned.urlMigrate, tenantScoped: await enumerateTenantScopedTables(bootstrapUrl) };
  })());

afterAll(async () => {
  await scratch?.drop();
});

/** Does the migrated database hold the ledger at all? */
async function ledgerStands(): Promise<boolean> {
  const { bootstrapUrl } = await staged();
  return (
    run(
      bootstrapUrl,
      `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind in ('r', 'p') and c.relname = ${lit(SITE_FACTS)};`,
    ).length > 0
  );
}

/** The privileges a role holds on the ledger, as the catalogue reports them. */
async function privilegesOf(role: string): Promise<string[]> {
  const { bootstrapUrl } = await staged();
  return run(
    bootstrapUrl,
    `select distinct privilege_type from information_schema.role_table_grants
      where table_schema = 'public' and table_name = ${lit(SITE_FACTS)} and grantee = ${lit(role)}
      order by privilege_type;`,
  )
    .map((row) => row[0] ?? "")
    .sort();
}

/** The constraint definitions of one kind the ledger carries. */
async function constraintsOf(kind: "p" | "u" | "f" | "c"): Promise<string[]> {
  const { bootstrapUrl } = await staged();
  return run(
    bootstrapUrl,
    `select pg_get_constraintdef(oid) from pg_constraint
      where conrelid = ${lit(`public.${SITE_FACTS}`)}::regclass and contype = ${lit(kind)}
      order by conname;`,
  ).map((row) => row[0] ?? "");
}

/** Every upper-case literal a constraint definition admits — what a CHECK over a roster says. */
function literalsOf(definition: string): string[] {
  return [...definition.matchAll(/'([A-Z_]+)'/g)].map((found) => found[1] ?? "").sort();
}

/** The closed enum the product holds, asked of the product (B-19: never a list typed here). */
async function siteFacts(): Promise<string[]> {
  const abs = join(REPO_ROOT, SITE_FACTS_LAW);
  expect(existsSync(abs) && statSync(abs).isFile(), `${SITE_FACTS_LAW} is missing from the checkout — the closed enum this CHECK is taken over`).toBe(true);
  const specifier: string = abs;
  const law = (await import(specifier)) as { SITE_FACTS?: readonly string[] };
  expect(Array.isArray(law.SITE_FACTS), `${SITE_FACTS_LAW} publishes \`SITE_FACTS\` as a closed list (L-MEA-06)`).toBe(true);
  return [...(law.SITE_FACTS ?? [])].sort();
}

describe("AC-4: the SITE-fact ledger is migrated, tenant-scoped and append-only", () => {
  it("AC-4: the product's own migration lane lands the ledger, and running it again converges", async () => {
    const { urlMigrate } = await staged();
    expect(await ledgerStands(), `the lane applied the migration that lands public.${SITE_FACTS} (db/migrations/*site-facts*)`).toBe(true);

    const again = spawnSync(process.execPath, [join(REPO_ROOT, MIGRATE_SCRIPT)], {
      cwd: REPO_ROOT,
      env: { ...process.env, DATABASE_URL: urlMigrate },
      encoding: "utf8",
      timeout: 120_000,
    });
    expect(
      again.status,
      `a second run of the migration lane converges — an unjournaled or rewritten migration re-runs and collides:\n${`${again.stdout ?? ""}${again.stderr ?? ""}`.slice(-1200)}`,
    ).toBe(0);
    expect(await ledgerStands(), "and the ledger it landed still stands").toBe(true);
  });

  it("AC-4: it carries tenant_id and stands in the enumeration the seam suite is driven from", async () => {
    const { tenantScoped } = await staged();
    expect(
      tenantScoped,
      `public.${SITE_FACTS} carries ${TENANT_COLUMN}, so every per-table proof seam-tenant.live.test.ts makes over this enumeration binds it too (R-SPINE-004, B-19)`,
    ).toContain(`public.${SITE_FACTS}`);
  });

  it("AC-4: row-level security is enabled AND forced, with a policy that reads the tenant GUC", async () => {
    const { bootstrapUrl } = await staged();
    const row = run(
      bootstrapUrl,
      `select c.relrowsecurity, c.relforcerowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relname = ${lit(SITE_FACTS)};`,
    )[0];
    expect(isTrue(row?.[0] ?? ""), `public.${SITE_FACTS} has row-level security ENABLED`).toBe(true);
    expect(isTrue(row?.[1] ?? ""), `public.${SITE_FACTS} has row-level security FORCED — an owner is not exempt from a workspace boundary (SEAM-TENANT)`).toBe(true);
    expect(
      count(
        bootstrapUrl,
        `select count(*) from pg_policies where schemaname = 'public' and tablename = ${lit(SITE_FACTS)}
          and (coalesce(qual, '') like ${lit(`%${GUC_TENANT}%`)} or coalesce(with_check, '') like ${lit(`%${GUC_TENANT}%`)});`,
      ),
      `public.${SITE_FACTS} carries a policy that reads ${GUC_TENANT} — the boundary is the store's, not a caller's WHERE`,
    ).toBeGreaterThan(0);
  });

  it("AC-4: the runtime role may read and add, and may neither rewrite nor remove an entry", async () => {
    const held = await privilegesOf(ROLE_APP);
    expect(held, `${ROLE_APP} reads and adds public.${SITE_FACTS} — a fact is entered by the runtime (AM-06 §1)`).toEqual(expect.arrayContaining(["INSERT", "SELECT"]));
    expect(held, `${ROLE_APP} cannot UPDATE public.${SITE_FACTS} — a restated fact is another entry, never a rewrite (L-ACT-01)`).not.toContain("UPDATE");
    expect(held, `and cannot DELETE from it — an entered fact is evidence (L-ACT-01)`).not.toContain("DELETE");
  });

  it("AC-4: the ledger is append-only against its OWNER too, by row and by TRUNCATE", async () => {
    const { bootstrapUrl, urlMigrate } = await staged();
    expect(await ledgerStands(), `public.${SITE_FACTS} stands in the migrated database`).toBe(true);

    const triggers = run(
      bootstrapUrl,
      `select t.tgname, pg_get_triggerdef(t.oid) from pg_trigger t
        where t.tgrelid = ${lit(`public.${SITE_FACTS}`)}::regclass and not t.tgisinternal order by t.tgname;`,
    ).map((row) => row[1] ?? "");
    expect(triggers.length, `public.${SITE_FACTS} carries the belts the append-only ledgers wear (L-ACT-03)`).toBeGreaterThan(0);

    // The row belt is read as the EVENTS it fires on, out of `pg_trigger.tgtype`, rather than as the
    // catalogue's rendering of them: what the clause requires is a BEFORE, FOR EACH ROW belt covering
    // the UPDATE event and the DELETE event, and the order those two words are printed in is the
    // renderer's business, not the ledger's (L-ACT-03).
    const belts = run(
      bootstrapUrl,
      `select p.proname, t.tgtype::int from pg_trigger t join pg_proc p on p.oid = t.tgfoid
        where t.tgrelid = ${lit(`public.${SITE_FACTS}`)}::regclass and not t.tgisinternal order by t.tgname;`,
    ).map((row) => ({ fires: row[0] ?? "", type: Number(row[1] ?? "0") }));
    expect(
      belts.some((belt) => belt.fires === APPEND_ONLY && (belt.type & TRIGGER_DELETE) !== 0 && (belt.type & TRIGGER_UPDATE) !== 0),
      `a trigger running ${APPEND_ONLY}() covers both the UPDATE event and the DELETE event — a rewrite and a removal are the two ways a record stops being one (L-ACT-03); it carries ${JSON.stringify(belts)}`,
    ).toBe(true);
    expect(
      belts.some(
        (belt) =>
          belt.fires === APPEND_ONLY &&
          (belt.type & TRIGGER_DELETE) !== 0 &&
          (belt.type & TRIGGER_UPDATE) !== 0 &&
          (belt.type & TRIGGER_BEFORE) !== 0 &&
          (belt.type & TRIGGER_ROW) !== 0,
      ),
      `and it fires BEFORE, FOR EACH ROW — a belt that ran after the write, or once per statement, would let a row through (L-ACT-03); it carries ${JSON.stringify(belts)}`,
    ).toBe(true);
    expect(
      triggers.some((definition) => /TRUNCATE/i.test(definition) && /cubit_append_only/i.test(definition)),
      "and a BEFORE TRUNCATE trigger with it — emptying a ledger is not a way round appending to it (L-ACT-03)",
    ).toBe(true);

    // The belts are only belts if they hold: the owner itself is refused, by the ledger's own code.
    const truncated = spawnSync("psql", [urlMigrate, "-v", "ON_ERROR_STOP=1", "-c", `truncate table public.${SITE_FACTS};`], { encoding: "utf8" });
    expect(truncated.status, `the ledger's owner cannot TRUNCATE it (it answered ${JSON.stringify(`${truncated.stdout ?? ""}${truncated.stderr ?? ""}`.slice(-300))})`).not.toBe(0);
  });

  it("AC-4: a fact belongs to a project and to the act that entered it, and is one of the closed enum", async () => {
    expect(await ledgerStands(), `public.${SITE_FACTS} stands in the migrated database`).toBe(true);
    const keys = await constraintsOf("f");
    expect(
      keys.some((definition) => definition.includes("project_id") && definition.includes(PROJECTS)),
      `public.${SITE_FACTS}.project_id points at the project whose site it is (interfaces)`,
    ).toBe(true);
    expect(
      keys.some((definition) => definition.includes("act_id") && definition.includes(ACTS)),
      `and its act_id points at the act log — every entry is an act (AM-06 §1, L-ACT-01)`,
    ).toBe(true);

    const checks = (await constraintsOf("c")).filter((definition) => definition.includes("fact"));
    expect(checks.length, `public.${SITE_FACTS} carries a CHECK on fact — the roster is the store's, not a writer's memory`).toBeGreaterThan(0);
    const admitted = new Set(checks.flatMap((definition) => literalsOf(definition)));
    expect([...admitted].sort(), "the CHECK admits exactly the closed `SITE_FACTS` enum and nothing else (L-MEA-06, B-19)").toEqual(await siteFacts());
  });
});
