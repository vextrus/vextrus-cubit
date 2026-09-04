/**
 * AC-6: nothing outside the named rows moves.
 *
 * A debt sweep is bounded by its worklist. This file is the boundary, asserted rather than promised:
 * it reads what the branch actually changed against the point it left `main` and holds four things
 * still — the visual baselines (B-20: no owned Decision, copy or token changes, so a baseline that
 * moves means a deviation from the excluded-rows list), the tests that already existed (Q-08: a
 * check is never weakened to green a build), the four files whose only cure contradicts a committed
 * Design Decision or needs ground outside `src/app`, and the naming of the tests this sweep adds
 * (Q-17: a test is named by subject, never by increment id).
 *
 * It is a guard, so it passes on an untouched tree and fails the moment the sweep spills. The fifth
 * clause of AC-6 — `pnpm verify` exits 0 — is V-VERIFY itself and is run by the gate, not from
 * inside a suite it would recurse into.
 */
import { execFileSync } from "node:child_process";
import { describe, expect, test } from "vitest";
import { REPO_ROOT } from "../server/support/wire";

/** The rows the spec excludes with a reason: their files are byte-identical to main. */
const EXCLUDED: readonly string[] = [
  "src/app/(auth)/s-auth.css",
  "src/app/(app)/t/[tenant]/home/home.css",
  "src/app/(auth)/auth-frame.tsx",
  "src/app/(app)/t/[tenant]/settings/members/page.tsx",
];

/** Where a test this sweep adds may live — beside its subject, or in the app suite. */
const OWNED_TEST_DIRS: readonly string[] = ["src/app/", "tests/app/"];

function git(...args: string[]): string {
  return execFileSync("git", args, { cwd: REPO_ROOT, encoding: "utf8" });
}

/** The commit this branch left `main` at — the base every "did it move?" question is asked against. */
const BASE = git("merge-base", "main", "HEAD").trim();

/** Every path the branch has touched since the base, working tree included, with its status letter. */
function changed(...paths: string[]): { status: string; path: string }[] {
  const out = git("diff", "--name-status", BASE, "--", ...paths).trim();
  if (out === "") return [];
  return out.split("\n").map((line) => {
    const [status, ...rest] = line.split("\t");
    return { status: String(status), path: String(rest[rest.length - 1]) };
  });
}

/** Files that exist on the branch but not at the base — this sweep's own additions, untracked too. */
function added(): string[] {
  const tracked = changed(".").filter((entry) => entry.status.startsWith("A")).map((entry) => entry.path);
  const untracked = git("ls-files", "--others", "--exclude-standard").trim();
  return [...tracked, ...(untracked === "" ? [] : untracked.split("\n"))];
}

describe("AC-6: the sweep stays inside its worklist", () => {
  test("AC-6: no visual baseline moves", () => {
    expect(changed("tests/e2e/baselines"), "B-20: this sweep owns no Decision, copy or token, so every visual baseline is byte-identical to main").toStrictEqual([]);
  });

  test("AC-6: no test that existed on main is modified or deleted", () => {
    const disturbed = changed("tests").filter((entry) => !entry.status.startsWith("A"));
    expect(disturbed, `Q-08: an existing check is never weakened or removed to green a build — ${JSON.stringify(disturbed)}`).toStrictEqual([]);
  });

  test("AC-6: the excluded rows' files are byte-identical to main", () => {
    for (const file of EXCLUDED) {
      expect(changed(file), `${file} belongs to a row this sweep excludes with a reason — a half-fix here is a Decision change nobody granted (B-20)`).toStrictEqual([]);
    }
  });

  test("AC-6: every test this sweep adds is named by its subject and lives beside it", () => {
    // The held-out set is the engine's, not the product's: it is mounted outside a checkout and
    // never lands in the tree, so it is not one of the tests this criterion is about.
    const tests = added().filter((path) => /\.test\.tsx?$/.test(path) && !path.startsWith(".builder-heldout/"));
    for (const path of tests) {
      expect(
        OWNED_TEST_DIRS.some((dir) => path.startsWith(dir)),
        `a test this sweep adds lives beside its subject, under ${OWNED_TEST_DIRS.join(" or ")} — ${path} does not`,
      ).toBe(true);
      expect(/inc-/i.test(String(path.split("/").pop())), `Q-17: a test file is named by subject, never by increment id — ${path}`).toBe(false);
    }
  });
});
