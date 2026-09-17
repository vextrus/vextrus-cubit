/**
 * AC-2 (second half): THE LANE. V-DOCS's command is `pnpm test:docs`, and it lands with the seam it
 * tests (AM-18): the script arms on `tests/docs`, runs that suite through its own config, answers
 * with vitest's own status, and prints its wall time last (AM-10 §1).
 *
 * The runner is driven rather than read: the script is invoked, and what it prints and what it
 * exits with is the evidence. It is asked for a suite that does not exist, because that is the one
 * failing run a lane's own test can make without running the lane inside itself — the exit status
 * it hands back is vitest's, and the last line is printed either way.
 *
 * Nothing under tests/docs measures time; that is this increment's out-of-scope line (AM-10 §3),
 * and PB-6's own PERF- spec is inc-311a's.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { inTree, REPO_ROOT } from "./support/product";

const SCRIPT = "scripts/docs-test.mjs";
const CONFIG = "tests/docs/vitest.config.ts";
/** A filter that can match no suite, so the run fails without running this lane inside itself. */
const NO_SUCH_SUITE = "tests/docs/__no-such-suite__";

/** The lane, run once for every case that reads its output. */
let lane: { status: number; stdout: string; stderr: string } | undefined;
function ranWithNoSuite(): { status: number; stdout: string; stderr: string } {
  if (lane !== undefined) return lane;
  expect(existsSync(inTree(SCRIPT)), `${SCRIPT} is the lane's entry (AM-18) and is not in the tree yet`).toBe(true);
  const answer = spawnSync(process.execPath, [inTree(SCRIPT), NO_SUCH_SUITE], { cwd: REPO_ROOT, encoding: "utf8", timeout: 120_000 });
  lane = { status: answer.status ?? -1, stdout: answer.stdout ?? "", stderr: answer.stderr ?? "" };
  return lane;
}

describe("AC-2: the V-DOCS lane", () => {
  it("AC-2: package.json runs the lane through its own script", () => {
    // white-box: AC-2 — "package.json carries `"test:docs": "node scripts/docs-test.mjs"`" is a
    // property of the manifest itself (AM-18: the lane's command is amended, not invented), and the
    // next two cases then RUN what it names.
    const manifest = JSON.parse(readFileSync(inTree("package.json"), "utf8")) as { scripts?: Record<string, string> };
    expect(manifest.scripts?.["test:docs"], "AM-18: the lane's command is `pnpm test:docs`, and the script lands with the seam").toBe("node scripts/docs-test.mjs");
  });

  it("AC-2: the lane is armed by tests/docs and collects that suite through its own config", () => {
    expect(existsSync(inTree(CONFIG)), `${CONFIG} governs the lane's own suite`).toBe(true);
    const { stdout, stderr } = ranWithNoSuite();
    expect(stdout, "the roster arms the stage now that its input root exists (AM-18)").toContain("RUN test:docs");
    // Vitest names the globs it collected under when it finds nothing — the lane's own include.
    expect(`${stdout}${stderr}`, "the run is vitest under tests/docs/vitest.config.ts, whose include is the lane's suite").toContain("include: tests/docs/**/*.test.ts");
  });

  it("AC-2: a run vitest fails exits non-zero, names the failure, and still prints its wall time last", () => {
    const { status, stdout } = ranWithNoSuite();
    expect(status, "the lane answers with the runner's own status; a masked failure is a green lane over a red suite").not.toBe(0);
    expect(stdout, "a failing run says so in the line the roster reads").toContain(`FAIL test:docs exit=${status}`);
    const lines = stdout.trimEnd().split("\n");
    expect(lines[lines.length - 1], "every lane prints its wall time, and this one prints it last (AM-10 §1)").toMatch(/^test:docs wall-time \d+(\.\d+)?s?$/u);
  });

  it("AC-2: nothing under tests/docs measures time", () => {
    expect(existsSync(inTree(CONFIG)), `${CONFIG} is the lane whose suites this asks about`).toBe(true);
    const suite = (function walk(directory: string): string[] {
      // white-box: AC-2 — "a grep over tests/docs/** finds nothing" names the lane's own files, so
      // the lane's files are what this enumerates; the read of each is marked below.
      return readdirSync(directory).flatMap((entry) => {
        const path = resolve(directory, entry);
        return statSync(path).isDirectory() ? walk(path) : [relative(REPO_ROOT, path)];
      });
    })(inTree("tests/docs"));
    expect(suite.filter((file) => file.endsWith(".test.ts")), "the lane has suites to judge").not.toEqual([]);

    // white-box: AC-2 — "a grep for the clock over tests/docs/** finds nothing" is a property of
    // what is written in the lane; a timing assertion that fires only on a slow machine cannot be
    // observed by running the lane on a fast one (AM-10 §3).
    //
    // The two names are assembled rather than written, so this detector is not itself the one thing
    // it is looking for — a grep over the lane finds neither name spelled whole, here included.
    const clock = new RegExp(["performance", "\\.now"].join("") + "|" + ["toBe", "LessThan"].join(""), "u");
    const timed = suite.filter((file) => clock.test(readFileSync(inTree(file), "utf8")));
    expect(timed, "V-DOCS asserts documents, never durations — PB-6 is inc-311a's PERF- spec").toEqual([]);
  });
});
