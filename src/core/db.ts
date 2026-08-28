// SEAM-TENANT: forTenant(ctx) and runAsSystem(reason) are the only database handles the tree has.
// The driver, the schema and drizzle's typed read/write surface live here and nowhere else, and
// every query a handle issues runs on a connection its scope has been armed on — the row-level
// security the tenancy-base migration installs reads that scope and nothing else.
//
// The table definitions sit here rather than in db/schema/*.ts because the ORM's table builders are
// a driver import, and this file is their one lawful home; db/schema/*.ts is the tree drizzle-kit
// reads them back out of.
import { and, asc, eq, gt, inArray, isNull, lt, sql as statement } from "drizzle-orm";
import { foreignKey, index, jsonb, pgTable, primaryKey, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import PgBoss from "pg-boss";
import postgres from "postgres";
import { attributableReason } from "./db/reason";

// The query operators a caller needs to say which rows it means. They are the driver's, so they are
// handed out from here rather than imported at a call site: SEAM-TENANT makes this file the one
// lawful home of the driver, and a module that reached for them itself would be holding half a
// handle (ARCH-02).
export { and, asc, eq, gt, inArray, isNull, lt };

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

/**
 * Participation: who may act on a project at all (L-ACT-03). The pair (project, user) is the
 * identity, so the act log can point at it with one composite key; the row is append-only, and the
 * migration's trigger is what makes that true of the owner too.
 */
export const participants = pgTable(
  "participants",
  {
    tenantId: uuid("tenant_id").notNull(),
    projectId: uuid("project_id").notNull(),
    userId: uuid("user_id").notNull(),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.tenantId, table.projectId, table.userId] })],
);

/**
 * The act log (L-ACT-01): one row per human act, carrying the digest of the consequence the actor
 * was shown. The actor's participation is a composite foreign key rather than a check the writer
 * remembers to make — L-ACT-03 puts the participation link in the log itself.
 */
export const acts = pgTable(
  "acts",
  {
    tenantId: uuid("tenant_id").notNull(),
    actId: uuid("act_id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull(),
    actorId: uuid("actor_id").notNull(),
    actType: text("act_type").notNull(),
    // The facts judged, at the granularity performed: a confirm-all is one act with N subjects.
    subjects: jsonb("subjects").$type<readonly string[]>().notNull(),
    consequenceDigest: text("consequence_digest").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.tenantId, table.projectId, table.actorId],
      foreignColumns: [participants.tenantId, participants.projectId, participants.userId],
      name: "acts_actor_participates_fk",
    }),
  ],
);

/**
 * Role grants, append-only: a role is bundled permissions, and holding one is a fact the log made.
 * `act_id` is nullable because a grant can predate the act log's writ over it — a project's first
 * PRINCIPAL is installed by project creation, which is not an act somebody performed.
 */
export const participantRoles = pgTable(
  "participant_roles",
  {
    tenantId: uuid("tenant_id").notNull(),
    grantId: uuid("grant_id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull(),
    userId: uuid("user_id").notNull(),
    role: text("role").notNull(),
    actId: uuid("act_id"),
    grantedAt: timestamp("granted_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.tenantId, table.projectId, table.userId],
      foreignColumns: [participants.tenantId, participants.projectId, participants.userId],
      name: "participant_roles_participant_fk",
    }),
    foreignKey({ columns: [table.actId], foreignColumns: [acts.actId], name: "participant_roles_act_fk" }),
    // A role is held or it is not: the same role twice over is a second row saying the same thing.
    unique("participant_roles_role_once").on(table.tenantId, table.projectId, table.userId, table.role),
  ],
);

/**
 * Identity (R-SPINE-001): an account, the sessions it is signed in through, and the single-use
 * tokens that verify an address or stand in for a password. None of the three carries a tenant id —
 * a person is one account across every workspace they belong to (R-SPINE-002) — so no *tenant*
 * policy can be written for them. That is not the same as no policy: like `tenants`, each of the
 * three is under FORCE row-level security with a system-scope policy, so only a handle that named
 * an attributable reason reaches them at all (SEAM-TENANT, R-SPINE-007).
 *
 * Nothing here stores a secret in the clear: a session token and a mailed token are held as the
 * digest of the value the user was given, so a reader of these rows cannot sign in as anybody.
 */
export const users = pgTable("users", {
  userId: uuid("user_id").primaryKey().defaultRandom(),
  // The address is the account's name, and the door refuses a second account for it by name
  // (ACCOUNT_ALREADY_EXISTS): the unique index below is the belt, never the answer.
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** A signed-in device: what to call it in the list, when it arrived, when it was last seen, and — the whole point of revoke — when it stopped counting. */
export const sessions = pgTable("sessions", {
  sessionId: uuid("session_id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.userId),
  tokenHash: text("token_hash").notNull().unique(),
  deviceLabel: text("device_label").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
});

/** One mailed token: what it authorises, when it stops working, and whether it has been spent. */
export const authTokens = pgTable("auth_tokens", {
  authTokenId: uuid("auth_token_id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.userId),
  kind: text("kind").notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * R-SPINE-001's rate limiting, counted where every instance of the product can see it: one row per
 * attempt at a limited door by one server-derived identity. A counter held in a process is a counter
 * a restart clears and a second instance doubles, so the allowance the law states would be the
 * allowance only of a single-process deployment.
 */
export const authAttempts = pgTable(
  "auth_attempts",
  {
    attemptId: uuid("attempt_id").primaryKey().defaultRandom(),
    door: text("door").notNull(),
    // The server-derived identity the attempt was made against — never anything a caller wrote into
    // a header (R-SPINE-001). What derives it is the limiter's business; this column only holds it.
    identity: text("identity").notNull(),
    attemptedAt: timestamp("attempted_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // The two reads the limiter makes: one key's window, and every row old enough to drop.
    index("auth_attempts_window").on(table.door, table.identity, table.attemptedAt),
    index("auth_attempts_attempted_at").on(table.attemptedAt),
  ],
);

/**
 * R-SPINE-002: the join that makes an account belong somewhere. The pair is the identity — a person
 * is a member of a workspace once — and the row is written in the same transaction as the account
 * and its personal tenant, so an account that belongs nowhere is unrepresentable.
 */
export const memberships = pgTable(
  "memberships",
  {
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.tenantId),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.userId),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.tenantId, table.userId] })],
);

/** Everything the typed surface covers. A table joins the surface by joining this object. */
const schema = { tenants, participants, acts, participantRoles, users, sessions, authTokens, memberships, authAttempts };

/** A handle scoped to one tenant: the typed read/write surface, filtered by row-level security. */
export type TenantDb = PostgresJsDatabase<typeof schema>;

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
  await tx.execute(statement`select pg_advisory_xact_lock(hashtextextended(${key}, 0))`);
}

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

/** One statement on one session, in whichever of the two shapes drizzle asked for it. */
async function issue(session: Pick<postgres.Sql, "unsafe">, query: string, params: DriverParams, asValues: boolean): Promise<unknown> {
  const pending = session.unsafe(query, params);
  return asValues ? await pending.values() : await pending;
}

/** A query that has not run yet, and runs — once — in whichever shape drizzle asks it for. */
function pendingRows(execute: (asValues: boolean) => Promise<unknown>): PendingRows {
  let started: Promise<unknown> | undefined;
  const start = (asValues: boolean): Promise<unknown> => (started ??= execute(asValues));
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

  // No `options` here: drizzle reads a client's options once, when the handle is built, and inside a
  // transaction it reaches this object for `unsafe` and `savepoint` alone.
  const client = {
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
function scopedClient(sql: postgres.Sql, scope: Scope): postgres.Sql {
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

function handleFor(scope: Scope): PostgresJsDatabase<typeof schema> {
  return boundSurface(drizzle({ client: scopedClient(connection(), scope), schema }));
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

/* ------------------------------------------------------------------------------------------------
 * SEAM-JOBS' storage (R-SPINE-030, R-SPINE-031).
 *
 * A queue library is a database driver by the same reading that makes `postgres` one, so pg-boss is
 * imported here and nowhere else (SEAM-TENANT). What follows hands `src/core/jobs` a driver-free
 * handle on two things and only two: the queue, and the durable per-step event log the clause asks
 * for. The meaning of a job — which kinds exist, what a refusal is, when a key is free again —
 * belongs to the seam above; this is where those decisions are stored, not where they are made
 * (ARCH-02).
 *
 * Both stores are runtime-managed: pg-boss migrates its own schema when it starts, and the log's
 * schema is created the same way, by the role the caller's URL names. Neither is in the schema tree
 * drizzle-kit reads, so neither is a migration and neither can drift from one.
 * ---------------------------------------------------------------------------------------------- */

/** The schema the event log lives in; the queue library keeps its own tables beside it. */
const JOBS_SCHEMA = "cubit_jobs";
const BOSS_SCHEMA = "pgboss";

/** The channel every appended event is announced on, so a reader elsewhere need not poll hard. */
const EVENTS_CHANNEL = "cubit_job_events";

/**
 * How often a queue asks for work when nothing has woken it. The library's floor is 500ms, and the
 * floor is what is wanted: a retry's backoff is only observable to the accuracy of the poll that
 * picks the retry up.
 */
const QUEUE_POLL_SECONDS = 0.5;

/** How many connections the log holds. Its own pool, so closing it cannot close a tenant's handle. */
const JOBS_POOL = { max: 5, idleTimeout: 20, connectTimeout: 10 } as const;

/** One row of the event log, as the storage holds it before the seam gives it its meaning. */
export type JobEventDraft = {
  jobId: string;
  kind: string;
  key: string;
  step: string;
  status: string;
  attempt: number;
  refusalCode: string | null;
  faultId: string | null;
  detail: Record<string, unknown> | null;
  elapsedMs: number | null;
};

/** An appended event, with the sequence and the instant the log gave it. */
export type JobEventRow = JobEventDraft & { seq: number; at: string };

/** A job handed to a consumer: which job it is, what it carries, and which attempt this is. */
export type QueuedJob = { jobId: string; data: unknown; attempt: number };

/** The queue policy one kind is run under, as the seam above declares it. */
export type QueueShape = { concurrency: number; retryLimit: number; retryDelaySeconds: number; retryBackoff: boolean };

/** The one handle on the queue and on the event log (ARCH-02). Nothing else speaks to either. */
export interface JobsStore {
  open(): Promise<void>;
  declareQueue(name: string, shape: QueueShape): Promise<void>;
  consume(name: string, shape: QueueShape, run: (job: QueuedJob) => Promise<void>): Promise<void>;
  publish(name: string, data: Record<string, unknown>, shape: QueueShape): Promise<string>;
  withKeyLock<T>(kind: string, key: string, work: () => Promise<T>): Promise<T>;
  liveJobFor(kind: string, key: string, endedStatuses: readonly string[]): Promise<string | null>;
  claimKey(kind: string, key: string, jobId: string): Promise<void>;
  append(draft: JobEventDraft): Promise<JobEventRow>;
  read(jobId: string, afterSeq: number): Promise<JobEventRow[]>;
  deadLetterRows(endedStatuses: readonly string[]): Promise<JobEventRow[]>;
  listen(onJob: (jobId: string) => void): Promise<void>;
  close(): Promise<void>;
}

/** The log's tables, as the runtime makes them. Statement by statement, each one repeatable. */
const JOBS_DDL: readonly string[] = [
  `create schema if not exists ${JOBS_SCHEMA}`,
  `create table if not exists ${JOBS_SCHEMA}.job_events (
     seq bigserial primary key,
     job_id text not null,
     kind text not null,
     key text not null,
     step text not null,
     status text not null,
     attempt integer not null,
     refusal_code text,
     fault_id text,
     detail jsonb,
     at timestamptz not null default clock_timestamp(),
     elapsed_ms integer
   )`,
  `create index if not exists job_events_by_job on ${JOBS_SCHEMA}.job_events (job_id, seq)`,
  `create index if not exists job_events_by_status on ${JOBS_SCHEMA}.job_events (status, seq)`,
  `create table if not exists ${JOBS_SCHEMA}.job_claims (
     kind text not null,
     key text not null,
     job_id text not null,
     claimed_at timestamptz not null default clock_timestamp(),
     primary key (kind, key)
   )`,
];

/** The row as the driver hands it back, before it is folded into the shape the seam publishes. */
type RawJobEvent = {
  seq: string;
  job_id: string;
  kind: string;
  key: string;
  step: string;
  status: string;
  attempt: number;
  refusal_code: string | null;
  fault_id: string | null;
  detail: Record<string, unknown> | null;
  at: Date;
  elapsed_ms: number | null;
};

/**
 * An event's detail as the driver writes it. The log's detail is an ordinary JSON object — every
 * one of them is built from literals in this tree — but the seam above states it as the open shape
 * its own callers speak, so the narrowing to what a `jsonb` parameter accepts happens here, once.
 */
function jsonDetail(detail: Record<string, unknown> | null): postgres.JSONValue {
  return (detail ?? null) as postgres.JSONValue;
}

/** `seq` is a bigint, which the driver hands over as text; the log's instants are read as ISO. */
function eventRow(raw: RawJobEvent): JobEventRow {
  return {
    seq: Number(raw.seq),
    jobId: raw.job_id,
    kind: raw.kind,
    key: raw.key,
    step: raw.step,
    status: raw.status,
    attempt: raw.attempt,
    refusalCode: raw.refusal_code,
    faultId: raw.fault_id,
    detail: raw.detail,
    at: raw.at.toISOString(),
    elapsedMs: raw.elapsed_ms,
  };
}

/**
 * The job store for one database. Nothing is opened by building it — `open()` is what reaches the
 * server — so a module that merely imports the seam neither needs nor makes a connection.
 */
export function jobsStore(url: string): JobsStore {
  const sql = postgres(url, {
    max: JOBS_POOL.max,
    idle_timeout: JOBS_POOL.idleTimeout,
    connect_timeout: JOBS_POOL.connectTimeout,
    onnotice: () => undefined,
  });
  const boss = new PgBoss({ connectionString: url, schema: BOSS_SCHEMA, pollingIntervalSeconds: QUEUE_POLL_SECONDS });
  // The library reports a lost connection or a maintenance failure on this emitter, and an emitter
  // with no listener throws the error at the process instead. A worker's outage is the operator's
  // to read, never a reason for the process running the queue to die (R-SPINE-031).
  boss.on("error", (failure) => process.stderr.write(`${JSON.stringify({ queue: "pg-boss", cause: String(failure) })}\n`));

  /** The advisory-lock key a (kind, key) pair is serialised on. */
  const lockName = (kind: string, key: string): string => `${kind}:${key}`;

  return {
    open: async () => {
      for (const statement of JOBS_DDL) await sql.unsafe(statement);
      await boss.start();
    },

    declareQueue: async (name, shape) => {
      await boss.createQueue(name, {
        name,
        retryLimit: shape.retryLimit,
        retryDelay: shape.retryDelaySeconds,
        retryBackoff: shape.retryBackoff,
      });
    },

    consume: async (name, shape, run) => {
      // One worker per slot, each taking a single job at a time, so a kind's concurrency limit is
      // exactly how many of its jobs one process can have in flight (R-SPINE-030). A batch shared
      // by several jobs would make one job's failure the whole batch's.
      for (let slot = 0; slot < shape.concurrency; slot += 1) {
        await boss.work<Record<string, unknown>>(name, { batchSize: 1, includeMetadata: true, pollingIntervalSeconds: QUEUE_POLL_SECONDS }, async (batch) => {
          for (const job of batch) await run({ jobId: job.id, data: job.data, attempt: job.retryCount + 1 });
        });
      }
    },

    publish: async (name, data, shape) => {
      const jobId = await boss.send(name, data, {
        retryLimit: shape.retryLimit,
        retryDelay: shape.retryDelaySeconds,
        retryBackoff: shape.retryBackoff,
      });
      if (jobId === null) throw new Error(`the queue "${name}" accepted no job for this send (SEAM-JOBS)`);
      return jobId;
    },

    withKeyLock: async (kind, key, work) => {
      // A session lock rather than a transaction one: the work it guards reads and writes on other
      // connections, so it must not be inside a transaction of its own that hides them.
      const session = await sql.reserve();
      try {
        await session`select pg_advisory_lock(hashtextextended(${lockName(kind, key)}, 0))`;
        try {
          return await work();
        } finally {
          await session`select pg_advisory_unlock(hashtextextended(${lockName(kind, key)}, 0))`;
        }
      } finally {
        session.release();
      }
    },

    liveJobFor: async (kind, key, endedStatuses) => {
      const rows = await sql<{ job_id: string }[]>`
        select claim.job_id
          from ${sql(JOBS_SCHEMA)}.job_claims as claim
         where claim.kind = ${kind}
           and claim.key = ${key}
           and not exists (
             select 1
               from ${sql(JOBS_SCHEMA)}.job_events as ended
              where ended.job_id = claim.job_id
                and ended.status in ${sql(endedStatuses as string[])}
           )`;
      return rows[0]?.job_id ?? null;
    },

    claimKey: async (kind, key, jobId) => {
      await sql`
        insert into ${sql(JOBS_SCHEMA)}.job_claims (kind, key, job_id)
        values (${kind}, ${key}, ${jobId})
        on conflict (kind, key) do update set job_id = excluded.job_id, claimed_at = clock_timestamp()`;
    },

    append: async (draft) => {
      const rows = await sql<RawJobEvent[]>`
        insert into ${sql(JOBS_SCHEMA)}.job_events (job_id, kind, key, step, status, attempt, refusal_code, fault_id, detail, elapsed_ms)
        values (${draft.jobId}, ${draft.kind}, ${draft.key}, ${draft.step}, ${draft.status}, ${draft.attempt},
                ${draft.refusalCode}, ${draft.faultId}, ${sql.json(jsonDetail(draft.detail))}, ${draft.elapsedMs})
        returning seq, job_id, kind, key, step, status, attempt, refusal_code, fault_id, detail, at, elapsed_ms`;
      const row = rows[0];
      if (row === undefined) throw new Error("the job event log accepted no row for this event (R-SPINE-030)");
      // Announced rather than waited for: a reader in another process is told there is something to
      // read, and reads it for itself. The payload is the job, never the event — a notification has
      // a size limit and an event does not.
      await sql`select pg_notify(${EVENTS_CHANNEL}, ${row.job_id})`;
      return eventRow(row);
    },

    read: async (jobId, afterSeq) => {
      const rows = await sql<RawJobEvent[]>`
        select seq, job_id, kind, key, step, status, attempt, refusal_code, fault_id, detail, at, elapsed_ms
          from ${sql(JOBS_SCHEMA)}.job_events
         where job_id = ${jobId} and seq > ${afterSeq}
         order by seq asc`;
      return rows.map(eventRow);
    },

    deadLetterRows: async (endedStatuses) => {
      const rows = await sql<RawJobEvent[]>`
        select seq, job_id, kind, key, step, status, attempt, refusal_code, fault_id, detail, at, elapsed_ms
          from ${sql(JOBS_SCHEMA)}.job_events
         where status in ${sql(endedStatuses as string[])}
         order by seq asc`;
      return rows.map(eventRow);
    },

    listen: async (onJob) => {
      await sql.listen(EVENTS_CHANNEL, (jobId) => onJob(jobId));
    },

    close: async () => {
      await boss.stop({ close: true, graceful: true, wait: true });
      await sql.end({ timeout: 5 });
    },
  };
}
