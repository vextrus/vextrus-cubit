// Acceptance (ticket f6, tier 2): the builder's Stop nudge, `.claude/hooks/stop-gate.mjs`. docs/specs/factory.md
// §3.5 and docs/specs/factory/contracts/trailers.md 1 and 4: only where CLAUDE_PROJECT_DIR is not the main
// checkout, a stop with uncommitted tracked changes and no trailer, or a READY trailer with no green verify record
// (`<git-common-dir>/vextrus/verify-<HEAD^{tree}>.json`, every exit_code 0), is blocked once with "commit with
// explicit paths and run verify, or finish `Factory-State: BLOCKED` with a reason". A nudge that fails open.
// The ten trailer cases are generated here (trailers.md 4: no shared fixture files).
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { appendFileSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = fileURLToPath(new URL("../../../../", import.meta.url));
const HOOK = join(REPO, ".claude/hooks/stop-gate.mjs");
const INHERITED = ["CLAUDE_CODE_REMOTE", "VEXTRUS_ROLE", "CLAUDE_PROJECT_DIR", "VEXTRUS_NOW_UTC", "VEXTRUS_PYTHON"];
const GIT_ENV = {
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_CONFIG_NOSYSTEM: "1",
  GIT_AUTHOR_NAME: "Fixture",
  GIT_AUTHOR_EMAIL: "fixture@example.invalid",
  GIT_COMMITTER_NAME: "Fixture",
  GIT_COMMITTER_EMAIL: "fixture@example.invalid",
};
const CLOUD = { CLAUDE_CODE_REMOTE: "true" };
const OTHER_TREE = "0f3c1d5e7a9b2c4d6e8f1a3b5c7d9e0f2a4b6c8d";

function environment(extra = {}) {
  const env = { ...process.env, ...GIT_ENV };
  for (const name of INHERITED) delete env[name];
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

/** A scratch repository with a base commit holding one tracked file. */
function project() {
  const dir = mkdtempSync(join(tmpdir(), "f6-stop-"));
  git(dir, "init", "-q", "-b", "main");
  writeFileSync(join(dir, "work.txt"), "base\n");
  git(dir, "add", "work.txt");
  git(dir, "commit", "-q", "-m", "base");
  return dir;
}

let counter = 0;

/** Commits a change whose message ends with the trailer lines `lines(tree)` gives; returns the commit's tree. */
function commit(dir, lines = () => []) {
  counter += 1;
  appendFileSync(join(dir, "work.txt"), `change ${counter}\n`);
  git(dir, "add", "work.txt");
  const tree = git(dir, "write-tree");
  const trailers = lines(tree);
  const message = `feat: fixture change ${counter}\n\nBody of the fixture commit.\n${trailers.length ? `\n${trailers.join("\n")}\n` : ""}`;
  const file = join(mkdtempSync(join(tmpdir(), "f6-stop-msg-")), "message.txt");
  writeFileSync(file, message);
  git(dir, "commit", "-q", "-F", file);
  assert.equal(git(dir, "rev-parse", "HEAD^{tree}"), tree);
  return tree;
}

function dirty(dir) {
  appendFileSync(join(dir, "work.txt"), "uncommitted\n");
}

/** Writes a verify record (verify-record.schema.json) for `tree` with these exit codes. */
function record(dir, tree, codes = [0, 0]) {
  const folder = join(resolve(dir, git(dir, "rev-parse", "--git-common-dir")), "vextrus");
  mkdirSync(folder, { recursive: true });
  const checks = codes.map((code, i) => ({
    name: `check-${i}`,
    command: `node --test fixture-${i}`,
    exit_code: code,
    raw_exit_code: code,
    flakes: [],
    output_file: `.private/work/f6/check-${i}.txt`,
  }));
  const body = { schema_version: 1, tree, written_at: "2026-10-04T22:00:00Z", ok: codes.every((c) => c === 0), checks };
  writeFileSync(join(folder, `verify-${tree}.json`), JSON.stringify(body, null, 2));
  return join(folder, `verify-${tree}.json`);
}

function stop(dir, { env = CLOUD, active = false, stdin, cwd } = {}) {
  return spawnSync(process.execPath, [HOOK], {
    cwd: cwd || dir || tmpdir(),
    input: stdin ?? JSON.stringify({ hook_event_name: "Stop", session_id: "s", stop_hook_active: active, last_assistant_message: "Done.", cwd: cwd ?? dir }),
    env: environment({ CLAUDE_PROJECT_DIR: dir, ...env }),
    encoding: "utf8",
    timeout: 15_000,
  });
}

function assertBlocked(done) {
  assert.equal(done.status, 0, done.stderr);
  let out;
  assert.doesNotThrow(() => (out = JSON.parse(done.stdout)), `stdout is one JSON object: ${done.stdout}`);
  assert.equal(out.decision, "block");
  assert.equal(typeof out.reason, "string");
  assert.ok(out.reason.includes("Factory-State: BLOCKED"), out.reason);
  assert.ok(out.reason.includes("explicit paths"), out.reason);
}

function assertAllowed(done) {
  assert.equal(done.status, 0, done.stderr);
  assert.equal(done.stdout.trim(), "", `expected no output, got ${done.stdout}`);
}

const READY_OK = (tree) => ["Factory-State: READY", `Factory-Verify: ${tree} ok`];

test("a builder stopping with a dirty tracked file and no trailer is blocked, told the lawful ways out", () => {
  const dir = project();
  commit(dir);
  dirty(dir);
  assertBlocked(stop(dir));
});

test("a staged but uncommitted change counts as dirty", () => {
  const dir = project();
  commit(dir);
  dirty(dir);
  git(dir, "add", "work.txt");
  assertBlocked(stop(dir));
});

test("untracked files alone are not dirty", () => {
  const dir = project();
  commit(dir);
  writeFileSync(join(dir, "scratch-notes.txt"), "untracked\n");
  assertAllowed(stop(dir));
});

test("READY with Factory-Verify but no verify record is blocked", () => {
  const dir = project();
  commit(dir, READY_OK);
  assertBlocked(stop(dir));
});

test("READY with a green verify record for HEAD's tree is allowed", () => {
  const dir = project();
  const tree = commit(dir, READY_OK);
  record(dir, tree, [0, 0, 0]);
  assertAllowed(stop(dir));
});

test("READY with a record holding one non-zero exit code is blocked", () => {
  const dir = project();
  const tree = commit(dir, READY_OK);
  record(dir, tree, [0, 1, 0]);
  assertBlocked(stop(dir));
});

test("READY with a record for another tree only is blocked", () => {
  const dir = project();
  commit(dir, READY_OK);
  record(dir, OTHER_TREE, [0]);
  assertBlocked(stop(dir));
});

test("READY with an unparsable or empty record is blocked", () => {
  const unparsable = project();
  const tree = commit(unparsable, READY_OK);
  writeFileSync(record(unparsable, tree), "{ not json");
  assertBlocked(stop(unparsable));
  const empty = project();
  const emptyTree = commit(empty, READY_OK);
  record(empty, emptyTree, []);
  assertBlocked(stop(empty));
});

test("BLOCKED with a reason is allowed, even when dirty", () => {
  const dir = project();
  commit(dir, () => ["Factory-State: BLOCKED", "Factory-Reason: the spec names no exit code"]);
  dirty(dir);
  assertAllowed(stop(dir));
});

test("stop_hook_active: allowed (a stop is blocked once only)", () => {
  const dir = project();
  commit(dir);
  dirty(dir);
  assertAllowed(stop(dir, { active: true }));
  const ready = project();
  commit(ready, READY_OK);
  assertAllowed(stop(ready, { active: true }));
});

test("a clean tree with no trailer (an acceptance writer's last state) is allowed", () => {
  const dir = project();
  commit(dir);
  assertAllowed(stop(dir));
});

test("a linked worktree is a builder even outside the cloud", () => {
  const main = project();
  const worktree = join(mkdtempSync(join(tmpdir(), "f6-stop-wt-")), "wt");
  git(main, "worktree", "add", "-q", "-b", "s12-f6-fixture", worktree);
  commit(worktree);
  dirty(worktree);
  assertBlocked(stop(worktree, { env: {} }));
});

test("VEXTRUS_ROLE=builder makes a plain repository a builder", () => {
  const dir = project();
  commit(dir);
  dirty(dir);
  assertBlocked(stop(dir, { env: { VEXTRUS_ROLE: "builder" } }));
});

test("the main checkout: a no-op even when dirty and READY without a record", () => {
  const dir = project();
  commit(dir, READY_OK);
  dirty(dir);
  assertAllowed(stop(dir, { env: {} }));
});

test("keyed on CLAUDE_PROJECT_DIR, not cwd: main project, cwd in a dirty unverified worktree, no-op", () => {
  const main = project();
  const worktree = join(mkdtempSync(join(tmpdir(), "f6-stop-wt-")), "wt");
  git(main, "worktree", "add", "-q", "-b", "s12-f6-fixture", worktree);
  commit(worktree, READY_OK);
  dirty(worktree);
  assertAllowed(stop(main, { env: {}, cwd: worktree }));
});

test("fails open: garbage stdin, no git repository, an empty or unset project folder", () => {
  const dir = project();
  commit(dir);
  dirty(dir);
  for (const stdin of ["not json at all", "", "[]"]) assertAllowed(stop(dir, { stdin }));
  const notGit = mkdtempSync(join(tmpdir(), "f6-stop-nogit-"));
  writeFileSync(join(notGit, "work.txt"), "x\n");
  assertAllowed(stop(notGit));
  assertAllowed(stop("", { cwd: dir }));
  assertAllowed(stop(undefined, { cwd: dir }));
});

// trailers.md 4: the ten cases, each message generated here.
const CASES = {
  "ready-ok": READY_OK,
  "ready-no-verify": () => ["Factory-State: READY"],
  "ready-wrong-tree": () => ["Factory-State: READY", `Factory-Verify: ${OTHER_TREE} ok`],
  "ready-with-reason": (tree) => [...READY_OK(tree), "Factory-Reason: x"],
  "blocked-ok": () => ["Factory-State: BLOCKED", "Factory-Reason: the acceptance tests cannot pass"],
  "blocked-no-reason": () => ["Factory-State: BLOCKED"],
  "repeated-key": (tree) => ["Factory-State: READY", "Factory-State: READY", `Factory-Verify: ${tree} ok`],
  "lowercase-value": (tree) => ["Factory-State: ready", `Factory-Verify: ${tree} ok`],
  none: () => ["Co-Authored-By: Fixture <fixture@example.invalid>"],
};

test("trailers 4, ready-ok: allowed with a green record, blocked without one", () => {
  const green = project();
  record(green, commit(green, CASES["ready-ok"]));
  assertAllowed(stop(green));
  const unverified = project();
  commit(unverified, CASES["ready-ok"]);
  assertBlocked(stop(unverified));
});

for (const name of ["ready-no-verify", "ready-wrong-tree", "ready-with-reason", "repeated-key", "lowercase-value"]) {
  test(`trailers 4, ${name}: a READY-looking malformed head is blocked when unverified, clean or dirty`, () => {
    const clean = project();
    commit(clean, CASES[name]);
    assertBlocked(stop(clean));
    const dirtyHead = project();
    commit(dirtyHead, CASES[name]);
    dirty(dirtyHead);
    assertBlocked(stop(dirtyHead));
  });
}

test("trailers 4, blocked-ok: allowed, clean or dirty", () => {
  const dir = project();
  commit(dir, CASES["blocked-ok"]);
  assertAllowed(stop(dir));
  dirty(dir);
  assertAllowed(stop(dir));
});

test("trailers 4, blocked-no-reason: malformed, read as no trailer (allowed clean, blocked dirty)", () => {
  const dir = project();
  commit(dir, CASES["blocked-no-reason"]);
  assertAllowed(stop(dir));
  dirty(dir);
  assertBlocked(stop(dir));
});

test("trailers 4, none: allowed clean, blocked dirty", () => {
  const dir = project();
  commit(dir, CASES.none);
  assertAllowed(stop(dir));
  dirty(dir);
  assertBlocked(stop(dir));
});

test("trailers 4, older-commit-only: READY on the parent means nothing on the tip", () => {
  const unverifiedParent = project();
  commit(unverifiedParent, CASES["ready-ok"]);
  commit(unverifiedParent);
  assertAllowed(stop(unverifiedParent));
  const greenParent = project();
  record(greenParent, commit(greenParent, CASES["ready-ok"]));
  commit(greenParent);
  dirty(greenParent);
  assertBlocked(stop(greenParent));
});
