// Acceptance (ticket f6, tier 2): the guard self-test, `.claude/hooks/selftest.mjs`, on SessionStart.
// docs/specs/factory.md §3.5: a missing or mistyped hook path silently disables a gate, so at session start it feeds
// the project's `.claude/hooks/guard.mjs` one known refusal (`git push --force origin HEAD`, a PreToolUse Bash
// event, 5 s cap) and prints a loud warning if it is not refused. Refused means exit code 2 or a JSON
// `permissionDecision: "deny"`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = fileURLToPath(new URL("../../../../", import.meta.url));
const HOOK = join(REPO, ".claude/hooks/selftest.mjs");
const INHERITED = ["CLAUDE_CODE_REMOTE", "VEXTRUS_ROLE", "CLAUDE_PROJECT_DIR", "VEXTRUS_NOW_UTC", "VEXTRUS_PYTHON"];
const GIT_ENV = {
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_CONFIG_NOSYSTEM: "1",
  GIT_AUTHOR_NAME: "Fixture",
  GIT_AUTHOR_EMAIL: "fixture@example.invalid",
  GIT_COMMITTER_NAME: "Fixture",
  GIT_COMMITTER_EMAIL: "fixture@example.invalid",
};

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
}

// Stub guards. Each records the event it was given in received.json beside the project's root.
const RECORD = `import { readFileSync, writeFileSync } from "node:fs";
const input = readFileSync(0, "utf8");
writeFileSync(new URL("../../received.json", import.meta.url), input);
`;
const STUBS = {
  allows: `${RECORD}process.exit(0);\n`,
  exits1: `${RECORD}process.exit(1);\n`,
  throws: `${RECORD}throw new Error("stub guard broke");\n`,
  hangs: `${RECORD}setTimeout(() => process.exit(0), 60_000);\n`,
  exits2: `${RECORD}process.stderr.write("refused");\nprocess.exit(2);\n`,
  denies: `${RECORD}process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: "HISTORY_REWRITTEN: no" } }));\nprocess.exit(0);\n`,
};

/** A main-like project whose .claude/hooks/guard.mjs is the named stub (or absent, or the repo's real guard). */
function project(stub) {
  const dir = mkdtempSync(join(tmpdir(), "f6-selftest-"));
  git(dir, "init", "-q", "-b", "main");
  mkdirSync(join(dir, ".claude/hooks"), { recursive: true });
  if (stub === "real") copyFileSync(join(REPO, ".claude/hooks/guard.mjs"), join(dir, ".claude/hooks/guard.mjs"));
  else if (stub) writeFileSync(join(dir, ".claude/hooks/guard.mjs"), STUBS[stub]);
  return dir;
}

function selftest(dir) {
  const began = Date.now();
  const done = spawnSync(process.execPath, [HOOK], {
    cwd: dir,
    input: JSON.stringify({ hook_event_name: "SessionStart", source: "startup", session_id: "s", cwd: dir }),
    env: environment({ CLAUDE_PROJECT_DIR: dir }),
    encoding: "utf8",
    timeout: 20_000,
  });
  return { ...done, ms: Date.now() - began };
}

function assertWarns(done) {
  assert.equal(done.status, 0, done.stderr);
  assert.match(done.stdout, /WARNING/);
  assert.match(done.stdout, /guard/);
}

function assertSilent(done) {
  assert.equal(done.status, 0, done.stderr);
  assert.equal(done.stdout.trim(), "", `expected silence, got ${done.stdout}`);
}

test("a guard that allows the force push: a loud warning", () => {
  assertWarns(selftest(project("allows")));
});

test("a guard that exits 1 (a non-blocking error, so the push would run): a warning", () => {
  assertWarns(selftest(project("exits1")));
});

test("no guard file: a warning", () => {
  assertWarns(selftest(project(null)));
});

test("a guard that throws: a warning", () => {
  assertWarns(selftest(project("throws")));
});

test("a guard that hangs past the cap is killed within 5 s and warned about", () => {
  const done = selftest(project("hangs"));
  assert.ok(done.ms < 8000, `took ${done.ms} ms`);
  assertWarns(done);
});

test("a guard that refuses with exit code 2: silent", () => {
  assertSilent(selftest(project("exits2")));
});

test("a guard that refuses with a JSON deny: silent", () => {
  assertSilent(selftest(project("denies")));
});

test("the guard is fed a PreToolUse Bash event for git push --force origin HEAD", () => {
  const dir = project("denies");
  assertSilent(selftest(dir));
  const received = join(dir, "received.json");
  assert.ok(existsSync(received), "the stub guard was run");
  const event = JSON.parse(readFileSync(received, "utf8"));
  assert.equal(event.hook_event_name, "PreToolUse");
  assert.equal(event.tool_name, "Bash");
  assert.equal(event.tool_input.command, "git push --force origin HEAD");
});

test("the repository's real guard refuses the force push: silent", () => {
  assertSilent(selftest(project("real")));
});
