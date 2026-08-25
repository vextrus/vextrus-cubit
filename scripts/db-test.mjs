#!/usr/bin/env node
// The database suite's entry. Its roster is the derived one (ARCH-02): with no database suite in
// the tree it records its skip against the input root it is waiting for, and arms itself the
// moment that suite exists (B-22, B-23).
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deriveStage } from "./lib/lanes.mjs";
import { announce, run, wallTime } from "./lib/report.mjs";

const ROOT = resolve(fileURLToPath(new URL("../", import.meta.url)));

const startedAt = performance.now();
const stage = deriveStage(ROOT, "test:db");

let failed = 0;
if (announce(stage)) {
  failed = run(["node", "node_modules/vitest/vitest.mjs", "run", "--dir", "db", ...process.argv.slice(2)], { cwd: ROOT });
  if (failed !== 0) process.stdout.write(`FAIL test:db exit=${failed}\n`);
}

process.stdout.write(`test:db wall-time ${wallTime(startedAt)}\n`);
process.exit(failed);
