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
import { existsSync } from "node:fs";
import { createServer } from "node:net";
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
