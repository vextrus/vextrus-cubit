/**
 * The git readings this increment's acceptance is made of, spelled once (ARCH-02).
 *
 * The hotfix is judged as much by what it did NOT touch as by what it repaired: J-000's grading
 * surface is frozen at the pre-fix merge, the two live journeys may not be weakened, and a lawful
 * re-baseline has to arrive in a commit that says so. Every one of those readings is a question put
 * to git about the range `<pre-fix merge>..HEAD`, so the mechanics of asking live here and nothing
 * here judges an answer.
 */
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

/** The checkout under judgement — the lane runs at the root of it. */
export const REPO_ROOT: string = process.cwd();

/**
 * The pre-fix pin: the merge commit that put inc-010b on main and, with it, the breakage this
 * increment repairs. The increment's own criteria name this commit, so it is data here, not a
 * discovery — history is linear, and this is main's tip as the hotfix branched.
 */
export const PRE_FIX = "7af2a17";

/** One git command, answered as trimmed text; a non-zero exit is the caller's to catch. */
export function git(...args: readonly string[]): string {
  return execFileSync("git", args, { cwd: REPO_ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).trim();
}

/** The same, as the lines it answered with, empties dropped. */
export function gitLines(...args: readonly string[]): string[] {
  const answer = git(...args);
  return answer.length === 0 ? [] : answer.split("\n").filter((line) => line.length > 0);
}

/** Does the range resolve at all? A pin no commit answers to would make every reading vacuous. */
export function resolves(rev: string): boolean {
  try {
    git("rev-parse", "--verify", `${rev}^{commit}`);
    return true;
  } catch {
    return false;
  }
}

/** Every path the branch's end state differs from the pre-fix merge in, repo-relative. */
export function changedSincePreFix(): string[] {
  // Both halves matter: what the branch has committed, and what it holds uncommitted. A file the
  // gate is about to commit is as much a change as one already in a commit.
  const committed = gitLines("diff", "--name-only", `${PRE_FIX}..HEAD`);
  const working = gitLines("status", "--porcelain=v1").map((line) => line.slice(3).trim());
  const renamedTarget = (path: string): string => (path.includes(" -> ") ? (path.split(" -> ")[1] ?? path) : path);
  return [...new Set([...committed, ...working.map(renamedTarget)])].filter((path) => path.length > 0).sort();
}

/** Every commit subject on the branch, newest first, as `<sha> <subject>` pairs. */
export function branchCommits(): { sha: string; subject: string }[] {
  return gitLines("log", "--format=%H %s", `${PRE_FIX}..HEAD`).map((line) => {
    const space = line.indexOf(" ");
    return space === -1 ? { sha: line, subject: "" } : { sha: line.slice(0, space), subject: line.slice(space + 1) };
  });
}

/** The commit subjects on the branch that touched one path. */
export function commitsTouching(path: string): string[] {
  return gitLines("log", "--format=%s", `${PRE_FIX}..HEAD`, "--", path);
}

/** What a path held at a revision, or null where the revision has no such file. */
export function blobAt(rev: string, path: string): string | null {
  try {
    return execFileSync("git", ["show", `${rev}:${path}`], { cwd: REPO_ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  } catch {
    return null;
  }
}

/** The object id of a path at a revision, or null where it is absent there. */
export function objectIdAt(rev: string, path: string): string | null {
  try {
    return git("rev-parse", `${rev}:${path}`);
  } catch {
    return null;
  }
}

/** The object id of the path as it stands in the working tree, or null where it is absent. */
export function objectIdInTree(path: string): string | null {
  const absolute = join(REPO_ROOT, path);
  if (!existsSync(absolute)) return null;
  return git("hash-object", "--", path);
}

/** Every file git tracked at a revision under a prefix. */
export function filesAt(rev: string, prefix: string): string[] {
  return gitLines("ls-tree", "-r", "--name-only", rev, "--", prefix);
}

/**
 * Source with its comments taken out, so a scan reads what a file DOES rather than what it says
 * about itself — a rule named in prose is not a rule the file applies.
 */
export function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
}

/** How many times a bare identifier is called in source, comments excluded. */
export function callCount(source: string, identifier: string): number {
  const bare = withoutComments(source);
  const pattern = new RegExp(`\\b${identifier}\\s*\\(`, "g");
  return bare.match(pattern)?.length ?? 0;
}

/** Every string literal handed to a named call, in the order they appear. */
export function literalArgumentsOf(source: string, identifier: string): string[] {
  const bare = withoutComments(source);
  const pattern = new RegExp(`\\b${identifier}\\s*\\(\\s*(?:\\[\\s*)?(["'\`])((?:\\\\.|(?!\\1).)*)\\1`, "g");
  const found: string[] = [];
  for (const match of bare.matchAll(pattern)) found.push(match[2] ?? "");
  return found;
}

/**
 * Does a repo-relative path match a glob of the shape this product's vitest configs are written in
 * (`tests/**\/*.test.ts`)? Only the three operators those globs use are honoured, because a matcher
 * that guessed at more would answer questions the configs never ask.
 */
export function matchesGlob(path: string, glob: string): boolean {
  // One pass, longest operator first: a two-step rewrite would have to park a sentinel in the
  // string, and a sentinel is a token the glob itself could have carried.
  const expression = glob
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*\/|\*\*|\*/g, (token) => (token === "**/" ? "(?:.*/)?" : token === "**" ? ".*" : "[^/]*"));
  return new RegExp(`^${expression}$`).test(path);
}
