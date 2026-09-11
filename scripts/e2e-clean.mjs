#!/usr/bin/env node
// The journey lane's leavings, taken away (v22 Wave A). Three test stages each build the product
// into their own Next dist directory — `next build` takes an exclusive lock on `<distDir>/lock`, so
// a stage that shares one with another suite makes the second exit rather than wait (next.config.ts)
// — and Playwright writes its results, its report and its traces beside them. All of it is
// regenerable output of this tree, all of it is already ignored by name, and none of it is ever an
// input to a run: a stale dist directory is rebuilt the moment an input is newer than it
// (scripts/e2e-server.mjs). What it is, is 580 MB that nothing collects.
//
//   pnpm e2e:clean          everything no run is holding
//   pnpm e2e:clean --all    the default distDir too
//
// It prints what it took AND what it kept, with a reason for each, so a run that was surprised by
// either can see why. What it never takes: a directory a live journey server is serving from, and a
// build younger than ten minutes — `.next-cubit` is the DEFAULT distDir, and a sweep that matched it
// by name deleted the bundle out from under the process answering requests from it.
import { existsSync, readdirSync, rmSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_DIST_DIR, heldBy } from "./lib/dist.mjs";

const ROOT = resolve(fileURLToPath(new URL("../", import.meta.url)));

/** Playwright's own outputs, named by its config and by its defaults. */
const REPORT_DIRS = ["test-results", "playwright-report", "blob-report", ".vitest-reports"];

/** Every build directory of the tree: the product's own and each stage's, matched as they are named. */
const DIST = /^\.next(?:-.*)?$/;

/**
 * How recently a build has to have been made to be presumed wanted. A journey run builds and then
 * serves; the gap between the two is seconds, and a sweep that lands in it takes the bundle the
 * server is about to answer from.
 */
const FRESH_MS = 10 * 60_000;

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

/**
 * What this sweep would take, and what it would leave — with a reason for every one, because a
 * directory silently kept and a directory silently taken are both surprises.
 *
 * Three things are kept. The DEFAULT distDir, unless the caller says `--all`: it is what a live
 * journey server serves from, and it is the one directory whose deletion reddens journeys for a
 * reason nothing in them explains. A build younger than ten minutes, whatever it is named: a run
 * that has just built is a run about to serve. And a directory a live process says it is serving
 * from (scripts/lib/dist.mjs).
 * @param {string} root the checkout root
 * @param {{all?: boolean, now?: number}} [options]
 * @returns {{name: string, take: boolean, why: string}[]}
 */
export function sweepable(root, options = {}) {
  const now = options.now ?? Date.now();
  /** @type {{name: string, take: boolean, why: string}[]} */
  const targets = [];

  for (const name of REPORT_DIRS) {
    if (existsSync(join(root, name))) targets.push({ name, take: true, why: "a report of a run that has ended" });
  }

  const dists = readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && DIST.test(entry.name))
    .map((entry) => entry.name);

  for (const name of dists.sort()) {
    const dir = join(root, name);
    const holder = heldBy(dir);
    if (holder !== null) {
      targets.push({ name, take: false, why: `a live server (pid ${holder}) is serving from it` });
      continue;
    }
    if (name === DEFAULT_DIST_DIR && options.all !== true) {
      targets.push({ name, take: false, why: `the default distDir — a journey server serves from it; pass --all to take it too` });
      continue;
    }
    const marker = statSync(join(dir, "BUILD_ID"), { throwIfNoEntry: false });
    if (marker !== undefined && now - marker.mtimeMs < FRESH_MS) {
      targets.push({ name, take: false, why: `built ${Math.round((now - marker.mtimeMs) / 1000)}s ago — a run is about to serve it` });
      continue;
    }
    targets.push({ name, take: true, why: marker === undefined ? "no BUILD_ID: nothing ever served from it" : `built ${Math.round((now - marker.mtimeMs) / 60_000)} minutes ago` });
  }
  return targets;
}

/** Is this file the process's entry point, rather than a module a suite is reading? */
function isEntryPoint() {
  const entry = process.argv[1];
  return entry !== undefined && resolve(entry) === fileURLToPath(import.meta.url);
}

if (isEntryPoint()) {
  const all = process.argv.slice(2).includes("--all");
  let taken = 0;
  for (const target of sweepable(ROOT, { all })) {
    const size = bytes(join(ROOT, target.name));
    if (!target.take) {
      process.stdout.write(`e2e:clean keeping ${target.name} ${human(size)} — ${target.why}\n`);
      continue;
    }
    if (size === 0) continue;
    process.stdout.write(`e2e:clean ${target.name} ${human(size)} — ${target.why}\n`);
    rmSync(join(ROOT, target.name), { recursive: true, force: true });
    taken += size;
  }
  process.stdout.write(`e2e:clean took ${human(taken)}\n`);
}
