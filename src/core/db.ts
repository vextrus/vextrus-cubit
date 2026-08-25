// SEAM-TENANT: forTenant(ctx) and runAsSystem(reason) are the only database handles the tree has.
// The driver, the schema and drizzle's typed read/write surface live here and nowhere else, and
// every query a handle issues runs on a connection its scope has been armed on — the row-level
// security the tenancy-base migration installs reads that scope and nothing else.
//
// The table definitions sit here rather than in db/schema/*.ts because the ORM's table builders are
// a driver import, and this file is their one lawful home; db/schema/*.ts is the tree drizzle-kit
// reads them back out of.
import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { attributableReason } from "./db/reason";

export { recordSystemReasonsWith, type SystemReasonRecord, type SystemReasonRecorder } from "./db/reason";

/** The session settings a scope is spoken through; the migration's policies read these two names. */
const TENANT_GUC = "cubit.tenant_id";
const SYSTEM_REASON_GUC = "cubit.system_reason";

/** Tenancy's base table: every tenant-scoped table in the tree carries this table's key. */
export const tenants = pgTable("tenants", {
  tenantId: uuid("tenant_id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Everything the typed surface covers. A table joins the surface by joining this object. */
const schema = { tenants };

/** A handle scoped to one tenant: the typed read/write surface, filtered by row-level security. */
export type TenantDb = PostgresJsDatabase<typeof schema>;

/** A handle running under an attributable system reason: the same surface, unfiltered by tenant. */
export type SystemDb = PostgresJsDatabase<typeof schema>;

/** How many connections one process holds, and how long an idle one is kept (in seconds). */
const POOL = { max: 10, idleTimeout: 20, connectTimeout: 10 } as const;

/**
 * One pool per database the seam is pointed at, built on first use — so importing the seam neither
 * reads nor needs a live server, and a process told to reach a different database reaches it rather
 * than answering out of a pool built for the last one.
 */
const pools = new Map<string, postgres.Sql>();

function connection(): postgres.Sql {
  const url = databaseUrl();
  const existing = pools.get(url);
  if (existing !== undefined) return existing;
  const sql = postgres(url, { max: POOL.max, idle_timeout: POOL.idleTimeout, connect_timeout: POOL.connectTimeout });
  pools.set(url, sql);
  return sql;
}

function databaseUrl(): string {
  const url = process.env["DATABASE_URL"]?.trim();
  if (url === undefined || url === "") {
    throw new Error("DATABASE_URL is not set — the seam has no database to reach (SEAM-TENANT)");
  }
  return url;
}

/**
 * A scope arms exactly one of the two settings and blanks the other. Both are written on every
 * connection the seam takes out, so a pooled connection can never carry one scope's arming into the
 * next one's query.
 */
type Scope = { readonly tenantId: string; readonly systemReason: string };

/** One round trip that arms this scope and disarms the other, on whichever connection is in hand. */
const ARM_SCOPE = `select set_config('${TENANT_GUC}', $1, false), set_config('${SYSTEM_REASON_GUC}', $2, false)`;

/** The parameter list shape the driver takes; the seam's own values are strings. */
type DriverParams = NonNullable<Parameters<postgres.Sql["unsafe"]>[1]>;

/** What drizzle's postgres-js driver asks a query for: the row objects, or the raw value tuples. */
type PendingRows = PromiseLike<unknown> & { readonly values: () => PromiseLike<unknown> };

/**
 * Take a connection, arm this scope on it, do the work, give it back. Reserving is what makes the
 * scope and the query inseparable: a session setting written on a pooled connection the query might
 * not land on would scope nothing.
 */
async function inScope<T>(sql: postgres.Sql, scope: Scope, work: (session: postgres.Sql) => Promise<T>): Promise<T> {
  const session = await sql.reserve();
  try {
    await session.unsafe(ARM_SCOPE, [scope.tenantId, scope.systemReason] as DriverParams);
    return await work(session);
  } finally {
    session.release();
  }
}

/** A query that has not run yet, and runs — once — in whichever shape drizzle asks it for. */
function scopedQuery(sql: postgres.Sql, scope: Scope, query: string, params: DriverParams): PendingRows {
  let started: Promise<unknown> | undefined;
  const start = (asValues: boolean): Promise<unknown> =>
    (started ??= inScope(sql, scope, async (session) => {
      const pending = session.unsafe(query, params);
      return asValues ? await pending.values() : await pending;
    }));
  return {
    values: () => ({ then: (onRows, onFailure) => start(true).then(onRows, onFailure) }),
    then: (onRows, onFailure) => start(false).then(onRows, onFailure),
  };
}

/**
 * The client drizzle is handed. Its driver reaches a client through `unsafe`, `begin` and `options`
 * alone, and each of the three answers here with the scope already armed — including inside a
 * transaction, where the whole transaction runs on the one connection it opened.
 */
function scopedClient(sql: postgres.Sql, scope: Scope): postgres.Sql {
  const client = {
    options: sql.options,
    unsafe: (query: string, params: DriverParams = []): PendingRows => scopedQuery(sql, scope, query, params),
    begin: (work: (tx: postgres.TransactionSql) => Promise<unknown>): Promise<unknown> =>
      sql.begin(async (tx) => {
        await tx.unsafe(ARM_SCOPE, [scope.tenantId, scope.systemReason] as DriverParams);
        return work(tx);
      }),
  };
  return client as unknown as postgres.Sql;
}

/**
 * The handle's methods live on drizzle's prototype, so one taken off the handle — `const { execute }
 * = forTenant(ctx)` — would arrive without the handle it belongs to. Every method is handed out
 * already bound, so no caller can hold half of a scoped handle.
 */
function boundSurface<T extends object>(db: T): T {
  return new Proxy(db, {
    get: (target, property) => {
      const member: unknown = Reflect.get(target, property);
      return typeof member === "function" ? member.bind(target) : member;
    },
  });
}

function handleFor(scope: Scope): PostgresJsDatabase<typeof schema> {
  return boundSurface(drizzle({ client: scopedClient(connection(), scope), schema }));
}

/** The tenant's handle: the only way a tenant's rows are read or written (SEAM-TENANT). */
export function forTenant(ctx: { tenantId: string }): TenantDb {
  return handleFor({ tenantId: ctx.tenantId, systemReason: "" });
}

/**
 * The system's handle, made only for work an attributable reason has been given for. The reason is
 * recorded as the handle is taken and carried on the session every query of it runs on, so what a
 * system-scoped statement did is answerable from the database's side too.
 */
export function runAsSystem(reason: string): SystemDb {
  return handleFor({ tenantId: "", systemReason: attributableReason(reason) });
}
