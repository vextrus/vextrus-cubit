// AC-6 — the cad lane stays green and the DXF corpus is undisturbed (V-VERIFY, L-CAD-01).
//
// The DWG lane arrives beside the DXF corpus, not inside it: cad/tests/corpus.py, test_regenerate.py,
// test_cli.py and tests/cad/support/artifact.ts all read cad/tests/fixtures/ as a roster where every
// `<name>.entitygraph.json` owes a `<name>.dxf`, and a stray file there breaks all four. The freeze
// below is stated as that roster's own rule plus "the working tree is clean there" — deliberately
// NOT as a git diff against a base, because a later increment legitimately re-baselines the corpus
// when census shortfalls enter the EntityGraph counters, and an extent assertion would red it.
import { existsSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { basename, join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CAD_TEST_DIR,
  committedDwgFixtures,
  DWG_FIXTURE_DIR,
  DXF_CORPUS_DIR,
  expectPytestGreen,
  filesUnder,
  magic,
  REPO_ROOT,
  requireDwgLane,
  runInCadProject,
  runPytest,
} from "./support/dwg";

const DWG_MARKER = /^AC10\d\d$/;
const ARTIFACT_SUFFIX = ".entitygraph.json";
const LANE_BUDGET_MS = 900_000;

describe("AC-6: the cad lane with the DWG suite in it", () => {
  it("AC-6: every committed DWG fixture opens with a real DWG version marker", () => {
    const fixtures = committedDwgFixtures();
    expect(fixtures.length, `${DWG_FIXTURE_DIR} holds no .dwg — the declared fixture glob is empty`).toBeGreaterThan(0);
    for (const name of fixtures) {
      expect(magic(join(DWG_FIXTURE_DIR, name), 6), `${name} does not open with a DWG version marker`).toMatch(DWG_MARKER);
    }
  });

  it("AC-6: the DXF corpus gains and loses no file, and the DWG lane writes nothing into it", () => {
    expect(existsSync(DXF_CORPUS_DIR), `${DXF_CORPUS_DIR} is missing`).toBe(true);
    const names = readdirSync(DXF_CORPUS_DIR).sort();

    // The roster rule the merged suites depend on, read off the directory rather than frozen.
    const artifacts = names.filter((n) => n.endsWith(ARTIFACT_SUFFIX)).map((n) => n.slice(0, -ARTIFACT_SUFFIX.length));
    expect(artifacts.length, "the DXF corpus holds no committed artifact at all").toBeGreaterThan(0);
    for (const name of artifacts) {
      expect(names, `${name}${ARTIFACT_SUFFIX} has no ${name}.dxf beside it`).toContain(`${name}.dxf`);
    }
    const foreign = names.filter((n) => !n.endsWith(".dxf") && !n.endsWith(ARTIFACT_SUFFIX));
    expect(foreign, "a file that is neither a DXF nor its artifact entered the DXF corpus").toEqual([]);
    expect(
      names.filter((n) => n.toLowerCase().endsWith(".dwg")),
      "a DWG entered cad/tests/fixtures — the DWG lane's fixtures live in cad/tests/dwg/fixtures",
    ).toEqual([]);

    // Running the lane must not have touched a committed byte: `convert_dwg` is stateless and
    // writes only into the out_dir it is handed.
    const status = spawnSync("git", ["status", "--porcelain", "--", "cad/tests/fixtures"], {
      cwd: REPO_ROOT,
      encoding: "utf8",
    });
    expect(status.status, `git status failed: ${status.stderr}`).toBe(0);
    expect(status.stdout.trim(), "the DXF corpus is dirty in the working tree").toBe("");
  });

  it("AC-6: the DWG suite is collected, uniquely named, and needs no conftest of its own", () => {
    requireDwgLane();

    // Under pytest's prepend import mode two modules sharing a basename collide; the whole cad test
    // tree is judged, since that is the collection the lane runs in.
    const modules = filesUnder(CAD_TEST_DIR).filter((path) => path.endsWith(".py"));
    expect(modules.length, `${CAD_TEST_DIR} holds no Python module`).toBeGreaterThan(0);
    const byBasename = new Map<string, string[]>();
    for (const path of modules) {
      const name = basename(path);
      byBasename.set(name, [...(byBasename.get(name) ?? []), relative(REPO_ROOT, path)]);
    }
    const clashes = [...byBasename.entries()].filter(([, paths]) => paths.length > 1);
    expect(clashes, "two cad test modules share a basename — pytest's prepend import mode collides").toEqual([]);

    // The suite must be importable without a conftest: adding one is outside this increment's
    // ownership and would change collection for every existing cad suite.
    expect(existsSync(join(CAD_TEST_DIR, "conftest.py")), "cad/tests/conftest.py is outside this increment").toBe(false);
    expect(existsSync(join(CAD_TEST_DIR, "dwg", "conftest.py")), "cad/tests/dwg/conftest.py is outside this increment").toBe(false);

    // …and it must actually be collected by the lane's own invocation.
    const collected = runInCadProject(["pytest", "cad", "--collect-only", "-q"]);
    expect(collected.status, `pytest --collect-only exited ${collected.status}\n${collected.stdout}\n${collected.stderr}`).toBe(0);
    const dwgNodes = collected.stdout.split("\n").filter((line) => line.includes("tests/dwg/"));
    expect(dwgNodes.length, `pytest collects nothing under cad/tests/dwg\n${collected.stdout.slice(-2000)}`).toBeGreaterThan(0);
  }, LANE_BUDGET_MS);

  it("AC-6: verify's cad lane — ruff check cad, then pytest cad — is green with the DWG suite in it", () => {
    requireDwgLane();
    const lint = runInCadProject(["ruff", "check", "cad"]);
    expect(lint.status, `ruff check cad exited ${lint.status}\n${lint.stdout}\n${lint.stderr}`).toBe(0);
    expectPytestGreen(runPytest(["cad", "-q"]), "AC-6", 1);
  }, LANE_BUDGET_MS);
});
