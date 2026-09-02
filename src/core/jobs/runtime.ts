// SEAM-JOBS: the queue as the tree speaks to it (R-SPINE-030, R-SPINE-031).
//
// One runtime per process. Starting it opens the store, declares every kind's queue and — because a
// queue nothing consumes is a queue that never answers — subscribes this process to each of them.
// A process that only enqueues or only reads the log gets the same runtime without consumers, so
// importing the seam still costs no connection at all. Such a runtime manages nothing: it enqueues
// against a database a managing runtime provisioned, and against one none ever has it fails with a
// fault id rather than migrating storage it does not manage (R-SPINE-031).
//
// The durable per-step log is the whole of "a job never fails silently": every attempt records its
// start, its steps and how it ended, and a terminal failure that is not a refusal carries the fault
// id the fault seam recorded for it (ARCH-03, B-21). A refusal carries its registered code and no
// fault id, because a refusal is an answer.
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { jobsStore, type JobEventDraft, type JobEventRow, type JobsStore, type QueuedJob } from "../db";
import { refusalCodeOf } from "../faults/refusal-marker";
import { reportFault } from "../faults/report";
import { JOB_KINDS, KIND_NAMES, type JobKind, type JobPayloads } from "./kinds";
import { runProbe, type JobProgress } from "./probe";

/** How a job's life is recorded, step by step. The last three end it. */
export type JobStatus = "started" | "progress" | "succeeded" | "refused" | "failed";

/** The statuses after which nothing more is ever said about a job. */
export const TERMINAL_STATUSES: ReadonlySet<JobStatus> = new Set<JobStatus>(["succeeded", "refused", "failed"]);

/** One durable record of where a job got to, as the log holds it (R-SPINE-030). */
export type JobEvent = {
  jobId: string;
  kind: JobKind;
  key: string;
  seq: number;
  step: string;
  status: JobStatus;
  attempt: number;
  refusalCode: string | null;
  faultId: string | null;
  detail: Record<string, unknown> | null;
  at: string;
  elapsedMs: number | null;
};

/** What the enqueuer is told: which job carries the work, and whether this call added one. */
export type EnqueueResult = { jobId: string; deduplicated: boolean };

/** A job that ran out of answers, as an operator reads it. */
export type DeadLetter = { jobId: string; kind: JobKind; key: string; cause: string };

/** The step name the lifecycle events are recorded under, before and after the kind's own steps. */
const START_STEP = "start";
const FINISH_STEP = "finish";

/** What an attempt holds instead of a failure when it had none — `undefined` is a lawful throw. */
const NOTHING_WENT_WRONG = Symbol("nothing went wrong");

/** How long a watcher waits for a nudge before reading the log again anyway. */
const WATCH_POLL_MS = 250;

/**
 * How often a runtime that runs the kinds looks for a job the queue has finished with but that
 * recorded no ending — an attempt whose process was killed, or one the queue expired out from
 * under it. Rare, so rarely looked for; never, so it must be looked for at all (R-SPINE-030).
 */
const SWEEP_MS = 30_000;

/** What the sweep's own failures are recorded against — it answers to no request and no job. */
const SWEEP_ROUTE = "job/sweep";

/**
 * How many held keys one sweep looks over. Bounded so a pass over a log that grew while nobody
 * swept it ends, and the next pass takes the next batch; a claim is released when its job ends, so
 * the table the sweep reads is only ever as large as the work still open.
 */
export const SWEEP_BATCH = 100;

/** How many endings the dead-letter view answers at most, newest first — a view an operator can read. */
export const DEAD_LETTER_LIMIT = 200;

/**
 * The longest key a job may be enqueued under, in bytes.
 *
 * A key is the primary key of the claim row that makes idempotence work, and a btree entry has a
 * hard ceiling of about 2704 bytes: a longer one is a raw 54000 out of the driver, at the moment of
 * the insert, with the job neither claimed nor sent. The limit is stated here, well under that
 * ceiling, so a caller deriving a key from something a user typed is told what is wrong with it
 * instead of meeting the index's arithmetic.
 */
const MAX_KEY_BYTES = 512;

/** What one job carries through the queue: its key, so every event can name it, and its payload. */
type Envelope = { key: string; payload: unknown };

/** The one runtime this process has. */
type Runtime = {
  url: string;
  store: JobsStore;
  consumers: boolean;
  /** The kinds the store accepted `consume` for, in the order it accepted them — what this process serves. */
  served: string[];
  /** Set the moment the runtime is being given back, so a watcher ends rather than breaks. */
  closing: boolean;
  /** The sweep for endings nobody managed to write, on the runtimes that run the work. */
  sweep?: ReturnType<typeof setInterval>;
  /** Set while a sweep is under way, so a pass that outlives the interval is not joined by a second. */
  sweeping: boolean;
  /** Who is watching which job, so an appended event wakes a stream instead of a poll finding it. */
  watchers: Map<string, Set<() => void>>;
};

/**
 * ARCH-02 reads "one home" as an identity property, and a module-scope binding only holds it while
 * the module instance does — a runner that instantiates this file twice under racing imports would
 * leave the process with two runtimes and two sets of consumers. The holder is anchored to the
 * process instead, exactly as the fault seam's sink is.
 */
const HOLDER_KEY = Symbol.for("vextrus.cubit.core.jobs.runtime");

const processScope = globalThis as typeof globalThis & { [HOLDER_KEY]?: { current?: Promise<Runtime> } };

const holder: { current?: Promise<Runtime> } = (processScope[HOLDER_KEY] ??= {});

/** The database the seam reaches when nobody named one. */
function configuredUrl(): string {
  const url = process.env["DATABASE_URL"]?.trim();
  if (url === undefined || url === "") {
    throw new Error("DATABASE_URL is not set — the jobs seam has no database to reach (SEAM-JOBS)");
  }
  return url;
}

/** Every handler the seam knows, one per kind — the roster and the code are the same roster. */
const HANDLERS: { [K in JobKind]: (payload: JobPayloads[K], progress: JobProgress) => Promise<void> } = {
  probe: runProbe,
};

/**
 * Run the kind's handler. The payload arrives from storage, where it is untyped by definition, so
 * the one place the type is re-asserted is here — at the boundary the enqueuer's typing guards.
 */
async function dispatch(kind: JobKind, payload: unknown, progress: JobProgress): Promise<void> {
  const handler = HANDLERS[kind] as (given: unknown, reporting: JobProgress) => Promise<void>;
  await handler(payload, progress);
}

/** The log's row, as the seam publishes it. */
function jobEvent(row: JobEventRow): JobEvent {
  return { ...row, kind: row.kind as JobKind, status: row.status as JobStatus };
}

/**
 * Open a runtime against one database, with or without taking work off its queues.
 *
 * Only a runtime that runs the kinds manages the storage: it is the one that creates the log and
 * declares the queues. A process that merely reads the log opens no queue and creates nothing, so
 * reading needs no privilege to create and starts no queue maintenance where requests are served.
 */
async function openRuntime(url: string, consumers: boolean): Promise<Runtime> {
  const store = jobsStore(url);
  const running: Runtime = { url, store, consumers, served: [], closing: false, sweeping: false, watchers: new Map() };
  await store.open({ manage: consumers });
  if (consumers) for (const kind of KIND_NAMES) await store.declareQueue(kind, JOB_KINDS[kind]);
  await store.listen((jobId) => {
    for (const wake of running.watchers.get(jobId) ?? []) wake();
  });
  if (consumers) {
    for (const kind of KIND_NAMES) {
      await store.consume(kind, JOB_KINDS[kind], (job) => perform(running, kind, job));
      running.served.push(kind);
    }
    running.sweep = setInterval(() => void sweepAbandoned(running), SWEEP_MS);
    running.sweep.unref();
  }
  return running;
}

/**
 * Hold one opening as the process's runtime. An opening that fails is *not* held: the whole point
 * of a process-anchored holder is that everything shares one runtime, and a rejection kept there
 * would be answered to every later caller for the life of the process, long after the database came
 * back. A failed open is therefore forgotten, and the next caller opens again.
 */
function holdOpening(opening: Promise<Runtime>): Promise<Runtime> {
  const held = opening.catch((failure: unknown) => {
    if (holder.current === held) holder.current = undefined;
    throw failure;
  });
  holder.current = held;
  return held;
}

/** The runtime this process has, opening a consumer-free one against DATABASE_URL if it has none. */
async function runtime(): Promise<Runtime> {
  const current = holder.current;
  if (current !== undefined) return await current;
  return await holdOpening(openRuntime(configuredUrl(), false));
}

/**
 * Start the runtime that runs the registered kinds in this process — what `pnpm worker` runs, and
 * what a test that wants a job to actually happen starts (R-SPINE-031).
 */
export async function startJobsRuntime(databaseUrl: string): Promise<void> {
  const current = holder.current;
  if (current !== undefined) {
    // A held opening that failed is nothing to stop and nothing to keep: it has already taken
    // itself out of the holder, and this call is the recovery.
    const running = await current.catch(() => undefined);
    if (running !== undefined) {
      if (running.url === databaseUrl && running.consumers) return;
      await stopJobsRuntime();
    }
  }
  await holdOpening(openRuntime(databaseUrl, true));
}

/** Stop consuming, let what is in flight finish, and give the connections back (R-SPINE-031). */
export async function stopJobsRuntime(): Promise<void> {
  const current = holder.current;
  holder.current = undefined;
  if (current === undefined) return;
  const running = await current.catch(() => undefined);
  if (running === undefined) return;
  // Told, not cut off: a subscriber still attached to a job's stream is woken and ends its watch
  // cleanly. A shutdown is nobody's failure, so it must not be recorded as one (ARCH-03).
  running.closing = true;
  if (running.sweep !== undefined) clearInterval(running.sweep);
  for (const watchers of running.watchers.values()) for (const wake of [...watchers]) wake();
  running.watchers.clear();
  await running.store.close();
}

/**
 * Put a job on its kind's queue, at most once per key while one is queued or active (SEAM-JOBS:
 * "every job idempotent on its key"). The duplicate is answered with the first job's id and
 * `deduplicated: true` rather than refused — the caller asked for the work to happen, and it is
 * happening. Once the job has ended the key is free again, so a kind can be asked to do the same
 * thing twice, just never twice at once.
 *
 * The claim, the look-up and the send are serialised on the key itself, so two processes enqueueing
 * the same key at the same instant still make one job.
 */
export async function enqueue<K extends JobKind>(kind: K, payload: JobPayloads[K], options: { key: string }): Promise<EnqueueResult> {
  const key = checkedKey(kind, options.key);
  const running = await runtime();
  const policy = JOB_KINDS[kind];
  // Minted before the lock is taken, so a failure of the locking is recorded against the job this
  // call was making — the id the caller would have been answered with (ARCH-03).
  const jobId = randomUUID();
  return await running.store.withKeyLock(kind, key, jobId, async () => {
    const live = await running.store.liveJobFor(kind, key, [...TERMINAL_STATUSES]);
    // A claim whose job the queue is already done with is a job whose ending nobody wrote. It is
    // ended here — and reported — before this call decides whether the key is busy, so an attempt
    // that did not survive to write its own ending can never hold a key for good.
    if (live !== null && !(await settleAbandoned(running, kind, key, live))) {
      return { jobId: live, deduplicated: true };
    }
    // Claimed before it is sent, and with an id of the seam's own: a crash between the two then
    // leaves a claim naming a job the queue never received, which the settlement above ends and
    // frees. Sending first would leave a job no claim guards, and the key's one-at-a-time promise
    // would be quietly broken instead of recoverably wrong (SEAM-JOBS).
    await running.store.claimKey(kind, key, jobId);
    const envelope: Envelope = { key, payload };
    try {
      await running.store.publish(kind, jobId, { ...envelope }, policy);
    } catch (failure) {
      await running.store.releaseKey(kind, key, jobId).catch(() => undefined);
      throw failure;
    }
    return { jobId, deduplicated: false };
  });
}

/**
 * The key an enqueue may go ahead under, judged before anything is claimed or sent. An empty or
 * blank key names nothing for idempotence to hold on to, and every such enqueue would fold into one
 * job; a key longer than the claim row's index can carry would be a raw SQLSTATE 54000 out of the
 * driver at the insert, an error naming an index rather than the argument that was wrong. Either is
 * a caller's defect on the server's side and not a refusal any registered code covers, so it crosses
 * the one fault seam and the caller is given the id it was recorded under (ARCH-03, B-21).
 */
function checkedKey(kind: JobKind, key: string): string {
  const bytes = new TextEncoder().encode(key).length;
  if (key.trim() === "") return keyDefect(kind, "empty-key", `a ${kind} job key is empty — a job is idempotent on its key, so it needs one (SEAM-JOBS)`);
  if (bytes > MAX_KEY_BYTES) return keyDefect(kind, "oversized-key", `a ${kind} job key is at most ${MAX_KEY_BYTES} bytes; this one is ${bytes} (SEAM-JOBS)`);
  return key;
}

/** A key that cannot be enqueued under, recorded as the fault it is and thrown naming the record. */
function keyDefect(kind: JobKind, defect: string, message: string): never {
  const cause = new Error(message);
  const { faultId } = reportFault({ requestId: `${kind}:${defect}`, actor: `${kind}`, route: `job/${kind}`, cause });
  throw new Error(`${cause.message} — recorded as fault ${faultId}`);
}

/**
 * End a job the queue has finished with but that recorded no ending of its own, answering whether
 * it did so. An attempt whose process was killed, or one the queue expired, leaves the log with no
 * last word — which is exactly the silent failure R-SPINE-030 forbids, and (because a key is free
 * only once its job has ended) a key nothing could ever be enqueued under again.
 *
 * It is a failure of ours rather than the job's, so it crosses the fault seam and carries the id it
 * was recorded under, like every other terminal failure that is not a refusal (ARCH-03, B-21).
 */
async function settleAbandoned(running: Runtime, kind: JobKind, key: string, jobId: string): Promise<boolean> {
  if ((await running.store.queueStateOf(kind, jobId)) !== "ended") return false;
  const recorded = await running.store.read(jobId, 0);
  // An ending that is already written is not written again. The queue can call a job finished while
  // the attempt is still alive — an attempt that outlives its expiration is re-queued under it — and
  // a second terminal row would make the log say the job ended twice (R-SPINE-030).
  if (recorded.some((event) => TERMINAL_STATUSES.has(event.status as JobStatus))) return true;
  const cause = new Error(`job ${jobId} (${kind}) ended in the queue without recording how — its attempt did not survive to write its own ending (R-SPINE-030)`);
  const { faultId } = reportFault({ requestId: jobId, actor: `${kind}:${key}`, route: `job/${kind}`, cause });
  await ended(running, {
    jobId,
    kind,
    key,
    step: FINISH_STEP,
    status: "failed",
    attempt: recorded.at(-1)?.attempt ?? 1,
    refusalCode: null,
    faultId,
    detail: { cause: String(cause) },
    elapsedMs: null,
  });
  return true;
}

/**
 * A job's last word, and the release of its key, in the store's one step: the terminal row lands
 * only where the log holds no ending yet, and the claim goes with it — so the log never says a job
 * ended twice, and a key is free the moment its job is over (R-SPINE-030, SEAM-JOBS).
 */
async function ended(running: Runtime, draft: JobEventDraft): Promise<void> {
  await running.store.appendEnding(draft, [...TERMINAL_STATUSES]);
}

/**
 * Look over the keys still held for a job the queue has finished with. Waiting for the next
 * enqueue of a key to notice would make "a job never fails silently" mean "unless nobody asks
 * again", so the runtimes that run the work look for themselves, on a timer that never holds the
 * process open. One pass at a time and one batch per pass: a pass that outlives the interval is
 * not joined by a second one over the same keys, and a pass ends whatever the log has grown to.
 */
async function sweepAbandoned(running: Runtime): Promise<void> {
  if (running.closing || running.sweeping) return;
  running.sweeping = true;
  try {
    for (const claim of await running.store.liveClaims([...TERMINAL_STATUSES], SWEEP_BATCH)) {
      if (running.closing) return;
      if (!KIND_NAMES.includes(claim.kind as JobKind)) continue;
      await running.store.withKeyLock(claim.kind, claim.key, claim.jobId, async () => {
        const live = await running.store.liveJobFor(claim.kind, claim.key, [...TERMINAL_STATUSES]);
        if (live === claim.jobId) await settleAbandoned(running, claim.kind as JobKind, claim.key, live);
      });
    }
  } catch (failure) {
    // The sweep is itself ours to answer for: a pass that could not run is recorded and the next
    // one tries again, rather than becoming an unhandled rejection on a timer (ARCH-03).
    // The database URL carries a password, so the sweep names itself rather than what it reached.
    if (!running.closing) reportFault({ requestId: SWEEP_ROUTE, actor: "sweep", route: SWEEP_ROUTE, cause: failure });
  } finally {
    running.sweeping = false;
  }
}

/** What this process can truthfully say about the work it is serving right now. */
export type JobsHealth = { ok: boolean; queues: string[] };

/**
 * Whether this process is really taking work off the queues, and which kinds it is taking.
 *
 * Asked, not assumed: `ok` is a round trip to the store made now, so a runtime that was never
 * started, one that is draining, and one whose database has gone away all answer `ok: false` with
 * nothing served, and a supervisor reading the worker's health takes a dead worker out of rotation
 * instead of keeping it (R-SPINE-031). `queues` is the roster this runtime's store accepted
 * `consume` for, in that order — never the kinds the seam declares: a process that enqueues but
 * consumes nothing serves no queue at all.
 */
export async function jobsHealth(): Promise<JobsHealth> {
  const current = holder.current;
  const running = current === undefined ? undefined : await current.catch(() => undefined);
  if (running === undefined || !running.consumers || running.closing) return { ok: false, queues: [] };
  try {
    await running.store.ping();
  } catch (failure) {
    // A worker that cannot reach its database is an outage of ours, and the probe's answer is only
    // half the telling: the operator gets the record too (ARCH-03).
    reportFault({ requestId: "jobs/health", actor: "worker", route: "jobs/health", cause: failure });
    return { ok: false, queues: [] };
  }
  return { ok: true, queues: [...running.served] };
}

/** Everything the log holds about one job, in the order it recorded it. */
export async function jobEvents(jobId: string): Promise<JobEvent[]> {
  const running = await runtime();
  return (await running.store.read(jobId, 0)).map(jobEvent);
}

/**
 * The dead-letter view (R-SPINE-030): every job that ended without succeeding, whether it was
 * refused or ran out of attempts, with the cause an operator reads. It is a view over the event
 * log rather than a second store — a job's ending is already recorded, and recording it twice is
 * how two answers to the same question start to disagree (ARCH-02).
 */
export async function deadLetters(): Promise<DeadLetter[]> {
  const running = await runtime();
  const rows = await running.store.deadLetterRows(["failed", "refused"], DEAD_LETTER_LIMIT);
  // One entry per job, not per row: the view answers "which jobs ran out of answers", and a job that
  // somehow recorded two endings is still one job an operator has to deal with. The first ending is
  // the one kept — it is the one that says how the job actually went (R-SPINE-030).
  const perJob = new Map<string, DeadLetter>();
  for (const row of rows) {
    if (perJob.has(row.jobId)) continue;
    perJob.set(row.jobId, { jobId: row.jobId, kind: row.kind as JobKind, key: row.key, cause: causeOf(row) });
  }
  return [...perJob.values()];
}

/** The cause the log recorded for an ending, falling back to the ending itself. */
function causeOf(row: JobEventRow): string {
  const recorded = row.detail?.["cause"];
  if (typeof recorded === "string" && recorded !== "") return recorded;
  return row.refusalCode ?? row.status;
}

/**
 * Every event of a job, from the first, ending after the terminal one. A watcher attaching late is
 * given the whole history and then the ending, so a subscriber never has to have been there from
 * the start to know what happened (R-SPINE-030).
 */
export async function* watchJob(jobId: string, signal?: AbortSignal): AsyncGenerator<JobEvent> {
  const running = await runtime();
  let lastSeq = 0;
  for (;;) {
    // A runtime being given back is not an outage: the log is simply no longer readable from here,
    // so the watch ends the way an aborted one does rather than becoming a fault a subscriber is
    // told about and an operator has to read (ARCH-03).
    if (running.closing) return;
    let batch: JobEventRow[];
    try {
      batch = await running.store.read(jobId, lastSeq);
    } catch (failure) {
      if (running.closing) return;
      throw failure;
    }
    for (const row of batch) {
      const event = jobEvent(row);
      lastSeq = event.seq;
      yield event;
      if (TERMINAL_STATUSES.has(event.status)) return;
    }
    if (signal?.aborted === true) return;
    await nudged(running, jobId, signal);
  }
}

/** Wait until this job is written about, or the watcher gives up, or the wait has been long enough. */
function nudged(running: Runtime, jobId: string, signal: AbortSignal | undefined): Promise<void> {
  return new Promise((settle) => {
    const watchers = running.watchers.get(jobId) ?? new Set<() => void>();
    running.watchers.set(jobId, watchers);
    let over = false;
    const finish = (): void => {
      if (over) return;
      over = true;
      watchers.delete(finish);
      if (watchers.size === 0) running.watchers.delete(jobId);
      clearTimeout(timer);
      signal?.removeEventListener("abort", finish);
      settle();
    };
    watchers.add(finish);
    signal?.addEventListener("abort", finish, { once: true });
    const timer = setTimeout(finish, WATCH_POLL_MS);
  });
}

/**
 * One attempt at one job: its own temp dir, its own start-to-end record, and exactly one of three
 * endings. A plain failure with attempts left is recorded as progress and rethrown, so the queue
 * schedules the retry the policy asks for; the last attempt's failure is reported to the fault seam
 * and recorded with the fault id, so the operator can find it and the user is never told nothing
 * (ARCH-03). A refusal is recorded with its code and not retried, because it is the answer.
 */
async function perform(running: Runtime, kind: JobKind, job: QueuedJob): Promise<void> {
  const envelope = (job.data ?? {}) as Partial<Envelope>;
  const key = typeof envelope.key === "string" ? envelope.key : "";
  const policy = JOB_KINDS[kind];
  const startedAtMs = Date.now();
  const tempDir = await mkdtemp(join(tmpdir(), `cubit-job-${kind}-`));
  let lastStep = START_STEP;

  const draft = (status: JobStatus, step: string, extra: Partial<JobEventRow> = {}): JobEventDraft => ({
    jobId: job.jobId,
    kind,
    key,
    step,
    status,
    attempt: job.attempt,
    refusalCode: extra.refusalCode ?? null,
    faultId: extra.faultId ?? null,
    detail: extra.detail ?? null,
    elapsedMs: status === "started" ? null : Date.now() - startedAtMs,
  });
  // A step is appended; an ending goes through the store's one terminal step, so the key is
  // released with the last word and no second ending can land (R-SPINE-030).
  const write = async (status: JobStatus, step: string, extra: Partial<JobEventRow> = {}): Promise<void> => {
    const row = draft(status, step, extra);
    if (TERMINAL_STATUSES.has(status)) await ended(running, row);
    else await running.store.append(row);
  };

  const progress: JobProgress = {
    tempDir,
    step: async (name, detail) => {
      lastStep = name;
      await write("progress", name, { detail: detail ?? null });
    },
  };

  await write("started", START_STEP, { detail: { tempDir } });
  let failure: unknown = NOTHING_WENT_WRONG;
  try {
    await dispatch(kind, envelope.payload, progress);
  } catch (thrown) {
    // Held rather than answered here: how an attempt ended is decided below, once — and the
    // invocation's directory is taken away before that ending is recorded, whichever ending it is.
    failure = thrown;
  }
  // Per invocation, and gone before the attempt's last word is written (R-SPINE-031): a reader that
  // has seen an attempt end can trust that the directory that attempt named is no longer there.
  await discard(tempDir, { jobId: job.jobId, kind, key });

  if (failure === NOTHING_WENT_WRONG) {
    await write("succeeded", FINISH_STEP);
    return;
  }
  const refusalCode = refusalCodeOf(failure);
  // A refusal is an answer, so it ends the job here rather than being retried, and no fault is
  // reported for it (B-21).
  if (refusalCode !== null) {
    await write("refused", lastStep, { refusalCode, detail: { cause: String(failure) } });
    return;
  }
  if (job.attempt <= policy.retryLimit) {
    await write("progress", lastStep, { detail: { cause: String(failure), attemptFailed: job.attempt, willRetry: true } });
    throw failure;
  }
  const { faultId } = reportFault({ requestId: job.jobId, actor: `${kind}:${key}`, route: `job/${kind}`, cause: failure });
  await write("failed", lastStep, { faultId, detail: { cause: String(failure) } });
  throw failure;
}

/**
 * Take the invocation's directory away. A cleanup that fails is an outage of ours and not the
 * job's, so it is reported to the fault seam and the attempt's ending is still recorded — a job
 * that ran must never lose its ending to a directory that would not go (ARCH-03, R-SPINE-030).
 */
async function discard(tempDir: string, job: { jobId: string; kind: JobKind; key: string }): Promise<void> {
  try {
    await rm(tempDir, { recursive: true, force: true });
  } catch (failure) {
    reportFault({ requestId: job.jobId, actor: `${job.kind}:${job.key}`, route: `job/${job.kind}`, cause: failure });
  }
}
