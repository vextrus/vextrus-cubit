// SEAM-TENANT: forTenant(ctx) and runAsSystem(reason) are the only database handles the tree has,
// and drizzle's typed read/write surface is handed out from here. Every query a handle issues runs
// on a connection its scope has been armed on — the row-level security the tenancy-base migration
// installs reads that scope and nothing else.
import { asc, eq, sql as statement, type AnyColumn, type SQL } from "drizzle-orm";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type postgres from "postgres";
import { minimalDecimal } from "../model-ledger.types";
import { advisoryXactLock } from "./advisory-lock";
import { connection } from "./pools";
import { attributableReason } from "./reason";
import { SEAM_SCHEMA, modelCalls } from "./schema";
import type { DriverParams } from "./sql";

/** The session settings a scope is spoken through; the migration's policies read these two names. */
const TENANT_GUC = "cubit.tenant_id";
const SYSTEM_REASON_GUC = "cubit.system_reason";
/**
 * A handle scoped to one tenant: the typed read/write surface, filtered by row-level security. The
 * handle carries the scope it was armed with, so a read that must name its tenant asks the handle
 * rather than the session — the seam set the setting, and reading it back would be a round trip
 * spent asking the database what this file already knows (SEAM-TENANT).
 */
export type TenantDb = PostgresJsDatabase<typeof SEAM_SCHEMA> & { readonly scope: Scope };

/**
 * The handle drizzle hands a transaction body — the same typed surface, on the one connection the
 * transaction opened. Named here so a caller can take a transaction's handle as a parameter without
 * naming the driver's own types (SEAM-TENANT).
 */
export type TenantTx = Parameters<Parameters<TenantDb["transaction"]>[0]>[0];

/**
 * Hold a transaction-scoped lock on a named piece of state, so that everything a transaction reads
 * about that state stays true until it commits. Rows a transaction has not read yet cannot be locked
 * with `FOR UPDATE` — a row a concurrent writer is about to insert is locked by nothing — so the
 * lock is taken on the name of the state rather than on the rows that happen to hold it now. It is
 * released when the transaction ends, whichever way it ends.
 */
export async function holdStateLock(tx: TenantTx, key: string): Promise<void> {
  await tx.execute(advisoryXactLock(key));
}
/** A handle running under an attributable system reason: the same surface, unfiltered by tenant. */
export type SystemDb = TenantDb;
/**
 * A scope arms exactly one of the two settings and blanks the other. Both are written on every
 * connection the seam takes out, so a pooled connection can never carry one scope's arming into the
 * next one's query.
 */
export type Scope = { readonly tenantId: string; readonly systemReason: string };

/** One round trip that arms this scope and disarms the other, on whichever connection is in hand. */
const ARM_SCOPE = `select set_config('${TENANT_GUC}', $1, false), set_config('${SYSTEM_REASON_GUC}', $2, false)`;

/** What drizzle's postgres-js driver asks a query for: the row objects, or the raw value tuples. */
type PendingRows = PromiseLike<unknown> & { readonly values: () => PromiseLike<unknown> };

/**
 * Arm this scope and do the work on one connection. The driver's own transaction is what makes the
 * scope and the query inseparable — a session setting written on a pooled connection the query might
 * not land on would scope nothing — and it costs no round trip of its own: the arming, the statement
 * and the commit are pipelined onto the connection the transaction already holds, where taking a
 * reserved connection out of the pool for every statement made the seam pay for one twice over.
 *
 * The work's answer is carried inside a wrapper because the driver executes an array a transaction
 * body returns; a result set is an array, and handing it back bare would run its rows as queries.
 */
async function inScope<T>(sql: postgres.Sql, scope: Scope, work: (session: postgres.TransactionSql) => Promise<T>): Promise<T> {
  const held = await sql.begin(async (tx) => {
    await tx.unsafe(ARM_SCOPE, [scope.tenantId, scope.systemReason] as DriverParams);
    return { answer: await work(tx) };
  });
  return (held as unknown as { answer: T }).answer;
}

/** One statement on one session, in whichever of the two shapes drizzle asked for it. */
async function issue(session: Pick<postgres.Sql, "unsafe">, query: string, params: DriverParams, asValues: boolean): Promise<unknown> {
  const pending = session.unsafe(query, params);
  return asValues ? await pending.values() : await pending;
}

/**
 * A query that has not run yet, and runs — once per shape — in whichever shape drizzle asks it for.
 * The memo is keyed by the shape rather than held as one slot: a slot answers the second reader with
 * the first reader's shape, so a pending query awaited for rows and then asked for value tuples would
 * hand back row objects that nothing can read positionally.
 */
function pendingRows(execute: (asValues: boolean) => Promise<unknown>): PendingRows {
  const started = new Map<boolean, Promise<unknown>>();
  const start = (asValues: boolean): Promise<unknown> => {
    const running = started.get(asValues) ?? execute(asValues);
    started.set(asValues, running);
    return running;
  };
  return {
    values: () => ({ then: (onRows, onFailure) => start(true).then(onRows, onFailure) }),
    then: (onRows, onFailure) => start(false).then(onRows, onFailure),
  };
}

/**
 * `SET TRANSACTION ISOLATION LEVEL ...`, which drizzle issues when the caller names an isolation
 * level, must come before every query of its transaction — and arming the scope is a query. So
 * inside a transaction the configuration statements go first and the arming waits for the first
 * statement that is not one.
 */
const CONFIGURES_TRANSACTION = /^\s*set\s+transaction\b/i;

/**
 * The client drizzle is handed inside a transaction: the same connection throughout, with the scope
 * armed on demand rather than as the opening statement, so the caller's isolation level is not
 * refused with 25001. The scope is still armed before anything reads or writes.
 */
function transactionClient(tx: postgres.TransactionSql, scope: Scope): postgres.TransactionSql {
  let arming: Promise<unknown> | undefined;
  const armedFor = (query: string): Promise<unknown> =>
    CONFIGURES_TRANSACTION.test(query) ? Promise.resolve() : (arming ??= tx.unsafe(ARM_SCOPE, [scope.tenantId, scope.systemReason] as DriverParams));

  // The wrapper states the options of the handle it wraps, so a driver reading them off this client
  // reads the transaction's own settings and never another handle's.
  const client = {
    options: (tx as unknown as { options?: postgres.Sql["options"] }).options,
    unsafe: (query: string, params: DriverParams = []): PendingRows =>
      pendingRows(async (asValues) => {
        await armedFor(query);
        return issue(tx, query, params, asValues);
      }),
    savepoint: (work: (nested: postgres.TransactionSql) => Promise<unknown>): Promise<unknown> => tx.savepoint((nested) => work(transactionClient(nested, scope))),
  };
  return client as unknown as postgres.TransactionSql;
}

/**
 * The client drizzle is handed. Its driver reaches a client through `unsafe`, `begin` and `options`
 * alone, and each of the three answers here with the scope armed before any statement of it — inside
 * a transaction too, where the whole transaction runs on the one connection it opened.
 */
export function scopedClient(sql: postgres.Sql, scope: Scope): postgres.Sql {
  const client = {
    options: sql.options,
    unsafe: (query: string, params: DriverParams = []): PendingRows =>
      pendingRows((asValues) => inScope(sql, scope, (session) => issue(session, query, params, asValues))),
    begin: (work: (tx: postgres.TransactionSql) => Promise<unknown>): Promise<unknown> => sql.begin((tx) => work(transactionClient(tx, scope))),
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

function handleFor(scope: Scope): TenantDb {
  const db = drizzle({ client: scopedClient(connection(), scope), schema: SEAM_SCHEMA });
  // Pinned on the handle, not writable: the scope a handle was armed with is what every query of
  // it runs under, and a member a caller could overwrite would say one thing while the session
  // said another.
  const armed: TenantDb = Object.assign(db, { scope });
  Object.defineProperty(armed, "scope", { writable: false, configurable: false });
  return boundSurface(armed);
}

/** The shape a uuid column — and the `cubit.tenant_id` cast the policies make — can hold. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Can a uuid column hold this value? Handed out from the seam because the answer belongs to the
 * columns the seam defines: a value that is not one makes any statement comparing it fail as a cast
 * error (22P02) — a fault — rather than simply matching no row, so a door that takes an id from a
 * caller asks here before it asks the database (ARCH-02).
 */
export function isUuid(value: string): boolean {
  return UUID.test(value);
}

/**
 * The tenant filter a scoped read states for itself, beside the policy that states the same thing.
 * The scope a handle armed is a session setting, so the predicate reads it rather than taking a
 * tenant id as an argument no caller has: under a tenant handle it narrows to that tenant, and under
 * a system handle — which is armed with no tenant on purpose (SEAM-TENANT) — it narrows to the row's
 * own tenant, so the seam's own filter can never contradict the policy it stands beside.
 *
 * It is a recheck, not an access path: the fallback arm names the column, so the planner cannot use
 * this predicate as an index qualifier. What it buys is that a read states what it narrows to.
 *
 * Handed out from here because the setting's name is the migration's and this file is its one home
 * (ARCH-02): a read that spelled `current_setting` itself would be a second copy of that name.
 */
export function inCurrentScope(column: AnyColumn): SQL {
  return statement`${column} = coalesce(nullif(current_setting(${TENANT_GUC}, true), '')::uuid, ${column})`;
}

/**
 * The fragment tag, handed out from the seam for the same reason `inCurrentScope` is: only the seam
 * may hold the driver (SEAM-TENANT), and a read that needs a clause the eight query operators cannot
 * spell — a correlated absence, say — would otherwise reach for the driver itself. It is handed out
 * from here rather than from the barrel because the barrel's operator line is the closed set every
 * caller shares, and this is not an operator: it is the seam lending its own hold on the driver to
 * one clause a caller writes and owns. Columns and values interpolated into it are parameterised by
 * the driver exactly as they are everywhere else in this file.
 */
export { statement };

/** The one code point no `text` column can carry, written as an escape so this file stays readable. */
const UNSTORABLE_BYTE = "\u0000";

/**
 * Can a `text` column hold this value at all? Postgres carries text as a NUL-terminated string, so
 * U+0000 is not a character it can store at any length — the driver refuses the *parameter*, before
 * any column is reached, and the refusal it raises carries no refusal marker. Handed out from the
 * seam for the same reason `isUuid` is (ARCH-02): a door given a caller-written string it is about
 * to compare or store asks here first, or the driver's refusal reaches the caller as a fault id for
 * a value the door never judged (R-SPINE-007, R-SPINE-062).
 */
export function isStorableText(value: string): boolean {
  return !value.includes(UNSTORABLE_BYTE);
}

/**
 * The nearest thing a `text` column can hold to the value a caller presented: the same string with
 * the one code point postgres has no representation for dropped, and nothing else touched.
 *
 * Handed out from the same one home as `isStorableText` and for the same reason (ARCH-02). A door
 * that only *compares* a caller-written string can ask whether it is storable and answer without
 * looking; a door that must *store* one has no such option — it either writes something or hands the
 * caller a fault id for a value it never wrote — so it is given the fold rather than left to spell
 * U+0000 a second time.
 */
export function storableText(value: string): string {
  return value.replaceAll(UNSTORABLE_BYTE, "");
}

/**
 * The tenant a handle may be opened for: one the policies can read. Refused as the handle is taken,
 * like `runAsSystem`'s reason — a caller who names no lawful tenant gets no handle, rather than a
 * server error on every query it makes.
 */
function scopedTenantId(tenantId: string): string {
  if (!isUuid(tenantId)) {
    throw new Error(`forTenant({ tenantId }) needs a tenant uuid — ${JSON.stringify(tenantId)} names no tenant the policies can read (SEAM-TENANT)`);
  }
  return tenantId;
}

/** The tenant's handle: the only way a tenant's rows are read or written (SEAM-TENANT). */
export function forTenant(ctx: { tenantId: string }): TenantDb {
  return handleFor({ tenantId: scopedTenantId(ctx.tenantId), systemReason: "" });
}

/**
 * The system's handle, made only for work an attributable reason has been given for. The reason is
 * recorded as the handle is taken and carried on the session every query of it runs on, so what a
 * system-scoped statement did is answerable from the database's side too.
 */
export function runAsSystem(reason: string): SystemDb {
  return handleFor({ tenantId: "", systemReason: attributableReason(reason) });
}

/** What one project spent on model calls: how many were made, how they ended, and what they cost. */
export type ModelSpend = {
  projectId: string;
  calls: number;
  proposed: number;
  refused: number;
  inputTokens: number;
  outputTokens: number;
  attributedCost: string;
};

/** The tenant a handle is armed for, as the handle itself carries it; a handle armed for none is refused. */
function armedTenantId(db: TenantDb): string {
  const tenantId = db.scope.tenantId;
  if (tenantId === "") {
    throw new Error("modelSpendByProject needs a tenant's handle — a system-scoped handle would answer one entry per project across every tenant, which no caller could tell from a scoped answer (SEAM-TENANT)");
  }
  return tenantId;
}

/**
 * A count postgres answered with, as a number. Counts and token sums come back as text because they
 * are `bigint`s, and one past what a double counts exactly would come back quietly rounded — in the
 * one surface whose whole job is exact attribution. Unreachable by ordinary spending, and a fault
 * rather than a wrong total if it ever is reached.
 */
function counted(value: string, field: string): number {
  const total = Number(value);
  if (!Number.isSafeInteger(total)) {
    throw new Error(`model spend's ${field} totals ${value}, which is past the last whole number a double counts exactly — the total would be rounded, not reported`);
  }
  return total;
}

/**
 * Per-project model spend for the tenant the handle is scoped to (R-AI-005): one entry per project
 * the tenant has calls for, counting proposed and refused alike — L-AI-01 records every call, and a
 * spend report that dropped the refusals would understate what the tenant was charged.
 *
 * The money is summed by the database, whose numeric addition is exact, and comes back as a decimal
 * string: a total that became a double on the way out would be a different total. The counts are
 * what postgres answers a count with — text — turned back into numbers here, so no caller has to.
 *
 * The tenant is named in the query as well as left to row-level security. `TenantDb` and `SystemDb`
 * are the same typed surface, so a system handle reaches this function without a type error, and a
 * read governed by policy alone would answer it with every tenant's calls merged into one entry per
 * project — an answer indistinguishable from a scoped one. So the handle is asked which tenant it is
 * armed for, before any statement is issued: one that names none is refused where it is taken, like
 * `forTenant`'s own tenant id. The read is then the one statement.
 */
export async function modelSpendByProject(db: TenantDb): Promise<ModelSpend[]> {
  const tenantId = armedTenantId(db);
  const rows = await db
    .select({
      projectId: modelCalls.projectId,
      calls: statement<string>`count(*)`,
      proposed: statement<string>`count(*) filter (where ${modelCalls.outcome} = 'proposed')`,
      refused: statement<string>`count(*) filter (where ${modelCalls.outcome} = 'refused')`,
      inputTokens: statement<string>`coalesce(sum(${modelCalls.inputTokens}), 0)`,
      outputTokens: statement<string>`coalesce(sum(${modelCalls.outputTokens}), 0)`,
      attributedCost: statement<string>`coalesce(sum(${modelCalls.attributedCost}), 0)::text`,
    })
    .from(modelCalls)
    .where(eq(modelCalls.tenantId, tenantId))
    .groupBy(modelCalls.projectId)
    .orderBy(asc(modelCalls.projectId));

  return rows.map((row) => ({
    projectId: row.projectId,
    calls: counted(row.calls, "calls"),
    proposed: counted(row.proposed, "proposed"),
    refused: counted(row.refused, "refused"),
    inputTokens: counted(row.inputTokens, "inputTokens"),
    outputTokens: counted(row.outputTokens, "outputTokens"),
    attributedCost: minimalDecimal(row.attributedCost),
  }));
}
