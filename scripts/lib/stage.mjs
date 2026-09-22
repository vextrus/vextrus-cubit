// THE SERVED STAGE — one home for serving the built product outside a lane (ARCH-02). Two callers
// serve it: the probe (`pnpm probe:server`, on the journeys' port) and the demo (`pnpm demo`, on its
// own port), each with the shipped worker beside it. Both serve the SAME built product the journeys
// walk (`scripts/e2e-server.mjs`, `build-if-stale start`), on the journeys' own database and roots;
// what differs is named in a `StageSpec`, never in a second copy of the spawn.
//
// WHY TWO RECORDS, AND WHY A PID IS CHECKED BEFORE IT IS KILLED. The probe wrote its pids to
// `scripts/probe/server.pids` and `--stop` killed whatever numbers that file held. With a second
// stage beside it, a shared file would let `pnpm probe:server --stop` take the owner's demo down (or
// `pnpm demo --stop` a session's probe), and a pid recorded yesterday may name somebody else's
// process today. So each stage keeps its own record, the record says which stage wrote it, and a
// recorded pid is signalled only while `/proc/<pid>/cmdline` still shows the stage's own script.
//
// THE WORKER TAKES EVERY TENANT'S JOBS. The shipped worker takes work off every queue in the
// database it is given, for every tenant — and every stage here is given `cubit_e2e`, the journeys'
// own. So a worker standing beside a journey run would take that journey's measure or ingest jobs
// and run them with this stage's code. The probe shares the journeys' port and so can never stand
// beside them; the demo has a port of its own, and runs its worker anyway (the orchestrator's
// session-7 ruling: a demo whose Measure and "Draft the bill" doors hang is worse), so no journey
// may run while a demo stands (docs/demo.md), and `pnpm demo` refuses to start beside one.
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { e2eDatabaseUrl } from "./pg-database.mjs";
import { originFor, portFor } from "./ports.mjs";

const ROOT = resolve(fileURLToPath(new URL("../../", import.meta.url)));

/** The key a stage signs its download URLs with. The journeys' stage's own (playwright.config.ts), not a secret. */
const STAGE_SIGNING_KEY = "the-journeys-stage-signing-key";

/** How long a stage may take to answer: a cold `next build` of this tree is under two minutes. */
export const READY_BUDGET_MS = 300_000;

/** How long the worker may take to say it is ready (tests/e2e/support/worker.ts reads it the same way). */
const WORKER_READY_BUDGET_MS = 60_000;

/** The line the shipped worker prints once it is consuming (src/worker/main.ts's contract). */
const WORKER_READY = "worker: ready";

/** @typedef {"server" | "worker"} StageRole */

/**
 * What one stage is: its name (written into its record), which served port it takes, whether the
 * shipped worker runs beside it, whether the evidence instrument (`?__theme=`, `?__state=`) is armed,
 * and where its record and logs live.
 * @typedef {{ name: string, which: "e2e" | "demo", worker: boolean, instrument: boolean, record: string, logs: { server: string, worker: string } }} StageSpec
 */

/**
 * What a stage wrote when it started: who it is, the port it took, and each process by role.
 * `root` is the checkout that started it: an agent's worktree reaches the main checkout's
 * `node_modules` through a symlink, so a record kept under `node_modules/.cache` is one file for every
 * such checkout, and only the root tells one checkout's stage from another's.
 * @typedef {{ stage: string, root: string, port: number, startedAt: string, processes: { role: StageRole | "unknown", pid: number }[] }} StageRecord
 */

/**
 * How a stage starts a process — `child_process.spawn`, narrowed to what a stage uses of what it gets
 * back, so a suite can hand it a stand-in.
 * @typedef {(command: string, args: string[], options: import("node:child_process").SpawnOptions) => { pid?: number | undefined, on: (event: "exit", listener: () => void) => unknown, unref: () => void }} StageSpawn
 */

/** What each role's process runs — the mark a live pid must still carry to be this stage's. */
export const ROLE_MARKS = Object.freeze({
  server: "scripts/e2e-server.mjs",
  worker: "src/worker/main.ts",
});

/**
 * Where the stage keeps its objects — read as the journeys read it (tests/e2e/support/journey-env.ts):
 * `STORAGE_ROOT` where the environment states one, else the checkout's own store. A stage must serve
 * the objects the journeys wrote, so it may not keep a root of its own.
 * @param {Record<string, string | undefined>} [env]
 * @returns {string}
 */
export function stageStorageRoot(env = process.env) {
  const stated = env["STORAGE_ROOT"]?.trim();
  return stated === undefined || stated === "" ? join(ROOT, "storage") : resolve(ROOT, stated);
}

/**
 * The environment the served product (and the worker, where there is one) runs under. NODE_ENV is
 * left for `next` to set, so it is dropped rather than inherited — which is why the answer is cast:
 * Next's own typing of the process environment declares NODE_ENV always present.
 * @param {StageSpec} spec
 * @param {Record<string, string | undefined>} [env]
 * @returns {NodeJS.ProcessEnv}
 */
export function stageEnv(spec, env = process.env) {
  /** @type {Record<string, string | undefined>} */
  const staged = {
    ...env,
    DATABASE_URL: e2eDatabaseUrl(),
    CUBIT_PUBLIC_ORIGIN: originFor(spec.which),
    CUBIT_STORAGE_SIGNING_SECRET: STAGE_SIGNING_KEY,
    STORAGE_ROOT: stageStorageRoot(env),
    CUBIT_MODEL_FIXTURE_ROOT: join(ROOT, "fixtures", "model"),
    WORKER_HEALTH_PORT: "0",
  };
  if (spec.instrument) staged["CUBIT_UI_INSTRUMENT"] = "1";
  else delete staged["CUBIT_UI_INSTRUMENT"];
  delete staged["NODE_ENV"];
  return /** @type {NodeJS.ProcessEnv} */ (/** @type {unknown} */ (staged));
}

/**
 * The record a stage left, or null. A bare array of pids is the probe's record before stages had
 * names; its processes are read as "unknown" and must carry either role's mark to be signalled.
 * @param {string} file
 * @returns {StageRecord | null}
 */
export function readStageRecord(file) {
  let parsed;
  try {
    parsed = /** @type {unknown} */ (JSON.parse(readFileSync(file, "utf8")));
  } catch {
    return null;
  }
  if (Array.isArray(parsed)) {
    const pids = parsed.filter((pid) => Number.isInteger(pid) && pid > 0).map((pid) => /** @type {number} */ (pid));
    return { stage: "unknown", root: "", port: 0, startedAt: "", processes: pids.map((pid) => ({ role: /** @type {const} */ ("unknown"), pid })) };
  }
  if (parsed === null || typeof parsed !== "object") return null;
  const record = /** @type {Partial<StageRecord>} */ (parsed);
  if (typeof record.stage !== "string" || !Array.isArray(record.processes)) return null;
  const processes = record.processes.filter((entry) => Number.isInteger(entry?.pid) && entry.pid > 0);
  return { stage: record.stage, root: String(record.root ?? ""), port: Number(record.port ?? 0), startedAt: String(record.startedAt ?? ""), processes };
}

/**
 * Whose record this is, when it is not this checkout's stage's: the other stage, or the same stage
 * started from another checkout. Null when it is ours — a record naming no stage or no root was
 * written before either was recorded, and is read as ours.
 * @param {StageRecord} record
 * @param {StageSpec} spec
 * @param {string} [root] this checkout
 * @returns {string | null}
 */
export function foreignOwner(record, spec, root = ROOT) {
  if (record.stage !== spec.name && record.stage !== "unknown") return `the ${record.stage} stage`;
  if (record.root !== "" && record.root !== root) return `the ${spec.name} stage started from ${record.root}`;
  return null;
}

/**
 * What a live pid is running, or null when there is no such process. `/proc` is Linux's; where it
 * is absent altogether the answer is `undefined` — unknown, not gone.
 * @param {number} pid
 * @returns {string | null | undefined}
 */
export function commandLineOf(pid) {
  if (!existsSync("/proc")) return undefined;
  try {
    return readFileSync(`/proc/${pid}/cmdline`, "utf8").split("\0").join(" ").trim();
  } catch {
    return null;
  }
}

/**
 * Is this command line the process the record says it is? A pid the kernel has handed to somebody
 * else since the stage started carries neither mark.
 * @param {string} commandLine
 * @param {StageRole | "unknown"} role
 * @returns {boolean}
 */
export function carriesMark(commandLine, role) {
  const marks = role === "unknown" ? Object.values(ROLE_MARKS) : [ROLE_MARKS[role]];
  return marks.some((mark) => commandLine.includes(mark));
}

/**
 * The recorded processes that are still this stage's: alive, and still running the role's script.
 * A record written by another stage is nobody's here.
 * @param {StageSpec} spec
 * @param {(pid: number) => string | null | undefined} [readCommandLine]
 * @returns {{ role: StageRole | "unknown", pid: number }[]}
 */
export function liveStageProcesses(spec, readCommandLine = commandLineOf) {
  const record = readStageRecord(spec.record);
  if (record === null || foreignOwner(record, spec) !== null) return [];
  return record.processes.filter((entry) => {
    const line = readCommandLine(entry.pid);
    // No /proc to ask: the probe's old behaviour, a signal to the recorded pid, stands.
    if (line === undefined) return true;
    return line !== null && carriesMark(line, entry.role);
  });
}

/**
 * Stop what this stage started — and nothing else. Each process was started as the leader of its
 * own group (`detached`), so the group is signalled: the served product's `next start`, or a
 * `next build` still running under it, goes with it. The record is removed either way.
 * @param {StageSpec} spec
 * @param {{ readCommandLine?: (pid: number) => string | null | undefined, kill?: (pid: number, signal: NodeJS.Signals) => void }} [deps]
 * @returns {{ had: boolean, stopped: number[], foreign: string | null }}
 */
export function stopStage(spec, deps = {}) {
  const kill = deps.kill ?? ((pid, signal) => process.kill(pid, signal));
  const record = readStageRecord(spec.record);
  if (record === null) return { had: false, stopped: [], foreign: null };
  const foreign = foreignOwner(record, spec);
  // Somebody else's record at this stage's address: never signal on it, and never delete it.
  if (foreign !== null) return { had: true, stopped: [], foreign };
  /** @type {number[]} */
  const stopped = [];
  for (const entry of liveStageProcesses(spec, deps.readCommandLine)) {
    try {
      kill(-entry.pid, "SIGTERM");
      stopped.push(entry.pid);
    } catch {
      try {
        kill(entry.pid, "SIGTERM");
        stopped.push(entry.pid);
      } catch {
        /* already gone */
      }
    }
  }
  rmSync(spec.record, { force: true });
  return { had: true, stopped, foreign: null };
}

/**
 * Wait for an address to answer at all — any status is an answer — or for the process that was to
 * serve it to have exited.
 * @param {string} url
 * @param {number} budgetMs
 * @param {() => boolean} gone
 * @returns {Promise<boolean>}
 */
async function answers(url, budgetMs, gone) {
  const started = Date.now();
  while (Date.now() - started < budgetMs) {
    if (gone()) return false;
    try {
      const response = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(1500) });
      if (response.status > 0) return true;
    } catch {
      /* not up yet */
    }
    await new Promise((settle) => setTimeout(settle, 300));
  }
  return false;
}

/**
 * Wait for the worker's log to say it is consuming.
 * @param {string} log
 * @param {number} budgetMs
 * @returns {Promise<boolean>}
 */
async function workerSaysReady(log, budgetMs) {
  const started = Date.now();
  while (Date.now() - started < budgetMs) {
    if (existsSync(log) && readFileSync(log, "utf8").includes(WORKER_READY)) return true;
    await new Promise((settle) => setTimeout(settle, 300));
  }
  return false;
}

/**
 * Serve the stage: the journeys' server script on the stage's port (it builds first only when the
 * build is stale), the worker beside it where the spec asks for one, the record written before
 * anything is waited on so `--stop` can always find what was started. The caller has already asked
 * whether the port is free — this function starts, it does not judge. `deps` is how a suite proves
 * what is started and recorded without starting anything.
 * @param {StageSpec} spec
 * @param {{ spawn?: StageSpawn, answers?: (url: string, budgetMs: number, gone: () => boolean) => Promise<boolean>, workerSaysReady?: (log: string, budgetMs: number) => Promise<boolean> }} [deps]
 * @returns {Promise<{ ready: boolean, exited: boolean, workerReady: boolean | null, origin: string, port: number, processes: { role: StageRole, pid: number }[] }>}
 */
export async function startStage(spec, deps = {}) {
  const start = deps.spawn ?? /** @type {StageSpawn} */ (spawn);
  const answer = deps.answers ?? answers;
  const workerReadiness = deps.workerSaysReady ?? workerSaysReady;
  const port = portFor(spec.which);
  const origin = originFor(spec.which);
  const env = stageEnv(spec);
  for (const file of [spec.record, spec.logs.server, spec.logs.worker]) mkdirSync(dirname(file), { recursive: true });

  const serverOut = openSync(spec.logs.server, "w");
  const server = start(process.execPath, [ROLE_MARKS.server, "--next", "node_modules/next/dist/bin/next", "build-if-stale", "start", "--port", String(port)], {
    cwd: ROOT,
    env,
    stdio: ["ignore", serverOut, serverOut],
    detached: true,
  });
  let serverGone = false;
  server.on("exit", () => {
    serverGone = true;
  });
  /** @type {{ role: StageRole, pid: number }[]} */
  const processes = [];
  if (server.pid !== undefined) processes.push({ role: "server", pid: server.pid });

  if (spec.worker) {
    const workerOut = openSync(spec.logs.worker, "w");
    const worker = start(process.execPath, ["--import", "tsx", ROLE_MARKS.worker], { cwd: ROOT, env, stdio: ["ignore", workerOut, workerOut], detached: true });
    if (worker.pid !== undefined) processes.push({ role: "worker", pid: worker.pid });
    worker.unref();
  }
  /** @type {StageRecord} */
  const record = { stage: spec.name, root: ROOT, port, startedAt: new Date().toISOString(), processes };
  writeFileSync(spec.record, `${JSON.stringify(record)}\n`);
  server.unref();

  const ready = await answer(origin, READY_BUDGET_MS, () => serverGone);
  const workerReady = spec.worker ? await workerReadiness(spec.logs.worker, WORKER_READY_BUDGET_MS) : null;
  return { ready, exited: serverGone, workerReady, origin, port, processes };
}
