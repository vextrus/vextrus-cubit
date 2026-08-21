/**
 * AC-2 — RLS is live and enumerated (R-SPINE-004, Q-02, V-DB).
 *
 * R-SPINE-004: "the live seam test proves scoped read, RLS refusal and cross-tenant write
 * refusal on every table that carries tenant_id". Every table is not a list somebody keeps
 * up to date; it is what information_schema says today. A tenant-carrying table that this
 * suite has no probe for is a table nobody has proven anything about, so it turns the lane
 * red rather than passing in silence (Q-02: "V-DB green on every table").
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  APP_ROLE,
  MIGRATE_ROLE,
  attempt,
  connectAs,
  count,
  endAll,
  isRlsRefusal,
  outcomeText,
  query,
} from './support/live';
import type { Client } from 'pg';
import { createTenant, loadSeam, ready, scalar, sql } from './support/seam';
import type { ScopedHandle, Seam } from './support/seam';
import { probes } from './probes/index';
import type { TableProbe } from './probes/index';

const RUN = randomUUID().slice(0, 8);

/**
 * The registered probes, read from db/__tests__/probes/. A module-founding increment that
 * adds a tenant-carrying table registers it there, in the increment that founds it.
 */
let PROBES = new Map<string, TableProbe>();

let seam: Seam;
let system: ScopedHandle;
let owner: Client | undefined;
let unscoped: Client | undefined;
let tenantA = '';
let tenantB = '';
let discovered: string[] = [];

beforeAll(async () => {
  PROBES = await probes();
  seam = await loadSeam();
  system = await ready(seam.runAsSystem('seed'));
  tenantA = await createTenant(system, `ac2-a-${RUN}`);
  tenantB = await createTenant(system, `ac2-b-${RUN}`);

  // The owner reads the catalogue: a table this suite has no grant on is still a table
  // that carries tenant_id, and enumerating as cubit_app would hide exactly that case.
  owner = await connectAs(MIGRATE_ROLE);
  const rows = await query(
    owner,
    `select c.table_name
       from information_schema.columns c
       join information_schema.tables t
         on t.table_schema = c.table_schema and t.table_name = c.table_name
      where c.table_schema = 'public'
        and c.column_name = 'tenant_id'
        and t.table_type = 'BASE TABLE'
      order by c.table_name`,
  );
  // AC-2: "plus `tenants`, scoped by its own `id`".
  discovered = [...new Set([...rows.map((row) => String(row['table_name'])), 'tenants'])].sort();

  // A raw app connection: no cubit.scope, no cubit.tenant_id, nothing set on it at all.
  unscoped = await connectAs(APP_ROLE);

  for (const table of discovered) {
    const probe = PROBES.get(table);
    if (probe === undefined) continue;
    await probe.seed(system, tenantA);
    await probe.seed(system, tenantB);
  }
});

afterAll(async () => {
  await endAll([owner, unscoped]);
  if (typeof seam?.closeDb === 'function') await seam.closeDb().catch(() => undefined);
});

describe('AC-2 — every tenant-carrying table, enumerated (R-SPINE-004, Q-02)', () => {
  it('AC-2: the founding tables are discovered from information_schema', () => {
    expect(discovered, 'seam_smoke does not carry tenant_id in public').toContain('seam_smoke');
    expect(discovered).toContain('tenants');
  });

  it('AC-2 / Q-02: every discovered table has a registered probe — none passes untested', () => {
    const unregistered = discovered.filter((table) => !PROBES.has(table));
    expect(
      unregistered,
      `these tables carry tenant_id and this suite cannot exercise them: ${unregistered.join(', ')}. ` +
        'Register each one in db/__tests__/probes/<module>.ts in the increment that founds it ' +
        '(Q-02: V-DB green on every table).',
    ).toEqual([]);
    expect(PROBES.size, 'db/__tests__/probes registered nothing at all').toBeGreaterThan(0);
  });

  it('AC-2: RLS is enabled AND forced with a policy named tenant_isolation, per table', async () => {
    const client = owner;
    expect(client).toBeDefined();
    if (client === undefined) return;
    for (const table of discovered) {
      const [state] = await query(
        client,
        `select relrowsecurity as enabled, relforcerowsecurity as forced
           from pg_class where oid = ($1 || '.' || $2)::regclass`,
        ['public', table],
      );
      expect(state?.['enabled'], `RLS is not ENABLEd on public.${table}`).toBe(true);
      expect(state?.['forced'], `RLS is not FORCEd on public.${table}`).toBe(true);

      const policies = await query(
        client,
        `select policyname from pg_policies where schemaname = 'public' and tablename = $1`,
        [table],
      );
      expect(
        policies.map((row) => row['policyname']),
        `public.${table} has no policy named tenant_isolation`,
      ).toContain('tenant_isolation');
    }
  });

  it('AC-2: an unscoped cubit_app connection reads zero rows from every such table', async () => {
    const client = unscoped;
    expect(client).toBeDefined();
    if (client === undefined) return;
    // Fail closed on NULL: no cubit.scope and no cubit.tenant_id means no rows, not all rows.
    const scope = await query(client, `select current_setting('cubit.scope', true) as scope`);
    expect(scope[0]?.['scope'] ?? null).toBeFalsy();

    for (const table of discovered) {
      // Non-vacuous: the seeded rows are there, the policy is what hides them.
      const seen = await scalar(system, sql`select count(*)::int from public.${sql.identifier(table)}`);
      expect(Number(seen), `public.${table} is empty, so reading zero rows proves nothing`).toBeGreaterThan(0);
      expect(await count(client, table), `an unscoped cubit_app connection can read public.${table}`).toBe(0);
    }
  });

  it('AC-2: an INSERT through forTenant(A) carrying another tenant’s id is refused (42501)', async () => {
    const a = await ready(seam.forTenant({ tenantId: tenantA }));
    for (const table of discovered) {
      const probe = PROBES.get(table);
      if (probe === undefined) continue;
      const outcome = await attempt(() => probe.crossTenantInsert(a, tenantB));
      expect(
        outcome.ok,
        `forTenant(A) wrote a row belonging to B into public.${table} (${probe.scopeColumn} = B)`,
      ).toBe(false);
      if (outcome.ok) continue;
      expect(
        isRlsRefusal(outcome.error),
        `the cross-tenant INSERT into public.${table} failed, but not by row-level security: ${outcomeText(outcome)}`,
      ).toBe(true);
    }
  });

  it('AC-2: the refused writes left nothing behind', async () => {
    const stolen = await scalar(system, sql`select count(*)::int from seam_smoke where note = ${'stolen'}`);
    expect(Number(stolen)).toBe(0);
    const client = owner;
    if (client === undefined) return;
    const rows = await query(client, `select count(*)::int as n from public.tenants where name = 'stolen'`);
    expect(rows[0]?.['n'], 'public.tenants carries a row that a tenant scope wrote').toBe(0);
  });
});
