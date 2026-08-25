#!/usr/bin/env node
// Applies the committed migrations. Its status is derived from the migrations root (ARCH-02): with
// no migrations in the tree it records its skip and exits green — there is nothing to apply and
// nothing to pretend about (B-23).
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deriveStage } from "./lib/lanes.mjs";
import { announce, run, wallTime } from "./lib/report.mjs";

const ROOT = resolve(fileURLToPath(new URL("../", import.meta.url)));

const startedAt = performance.now();
const stage = deriveStage(ROOT, "db:migrate");

let failed = 0;
if (announce(stage)) {
  failed = run(["node", "node_modules/drizzle-kit/bin.cjs", "migrate", ...process.argv.slice(2)], { cwd: ROOT });
  if (failed !== 0) process.stdout.write(`FAIL db:migrate exit=${failed}\n`);
}

process.stdout.write(`db:migrate wall-time ${wallTime(startedAt)}\n`);
process.exit(failed);
