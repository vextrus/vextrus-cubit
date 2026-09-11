/**
 * AC-3's store half — `public.scope_declarations`, as the migrated database holds it (V-DB,
 * R-SPINE-004, SEAM-TENANT, L-ACT-01, L-QTY-05).
 *
 * A boundary act writes one row per cell per cause, and that row is the certificate's evidence that
 * a PERSON said so. So the store owes three things a writer cannot be trusted to remember: the
 * workspace boundary (row-level security enabled AND forced, with a policy that reads the tenant
 * GUC), one row per cell and cause (`scope_declarations_one_per_cell`), and a closed cause
 * (`scope_declarations_cause_closed`) — a cause outside the two the law names is refused by the
 * store itself, whatever asks for it.
 */
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { enumerateTenantScopedTables, provisionScratchDb, type ScratchDb } from "./harness";
import { BOOTSTRAP_URL, GUC_TENANT, ROLE_APP, TENANT_COLUMN } from "./support/fixtures";
import { count, ident, isTrue, lit, psql, run, withSession } from "./support/live-sql";

const REPO_ROOT = join(import.meta.dirname, "..", "..");
const MIGRATE_SCRIPT = join("scripts", "db-migrate.mjs");

/** The store this increment lands, and the two constraints the criterion names by name. */
const SCOPE_DECLARATIONS = "scope_declarations";
const ONE_PER_CELL = "scope_declarations_one_per_cell";
const CAUSE_CLOSED = "scope_declarations_cause_closed";

/** The two causes a person may declare, and one that is not a cause at all (interfaces). */
const NOT_IN_THIS_BILL = "NOT_IN_THIS_BILL";
const NOT_IN_PROJECT_SCOPE = "NOT_IN_PROJECT_SCOPE";
const NOT_A_CAUSE = "NOT_ESTABLISHED";

/** A class and a kind of the closed vocabularies the row's other CHECKs stand over. */
const CLASS = "column";
const KIND = "rcc.concrete";

/** Postgres' own states: a CHECK refusing a row, and a UNIQUE refusing a second one. */
const CHECK_VIOLATION = "23514";
const UNIQUE_VIOLATION = "23505";

type Stage = { bootstrapUrl: string; urlMigrate: string; urlApp: string; tenantScoped: string[] };

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
    return { bootstrapUrl, urlMigrate: provisioned.urlMigrate, urlApp: provisioned.urlApp, tenantScoped: await enumerateTenantScopedTables(bootstrapUrl) };
  })());

afterAll(async () => {
  await scratch?.drop();
});

/** Does the migrated database hold the table at all? */
async function tableStands(): Promise<boolean> {
  const { bootstrapUrl } = await staged();
  return (
    count(
      bootstrapUrl,
      `select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind in ('r', 'p') and c.relname = ${lit(SCOPE_DECLARATIONS)};`,
    ) > 0
  );
}

/** The definition of one named constraint, or "" where the store carries no such name. */
async function constraintNamed(name: string): Promise<string> {
  const { bootstrapUrl } = await staged();
  expect(await tableStands(), `public.${SCOPE_DECLARATIONS} stands in the migrated database — its constraints are what this case reads`).toBe(true);
  const rows = run(
    bootstrapUrl,
    `select pg_get_constraintdef(oid) from pg_constraint
      where conrelid = ${lit(`public.${SCOPE_DECLARATIONS}`)}::regclass and conname = ${lit(name)};`,
  );
  return rows[0]?.[0] ?? "";
}

/** One declaration row, as the app role writes one inside its own workspace. */
function insertion(o: { tenantId: string; projectId: string; campaignId: string; levelId: string; actId: string; cause: string }): string {
  return `insert into ${ident(SCOPE_DECLARATIONS)}
    (${ident(TENANT_COLUMN)}, project_id, campaign_id, class, kind, level_id, cause, act_id)
    values (${lit(o.tenantId)}::uuid, ${lit(o.projectId)}::uuid, ${lit(o.campaignId)}::uuid, ${lit(CLASS)}, ${lit(KIND)}, ${lit(o.levelId)}::uuid, ${lit(o.cause)}, ${lit(o.actId)}::uuid);`;
}

describe("AC-3: the declarations store is migrated, tenant-scoped and posture-bound", () => {
  it("AC-3: the product's own migration lane lands public.scope_declarations, and running it again converges", async () => {
    const { urlMigrate } = await staged();
    expect(await tableStands(), `the lane applied the migration that lands public.${SCOPE_DECLARATIONS} — the store a boundary act writes its row in`).toBe(true);

    const again = spawnSync(process.execPath, [join(REPO_ROOT, MIGRATE_SCRIPT)], {
      cwd: REPO_ROOT,
      env: { ...process.env, DATABASE_URL: urlMigrate },
      encoding: "utf8",
      timeout: 120_000,
    });
    expect(
      again.status,
      `a second run of the migration lane converges on the same database — an unjournaled or rewritten migration re-runs and collides:\n${`${again.stdout ?? ""}${again.stderr ?? ""}`.slice(-1200)}`,
    ).toBe(0);
    expect(await tableStands(), "and the table it landed is still there").toBe(true);
  });

  it("AC-3: it carries tenant_id and stands in the enumeration the seam suite is driven from", async () => {
    const { tenantScoped } = await staged();
    expect(
      tenantScoped,
      `public.${SCOPE_DECLARATIONS} carries ${TENANT_COLUMN}, so every per-table proof seam-tenant.live.test.ts makes over this enumeration binds it too (R-SPINE-004, B-19)`,
    ).toContain(`public.${SCOPE_DECLARATIONS}`);
  });

  it("AC-3: row-level security is enabled AND forced, with a policy that reads the tenant GUC", async () => {
    const { bootstrapUrl } = await staged();
    const row = run(
      bootstrapUrl,
      `select c.relrowsecurity, c.relforcerowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relname = ${lit(SCOPE_DECLARATIONS)};`,
    )[0];
    expect(isTrue(row?.[0] ?? ""), `public.${SCOPE_DECLARATIONS} has row-level security ENABLED`).toBe(true);
    expect(isTrue(row?.[1] ?? ""), `public.${SCOPE_DECLARATIONS} has row-level security FORCED — an owner is not exempt from a workspace boundary (SEAM-TENANT)`).toBe(true);
    const policies = count(
      bootstrapUrl,
      `select count(*) from pg_policies where schemaname = 'public' and tablename = ${lit(SCOPE_DECLARATIONS)}
        and (coalesce(qual, '') like ${lit(`%${GUC_TENANT}%`)} or coalesce(with_check, '') like ${lit(`%${GUC_TENANT}%`)});`,
    );
    expect(policies, `public.${SCOPE_DECLARATIONS} carries at least one policy that reads ${GUC_TENANT} — the boundary is the store's, not a caller's WHERE`).toBeGreaterThan(0);
  });

  it("AC-3: the two named constraints stand, over the cell and over the cause", async () => {
    const unique = await constraintNamed(ONE_PER_CELL);
    expect(unique, `public.${SCOPE_DECLARATIONS} carries ${ONE_PER_CELL} — one declaration per cell per cause is a property of the store`).not.toBe("");
    for (const column of [TENANT_COLUMN, "campaign_id", "class", "kind", "level_id", "cause"]) {
      expect(unique, `${ONE_PER_CELL} is unique over the whole cell address, ${column} included: ${unique}`).toContain(column);
    }
    const check = await constraintNamed(CAUSE_CLOSED);
    expect(check, `public.${SCOPE_DECLARATIONS} carries ${CAUSE_CLOSED} — the cause is a closed set, not a free string`).not.toBe("");
    for (const cause of [NOT_IN_THIS_BILL, NOT_IN_PROJECT_SCOPE]) {
      expect(check, `${CAUSE_CLOSED} admits ${cause}, one of the two causes a person may declare: ${check}`).toContain(cause);
    }
  });

  it("AC-3: the store itself refuses a row under any other cause", async () => {
    const { urlApp } = await staged();
    expect(await tableStands(), `public.${SCOPE_DECLARATIONS} stands in the migrated database — the rows this case writes stand in it`).toBe(true);
    const cell = { tenantId: randomUUID(), projectId: randomUUID(), campaignId: randomUUID(), levelId: randomUUID(), actId: randomUUID() };
    const asTenant = (script: string): ReturnType<typeof psql> => psql(urlApp, withSession({ [GUC_TENANT]: cell.tenantId }, script));

    const lawful = asTenant(insertion({ ...cell, cause: NOT_IN_THIS_BILL }));
    expect(
      lawful.ok,
      `${ROLE_APP} writes a declaration under ${NOT_IN_THIS_BILL} inside its own workspace — a probe that cannot stand a LAWFUL row proves nothing about the unlawful one:\n${lawful.stderr.slice(-800)}`,
    ).toBe(true);

    const refused = asTenant(insertion({ ...cell, cause: NOT_A_CAUSE }));
    expect(refused.ok, `public.${SCOPE_DECLARATIONS} accepted ${NOT_A_CAUSE} as a cause — a cause a person never declared would print on a certificate as though they had`).toBe(false);
    expect(refused.sqlstate, `and the refusal is the CHECK's own: ${refused.stderr.slice(-400)}`).toBe(CHECK_VIOLATION);
    expect(refused.stderr, `naming ${CAUSE_CLOSED}, the constraint that fired`).toContain(CAUSE_CLOSED);

    const twice = asTenant(insertion({ ...cell, cause: NOT_IN_THIS_BILL }));
    expect(twice.ok, `and a second declaration of the same cause over the same cell is refused too — ${ONE_PER_CELL} is the store's, not a caller's memory`).toBe(false);
    expect(twice.sqlstate, `by the unique constraint: ${twice.stderr.slice(-400)}`).toBe(UNIQUE_VIOLATION);
  });
});
