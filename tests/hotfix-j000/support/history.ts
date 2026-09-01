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

/**
 * This increment's own acceptance file. It does not SELECT the end of the interval — a selector
 * keyed on "the mainline commit that first tracks this path" equals the landing commit only under a
 * non-fast-forward merge, which no clause pins, and under a fast-forward landing it would pin to
 * whichever early branch commit added the file and hand the readings a range with none of the repair
 * in it. It survives as the subject of a loud assertion instead: whatever commit closes the interval
 * must actually track this file, or the interval is not this increment's.
 */
export const FIX_MARKER = "tests/hotfix-j000/ac2-forward-only.test.ts";

/** Where the mainline is looked for, in the order a checkout is likeliest to answer with it. */
const MAINLINE_REFS = ["main", "origin/main"] as const;

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

/** Does a revision already contain the checkout's HEAD — i.e. has this work landed there? */
export function contains(rev: string): boolean {
  try {
    git("merge-base", "--is-ancestor", "HEAD", rev);
    return true;
  } catch {
    return false;
  }
}

/**
 * The far end of the interval this increment is judged over: the OLDEST mainline commit that
 * contains this branch's HEAD — the commit by which this work had landed, however it landed. Under a
 * merge that is the merge commit; under a fast-forward it is the branch's own last commit sitting on
 * the mainline; either way the whole repair is inside `PRE_FIX..FIX_END` and none of a later
 * milestone's work is. While the branch is unmerged — which is how the gate sees it — no mainline
 * commit contains HEAD and the answer is `HEAD`, so the live branch is graded exactly as strictly as
 * it would be without this reading.
 *
 * Naming an end matters because J-000 is "extended per milestone" (its Bible clause): a later
 * increment lawfully adds J-000 specs and re-baselines them, and a reading anchored at `HEAD` would
 * turn that lawful extension into a red no actor may clear. What this increment claims is a property
 * of `PRE_FIX..FIX_END`, and that is the range these readings ask about.
 */
export const FIX_END: string = ((): string => {
  for (const ref of MAINLINE_REFS) {
    if (!resolves(ref)) continue;
    try {
      // Nothing on a mainline that does not itself contain HEAD can contain HEAD either, and this
      // is the gate's own case: one question, not one per commit in the history.
      if (!contains(ref)) continue;
      // Oldest first along the ref's own spine. Each first-parent commit is an ancestor of the next,
      // so "contains HEAD" is false up to the landing and true from it on — monotone, hence found by
      // halving rather than by walking.
      const spine = gitLines("rev-list", "--first-parent", "--reverse", ref);
      let low = 0;
      let high = spine.length - 1;
      let landing: string | undefined;
      while (low <= high) {
        const middle = Math.floor((low + high) / 2);
        const candidate = spine[middle];
        if (candidate === undefined) break;
        if (contains(candidate)) {
          landing = candidate;
          high = middle - 1;
        } else {
          low = middle + 1;
        }
      }
      if (landing !== undefined) return landing;
    } catch {
      // A ref git cannot walk is simply not the mainline this reading is looking for.
    }
  }
  return "HEAD";
})();

/**
 * The paths `git status` reports, read WITHOUT trimming the answer: porcelain v1 puts two status
 * columns and a space before every path, and the first line's leading column is a space whenever the
 * change is unstaged. Trimming the whole answer — which is what `gitLines` does — would eat that
 * space and take the first character of the first path with it, and a path that arrives as
 * `ests/e2e/...` matches no frozen ground at all.
 */
function statusPaths(): string[] {
  const raw = execFileSync("git", ["status", "--porcelain=v1"], { cwd: REPO_ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  return raw.split("\n").filter((line) => line.length > 3).map((line) => line.slice(3).trimEnd());
}

/** Every path the branch's end state differs from the pre-fix merge in, repo-relative. */
export function changedSincePreFix(): string[] {
  const committed = gitLines("diff", "--name-only", `${PRE_FIX}..${FIX_END}`);
  // The uncommitted half belongs to the reading only while the interval ends at the working
  // checkout: a file the gate is about to commit is as much a change as one already in a commit.
  // Once the interval is closed by a landing commit, what some later checkout holds uncommitted is
  // outside the claim.
  const working = FIX_END === "HEAD" ? statusPaths() : [];
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
