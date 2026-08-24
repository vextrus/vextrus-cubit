/**
 * SEAM-TENANT — `forTenant(ctx)` / `runAsSystem(reason)`: the only database handles.
 *
 * This is the one module in the tree that holds the driver and the schema (cubit/db-seam-only
 * reports both imports anywhere else). Everything above it takes a handle, and a handle
 * carries its scope into the database itself: `cubit.scope` and `cubit.tenant_id` are set on
 * the connection the statement runs on, and the row-level-security policies read them. The
 * policies fail closed — a connection nobody scoped sees nothing — so forgetting the seam is
 * an empty result set and a refused write, not a cross-tenant read.
 *
 * Two things make that real rather than hopeful (R-SPINE-004, V-DB):
 *
 *   1. A statement never travels without its scope. The scope is applied with `set_config`'s
 *      local form, which lives exactly as long as the surrounding transaction, so a
 *      connection handed back to the pool carries nothing of the tenant that borrowed it.
 *   2. `.transaction()` pins one connection. A pool that hands each statement of a
 *      transaction a different connection commits the first write and drops the rest — the
 *      scope would travel with none of them. `ScopedPool.connect()` is what drizzle takes
 *      hold of for a transaction, and every statement in that transaction runs on the one
 *      client it returns.
 */
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import type { NodePgClient, NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../db/schema';

/** C-07: PostgreSQL 16 native on 127.0.0.1:5544 in dev, reached as the app role. */
const DEFAULT_DATABASE_URL = 'postgres://cubit_app:cubit_app@127.0.0.1:5544/cubit_dev';

/** The refusal a caller reads when `runAsSystem` is given no reason to be unscoped. */
const SYSTEM_REASON_REQUIRED = 'SYSTEM_REASON_REQUIRED';

/** The refusal a caller reads when a tenant id could never be one. */
const TENANT_ID_INVALID = 'TENANT_ID_INVALID';

/**
 * The shape `cubit.tenant_id` is cast to inside every policy. A blank id is left alone: it
 * becomes NULL there and the policy fails closed on it, which is the designed behaviour. A
 * non-blank id that is not a uuid has no such landing — the cast raises `invalid input syntax
 * for type uuid` from inside the policy, which reads as a broken database rather than as the
 * caller's bug it is — so the seam refuses it here, before a connection is borrowed.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The two settings a policy reads. Spelled once, here, and nowhere else in the tree. */
const SCOPE_SETTING = 'cubit.scope';
const TENANT_SETTING = 'cubit.tenant_id';

/** What a handle is scoped to: one tenant's rows, or the system's whole view of them. */
interface Scope {
  readonly scope: 'tenant' | 'system';
  /** The tenant's id under tenant scope; empty under system scope, which scopes to nothing. */
  readonly tenantId: string;
}

/** A handle: a drizzle instance over the composed schema, already carrying its scope. */
export type ScopedDb = NodePgDatabase<typeof schema>;

/** `select 1`-shaped statements the driver takes as text, and the ones drizzle builds. */
type Statement = string | pg.QueryConfig;

/**
 * `begin`, however drizzle spells it. The scope is applied to a pinned connection as soon as
 * its transaction opens: `set_config(..., true)` is only local to a transaction, and outside
 * one it would be forgotten before the next statement arrived.
 */
const OPENS_TRANSACTION = /^\s*begin\b/i;

/**
 * The name `ScopedPool` answers to, written down where a bundler cannot rename it (see the
 * `Object.defineProperty` below the class).
 */
const SCOPED_POOL_NAME = 'ScopedPool';

function statementText(statement: Statement): string {
  return typeof statement === 'string' ? statement : statement.text;
}

/** The pool every handle borrows from — one per process, closed by `closeDb()`. */
let connections: pg.Pool | undefined;

function pool(): pg.Pool {
  if (connections === undefined) {
    const url = process.env['DATABASE_URL'];
    connections = new pg.Pool({
      connectionString: url === undefined || url.trim() === '' ? DEFAULT_DATABASE_URL : url,
    });
  }
  return connections;
}

function runStatement(
  client: pg.PoolClient,
  statement: Statement,
  values: readonly unknown[],
): Promise<pg.QueryResult> {
  if (typeof statement === 'string') return client.query(statement);
  return client.query(statement, [...values]);
}

/**
 * The scope, applied to the transaction the client is currently in. `set_config`'s third
 * argument is `is_local`: the setting is reverted when the transaction ends, whether it
 * commits or rolls back, so no connection ever carries a scope back into the pool.
 */
async function applyScope(client: pg.PoolClient, scope: Scope): Promise<void> {
  await client.query(`select set_config($1, $2, true), set_config($3, $4, true)`, [
    SCOPE_SETTING,
    scope.scope,
    TENANT_SETTING,
    scope.tenantId,
  ]);
}

/**
 * One connection, pinned for the length of a transaction, with the scope applied to it the
 * moment that transaction opens. drizzle takes one of these from `ScopedPool.connect()` and
 * runs `begin`, the caller's statements and `commit` through it — all on this client.
 */
class ScopedConnection {
  private applied = false;

  constructor(
    private readonly client: pg.PoolClient,
    private readonly scope: Scope,
  ) {}

  async query(statement: Statement, values: readonly unknown[] = []): Promise<pg.QueryResult> {
    const result = await runStatement(this.client, statement, values);
    if (!this.applied && OPENS_TRANSACTION.test(statementText(statement))) {
      await applyScope(this.client, this.scope);
      this.applied = true;
    }
    return result;
  }

  release(): void {
    this.client.release();
  }
}

/**
 * What a handle is built on. The name matters to more than the reader: drizzle decides
 * whether a client can be borrowed from for the length of a transaction by looking at its
 * constructor's name, and a transaction that cannot pin a connection is the dropped-write
 * pitfall this class exists to close.
 */
class ScopedPool {
  constructor(private readonly scope: Scope) {}

  /**
   * A single statement, in a transaction of its own so that the scope it runs under is
   * local to it. Three round trips instead of one buys a pool no scope can leak through.
   */
  async query(statement: Statement, values: readonly unknown[] = []): Promise<pg.QueryResult> {
    const client = await pool().connect();
    try {
      await client.query('begin');
      await applyScope(client, this.scope);
      const result = await runStatement(client, statement, values);
      await client.query('commit');
      return result;
    } catch (error: unknown) {
      await client.query('rollback').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async connect(): Promise<ScopedConnection> {
    return new ScopedConnection(await pool().connect(), this.scope);
  }
}

/**
 * The class's own name, pinned so a bundler cannot take it away.
 *
 * drizzle decides whether it may borrow one connection for the length of a transaction by
 * reading `Object.getPrototypeOf(client).constructor.name` and looking for `Pool` in it. A
 * production build renames the class — `ScopedPool` becomes `p` — so the check fails there and
 * only there: `begin`, the caller's statements and `commit` each take a connection of their
 * own, every statement commits by itself, and a savepoint one of them opened is gone by the
 * time the next tries to roll back to it. Development and the vitest lanes run unminified and
 * never see it, which is exactly what makes it worth naming here.
 *
 * The name is behaviour, not documentation, so it is written down as behaviour.
 */
Object.defineProperty(ScopedPool, 'name', { value: SCOPED_POOL_NAME });

/**
 * The handle drizzle hands back. The cast is the seam's one concession to the driver's
 * types: `ScopedPool` is a pool as far as every call drizzle makes on it is concerned —
 * `query` and `connect` — but it is not node-postgres' `Pool`, because it borrows from the
 * one pool this module owns rather than opening a second one per scope.
 */
function handle(scope: Scope): ScopedDb {
  return drizzle(new ScopedPool(scope) as unknown as NodePgClient, { schema });
}

/**
 * A handle scoped to one tenant. Every statement it runs is filtered — and every row it
 * writes is checked — by the `tenant_isolation` policy on every table that carries a tenant.
 */
export function forTenant(ctx: { tenantId: string }): ScopedDb {
  if (ctx.tenantId !== '' && !UUID.test(ctx.tenantId)) {
    throw new Error(
      `${TENANT_ID_INVALID}: forTenant({ tenantId }) takes a uuid, not ${JSON.stringify(ctx.tenantId)}.`,
    );
  }
  return handle({ scope: 'tenant', tenantId: ctx.tenantId });
}

/**
 * A handle that is not scoped to a tenant, for the work that genuinely is not: migrations'
 * data, seeding, and the founding rows of `tenants` itself. The reason is required because
 * an unscoped handle taken without one is indistinguishable from a forgotten scope.
 */
export function runAsSystem(reason: string): ScopedDb {
  if (reason.trim() === '') {
    throw new Error(
      `${SYSTEM_REASON_REQUIRED}: runAsSystem(reason) needs a reason for leaving tenant scope.`,
    );
  }
  return handle({ scope: 'system', tenantId: '' });
}

/** Close the pool. After this the process holds no connection and can exit. */
export async function closeDb(): Promise<void> {
  if (connections === undefined) return;
  const closing = connections;
  connections = undefined;
  await closing.end();
}
