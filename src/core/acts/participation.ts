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
 * — the append-only table's answer to "what does this person hold now". A grant whose role is
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
         order by user_id, created_at desc, id desc`,
  );
  const held = new Map<string, Role>();
  for (const row of rows) {
    const role: unknown = row['role'];
    if (isRole(role)) held.set(text(row, 'user_id'), role);
  }
  return held;
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
         order by created_at asc, id asc`,
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
