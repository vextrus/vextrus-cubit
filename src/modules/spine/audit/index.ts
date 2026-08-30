// R-SPINE-081's audit surfaces, read side: the project's act log, and the posture of the two panels
// the clause also names — the model-call ledger and job history. S-Audit's sole read door.
//
// The log is read through the tenant handle and nothing else (SEAM-TENANT): an audit surface answers
// what the caller's tenant may read, so the system handle — which reads past row-level security —
// has no business here.
//
// The panels are not a roster this file keeps. Their tables belong to the ledger (L-AI-01) and jobs
// (C-SPINE-JOBS) increments, which have not shipped them; whether an installation holds them is a
// question only the catalogue can answer, and it is asked on every call rather than remembered at
// import time — a process that outlives a migration would otherwise answer for the schema it started
// on.
import { acts, desc, eq, forTenant, isUuid, type TenantDb } from "../../../core/db";

/**
 * The tables the two panels probe. One home for the names (ARCH-02): the increments that ship these
 * surfaces target exactly these tables, or re-point this constant and re-baseline what it froze
 * (B-20).
 */
export const AUDIT_PANEL_TABLES = { modelLedger: "model_calls", jobs: "jobs" } as const;

/** One act of the log, as this screen reads it (L-ACT-01). */
export interface AuditAct {
  readonly actId: string;
  readonly actType: string;
  readonly actorId: string;
  /**
   * How the actor is named on screen. On M0's schema the account behind an actor id lives in
   * `users`, whose row-level security admits the system scope alone — and a per-tenant audit read
   * may not take that handle — so the log names the actor by the identifier it recorded. An act is
   * never dropped for want of a name: the id is who the record says it was.
   */
  readonly actorLabel: string;
  /** The facts judged, at the granularity performed — an act's cited evidence (L-ACT-01). */
  readonly subjects: readonly string[];
  /** The digest of the consequence the actor was shown, whole. */
  readonly consequenceDigest: string;
  readonly occurredAt: Date;
}

/**
 * A panel's posture. Disarmed is a state, not a failure: the installation holds no such table yet,
 * which is a truthful answer about this deployment rather than an error or a refusal.
 */
export type AuditPanel = { readonly armed: false } | { readonly armed: true; readonly rowCount: number };

/** What one read of this screen answers, whole. */
export interface AuditSurfaces {
  readonly acts: readonly AuditAct[];
  readonly modelLedger: AuditPanel;
  readonly jobs: AuditPanel;
}

/** The caller's scope: the tenant whose acts are being read. */
export interface AuditCtx {
  readonly tenantId: string;
}

const DISARMED: AuditPanel = { armed: false };

/**
 * An unquoted table name the catalogue probe may name. The probe's argument comes from
 * AUDIT_PANEL_TABLES rather than from a caller, and it is checked here anyway: a name that reaches
 * SQL text is checked where it is written, never where it was declared.
 */
const PLAIN_IDENTIFIER = /^[a-z_][a-z0-9_]*$/;

/** The column a per-project panel counts by, when the table that has arrived carries one. */
const PROJECT_COLUMN = "project_id";

/**
 * The project's acts, newest first. The tiebreak on `actId` makes the order total, so two acts
 * recorded in one instant still stand in one order rather than in whichever the planner returned.
 *
 * A segment that is no uuid names no project: it is judged before the query, because a value a uuid
 * column cannot hold fails the statement as a cast error (22P02) — a fault — rather than matching no
 * row (R-SPINE-007).
 */
async function actsOf(db: TenantDb, projectId: string): Promise<readonly AuditAct[]> {
  if (!isUuid(projectId)) return [];

  const rows = await db
    .select({
      actId: acts.actId,
      actType: acts.actType,
      actorId: acts.actorId,
      subjects: acts.subjects,
      consequenceDigest: acts.consequenceDigest,
      occurredAt: acts.occurredAt,
    })
    .from(acts)
    .where(eq(acts.projectId, projectId))
    .orderBy(desc(acts.occurredAt), desc(acts.actId));

  return rows.map((row) => ({ ...row, actorLabel: row.actorId, subjects: [...row.subjects] }));
}

/** One scalar the catalogue answers, asked on the caller's own handle. */
async function scalar<T>(db: TenantDb, query: string): Promise<T | undefined> {
  const rows = await db.execute<{ answer: T }>(query);
  return (rows as unknown as { answer: T }[])[0]?.answer;
}

/** Postgres answers a boolean as `true`, a driver that stringifies it as `"true"` — both are yes. */
function isYes(answer: unknown): boolean {
  return answer === true || answer === "true";
}

/**
 * A panel's posture, probed live. Armed exactly when the catalogue holds the table this panel is
 * named for; and when it does, the count is of the rows this project may see — filtered by
 * `project_id` when the table that has arrived carries one, because R-SPINE-081 names these surfaces
 * per project, and unfiltered when it does not, because a column the table has not got cannot be
 * counted by.
 */
async function panelFor(db: TenantDb, table: string, projectId: string): Promise<AuditPanel> {
  if (!PLAIN_IDENTIFIER.test(table)) return DISARMED;

  const present = await scalar<unknown>(db, `select (to_regclass('${table}') is not null) as answer`);
  if (!isYes(present)) return DISARMED;

  const perProject = isYes(
    await scalar<unknown>(
      db,
      `select (count(*) > 0) as answer from information_schema.columns where table_name = '${table}' and column_name = '${PROJECT_COLUMN}'`,
    ),
  );
  if (perProject && !isUuid(projectId)) return { armed: true, rowCount: 0 };

  const where = perProject ? ` where ${PROJECT_COLUMN} = '${projectId}'` : "";
  const counted = await scalar<unknown>(db, `select count(*)::int as answer from ${table}${where}`);
  return { armed: true, rowCount: Number(counted ?? 0) };
}

/**
 * S-Audit's one read: the project's act log and the two panels' postures, answered whole.
 *
 * A caller who names no tenant the policies can read gets no handle at all (SEAM-TENANT), so the
 * surfaces answer their empty, disarmed shape — the same honest absence a mistyped project segment
 * gets, never a fault raised out of an address a person typed.
 */
export async function getAuditSurfaces(ctx: AuditCtx, projectId: string): Promise<AuditSurfaces> {
  if (!isUuid(ctx.tenantId)) return { acts: [], modelLedger: DISARMED, jobs: DISARMED };

  const db = forTenant(ctx);
  const [logged, modelLedger, jobs] = await Promise.all([
    actsOf(db, projectId),
    panelFor(db, AUDIT_PANEL_TABLES.modelLedger, projectId),
    panelFor(db, AUDIT_PANEL_TABLES.jobs, projectId),
  ]);

  return { acts: logged, modelLedger, jobs };
}
