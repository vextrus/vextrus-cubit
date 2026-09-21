// IS A BUILT PRODUCT CURRENT FOR THIS TREE? One home for the question (ARCH-02), asked by the
// journeys' server (scripts/e2e-server.mjs, `build-if-stale`) and by the live acceptance suites
// that serve the product from one shared build (tests/support/acceptance-build.ts).
//
// A build is current when `<distDir>/BUILD_ID` exists, no input file — src, public, the configs, the
// manifest and its lockfile, the env files — is newer than the instant the build STARTED reading
// (scripts/lib/build-stamp.mjs), and no tracked input was deleted since the last commit. Anything
// else is stale. Stamping the start rather than the end is what makes an edit made DURING a build
// count as newer than it.
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { buildReadInputsAtMs, inputIsStale } from "./build-stamp.mjs";
import { inputFilesOf } from "./build-inputs.mjs";

/** The directories a build reads. A skipped directory is the build's own, or dependencies. */
export const INPUT_ROOTS = Object.freeze(["src", "public"]);

/**
 * The newest mtime under the input roots and files.
 * @param {string} root the checkout
 * @returns {number}
 */
export function newestInputMs(root) {
  let newest = 0;
  /** @param {string} dir */
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else {
        const ms = statSync(full).mtimeMs;
        if (ms > newest) newest = ms;
      }
    }
  };
  for (const dir of INPUT_ROOTS) if (existsSync(join(root, dir))) walk(join(root, dir));
  for (const file of inputFilesOf(root)) if (existsSync(join(root, file))) newest = Math.max(newest, statSync(join(root, file)).mtimeMs);
  return newest;
}

/**
 * A tracked input deleted since the last commit leaves no mtime behind: `git status` names it.
 * @param {string} root
 * @returns {boolean}
 */
export function inputDeleted(root) {
  const r = spawnSync("git", ["status", "--porcelain", "--", ...INPUT_ROOTS, ...inputFilesOf(root)], { cwd: root, encoding: "utf8" });
  return r.status === 0 && /^\s?D\s/m.test(r.stdout);
}

/**
 * The verdict, with its reason in one line for the log.
 * @param {string} root the checkout
 * @param {string} distDir the build's directory, relative to the checkout
 * @returns {{current: boolean, why: string}}
 */
export function buildIsCurrent(root, distDir) {
  const distAbs = join(root, distDir);
  if (!existsSync(join(distAbs, "BUILD_ID"))) return { current: false, why: `no ${distDir}/BUILD_ID` };
  const builtMs = buildReadInputsAtMs(distAbs);
  if (builtMs === null) return { current: false, why: `no ${distDir}/BUILD_ID` };
  const newest = newestInputMs(root);
  if (inputIsStale(newest, builtMs)) return { current: false, why: `an input is newer than the build's start by ${Math.round((newest - builtMs) / 1000)}s` };
  if (inputDeleted(root)) return { current: false, why: "a tracked input was deleted since the last commit" };
  return { current: true, why: `${distDir} built ${Math.round((Date.now() - builtMs) / 1000)}s ago and every input is older` };
}
