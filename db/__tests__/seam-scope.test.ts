/**
 * AC-1 — the seam is the handle, and the handle carries the scope.
 *
 * SEAM-TENANT: "`forTenant(ctx)` / `runAsSystem(reason)` — the only database handles …
 * proven by live seam tests (scoped read …)". R-SPINE-004: "Every query runs through
 * SEAM-TENANT". This file proves the positive half: that a scoped handle reads its own
 * tenant's rows and nothing else, that the system handle can write the founding rows, that
 * a handle is transactional, and that closing the seam leaves no connection behind.
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTenant, exec, loadSeam, ready, rowsOf, scalar, sql } from './support/seam';
import type { ScopedHandle, Seam } from './support/seam';
import { databaseName } from './support/live';

const RUN = randomUUID().slice(0, 8);
const SLUG_A = `ac1-a-${RUN}`;
const SLUG_B = `ac1-b-${RUN}`;
const NOTE_A = `ac1-note-a-${RUN}`;
const NOTE_B = `ac1-note-b-${RUN}`;

let seam: Seam;
let system: ScopedHandle;
let tenantA = '';
let tenantB = '';
/** Whether the two founding writes were made inside one `.transaction()` call. */
let transactionRan = false;

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** An open database connection, as the process itself reports it. */
const openSockets = (): string[] => process.getActiveResourcesInfo().filter((r) => /tcp/i.test(r));

beforeAll(async () => {
  seam = await loadSeam();
  // AC-1: `runAsSystem('seed')` returns a working handle.
  system = await ready(seam.runAsSystem('seed'));
  tenantA = await createTenant(system, SLUG_A);
  tenantB = await createTenant(system, SLUG_B);
  // AC-1: "one `seam_smoke` row per tenant, and the handle supports `.transaction()`".
  // Both writes ride one transaction: a pool that hands each statement a different
  // connection commits the first and loses the second, and that is a lost row, not a bug
  // report.
  await system.transaction(async (tx: ScopedHandle) => {
    await exec(tx, sql`insert into seam_smoke (tenant_id, note) values (${tenantA}, ${NOTE_A})`);
    await exec(tx, sql`insert into seam_smoke (tenant_id, note) values (${tenantB}, ${NOTE_B})`);
  });
  transactionRan = true;
});

afterAll(async () => {
  // The close test may already have run; closing twice must not be how a suite ends.
  if (typeof seam?.closeDb === 'function') await seam.closeDb().catch(() => undefined);
});

describe('AC-1 — the seam hands out scoped handles (SEAM-TENANT)', () => {
  it('SEAM-TENANT: forTenant, runAsSystem and closeDb are what src/core/db.ts exports', () => {
    expect(typeof seam.forTenant, 'forTenant is not exported from src/core/db.ts').toBe('function');
    expect(typeof seam.runAsSystem, 'runAsSystem is not exported from src/core/db.ts').toBe(
      'function',
    );
    expect(typeof seam.closeDb, 'closeDb is not exported from src/core/db.ts').toBe('function');
  });

  it('AC-4 / C-07: the suite runs against the cold-provisioned test database', async () => {
    // `pnpm test:db` points DATABASE_URL at CUBIT_TEST_DB (default cubit_test) as cubit_app.
    const expected = process.env['CUBIT_TEST_DB'] ?? 'cubit_test';
    expect(databaseName()).toBe(expected);
    expect(await scalar(system, sql`select current_database()`)).toBe(expected);
    expect(await scalar(system, sql`select current_user`)).toBe('cubit_app');
  });

  it('AC-1: the founding writes rode one .transaction() and both landed', async () => {
    expect(transactionRan, 'the system handle has no working .transaction()').toBe(true);
    expect(typeof system.transaction).toBe('function');
    const notes = await rowsOf(
      system,
      sql`select note from seam_smoke where note in (${NOTE_A}, ${NOTE_B}) order by note`,
    );
    // The recorded pool pitfall: the first insert commits, the second is dropped.
    expect(notes.map((row) => row['note'])).toEqual([NOTE_A, NOTE_B]);
  });

  it('AC-1 / R-SPINE-004: forTenant(A) reads exactly A’s seam_smoke row, never B’s', async () => {
    const a = await ready(seam.forTenant({ tenantId: tenantA }));
    const notes = (await rowsOf(a, sql`select note from seam_smoke`)).map((row) => row['note']);
    expect(notes).toEqual([NOTE_A]);
    expect(notes).not.toContain(NOTE_B);
  });

  it('AC-1 / R-SPINE-004: forTenant(B) reads exactly B’s seam_smoke row, never A’s', async () => {
    const b = await ready(seam.forTenant({ tenantId: tenantB }));
    const notes = (await rowsOf(b, sql`select note from seam_smoke`)).map((row) => row['note']);
    expect(notes).toEqual([NOTE_B]);
    expect(notes).not.toContain(NOTE_A);
  });

  it('AC-1: forTenant reads exactly its own row from tenants, symmetrically', async () => {
    const a = await ready(seam.forTenant({ tenantId: tenantA }));
    const b = await ready(seam.forTenant({ tenantId: tenantB }));
    expect((await rowsOf(a, sql`select slug from tenants`)).map((row) => row['slug'])).toEqual([
      SLUG_A,
    ]);
    expect((await rowsOf(b, sql`select slug from tenants`)).map((row) => row['slug'])).toEqual([
      SLUG_B,
    ]);
  });

  it('AC-1: the rows both exist — the scope is a filter, not an empty table', async () => {
    const slugs = (
      await rowsOf(system, sql`select slug from tenants where slug in (${SLUG_A}, ${SLUG_B}) order by slug`)
    ).map((row) => row['slug']);
    expect(slugs).toEqual([SLUG_A, SLUG_B]);
  });

  // Last in the file on purpose: it closes the seam.
  it('AC-1: after closeDb() no database connection is left open', async () => {
    await exec(system, sql`select 1`);
    expect(openSockets().length, 'the seam holds no connection to close').toBeGreaterThan(0);

    await seam.closeDb();

    const deadline = Date.now() + 10_000;
    let remaining = openSockets();
    while (remaining.length > 0 && Date.now() < deadline) {
      await delay(100);
      remaining = openSockets();
    }
    expect(remaining, 'closeDb() returned but a socket is still open — the process cannot exit').toEqual(
      [],
    );
  });
});
