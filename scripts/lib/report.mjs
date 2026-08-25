// The one spelling of the gate's stdout contract (ARCH-02). Every runner — verify, checkup, the
// journey runner, the database stages — reports a lane through these two lines and no other, so a
// skip looks the same everywhere and carries the probed path that triggered it (C-06, B-23).
import { spawnSync } from "node:child_process";

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
