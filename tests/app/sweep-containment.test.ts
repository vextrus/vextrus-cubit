// What a debt sweep may move: the rows it was funded for, and nothing else. The rows whose only
// cure would change a committed Design Decision are excluded by the plan, so the files that hold
// those Decisions' shipped form have to come out of the sweep byte-identical.
//
// The guard is armed by the sweep's own diff. B-20 grants a later increment the right to change law
// and re-baseline the acceptance that froze it, so a containment rule that judged every branch
// would forbid what the Bible grants (arbitration on this file, attempt 3): every clause below is
// asked only of the branch that introduces this sweep's own module, and is silent on any other.
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { expect, test } from "vitest";
import { repoPath } from "./support/source-facts";

/** The module this sweep adds, and nothing else in the tree's history does: the sweep's sentinel. */
const SENTINEL = "src/app/theme-resolver.ts";

/** The files whose rows the plan excluded — each one a Decision's shipped form (see the spec). */
const EXCLUDED = [
  "src/app/(auth)/s-auth.css",
  "src/app/(app)/t/[tenant]/home/home.css",
  "src/app/(auth)/auth-frame.tsx",
  "src/app/(app)/t/[tenant]/settings/members/page.tsx",
];

interface Change {
  readonly status: string;
  readonly path: string;
}

function git(...args: string[]): string {
  return execFileSync("git", args, { cwd: repoPath("."), encoding: "utf8" });
}

/** Where this branch left the trunk; recomputed every run, so the guard never freezes a commit. */
const BASE = git("merge-base", "main", "HEAD").trim();

/** What this branch did to a path, as name-status pairs. */
function changed(path: string): Change[] {
  return git("diff", "--name-status", BASE, "--", path)
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => {
      const [status, ...rest] = line.split("\t");
      return { status: status ?? "", path: rest.at(-1) ?? "" };
    });
}

/**
 * Is this branch the sweep? Only the branch that ADDS the sentinel is; a branch cut after the merge
 * finds the module already in the tree, so its own diff adds nothing and every clause below stands
 * down (the arbitration's requirement, tested directly).
 */
function armedBy(changes: readonly Change[]): boolean {
  return changes.some((change) => change.status.startsWith("A") && change.path === SENTINEL);
}

const armed = armedBy(changed(SENTINEL));

test("AC-6: the guard reads the sweep, and stands down on a branch that is not it", () => {
  expect(armedBy([{ status: "A", path: SENTINEL }]), "the branch that introduces the sweep's module is the sweep").toBe(true);
  expect(armedBy([{ status: "M", path: SENTINEL }]), "a later branch that edits the module is not this sweep").toBe(false);
  expect(armedBy([]), "a branch that touches nothing of the sweep's is not this sweep").toBe(false);

  // The premise the clauses below are judgeable against: once the sweep has landed, its module is in
  // the tree on every branch cut from it.
  expect(existsSync(repoPath(SENTINEL)), `${SENTINEL} is not in the tree — the sweep has not landed`).toBe(true);
});

test("AC-6: the excluded rows' files come out of the sweep byte-identical", () => {
  if (!armed) return;
  for (const file of EXCLUDED) {
    expect(changed(file), `${file} holds a Decision this sweep does not own, and it moved`).toEqual([]);
  }
});

test("AC-6: no visual baseline moved, and no test that existed before the sweep was touched", () => {
  if (!armed) return;
  expect(changed("tests/e2e/baselines"), "a sweep that changes no law re-baselines nothing (B-20)").toEqual([]);

  const rewritten = changed("tests").filter((change) => !change.status.startsWith("A"));
  expect(rewritten, "a test that existed before the sweep may not be modified or deleted to make it pass (Q-08)").toEqual([]);
});

test("AC-6: every test the sweep adds sits beside its subject and is named by it", () => {
  if (!armed) return;
  const added = [...changed("tests"), ...changed("src")].filter((change) => change.status.startsWith("A") && /\.test\.tsx?$/.test(change.path));
  expect(added.length, "a sweep with a test beside every fix adds at least one test").toBeGreaterThan(0);

  for (const suite of added) {
    expect(/\binc-/i.test(suite.path), `${suite.path} names a build id rather than its subject (Q-17)`).toBe(false);
    expect(/^(tests\/app\/|src\/app\/)/.test(suite.path), `${suite.path} is not beside the subject this sweep owns`).toBe(true);
  }
});
