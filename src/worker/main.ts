// `pnpm worker`: the process R-SPINE-031 asks for — separate from the web tier, running the same
// codebase, told where its database and its health port are through the environment. Everything it
// does is in `runtime.ts`; this file is the process around it: the environment it reads, the three
// contract lines an operator (and a supervisor) reads its life off, and the signal that drains it.
import { envErrorOf, envUnusableOf, validateEnv } from "../core/env";
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

/** The tier this process boots, as the environment declaration names it (src/core/env.ts). */
const TIER = "worker";

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

/**
 * Start the worker, promise to be up, and wait for the signal that ends it.
 *
 * The whole environment declaration is read once, here, before anything is dialled: a worker whose
 * machine did not give it what IT requires refuses to start and says which name, rather than coming
 * up and failing on the first job it takes.
 */
async function main(): Promise<void> {
  const verdict = validateEnv(TIER);
  if (!verdict.ok) throw envErrorOf(TIER, verdict);
  // A name this process does not require, stated unusably, belongs in the operator's record but
  // stops nothing here: whichever seam reads it keeps its own default (ARCH-03).
  if (verdict.invalid.length > 0) {
    reportFault({ requestId: process.pid.toString(), actor: "worker", route: WORKER_ROUTE, cause: envUnusableOf(TIER, verdict.invalid) });
  }
  const worker = await runWorker({ databaseUrl: verdict.env.DATABASE_URL, healthPort: verdict.env.WORKER_HEALTH_PORT });
  drainOn(worker);
  await say(READY);
}

main().catch((failure: unknown) => {
  // A worker that cannot start has failed server-side with nothing to refuse: the fault seam
  // records it, and the exit code tells the supervisor (ARCH-03, B-21).
  const { faultId } = reportFault({ requestId: process.pid.toString(), actor: "worker", route: WORKER_ROUTE, cause: failure });
  process.stdout.write(`worker: failed to start (fault ${faultId})\n`, () => process.exit(1));
});
