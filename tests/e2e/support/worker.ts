// The journey's own worker (X-1, J-010). The e2e lane's `webServer` starts `next build && next
// start` and nothing else, and playwright.config.ts is locked — so a journey that needs jobs run
// spawns the shipped worker itself, against the same database and the same storage root the served
// product uses, and stops it when it is done.
//
// WHAT ISOLATES ONE PLAYWRIGHT WORKER FROM ANOTHER, AND WHY IT IS NOT A DATABASE (P4b §1)
// ---------------------------------------------------------------------------------------
// The obvious design — one database per Playwright worker, `cubit_e2e_<project>_w<parallelIndex>`,
// made from the migrated template and dropped at teardown — is not one THIS server can serve, and
// the reason is structural rather than a preference:
//
//   * There is exactly ONE served product for the whole run. `playwright.config.ts`'s `webServer` is
//     a single `next start` on a single port, started once, before the first worker exists — and it
//     is handed ONE `DATABASE_URL`, evaluated at config load (`e2eDatabaseUrl()`), long before any
//     `parallelIndex` has a value.
//   * Nothing in the product routes a request to a database: `DATABASE_URL` is read once, by the
//     jobs runtime and by `src/core/db.ts`, out of the process environment (src/core/jobs/runtime.ts).
//     There is no per-request, per-header or per-cookie connection choice to key on, and inventing
//     one would be a production seam grown for the benefit of a test lane (ARCH-02, B-19).
//   * One database per LANE is the same problem one step up: two lanes (`dark`, `light`) share the
//     one server too, so a per-lane database would need a second `next start` on a second port — and
//     the lane holds ONE port by construction (`portFor("e2e")`, ARCH-02).
//
// So the honest unit of isolation here is the TENANT, and it is a real one, not a euphemism:
//
//   * Every row the product writes is tenant-scoped and policed by RLS (SEAM-TENANT), and the
//     journeys reach it as the app role, under those policies — the same grants production runs.
//   * Every stored object lives at `<STORAGE_ROOT>/<tenantId>/<sha256>` (src/core/storage/index.ts),
//     so one storage root holds N workers' rasters without either worker being able to address the
//     other's: the tenant id IS the directory. A per-worker STORAGE_ROOT would isolate nothing that
//     the tenant prefix does not, and would break the one thing this file exists for — the raster
//     this worker draws has to be readable by the SERVER that serves the page, and the server's root
//     was fixed before the worker existed.
//   * A Playwright worker gets its own tenant because it walks its own prologue: `golden-run.ts`
//     signs up a fresh account per LANE AND per `parallelIndex`, so two workers of one lane never
//     share a workspace, a project, a session or a storage prefix. That keying is the fix for P4b §1
//     ("dark/m1-confirm-disciplines and dark/m2-affirm-scale ran concurrently on one tenant and one
//     worker's act satisfied the other's assertion"), and it is asserted in
//     tests/journeys/j-000-worker-isolation.test.ts.
//
// STORAGE_ROOT is therefore passed EXPLICITLY, and to the server's own root rather than to a root of
// this process's choosing: it was previously left unset so that both processes would default to
// `<cwd>/storage`, which was true and invisible. Stating it is what makes the sharing a decision
// somebody can read, and what makes a run under a repointed STORAGE_ROOT still agree with its server.
//
// The shipped worker entry is run directly, with no package-script process interposed: a package
// manager standing between this harness and the worker does not forward SIGTERM to the child, so the
// worker would never hear the stop and never say it had drained. `pnpm worker` is that same entry
// (`tsx src/worker/main.ts`), so nothing about what runs changes — only who receives the signal.
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { join } from "node:path";
import { e2eDatabaseUrl } from "./scratch-db";

/**
 * Where the SERVED product keeps its objects, which is the only root a worker of this lane may
 * write to: `src/core/storage/app.ts` reads `STORAGE_ROOT` or falls back to `<cwd>/storage`, and the
 * server read it before this process existed. Stated here so the two agree by declaration.
 */
export function journeyStorageRoot(): string {
  return process.env["STORAGE_ROOT"] ?? join(process.cwd(), "storage");
}

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
 * Start the shipped worker entry at the checkout root and resolve once it says it is ready. The
 * health port is asked for as `0`, so two journeys running at once never collide on it.
 */
export async function startJourneyWorker(): Promise<JourneyWorker> {
  const said: string[] = [];
  const child: ChildProcessWithoutNullStreams = spawn(process.execPath, ["--import", "tsx", "src/worker/main.ts"], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: e2eDatabaseUrl(), STORAGE_ROOT: journeyStorageRoot(), WORKER_HEALTH_PORT: "0" },
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
