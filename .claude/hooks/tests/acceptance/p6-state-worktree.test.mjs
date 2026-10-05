// Ticket T-LOCAL, section 3 C: `state.mjs` finds the drawings from a linked worktree. The real sets live
// only in the main checkout's `.private/`; a local builder's worktree has none of its own (and gets a
// `.private/work/verify/` once `verify` runs), so the hook asks git for the main checkout (the common git
// dir's parent) and tests that. The line names no path and no file from `.private/` (public-safe).
// Every repository here is made in a temporary folder; the helpers are copied from `_guard.mjs`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, realpathSync, rmdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const STATE = fileURLToPath(new URL("../../state.mjs", import.meta.url));
const LINE = "- real drawings (.private/): ";
const PRESENT = `${LINE}present (local session`;
const ABSENT = `${LINE}absent (cloud session: committed tests only)`;

function tempDir(prefix = "p6-state-") {
  return realpathSync(mkdtempSync(join(tmpdir(), prefix)));
}

function gitEnv(extra = {}) {
  const env = { ...process.env, ...extra };
  env.GIT_CONFIG_GLOBAL = "/dev/null";
  env.GIT_CONFIG_NOSYSTEM = "1";
  env.GIT_AUTHOR_NAME = "Acceptance";
  env.GIT_AUTHOR_EMAIL = "acceptance@example.invalid";
  env.GIT_COMMITTER_NAME = "Acceptance";
  env.GIT_COMMITTER_EMAIL = "acceptance@example.invalid";
  env.GIT_AUTHOR_DATE = "2026-10-05T00:00:00Z";
  env.GIT_COMMITTER_DATE = "2026-10-05T00:00:00Z";
  delete env.GIT_DIR;
  delete env.GIT_WORK_TREE;
  delete env.GIT_INDEX_FILE;
  return env;
}

function git(cwd, ...args) {
  const run = spawnSync("git", args, { cwd, env: gitEnv(), encoding: "utf8" });
  assert.equal(run.status, 0, `git ${args.join(" ")}: ${run.stderr}`);
  return run.stdout.trim();
}

function tempRepo({ branch = "main", files = { "docs/a.md": "a\n" } } = {}) {
  const repo = tempDir("p6-state-repo-");
  git(repo, "init", "-q", "-b", branch);
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(repo, path)), { recursive: true });
    writeFileSync(join(repo, path), text);
  }
  git(repo, "add", "--", ...Object.keys(files));
  git(repo, "commit", "-q", "-m", "base: the first commit");
  return { repo, base: git(repo, "rev-parse", "HEAD") };
}

/** A main checkout (with `.private/reference/<file>` when `drawings`) and a linked worktree inside it. */
function mainAndWorktree({ drawings }) {
  const { repo: main } = tempRepo({ files: { ".gitignore": ".private/\n.claude/worktrees/\n", "docs/a.md": "a\n" } });
  if (drawings) {
    mkdirSync(join(main, ".private", "reference"), { recursive: true });
    writeFileSync(join(main, ".private", "reference", "zz-invented-set-0042.dwg"), "not a drawing\n");
  }
  const worktree = join(main, ".claude", "worktrees", "t-local");
  git(main, "worktree", "add", "-q", "-b", "t-local", worktree);
  return { main, worktree };
}

/** Runs the hook with `project` as CLAUDE_PROJECT_DIR (undefined: unset) and `cwd` as its directory. */
function runState(project, cwd) {
  const bin = tempDir("p6-state-bin-");
  writeFileSync(join(bin, "gh"), "#!/bin/sh\nexit 1\n");
  chmodSync(join(bin, "gh"), 0o755);
  const env = gitEnv({ PATH: `${bin}:${process.env.PATH}` });
  delete env.CLAUDE_CODE_REMOTE;
  if (project === undefined) delete env.CLAUDE_PROJECT_DIR;
  else env.CLAUDE_PROJECT_DIR = project;
  const run = spawnSync(process.execPath, [STATE], { cwd, env, encoding: "utf8", timeout: 30_000 });
  assert.equal(run.status, 0, run.stderr);
  return run.stdout;
}

const drawingsLine = (stdout) => stdout.split("\n").find((line) => line.startsWith(LINE)) ?? "";

test("C1: a worktree of a main checkout that has .private/ reports the drawings present", () => {
  const { worktree } = mainAndWorktree({ drawings: true });
  const line = drawingsLine(runState(worktree, worktree));
  assert.ok(line.startsWith(PRESENT), line);
});

test("C1: the worktree's own .private/work/verify/ does not change the line", () => {
  const { worktree } = mainAndWorktree({ drawings: true });
  const before = drawingsLine(runState(worktree, worktree));
  const verify = join(worktree, ".private", "work", "verify");
  mkdirSync(verify, { recursive: true });
  const during = drawingsLine(runState(worktree, worktree));
  rmdirSync(verify);
  rmdirSync(join(worktree, ".private", "work"));
  rmdirSync(join(worktree, ".private"));
  const after = drawingsLine(runState(worktree, worktree));
  assert.ok(before.startsWith(PRESENT), before);
  assert.equal(during, before);
  assert.equal(after, before);
});

test("C1: a worktree of a main checkout without .private/ stays absent with its own .private/work/verify/", () => {
  const { worktree } = mainAndWorktree({ drawings: false });
  const verify = join(worktree, ".private", "work", "verify");
  mkdirSync(verify, { recursive: true });
  const line = drawingsLine(runState(worktree, worktree));
  rmdirSync(verify);
  rmdirSync(join(worktree, ".private", "work"));
  rmdirSync(join(worktree, ".private"));
  assert.equal(line, ABSENT);
});

test("C2: the main checkout with .private/ as the project reports present", () => {
  const { main } = mainAndWorktree({ drawings: true });
  const line = drawingsLine(runState(main, main));
  assert.ok(line.startsWith(PRESENT), line);
});

test("C2: a main checkout without .private/, and its worktree, report absent", () => {
  const { main, worktree } = mainAndWorktree({ drawings: false });
  assert.equal(drawingsLine(runState(main, main)), ABSENT);
  assert.equal(drawingsLine(runState(worktree, worktree)), ABSENT);
});

test("C2: a project folder outside any repository exits 0 and reports absent", () => {
  const folder = tempDir("p6-state-nogit-");
  const line = drawingsLine(runState(folder, folder));
  assert.equal(line, ABSENT);
});

test("C2: an empty CLAUDE_PROJECT_DIR from a non-git folder exits 0 and reports the hook's own checkout", () => {
  const folder = tempDir("p6-state-nogit-");
  const line = drawingsLine(runState("", folder));
  // The hook falls back to its own checkout; its main checkout has .private/ on the owner's machine only.
  const ownTop = fileURLToPath(new URL("../../../..", import.meta.url));
  const common = spawnSync("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], {
    cwd: ownTop,
    env: gitEnv(),
    encoding: "utf8",
  });
  const ownMain = common.status === 0 ? dirname(common.stdout.trim()) : ownTop;
  const expected = existsSync(join(ownMain, ".private")) ? PRESENT : ABSENT;
  assert.ok(line.startsWith(expected), `${line} (expected ${expected})`);
});

test("C3: the line names neither the main checkout's path nor a file from .private/", () => {
  const { main, worktree } = mainAndWorktree({ drawings: true });
  for (const [project, cwd] of [
    [worktree, worktree],
    [main, main],
  ]) {
    const stdout = runState(project, cwd);
    const line = drawingsLine(stdout);
    assert.ok(line.startsWith(PRESENT), line);
    assert.ok(!line.includes(main), line);
    assert.ok(!stdout.includes("zz-invented-set-0042"), stdout);
    assert.ok(!stdout.includes("reference/"), stdout);
  }
});
