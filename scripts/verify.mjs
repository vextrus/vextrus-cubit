#!/usr/bin/env node
// V-VERIFY: the gate's chain, fail-fast, in order — typegen, types, lint, unit, schema drift,
// method-hash manifest, catalogue drift, cad, build. The roster comes from deriveLanes and from
// nowhere else (ARCH-02); a stub lane records a skip naming the input root it is waiting for, and
// arms itself the moment that input exists (C-06, B-23). The exit code is the whole contract.
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deriveLanes } from "./lib/lanes.mjs";
import { announce, run, wallTime } from "./lib/report.mjs";

const ROOT = resolve(fileURLToPath(new URL("../", import.meta.url)));

/**
 * What each lane runs when it is armed. Keyed by the lane ids deriveLanes yields; the roster still
 * decides which of these ever run.
 * @type {Record<string, string[][]>}
 */
const LANE_COMMANDS = {
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
};

const startedAt = performance.now();
const lanes = deriveLanes(ROOT);

/** A lane the roster yields but nothing can run would be a silent pass — refuse it loudly. */
const unrunnable = lanes.filter((lane) => LANE_COMMANDS[lane.id] === undefined).map((lane) => lane.id);
if (unrunnable.length > 0) {
  process.stdout.write(`verify has no command for ${unrunnable.join(", ")}\n`);
  process.exit(1);
}

let failed = 0;
for (const lane of lanes) {
  if (!announce(lane)) continue;
  for (const argv of /** @type {string[][]} */ (LANE_COMMANDS[lane.id])) {
    const code = run(argv, { cwd: ROOT });
    if (code !== 0) {
      process.stdout.write(`FAIL ${lane.id} exit=${code}\n`);
      failed = code;
      break;
    }
  }
  if (failed !== 0) break;
}

process.stdout.write(`verify wall-time ${wallTime(startedAt)}\n`);
process.exit(failed);
