// The one spelling of the gate's stdout contract (ARCH-02). Every runner — verify, checkup, the
// journey runner, the database stages — reports a lane through these two lines and no other, so a
// skip looks the same everywhere and carries the probed path that triggered it (C-06, B-23).
import { spawn, spawnSync } from "node:child_process";
import { appendFileSync, mkdtempSync, readFileSync, rmSync, writeSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * @typedef {{id: string, status: "armed" | "stub", probe: string}} Lane
 */

/**
 * Announce a lane. An armed lane says what it is about to run; a stub lane records its skip and
 * names the input root whose absence is the trigger — the one thing a lane cannot forge.
 * @param {Lane} lane
 * @returns {boolean} whether the lane is armed and must now be run
 */
export function announce(lane) {
  if (lane.status === "armed") {
    process.stdout.write(`RUN ${lane.id}\n`);
    return true;
  }
  process.stdout.write(`SKIP ${lane.id} missing=${lane.probe}\n`);
  return false;
}

/**
 * Run a command, streaming its output. `node` is resolved to the running interpreter so a lane
 * never depends on what happens to be on PATH.
 * @param {string[]} argv
 * @param {{cwd: string, env?: NodeJS.ProcessEnv}} options
 * @returns {number} the exit code
 */
export function run(argv, options) {
  const [command, ...args] = argv;
  if (command === undefined) throw new Error("a lane was given an empty command");
  const executable = command === "node" ? process.execPath : command;
  const result = spawnSync(executable, args, {
    cwd: options.cwd,
    env: options.env ?? process.env,
    stdio: "inherit",
  });
  if (result.error !== undefined && /** @type {NodeJS.ErrnoException} */ (result.error).code === "ENOENT") {
    process.stdout.write(`${command}: not found on PATH\n`);
    return 127;
  }
  if (result.signal !== null) return 129;
  return result.status ?? 1;
}

/**
 * Elapsed wall time, in the one format the gate's final line uses.
 * @param {number} startedAtMs a `performance.now()` reading
 * @returns {string}
 */
export function wallTime(startedAtMs) {
  return `${((performance.now() - startedAtMs) / 1000).toFixed(2)}s`;
}

/**
 * How long a lane may say nothing new before the gate stops waiting on it. A lane that hangs — a
 * build waiting on a lock nobody will release, a test holding a port — used to hold the whole gate
 * for as long as whatever was above it allowed, and then die with the parent and print nothing.
 */
function laneTimeoutMs() {
  const named = Number(process.env["CUBIT_LANE_TIMEOUT_MS"]);
  return Number.isFinite(named) && named > 0 ? named : 15 * 60_000;
}

/** Where the lanes spool. Made on first use, so a chain that runs nothing makes no directory. */
let spool;
function spoolDir() {
  spool ??= mkdtempSync(join(tmpdir(), "cubit-lanes-"));
  return spool;
}

/**
 * What a lane has said so far — nothing at all if it has said nothing, or if the spool is
 * unreadable: a lane's verdict must not turn on whether its spool could be re-read.
 * @param {string} file
 * @returns {string}
 */
function spooled(file) {
  try {
    return readFileSync(file, "utf8");
  } catch {
    return "";
  }
}

/** Lanes that have started and not yet had their say. @type {Map<string, {label: string, file: string}>} */
const inFlight = new Map();
let laneSeq = 0;

/**
 * Put every unfinished lane's spool on stdout, labelled — the last thing this process does.
 * `writeSync` on fd 1 rather than `process.stdout.write`: inside an exit or signal handler a queued
 * write to a pipe is a write that never happens.
 */
function flushInFlight() {
  for (const [key, lane] of [...inFlight]) {
    inFlight.delete(key);
    const text = spooled(lane.file);
    writeSync(1, `----- ${lane.label} (killed mid-lane) -----\n${text === "" || text.endsWith("\n") ? text : `${text}\n`}`);
  }
}

/** Armed once, by the first lane that starts. */
let flushArmed = false;
function armFlush() {
  if (flushArmed) return;
  flushArmed = true;
  process.on("exit", flushInFlight);
  for (const signal of /** @type {const} */ (["SIGTERM", "SIGINT", "SIGHUP"])) {
    process.on(signal, () => {
      flushInFlight();
      process.exit(signal === "SIGINT" ? 130 : 143);
    });
  }
}

/**
 * The same command, run without blocking — the one thing `run` cannot do, and what lets independent
 * lanes gate at once (V-VERIFY). Its output is written as ONE labelled block when the lane ends:
 * interleaving four lanes' streams live would make every one of them unreadable, and a verdict
 * nobody can read is not a verdict.
 *
 * But it is SPOOLED TO A FILE as it arrives, not held in memory, and the parent flushes every
 * unfinished lane's spool before it goes down (`armFlush`). A gate the engine kills — a budget park,
 * a session timeout, a ^C — used to take the whole buffer with it and leave an empty stageTail: the
 * one moment a lane's output is worth most was the moment it was certain to be lost.
 *
 * A lane also has an end: `CUBIT_LANE_TIMEOUT_MS` (15 minutes by default) kills one that has not
 * finished, says so, and answers 124 — the gate does not wait on a lane forever.
 * @param {string[]} argv
 * @param {{cwd: string, env?: NodeJS.ProcessEnv, label?: string, write?: (line: string) => void}} options
 * @returns {Promise<number>} the exit code
 */
export function runAsync(argv, options) {
  const [command, ...args] = argv;
  if (command === undefined) throw new Error("a lane was given an empty command");
  const executable = command === "node" ? process.execPath : command;
  const label = options.label ?? command;
  const write = options.write ?? ((line) => process.stdout.write(line));
  armFlush();
  const key = `${label}#${(laneSeq += 1)}`;
  const file = join(spoolDir(), `${key.replace(/[^\w#.-]/g, "_")}.log`);
  inFlight.set(key, { label, file });

  return new Promise((settle) => {
    const child = spawn(executable, args, { cwd: options.cwd, env: options.env ?? process.env, stdio: ["ignore", "pipe", "pipe"] });
    const keep = (/** @type {Buffer|string} */ chunk) => {
      try {
        appendFileSync(file, chunk);
      } catch {
        // A spool that cannot be written must not take the lane down with it.
      }
    };
    child.stdout.on("data", keep);
    child.stderr.on("data", keep);

    let timedOut = false;
    const killer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      setTimeout(() => child.kill("SIGKILL"), 5_000).unref();
    }, laneTimeoutMs());

    /** Say this lane's piece, once, and stop counting it among the unfinished. */
    const say = () => {
      clearTimeout(killer);
      if (!inFlight.delete(key)) return;
      const text = spooled(file);
      rmSync(file, { force: true });
      if (text.trim() !== "") write(`----- ${label} -----\n${text}${text.endsWith("\n") ? "" : "\n"}`);
    };

    child.on("error", (error) => {
      say();
      write(`${command}: ${/** @type {NodeJS.ErrnoException} */ (error).code === "ENOENT" ? "not found on PATH" : String(error)}\n`);
      settle(/** @type {NodeJS.ErrnoException} */ (error).code === "ENOENT" ? 127 : 1);
    });
    child.on("close", (code, signal) => {
      say();
      if (timedOut) {
        write(`TIMEOUT ${label} after=${laneTimeoutMs()}ms — the lane was killed (CUBIT_LANE_TIMEOUT_MS)\n`);
        settle(124);
        return;
      }
      settle(signal !== null ? 129 : (code ?? 1));
    });
  });
}
