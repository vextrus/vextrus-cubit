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
 * The one `--grep` that selects exactly the named journeys — each as a WHOLE TOKEN.
 *
 * Playwright's `--grep` is a JS regex, and the bare id was one: `J-001` also selected `J-0010`, so a
 * run asked for one journey paid for another's wall time and the reporter then attributed that
 * other's red to the journey that was asked for. An id therefore stands on a boundary at both ends
 * — nothing alphanumeric or hyphenated in front of it, no digit or lower-case letter behind it — so
 * `J-001` is J-001 and neither `J-0010` nor `J-001a`, each of which is its own journey and is asked
 * for by its own name. A name ending on a separator (`--journey PERF-`) is a prefix ask and keeps
 * its open end. Several journeys are a union of such tokens.
 * @param {readonly string[]} journeys
 * @returns {string|null}
 */
export function grepFor(journeys) {
  if (journeys.length === 0) return null;
  const names = journeys.map((name) => {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // A name the caller ended on a separator is a PREFIX ask — `pnpm test:perf` is
    // `--journey PERF-`, which means every performance journey — and a prefix has no end to stand on.
    return /[0-9A-Za-z]$/.test(name) ? `${escaped}(?![0-9A-Za-z])` : escaped;
  });
  return `(?:^|[^A-Za-z0-9-])(?:${names.join("|")})`;
}

/**
 * HOW MANY WORKERS THIS RUN WALKS WITH, AND WHY IT IS IN THE VERDICT (P4b §6).
 *
 * `CUBIT_E2E_WORKERS` occurred in exactly two files — playwright.config.ts and CLAUDE.md — and in no
 * recorded line anywhere: no gate key, no lane digest, no verdict. Meanwhile everything this runner
 * did not recognise was passed to Playwright untouched, so `pnpm e2e --workers 2` really did run two
 * workers, with the env var unset and every recorded key identical to a one-worker run. A red found
 * at two workers was not reproducible from the verdict that recorded it — which is the whole
 * anatomy of "it passes on my machine", written into the gate.
 *
 * So the two spellings are made to agree, here, before Playwright is started: `--workers N` sets the
 * environment the config reads, and where BOTH are stated and differ the run is refused rather than
 * silently taking one of them. The count then goes in the runner's own summary line and in every
 * JOURNEY verdict (tests/e2e/support/journey-reporter.ts), so a verdict says what it was measured at.
 * @param {readonly string[]} passthrough the args this runner did not recognise
 * @param {Record<string, string|undefined>} env
 * @returns {{workers: number, asked: number|null, stated: number|null, refusal: string|null}}
 */
export function readWorkers(passthrough, env) {
  /** @type {number|null} */
  let asked = null;
  for (let index = 0; index < passthrough.length; index += 1) {
    const arg = passthrough[index] ?? "";
    const inline = /^--workers=(.*)$/.exec(arg);
    if (arg === "--workers") asked = Number(passthrough[index + 1] ?? "");
    else if (inline !== null) asked = Number(inline[1] ?? "");
  }
  const spelled = env["CUBIT_E2E_WORKERS"];
  const stated = spelled === undefined || spelled.trim() === "" ? null : Number(spelled);
  if (asked !== null && (!Number.isInteger(asked) || asked < 1)) {
    return { workers: 1, asked, stated, refusal: `--workers ${asked} is not a worker count` };
  }
  if (asked !== null && stated !== null && asked !== stated) {
    return {
      workers: stated,
      asked,
      stated,
      refusal: `--workers ${asked} disagrees with CUBIT_E2E_WORKERS=${stated}. One run walks with one worker count, and the verdict records it: state it once, in either spelling.`,
    };
  }
  const workers = asked ?? stated ?? 1;
  return { workers: Number.isInteger(workers) && workers >= 1 ? workers : 1, asked, stated, refusal: null };
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

  const asked = readWorkers(passthrough, process.env);
  if (asked.refusal !== null) {
    process.stdout.write(`FAIL e2e ${asked.refusal}\n`);
    process.exit(2);
  }

  let failed = 0;
  if (announce(stage)) {
    const argv = ["node", "node_modules/@playwright/test/cli.js", "test", ...passthrough];
    if (grep !== null) argv.push("--grep", grep);
    // AM-10 §3-§4: a PB budget is asserted only in a PERF- spec, and V-PERF's verdict is RECORDED
    // and read, never re-measured beside other work. The regression sweep — `pnpm e2e` with no
    // journey named — therefore does not collect the perf specs: run beside ten journeys and two
    // other heavy lanes they measure the box's load, not the product (PERF-011's median came in at
    // 16.7999 ms against a 16.75 ms ceiling on one sweep of five and was green on the other four).
    // The perf lane is asked for by name, `pnpm test:perf`, which is `--journey PERF-`.
    else argv.push("--grep-invert", "PERF-");
    // The journeys asked for are named to the reporter, which answers for each of them by name —
    // one exit code cannot say WHICH journey was red (tests/e2e/support/journey-reporter.ts).
    // The two spellings agree from here on: the config reads the env, the reporter prints it, and
    // `--workers` — if the caller spelled it — is what the env now says.
    failed = run(argv, { cwd: ROOT, env: { ...process.env, CUBIT_E2E_JOURNEYS: journeys.join(","), CUBIT_E2E_WORKERS: String(asked.workers) } });
    if (failed !== 0) process.stdout.write(`FAIL e2e exit=${failed}\n`);
  }

  process.stdout.write(`e2e${journeys.length === 0 ? "" : ` ${journeys.join(",")}`} workers=${asked.workers} wall-time ${wallTime(startedAt)}\n`);
  process.exit(failed);
}
