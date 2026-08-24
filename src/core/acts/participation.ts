/**
 * Participation, as the database holds it (L-ACT-01, L-ACT-03, R-SPINE-011).
 *
 * Three tables and one write. `participants` says who takes part in a project, `participant_roles`
 * is the append-only history of what they were given, and `acts` is the log — and the one write
 * below puts a row in all three at once, because L-ACT-01 says "act row and state change commit
 * in one transaction or neither".
 *
 * That "one transaction" is a *single statement*: a data-modifying CTE. The alternative — a
 * `handle.transaction` with three inserts — is the seam's known pitfall: drizzle only pins a
 * connection for a client it recognises as a pool, and a transaction whose statements travel on
 * different connections commits the first write and loses the rest along with the scope they
 * needed. One statement cannot be split, and SEAM-TENANT already wraps every statement it runs
 * in a transaction of its own (src/core/db.ts), so the guarantee is the database's.
 *
 * Every statement here is written as SQL rather than through the query builder for the same
 * reason: a CTE is not something a builder call composes.
 *
 * The current role of a (project, user) is the *last* row of its history. There is no column to
 * update — `cubit_app` holds neither UPDATE nor DELETE on any of the three — so a demotion is a
 * new row and "who could do what, when" stays answerable after the fact.
 */
import type { ScopedDb } from '../db';
import { sqlTag } from './operators';
import type { Statement } from './operators';
import { isRole } from './vocabulary';
import type { ActType, Role } from './vocabulary';

/**
 * What the seam acts on behalf of: a tenant-scoped handle, the tenant it is scoped to, and the
 * human performing the act.
 *
 * SEAM-ACT: "refuses non-human actors by type". There is no machine-actor member here and no
 * parameter that could carry one, so a model call cannot reach the log at all — the refusal is
 * the shape of the context rather than a check somebody has to remember to run.
 */
export interface ActCtx {
  readonly db: ScopedDb;
  readonly tenantId: string;
  readonly actorId: string;
}

/** One row of the role history, as R-SPINE-011's pane reads it. */
export interface ParticipantGrant {
  readonly userId: string;
  readonly role: string;
  readonly actId: string;
  readonly at: Date;
}

/**
 * The rows a statement came back with, however the driver hands them over: node-postgres
 * answers with a `QueryResult` carrying `rows`, and other drivers drizzle supports answer with
 * the array itself.
 */
async function rowsOf(db: ScopedDb, statement: Statement): Promise<Record<string, unknown>[]> {
  const result: unknown = await db.execute(statement);
  if (Array.isArray(result)) return result as Record<string, unknown>[];
  const carried = (result as { rows?: unknown }).rows;
  return Array.isArray(carried) ? (carried as Record<string, unknown>[]) : [];
}

const text = (row: Record<string, unknown>, column: string): string => String(row[column] ?? '');

/**
 * Everybody's *current* role on a project, by user id.
 *
 * `distinct on (user_id)` with the history ordered newest-first is the last grant for each pair
 * — the append-only table's answer to "what does this person hold now". "Newest" is `created_at`
 * and then `seq`: `created_at` defaults to `now()`, which is the *transaction's* timestamp, so
 * two grants written at the same instant tie, and the tie-break has to be the order they were
 * written in rather than `id`, which is a random uuid. A coin toss there would read a demotion's
 * predecessor as the current role.
 *
 * A grant whose role is
 * not a member of the closed enum is left out rather than trusted: the column is text, and a
 * role the vocabulary does not carry is a role no bundle can be read off.
 */
export async function currentRoles(ctx: ActCtx, projectId: string): Promise<Map<string, Role>> {
  const sql = sqlTag(ctx.db);
  const rows = await rowsOf(
    ctx.db,
    sql`select distinct on (user_id) user_id, role
          from participant_roles
         where project_id = ${projectId}
         order by user_id, created_at desc, seq desc`,
  );
  const held = new Map<string, Role>();
  for (const row of rows) {
    const role: unknown = row['role'];
    if (isRole(role)) held.set(text(row, 'user_id'), role);
  }
  return held;
}

/** Whether anybody takes part in this project yet — the precondition the bootstrap has. */
export async function hasParticipants(ctx: ActCtx, projectId: string): Promise<boolean> {
  const sql = sqlTag(ctx.db);
  const rows = await rowsOf(
    ctx.db,
    sql`select 1 as taking_part from participants where project_id = ${projectId} limit 1`,
  );
  return rows.length > 0;
}

/**
 * Everything between the read and the write, run so that no second caller can slip between them.
 *
 * L-ACT-03's "the last PRINCIPAL cannot be removed" is a claim about the project's state, not
 * about one request's arithmetic: a guard that reads the roles in one transaction and writes in
 * another is not enforced against a caller acting at the same moment, and two principals demoting
 * each other both read "one would remain" and both write. What closes that is a lock taken
 * *before* the read.
 *
 * Three things make this the lock to take. It is a transaction-scoped advisory lock, so it is
 * released when the write commits or rolls back and no failure path can strand it. It is keyed on
 * the project, so acts on different projects never wait for each other. And it is a statement of
 * its own, ahead of the read: under READ COMMITTED every statement takes its own snapshot, so the
 * read that follows the lock sees whatever the caller we waited for committed — a lock taken in
 * the same statement as the read would be acquired after that statement's snapshot was already
 * fixed, and would serialise the callers while still showing the second one stale rows.
 *
 * The whole body runs inside one drizzle transaction, which pins one connection (`ScopedPool`
 * exists for that) and carries the scope on it, so the read, the guard and the single-statement
 * CTE all speak as the same tenant on the same connection.
 */
export async function underProjectLock<T>(
  ctx: ActCtx,
  projectId: string,
  body: (locked: ActCtx) => Promise<T>,
): Promise<T> {
  return ctx.db.transaction(async (transaction) => {
    const locked: ActCtx = { ...ctx, db: transaction as unknown as ScopedDb };
    const sql = sqlTag(locked.db);
    await locked.db.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${projectId}::text, 0))`,
    );
    return body(locked);
  });
}

/** The whole history of a project's grants, oldest first (R-SPINE-011: "role history visible"). */
export async function grantHistory(
  ctx: ActCtx,
  projectId: string,
): Promise<readonly ParticipantGrant[]> {
  const sql = sqlTag(ctx.db);
  const rows = await rowsOf(
    ctx.db,
    sql`select user_id, role, act_id, created_at
          from participant_roles
         where project_id = ${projectId}
         order by created_at asc, seq asc`,
  );
  return rows.map((row) => ({
    userId: text(row, 'user_id'),
    role: text(row, 'role'),
    actId: text(row, 'act_id'),
    at: row['created_at'] instanceof Date ? row['created_at'] : new Date(text(row, 'created_at')),
  }));
}

/** The grant a write is about: who, on what project, given what. */
export interface Grant {
  readonly projectId: string;
  readonly userId: string;
  readonly role: Role;
}

/**
 * The act log's only write: one act row and the state change it made, in one statement.
 *
 * Order inside the CTE is the law's. The participation is written first because L-ACT-03 makes
 * it a composite foreign key from the log — an act on a project by somebody who does not take
 * part in it is unrepresentable — and Postgres checks that key at the end of the statement, by
 * which time the participation this statement wrote is there. `on conflict do nothing` is what
 * makes a second grant to the same person a new *role* row rather than a refused participation.
 *
 * The act's id is what the grant cites, so the two rows point at each other and neither can
 * exist without the other. The statement returns it.
 */
export async function recordGrant(
  ctx: ActCtx,
  actType: ActType,
  grant: Grant,
): Promise<{ actId: string }> {
  const sql = sqlTag(ctx.db);
  const rows = await rowsOf(
    ctx.db,
    sql`with participation as (
          insert into participants (tenant_id, project_id, user_id)
               values (${ctx.tenantId}, ${grant.projectId}, ${grant.userId})
          on conflict (project_id, user_id) do nothing
        ),
        performed as (
          insert into acts (tenant_id, actor_id, act_type, project_id)
               values (${ctx.tenantId}, ${ctx.actorId}, ${actType}, ${grant.projectId})
            returning id
        )
        insert into participant_roles (tenant_id, project_id, user_id, role, act_id)
             select ${ctx.tenantId}, ${grant.projectId}, ${grant.userId}, ${grant.role}, performed.id
               from performed
          returning act_id`,
  );
  const actId = rows[0]?.['act_id'];
  if (typeof actId !== 'string') {
    throw new Error('the act seam wrote no act row');
  }
  return { actId };
}
