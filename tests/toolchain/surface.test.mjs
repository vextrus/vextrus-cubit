// AC-1-VERIFY-WHOLE — the complete C-06 toolchain surface exists and `pnpm verify` prints the
// contract's roster, runs the armed lanes fail-fast and exits 0.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { LANE_ORDER, PINS_JSON_KEYS, SCRIPTS_BLOCK } from "./support/contract.mjs";
import { finalLineOf, laneOf, pnpmRun, readJson, removeTree, repoRoot, rosterOf, scratchTree } from "./support/tree.mjs";

const root = repoRoot();
const has = (rel) => existsSync(join(root, rel));
/** One config file per role, whatever extension its ecosystem uses. */
const oneOf = (base) => ["ts", "mts", "cts", "js", "mjs", "cjs"].some((e) => has(`${base}.${e}`));

describe("AC-1-VERIFY-WHOLE", () => {
  it("AC-1-VERIFY-WHOLE: the six CLI entrypoints and the lane roster module are present", () => {
    for (const script of ["verify", "checkup", "db-migrate", "db-drift", "e2e", "seed", "lanes"]) {
      expect(has(`scripts/${script}.mjs`), `scripts/${script}.mjs is missing (C-06)`).toBe(true);
    }
  });

  it("AC-1-VERIFY-WHOLE: the pinned toolchain is declared where the contract puts each pin", () => {
    expect(has(".nvmrc"), ".nvmrc is missing").toBe(true);
    expect(readFileSync(join(root, ".nvmrc"), "utf8").trim()).toMatch(/^v?\d+\.\d+\.\d+$/);

    const pkg = readJson(join(root, "package.json"));
    expect(pkg.packageManager, "package.json packageManager pin is missing").toMatch(/^pnpm@\d+\.\d+\.\d+/);

    expect(has("scripts/pins.json"), "scripts/pins.json is missing").toBe(true);
    const pins = readJson(join(root, "scripts/pins.json"));
    expect(Object.keys(pins).sort()).toEqual([...PINS_JSON_KEYS].sort());
    for (const key of PINS_JSON_KEYS) {
      expect(String(pins[key]).trim().length, `pins.json ${key} is empty`).toBeGreaterThan(0);
    }
  });

  it("AC-1-VERIFY-WHOLE: tsconfig is strict and every config of the C-06 surface exists", () => {
    expect(has("tsconfig.json")).toBe(true);
    expect(readJson(join(root, "tsconfig.json")).compilerOptions?.strict, "tsconfig is not strict").toBe(true);
    for (const base of ["eslint.config", "vitest.config", "playwright.config", "drizzle.config"]) {
      expect(oneOf(base), `${base}.* is missing (C-06)`).toBe(true);
    }
    expect(has(".gitignore")).toBe(true);
    expect(has("fixtures/gen/README.md"), "the fixture generators' skeleton is missing (B-15)").toBe(true);
  });

  it("AC-1-VERIFY-WHOLE: the fixture generators' skeleton states what exists today (B-23)", () => {
    const readme = readFileSync(join(root, "fixtures/gen/README.md"), "utf8");
    // Every fixtures/gen path the prose names must actually be there — stale scaffolding prose
    // promising a generator that does not exist is the lie B-23 forbids.
    for (const referenced of readme.match(/\bfixtures\/gen\/[\w.\-/]*[\w]/g) ?? []) {
      if (referenced === "fixtures/gen" || referenced === "fixtures/gen/README.md") continue;
      expect(has(referenced), `fixtures/gen/README.md names ${referenced}, which the tree does not have (B-23)`).toBe(true);
    }
  });

  it("AC-1-VERIFY-WHOLE: the package.json scripts block is the contract's closed set", () => {
    const pkg = readJson(join(root, "package.json"));
    expect(Object.keys(pkg.scripts ?? {}).sort()).toEqual([...SCRIPTS_BLOCK].sort());
    expect(pkg.scripts.test).toBe("vitest run");
    // No script that cannot pass: the db lane arrives with the db increment (B-23, risk note 3).
    expect(pkg.scripts["test:db"]).toBeUndefined();
  });

  describe("pnpm verify on a copy of this tree", () => {
    let dir;
    let run;

    beforeAll(() => {
      dir = scratchTree("ac1");
      run = pnpmRun(dir, ["verify"]);
    }, 900_000);

    afterAll(() => dir && removeTree(dir));

    it("AC-1-VERIFY-WHOLE: exits 0 with one roster line per lane, in the contract's order", () => {
      expect(run.code, `pnpm verify exited ${run.code}\n${run.out}`).toBe(0);
      const roster = rosterOf(run);
      expect(roster.map(laneOf)).toEqual(LANE_ORDER);
      for (const line of roster) {
        expect(line, "a roster line carries no decoration beyond the contract's two forms").toMatch(
          /^(RUN [a-z][a-z0-9-]*|SKIP [a-z][a-z0-9-]*: input root .+ absent)$/,
        );
      }
    });

    it("AC-1-VERIFY-WHOLE: ends with the wall-time line and no lane prints twice", () => {
      expect(finalLineOf(run), `no verify: line in\n${run.out}`).toMatch(/^verify: ok in \d+(\.\d+)?s$/);
      const lanes = rosterOf(run).map(laneOf);
      expect(new Set(lanes).size, "a lane printed more than one roster line").toBe(lanes.length);
    });

    it("AC-1-VERIFY-WHOLE: every skip names a root that is genuinely absent from the tree", () => {
      for (const line of rosterOf(run).filter((l) => l.startsWith("SKIP "))) {
        const named = /input root (.+) absent$/.exec(line)[1];
        expect(existsSync(join(dir, named)), `${line} — but ${named} exists (B-23)`).toBe(false);
      }
      for (const line of rosterOf(run).filter((l) => l.startsWith("RUN "))) {
        expect(laneOf(line)).toBeTruthy();
      }
    });
  });
});

describe("AC-3-LINT-NEVERS", () => {
  it("AC-3-LINT-NEVERS: the declared fixture corpus is committed at tests/lint-fixtures", () => {
    const corpus = join(root, "tests/lint-fixtures");
    expect(existsSync(corpus), "the declared corpus tests/lint-fixtures is missing (Q-08)").toBe(true);
    expect(readdirSync(corpus).filter((e) => statSync(join(corpus, e)).isDirectory()).length).toBeGreaterThan(0);
  });
});
