// The cad lane's price (V-VERIFY, v22 speed). The lane deselects the ~80 s fixture regeneration
// when nothing it reads has moved, so the thing worth proving is the DECISION: what counts as
// moved, what the diff is taken against, and — the only direction that can lose evidence — that a
// git which cannot answer regenerates rather than skips.
//
// Driven with an injected git, so every branch is provable on a tree of whatever shape this test
// happens to run on.
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { FIXTURE_REGENERATION_TESTS, REGENERATION_SKIPPED_LINE, cadLane, cadPytestArgv, changedPaths, touchesFixtureInputs } from "../../scripts/lib/cad-lane.mjs";

const REPO_ROOT = fileURLToPath(new URL("../../", import.meta.url));

type GitRun = (argv: string[]) => { status: number | null; stdout: string };

/** A git that answers a named branch, a base, a committed diff and a working tree. */
function fakeGit(answers: { branch?: string; committed?: string[]; working?: string[]; fails?: string }): GitRun {
  return (argv) => {
    const command = argv.join(" ");
    const fail = { status: 1, stdout: "" };
    if (answers.fails !== undefined && command.startsWith(answers.fails)) return fail;
    if (command === "rev-parse --abbrev-ref HEAD") return { status: 0, stdout: `${answers.branch ?? "v22/speed-verify"}\n` };
    if (command === "rev-parse HEAD^") return { status: 0, stdout: "deadbeef\n" };
    if (command === "merge-base HEAD main") return { status: 0, stdout: "cafef00d\n" };
    if (command.startsWith("diff --name-only")) return { status: 0, stdout: `${(answers.committed ?? []).join("\n")}\n` };
    if (command.startsWith("status --porcelain")) return { status: 0, stdout: (answers.working ?? []).map((name) => ` M ${name}`).join("\n") };
    throw new Error(`the lane asked git something this test does not answer: ${command}`);
  };
}

describe("the cad lane runs the fixture regeneration when a fixture could have moved", () => {
  test.each([
    ["the BNBC generator package", "fixtures/gen/rcc6_bnbc/sheets.py"],
    ["the F-RCC6 generator", "fixtures/gen/rcc6.py"],
    ["the committed corpus", "fixtures/rcc6-bnbc/manifest.json"],
    ["the other corpus", "fixtures/rcc6/rcc6.dxf"],
    ["the extractor the generator imports", "cad/src/vextrus_cad/geometry.py"],
    ["the BNBC suite", "cad/tests/rcc6_bnbc/test_rcc6_bnbc_size.py"],
    ["the regeneration test itself", "cad/tests/sanity/test_rcc6_bnbc_regenerate.py"],
  ])("%s moving arms it", (_what, path) => {
    expect(touchesFixtureInputs([path])).toBe(true);
    expect(touchesFixtureInputs(["src/app/page.tsx", path, "docs/README.md"])).toBe(true);
  });

  test.each([["a screen", "src/app/page.tsx"], ["the gate itself", "scripts/verify.mjs"], ["a journey", "tests/e2e/j-001.spec.ts"], ["a cad test that reads committed bytes", "cad/tests/sanity/test_rcc6_dxf_sanity.py"], ["another fixture", "fixtures/model/model.json"]])("%s moving does not", (_what, path) => {
    expect(touchesFixtureInputs([path])).toBe(false);
  });

  test("nothing moved at all is not a reason to regenerate", () => {
    expect(touchesFixtureInputs([])).toBe(false);
  });
});

describe("what the diff is taken against", () => {
  test("on a lane branch: everything the branch changed against main, plus the working tree", () => {
    const seen: string[] = [];
    const git = fakeGit({ branch: "v22/speed-verify", committed: ["scripts/verify.mjs"], working: ["cad/src/vextrus_cad/model.py"] });
    const paths = changedPaths("/nowhere", (argv) => {
      seen.push(argv.join(" "));
      return git(argv);
    });
    expect(seen, "a lane branch must be diffed against its merge-base with main").toContain("merge-base HEAD main");
    expect(seen).toContain("diff --name-only cafef00d..HEAD");
    expect(paths).toEqual(["scripts/verify.mjs", "cad/src/vextrus_cad/model.py"]);
  });

  test("on main: the commit being gated, not the whole history", () => {
    const seen: string[] = [];
    changedPaths("/nowhere", (argv) => {
      seen.push(argv.join(" "));
      return fakeGit({ branch: "main", committed: ["src/app/page.tsx"] })(argv);
    });
    expect(seen).toContain("rev-parse HEAD^");
    expect(seen).toContain("diff --name-only deadbeef..HEAD");
    expect(seen, "main has no merge-base with itself worth asking for").not.toContain("merge-base HEAD main");
  });

  test("an uncommitted edit counts — the gate is run mid-edit more often than on a clean tree", () => {
    const lane = cadLane("/nowhere", fakeGit({ committed: [], working: ["fixtures/gen/rcc6_bnbc/__main__.py"] }));
    expect(lane.regenerate).toBe(true);
  });
});

describe("a git that cannot answer never buys a skip", () => {
  test.each(["rev-parse --abbrev-ref", "merge-base", "diff --name-only", "status --porcelain"])("%s failing regenerates", (failing) => {
    expect(changedPaths("/nowhere", fakeGit({ fails: failing }))).toBeNull();
    const lane = cadLane("/nowhere", fakeGit({ fails: failing }));
    expect(lane.regenerate, "an unknown diff was read as an empty one").toBe(true);
    expect(lane.note).toBeNull();
  });
});

describe("what the lane then runs, and what it says about it", () => {
  test("a moved fixture: the whole suite, deselecting nothing", () => {
    const lane = cadLane("/nowhere", fakeGit({ committed: ["cad/src/vextrus_cad/report.py"] }));
    expect(lane.argv).toEqual(["pytest", "cad"]);
    expect(lane.note).toBeNull();
  });

  test("nothing moved: the same suite, with the regeneration deselected and said out loud", () => {
    const lane = cadLane("/nowhere", fakeGit({ committed: ["src/app/page.tsx"], working: ["docs/x.md"] }));
    expect(lane.argv).toEqual(["pytest", "cad", ...FIXTURE_REGENERATION_TESTS.map((test) => `--ignore=${test}`)]);
    expect(lane.note).toBe(REGENERATION_SKIPPED_LINE);
    // The paths are the ones the LANE is invoked with (from the checkout), not pytest's rootdir
    // node ids — a `--deselect` spelled the other way deselects nothing and says nothing about it.
    for (const test of FIXTURE_REGENERATION_TESTS) expect(existsSync(join(REPO_ROOT, test)), `${test} is not a file the lane could ignore`).toBe(true);
  });

  test("the suite itself is never narrowed — everything that reads committed bytes still runs", () => {
    expect(cadPytestArgv({ regenerate: false })[1]).toBe("cad");
    expect(cadPytestArgv({ regenerate: true })).toEqual(["pytest", "cad"]);
  });
});
