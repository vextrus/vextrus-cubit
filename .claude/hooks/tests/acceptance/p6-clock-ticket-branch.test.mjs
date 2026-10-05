// Acceptance (ticket T-CLOCK, session 12 phase 6, section 3 B): a builder's clock shows its own budget. Local builders
// share one git folder, so the clock hook, `.claude/hooks/clock.mjs`, picks the budget record whose `branch` is the
// checkout's branch (newest `started_utc` first, mtime only breaking a tie); then a legacy record (no valid `branch`)
// whose ticket is a part of the branch; then, only in a cloud session (`CLAUDE_CODE_REMOTE=true`, which owns its git
// folder), the newest record; otherwise `no budget set`. A ticket id up to 80 characters shows; a `branch` that is not
// a string of at most 200 characters is ignored. `VEXTRUS_NOW_UTC` stands in for the wall clock, `VEXTRUS_NOW` for
// stamp's. The helpers are clock.test.mjs's, copied (never imported).
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = fileURLToPath(new URL("../../../../", import.meta.url));
const HOOK = join(REPO, ".claude/hooks/clock.mjs");
const NOW = "2026-10-04T22:42:00Z";
const PYTHON = process.env.VEXTRUS_PYTHON ?? "python3";
const INHERITED = ["CLAUDE_CODE_REMOTE", "VEXTRUS_ROLE", "CLAUDE_PROJECT_DIR", "VEXTRUS_NOW_UTC", "VEXTRUS_NOW", "VEXTRUS_PYTHON"];
const GIT_ENV = {
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_CONFIG_NOSYSTEM: "1",
  GIT_AUTHOR_NAME: "Fixture",
  GIT_AUTHOR_EMAIL: "fixture@example.invalid",
  GIT_COMMITTER_NAME: "Fixture",
  GIT_COMMITTER_EMAIL: "fixture@example.invalid",
  GIT_AUTHOR_DATE: "2026-10-04T12:00:00Z",
  GIT_COMMITTER_DATE: "2026-10-04T12:00:00Z",
};

function environment(extra = {}) {
  const env = { ...process.env, ...GIT_ENV };
  for (const name of INHERITED) delete env[name];
  for (const name of ["GIT_DIR", "GIT_WORK_TREE", "GIT_COMMON_DIR"]) delete env[name];
  for (const [name, value] of Object.entries(extra)) {
    if (value === undefined) delete env[name];
    else env[name] = value;
  }
  return env;
}

function git(cwd, ...args) {
  const done = spawnSync("git", args, { cwd, env: environment(), encoding: "utf8" });
  assert.equal(done.status, 0, `git ${args.join(" ")}: ${done.stderr}`);
  return done.stdout.trim();
}

/** A scratch git repository on main with one commit. */
function project() {
  const dir = mkdtempSync(join(tmpdir(), "p6-clock-"));
  git(dir, "init", "-q", "-b", "main");
  writeFileSync(join(dir, "README.md"), "fixture\n");
  git(dir, "add", "README.md");
  git(dir, "commit", "-q", "-m", "base");
  return dir;
}

/** A linked worktree of `main` on a new branch. */
function worktree(main, branch) {
  const dir = join(mkdtempSync(join(tmpdir(), "p6-clock-wt-")), "wt");
  git(main, "worktree", "add", "-q", "-b", branch, dir);
  return dir;
}

function budgetFolder(dir) {
  const common = git(dir, "rev-parse", "--git-common-dir");
  const folder = join(resolve(dir, common), "vextrus");
  mkdirSync(folder, { recursive: true });
  return folder;
}

/** A budget record written by hand, with its mtime set. */
function record(folder, body, mtime) {
  const file = join(folder, `budget-${body.ticket}.json`);
  writeFileSync(file, JSON.stringify({ schema: 1, ...body }));
  utimesSync(file, new Date(mtime), new Date(mtime));
}

function clock(dir, env = {}) {
  return spawnSync(process.execPath, [HOOK], {
    cwd: dir,
    input: JSON.stringify({ hook_event_name: "UserPromptSubmit", prompt: "go on", session_id: "s", cwd: dir }),
    env: environment({ CLAUDE_PROJECT_DIR: dir, VEXTRUS_NOW_UTC: NOW, VEXTRUS_ROLE: "builder", ...env }),
    encoding: "utf8",
    timeout: 15_000,
  });
}

/** The printed line, with at most one trailing newline allowed. */
function line(done) {
  assert.equal(done.status, 0, `exit ${done.status}; stderr: ${done.stderr}`);
  assert.doesNotMatch(done.stderr, /\n\s+at |Error:/, "no stack trace");
  const out = done.stdout.replace(/\r?\n$/, "");
  assert.doesNotMatch(out, /\n/, "one line only");
  return out;
}

/** Two local builders on one machine: T-HOOKS on s12-p6-hooks, T-LAND (newer) on s12-p6-land. */
function twoBuilders() {
  const main = project();
  const hooks = worktree(main, "s12-p6-hooks");
  const land = worktree(main, "s12-p6-land");
  const folder = budgetFolder(main);
  record(folder, { ticket: "T-HOOKS", minutes: 90, started_utc: "2026-10-04T21:30:00Z", branch: "s12-p6-hooks" }, "2026-10-04T21:30:00Z");
  record(folder, { ticket: "T-LAND", minutes: 45, started_utc: "2026-10-04T22:00:00Z", branch: "s12-p6-land" }, "2026-10-04T22:00:00Z");
  return { main, hooks, land, folder };
}

// B1
test("two local builders: each worktree's clock shows the record naming its own branch", () => {
  const { hooks, land } = twoBuilders();
  assert.equal(line(clock(hooks)), "now 2026-10-04 22:42Z · ticket T-HOOKS 72/90 min");
  assert.equal(line(clock(land)), "now 2026-10-04 22:42Z · ticket T-LAND 42/45 min");
});

// B2
test("one branch, a writer's and a builder's record: the newest started_utc wins over a newer mtime", () => {
  const main = project();
  const dir = worktree(main, "s12-p6-x");
  const folder = budgetFolder(main);
  record(folder, { ticket: "T-X-writer", minutes: 20, started_utc: "2026-10-04T21:00:00Z", branch: "s12-p6-x" }, "2026-10-04T22:30:00Z");
  record(folder, { ticket: "T-X", minutes: 90, started_utc: "2026-10-04T21:30:00Z", branch: "s12-p6-x" }, "2026-10-04T21:30:00Z");
  assert.equal(line(clock(dir)), "now 2026-10-04 22:42Z · ticket T-X 72/90 min");
});

test("one branch, two records started at the same time: the newer mtime breaks the tie", () => {
  const main = project();
  const dir = worktree(main, "s12-p6-x");
  const folder = budgetFolder(main);
  record(folder, { ticket: "T-X", minutes: 90, started_utc: "2026-10-04T21:30:00Z", branch: "s12-p6-x" }, "2026-10-04T21:30:00Z");
  record(folder, { ticket: "T-X-writer", minutes: 20, started_utc: "2026-10-04T21:30:00Z", branch: "s12-p6-x" }, "2026-10-04T21:31:00Z");
  assert.equal(line(clock(dir)), "now 2026-10-04 22:42Z · ticket T-X-writer 72/20 min OVER");
});

// B3
test("a local builder whose branch no record names: no budget set, never another builder's", () => {
  const { main } = twoBuilders();
  const other = worktree(main, "s12-p6-other");
  // A record naming another branch is not shown even when its ticket is a part of this branch.
  record(budgetFolder(main), { ticket: "other", minutes: 30, started_utc: "2026-10-04T22:10:00Z", branch: "s12-p6-hooks" }, "2026-10-04T22:10:00Z");
  const done = clock(other);
  assert.equal(line(done), "now 2026-10-04 22:42Z · no budget set");
});

test("a cloud session with the same records: the newest record (it owns its git folder)", () => {
  const { main } = twoBuilders();
  const other = worktree(main, "s12-p6-other");
  assert.equal(line(clock(other, { CLAUDE_CODE_REMOTE: "true" })), "now 2026-10-04 22:42Z · ticket T-LAND 42/45 min");
});

// B4
test("a 56-character ticket id with its branch is shown", () => {
  const main = project();
  const dir = worktree(main, "s12-p6-long");
  const ticket = `T-${"L".repeat(54)}`;
  assert.equal(ticket.length, 56);
  record(budgetFolder(main), { ticket, minutes: 90, started_utc: "2026-10-04T21:30:00Z", branch: "s12-p6-long" }, "2026-10-04T21:30:00Z");
  assert.equal(line(clock(dir)), `now 2026-10-04 22:42Z · ticket ${ticket} 72/90 min`);
});

test("an 81-character ticket id is not shown", () => {
  const main = project();
  const dir = worktree(main, "s12-p6-long");
  const ticket = `T-${"L".repeat(79)}`;
  assert.equal(ticket.length, 81);
  record(budgetFolder(main), { ticket, minutes: 90, started_utc: "2026-10-04T21:30:00Z", branch: "s12-p6-long" }, "2026-10-04T21:30:00Z");
  assert.equal(line(clock(dir)), "now 2026-10-04 22:42Z · no budget set");
});

test("a branch that is not a string is ignored: the record matches as a legacy one, by ticket in the branch", () => {
  const main = project();
  const dir = worktree(main, "s12-p6-hooks");
  record(budgetFolder(main), { ticket: "hooks", minutes: 90, started_utc: "2026-10-04T21:30:00Z", branch: 7 }, "2026-10-04T21:30:00Z");
  assert.equal(line(clock(dir)), "now 2026-10-04 22:42Z · ticket hooks 72/90 min");
});

test("a branch over 200 characters is ignored, even when it equals the checkout's branch", () => {
  const main = project();
  const long = `hooks-${"b".repeat(195)}`;
  assert.equal(long.length, 201);
  const dir = worktree(main, long);
  const folder = budgetFolder(main);
  record(folder, { ticket: "T-OTHER", minutes: 90, started_utc: "2026-10-04T21:30:00Z", branch: long }, "2026-10-04T21:30:00Z");
  assert.equal(line(clock(dir)), "now 2026-10-04 22:42Z · no budget set");
  record(folder, { ticket: "hooks", minutes: 45, started_utc: "2026-10-04T22:00:00Z", branch: long }, "2026-10-04T22:00:00Z");
  assert.equal(line(clock(dir)), "now 2026-10-04 22:42Z · ticket hooks 42/45 min");
});

// B5
test("legacy records (no branch): a ticket equal to a part of the branch still matches over a newer one", () => {
  const main = project();
  const dir = worktree(main, "s12-f6-fixture");
  const folder = budgetFolder(main);
  record(folder, { ticket: "f6", minutes: 150, started_utc: "2026-10-04T21:30:00Z" }, "2026-10-04T21:30:00Z");
  record(folder, { ticket: "f3", minutes: 120, started_utc: "2026-10-04T22:00:00Z" }, "2026-10-04T22:00:00Z");
  assert.equal(line(clock(dir)), "now 2026-10-04 22:42Z · ticket f6 72/150 min");
});

test("a record naming this branch wins over a legacy record whose ticket is a part of it", () => {
  const main = project();
  const dir = worktree(main, "s12-p6-hooks");
  const folder = budgetFolder(main);
  record(folder, { ticket: "T-HOOKS", minutes: 90, started_utc: "2026-10-04T21:30:00Z", branch: "s12-p6-hooks" }, "2026-10-04T21:30:00Z");
  record(folder, { ticket: "hooks", minutes: 45, started_utc: "2026-10-04T22:00:00Z" }, "2026-10-04T22:00:00Z");
  assert.equal(line(clock(dir)), "now 2026-10-04 22:42Z · ticket T-HOOKS 72/90 min");
});

// B6
function stampBudget(cwd, ticket, minutes, now) {
  const done = spawnSync(PYTHON, ["-m", "scripts.factory.stamp", "budget", "--ticket", ticket, "--minutes", String(minutes)], {
    cwd,
    env: environment({ PYTHONPATH: REPO, VEXTRUS_NOW: now }),
    encoding: "utf8",
    timeout: 60_000,
  });
  assert.equal(done.status, 0, `stamp budget: ${done.stderr}`);
}

test("end to end: stamp budget in each worktree, then each worktree's clock shows its own ticket", () => {
  const main = project();
  const hooks = worktree(main, "s12-p6-hooks");
  const land = worktree(main, "s12-p6-land");
  stampBudget(hooks, "T-HOOKS", 90, "2026-10-04T21:30:00Z");
  stampBudget(land, "T-LAND", 45, "2026-10-04T22:00:00Z");
  utimesSync(join(budgetFolder(main), "budget-T-LAND.json"), new Date("2026-10-04T22:00:00Z"), new Date("2026-10-04T22:00:00Z"));
  utimesSync(join(budgetFolder(main), "budget-T-HOOKS.json"), new Date("2026-10-04T21:30:00Z"), new Date("2026-10-04T21:30:00Z"));
  assert.equal(line(clock(hooks)), "now 2026-10-04 22:42Z · ticket T-HOOKS 72/90 min");
  assert.equal(line(clock(land)), "now 2026-10-04 22:42Z · ticket T-LAND 42/45 min");
});
