import { describe, it, expect, beforeAll, afterAll } from 'vitest';
// eslint-disable-next-line cubit/db-seam-only -- V-DB proves RLS refusal, which needs a bare cubit_app connection
import { Client } from 'pg';
// eslint-disable-next-line cubit/db-seam-only -- the seam proof runs raw SQL *through* the seam handle
import { sql } from 'drizzle-orm';
import { forTenant, runAsSystem } from '../../src/core/db';

// V-DB / SEAM-TENANT / AC-09 — live Postgres seam tests against
// 127.0.0.1:5544 (C-07). Every table carrying tenant_id is auto-discovered:
// nothing is proven by a hand-written list that a later table can slip past.

const MIGRATE_URL = process.env.DATABASE_URL_MIGRATE;
const APP_URL = process.env.DATABASE_URL_APP;

function requireUrl(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `${name} is not set — pnpm test:db must create and migrate the scratch DB cubit_dbtest ` +
        'on 127.0.0.1:5544 and export the three role URLs',
    );
  }
  return value;
}

async function connect(url: string): Promise<Client> {
  const client = new Client({ connectionString: url });
  await client.connect();
  return client;
}

function rowsOf(result: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(result)) return result as Array<Record<string, unknown>>;
  const rows = (result as { rows?: unknown }).rows;
  return Array.isArray(rows) ? (rows as Array<Record<string, unknown>>) : [];
}

const migrate = await connect(requireUrl('DATABASE_URL_MIGRATE', MIGRATE_URL));

// --- auto-discovery -------------------------------------------------------
const discovered = (
  await migrate.query<{ table_name: string }>(
    `select c.table_name
       from information_schema.columns c
       join information_schema.tables t
         on t.table_schema = c.table_schema and t.table_name = c.table_name
      where c.table_schema = 'public'
        and c.column_name = 'tenant_id'
        and t.table_type = 'BASE TABLE'
      order by c.table_name`,
  )
).rows.map((r) => r.table_name);

const rowCounts = new Map<string, number>();
for (const table of discovered) {
  const { rows } = await migrate.query<{ n: string }>(
    `select count(*)::text as n from public."${table}"`,
  );
  rowCounts.set(table, Number(rows[0]?.n ?? '0'));
}

const tenantIds = new Set<string>();
for (const table of discovered) {
  const { rows } = await migrate.query<{ tenant_id: string }>(
    `select distinct tenant_id::text as tenant_id from public."${table}" where tenant_id is not null`,
  );
  for (const r of rows) tenantIds.add(r.tenant_id);
}

afterAll(async () => {
  await migrate.end();
});

describe('AC-09 discovery is real (V-DB)', () => {
  it('AC-09: the tenant-scoped table set is non-empty and covers the spine', () => {
    expect(
      discovered.length,
      'no table carries tenant_id — the discovery harness would pass vacuously',
    ).toBeGreaterThanOrEqual(2);
  });

  it('AC-09: the scratch DB carries data in at least one tenant-scoped table', () => {
    const populated = discovered.filter((t) => (rowCounts.get(t) ?? 0) > 0);
    expect(
      populated,
      'every tenant-scoped table is empty — RLS assertions would pass against nothing; ' +
        'pnpm test:db must seed at least two tenants with rows',
    ).not.toEqual([]);
  });

  it('AC-09: at least two distinct tenants exist, so isolation can be proven', () => {
    expect(
      tenantIds.size,
      'fewer than two tenants in the scratch DB — cross-tenant refusal cannot be proven',
    ).toBeGreaterThanOrEqual(2);
  });
});

describe('AC-09 every tenant-scoped table is locked down', () => {
  for (const table of discovered) {
    it(`AC-09: ${table} has row level security enabled and forced`, async () => {
      const { rows } = await migrate.query<{ relrowsecurity: boolean; relforcerowsecurity: boolean }>(
        `select relrowsecurity, relforcerowsecurity
           from pg_class where oid = ('public."' || $1 || '"')::regclass`,
        [table],
      );
      expect(rows[0]?.relrowsecurity, `${table}: RLS not enabled`).toBe(true);
      expect(
        rows[0]?.relforcerowsecurity,
        `${table}: RLS not forced — the owner would bypass its own policy`,
      ).toBe(true);
    });

    it(`AC-09: ${table} carries at least one policy`, async () => {
      const { rows } = await migrate.query<{ n: string }>(
        `select count(*)::text as n from pg_policies where schemaname='public' and tablename=$1`,
        [table],
      );
      expect(Number(rows[0]?.n ?? '0'), `${table}: no RLS policy`).toBeGreaterThan(0);
    });
  }
});

describe('AC-09 RLS refuses cubit_app without a tenant context', () => {
  let app: Client;

  beforeAll(async () => {
    app = await connect(requireUrl('DATABASE_URL_APP', APP_URL));
  });

  afterAll(async () => {
    await app?.end();
  });

  for (const table of discovered) {
    it(`AC-09: ${table} yields nothing to cubit_app with no tenant set`, async () => {
      const seenByOwner = rowCounts.get(table) ?? 0;
      const { rows } = await app.query<{ n: string }>(
        `select count(*)::text as n from public."${table}"`,
      );
      expect(
        Number(rows[0]?.n ?? '0'),
        `${table}: cubit_app read rows without a tenant context (owner sees ${seenByOwner})`,
      ).toBe(0);
    });
  }
});

describe('AC-09 the seam scopes reads and refuses cross-tenant writes (SEAM-TENANT)', () => {
  const populated = discovered.filter((t) => (rowCounts.get(t) ?? 0) > 0);

  for (const table of populated) {
    it(`AC-09: forTenant scopes reads of ${table} to one tenant`, async () => {
      const owned = await migrate.query<{ tenant_id: string; n: string }>(
        `select tenant_id::text as tenant_id, count(*)::text as n
           from public."${table}" group by tenant_id order by count(*) desc limit 1`,
      );
      const tenantId = owned.rows[0]?.tenant_id as string;
      const expected = Number(owned.rows[0]?.n ?? '0');

      const handle = await forTenant({ tenantId });
      const result = await handle.execute(sql.raw(`select tenant_id::text from public."${table}"`));
      const rows = rowsOf(result);

      expect(rows.length, `${table}: forTenant read the wrong row count`).toBe(expected);
      const foreign = rows.filter((r) => String(r.tenant_id) !== tenantId);
      expect(foreign, `${table}: forTenant leaked rows from another tenant`).toEqual([]);
    });

    it(`AC-09: ${table} refuses a cross-tenant write through the seam`, async () => {
      const owned = await migrate.query<{ tenant_id: string }>(
        `select tenant_id::text as tenant_id from public."${table}" limit 1`,
      );
      const tenantId = owned.rows[0]?.tenant_id as string;
      const other = [...tenantIds].find((id) => id !== tenantId) as string;

      const handle = await forTenant({ tenantId });
      let refused = false;
      let updated = -1;
      try {
        const result = await handle.execute(
          sql.raw(
            `update public."${table}" set tenant_id = '${other}' where tenant_id = '${tenantId}'`,
          ),
        );
        const count = (result as { rowCount?: number }).rowCount;
        updated = typeof count === 'number' ? count : rowsOf(result).length;
      } catch {
        refused = true;
      }
      expect(
        refused || updated === 0,
        `${table}: the seam let tenant ${tenantId} hand ${updated} rows to tenant ${other}`,
      ).toBe(true);
    });
  }
});

describe('AC-09 runAsSystem is the only way past the tenant scope', () => {
  it('AC-09: runAsSystem(reason) returns a usable handle', async () => {
    const handle = await runAsSystem('db seam test: ledger read');
    const result = await handle.execute(sql.raw('select 1 as ok'));
    expect(rowsOf(result).length).toBe(1);
  });
});
