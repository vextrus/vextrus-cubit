// `pnpm worker`: the process R-SPINE-031 asks for — separate from the web tier, running the same
// codebase, told where its database and its health port are through the environment. Everything it
// does is in `runtime.ts`; this file is the process around it: the environment it reads, the three
// contract lines an operator (and a supervisor) reads its life off, and the signal that drains it.
import { reportFault } from "../core/faults/report";
import { runWorker, type Worker } from "./runtime";

/** The lines this process promises to print, in the order its life takes them. */
const READY = "worker: ready";
const DRAINING = "worker: draining";
const SHUTDOWN = "worker: shutdown complete";

/** The signals a supervisor ends a worker with; both mean "drain and go". */
const STOP_SIGNALS: readonly NodeJS.Signals[] = ["SIGTERM", "SIGINT"];

/** How the process names itself when a fault of its own is recorded (ARCH-03). */
const WORKER_ROUTE = "worker/main";

/**
 * One contract line, written and flushed. stdout to a pipe is asynchronous, so a process that exits
 * without waiting for the write can truncate the very line a supervisor is reading it by.
 */
function say(line: string): Promise<void> {
  return new Promise((settle) => process.stdout.write(`${line}\n`, () => settle()));
}

/** A required environment value, or a failure naming the variable that is missing. */
function required(name: string): string {
  const value = process.env[name]?.trim();
  if (value === undefined || value === "") {
    throw new Error(`${name} is not set — the worker has no ${name === "DATABASE_URL" ? "database" : "health port"} to bind (R-SPINE-031)`);
  }
  return value;
}

/** The health port as a port number, refusing anything that is not one. */
function healthPort(): number {
  const raw = required("WORKER_HEALTH_PORT");
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 0 || port > 65_535) {
    throw new Error(`WORKER_HEALTH_PORT is not a port number: ${JSON.stringify(raw)} (R-SPINE-031)`);
  }
  return port;
}

/**
 * Drain once, however many signals arrive. The graceful shutdown lets the work already taken off
 * the queue finish before the connections go back, and only then is the process over — so the last
 * line is written before the exit, not raced by it.
 */
function drainOn(worker: Worker): void {
  let draining = false;
  const drain = (): void => {
    if (draining) return;
    draining = true;
    void (async () => {
      await say(DRAINING);
      try {
        await worker.stop();
      } catch (failure) {
        // A drain that fails is still an outage the operator owns, and the process still ends —
        // but it ends having said so, never silently (ARCH-03).
        reportFault({ requestId: process.pid.toString(), actor: "worker", route: WORKER_ROUTE, cause: failure });
      }
      await say(SHUTDOWN);
      process.exit(0);
    })();
  };
  for (const signal of STOP_SIGNALS) process.on(signal, drain);
}

/** Start the worker, promise to be up, and wait for the signal that ends it. */
async function main(): Promise<void> {
  const worker = await runWorker({ databaseUrl: required("DATABASE_URL"), healthPort: healthPort() });
  drainOn(worker);
  await say(READY);
}

main().catch((failure: unknown) => {
  // A worker that cannot start has failed server-side with nothing to refuse: the fault seam
  // records it, and the exit code tells the supervisor (ARCH-03, B-21).
  const { faultId } = reportFault({ requestId: process.pid.toString(), actor: "worker", route: WORKER_ROUTE, cause: failure });
  process.stdout.write(`worker: failed to start (fault ${faultId})\n`, () => process.exit(1));
});
