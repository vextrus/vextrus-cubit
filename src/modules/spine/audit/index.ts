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
import { acts, desc, eq, forTenant, isUuid, modelLedgerRowsOf, modelOutcomeRowsOf, type ModelLedgerEntry, type ModelOutcome, type TenantDb } from "@/core/db";
import { calibrationLinesOf, type CalibrationLine } from "@/core/model-calibration";

/**
 * The tables the two panels probe. One home for the names (ARCH-02): whoever ships these surfaces
 * targets exactly these tables, or re-points this constant and re-baselines what it froze (B-20).
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

/**
 * One call of the model ledger as the panel lists it (L-AI-01), with the person's newest judgment
 * of it beside it (L-AI-02) — or null where nobody has judged it yet, or nothing was proposed.
 */
export interface AuditLedgerCall {
  readonly callId: string;
  readonly modelId: string;
  readonly question: string | null;
  readonly transport: string;
  readonly outcome: string;
  readonly refusalCode: string | null;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly attributedCost: string;
  /** The call's confidence as the provider stated it, to three places, or null where it stated none. */
  readonly confidence: string | null;
  readonly judged: ModelOutcome | null;
  readonly calledAt: Date;
}

/**
 * The ledger's own reading of itself (L-AI-01, L-AI-02): the newest calls, each with its outcome,
 * and one calibration line per question. Answered only when the ledger panel is armed; the two
 * lists are empty for a project nothing was called for.
 */
export interface AuditLedger {
  readonly calls: readonly AuditLedgerCall[];
  readonly calibration: readonly CalibrationLine[];
}

/** What one read of this screen answers, whole. */
export interface AuditSurfaces {
  readonly acts: readonly AuditAct[];
  readonly modelLedger: AuditPanel;
  readonly jobs: AuditPanel;
  readonly ledger: AuditLedger;
}

const NO_LEDGER: AuditLedger = { calls: [], calibration: [] };

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
 * The name a panel probe may write into its SQL, answered as the name to write. AUDIT_PANEL_TABLES
 * is this module's own constant, so a name that cannot be written into a statement is a defect of
 * that constant and says so out loud: answering DISARMED would dress a rejected name as the truthful
 * posture of an installation that holds no such table, and would disarm the panel permanently with
 * nothing anywhere saying why (ARCH-03, B-21).
 *
 * It is published because it is the whole of what makes the interpolation below safe, and a guard
 * only reachable when its own module's constant is wrong is a guard nobody has ever seen answer
 * (B-17, Q-17).
 */
export function panelTableName(table: string): string {
  if (!PLAIN_IDENTIFIER.test(table)) {
    throw new Error(`"${table}" is no plain table name, so no panel can probe it — AUDIT_PANEL_TABLES names tables (L-AI-01, C-SPINE-JOBS) and is re-pointed under B-20`);
  }
  return table;
}

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
 * A panel's posture, probed live. Armed exactly when this reader can answer the panel at all — the
 * catalogue holds the table, and the handle asking holds SELECT on it. The catalogue answers for a
 * relation the asking role has no privilege on, so arming on existence alone would let the count
 * raise 42501 and carry a permission fault out to the error boundary of a screen whose panels
 * answer a posture; a surface this reader may not read is not a surface it can arm.
 *
 * When it is armed, the count is of the rows this project may see — filtered by `project_id` when
 * the table that has arrived carries one, because R-SPINE-081 names these surfaces per project, and
 * unfiltered when it does not, because a column the table has not got cannot be counted by. The
 * column is looked for on the relation `to_regclass` actually found rather than on every table of
 * that name the role can see: a same-named table in a second schema would otherwise decide the
 * shape of a statement issued against this one.
 */
async function panelFor(db: TenantDb, table: string, projectId: string): Promise<AuditPanel> {
  // The name is asked for as the name to write, so the guard stands on the very spelling that
  // reaches the statement rather than beside it.
  const named = panelTableName(table);

  const readable = await scalar<unknown>(
    db,
    `select (to_regclass('${named}') is not null and coalesce(has_table_privilege(to_regclass('${named}'), 'select'), false)) as answer`,
  );
  if (!isYes(readable)) return DISARMED;

  const perProject = isYes(
    await scalar<unknown>(
      db,
      `select (count(*) > 0) as answer from information_schema.columns as held` +
        ` join pg_catalog.pg_class as relation on relation.relname = held.table_name` +
        ` join pg_catalog.pg_namespace as within on within.oid = relation.relnamespace and within.nspname = held.table_schema` +
        ` where relation.oid = to_regclass('${named}') and held.column_name = '${PROJECT_COLUMN}'`,
    ),
  );
  if (perProject && !isUuid(projectId)) return { armed: true, rowCount: 0 };

  // The unqualified name is resolved by the same `search_path` `to_regclass` was answered against,
  // so the rows counted are the rows of the relation that was armed.
  const where = perProject ? ` where ${PROJECT_COLUMN} = '${projectId}'` : "";
  const counted = await scalar<unknown>(db, `select count(*)::int as answer from ${named}${where}`);
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
  if (!isUuid(ctx.tenantId)) return { acts: [], modelLedger: DISARMED, jobs: DISARMED, ledger: NO_LEDGER };

  const db = forTenant(ctx);
  const [logged, modelLedger, jobs] = await Promise.all([
    actsOf(db, projectId),
    panelFor(db, AUDIT_PANEL_TABLES.modelLedger, projectId),
    panelFor(db, AUDIT_PANEL_TABLES.jobs, projectId),
  ]);
  // The ledger is read only where its panel is armed and the project is one: a disarmed panel has no
  // table to read, and a segment naming no project has no calls (R-SPINE-007).
  const ledger = modelLedger.armed && modelLedger.rowCount > 0 && isUuid(projectId) ? await ledgerOf(db, ctx.tenantId, projectId) : NO_LEDGER;

  return { acts: logged, modelLedger, jobs, ledger };
}

/**
 * The ledger's calls with the newest outcome per call beside each, and the calibration line per
 * question read over the same rows (B-17: one read, one derivation, quoted by the panel and the
 * handoff alike). The outcomes are asked for the listed calls only; the calibration is read over
 * every outcome of the project, because a line is about the question and not about the window.
 */
async function ledgerOf(db: TenantDb, tenantId: string, projectId: string): Promise<AuditLedger> {
  const scope = { tenantId, projectId };
  const [calls, outcomes] = await Promise.all([modelLedgerRowsOf(db, scope), modelOutcomeRowsOf(db, scope)]);
  const newest = new Map<string, ModelOutcome>();
  for (const outcome of outcomes) if (!newest.has(outcome.callId)) newest.set(outcome.callId, outcome.outcome);
  return {
    calls: calls.map((call) => ledgerCallOf(call, newest.get(call.callId) ?? null)),
    calibration: calibrationLinesOf(calls, outcomes),
  };
}

function ledgerCallOf(call: ModelLedgerEntry, judged: ModelOutcome | null): AuditLedgerCall {
  const confidence = call.judgment?.confidence ?? null;
  return {
    callId: call.callId,
    modelId: call.modelId,
    question: call.question,
    transport: call.transport,
    outcome: call.outcome,
    refusalCode: call.refusalCode,
    inputTokens: call.inputTokens,
    outputTokens: call.outputTokens,
    attributedCost: call.attributedCost,
    confidence: confidence === null ? null : confidence.toFixed(3),
    judged,
    calledAt: call.calledAt,
  };
}
