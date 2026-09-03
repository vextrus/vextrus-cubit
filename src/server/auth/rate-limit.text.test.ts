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

/** The one base every checkout holds, derived rather than transcribed: git's empty tree. */
function emptyTree(): string {
  const hashed = spawnSync("git", ["hash-object", "-t", "tree", "--stdin"], { cwd: REPO_ROOT, input: "", encoding: "utf8" });
  expect(hashed.status, `git hash-object refused: ${hashed.stderr}`).toBe(0);
  return hashed.stdout.trim();
}

/** The numstat row for the limiter, or undefined when git printed none. */
function numstatRow(base: string): string[] | undefined {
  const diff = spawnSync("git", ["diff", "--numstat", base, "--", LIMITER], { cwd: REPO_ROOT, encoding: "utf8" });
  expect(diff.status, `git diff refused: ${diff.stderr}`).toBe(0);
  return diff.stdout
    .split("\n")
    .map((line) => line.split("\t"))
    .find((fields) => fields[2] === LIMITER);
}

/** The base names a checkout may hold, spelled once so the skip reason can name the same set. */
const BASE_REFS = ["main", "origin/main"] as const;

/** A base a checkout may or may not hold: detached and fork checkouts have neither name. */
function baseRef(): string | undefined {
  for (const ref of BASE_REFS) {
    const found = spawnSync("git", ["rev-parse", "--verify", "--quiet", `${ref}^{commit}`], { cwd: REPO_ROOT, encoding: "utf8" });
    if (found.status === 0) return ref;
  }
  return undefined;
}

describe("the limiter's file stays something git and grep can read", () => {
  test("AC-1(c): rate-limit.ts carries no NUL byte", () => {
    const bytes = readFileSync(join(REPO_ROOT, LIMITER));
    const offsets = [...bytes.entries()].filter(([, byte]) => byte === 0).map(([at]) => at);
    expect(offsets, `${LIMITER} holds NUL bytes at ${offsets.join(", ")}`).toEqual([]);
  });

  test("AC-1(c): git renders rate-limit.ts as line counts, never as a binary diff", () => {
    // Against the empty tree a tracked text file always yields "N\t0\t<path>", and a file git reads
    // as binary always yields "-\t-\t<path>" — so the property holds from any branch, on any day.
    const row = numstatRow(emptyTree());

    expect(row, `${LIMITER} is tracked, so git counts its lines rather than answering -\t-`).toBeDefined();
    const [added, removed] = row as string[];
    expect([added, removed], `numstat answers "-\t-" for a file git reads as binary`).toEqual([expect.stringMatching(/^\d+$/), expect.stringMatching(/^\d+$/)]);
  });

  // Skippable corroboration only: the empty-tree case above carries AC-1(c)'s proof unconditionally.
  // A checkout that holds no base reports a skip, never a pass — a green line for a run in which no
  // assertion executed would be a claim nobody made.
  test("AC-1(c) corroboration: where the limiter does differ from the base, that diff too is line counts", (ctx) => {
    const base = baseRef();
    if (base === undefined) {
      ctx.skip(`no base commit here: neither ${BASE_REFS.join(" nor ")} resolves in this checkout, so there is no base diff to read — this says nothing about whether ${LIMITER} is readable`);
      return;
    }

    const row = numstatRow(base);
    if (row === undefined) {
      // Silence is the lawful state "identical to the base" — not a missing file. Prove both, so a
      // misspelled path can never make this vacuous.
      const quiet = spawnSync("git", ["diff", "--quiet", base, "--", LIMITER], { cwd: REPO_ROOT, encoding: "utf8" });
      expect(quiet.status, `git printed no numstat row for ${LIMITER} yet reports a difference`).toBe(0);
      const tracked = spawnSync("git", ["ls-files", "--error-unmatch", "--", LIMITER], { cwd: REPO_ROOT, encoding: "utf8" });
      expect(tracked.status, `${LIMITER} is not tracked, so the silent diff proves nothing`).toBe(0);
      return;
    }

    const [added, removed] = row;
    expect([added, removed], `numstat answers "-\t-" for a file git reads as binary`).toEqual([expect.stringMatching(/^\d+$/), expect.stringMatching(/^\d+$/)]);
  });
});
