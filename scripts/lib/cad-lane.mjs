// What the cad lane runs, and the one question that decides its price (V-VERIFY, v22 speed).
//
// THE COST THIS FILE EXISTS FOR. `pytest cad` collects the fixture-regeneration tests, and one of
// them — cad/tests/sanity/test_rcc6_bnbc_regenerate.py — runs the F-RCC6-BNBC generator end to end:
// 27 sheets of DXF, DWG, vector PDF and rasters, ~80 seconds of the lane's ~100. It ran on EVERY
// gate, including the overwhelming majority that touch nothing a generator reads. That is the
// whole cad lane's wall paid to re-prove a corpus that could not have moved.
//
// WHAT IS AND IS NOT GIVEN UP. Regeneration is the claim "the committed corpus is what the
// committed generator writes". It can only break when the generator, the model it reads, the
// corpus itself, or the extractor package underneath moves — so the lane asks git whether any of
// them did, and runs the regeneration when the answer is yes or when git cannot answer. The CHEAP
// half of the corpus's evidence is untouched and still runs every time: the golden lane reads the
// committed bytes against the manifest (tests/golden + cad/tests/rcc6_bnbc), and every sanity suite
// that reads the committed drawings runs exactly as before. What is skipped is the ~80 s
// recomputation, and only when nothing it reads has moved.
//
// The diff is taken the way the gate is actually used: on a lane branch, everything the branch
// changed against main (merge-base..HEAD) plus whatever the working tree carries on top of it; on
// main itself, the commit being gated (HEAD^..HEAD) plus the working tree. Uncommitted work always
// counts — the gate is run on trees mid-edit more often than on clean ones.
import { spawnSync } from "node:child_process";

/**
 * The tests that RECOMPUTE a fixture corpus from its generator, as pytest node ids. Everything else
 * under cad/tests reads committed bytes and costs milliseconds.
 */
export const FIXTURE_REGENERATION_TESTS = Object.freeze([
  "cad/tests/sanity/test_rcc6_bnbc_regenerate.py",
  "cad/tests/sanity/test_rcc6_regenerate.py",
]);

/**
 * The paths that could move what those tests recompute: the generators, the corpora they write, the
 * extractor package they import, the BNBC lane's own suite — and the regeneration tests themselves,
 * because a change to the test that makes the claim must run the claim.
 */
export const FIXTURE_REGENERATION_INPUTS = Object.freeze(["fixtures/gen/", "fixtures/rcc6", "cad/src/", "cad/tests/rcc6_bnbc/", ...FIXTURE_REGENERATION_TESTS]);

/** The line the lane prints when it has deselected them, naming what it looked at. */
export const REGENERATION_SKIPPED_LINE = "cad: fixture regeneration skipped — nothing under fixtures/gen, fixtures/rcc6*, cad/src moved (the golden lane still checks the committed corpus)";

/**
 * Could a fixture corpus have moved, given the paths a diff named? A path is a repo-relative,
 * forward-slashed name as `git diff --name-only` prints it.
 * @param {ReadonlyArray<string>} paths
 * @returns {boolean}
 */
export function touchesFixtureInputs(paths) {
  return paths.some((path) => {
    const name = path.replace(/\\/g, "/").replace(/^\.\//, "");
    return FIXTURE_REGENERATION_INPUTS.some((input) => name.startsWith(input));
  });
}

/**
 * The paths this tree has changed, as the gate means it. Null — never an empty list — when git
 * cannot answer: "I do not know what moved" and "nothing moved" are opposite verdicts, and only one
 * of them is allowed to skip work.
 * @param {string} root the checkout
 * @param {(argv: string[]) => {status: number | null, stdout: string}} [git] injected, so the
 *   decision is provable without a repository shaped like the one it is about
 * @returns {string[] | null}
 */
export function changedPaths(root, git) {
  const run =
    git ??
    ((argv) => {
      const result = spawnSync("git", argv, { cwd: root, encoding: "utf8" });
      return { status: result.error === undefined ? result.status : 1, stdout: result.stdout ?? "" };
    });
  const lines = (text) => text.split("\n").map((line) => line.trim()).filter((line) => line !== "");

  const head = run(["rev-parse", "--abbrev-ref", "HEAD"]);
  if (head.status !== 0) return null;
  // On a lane branch the gate judges the whole branch; on main it judges the commit being merged.
  const base = head.stdout.trim() === "main" ? run(["rev-parse", "HEAD^"]) : run(["merge-base", "HEAD", "main"]);
  if (base.status !== 0) return null;
  const committed = run(["diff", "--name-only", `${base.stdout.trim()}..HEAD`]);
  if (committed.status !== 0) return null;
  // Everything not yet committed, tracked or not: a gate run mid-edit must see the edit.
  const working = run(["status", "--porcelain", "--untracked-files=all"]);
  if (working.status !== 0) return null;
  // Porcelain's first two columns are the status and the third is a space, so the path starts at
  // column 3 — the line is NOT trimmed first, or a path would lose its own first characters.
  const changed = working.stdout
    .split("\n")
    .filter((line) => line.length > 3)
    .map((line) => (line.slice(3).split(" -> ").pop() ?? "").replace(/^"|"$/g, "").trim());
  return [...lines(committed.stdout), ...changed.filter((name) => name !== "")];
}

/**
 * The cad lane's pytest argv. `regenerate: false` drops the recomputation tests from the collection
 * — deselected rather than SKIPPED, deliberately: cad/tests/sanity/conftest.py fails any session
 * over a skip it cannot explain (a skip is a claim about this machine, and this is not one), and
 * work that was never selected is not a skip.
 *
 * `--ignore=<path>` and not `--deselect=<nodeid>`: cad/pyproject.toml carries the pytest
 * configuration, so pytest's rootdir is `cad/` and every collected node id is spelled
 * `tests/sanity/…` while the lane is invoked from the checkout with `cad/tests/sanity/…`. A
 * `--deselect` that misses simply deselects NOTHING, silently — the lane would print its skip line
 * and pay the 80 seconds anyway. `--ignore` takes a filesystem path, so it cannot miss quietly, and
 * it drops the module before it is even imported.
 * @param {{regenerate: boolean}} decision
 * @returns {string[]}
 */
export function cadPytestArgv(decision) {
  if (decision.regenerate) return ["pytest", "cad"];
  return ["pytest", "cad", ...FIXTURE_REGENERATION_TESTS.map((test) => `--ignore=${test}`)];
}

/**
 * What this tree's cad lane should run, and what it owes the reader for it.
 * @param {string} root
 * @param {(argv: string[]) => {status: number | null, stdout: string}} [git]
 * @returns {{argv: string[], regenerate: boolean, note: string | null}}
 */
export function cadLane(root, git) {
  const paths = changedPaths(root, git);
  const regenerate = paths === null || touchesFixtureInputs(paths);
  return { argv: cadPytestArgv({ regenerate }), regenerate, note: regenerate ? null : REGENERATION_SKIPPED_LINE };
}
