#!/usr/bin/env node
// The journey lane's leavings, taken away (v22 Wave A). Three test stages each build the product
// into their own Next dist directory — `next build` takes an exclusive lock on `<distDir>/lock`, so
// a stage that shares one with another suite makes the second exit rather than wait (next.config.ts)
// — and Playwright writes its results, its report and its traces beside them. All of it is
// regenerable output of this tree, all of it is already ignored by name, and none of it is ever an
// input to a run: a stale dist directory is rebuilt the moment an input is newer than it
// (scripts/e2e-server.mjs). What it is, is 580 MB that nothing collects.
//
//   pnpm e2e:clean
//
// It prints what it took, so a run that was surprised by the number can see it.
import { readdirSync, rmSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("../", import.meta.url)));

/** Playwright's own outputs, named by its config and by its defaults. */
const REPORT_DIRS = ["test-results", "playwright-report", "blob-report", ".vitest-reports"];

/** Every build directory of the tree: the product's own and each stage's, matched as they are named. */
const DIST = /^\.next(?:-.*)?$/;

/**
 * Bytes under a path, or 0 if it is not there.
 * @param {string} path
 * @returns {number}
 */
function bytes(path) {
  const stat = statSync(path, { throwIfNoEntry: false });
  if (stat === undefined) return 0;
  if (!stat.isDirectory()) return stat.size;
  let total = 0;
  for (const entry of readdirSync(path, { withFileTypes: true })) total += bytes(join(path, entry.name));
  return total;
}

const human = (/** @type {number} */ size) => (size < 1024 * 1024 ? `${Math.round(size / 1024)}K` : `${(size / (1024 * 1024)).toFixed(0)}M`);

const targets = [...REPORT_DIRS, ...readdirSync(ROOT, { withFileTypes: true }).filter((entry) => entry.isDirectory() && DIST.test(entry.name)).map((entry) => entry.name)];

let taken = 0;
for (const name of targets.sort()) {
  const size = bytes(join(ROOT, name));
  if (size === 0) continue;
  process.stdout.write(`e2e:clean ${name} ${human(size)}\n`);
  rmSync(join(ROOT, name), { recursive: true, force: true });
  taken += size;
}
process.stdout.write(`e2e:clean took ${human(taken)}\n`);
