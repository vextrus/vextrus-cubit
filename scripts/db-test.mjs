#!/usr/bin/env node
// The database suite's entry. Its roster is the derived one (ARCH-02): with no database suite in
// the tree it records its skip against the input root it is waiting for, and arms itself the
// moment that suite exists (B-22, B-23).
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { dbPasses } from "./lib/db-passes.mjs";
import { deriveStage } from "./lib/lanes.mjs";
import { announce, run, wallTime } from "./lib/report.mjs";

const ROOT = resolve(fileURLToPath(new URL("../", import.meta.url)));

const startedAt = performance.now();
const stage = deriveStage(ROOT, "test:db");

let failed = 0;
if (announce(stage)) {
  // No `--dir`: the lane's suites are derived (scripts/lib/pg-suites.mjs) and half of them live
  // beside the module they judge rather than under db/, so the config's globs are the root's.
  // The batch runs first, and a suite that rewrites tracked source runs alone after it
  // (scripts/lib/db-passes.mjs). Every pass runs, and the lane is red if any pass is.
  const passes = dbPasses(process.argv.slice(2));
  if (passes.length > 1) process.stdout.write(`test:db: ${passes.length} passes — the batch, then each suite that rewrites tracked source alone\n`);
  for (const pass of passes) {
    const status = run(["node", "node_modules/vitest/vitest.mjs", "run", ...pass], { cwd: ROOT });
    if (status !== 0 && failed === 0) failed = status;
  }
  if (failed !== 0) process.stdout.write(`FAIL test:db exit=${failed}\n`);
}

process.stdout.write(`test:db wall-time ${wallTime(startedAt)}\n`);
process.exit(failed);
