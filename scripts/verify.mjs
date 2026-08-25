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
import { announce, run, wallTime } from "./lib/report.mjs";

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
  unit: [["node", "node_modules/vitest/vitest.mjs", "run"]],
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
 * @typedef {{id: string, status: "armed" | "stub", probe: string}} Lane
 */

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

/** Is this file the process's entry point, rather than a module a suite is reading? */
function isEntryPoint() {
  const entry = process.argv[1];
  return entry !== undefined && resolve(entry) === fileURLToPath(import.meta.url);
}

if (isEntryPoint()) {
  const startedAt = performance.now();
  const code = runChain(deriveLanes(ROOT));
  process.stdout.write(`verify wall-time ${wallTime(startedAt)}\n`);
  process.exit(code);
}
