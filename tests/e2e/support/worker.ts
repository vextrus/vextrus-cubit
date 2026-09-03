// The journey's own worker (X-1, J-010). The e2e lane's `webServer` starts `next build && next
// start` and nothing else, and playwright.config.ts is locked — so a journey that needs jobs run
// spawns the shipped worker itself, against the same database and the same storage root the served
// product uses, and stops it when it is done.
//
// STORAGE_ROOT is deliberately left unset: both processes then default to `<cwd>/storage`, which is
// what makes a raster the worker drew readable by the page that serves it.
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { e2eDatabaseUrl } from "./scratch-db";

/** The lines the worker prints at either end of its life (src/worker/main.ts's own contract). */
const READY = "worker: ready";
const SHUTDOWN = "worker: shutdown complete";

/** How long the worker may take to say it is ready, and to drain when it is asked to stop. */
const READY_BUDGET_MS = 60_000;
const SHUTDOWN_BUDGET_MS = 30_000;

/** A running worker, and the way to stop it. */
export interface JourneyWorker {
  /** Everything the worker has said so far — attached to a failure, so a stall is readable. */
  output: () => string;
  stop: () => Promise<void>;
}

/**
 * Start `pnpm worker` at the checkout root and resolve once it says it is ready. The health port is
 * asked for as `0`, so two journeys running at once never collide on it.
 */
export async function startJourneyWorker(): Promise<JourneyWorker> {
  const said: string[] = [];
  const child: ChildProcessWithoutNullStreams = spawn("pnpm", ["worker"], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: e2eDatabaseUrl(), WORKER_HEALTH_PORT: "0" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk: string) => said.push(chunk));
  child.stderr.on("data", (chunk: string) => said.push(chunk));

  const output = (): string => said.join("");
  const waitFor = async (line: string, budgetMs: number, what: string): Promise<void> => {
    const startedAt = Date.now();
    while (!output().includes(line)) {
      if (child.exitCode !== null) throw new Error(`the journey's worker exited with ${child.exitCode} ${what}:\n${output().slice(-1500)}`);
      if (Date.now() - startedAt > budgetMs) throw new Error(`the journey's worker never said "${line}" ${what}:\n${output().slice(-1500)}`);
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  };

  await waitFor(READY, READY_BUDGET_MS, "while starting");

  return {
    output,
    stop: async (): Promise<void> => {
      if (child.exitCode !== null) return;
      child.kill("SIGTERM");
      try {
        await waitFor(SHUTDOWN, SHUTDOWN_BUDGET_MS, "while draining");
      } finally {
        if (child.exitCode === null) child.kill("SIGKILL");
      }
    },
  };
}
