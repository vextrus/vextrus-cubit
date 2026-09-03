/**
 * The limiter's source is text (Q-17's honesty applied to the file itself): a byte `text` cannot
 * carry makes git render the whole file as a binary diff, and a change nobody can read in a diff is
 * a change nobody reviewed.
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

/** The path the criterion names, spelled once, repo-relative as git reports it. */
const LIMITER = "src/server/auth/rate-limit.ts";

/** The line this sweep's work is measured against; a checkout may hold it under either name. */
function baseRef(): string {
  for (const ref of ["main", "origin/main"]) {
    const found = spawnSync("git", ["rev-parse", "--verify", "--quiet", `${ref}^{commit}`], { cwd: REPO_ROOT, encoding: "utf8" });
    if (found.status === 0) return ref;
  }
  throw new Error("neither main nor origin/main resolves in this checkout, so the diff this criterion reads cannot be taken");
}

describe("the limiter's file stays something git and grep can read", () => {
  test("AC-1(c): rate-limit.ts carries no NUL byte", () => {
    const bytes = readFileSync(join(REPO_ROOT, LIMITER));
    const offsets = [...bytes.entries()].filter(([, byte]) => byte === 0).map(([at]) => at);
    expect(offsets, `${LIMITER} holds NUL bytes at ${offsets.join(", ")}`).toEqual([]);
  });

  test("AC-1(c): git reports this sweep's change to rate-limit.ts as line counts, never as a binary diff", () => {
    const diff = spawnSync("git", ["diff", "--numstat", baseRef(), "--", LIMITER], { cwd: REPO_ROOT, encoding: "utf8" });
    expect(diff.status, `git diff refused: ${diff.stderr}`).toBe(0);

    const row = diff.stdout
      .split("\n")
      .map((line) => line.split("\t"))
      .find((fields) => fields[2] === LIMITER);

    expect(row, `${LIMITER} carries this sweep's work, so a diff against the base names it`).toBeDefined();
    const [added, removed] = row as string[];
    expect([added, removed], `numstat answers "-\t-" for a file git reads as binary`).toEqual([expect.stringMatching(/^\d+$/), expect.stringMatching(/^\d+$/)]);
  });
});
