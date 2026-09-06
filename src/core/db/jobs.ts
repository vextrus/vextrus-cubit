// SEAM-JOBS' storage (R-SPINE-030, R-SPINE-031). A queue library is a database driver by the same
// reading that makes `postgres` one, so pg-boss is held inside the seam's directory and nowhere
// else (SEAM-TENANT).
import PgBoss from "pg-boss";
import postgres from "postgres";
import { reportFault } from "../faults/report";
import { TERMINAL_STATUSES } from "../jobs/statuses";
import { advisoryXactLockQuery } from "./advisory-lock";
import { closedList } from "./sql";

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
 * Both stores stand outside the schema tree drizzle-kit reads, so neither can drift from it. The
 * ground they need — the log's schema and the door that installs the queue library's — is made by
 * the migrate lane; the log's tables are the seam's own repeatable DDL, written by whichever tier
 * writes first, and the queue's storage is installed by the managing tier through that door.
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

/**
 * The key lock's connections, which are deliberately not the log's.
 *
 * A session advisory lock is held on one physical connection for the whole of the guarded section,
 * and that section reads and writes the log — on the pool. Taking both from one pool is a deadlock
 * with no way out: as many concurrent enqueues of *different* keys as the pool is wide would each
 * hold a reservation and each wait for a connection only another one of them could give back. The
 * lock therefore has a pool of its own, so a waiter only ever waits for a lock holder to finish.
 */
const LOCK_POOL = { max: 8, idleTimeout: 20, connectTimeout: 10 } as const;

/**
 * How long an enqueue waits for another enqueue of the SAME key before giving up, in milliseconds.
 * Generous — the guarded section is a claim and a send — but finite: a wait with no end turns one
 * wedged key into every connection in the lock pool, and then into every key (SEAM-JOBS).
 */
const LOCK_WAIT_MS = 30_000;

/** What Postgres answers when the log has not been provisioned yet: no such table, no such schema. */
const UNDEFINED_TABLE = "42P01";
const INVALID_SCHEMA_NAME = "3F000";
/** What Postgres answers when a unique index cannot be built over rows that already collide. */
const UNIQUE_VIOLATION = "23505";

/**
 * How the queue's own outages are recorded. A lost connection, a failed maintenance pass or a
 * queue that would not start is a non-refusal server-side failure like any other, so it crosses
 * the one fault seam rather than being written down in a dialect of its own (ARCH-03, ARCH-02).
 * It belongs to no request, so the one name serves as the request id and the route alike.
 */
const QUEUE_ROUTE = "jobs/queue";
const QUEUE_ACTOR = "pg-boss";

/**
 * How a log that could not be provisioned is recorded. The log's DDL runs on the first write of a
 * process; a statement of it that fails would otherwise reject every enqueue and every event write
 * after it with a raw driver error, so it crosses the one fault seam like the queue's own start
 * (ARCH-03, B-21).
 */
const LOG_ROUTE = "jobs/log";
const LOG_ACTOR = "jobs/log";

/**
 * The driver's own word that a connection is gone: the socket closed under a statement, the
 * connection was destroyed, or the pool it came from was ended. Beside them, the server's own
 * notice that it is terminating this connection (SQLSTATE class 57).
 */
const CONNECTION_GONE: ReadonlySet<string> = new Set(["CONNECTION_CLOSED", "CONNECTION_DESTROYED", "CONNECTION_ENDED", "57P01", "57P02", "57P03"]);

/** Whether a failure is the driver or the server reporting the connection itself gone. */
const connectionGone = (failure: unknown): boolean => {
  const code = (failure as { code?: unknown } | null)?.code;
  return typeof code === "string" && CONNECTION_GONE.has(code);
};

/**
 * How a failure of the key lock itself is recorded. A wait that hit its bound, a lock connection
 * that died, a transaction that would not commit: none is a refusal any registered code covers and
 * all are this seam's own failure, so they cross the one fault seam before the caller sees anything
 * (ARCH-03, B-21).
 */
const LOCK_ACTOR = "jobs/lock";
const LOCK_ROUTE = "jobs/lock";

/** What the key lock holds instead of a guarded failure when there was none — `undefined` is a lawful throw. */
const NOTHING_GUARDED = Symbol("nothing was thrown under the lock");

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

/**
 * The queue policy one kind is run under, as the seam above declares it. `concurrency` is how many
 * of the kind's jobs THIS process takes at a time; `expireSeconds` is how long the queue lets one
 * attempt run before it treats the runner as gone and re-queues the attempt.
 */
export type QueueShape = { concurrency: number; retryLimit: number; retryDelaySeconds: number; retryBackoff: boolean; expireSeconds: number };

/** A claim on a (kind, key) pair whose job the log records no ending for. */
export type LiveClaim = { kind: string; key: string; jobId: string };

/** Where a batch of claims left off: the claim's own primary key, which no later write moves. */
export type ClaimCursor = { kind: string; key: string };

/**
 * Where a job has got to according to the queue itself, which is a different question from where
 * the log says it got to. `ended` covers every way the queue is done with a job — finished,
 * cancelled, failed, or no longer there at all.
 */
export type QueueState = "pending" | "active" | "ended";

/** The one handle on the queue and on the event log (ARCH-02). Nothing else speaks to either. */
export interface JobsStore {
  /**
   * Reach the server. `manage` says whether this opener is the one that owns the storage: only a
   * managing opener creates the log's tables and migrates the queue's own schema. A tier that
   * merely reads the log opens neither, so reading needs no privilege to create anything and
   * starts no queue maintenance in the reader's process.
   */
  open(options: { manage: boolean }): Promise<void>;
  /** Reach the server and come back, so a health answer states what is true rather than what is declared. */
  ping(): Promise<void>;
  declareQueue(name: string, shape: QueueShape): Promise<void>;
  consume(name: string, shape: QueueShape, run: (job: QueuedJob) => Promise<void>): Promise<void>;
  publish(name: string, jobId: string, data: Record<string, unknown>, shape: QueueShape): Promise<string>;
  queueStateOf(name: string, jobId: string): Promise<QueueState>;
  /**
   * Run `work` with the (kind, key) pair to itself. `requestId` is the caller's own — the job an
   * enqueue minted, the claim a sweep is settling — so a failure of the locking is recorded against
   * the request it failed, never against a name of the lock's own (ARCH-03).
   */
  withKeyLock<T>(kind: string, key: string, requestId: string, work: () => Promise<T>): Promise<T>;
  liveJobFor(kind: string, key: string, endedStatuses: readonly string[]): Promise<string | null>;
  /**
   * At most `limit` claims whose job the log records no ending for, in (kind, key) order, and
   * only those after `after` where one is given — so a caller reading batch by batch reaches every
   * claim, however many live ones stand before it.
   */
  liveClaims(endedStatuses: readonly string[], limit: number, after?: ClaimCursor): Promise<LiveClaim[]>;
  claimKey(kind: string, key: string, jobId: string): Promise<void>;
  releaseKey(kind: string, key: string, jobId: string): Promise<void>;
  append(draft: JobEventDraft): Promise<JobEventRow>;
  /**
   * A job's last word, in one statement: the terminal row is written only if the log holds no
   * ending for the job yet, and the key's claim — where it still names this job — is released in
   * the same step. Answers the row written, or null when the job had already ended, so a second
   * ending is impossible by construction rather than by a check somebody remembers to make
   * (R-SPINE-030).
   */
  appendEnding(draft: JobEventDraft, endedStatuses: readonly string[]): Promise<JobEventRow | null>;
  read(jobId: string, afterSeq: number): Promise<JobEventRow[]>;
  /** The newest `limit` ending rows in the given statuses, in the order the log recorded them. */
  deadLetterRows(endedStatuses: readonly string[], limit: number): Promise<JobEventRow[]>;
  listen(onJob: (jobId: string) => void): Promise<void>;
  close(): Promise<void>;
}

/** The log's tables, as the runtime makes them. Statement by statement, each one repeatable. */
const JOBS_DDL: readonly string[] = [
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

/**
 * The log's schema, made only where it is absent. `create schema if not exists` is checked against
 * the right to create in the DATABASE before it looks to see whether the schema is already there, so
 * a tier that states it unconditionally asks every database it opens for a standing privilege it
 * needs on almost none of them. The migrate lane makes this schema and hands the app role the right
 * to make the log's tables inside it; a database no migration has crossed is still provisioned by
 * the first writer that may (R-SPINE-030).
 */
const JOBS_SCHEMA_DDL = `create schema if not exists ${JOBS_SCHEMA}`;

/** The door the migrations publish for installing the queue library's own schema (R-SPINE-031). */
const PROVISION_QUEUE = "provision_queue_storage";

/** The queue schema version db/migrations/0018 holds pg-boss 10.4.2's construction plans for. */
const PROVISIONED_QUEUE_VERSION = 24;

/**
 * The schema version the pg-boss that is actually installed would construct, read back off its own
 * plans rather than restated beside them (B-19). `migrate: false` on every tier means nothing
 * corrects a mismatch, so a bump of the library whose plans build another version is named at the one
 * place that asks the migration's door to install them — never left to surface as SQL that does not
 * fit the storage the door made.
 */
function plannedQueueVersion(): number | null {
  const stated = /version\s*\(\s*version\s*\)\s*values\s*\(\s*'?(\d+)'?\s*\)/i.exec(PgBoss.getConstructionPlans(BOSS_SCHEMA));
  return stated === undefined || stated === null ? null : Number(stated[1]);
}

/**
 * One ending per job is a constraint of the storage, not a courtesy of its callers: two racing
 * writers cannot both land in a unique index (R-SPINE-030, B-17). Built after the tables, on its
 * own, because a log written before the ending was a constraint may already hold two endings for
 * a job — two writers that both passed a read-committed "no ending yet" check — and such a log is
 * reported, never edited (see `createLog`).
 */
const ONE_ENDING_INDEX = `create unique index if not exists job_events_one_ending on ${JOBS_SCHEMA}.job_events (job_id)
   where status in (${closedList([...TERMINAL_STATUSES])})`;

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

/** A resource reached lazily: `reach()` reaches or answers the reach in hand; `pending()` is that reach, if any. */
type ReachedOnce<T> = { reach: () => Promise<T>; pending: () => Promise<T> | undefined };

/**
 * A resource reached lazily and then remembered. A failed attempt is forgotten rather than kept:
 * one outage at the moment of the first call must not leave the process holding a rejection it
 * answers every later caller with, long after the server has come back. The reach in hand is
 * visible, so a close can wait for a start still in flight instead of ending pools under it.
 */
function reachedOnce<T>(reach: () => Promise<T>): ReachedOnce<T> {
  let held: Promise<T> | undefined;
  return {
    reach: () => {
      const reaching: Promise<T> = (held ??= reach().catch((failure: unknown) => {
        if (held === reaching) held = undefined;
        throw failure;
      }));
      return reaching;
    },
    pending: () => held,
  };
}

/**
 * The job store for one database. Nothing is opened by building it — `open()` is what reaches the
 * server — so a module that merely imports the seam neither needs nor makes a connection.
 *
 * Neither the queue library nor the log's schema is touched by a tier that only reads: the pg-boss
 * instance is built the first time something actually uses the queue, and nothing is created until
 * something is written. Reading the event log therefore needs no privilege to create anything and
 * starts no queue maintenance in the reader's process — a read of storage that does not exist yet is
 * a read that finds nothing, not an outage.
 *
 * `manage` says who MANAGES: only a managing opener installs the queue library's own schema, runs
 * its maintenance and consumes. The log is provisioned by whoever writes to it first (`if not
 * exists` DDL, repeatable), so a tier that only enqueues reaches a database a worker has already
 * provisioned; against one no worker has ever opened, its queue cannot start, and it says so as a
 * fault rather than migrating storage it does not manage.
 */
export function jobsStore(url: string): JobsStore {
  const sql = postgres(url, {
    max: JOBS_POOL.max,
    idle_timeout: JOBS_POOL.idleTimeout,
    connect_timeout: JOBS_POOL.connectTimeout,
    onnotice: () => undefined,
  });
  const locks = postgres(url, {
    max: LOCK_POOL.max,
    idle_timeout: LOCK_POOL.idleTimeout,
    connect_timeout: LOCK_POOL.connectTimeout,
    onnotice: () => undefined,
  });

  /** Whether this opener manages the storage: only it migrates the queue, runs its maintenance and consumes. */
  let managing = false;
  /** The open in flight, if any, so a close waits for it rather than ending pools under it. */
  let opening: Promise<void> | undefined;

  const createLog = reachedOnce(async () => {
    try {
      const [schema] = await sql<{ stands: boolean }[]>`select exists (select 1 from pg_namespace where nspname = ${JOBS_SCHEMA}) as stands`;
      if (schema?.stands !== true) await sql.unsafe(JOBS_SCHEMA_DDL);
      for (const statement of JOBS_DDL) await sql.unsafe(statement);
      try {
        await sql.unsafe(ONE_ENDING_INDEX);
      } catch (collision) {
        if ((collision as { code?: unknown }).code !== UNIQUE_VIOLATION) throw collision;
        // The log is the seam's own record of how every job went, so no row of it is deleted to
        // make the constraint fit: the jobs that hold two endings are recorded as a fault, the log
        // stays writable under the existence check alone, and the index is built by the next
        // process once an operator has resolved them (R-SPINE-030, ARCH-03).
        const duplicated = await sql<{ job_id: string }[]>`
          select job_id
            from ${sql(JOBS_SCHEMA)}.job_events
           where status in ${sql([...TERMINAL_STATUSES])}
           group by job_id
          having count(*) > 1
           order by job_id`;
        const jobs = duplicated.map((row) => row.job_id);
        const cause = new Error(
          `the job log holds more than one ending for ${jobs.length} job(s) — ${jobs.join(", ")} — so job_events_one_ending cannot be built until they are resolved (R-SPINE-030)`,
          { cause: collision },
        );
        reportFault({ requestId: LOG_ROUTE, actor: LOG_ACTOR, route: LOG_ROUTE, cause });
      }
    } catch (failure) {
      // A log that could not be provisioned is this seam's failure to answer for, and one every
      // later write would otherwise repeat unmarked (ARCH-03, B-21).
      const { faultId } = reportFault({ requestId: LOG_ROUTE, actor: LOG_ACTOR, route: LOG_ROUTE, cause: failure });
      throw new Error(`the job log could not be provisioned — recorded as fault ${faultId}`, { cause: failure });
    }
  });

  const queue = reachedOnce(async () => {
    // Installing the queue library's schema is the managing tier's act (R-SPINE-031) and the
    // migration role's authority: making a schema is a privilege over the whole database, which the
    // role this runs as does not hold and is not owed. The managing tier therefore asks the one door
    // the migrations publish for it — it installs the library's own schema and grants the runtime
    // what it needs, or, where the storage already stands, does nothing.
    if (managing) {
      try {
        const planned = plannedQueueVersion();
        if (planned !== PROVISIONED_QUEUE_VERSION) {
          throw new Error(
            `the installed pg-boss constructs queue schema version ${String(planned)}, and the migration's door installs version ${String(PROVISIONED_QUEUE_VERSION)} — no tier migrates the queue (R-SPINE-031), so the two must be moved together`,
          );
        }
        await sql`select ${sql(JOBS_SCHEMA)}.${sql(PROVISION_QUEUE)}()`;
      } catch (failure) {
        // Storage that could not be provisioned is this seam's failure to answer for, like a queue
        // that would not start (ARCH-03, B-21).
        const { faultId } = reportFault({ requestId: QUEUE_ROUTE, actor: QUEUE_ACTOR, route: QUEUE_ROUTE, cause: failure });
        throw new Error(`the job queue's storage could not be provisioned — recorded as fault ${faultId}`, { cause: failure });
      }
    }
    const boss = new PgBoss({
      connectionString: url,
      schema: BOSS_SCHEMA,
      pollingIntervalSeconds: QUEUE_POLL_SECONDS,
      // The library migrates nothing on any tier: its schema is installed by the door above, whose
      // one act is to install exactly this version of it. A tier that finds no storage is told so
      // rather than left to create it (R-SPINE-031).
      migrate: false,
      supervise: managing,
      schedule: false,
    });
    // The library reports a lost connection or a maintenance failure on this emitter, and an emitter
    // with no listener throws the error at the process instead. A worker's outage is the operator's
    // to read through the one fault seam, never a reason for the process running the queue to die
    // (ARCH-03, R-SPINE-031).
    boss.on("error", (failure) => {
      reportFault({ requestId: QUEUE_ROUTE, actor: QUEUE_ACTOR, route: QUEUE_ROUTE, cause: failure });
    });
    try {
      await boss.start();
    } catch (failure) {
      // The library opens its pool before it checks for its schema and closes nothing when the
      // check fails, and a start that failed is one it will not stop: the pool is given back here,
      // or every failed start leaks one.
      // (The library's typing states its handle as a query runner only; the close is its own.)
      const handle = boss.getDb() as { close?: () => Promise<void> };
      await handle.close?.().catch(() => undefined);
      // A queue that would not start — the library's own schema missing where nothing here may
      // create it, or a server that could not be reached — is this seam's failure to answer for
      // (ARCH-03, B-21).
      const { faultId } = reportFault({ requestId: QUEUE_ROUTE, actor: QUEUE_ACTOR, route: QUEUE_ROUTE, cause: failure });
      throw new Error(`the job queue could not be started — recorded as fault ${faultId}`, { cause: failure });
    }
    return boss;
  });

  /**
   * Run one piece of work with the (kind, key) pair to itself, under a transaction-scoped advisory
   * lock on a connection of the lock pool's own.
   *
   * The transaction holds the lock and nothing else: every read and write the guarded work does
   * happens on the log's pool, so no statement of the caller's is hidden inside it. What the
   * transaction buys is that there is no unlock left to fail — postgres drops an xact lock when the
   * transaction ends, however it ends, the connection dying included. A session lock has to be given
   * back by hand, and a hand-back that does not land wedges the key for the life of the process and
   * either loses its connection or hands the next enqueue one that can never take the lock its own
   * predecessor is sitting on (SEAM-JOBS, ARCH-03).
   *
   * Three failures are told apart here, and each is answered once (ARCH-03, B-21). A failure of the
   * locking — a wait that hit its bound, a pool already ended, a COMMIT that would not land — is the
   * seam's own: it crosses the fault seam under the caller's request id and reaches the caller as a
   * fault id. The guarded work's own failure travels exactly as it was raised — whoever wrote it
   * answered for it already — and is never wrapped. A ROLLBACK that fails on the way out of a failed
   * work is recorded on the lock's route and masks nothing: the caller still hears the work's
   * failure, not the ROLLBACK's.
   *
   * The ROLLBACK is issued by hand for that reason: the driver's transaction wrapper answers a
   * failed work with the ROLLBACK's failure when its socket has closed under it, and the race it
   * runs against the socket rejects the transaction the moment the socket goes. Once the driver has
   * reported the connection closed, no statement may be issued on it — the driver writes to a socket
   * it no longer holds. So the ROLLBACK goes out only on a connection the driver still holds, the
   * transaction body waits for its own exit to be safe, and where the connection is gone — by the
   * driver's report, or by the ROLLBACK's own answer that the connection died under it — the body
   * never exits at all: the driver's transaction has already been answered, the lock died with the
   * connection, and a body left pending holds no connection and no timer.
   */
  const withKeyLock = async <T>(kind: string, key: string, requestId: string, work: () => Promise<T>): Promise<T> => {
    const lockFailure = (what: string, cause: unknown): Error => {
      const { faultId } = reportFault({ requestId, actor: LOCK_ACTOR, route: LOCK_ROUTE, cause });
      return new Error(`a ${kind} job could not ${what} on key ${key} — recorded as fault ${faultId}`, { cause });
    };

    let bodyStarted = false;
    let lockTaken = false;
    let answered: { answer: T } | undefined;
    let guarded: unknown = NOTHING_GUARDED;
    let rollbackFailure: unknown = NOTHING_GUARDED;
    let transactionSettled = false;
    let transactionFailure: unknown = NOTHING_GUARDED;
    let bodyExited: () => void = () => undefined;
    const exited = new Promise<void>((settle) => {
      bodyExited = settle;
    });

    /** Whether the driver has answered the transaction — read a macrotask later, so its report of a closed socket has landed first. */
    const driverAnswered = async (): Promise<boolean> => {
      await new Promise<void>((settle) => setImmediate(settle));
      return transactionSettled;
    };

    /** A body that must never exit: nothing may be issued on the connection it holds (ARCH-03). */
    const parked = (): Promise<never> => new Promise<never>(() => undefined);

    /** The body is about to exit: safe on a connection the driver still holds, never on one that is gone. */
    const exiting = async (): Promise<void> => {
      bodyExited();
      if ((await driverAnswered()) || connectionGone(rollbackFailure)) await parked();
    };

    /**
     * Give a failed work's transaction back by hand, answering what stood in the way — or nothing.
     * Where the driver has already reported the connection closed, no ROLLBACK can be issued and
     * the driver's report is what stood in the way; the lock died with the connection either way.
     */
    const rollingBack = async (tx: postgres.TransactionSql): Promise<unknown> => {
      if (await driverAnswered()) return transactionFailure;
      try {
        await tx.unsafe("rollback");
        return NOTHING_GUARDED;
      } catch (rollback) {
        return rollback;
      }
    };

    const transaction = locks.begin(async (tx) => {
      bodyStarted = true;
      try {
        // A wait that cannot end is worse than a failure that can: bounded, an enqueue behind a
        // holder that will not let go fails and says so, instead of holding a connection until the
        // pool has none left and no key can be enqueued at all.
        await tx.unsafe(`set local lock_timeout = ${LOCK_WAIT_MS}`);
        // The advisory-lock key a (kind, key) pair is serialised on, as the driver takes it.
        const lock = advisoryXactLockQuery(`${kind}:${key}`);
        await tx.unsafe(lock.text, lock.params);
      } catch (failure) {
        await exiting();
        throw failure;
      }
      lockTaken = true;
      let answer: T;
      try {
        answer = await work();
      } catch (failure) {
        guarded = failure;
        rollbackFailure = await rollingBack(tx);
        await exiting();
        throw failure;
      }
      // Wrapped in one: the driver spreads an array a transaction answers with, and a caller's own
      // array result is not this seam's to spread. Kept here too: the work's effects landed on the
      // log's pool whatever becomes of the lock's connection after this point.
      answered = { answer };
      await exiting();
      return answered;
    });
    const outcome = await transaction.then(
      (held) => {
        transactionSettled = true;
        return { answer: (held as { answer: T }).answer };
      },
      (failure: unknown) => {
        transactionSettled = true;
        transactionFailure = failure;
        return { failure };
      },
    );
    if (bodyStarted) await exited;

    if (guarded !== NOTHING_GUARDED) {
      if (rollbackFailure !== NOTHING_GUARDED) reportFault({ requestId, actor: LOCK_ACTOR, route: LOCK_ROUTE, cause: rollbackFailure });
      throw guarded;
    }
    if (answered !== undefined) {
      // Work that answered has landed: its writes went out on the log's pool and are committed
      // whatever the lock's connection did afterwards. A lock that died under it, or a COMMIT that
      // would not land, is recorded on the lock's route — the key was unguarded for the tail of the
      // work — but the caller hears the answer, not a fault for effects that are there (ARCH-03).
      if ("failure" in outcome) reportFault({ requestId, actor: LOCK_ACTOR, route: LOCK_ROUTE, cause: outcome.failure });
      return answered.answer;
    }
    if ("failure" in outcome) throw lockFailure(lockTaken ? "give the lock back" : "take the lock", outcome.failure);
    return outcome.answer;
  };

  /** Which queues this store has already made, so the row is made once per process, not per send. */
  const declared = new Map<string, Promise<void>>();

  /**
   * Make the queue's row if this store has not already made it.
   *
   * A send names a queue by name, and the library's insert joins the send against that row: a name
   * with no row accepts no job at all. Declaring is therefore not the consuming tier's privilege but
   * every writer's obligation — a tier that only enqueues must be able to reach a database no worker
   * has ever started on (R-SPINE-030). The statement is an upsert of the library's own, so declaring
   * a queue a worker already declared changes nothing.
   */
  const declareOnce = async (name: string, shape: QueueShape): Promise<void> => {
    const already = declared.get(name);
    if (already !== undefined) return await already;
    const declaring: Promise<void> = (async () => {
      const boss = await queue.reach();
      await boss.createQueue(name, {
        name,
        retryLimit: shape.retryLimit,
        retryDelay: shape.retryDelaySeconds,
        retryBackoff: shape.retryBackoff,
        expireInSeconds: shape.expireSeconds,
      });
    })().catch((failure: unknown) => {
      // A declaration that failed is forgotten rather than remembered as done: the next send tries
      // again, instead of every later one being sent at a queue that was never made.
      if (declared.get(name) === declaring) declared.delete(name);
      throw failure;
    });
    declared.set(name, declaring);
    await declaring;
  };

  /**
   * A read of a log that has not been provisioned yet. A tier that reads before anything has ever
   * been written asks a lawful question about a job that cannot exist, and the honest answer is
   * "nothing", not an internal error carrying a fault id (ARCH-03, B-21). Any other failure travels.
   */
  const readingStored = async <T>(read: () => Promise<T>, whenAbsent: T): Promise<T> => {
    try {
      return await read();
    } catch (failure) {
      const code = (failure as { code?: unknown }).code;
      if (code === UNDEFINED_TABLE || code === INVALID_SCHEMA_NAME) return whenAbsent;
      throw failure;
    }
  };

  return {
    open: async ({ manage }) => {
      managing = manage;
      if (!manage) return;
      opening = (async () => {
        await createLog.reach();
        await queue.reach();
      })();
      await opening;
    },

    ping: async () => {
      await sql`select 1`;
    },

    declareQueue: async (name, shape) => {
      await declareOnce(name, shape);
    },

    consume: async (name, shape, run) => {
      const boss = await queue.reach();
      // One worker per slot, each taking a single job at a time, so a kind's concurrency limit is
      // exactly how many of its jobs one process can have in flight (R-SPINE-030). A batch shared
      // by several jobs would make one job's failure the whole batch's.
      //
      // The limit is per process and nothing here coordinates across them: a fleet of N runtimes
      // serves N × `concurrency` of this kind at once. The seam states the number a single runtime
      // holds, which is the number the operator multiplies by however many workers are run.
      for (let slot = 0; slot < shape.concurrency; slot += 1) {
        await boss.work<Record<string, unknown>>(name, { batchSize: 1, includeMetadata: true, pollingIntervalSeconds: QUEUE_POLL_SECONDS }, async (batch) => {
          for (const job of batch) await run({ jobId: job.id, data: job.data, attempt: job.retryCount + 1 });
        });
      }
    },

    publish: async (name, jobId, data, shape) => {
      const boss = await queue.reach();
      // The writer declares the queue row it writes to: a first enqueue from a tier that consumes
      // nothing must land on a provisioned database no worker is running against (R-SPINE-030).
      await declareOnce(name, shape);
      // The id is the seam's rather than the queue's: it is written down as the key's claim before
      // the job exists, so a crash between the two leaves a claim naming a job the queue never got
      // — which is recoverable — instead of a job no claim guards (SEAM-JOBS).
      const sent = await boss.send(name, data, {
        id: jobId,
        retryLimit: shape.retryLimit,
        retryDelay: shape.retryDelaySeconds,
        retryBackoff: shape.retryBackoff,
        // Stated rather than inherited: the library's default expiration would re-queue an attempt
        // that outlived it while the first is still running, which is two attempts of one key at
        // once. The kind declares a window its longest attempt fits inside (R-SPINE-030).
        expireInSeconds: shape.expireSeconds,
      });
      if (sent === null) throw new Error(`the queue "${name}" accepted no job for this send (SEAM-JOBS)`);
      return sent;
    },

    queueStateOf: async (name, jobId) => {
      const boss = await queue.reach();
      const job = await boss.getJobById(name, jobId, { includeArchive: true });
      // A job the queue has never heard of, or no longer holds, is one it is done with — including
      // the job a send never managed to insert.
      if (job === null) return "ended";
      if (job.state === "active") return "active";
      return job.state === "created" || job.state === "retry" ? "pending" : "ended";
    },

    withKeyLock,

    liveJobFor: async (kind, key, endedStatuses) => await readingStored(async () => {
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
    }, null),

    liveClaims: async (endedStatuses, limit, after) => await readingStored(async () => {
      // Keyed on the claim's primary key rather than offset: a claim a batch settled is gone from
      // the table by the next read, and an offset would skip the one that moved into its place.
      const afterCursor = after === undefined ? sql`` : sql`and (claim.kind, claim.key) > (${after.kind}, ${after.key})`;
      const rows = await sql<{ kind: string; key: string; job_id: string }[]>`
        select claim.kind, claim.key, claim.job_id
          from ${sql(JOBS_SCHEMA)}.job_claims as claim
         where not exists (
                 select 1
                   from ${sql(JOBS_SCHEMA)}.job_events as ended
                  where ended.job_id = claim.job_id
                    and ended.status in ${sql(endedStatuses as string[])}
               )
           ${afterCursor}
         order by claim.kind asc, claim.key asc
         limit ${limit}`;
      return rows.map((row) => ({ kind: row.kind, key: row.key, jobId: row.job_id }));
    }, []),

    claimKey: async (kind, key, jobId) => {
      // The first write provisions the log: a tier that only enqueues reaches a database no worker
      // has written the log on yet, rather than failing on tables nobody has made for it.
      await createLog.reach();
      await sql`
        insert into ${sql(JOBS_SCHEMA)}.job_claims (kind, key, job_id)
        values (${kind}, ${key}, ${jobId})
        on conflict (kind, key) do update set job_id = excluded.job_id, claimed_at = clock_timestamp()`;
    },

    releaseKey: async (kind, key, jobId) => {
      // Only this claim: a claim some later enqueue has already replaced is that enqueue's to keep.
      await sql`
        delete from ${sql(JOBS_SCHEMA)}.job_claims
         where kind = ${kind} and key = ${key} and job_id = ${jobId}`;
    },

    append: async (draft) => {
      await createLog.reach();
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

    appendEnding: async (draft, endedStatuses) => {
      await createLog.reach();
      // One statement: the ending is written only where none exists, the claim is released only
      // where an ending was written, and the announcement rides on the row written — so no
      // reader can see the claim gone before the ending, or two endings for one job. A writer that
      // races another past the existence check yields to job_events_one_ending instead: no row,
      // no release, and the caller reads the same null as when the ending was already there.
      const rows = await sql<RawJobEvent[]>`
        with ending as (
          insert into ${sql(JOBS_SCHEMA)}.job_events (job_id, kind, key, step, status, attempt, refusal_code, fault_id, detail, elapsed_ms)
          select ${draft.jobId}::text, ${draft.kind}::text, ${draft.key}::text, ${draft.step}::text, ${draft.status}::text, ${draft.attempt}::integer,
                 ${draft.refusalCode}::text, ${draft.faultId}::text, ${sql.json(jsonDetail(draft.detail))}::jsonb, ${draft.elapsedMs}::integer
           where not exists (
                   select 1
                     from ${sql(JOBS_SCHEMA)}.job_events as ended
                    where ended.job_id = ${draft.jobId}
                      and ended.status in ${sql(endedStatuses as string[])}
                 )
              on conflict do nothing
          returning seq, job_id, kind, key, step, status, attempt, refusal_code, fault_id, detail, at, elapsed_ms
        ), released as (
          delete from ${sql(JOBS_SCHEMA)}.job_claims as claim
           where claim.kind = ${draft.kind} and claim.key = ${draft.key} and claim.job_id = ${draft.jobId}
             and exists (select 1 from ending)
        )
        select ending.seq, ending.job_id, ending.kind, ending.key, ending.step, ending.status, ending.attempt, ending.refusal_code,
               ending.fault_id, ending.detail, ending.at, ending.elapsed_ms, pg_notify(${EVENTS_CHANNEL}, ending.job_id) as announced
          from ending`;
      const row = rows[0];
      return row === undefined ? null : eventRow(row);
    },

    read: async (jobId, afterSeq) => await readingStored(async () => {
      const rows = await sql<RawJobEvent[]>`
        select seq, job_id, kind, key, step, status, attempt, refusal_code, fault_id, detail, at, elapsed_ms
          from ${sql(JOBS_SCHEMA)}.job_events
         where job_id = ${jobId} and seq > ${afterSeq}
         order by seq asc`;
      return rows.map(eventRow);
    }, []),

    deadLetterRows: async (endedStatuses, limit) => await readingStored(async () => {
      // The newest endings, bounded, then put back in the order the log wrote them: a view an
      // operator reads must stay readable however long the log grows (R-SPINE-030).
      const rows = await sql<RawJobEvent[]>`
        select newest.seq, newest.job_id, newest.kind, newest.key, newest.step, newest.status, newest.attempt, newest.refusal_code,
               newest.fault_id, newest.detail, newest.at, newest.elapsed_ms
          from (
            select seq, job_id, kind, key, step, status, attempt, refusal_code, fault_id, detail, at, elapsed_ms
              from ${sql(JOBS_SCHEMA)}.job_events
             where status in ${sql(endedStatuses as string[])}
             order by seq desc
             limit ${limit}
          ) as newest
         order by newest.seq asc`;
      return rows.map(eventRow);
    }, []),

    listen: async (onJob) => {
      await sql.listen(EVENTS_CHANNEL, (jobId) => onJob(jobId));
    },

    close: async () => {
      // Waited for, not cut off: an open still in flight finishes first, so what it was provisioning
      // is provisioned and what it started is stopped here rather than leaked. A queue that was never
      // reached has nothing to drain, and asking for one would open the very instance this store took
      // care not to open; one whose start failed gave its pool back where it failed.
      if (opening !== undefined) await opening.catch(() => undefined);
      const started = queue.pending();
      const boss = started === undefined ? undefined : await started.catch(() => undefined);
      if (boss !== undefined) await boss.stop({ close: true, graceful: true, wait: true });
      await Promise.all([sql.end({ timeout: 5 }), locks.end({ timeout: 5 })]);
    },
  };
}
