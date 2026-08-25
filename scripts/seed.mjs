#!/usr/bin/env node
// Loads the development seed. Its status is derived from the seed root (ARCH-02): with no seed in
// the tree it records its skip and exits green rather than inventing data (B-23).
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deriveStage } from "./lib/lanes.mjs";
import { announce, run, wallTime } from "./lib/report.mjs";

const ROOT = resolve(fileURLToPath(new URL("../", import.meta.url)));

const startedAt = performance.now();
const stage = deriveStage(ROOT, "seed");

let failed = 0;
if (announce(stage)) {
  failed = run(["node", "--experimental-strip-types", stage.probe, ...process.argv.slice(2)], { cwd: ROOT });
  if (failed !== 0) process.stdout.write(`FAIL seed exit=${failed}\n`);
}

process.stdout.write(`seed wall-time ${wallTime(startedAt)}\n`);
process.exit(failed);
