/**
 * THE JOURNEYS' SERVER, WORKER AND SEED AGREE ON THEIR ROOTS BY DECLARATION (V-E2E, ARCH-02).
 *
 * WHY THIS EXISTS. On 2026-09-21 `pnpm e2e --journeys J-011,J-020` was red on a checkout whose
 * untracked `.env` named `STORAGE_ROOT=storage/dev`: `next start` loads `.env`, so the served
 * product read one storage root while the global setup's seed and the journey's worker wrote to
 * `<cwd>/storage`, and every sheet answered "the store holds no object" (SEAM-STORAGE). The run
 * was green only when the shell exported `STORAGE_ROOT` by hand — a fact no verdict recorded.
 *
 * The same shape for the model transport: a served product runs under NODE_ENV=production, so
 * without `CUBIT_MODEL_FIXTURE_ROOT` the seam is LIVE in the journey lane, against V-E2E's "Model
 * calls use fixture transport" and L-AI-01's network-free replay.
 *
 * So the lane's environment has one home, `tests/e2e/support/journey-env.ts`, and this suite holds
 * the three consumers to it. The config is read as text — importing it would pull the live-SQL
 * seed into the unit lane (scripts/lib/pg-suites.mjs) — which is how its sibling suites read it too
 * (tests/ui/shell/journey-lane.test.ts, tests/journeys/j-004-gallery-contract.test.ts).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { journeyModelFixtureRoot, journeyProcessEnv, journeyStorageRoot } from "../e2e/support/journey-env";

const REPO_ROOT = join(import.meta.dirname, "..", "..");
const PLAYWRIGHT_CONFIG = "playwright.config.ts";
const WORKER = "tests/e2e/support/worker.ts";
const GLOBAL_SETUP = "tests/e2e/support/global-setup.ts";
const ENV_HOME = "./tests/e2e/support/journey-env";

/** The file's code, comments stripped, so a name in a comment never satisfies a claim about a call. */
function code(path: string): string {
  return readFileSync(join(REPO_ROOT, path), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

/** The `webServer: { … }` block of the config, as text. */
function webServerBlock(config: string): string {
  const start = config.search(/^\s*webServer\s*:\s*\{/m);
  expect(start, `${PLAYWRIGHT_CONFIG} declares a webServer`).toBeGreaterThanOrEqual(0);
  const rest = config.slice(start);
  const end = rest.search(/^\s{2}\},?\s*$/m);
  return end === -1 ? rest : rest.slice(0, end);
}

const held = { STORAGE_ROOT: process.env["STORAGE_ROOT"], CUBIT_MODEL_FIXTURE_ROOT: process.env["CUBIT_MODEL_FIXTURE_ROOT"] };

afterEach(() => {
  for (const [name, value] of Object.entries(held)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

describe("one home for the lane's roots (tests/e2e/support/journey-env.ts)", () => {
  it("the storage root is the served product's own default, <cwd>/storage, unless the environment states one", () => {
    delete process.env["STORAGE_ROOT"];
    expect(journeyStorageRoot()).toBe(join(process.cwd(), "storage"));
    process.env["STORAGE_ROOT"] = "/somewhere/else";
    expect(journeyStorageRoot(), "a stated root is handed on verbatim, so a repointed run still agrees with its server").toBe("/somewhere/else");
  });

  it("the model fixture root is the corpus's default home, fixtures/model, unless the environment states one", () => {
    delete process.env["CUBIT_MODEL_FIXTURE_ROOT"];
    expect(journeyModelFixtureRoot()).toBe(join(process.cwd(), "fixtures", "model"));
    process.env["CUBIT_MODEL_FIXTURE_ROOT"] = "   ";
    expect(journeyModelFixtureRoot(), "a blank statement is no statement (the seam's own reading of the variable)").toBe(join(process.cwd(), "fixtures", "model"));
    process.env["CUBIT_MODEL_FIXTURE_ROOT"] = "fixtures/model/sheet-understanding";
    expect(journeyModelFixtureRoot()).toBe("fixtures/model/sheet-understanding");
  });

  it("the process environment names exactly the two roots, from the same two readings", () => {
    delete process.env["STORAGE_ROOT"];
    delete process.env["CUBIT_MODEL_FIXTURE_ROOT"];
    expect(journeyProcessEnv()).toEqual({ STORAGE_ROOT: journeyStorageRoot(), CUBIT_MODEL_FIXTURE_ROOT: journeyModelFixtureRoot() });
  });
});

describe("every process of the lane is handed the same roots (V-E2E, L-AI-01)", () => {
  it("the served product is told its storage root and its model fixture root by the config's webServer", () => {
    const config = code(PLAYWRIGHT_CONFIG);
    expect(config, `${PLAYWRIGHT_CONFIG} reads the lane's environment from its one home`).toMatch(new RegExp(`from\\s+"${ENV_HOME}"`));
    const block = webServerBlock(config);
    expect(block, "the webServer's env spreads the lane's own roots over the deployment's other statements — a `.env` on the checkout must not decide them").toMatch(
      /env\s*:\s*\{[^}]*\.\.\.journeyProcessEnv\(\)/,
    );
  });

  it("the journey's worker is started with the same roots", () => {
    const worker = code(WORKER);
    expect(worker).toMatch(new RegExp(`from\\s+"\\./journey-env"`));
    expect(worker, "the worker's env spreads the same reading — a worker on another root writes rasters the server cannot serve").toMatch(/\.\.\.journeyProcessEnv\(\)/);
  });

  it("the global setup seeds the worker tenants' objects into the same storage root", () => {
    const setup = code(GLOBAL_SETUP);
    expect(setup).toMatch(/journeyStorageRoot\(\)/);
    expect(setup, "the seed reads the root from the one home, not from the worker's re-export of it").toMatch(new RegExp(`from\\s+"\\./journey-env"`));
  });
});
