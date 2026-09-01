// The worker as a library (R-SPINE-031): the same codebase the web tier runs, started in a process
// of its own, taking work off every queue the seam registers and answering a health probe while it
// does. `main.ts` is only the process around this — the environment it reads and the signals it
// listens for — so a test can run the worker in-process and an operator can run it as a service
// without two different workers existing (ARCH-02).
import { createServer, type Server } from "node:http";
import { jobsHealth, startJobsRuntime, stopJobsRuntime } from "../core/jobs";

/** Where the health probe answers, and where nothing else does. */
const HEALTH_PATH = "/health";

/** The loopback interface only: a worker's health is the host's business, never the network's. */
const HEALTH_HOST = "127.0.0.1";

/** How long a health connection may stay open before the drain stops waiting for it. */
const HEALTH_CLOSE_MS = 2000;

/** A running worker: the only thing to do with one is to stop it, and stopping it drains. */
export type Worker = {
  /** The port the health endpoint is really listening on — the one asked for, or the one taken. */
  readonly healthPort: number;
  stop(): Promise<void>;
};

/** What a worker is told when it starts: which database, and where to answer about its health. */
export type WorkerOptions = { databaseUrl: string; healthPort: number };

/** What the health probe answers: whether the worker is really working, and on which kinds. */
export type WorkerHealth = { ok: boolean; queues: string[] };

/**
 * Start the queues and the health endpoint, in that order: a worker that answers "ok" before it is
 * consuming anything is telling the operator something untrue, so the endpoint only exists once the
 * runtime does.
 */
export async function runWorker(options: WorkerOptions): Promise<Worker> {
  await startJobsRuntime(options.databaseUrl);
  let health: Server;
  try {
    health = await listenForHealth(options.healthPort);
  } catch (failure) {
    // Nothing is consuming yet that anyone knows about, so the runtime is given back before the
    // failure travels on to the caller, who is the one that answers for it.
    await stopJobsRuntime();
    throw failure;
  }

  return {
    healthPort: portOf(health, options.healthPort),
    stop: async () => {
      await closeHealth(health);
      // The drain: the queue stops taking new work and waits for what it already took to finish
      // before the connections are given back (R-SPINE-031).
      await stopJobsRuntime();
    },
  };
}

/**
 * What this worker is really serving, asked of the seam rather than declared here. A probe exists so
 * a supervisor can take a worker that has stopped working out of rotation, so the answer has to be
 * capable of saying no: a runtime that is draining, or whose database has gone away, answers
 * `ok: false` and 503, and nothing about the declared roster can dress that up (R-SPINE-031).
 */
export async function servedQueues(): Promise<WorkerHealth> {
  return await jobsHealth();
}

/** The health endpoint, listening, or a rejection naming why it could not. */
function listenForHealth(port: number): Promise<Server> {
  const server = createServer((request, response) => {
    const path = (request.url ?? "").split("?")[0];
    if (request.method !== "GET" || path !== HEALTH_PATH) {
      response.writeHead(404, { "content-type": "application/json" });
      response.end(JSON.stringify({ ok: false }));
      return;
    }
    void (async () => {
      const answer: WorkerHealth = await servedQueues();
      response.writeHead(answer.ok ? 200 : 503, { "content-type": "application/json", "cache-control": "no-store" });
      response.end(JSON.stringify(answer));
    })();
  });
  return new Promise((settle, fail) => {
    server.once("error", fail);
    server.listen(port, HEALTH_HOST, () => {
      server.removeListener("error", fail);
      settle(server);
    });
  });
}

/** The port the server actually took, falling back to the one it was asked for. */
function portOf(server: Server, asked: number): number {
  const address = server.address();
  return address !== null && typeof address === "object" ? address.port : asked;
}

/**
 * Stop answering health probes. A keep-alive connection a probe left open must not hold the drain
 * open with it, so idle sockets are ended and the wait is bounded either way.
 */
function closeHealth(server: Server): Promise<void> {
  return new Promise((settle) => {
    const timer = setTimeout(settle, HEALTH_CLOSE_MS);
    timer.unref();
    server.closeIdleConnections();
    server.close(() => {
      clearTimeout(timer);
      settle();
    });
  });
}
