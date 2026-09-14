// The mechanics SEAM-JOBS' acceptance runs on: how the seam is loaded, how a live scratch database
// is staged, how an event log is waited on, and how an SSE answer is read back into frames.
//
// The seam itself is loaded by absolute path rather than by a static specifier, exactly as
// `src/core/storage/storage.test.ts` loads SEAM-STORAGE: a module the product does not provide yet
// must fail as an assertion naming the file, never as an unreadable resolution error that reads as
// a defect in the acceptance instead of a missing feature.
//
// Nothing here imports a driver. The database is provisioned by the tree's own harness
// (`db/__tests__/harness.ts`), which speaks psql and applies the committed migrations — SEAM-JOBS'
// own storage is runtime-managed and is created by `startJobsRuntime`, not by a migration.
import { spawn, type ChildProcessByStdio } from "node:child_process";
import { existsSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { Readable } from "node:stream";
import { fileURLToPath } from "node:url";
import { expect } from "vitest";

/** The checkout this suite judges. `tests/jobs/support/` is three levels below it. */
export const REPO_ROOT: string = resolve(fileURLToPath(new URL("../../../", import.meta.url)));

/** The modules the increment's interface list names, by the path each one is owed at. */
export const JOBS_MODULE = "src/core/jobs/index.ts";
export const EVENTS_ROUTE_MODULE = "src/app/api/events/route.ts";
export const WORKER_ENTRYPOINT = "src/worker/main.ts";
export const TSX_BIN = "node_modules/.bin/tsx";

/** One step of a job's life, as the seam's `JobEvent.status` names them. */
export type JobStatus = "started" | "progress" | "succeeded" | "refused" | "failed";

/** The three statuses that end a job — after one of these the job is over, whatever it did. */
export const TERMINAL_STATUSES: ReadonlySet<string> = new Set<JobStatus>(["succeeded", "refused", "failed"]);

/** The durable per-step record R-SPINE-030 asks for, as the increment's interface list spells it. */
export type JobEvent = {
  jobId: string;
  kind: string;
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

/** One kind's queue policy, read from the seam so acceptance never re-spells it. */
export type JobKindPolicy = {
  concurrency: number;
  retryLimit: number;
  retryDelaySeconds: number;
  retryBackoff: boolean;
};

/** A dead-letter row, as the test contract spells the answer of `deadLetters()`. */
export type DeadLetter = { jobId: string; kind: string; key: string; cause: string };

/** The seam's exported surface (SEAM-JOBS), as the increment's interface list names it. */
export type JobsModule = {
  JOB_KINDS: Readonly<Record<string, JobKindPolicy>>;
  enqueue: (kind: string, payload: unknown, options: { key: string }) => Promise<{ jobId: string; deduplicated: boolean }>;
  jobEvents: (jobId: string) => Promise<JobEvent[]>;
  deadLetters: () => Promise<DeadLetter[]>;
  startJobsRuntime: (databaseUrl: string) => Promise<unknown>;
  stopJobsRuntime: () => Promise<unknown>;
};

/** The route handler /api/events is owed at: a plain fetch handler, no tRPC procedure (out of scope). */
export type EventsRoute = { GET: (request: Request) => Promise<Response> | Response };

/** The database harness this suite stages on — the tree's own, so no second provisioning dialect exists (ARCH-02). */
export type DbHarness = { provisionScratchDb: () => Promise<{ urlMigrate: string; urlApp: string; drop: () => Promise<void> }> };

/** The fault seam (ARCH-03), already in the tree: the sink AC-2 swaps and the record it counts. */
export type FaultsModule = {
  setFaultSink: (next: (record: FaultRecord) => void) => (record: FaultRecord) => void;
};

export type FaultRecord = { faultId: string; requestId: string; actor: string; route: string; cause: string; at: string };

/**
 * Import a product module by repo-relative path, asserting it exists first. A module the Builder has
 * not written yet fails as an AssertionError naming the file — the red the increment is owed —
 * rather than killing collection for the whole file.
 */
export async function productModule<T>(relative: string): Promise<T> {
  const absolute = join(REPO_ROOT, relative);
  expect(existsSync(absolute), `${relative} is missing from the checkout — the product does not provide it yet`).toBe(true);
  return (await import(absolute)) as T;
}

/** Wait until a condition holds, or say what was still true when the budget ran out. */
export async function waitUntil(
  holds: () => boolean | Promise<boolean>,
  what: string,
  budgetMs: number,
  everyMs = 150,
): Promise<void> {
  const deadline = Date.now() + budgetMs;
  for (;;) {
    if (await holds()) return;
    if (Date.now() >= deadline) throw new Error(`waited ${budgetMs}ms and ${what} never happened`);
    await new Promise((r) => setTimeout(r, everyMs));
  }
}

/** Is this the last thing that will ever be said about a job? */
export function isTerminal(event: JobEvent | undefined): boolean {
  return event !== undefined && TERMINAL_STATUSES.has(event.status);
}

/**
 * The job's whole event log, once it has ended. "A job never fails silently" (R-SPINE-030) is what
 * makes this a legitimate wait: every job reaches a terminal event, so a run that times out here is
 * the product failing the clause, and the message says so.
 */
export async function waitForTerminal(jobs: JobsModule, jobId: string, budgetMs: number): Promise<JobEvent[]> {
  let events: JobEvent[] = [];
  await waitUntil(
    async () => {
      events = await jobs.jobEvents(jobId);
      return isTerminal(events.at(-1));
    },
    `job ${jobId} reached a terminal event (its log ended at ${JSON.stringify(events.at(-1)?.status ?? null)})`,
    budgetMs,
  );
  return events;
}

/** The events of one attempt-start, in the order the log holds them. */
export function startsOf(events: readonly JobEvent[]): JobEvent[] {
  return events.filter((event) => event.status === "started");
}

/** Milliseconds since the epoch for an event's ISO `at`, refusing anything that is not a time. */
export function atMs(event: JobEvent): number {
  const ms = Date.parse(event.at);
  expect(Number.isFinite(ms), `event ${event.seq} of job ${event.jobId} carries an unreadable \`at\`: ${String(event.at)}`).toBe(true);
  return ms;
}

/** A port nothing is listening on, taken and given back — never a fixed number two runs could share. */
export async function freePort(): Promise<number> {
  return await new Promise<number>((resolvePort, reject) => {
    const probe = createServer();
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      probe.close(() => (address !== null && typeof address === "object" ? resolvePort(address.port) : reject(new Error("no port was offered"))));
    });
  });
}

/** A worker process under test: its output so far, and the ways to wait on it and end it. */
export type WorkerProcess = {
  child: ChildProcessByStdio<null, Readable, Readable>;
  output: () => string;
  waitForLine: (line: string, budgetMs: number) => Promise<void>;
  exited: () => Promise<number | null>;
  kill: (signal: NodeJS.Signals) => void;
};

/**
 * The worker as R-SPINE-031 describes it: a separate OS process running the same codebase, told
 * where its database and its health port are through the environment. `tsx` is spawned directly
 * because package.json's scripts block is not this increment's to edit; the Builder raises the
 * `pnpm worker` spelling as an Objection.
 */
export function spawnWorker(databaseUrl: string, healthPort: number, extraEnv: Record<string, string> = {}): WorkerProcess {
  for (const needed of [WORKER_ENTRYPOINT, TSX_BIN]) {
    expect(existsSync(join(REPO_ROOT, needed)), `${needed} is missing from the checkout — the worker R-SPINE-031 names cannot be spawned`).toBe(true);
  }
  const child = spawn(join(REPO_ROOT, TSX_BIN), [WORKER_ENTRYPOINT], {
    cwd: REPO_ROOT,
    env: { ...process.env, DATABASE_URL: databaseUrl, WORKER_HEALTH_PORT: String(healthPort), ...extraEnv },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let seen = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk: string) => (seen += chunk));
  child.stderr.on("data", (chunk: string) => (seen += chunk));

  let exitCode: number | null = null;
  let exited = false;
  const ended = new Promise<number | null>((resolveExit) => {
    child.on("exit", (code) => {
      exitCode = code;
      exited = true;
      resolveExit(code);
    });
  });

  return {
    child,
    output: () => seen,
    waitForLine: async (line, budgetMs) =>
      await waitUntil(
        () => seen.includes(line) || exited,
        `the worker printed ${JSON.stringify(line)} (it has said: ${JSON.stringify(seen.slice(-600))})`,
        budgetMs,
      ).then(() => {
        expect(seen, `the worker exited before printing ${JSON.stringify(line)} — it said: ${seen.slice(-600)}`).toContain(line);
      }),
    exited: async () => {
      await ended;
      return exitCode;
    },
    kill: (signal) => {
      if (!exited) child.kill(signal);
    },
  };
}

/** One frame of an event stream: its `event:` name and the `data:` payload beneath it. */
export type SseFrame = { event: string; data: string };

/**
 * Read an SSE answer to its end. `closed` records whether the product closed the stream itself —
 * the interface list says the stream "closes after the terminal event", so a stream this reader had
 * to cancel is a different answer from one that ended.
 */
export async function readEventStream(response: Response, budgetMs: number): Promise<{ frames: SseFrame[]; closed: boolean; raw: string }> {
  const body = response.body;
  expect(body, "the /api/events answer carried no body to read frames from").not.toBeNull();
  const reader = body!.getReader();
  const decoder = new TextDecoder();
  const deadline = Date.now() + budgetMs;
  let raw = "";
  let closed = false;
  for (;;) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    let timer: NodeJS.Timeout | undefined;
    const step = await Promise.race([
      reader.read(),
      new Promise<"timed out">((resolveRace) => {
        timer = setTimeout(() => resolveRace("timed out"), remaining);
      }),
    ]);
    if (timer !== undefined) clearTimeout(timer);
    if (step === "timed out") break;
    if (step.done) {
      closed = true;
      break;
    }
    raw += decoder.decode(step.value, { stream: true });
  }
  if (!closed) await reader.cancel().catch(() => undefined);
  return { frames: parseSseFrames(raw), closed, raw };
}

/**
 * Frames out of the wire text, by the event-stream grammar: blocks separated by a blank line, each
 * line a `field: value`. Comment lines (`:` keep-alives) and unnamed fields are ignored rather than
 * refused — a heartbeat is lawful and says nothing about the job.
 */
export function parseSseFrames(raw: string): SseFrame[] {
  const frames: SseFrame[] = [];
  for (const block of raw.split(/\r?\n\r?\n/)) {
    let event = "";
    const data: string[] = [];
    for (const line of block.split(/\r?\n/)) {
      if (line === "" || line.startsWith(":")) continue;
      const colon = line.indexOf(":");
      const field = colon === -1 ? line : line.slice(0, colon);
      const value = colon === -1 ? "" : line.slice(colon + 1).replace(/^ /, "");
      if (field === "event") event = value;
      if (field === "data") data.push(value);
    }
    if (event !== "" || data.length > 0) frames.push({ event, data: data.join("\n") });
  }
  return frames;
}

/** The `event: job` frames of an answer, parsed back into the events the seam recorded. */
export function jobFrames(frames: readonly SseFrame[]): JobEvent[] {
  return frames
    .filter((frame) => frame.event === "job")
    .map((frame) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(frame.data);
      } catch {
        throw new Error(`an \`event: job\` frame carried data that is not JSON: ${frame.data.slice(0, 200)}`);
      }
      return parsed as JobEvent;
    });
}

/** The identity of an event, for comparing two readings of the same log without pinning either shape. */
export function eventIdentity(event: JobEvent): string {
  return JSON.stringify([event.jobId, event.seq, event.step, event.status, event.attempt, event.refusalCode, event.at]);
}

/** A key no other run can collide with, so a database reused across runs still isolates this one. */
export function uniqueKey(label: string): string {
  return `${label}-${process.pid.toString(36)}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** What one polling-transport answer said about a job: its log, and whether the job has ended. */
export type PollSnapshot = { events: JobEvent[]; done: boolean };

/**
 * Poll a job to its end through the polling transport, judging every snapshot against its OWN
 * events: while a snapshot's log has not reached a terminal event, that snapshot is not done.
 *
 * Reading `done` and the events out of one answer is what makes this fair — the job finishing
 * between two readings can never turn a correct answer into a failure. `unfinished` counts the
 * snapshots taken while the job was still queued-or-active, so a caller can insist the
 * not-yet-done case was actually reached: a `done` that is a constant rather than an answer about
 * the log cannot survive being asked before the job ends.
 */
export async function pollToFinished(
  poll: (jobId: string) => Promise<Response>,
  jobId: string,
  budgetMs: number,
  everyMs = 100,
): Promise<{ unfinished: number; last: PollSnapshot }> {
  let unfinished = 0;
  let last: PollSnapshot = { events: [], done: false };
  await waitUntil(
    async () => {
      const answer = await poll(jobId);
      expect(answer.status, "the poll fallback answers 200 while the job is still running too").toBe(200);
      last = (await answer.json()) as PollSnapshot;
      if (isTerminal(last.events.at(-1))) return true;
      unfinished += 1;
      expect(
        last.done,
        `a poll snapshot of job ${jobId} whose last event is ${JSON.stringify(last.events.at(-1)?.status ?? null)} has not reached a terminal event, so it is not done`,
      ).toBe(false);
      return false;
    },
    `the poll transport reported job ${jobId} as finished`,
    budgetMs,
    everyMs,
  );
  return { unfinished, last };
}

/** One kind's policy, read from the seam — acceptance never transcribes a limit of its own (B-19). */
export function policyFor(jobs: JobsModule, kind: string): JobKindPolicy {
  const policy = jobs.JOB_KINDS[kind];
  expect(policy, `JOB_KINDS must carry \`${kind}\`, the kind the spec builds in`).toBeDefined();
  for (const field of ["concurrency", "retryLimit", "retryDelaySeconds"] as const) {
    expect(typeof policy?.[field], `JOB_KINDS.${kind}.${field} must be a number acceptance can read`).toBe("number");
  }
  return policy as JobKindPolicy;
}

/**
 * Every slot one runtime has for a kind, taken by jobs of that kind — the way a test proves that
 * something OTHER than the calling process ran a job.
 *
 * `slots` is `JOB_KINDS[kind].concurrency`, read from the seam rather than transcribed: a kind whose
 * limit is raised later fills more slots instead of reddening the proof (B-19).
 */
export type Blockade = { jobIds: string[]; kind: string; slots: number; /** the file whose existence lets every hold go (`releaseHolds` writes it) */ release: string };

/** A step delay long enough to read in a log, short enough that a long hold is just many steps. */
export const HOLD_STEP_MS = 2000;

/**
 * Fill every slot the CALLING process's runtime has for a kind, and wait until it is demonstrably
 * full — each holding job has an attempt of its own under way.
 *
 * This must be done while the calling process is the ONLY consumer in existence (before any worker
 * is spawned), so the slots it takes are demonstrably its own. R-SPINE-030's concurrency limit then
 * says the calling process cannot start anything else of that kind: whatever runs the next job
 * enqueued is somewhere else. `stepCount` sets how long the hold lasts — at least
 * `(stepCount - 1) * HOLD_STEP_MS`, whether the seam waits before each step or between them.
 */
export async function holdEveryLocalSlot(jobs: JobsModule, kind: string, label: string, stepCount: number): Promise<Blockade> {
  const policy = policyFor(jobs, kind);
  const steps = Array.from({ length: stepCount }, (_unused, index) => `hold-${index}`);
  // The holds let go the moment this file exists (`releaseHolds`), so a proof that took seconds is
  // not followed by a wait of `stepCount × HOLD_STEP_MS` for holds nobody needs any more.
  const release = join(tmpdir(), `cubit-hold-${label}-${process.pid}-${Date.now().toString(36)}`);
  const jobIds: string[] = [];
  for (let slot = 0; slot < policy.concurrency; slot += 1) {
    const { jobId } = await jobs.enqueue(kind, { steps, stepDelayMs: HOLD_STEP_MS, releaseWhen: release }, { key: uniqueKey(`${label}-hold-${slot}`) });
    jobIds.push(jobId);
  }
  await waitUntil(
    async () => {
      for (const jobId of jobIds) if (startsOf(await jobs.jobEvents(jobId)).length === 0) return false;
      return true;
    },
    `all ${policy.concurrency} of the calling runtime's \`${kind}\` slots were taken (JOB_KINDS.${kind}.concurrency)`,
    180_000,
  );
  return { jobIds, kind, slots: policy.concurrency, release };
}

/**
 * How many of those slots were still occupied at one instant, read from the holds' own event logs: a
 * hold occupies a slot from its attempt's `started` until its terminal event, and a hold that has
 * not ended yet is still holding.
 */
export async function slotsHeldAt(jobs: JobsModule, blockade: Blockade, instantMs: number): Promise<number> {
  let held = 0;
  for (const jobId of blockade.jobIds) {
    const events = await jobs.jobEvents(jobId);
    const start = startsOf(events)[0];
    const last = events.at(-1);
    if (start === undefined || last === undefined) continue;
    const until = isTerminal(last) ? atMs(last) : Number.POSITIVE_INFINITY;
    if (atMs(start) <= instantMs && instantMs <= until) held += 1;
  }
  return held;
}

/** Let the holds go and wait for them to end, so nothing of ours is still in flight when the runtime is stopped. */
export async function releaseHolds(jobs: JobsModule, blockade: Blockade, budgetMs: number): Promise<void> {
  writeFileSync(blockade.release, "released\n");
  try {
    for (const jobId of blockade.jobIds) await waitForTerminal(jobs, jobId, budgetMs);
  } finally {
    rmSync(blockade.release, { force: true });
  }
}
