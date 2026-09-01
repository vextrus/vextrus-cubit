// Shared plumbing for the node side of the DWG lane's acceptance (tests/cad/dwg/**).
//
// The behaviour of `vextrus_cad.dwg` is Python, so it is graded where it lives: `cad/tests/dwg/`
// holds the pytest modules that drive `convert_dwg`, `reconcile`, `census_of` and `geometry_tally`,
// and this side runs them by criterion, reads their outcome, and adds the checks that are natural
// here — the fixture roster, the corpus freeze, and the collection rules of AC-6.
//
// Nothing here reads product source. The fixtures are inputs; pytest is the runner the cad lane
// already uses (`pnpm verify` runs `ruff check` + `pytest` under cad/).
//
// Two facts about the shipped toolchain (LibreDWG 0.13.3 + ezdxf 1.4.4), found while minting the
// fixture, that AC-1 depends on and that no amount of reading the spec would tell you:
//   * `dwg2dxf`'s default output is NOT readable by `ezdxf.readfile` — it emits an `ENDBLK` whose
//     handle is 0, and ezdxf refuses that ("Invalid handle 0"), as does `ingest_dxf` through it.
//     `dwg2dxf -m` ($ACADVER, HANDSEED and ENTITIES only) is readable, and preserves the model
//     space's entity set intact. `--as r2004` and later parse but arrive with empty layouts.
//   * `dwgread -O JSON` tallies `BLOCK` and `ENDBLK` records for every block header. They delimit
//     blocks rather than drawing anything, and the converted DXF has no such entities, so counting
//     them in the census turns a clean conversion into a shortfall refusal.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { expect } from "vitest";
import { REPO_ROOT, runInCadProject, type SpawnOutcome } from "../../support/artifact";

export { REPO_ROOT, runInCadProject } from "../../support/artifact";
export type { SpawnOutcome } from "../../support/artifact";

/** The DWG lane's own pytest suite and its own fixture home — kept clear of the DXF corpus. */
export const DWG_SUITE_DIR = join(REPO_ROOT, "cad", "tests", "dwg");
export const DWG_FIXTURE_DIR = join(DWG_SUITE_DIR, "fixtures");

/** The cad project's test root and the DXF corpus the merged suites already read. */
export const CAD_TEST_DIR = join(REPO_ROOT, "cad", "tests");
export const DXF_CORPUS_DIR = join(CAD_TEST_DIR, "fixtures");

/** The package the lane must ship, as a repo-relative path for a message that names it. */
export const DWG_PACKAGE_REL = "cad/src/vextrus_cad/dwg";

/**
 * Assert the lane exists before running anything against it, so a lane that has not been written
 * fails as an assertion naming the directory rather than as an opaque pytest collection error.
 */
export function requireDwgLane(): void {
  const dir = join(REPO_ROOT, DWG_PACKAGE_REL);
  expect(existsSync(dir), `${DWG_PACKAGE_REL} is missing — the DWG lane does not exist yet`).toBe(true);
  expect(
    existsSync(join(dir, "__init__.py")),
    `${DWG_PACKAGE_REL}/__init__.py is missing — the lane re-exports its surface from there`,
  ).toBe(true);
}

/** Every committed DWG fixture, read off the directory rather than frozen in a list. */
export function committedDwgFixtures(): string[] {
  expect(existsSync(DWG_FIXTURE_DIR), `${DWG_FIXTURE_DIR} is missing — the DWG fixture home`).toBe(true);
  return readdirSync(DWG_FIXTURE_DIR)
    .filter((name) => name.toLowerCase().endsWith(".dwg"))
    .sort();
}

/** The first bytes of a file, for reading a format's own version marker. */
export function magic(path: string, length: number): string {
  const handle = readFileSync(path);
  return handle.subarray(0, length).toString("latin1");
}

/** Every file under a directory, recursively, as repo-relative paths. */
export function filesUnder(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      if (entry === "__pycache__" || entry === ".pytest_cache") continue;
      found.push(...filesUnder(path));
    } else {
      found.push(path);
    }
  }
  return found.sort();
}

export interface PytestOutcome extends SpawnOutcome {
  /** Tests that passed, as pytest's own summary line reports them. */
  readonly passed: number;
  /** Tests that failed or errored, summed. */
  readonly broken: number;
}

/** Run pytest inside the cad project and read its summary line, not just its exit code. */
export function runPytest(argv: readonly string[]): PytestOutcome {
  const run = runInCadProject(["pytest", ...argv]);
  const text = `${run.stdout}\n${run.stderr}`;
  const count = (pattern: RegExp): number => {
    let total = 0;
    for (const match of text.matchAll(pattern)) total += Number(match[1]);
    return total;
  };
  return {
    ...run,
    passed: count(/(\d+) passed/g),
    broken: count(/(\d+) (?:failed|error|errors)\b/g),
  };
}

/** A pytest run that must have exercised something and must have exercised it green. */
export function expectPytestGreen(outcome: PytestOutcome, what: string, atLeast: number): void {
  const report = `${outcome.stdout}\n${outcome.stderr}`.slice(-4000);
  expect(outcome.broken, `${what}: pytest reported failures\n${report}`).toBe(0);
  expect(outcome.status, `${what}: pytest exited ${outcome.status}\n${report}`).toBe(0);
  expect(outcome.passed, `${what}: pytest ran ${outcome.passed} tests, expected at least ${atLeast}\n${report}`).toBeGreaterThanOrEqual(atLeast);
}
