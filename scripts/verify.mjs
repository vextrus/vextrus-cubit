#!/usr/bin/env node
// V-VERIFY: the gate's chain, fail-fast, in order — typegen, types, lint, unit, schema drift,
// method-hash manifest, catalogue drift, cad, build. The roster comes from deriveLanes and from
// nowhere else (ARCH-02); a stub lane records a skip naming the input root it is waiting for, and
// arms itself the moment that input exists (C-06, B-23). The exit code is the whole contract, so
// the chain is an exported function driven by an injected runner — a guarantee nothing can execute
// is a guarantee nothing can prove (B-22).
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deriveLanes } from "./lib/lanes.mjs";
import { announce, run, runAsync, wallTime } from "./lib/report.mjs";

const ROOT = resolve(fileURLToPath(new URL("../", import.meta.url)));

/**
 * What each lane runs when it is armed. Keyed by the lane ids deriveLanes yields; the roster still
 * decides which of these ever run.
 * @type {Readonly<Record<string, string[][]>>}
 */
export const LANE_COMMANDS = Object.freeze({
  typegen: [["node", "node_modules/next/dist/bin/next", "typegen"]],
  types: [["node", "node_modules/typescript/bin/tsc", "--noEmit"]],
  lint: [["node", "node_modules/eslint/bin/eslint.js", "."]],
  // Capped deliberately: the unit lane would take the whole box by default, and it no longer has
  // the box to itself — six other lanes gate beside it (runChainInWaves) on a 24-core machine that
  // runs at most two product suites at once.
  unit: [["node", "node_modules/vitest/vitest.mjs", "run", "--maxWorkers=6"]],
  "schema-drift": [["node", "scripts/db-drift.mjs", "--scratch"]],
  "method-hash": [["node", "scripts/method-hashes.mjs", "--in-chain"]],
  "catalogue-drift": [["node", "scripts/catalogue-drift.mjs", "--in-chain"]],
  cad: [
    ["ruff", "check", "cad"],
    ["pytest", "cad"],
  ],
  build: [["node", "node_modules/next/dist/bin/next", "build"]],
});

/**
 * What a lane is given beyond the environment it inherits. The build lane alone: the chain's `types`
 * lane has already type-checked this tree, and `next build` doing it again is the same minutes
 * twice (next.config.ts holds the flag's one reading).
 * @type {Readonly<Record<string, Record<string, string>>>}
 */
export const LANE_ENV = Object.freeze({ build: { CUBIT_BUILD_SKIP_TYPECHECK: "1" } });

/**
 * @typedef {{id: string, status: "armed" | "stub", probe: string}} Lane
 */

/**
 * The chain in waves: what must be sequential, and what only looked it. `typegen` writes the types
 * the `types` lane reads, so it stands alone in front; `build` stands alone at the back because it
 * is the one lane worth not running when something already came back red. Everything between is
 * independent — tsc, eslint, the unit lane, cad, and the three drift lanes read the tree and answer
 * about it, and none of them reads another's output — so they gate together.
 * @param {ReadonlyArray<Lane>} lanes
 * @returns {Lane[][]}
 */
export function planWaves(lanes) {
  const waves = [lanes.filter((lane) => lane.id === "typegen"), lanes.filter((lane) => lane.id !== "typegen" && lane.id !== "build"), lanes.filter((lane) => lane.id === "build")];
  return waves.filter((wave) => wave.length > 0);
}

/**
 * Run a roster fail-fast, in the order it is given. Every lane is announced exactly once — `RUN` or
 * the recorded `SKIP` — before anything of its own is executed, and the first non-zero exit ends
 * the chain: no later lane is announced, and its code is the chain's code.
 * @param {ReadonlyArray<Lane>} lanes
 * @param {{exec?: (argv: string[]) => number, report?: (lane: Lane) => boolean, write?: (line: string) => void}} [io]
 * @returns {number} the exit code, which is the whole contract
 */
export function runChain(lanes, io = {}) {
  const exec = io.exec ?? ((argv) => run(argv, { cwd: ROOT }));
  const report = io.report ?? announce;
  const write = io.write ?? ((line) => process.stdout.write(line));

  // A lane the roster yields but nothing can run would be a silent pass — refuse it loudly.
  const unrunnable = lanes.filter((lane) => LANE_COMMANDS[lane.id] === undefined).map((lane) => lane.id);
  if (unrunnable.length > 0) {
    write(`verify has no command for ${unrunnable.join(", ")}\n`);
    return 1;
  }

  for (const lane of lanes) {
    if (!report(lane)) continue;
    for (const argv of /** @type {string[][]} */ (LANE_COMMANDS[lane.id])) {
      const code = exec(argv);
      if (code !== 0) {
        write(`FAIL ${lane.id} exit=${code}\n`);
        return code;
      }
    }
  }
  return 0;
}

/**
 * Run a roster in waves, concurrently within each wave. Every lane is announced exactly once, in
 * roster order, before anything of its wave is executed (ARCH-02, B-22).
 *
 * A wave is run WHOLE: the engine wants every lane's verdict, not just the first red one, so a lane
 * that fails does not silence its siblings — each failure prints its own `FAIL <id> exit=<code>`.
 * Fail-fast survives where it means something: a wave that came back red ends the chain, so no
 * later wave is announced or run, and the code is the first failure's in roster order.
 * @param {ReadonlyArray<Lane>} lanes
 * @param {{exec?: (argv: string[], env?: Record<string, string>, label?: string) => number | Promise<number>, report?: (lane: Lane) => boolean, write?: (line: string) => void}} [io]
 * @returns {Promise<number>} the exit code, which is the whole contract
 */
export async function runChainInWaves(lanes, io = {}) {
  const exec = io.exec ?? ((argv, env, label) => runAsync(argv, { cwd: ROOT, env: { ...process.env, ...env }, label }));
  const report = io.report ?? announce;
  const write = io.write ?? ((line) => process.stdout.write(line));

  const unrunnable = lanes.filter((lane) => LANE_COMMANDS[lane.id] === undefined).map((lane) => lane.id);
  if (unrunnable.length > 0) {
    write(`verify has no command for ${unrunnable.join(", ")}\n`);
    return 1;
  }

  let code = 0;
  for (const wave of planWaves(lanes)) {
    const armed = wave.filter((lane) => report(lane));
    const verdicts = await Promise.all(
      armed.map(async (lane) => {
        for (const argv of /** @type {string[][]} */ (LANE_COMMANDS[lane.id])) {
          const answer = await exec(argv, LANE_ENV[lane.id], lane.id);
          if (answer !== 0) return { lane, code: answer };
        }
        return { lane, code: 0 };
      }),
    );
    for (const verdict of verdicts) {
      if (verdict.code === 0) continue;
      write(`FAIL ${verdict.lane.id} exit=${verdict.code}\n`);
      if (code === 0) code = verdict.code;
    }
    if (code !== 0) break;
  }
  return code;
}

/** Is this file the process's entry point, rather than a module a suite is reading? */
function isEntryPoint() {
  const entry = process.argv[1];
  return entry !== undefined && resolve(entry) === fileURLToPath(import.meta.url);
}

if (isEntryPoint()) {
  const startedAt = performance.now();
  const code = await runChainInWaves(deriveLanes(ROOT));
  process.stdout.write(`verify wall-time ${wallTime(startedAt)}\n`);
  process.exit(code);
}
