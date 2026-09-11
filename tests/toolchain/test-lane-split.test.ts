// The two lanes partition the suites — every one of them, and none of them twice (v22 Wave A).
//
// `pnpm test` is the unit lane and opens no database; `pnpm test:db` is the database lane. Which
// suite belongs where is derived from the tree's own import graph (scripts/lib/pg-suites.mjs), and a
// derivation nobody checks is a list nobody keeps: before this file, four suites under db/__tests__
// were collected by NEITHER runner — they reached no harness, so the derived lane did not want them,
// and the unit lane excluded exactly the derived lane. 436 suites in the tree, 432 collected, and
// the four that fell through said nothing about it, because a suite nobody runs is silent by nature.
//
// So the question is asked of the RUNNERS, not of the deriving function: `vitest list --filesOnly`
// against each lane's own config is what each lane will actually collect, and the three counts are
// printed so a run that moves them can be read rather than guessed at.
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const ROOT = resolve(fileURLToPath(new URL("../../", import.meta.url)));

/** A suite, in either of the two spellings this tree writes one in. */
const SUITE = /\.test\.tsx?$/;

/**
 * The two trees that are deliberately no runner's: the journeys are Playwright's (they are named
 * `*.e2e.ts` and `*.spec.ts`, so a `*.test.ts` under there would be collected by nothing at all),
 * and the lint fixture corpus is payload a scan law reads, not a suite.
 */
const NOT_A_LANE = ["tests/e2e/", "tests/lint-fixtures/"];

/** Every suite the tree carries, wherever it lives. */
function everySuite(): string[] {
  const found: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (SUITE.test(entry.name)) found.push(relative(ROOT, full).replace(/\\/g, "/"));
    }
  };
  for (const root of ["src", "tests", "db"]) walk(join(ROOT, root));
  return found.sort();
}

/**
 * What a lane's runner really collects. Asked with DATABASE_URL pointed at a dead port, so a config
 * that opens a connection merely to decide what to collect is a failure here rather than a mystery
 * on a machine with no cluster.
 */
function collectedBy(config: string | null): string[] {
  const argv = ["node_modules/vitest/vitest.mjs", "list", "--filesOnly", ...(config === null ? [] : ["--config", config])];
  const listed = spawnSync(process.execPath, argv, {
    cwd: ROOT,
    encoding: "utf8",
    timeout: 300_000,
    env: { ...process.env, DATABASE_URL: "postgresql://x@127.0.0.1:1/x" },
  });
  expect(listed.status, `vitest could not list ${config ?? "the unit lane"}:\n${`${listed.stdout ?? ""}${listed.stderr ?? ""}`.slice(-1600)}`).toBe(0);
  return (listed.stdout ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => SUITE.test(line))
    .map((line) => relative(ROOT, resolve(ROOT, line)).replace(/\\/g, "/"))
    .sort();
}

describe("the unit lane and the database lane partition the suites", () => {
  test("every suite is collected by exactly one of them", () => {
    const every = everySuite();
    const unit = collectedBy(null);
    const database = collectedBy("db/__tests__/vitest.config.ts");
    const neither = every.filter((file) => NOT_A_LANE.some((tree) => file.startsWith(tree)));

    process.stdout.write(`lane-split unit=${unit.length} db=${database.length} tree=${every.length} neither=${neither.length}\n`);

    const both = unit.filter((file) => database.includes(file));
    expect(both, "these suites are collected by BOTH lanes — one of them is running them without a cluster").toEqual([]);

    const uncollected = every.filter((file) => !unit.includes(file) && !database.includes(file) && !neither.includes(file));
    expect(uncollected, "these suites are collected by NEITHER lane — a suite nobody runs proves nothing, silently").toEqual([]);

    const strays = [...unit, ...database].filter((file) => !every.includes(file));
    expect(strays, "a lane collected something the tree does not carry as a suite").toEqual([]);
    expect(unit.length + database.length + neither.length, "the three counts do not add up to the tree's suites").toBe(every.length);
  }, 300_000);
});
