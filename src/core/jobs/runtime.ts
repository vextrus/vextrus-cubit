// SEAM-JOBS: the queue as the tree speaks to it (R-SPINE-030, R-SPINE-031).
//
// One runtime per process. Starting it opens the store, declares every kind's queue and — because a
// queue nothing consumes is a queue that never answers — subscribes this process to each of them.
// A process that only enqueues or only reads the log gets the same runtime without consumers, so
// importing the seam still costs no connection at all.
//
// The durable per-step log is the whole of "a job never fails silently": every attempt records its
// start, its steps and how it ended, and a terminal failure that is not a refusal carries the fault
// id the fault seam recorded for it (ARCH-03, B-21). A refusal carries its registered code and no
// fault id, because a refusal is an answer.
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { jobsStore, type JobEventRow, type JobsStore, type QueuedJob } from "../db";
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

/** What one job carries through the queue: its key, so every event can name it, and its payload. */
type Envelope = { key: string; payload: unknown };

/** The one runtime this process has. */
type Runtime = {
  url: string;
  store: JobsStore;
  consumers: boolean;
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

/** Open a runtime against one database, with or without taking work off its queues. */
async function openRuntime(url: string, consumers: boolean): Promise<Runtime> {
  const store = jobsStore(url);
  const running: Runtime = { url, store, consumers, watchers: new Map() };
  await store.open();
  for (const kind of KIND_NAMES) await store.declareQueue(kind, JOB_KINDS[kind]);
  await store.listen((jobId) => {
    for (const wake of running.watchers.get(jobId) ?? []) wake();
  });
  if (consumers) {
    for (const kind of KIND_NAMES) await store.consume(kind, JOB_KINDS[kind], (job) => perform(running, kind, job));
  }
  return running;
}

/** The runtime this process has, opening a consumer-free one against DATABASE_URL if it has none. */
async function runtime(): Promise<Runtime> {
  const current = holder.current;
  if (current !== undefined) return await current;
  const opening = openRuntime(configuredUrl(), false);
  holder.current = opening;
  return await opening;
}

/**
 * Start the runtime that runs the registered kinds in this process — what `pnpm worker` runs, and
 * what a test that wants a job to actually happen starts (R-SPINE-031).
 */
export async function startJobsRuntime(databaseUrl: string): Promise<void> {
  const current = holder.current;
  if (current !== undefined) {
    const running = await current;
    if (running.url === databaseUrl && running.consumers) return;
    await stopJobsRuntime();
  }
  const opening = openRuntime(databaseUrl, true);
  holder.current = opening;
  await opening;
}

/** Stop consuming, let what is in flight finish, and give the connections back (R-SPINE-031). */
export async function stopJobsRuntime(): Promise<void> {
  const current = holder.current;
  holder.current = undefined;
  if (current === undefined) return;
  const running = await current;
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
  const running = await runtime();
  const policy = JOB_KINDS[kind];
  return await running.store.withKeyLock(kind, options.key, async () => {
    const live = await running.store.liveJobFor(kind, options.key, [...TERMINAL_STATUSES]);
    if (live !== null) return { jobId: live, deduplicated: true };
    const envelope: Envelope = { key: options.key, payload };
    const jobId = await running.store.publish(kind, { ...envelope }, policy);
    await running.store.claimKey(kind, options.key, jobId);
    return { jobId, deduplicated: false };
  });
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
  const rows = await running.store.deadLetterRows(["failed", "refused"]);
  return rows.map((row) => ({
    jobId: row.jobId,
    kind: row.kind as JobKind,
    key: row.key,
    cause: causeOf(row),
  }));
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
    for (const row of await running.store.read(jobId, lastSeq)) {
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

  const write = async (status: JobStatus, step: string, extra: Partial<JobEventRow> = {}): Promise<void> => {
    await running.store.append({
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
