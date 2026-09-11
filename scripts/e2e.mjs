#!/usr/bin/env node
// The journey runner. Its roster is derived like every other stage's (ARCH-02): with no journey
// inputs in the tree it records `SKIP e2e missing=tests/e2e` and the gate's journey line is green
// and honest; the moment tests/e2e exists the skip is gone and Playwright runs (C-06, B-22, B-23).
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deriveStage } from "./lib/lanes.mjs";
import { announce, run, wallTime } from "./lib/report.mjs";

const ROOT = resolve(fileURLToPath(new URL("../", import.meta.url)));

/**
 * The journeys this invocation was asked for. Repeatable and comma-separated, in either spelling:
 *
 *   pnpm e2e --journey J-000                       one journey, exactly as before
 *   pnpm e2e --journey J-001 --journey J-003       two, in ONE Playwright invocation
 *   pnpm e2e --journeys J-001,J-003                the same, spelled as a list
 *
 * Several journeys in one invocation is the point: each invocation costs a browser start and a
 * server check, and the gate's regression sweep paid that once per journey. Everything this loop
 * does not recognise is passed to Playwright untouched.
 * @param {string[]} args
 * @returns {{journeys: string[], passthrough: string[]}}
 */
export function readJourneys(args) {
  /** @type {string[]} */
  const journeys = [];
  /** @type {string[]} */
  const passthrough = [];
  /** @param {string} value */
  const add = (value) => {
    for (const name of value.split(",").map((part) => part.trim()).filter((part) => part !== "")) {
      if (!journeys.includes(name)) journeys.push(name);
    }
  };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index] ?? "";
    const inline = /^--journeys?=(.*)$/.exec(arg);
    if (arg === "--journey" || arg === "--journeys") {
      add(args[index + 1] ?? "");
      index += 1;
    } else if (inline !== null) {
      add(inline[1] ?? "");
    } else {
      passthrough.push(arg);
    }
  }
  return { journeys, passthrough };
}

/**
 * The one `--grep` that selects exactly the named journeys. One journey greps for its own name, byte
 * for byte, as this runner always has; several are a union, and nothing else is admitted by it.
 * @param {readonly string[]} journeys
 * @returns {string|null}
 */
export function grepFor(journeys) {
  if (journeys.length === 0) return null;
  if (journeys.length === 1) return journeys[0] ?? null;
  return `(?:${journeys.map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`;
}

/** Is this file the process's entry point, rather than a module a suite is reading? */
function isEntryPoint() {
  const entry = process.argv[1];
  return entry !== undefined && resolve(entry) === fileURLToPath(import.meta.url);
}

if (isEntryPoint()) {
  const { journeys, passthrough } = readJourneys(process.argv.slice(2));
  const grep = grepFor(journeys);

  const startedAt = performance.now();
  const stage = deriveStage(ROOT, "e2e");

  let failed = 0;
  if (announce(stage)) {
    const argv = ["node", "node_modules/@playwright/test/cli.js", "test", ...passthrough];
    if (grep !== null) argv.push("--grep", grep);
    // The journeys asked for are named to the reporter, which answers for each of them by name —
    // one exit code cannot say WHICH journey was red (tests/e2e/support/journey-reporter.ts).
    failed = run(argv, { cwd: ROOT, env: { ...process.env, CUBIT_E2E_JOURNEYS: journeys.join(",") } });
    if (failed !== 0) process.stdout.write(`FAIL e2e exit=${failed}\n`);
  }

  process.stdout.write(`e2e${journeys.length === 0 ? "" : ` ${journeys.join(",")}`} wall-time ${wallTime(startedAt)}\n`);
  process.exit(failed);
}
