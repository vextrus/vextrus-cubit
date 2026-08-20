import { Pool, type PoolClient, type QueryArrayConfig, type QueryConfig, type QueryResult } from 'pg';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../db/schema/index';
import { databaseEnv } from './env';
import { refusal } from './errors';

/**
 * SEAM-TENANT — `forTenant(ctx)` and `runAsSystem(reason)` are the only database
 * handles in the product. Driver and schema imports are lint-banned outside this
 * file (cubit/db-seam-only); RLS and the tenant column are the backstop that
 * holds even when the lint rule is bypassed.
 *
 * Scope travels as a Postgres session setting on the checked-out connection:
 * `cubit.tenant_id` for a tenant handle, `cubit.system` plus `cubit.reason` for
 * the system handle. The policies in db/migrations read exactly those two
 * settings, so a connection that carries neither sees nothing at all.
 */

export interface TenantContext {
  readonly tenantId: string;
}

export type Handle = NodePgDatabase<typeof schema>;

interface Scope {
  readonly tenantId: string | null;
  readonly system: boolean;
  readonly reason: string | null;
}

const APPLY_SCOPE =
  'select set_config($1, $2, false), set_config($3, $4, false), set_config($5, $6, false)';

function scopeValues(scope: Scope): string[] {
  return [
    'cubit.tenant_id',
    scope.tenantId ?? '',
    'cubit.system',
    scope.system ? 'on' : 'off',
    'cubit.reason',
    scope.reason ?? '',
  ];
}

/**
 * A pool whose every checkout carries the seam's scope and gives it back clean.
 *
 * The name ends in `Pool` deliberately: drizzle decides whether a transaction
 * may take a connection of its own by looking at the constructor name, and the
 * seam wants it to — otherwise a transaction would silently spread across
 * connections that do not share the scope.
 */
class ScopedPool {
  readonly #pool: Pool;
  readonly #scope: Scope;

  constructor(pool: Pool, scope: Scope) {
    this.#pool = pool;
    this.#scope = scope;
  }

  /** Checks out a connection, sets the scope on it, and resets it on release. */
  async connect(): Promise<PoolClient> {
    const client = await this.#pool.connect();
    try {
      await client.query(APPLY_SCOPE, scopeValues(this.#scope));
    } catch (error) {
      client.release(true);
      throw error;
    }

    const handBack = client.release.bind(client);
    client.release = (destroy?: boolean | Error) => {
      if (destroy !== undefined && destroy !== false) {
        handBack(destroy);
        return;
      }
      // the scope must not ride back into the pool for the next caller
      void client.query('reset all').then(
        () => handBack(),
        () => handBack(true),
      );
    };
    return client;
  }

  /** A standalone statement: one scoped connection, released as soon as it answers. */
  async query(config: QueryConfig | QueryArrayConfig | string, values?: unknown[]): Promise<QueryResult> {
    const client = await this.connect();
    try {
      return await client.query(config as QueryConfig, values as unknown[]);
    } finally {
      client.release();
    }
  }
}

let appPool: Pool | undefined;
let authPool: Pool | undefined;

function pool(which: 'app' | 'auth'): Pool {
  if (which === 'auth') {
    authPool ??= new Pool({ connectionString: databaseEnv.DATABASE_URL_AUTH });
    return authPool;
  }
  appPool ??= new Pool({ connectionString: databaseEnv.DATABASE_URL_APP });
  return appPool;
}

function handleFor(scope: Scope): Handle {
  const scoped = new ScopedPool(pool('app'), scope);
  return drizzle(scoped as unknown as Pool, { schema });
}

/**
 * The tenant-scoped handle. Reads see one tenant's rows; a write that would hand
 * a row to another tenant is refused by the policy, not by a check in the caller.
 */
export async function forTenant(ctx: TenantContext): Promise<Handle> {
  return handleFor({ tenantId: ctx.tenantId, system: false, reason: null });
}

/**
 * The only way past the tenant scope, and it costs a sentence. Resolving a slug
 * from a URL and minting a tenant at sign-up both happen before any tenant is
 * known, so both come through here with their reason recorded on the connection.
 */
export async function runAsSystem(reason: string): Promise<Handle> {
  if (reason.trim().length === 0) throw refusal('SYSTEM_REASON_REQUIRED');
  return handleFor({ tenantId: null, system: true, reason });
}

/**
 * better-auth owns the identity tables, and they carry no `tenant_id`: an
 * account belongs to a person, not to a tenant. Its handle is minted here,
 * inside the seam, so no other file imports a driver.
 */
export function authDatabase(): Handle {
  return drizzle(pool('auth'), { schema });
}

/**
 * The seam is the tree's single door to the database, which means it is also the
 * single door to the schema and to drizzle's operators. Re-exporting them here
 * keeps `cubit/db-seam-only` a rule about *where* the door is rather than a rule
 * that pushes every query into this file.
 */
export { schema as tables };
export { sql, eq, and, desc } from 'drizzle-orm';
