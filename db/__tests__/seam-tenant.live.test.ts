// The live V-DB suite (R-SPINE-004, B-22): a self-provisioned, migrated scratch database, two live
// roles, and a denominator taken from information_schema rather than from a list somebody typed
// (B-19). Every table that carries tenant_id is proven here, so a table a later increment adds is
// covered the moment it lands.
//
// Raw SQL is spoken through psql, never a driver import — SEAM-TENANT bans those everywhere
// outside src/core/db.ts, and this suite is bound by that ban like the rest of the tree.
import { afterAll, describe, expect, it } from "vitest";
import { enumerateTenantScopedTables, provisionScratchDb } from "./harness";
import { GUC_SYSTEM_REASON, GUC_TENANT, ROLE_APP, ROLE_MIGRATE, SCRATCH_DB_PREFIX, TENANTS_TABLE, TENANT_ALPHA, TENANT_BETA, TENANT_COLUMN } from "./support/fixtures";
import { count, deriveTenantScopedTables, ensureRowsForTenants, ident, isTrue, lit, ownedRowCount, qualified, run, seedTenants, visibleTenantIds, type TableRef } from "./support/live-sql";
import { loadSeam, seamRead, seamScalar, tenantDb, typedRead, type Seam } from "./support/seam";

type Scratch = { urlMigrate: string; urlApp: string; drop(): Promise<void> };

let scratch: Scratch;
let tables: TableRef[] = [];
let enumerated: string[] = [];
let tenantIds: Record<string, string> = {};
let seam: Seam;

/** A table name as both sides may spell it: the default schema is not part of a table's identity. */
const bare = (name: string): string => (name.startsWith("public.") ? name.slice("public.".length) : name);

/** The tenant the scenario reads as, and the one it must never see. */
const alpha = (): string => tenantIds[TENANT_ALPHA] ?? "";
const beta = (): string => tenantIds[TENANT_BETA] ?? "";

/**
 * Staging is lazy and memoised rather than a beforeAll hook: a hook that throws leaves every test
 * in the file skipped, and a criterion nothing ran against is a criterion nothing judged.
 */
let staging: Promise<void> | undefined;
const staged = (): Promise<void> =>
  (staging ??= (async () => {
    scratch = await provisionScratchDb();
    tables = deriveTenantScopedTables(scratch.urlMigrate);
    if (tables.length === 0) {
      throw new Error(`the migrated database has no base table carrying ${TENANT_COLUMN} — db/migrations/*tenancy-base*.sql has not put one there`);
    }
    tenantIds = seedTenants(scratch.urlMigrate);
    ensureRowsForTenants(scratch.urlMigrate, tables, [alpha(), beta()]);
    enumerated = (await enumerateTenantScopedTables(scratch.urlMigrate)).map(bare).sort();
    seam = await loadSeam(scratch.urlApp);
  })());

afterAll(async () => {
  await scratch?.drop();
});

describe("AC-2: the committed migrations reach a fresh database", () => {
  it("AC-2: every committed migration is applied to the scratch database", async () => {
    await staged();
    const ledger = run(
      scratch.urlMigrate,
      `select n.nspname, c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace where c.relname = '__drizzle_migrations' and c.relkind = 'r';`,
    );
    const row = ledger[0];
    expect(row, "the migrated database holds no drizzle migration ledger — pnpm db:migrate must apply the committed set").toBeDefined();
    const applied = count(scratch.urlMigrate, `select count(*) from ${ident(row?.[0] ?? "")}.${ident(row?.[1] ?? "")};`);
    expect(applied, "the ledger records no applied migration").toBeGreaterThan(0);
  });

  it(`AC-2: ${TENANTS_TABLE} has the columns the schema declares`, async () => {
    await staged();
    const rows = run(
      scratch.urlMigrate,
      `select column_name, data_type, is_nullable, coalesce(column_default, '') from information_schema.columns where table_name = ${lit(TENANTS_TABLE)} order by ordinal_position;`,
    );
    const shape = new Map(rows.map((row) => [row[0] ?? "", { type: row[1] ?? "", nullable: row[2] ?? "", fallback: row[3] ?? "" }]));

    const tenantId = shape.get(TENANT_COLUMN);
    expect(tenantId, `${TENANTS_TABLE}.${TENANT_COLUMN} is owed`).toBeDefined();
    expect(tenantId?.type, `${TENANTS_TABLE}.${TENANT_COLUMN} is a uuid`).toBe("uuid");
    expect(tenantId?.nullable).toBe("NO");
    expect(tenantId?.fallback, `${TENANTS_TABLE}.${TENANT_COLUMN} defaults to gen_random_uuid()`).toMatch(/gen_random_uuid\(\)/);

    const name = shape.get("name");
    expect(name?.type, `${TENANTS_TABLE}.name is text`).toBe("text");
    expect(name?.nullable, `${TENANTS_TABLE}.name is not null`).toBe("NO");

    const createdAt = shape.get("created_at");
    expect(createdAt?.type, `${TENANTS_TABLE}.created_at is timestamptz`).toBe("timestamp with time zone");
    expect(createdAt?.nullable, `${TENANTS_TABLE}.created_at is not null`).toBe("NO");
    expect(createdAt?.fallback, `${TENANTS_TABLE}.created_at defaults to now()`).toMatch(/now\(\)/);

    const primaryKey = run(
      scratch.urlMigrate,
      `select a.attname from pg_index i join pg_class c on c.oid = i.indrelid join pg_attribute a on a.attrelid = c.oid and a.attnum = any(i.indkey) where c.relname = ${lit(TENANTS_TABLE)} and i.indisprimary order by 1;`,
    ).map((row) => row[0] ?? "");
    expect(primaryKey, `${TENANTS_TABLE}'s primary key is ${TENANT_COLUMN}`).toEqual([TENANT_COLUMN]);
  });
});

describe("AC-3: the denominator is derived, never transcribed (B-19)", () => {
  it("AC-3: enumerateTenantScopedTables answers with every base table carrying tenant_id", async () => {
    await staged();
    expect(enumerated.length, `no base table carries ${TENANT_COLUMN} in the migrated database — the live suite would prove nothing`).toBeGreaterThan(0);
    expect(enumerated, "the harness's enumeration must be exactly what information_schema says carries tenant_id — no more, no fewer").toEqual(tables.map(qualified).map(bare).sort());
    // Not a frozen roster: `tenants` is here because it carries tenant_id, and this is the anchor
    // that keeps the derivation above from agreeing on an empty set.
    expect(enumerated, `${TENANTS_TABLE} carries ${TENANT_COLUMN}, so the derivation must contain it`).toContain(TENANTS_TABLE);
  });

  it("AC-3: every enumerated table has FORCED row-level security and a tenant policy", async () => {
    await staged();
    for (const table of tables) {
      const row = run(
        scratch.urlMigrate,
        `select c.relrowsecurity, c.relforcerowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = ${lit(table.schema)} and c.relname = ${lit(table.table)};`,
      )[0];
      expect(isTrue(row?.[0] ?? ""), `${qualified(table)} carries ${TENANT_COLUMN} but has no row-level security`).toBe(true);
      expect(isTrue(row?.[1] ?? ""), `${qualified(table)} does not declare row level security WITH FORCE — its owner would escape its own policies`).toBe(true);

      const policies = count(
        scratch.urlMigrate,
        `select count(*) from pg_policies where schemaname = ${lit(table.schema)} and tablename = ${lit(table.table)} and (coalesce(qual, '') like ${lit(`%${GUC_TENANT}%`)} or coalesce(with_check, '') like ${lit(`%${GUC_TENANT}%`)});`,
      );
      expect(policies, `${qualified(table)} has no policy reading ${GUC_TENANT} — nothing scopes it to a tenant`).toBeGreaterThan(0);
    }
  });
});

describe("AC-4: scoped read and RLS refusal, live, per enumerated table", () => {
  it("AC-4: the scratch database is provisioned from DATABASE_URL with both live roles", async () => {
    await staged();
    expect(new URL(scratch.urlMigrate).pathname.slice(1), `the scratch database is named ${SCRATCH_DB_PREFIX}*`).toMatch(new RegExp(`^${SCRATCH_DB_PREFIX}`));
    expect(new URL(scratch.urlApp).pathname, "both handles address the same scratch database").toBe(new URL(scratch.urlMigrate).pathname);
    expect(decodeURIComponent(new URL(scratch.urlMigrate).username), "migrations are applied as the owner role").toBe(ROLE_MIGRATE);
    expect(decodeURIComponent(new URL(scratch.urlApp).username), "the runtime connects as the app role").toBe(ROLE_APP);
    for (const role of [ROLE_MIGRATE, ROLE_APP]) {
      expect(count(scratch.urlMigrate, `select count(*) from pg_roles where rolname = ${lit(role)};`), `the cluster has no role ${role}`).toBe(1);
    }
  });

  it("AC-4: under tenant-alpha's scope the app role sees exactly alpha's rows in every enumerated table", async () => {
    await staged();
    for (const table of tables) {
      const owned = ownedRowCount(scratch.urlMigrate, table, alpha());
      const foreign = ownedRowCount(scratch.urlMigrate, table, beta());
      expect(owned, `${qualified(table)} holds no row for ${TENANT_ALPHA} — a scoped read that saw nothing would prove nothing`).toBeGreaterThan(0);
      expect(foreign, `${qualified(table)} holds no row for ${TENANT_BETA} — "and none of beta's" would prove nothing`).toBeGreaterThan(0);

      const visible = visibleTenantIds(scratch.urlApp, table, { [GUC_TENANT]: alpha() });
      expect(visible.length, `${qualified(table)}: ${ROLE_APP} under ${TENANT_ALPHA}'s scope must see all ${owned} of its rows`).toBe(owned);
      expect([...new Set(visible)], `${qualified(table)}: a scoped read must return alpha's rows and nothing else`).toEqual([alpha()]);
      expect(visible, `${qualified(table)}: ${TENANT_BETA}'s rows leaked into ${TENANT_ALPHA}'s scope`).not.toContain(beta());
    }
  });

  it("AC-4: with no tenant scope and no system reason the app role sees nothing at all", async () => {
    await staged();
    for (const table of tables) {
      expect(ownedRowCount(scratch.urlMigrate, table, beta()), `${qualified(table)} must hold rows for the refusal to be about RLS`).toBeGreaterThan(0);
      const visible = count(scratch.urlApp, `select count(*) from ${table.sql};`);
      expect(visible, `${qualified(table)}: an unscoped session read ${visible} rows — RLS must refuse a session that names neither a tenant nor a system reason`).toBe(0);
    }
  });
});

describe("AC-1: the seam is the handle those guarantees are reached through", () => {
  it("AC-1: forTenant(ctx) puts the ctx's tenantId on the session of the queries it issues", async () => {
    await staged();
    for (const tenant of [TENANT_ALPHA, TENANT_BETA]) {
      const tenantId = tenantIds[tenant] ?? "";
      const observed = await seamScalar(tenantDb(seam, tenantId), `select current_setting(${lit(GUC_TENANT)}, true)`);
      expect(observed, `forTenant({ tenantId }) must run its queries with ${GUC_TENANT} set to ${tenant}'s id`).toBe(tenantId);
    }
  });

  it("AC-1: the seam connects as the app role, under no system reason of its own", async () => {
    await staged();
    const rows = await seamRead(tenantDb(seam, alpha()), `select current_user as who, coalesce(current_setting(${lit(GUC_SYSTEM_REASON)}, true), '') as reason`);
    expect(String(rows[0]?.["who"]), `a tenant-scoped handle connects as ${ROLE_APP}`).toBe(ROLE_APP);
    expect(String(rows[0]?.["reason"]), "a tenant-scoped handle must not arm system scope").toBe("");
  });

  it(`AC-1: a TenantDb reads ${TENANTS_TABLE} through drizzle's typed surface, scoped to its tenant`, async () => {
    await staged();
    for (const tenant of [TENANT_ALPHA, TENANT_BETA]) {
      const tenantId = tenantIds[tenant] ?? "";
      const rows = await typedRead(tenantDb(seam, tenantId), TENANTS_TABLE);
      expect(rows.length, `the typed read of ${TENANTS_TABLE} under ${tenant}'s scope came back empty`).toBeGreaterThan(0);
      const names = rows.map((row) => String(row["name"] ?? ""));
      expect(names, `${tenant}'s scope must see ${tenant} and no other tenant`).toEqual([tenant]);
    }
  });
});
