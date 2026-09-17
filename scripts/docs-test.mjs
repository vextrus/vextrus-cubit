#!/usr/bin/env node
// V-DOCS's entry (AM-18). Its roster is the derived one (ARCH-02): the stage arms on `tests/docs`,
// and until that root existed the roster printed a skip naming it rather than a green lane over a
// renderer nobody had written (B-22, B-23). The root is here now, so this is the lane.
//
// AM-10 §1: every lane prints its wall time, and this one prints it LAST — whether the suite passed,
// failed, or never ran at all. The status handed back is vitest's own: a lane that masked a red suite
// with a zero would be a gate reporting on itself.
//
// Nothing here measures anything. The wall time is REPORTED for the trend the budgets are read
// against; V-DOCS asserts documents, never durations (AM-10 §3) — PB-6 is inc-311a's PERF- spec.
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deriveStage } from "./lib/lanes.mjs";
import { announce, run, wallTime } from "./lib/report.mjs";

const ROOT = resolve(fileURLToPath(new URL("../", import.meta.url)));

/**
 * The environment the runner is given. A lane's stdout is a CONTRACT the gate reads (lib/report.mjs),
 * and the runner's own lines are part of what is read — the globs it names when it collects nothing,
 * among them. Colour would make those lines depend on whether the box that ran the lane had a
 * terminal attached, so it is switched off here and the lane reads the same everywhere. `FORCE_COLOR`
 * is REMOVED rather than zeroed: set to anything, it overrides `NO_COLOR` and warns about doing so.
 * @type {NodeJS.ProcessEnv}
 */
const env = { ...process.env, NO_COLOR: "1" };
delete env["FORCE_COLOR"];

const startedAt = performance.now();
const stage = deriveStage(ROOT, "test:docs");

let failed = 0;
if (announce(stage)) {
  // The lane has a config of its own rather than a filter over the root's: it collects exactly
  // `tests/docs/**/*.test.ts` and runs them in one process, because every case here compiles through
  // the same pinned subprocess and the same three faces.
  failed = run(["node", "node_modules/vitest/vitest.mjs", "run", "--config", "tests/docs/vitest.config.ts", ...process.argv.slice(2)], { cwd: ROOT, env });
  if (failed !== 0) process.stdout.write(`FAIL test:docs exit=${failed}\n`);
}

process.stdout.write(`test:docs wall-time ${wallTime(startedAt)}\n`);
process.exit(failed);
