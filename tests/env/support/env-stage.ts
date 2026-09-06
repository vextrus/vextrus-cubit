/**
 * The mechanics the environment declaration's public acceptance runs on (AC-1, AC-2).
 *
 * Mechanics only — nothing here judges the product. Every name below is one the increment's
 * interface list or its test contract publishes: the module path, the exported names, the seven
 * environment names, the worker's stdout contract lines and the fault record's fields. No product
 * source is read.
 *
 * `src/core/env.ts` is loaded by a path composed at run time rather than by a static import, so a
 * module the Builder has not written yet fails as an assertion naming the file — the red the gate
 * asks for — instead of as a collection death or a compile error in the acceptance itself.
 */
import { spawn, type SpawnOptionsWithStdioTuple, type StdioNull, type StdioPipe } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { expect } from "vitest";

/** The checkout this lane drives — the unit lane runs at the root of it. */
export const REPO_ROOT: string = process.cwd();

/** The homes the increment's interface list and test contract name. */
export const ENV_MODULE = "src/core/env.ts";
export const WORKER_ENTRYPOINT = "src/worker/main.ts";
export const TSX_BIN = join("node_modules", ".bin", "tsx");

/** The tiers the declaration speaks of (C-05). */
export type Tier = "web" | "worker";

/** The route the worker records its own outages under (C-05, ARCH-03). */
export const WORKER_ROUTE = "worker/main";

/** The worker's stdout contract lines (C-05). Only the two a refused boot can reach are read here. */
export const READY_LINE = "worker: ready";
export const FAILED_TO_START = /^worker: failed to start \(fault ([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})\)$/;

/** A zod schema, read through the one method the acceptance needs of it. */
export interface ShapeLike {
  safeParse: (value: unknown) => { success: boolean };
}

/** One declared name, as `interfaces` fixes it. */
export interface EnvEntry {
  name: string;
  shape: ShapeLike;
  requiredBy: readonly Tier[];
  requiredOutsideDev: boolean;
}

/** What `validateEnv` answers: a verdict, never a throw. */
export type EnvVerdict = { ok: true; env: Readonly<Record<string, unknown>> } | { ok: false; missing: readonly string[]; invalid: readonly string[] };

/** The declaration module, through the names the test contract publishes. */
export interface EnvModule {
  ENV_NAMES: readonly string[];
  ENV_DECLARATION: readonly EnvEntry[];
  validateEnv: (tier: Tier, source?: Readonly<Record<string, string | undefined>>) => EnvVerdict;
}

/** The fault record the seam writes, as an operator reads it off stderr (C-05, ARCH-03). */
export interface FaultRecord {
  faultId: string;
  requestId: string;
  actor: string;
  route: string;
  cause: string;
  at: string;
}

export function repoPath(relative: string): string {
  return join(REPO_ROOT, relative);
}

/** The one home for the environment, asserted to exist before it is loaded. */
export async function envModule(): Promise<EnvModule> {
  const home = repoPath(ENV_MODULE);
  expect(existsSync(home), `${ENV_MODULE} is missing from the checkout — the product has no one home for the environment it reads`).toBe(true);
  const loaded: unknown = await import(home);
  return loaded as EnvModule;
}

/** The names the declaration says the given tier cannot start without. */
export function requiredBy(declaration: readonly EnvEntry[], tier: Tier): string[] {
  return declaration.filter((entry) => entry.requiredBy.includes(tier)).map((entry) => entry.name);
}

/**
 * A value each declared name accepts. Every literal here is one the increment states publicly — the
 * URL and port AC-1 spells, and the loopback origin C-07 names — and it exists so a case that
 * removes ONE name can present every other one as present and well formed.
 */
export const SAMPLE_VALUES: Readonly<Record<string, string>> = {
  DATABASE_URL: "postgres://u@h/db",
  STORAGE_ROOT: "/tmp/cubit-env-acceptance-storage",
  CUBIT_PUBLIC_ORIGIN: "http://127.0.0.1:3210",
  WORKER_HEALTH_PORT: "0",
  CUBIT_MODEL_FIXTURE_ROOT: "/tmp/cubit-env-acceptance-fixtures",
  CUBIT_STORAGE_SIGNING_SECRET: "an-acceptance-signing-secret",
  CUBIT_CAD_COMMAND: "/bin/true",
};

/** A well-formed value for a declared name, or a red naming the name that has none. */
export function sampleFor(name: string): string {
  const sample = SAMPLE_VALUES[name];
  expect(sample, `${name} is declared but this acceptance holds no well-formed sample value for it`).toBeDefined();
  return sample ?? "";
}

/** How one spawned worker ended, and everything it said. */
export interface WorkerRun {
  code: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

/** How long a worker that refuses to start is given to say so and go. */
const BOOT_BUDGET_MS = 45_000;

/**
 * Spawn the worker R-SPINE-031 names, in an environment built by hand: a copy of this process's,
 * with every declared name removed, and then exactly `stated` put back. Nothing is inherited that
 * the case did not ask for, so what the worker refuses on is what the case set — or left out.
 */
export function spawnWorker(cleared: readonly string[], stated: Readonly<Record<string, string>>): Promise<WorkerRun> {
  for (const needed of [WORKER_ENTRYPOINT, TSX_BIN]) {
    expect(existsSync(repoPath(needed)), `${needed} is missing from the checkout — the worker cannot be spawned`).toBe(true);
  }
  const environment: NodeJS.ProcessEnv = { ...process.env };
  for (const name of cleared) delete environment[name];
  for (const [name, value] of Object.entries(stated)) environment[name] = value;

  return new Promise<WorkerRun>((settle) => {
    const options: SpawnOptionsWithStdioTuple<StdioNull, StdioPipe, StdioPipe> = { cwd: REPO_ROOT, env: environment, stdio: ["ignore", "pipe", "pipe"] };
    const child = spawn(repoPath(TSX_BIN), [WORKER_ENTRYPOINT], options);
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => (stdout += chunk));
    child.stderr.on("data", (chunk: string) => (stderr += chunk));
    // A worker that starts anyway would otherwise run until the lane's own timeout, and a suite that
    // dies on the clock judges nothing: it is ended inside the budget and the run says so.
    const watchdog = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, BOOT_BUDGET_MS);
    child.on("close", (code, signal) => {
      clearTimeout(watchdog);
      settle({ code, signal, stdout, stderr, timedOut });
    });
  });
}

/** Everything the worker wrote on stdout, line by line, blank lines dropped. */
export function stdoutLines(run: WorkerRun): string[] {
  return run.stdout.split("\n").filter((line) => line.trim() !== "");
}

/** The fault records on stderr: one JSON object per line, anything else (a runtime warning) ignored. */
export function faultRecords(run: WorkerRun): FaultRecord[] {
  const records: FaultRecord[] = [];
  for (const line of run.stderr.split("\n")) {
    const text = line.trim();
    if (!text.startsWith("{")) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(text) as unknown;
    } catch {
      continue; // not a record — the operator's stream carries other people's lines too
    }
    const record = parsed as Partial<FaultRecord>;
    if (typeof record.route === "string" && typeof record.faultId === "string") records.push(record as FaultRecord);
  }
  return records;
}

/** What a run said, for a failure message that shows the whole picture rather than one assert. */
export function transcript(run: WorkerRun): string {
  return `exit=${String(run.code)} signal=${String(run.signal)} timedOut=${String(run.timedOut)}\n--- stdout\n${run.stdout}\n--- stderr\n${run.stderr}`;
}
