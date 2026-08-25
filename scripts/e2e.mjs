#!/usr/bin/env node
// The journey runner. Its roster is derived like every other stage's (ARCH-02): with no journey
// inputs in the tree it records `SKIP e2e missing=tests/e2e` and the gate's journey line is green
// and honest; the moment tests/e2e exists the skip is gone and Playwright runs (C-06, B-22, B-23).
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deriveStage } from "./lib/lanes.mjs";
import { announce, run, wallTime } from "./lib/report.mjs";

const ROOT = resolve(fileURLToPath(new URL("../", import.meta.url)));

const args = process.argv.slice(2);
const journeyFlag = args.indexOf("--journey");
const journey = journeyFlag === -1 ? null : (args[journeyFlag + 1] ?? null);
const passthrough = journeyFlag === -1 ? args : args.filter((_, index) => index !== journeyFlag && index !== journeyFlag + 1);

const startedAt = performance.now();
const stage = deriveStage(ROOT, "e2e");

let failed = 0;
if (announce(stage)) {
  const argv = ["node", "node_modules/@playwright/test/cli.js", "test", ...passthrough];
  if (journey !== null) argv.push("--grep", journey);
  failed = run(argv, { cwd: ROOT });
  if (failed !== 0) process.stdout.write(`FAIL e2e exit=${failed}\n`);
}

process.stdout.write(`e2e${journey === null ? "" : ` ${journey}`} wall-time ${wallTime(startedAt)}\n`);
process.exit(failed);
