/**
 * The rest of what V-DB names, proven against the same live database: "append-only grants,
 * act-seam transactionality … migration ledger".
 *
 * The suite beside this one proves the scope — what a handle reads and what row-level
 * security refuses to let it write. This file proves the two guarantees underneath it:
 *
 *   1. A transaction is all or nothing. The pitfall it exists to close is a pool that hands
 *      each statement of a transaction a different connection: the first write commits, the
 *      rest are dropped, and nothing raises. A rollback that leaves the first write behind
 *      is the same bug wearing the opposite face, so it is a failed transaction that is
 *      asserted here rather than a successful one.
 *   2. The grants are append-only. SEAM-TENANT names them beside RLS because they answer a
 *      different question: RLS says which rows a tenant may touch, and the grants say that
 *      touching one means inserting, never rewriting or erasing (B-05 — a database
 *      privilege, not a convention). The migration ledger goes further and refuses its own
 *      owner, because a ledger only its owner can rewrite is a ledger.
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  APP_ROLE,
  AUTH_ROLE,
  MIGRATE_ROLE,
  attempt,
  connectAs,
  endAll,
  isPrivilegeRefusal,
  outcomeText,
  query,
} from './support/live';
import type { Client } from 'pg';
import { createTenant, exec, loadSeam, ready, scalar, sql } from './support/seam';
import type { ScopedHandle, Seam } from './support/seam';
import { seamSmoke, tenants } from '../schema/index';
import { forTenant, runAsSystem } from '../../src/core/db';

const RUN = randomUUID().slice(0, 8);
const KEPT = `rollback-kept-${RUN}`;
const LOST = `rollback-lost-${RUN}`;

let seam: Seam;
let system: ScopedHandle;
let tenantA = '';
let owner: Client | undefined;
let app: Client | undefined;

/** How many `seam_smoke` rows carry this note, read with the system's whole view. */
async function noted(note: string): Promise<number> {
  return Number(await scalar(system, sql`select count(*)::int from seam_smoke where note = ${note}`));
}

beforeAll(async () => {
  seam = await loadSeam();
  system = await ready(seam.runAsSystem('seed'));
  tenantA = await createTenant(system, `rollback-a-${RUN}`);
  owner = await connectAs(MIGRATE_ROLE);
  app = await connectAs(APP_ROLE);
});

afterAll(async () => {
  await endAll([owner, app]);
  if (typeof seam?.closeDb === 'function') await seam.closeDb().catch(() => undefined);
});

describe('V-DB — transactionality and append-only grants (SEAM-TENANT)', () => {
  it('V-DB: a transaction that throws commits none of its writes', async () => {
    const outcome = await attempt(() =>
      system.transaction(async (tx: ScopedHandle) => {
        await exec(tx, sql`insert into seam_smoke (tenant_id, note) values (${tenantA}, ${KEPT})`);
        await exec(tx, sql`insert into seam_smoke (tenant_id, note) values (${tenantA}, ${LOST})`);
        throw new Error('the caller changed its mind');
      }),
    );
    expect(outcome.ok, 'the transaction swallowed the error it was given').toBe(false);
    expect(await noted(KEPT), 'the first write of a rolled-back transaction was committed').toBe(0);
    expect(await noted(LOST)).toBe(0);
  });

  it('V-DB: a transaction whose second write is refused keeps neither', async () => {
    const stranger = randomUUID();
    const outcome = await attempt(() =>
      system.transaction(async (tx: ScopedHandle) => {
        await exec(tx, sql`insert into seam_smoke (tenant_id, note) values (${tenantA}, ${KEPT})`);
        // No such tenant: the composite tenant FK refuses it, inside the transaction.
        await exec(tx, sql`insert into seam_smoke (tenant_id, note) values (${stranger}, ${LOST})`);
      }),
    );
    expect(outcome.ok, 'a row referencing no tenant was accepted').toBe(false);
    expect(await noted(KEPT), 'the write before the refused one survived the rollback').toBe(0);
  });

  it('V-DB: a transaction that returns commits every write in it', async () => {
    const both = `rollback-both-${RUN}`;
    await system.transaction(async (tx: ScopedHandle) => {
      await exec(tx, sql`insert into seam_smoke (tenant_id, note) values (${tenantA}, ${both})`);
      await exec(tx, sql`insert into seam_smoke (tenant_id, note) values (${tenantA}, ${both})`);
    });
    expect(await noted(both), 'a committed transaction did not keep both of its writes').toBe(2);
  });

  it('V-DB / SEAM-TENANT: the app role never deletes, and never reaches another tenant', async () => {
    const scoped = await ready(seam.forTenant({ tenantId: tenantA }));

    // SEAM-TENANT / AC-6: on a table that carries a tenant, the app role may rewrite its
    // own rows — a cross-tenant UPDATE is refused by RLS finding no such row, not by a
    // withheld privilege. The statement runs, reports zero rows affected, and the other
    // tenant's row is still there when the system's whole view reads it. (The tables the
    // seam only ever appends to keep the tighter grant below.)
    const tenantB = await createTenant(system, `rollback-b-${RUN}`);
    const theirs = `rollback-theirs-${RUN}`;
    await exec(system, sql`insert into seam_smoke (tenant_id, note) values (${tenantB}, ${theirs})`);
    const across = await exec(
      scoped,
      sql`update seam_smoke set note = ${'rewritten'} where tenant_id = ${tenantB}`,
    );
    expect(across.rowCount, `forTenant(A) rewrote another tenant's seam_smoke row`).toBe(0);
    expect(await noted(theirs), `the other tenant's row did not survive the refused UPDATE`).toBe(1);

    // Tenants are founded under system scope, so the app role holds no UPDATE on them.
    // A column the table really has: Postgres resolves names before it checks privileges,
    // so an UPDATE of a column that does not exist would be refused for the wrong reason.
    const rewritten = await attempt(() =>
      exec(scoped, sql`update tenants set name = ${'rewritten'} where true`),
    );
    expect(rewritten.ok, 'public.tenants accepted an UPDATE from the app role').toBe(false);
    expect(
      isPrivilegeRefusal(rewritten.ok ? undefined : rewritten.error),
      `the UPDATE on public.tenants failed, but not by an insufficient privilege: ${outcomeText(rewritten)}`,
    ).toBe(true);

    for (const table of ['seam_smoke', 'tenants']) {
      const deleted = await attempt(() =>
        exec(scoped, sql`delete from ${sql.identifier(table)} where true`),
      );
      expect(deleted.ok, `public.${table} accepted a DELETE from the app role`).toBe(false);
      expect(
        isPrivilegeRefusal(deleted.ok ? undefined : deleted.error),
        `the DELETE on public.${table} failed, but not by an insufficient privilege: ${outcomeText(deleted)}`,
      ).toBe(true);
    }
  });

  it('V-DB: cubit_ops.migration_ledger refuses to be rewritten, even by its owner', async () => {
    const client = owner;
    if (client === undefined) throw new Error('no connection');
    for (const statement of [
      `update cubit_ops.migration_ledger set checksum = 'rewritten'`,
      'delete from cubit_ops.migration_ledger',
      'truncate cubit_ops.migration_ledger',
    ]) {
      const outcome = await attempt(() => query(client, statement));
      expect(outcome.ok, `the ledger accepted: ${statement}`).toBe(false);
      expect(
        isPrivilegeRefusal(outcome.ok ? undefined : outcome.error),
        `the ledger refused ${statement}, but not as a privilege refusal: ${outcomeText(outcome)}`,
      ).toBe(true);
      expect(outcomeText(outcome)).toContain('append-only');
    }
  });

  it('V-DB: the app role reads the ledger and cannot add to it', async () => {
    const client = app;
    if (client === undefined) throw new Error('no connection');
    const rows = await query(client, 'select filename from cubit_ops.migration_ledger');
    expect(rows.length, 'the app role cannot read the ledger at all').toBeGreaterThan(0);

    const outcome = await attempt(() =>
      query(client, `insert into cubit_ops.migration_ledger (filename, checksum) values ('x', 'y')`),
    );
    expect(outcome.ok, 'the app role wrote a row into the migration ledger').toBe(false);
    expect(isPrivilegeRefusal(outcome.ok ? undefined : outcome.error), outcomeText(outcome)).toBe(
      true,
    );
  });

  it('SEAM-TENANT: cubit_auth exists, logs in, and is granted nothing on the core tables', async () => {
    const client = owner;
    if (client === undefined) throw new Error('no connection');
    const auth = await connectAs(AUTH_ROLE);
    try {
      expect(await query(auth, 'select current_user')).toEqual([{ current_user: AUTH_ROLE }]);
      for (const table of ['tenants', 'seam_smoke']) {
        for (const privilege of ['select', 'insert', 'update', 'delete']) {
          const [granted] = await query(
            client,
            `select has_table_privilege($1, $2, $3) as granted`,
            [AUTH_ROLE, `public.${table}`, privilege],
          );
          expect(granted?.['granted'], `${AUTH_ROLE} holds ${privilege} on public.${table}`).toBe(
            false,
          );
        }
      }
    } finally {
      await endAll([auth]);
    }
  });

  it('SEAM-TENANT: a handle is a drizzle instance over the composed schema', async () => {
    // The clause says the handles are drizzle instances over db/schema, not a thin wrapper
    // around `sql`: a caller writes `select().from(seamSmoke)` and gets its own tenant's
    // rows. That path maps rows itself, in the driver's array mode, so it is asserted
    // rather than assumed — and the statically imported seam is the same module the rest
    // of this suite loads dynamically, or closing one would leave the other's pool open.
    expect(forTenant).toBe(seam.forTenant);
    const slug = `builder-${RUN}`;
    const [created] = await runAsSystem('seed').insert(tenants).values({ slug, name: slug }).returning();
    const tenantId = created?.id ?? '';
    expect(tenantId).not.toBe('');

    const note = `builder-note-${RUN}`;
    await runAsSystem('seed').transaction(async (tx) => {
      await tx.insert(seamSmoke).values({ tenantId, note });
    });

    const scoped = forTenant({ tenantId });
    expect((await scoped.select().from(seamSmoke)).map((row) => row.note)).toEqual([note]);
    expect((await scoped.select().from(tenants)).map((row) => row.slug)).toEqual([slug]);
  });

  it('SEAM-TENANT: runAsSystem refuses a reason that says nothing', () => {
    for (const blank of ['', '   ', '\t\n']) {
      expect(() => seam.runAsSystem(blank), `runAsSystem(${JSON.stringify(blank)}) was allowed`).toThrow(
        /SYSTEM_REASON_REQUIRED/,
      );
    }
    expect(typeof seam.runAsSystem('a stated reason').execute).toBe('function');
  });
});
