// The one home of the gate's lane roster (C-06). Every consumer — verify, checkup, CI — asks this
// module which lanes are armed; the answer comes only from probing each lane's declared input
// roots on disk, so a lane stops being a stub the moment its inputs exist (B-23) and no frozen
// list or environment variable can arm or disarm one.
import { existsSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

/**
 * The closed lane enumeration of V-VERIFY, in the order the gate runs them, each with the input
 * roots that decide whether it has anything to do. `probe` (when a lane needs more than the roots'
 * bare existence) receives the absolute root paths and answers whether the lane has real work.
 */
const LANES = [
  { lane: "typegen", inputRoots: ["src/app"] },
  { lane: "typecheck", inputRoots: ["tsconfig.json", "src"] },
  { lane: "lint", inputRoots: ["eslint.config.mjs"] },
  { lane: "unit", inputRoots: ["tests"], probe: ([tests]) => containsUnitTest(tests, tests) },
  { lane: "db-drift", inputRoots: ["src/server/db/schema"] },
  { lane: "method-hash", inputRoots: ["src/modules"] },
  { lane: "catalogue", inputRoots: ["src/core/catalogue"] },
  { lane: "cad", inputRoots: ["cad"] },
  { lane: "build", inputRoots: ["src/app"] },
];

/** The e2e entrypoint is not a verify lane, but it is probed the same way and from the same home. */
export const E2E_INPUT_ROOT = "src/app";

/** The db entrypoints — migrate, drift, seed — all wait on the schema the tree does not have yet. */
export const DB_INPUT_ROOT = "src/server/db/schema";

const IGNORED_DIRS = new Set(["node_modules", ".git", ".next", "dist", "coverage"]);

/**
 * The one home of the unit lane's corpus: vitest.config.ts reads these, and so does the probe
 * below, so a test the roster counts is exactly a test `vitest run` executes (B-23, V-VERIFY).
 * `tests/e2e` is Playwright's; `tests/lint-fixtures` is the Q-08 corpus, whose payload is a
 * deliberate violation that must never be executed as an assertion.
 */
export const UNIT_INCLUDE = ["tests/**/*.test.?(c|m)[jt]s?(x)"];
export const UNIT_EXCLUDE_DIRS = ["tests/e2e", "tests/lint-fixtures"];
export const UNIT_EXCLUDE = ["node_modules/**", ...UNIT_EXCLUDE_DIRS.map((d) => `${d}/**`)];

/** The `tests/`-relative first segments the unit corpus leaves out — `e2e`, `lint-fixtures`. */
const UNIT_EXCLUDED_SEGMENTS = new Set(UNIT_EXCLUDE_DIRS.map((d) => d.slice("tests/".length)));

/** The unit lane's root holds work when it carries a test file vitest's corpus would run. */
function containsUnitTest(dir, testsRoot) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return false;
  }
  for (const entry of entries) {
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (IGNORED_DIRS.has(entry.name)) continue;
      if (UNIT_EXCLUDED_SEGMENTS.has(relative(testsRoot, abs).split(sep)[0])) continue;
      if (containsUnitTest(abs, testsRoot)) return true;
    } else if (/\.test\.[cm]?[jt]sx?$/.test(entry.name)) {
      return true;
    }
  }
  return false;
}

/** The first declared root a lane is missing — what its recorded skip must name (B-23). */
export function absentRootOf(entry, rootDir) {
  return entry.inputRoots.find((rel) => !existsSync(join(rootDir, rel))) ?? entry.inputRoots[0];
}

/** The recorded-skip line every stub prints, in the contract's byte-exact form. */
export function skipLine(name, root) {
  return `SKIP ${name}: input root ${root} absent`;
}

/** True when the named root exists under rootDir — the only question arming ever asks. */
export function rootExists(rootDir, rel) {
  return existsSync(join(rootDir, rel));
}

/**
 * The roster of every V-VERIFY lane for the tree at rootDir, in contract order, with each lane's
 * armed flag derived solely from probing that lane's input roots.
 */
export function deriveLaneRoster(rootDir) {
  return LANES.map(({ lane, inputRoots, probe }) => {
    const absolute = inputRoots.map((rel) => join(rootDir, rel));
    const present = absolute.every((abs) => existsSync(abs));
    return {
      lane,
      armed: present && (probe ? probe(absolute) : true),
      inputRoots: [...inputRoots],
    };
  });
}

/** A lane's roster line: what it will do, decided before it is asked to do it. */
export function rosterLine(entry, rootDir) {
  return entry.armed ? `RUN ${entry.lane}` : skipLine(entry.lane, absentRootOf(entry, rootDir));
}

// Kept beside the roster so a lane can never be armed without a command to honour it (B-23).
export const LANE_COMMANDS = {
  typegen: [["next", ["typegen"]]],
  typecheck: [["tsc", ["--noEmit"]]],
  lint: [["eslint", ["."]]],
  unit: [["vitest", ["run"]]],
  "db-drift": [["node", ["scripts/db-drift.mjs"]]],
  "method-hash": [["node", ["scripts/method-hash.mjs"]]],
  catalogue: [["node", ["scripts/catalogue-drift.mjs"]]],
  cad: [
    ["uv", ["run", "ruff", "check"]],
    ["uv", ["run", "pytest"]],
  ],
  build: [["next", ["build"]]],
};

/**
 * The tools each lane needs to run at all, so checkup can fail on what the tree needs today and
 * merely report what only a stub lane would need (B-23, V-CHECKUP).
 */
export const LANE_TOOLS = {
  typegen: ["node", "pnpm"],
  typecheck: ["node", "pnpm"],
  lint: ["node", "pnpm"],
  unit: ["node", "pnpm"],
  "db-drift": ["node", "pnpm"],
  "method-hash": ["node", "pnpm"],
  catalogue: ["node", "pnpm"],
  cad: ["uv", "typst", "libredwg"],
  build: ["node", "pnpm"],
};

/** The probes beyond the pinned tools that a lane needs: the database, a bindable port. */
export const LANE_PROBES = {
  "db-drift": ["postgres"],
  typegen: ["ports"],
  build: ["ports"],
};
