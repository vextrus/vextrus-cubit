/**
 * The seam as its callers see it (SEAM-TENANT): `forTenant(ctx)`, `runAsSystem(reason)`,
 * `closeDb()`, and handles that take `.execute(sql``)` and `.transaction()`.
 *
 * The module is typed here by what the clause names it exports rather than by drizzle's
 * inferred generics: the acceptance is about behaviour, and a test welded to the inferred
 * type of a query builder goes red on a refactor that changed nothing a caller can see.
 */
import { sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';

export { sql };

/** What `.execute()` answers with — node-postgres' result, which is what drizzle returns. */
export interface Executed {
  readonly rows: readonly Record<string, unknown>[];
  readonly rowCount: number | null;
}

export interface ScopedHandle {
  execute: (statement: SQL) => Promise<unknown>;
  transaction: <T>(work: (tx: ScopedHandle) => Promise<T>) => Promise<T>;
}

export interface Seam {
  forTenant: (ctx: { tenantId: string }) => ScopedHandle;
  runAsSystem: (reason: string) => ScopedHandle;
  closeDb: () => Promise<void>;
}

/** SEAM-TENANT: the one module that is allowed to hold a driver. */
export async function loadSeam(): Promise<Seam> {
  const seam = await import('../../../src/core/db');
  return seam as unknown as Seam;
}

/**
 * A handle, whatever shape of promise the seam hands it back in. SEAM-TENANT annotates
 * only `closeDb()` as async, so `forTenant` and `runAsSystem` are read as returning the
 * handle itself — awaiting one costs nothing and keeps the acceptance about behaviour.
 */
export async function ready(value: ScopedHandle): Promise<ScopedHandle> {
  return await Promise.resolve(value);
}

export async function exec(handle: ScopedHandle, statement: SQL): Promise<Executed> {
  const result = await handle.execute(statement);
  return result as unknown as Executed;
}

export async function rowsOf(handle: ScopedHandle, statement: SQL): Promise<Record<string, unknown>[]> {
  const result = await exec(handle, statement);
  return [...result.rows];
}

/** One scalar, read through the seam. */
export async function scalar(handle: ScopedHandle, statement: SQL): Promise<unknown> {
  const rows = await rowsOf(handle, statement);
  const first = rows[0];
  if (first === undefined) return undefined;
  return Object.values(first)[0];
}

/**
 * A tenant, inserted under system scope — the spec's own rule: "tenants rows are inserted
 * only under system scope".
 */
export async function createTenant(system: ScopedHandle, slug: string): Promise<string> {
  const rows = await rowsOf(
    system,
    sql`insert into tenants (slug, name) values (${slug}, ${slug}) returning id`,
  );
  const id = rows[0]?.['id'];
  if (typeof id !== 'string') {
    throw new Error(`runAsSystem could not insert a tenant: ${JSON.stringify(rows)}`);
  }
  return id;
}
