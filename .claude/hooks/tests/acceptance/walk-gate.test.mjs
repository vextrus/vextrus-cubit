// Acceptance (ticket f6, tier 2): the walk-now gate, `.claude/hooks/walk-gate.mjs`, on Stop. docs/specs/factory.md
// §3.5 and §5: only in the main checkout, a message matching "walk now", "ready for your walk" or "please walk" is
// blocked unless `python3 -m scripts.walk.ready origin/main` (cwd the project; VEXTRUS_PYTHON overrides the
// interpreter) exits 0 within 12 s. With `scripts/walk/ready.py` absent it blocks, saying G1 is not installed
// (fails closed). It does not honour stop_hook_active (Claude Code's 8-block cap is the backstop).
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = fileURLToPath(new URL("../../../../", import.meta.url));
const HOOK = join(REPO, ".claude/hooks/walk-gate.mjs");
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
  return done.stdout.trim();
}

/** A main checkout; with `exit` set, a stub scripts/walk/ready.py that records its arguments and cwd, then exits so. */
function project({ exit, hang = false } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "f6-walk-"));
  git(dir, "init", "-q", "-b", "main");
  writeFileSync(join(dir, "README.md"), "fixture\n");
  git(dir, "add", "README.md");
  git(dir, "commit", "-q", "-m", "base");
  if (exit !== undefined) {
    mkdirSync(join(dir, "scripts/walk"), { recursive: true });
    writeFileSync(join(dir, "scripts/__init__.py"), "");
    writeFileSync(join(dir, "scripts/walk/__init__.py"), "");
    const marker = JSON.stringify(join(dir, "ready.marker"));
    writeFileSync(
      join(dir, "scripts/walk/ready.py"),
      `import os, sys, time\nwith open(${marker}, "a") as f:\n    f.write(" ".join(sys.argv[1:]) + " | " + os.getcwd() + "\\n")\n` +
        (hang ? "time.sleep(30)\n" : "") +
        `sys.exit(${exit})\n`,
    );
  }
  return dir;
}

const ran = (dir) => existsSync(join(dir, "ready.marker"));

function stop(dir, message, { env = {}, active = false, stdin } = {}) {
  const began = Date.now();
  const done = spawnSync(process.execPath, [HOOK], {
    cwd: dir || tmpdir(),
    input: stdin ?? JSON.stringify({ hook_event_name: "Stop", session_id: "s", stop_hook_active: active, last_assistant_message: message, cwd: dir }),
    env: environment({ CLAUDE_PROJECT_DIR: dir, ...env }),
    encoding: "utf8",
    timeout: 30_000,
  });
  return { ...done, ms: Date.now() - began };
}

function blockReason(done) {
  assert.equal(done.status, 0, done.stderr);
  let out;
  assert.doesNotThrow(() => (out = JSON.parse(done.stdout)), `stdout is one JSON object: ${done.stdout}`);
  assert.equal(out.decision, "block");
  assert.equal(typeof out.reason, "string");
  return out.reason;
}

function assertAllowed(done) {
  assert.equal(done.status, 0, done.stderr);
  assert.equal(done.stdout.trim(), "", `expected no output, got ${done.stdout}`);
}

test("'ready for your walk' with a failing G1 is blocked, and the reason names G1", () => {
  const dir = project({ exit: 1 });
  assert.match(blockReason(stop(dir, "The build is ready for your walk.")), /G1/);
});

test("ready.py is run as a module with origin/main, from the project folder", () => {
  const dir = project({ exit: 1 });
  blockReason(stop(dir, "Please walk the build."));
  const [line] = readFileSync(join(dir, "ready.marker"), "utf8").split("\n");
  const [args, cwd] = line.split(" | ");
  assert.equal(args, "origin/main");
  assert.equal(realpathSync(cwd), realpathSync(dir));
});

for (const phrase of ["walk now", "Walk Now", "please walk", "WALK NOW please", "You can walk now.", "It is ready for your walk"]) {
  test(`"${phrase}": blocked when G1 fails, allowed when it passes`, () => {
    blockReason(stop(project({ exit: 1 }), phrase));
    const passing = project({ exit: 0 });
    assertAllowed(stop(passing, phrase));
    assert.ok(ran(passing), "ready.py was run");
  });
}

test("ready.py absent: blocked, saying G1 is not installed", () => {
  assert.match(blockReason(stop(project(), "Walk now, please.")), /G1 is not installed/);
});

test("a message without the phrases is allowed without running ready.py", () => {
  const dir = project({ exit: 1 });
  assertAllowed(stop(dir, "The tests pass; the branch is pushed. Walking through the diff next."));
  assert.ok(!ran(dir), "ready.py must not run");
});

test("stop_hook_active is not honoured: a second walk-now stop with a failing G1 is still blocked", () => {
  blockReason(stop(project({ exit: 1 }), "walk now", { active: true }));
});

test("VEXTRUS_PYTHON overrides the interpreter", () => {
  const dir = project({ exit: 1 });
  const bin = mkdtempSync(join(tmpdir(), "f6-walk-py-"));
  const fake = join(bin, "fake-python");
  const marker = join(bin, "fake.marker");
  writeFileSync(fake, `#!/bin/sh\necho "$@" >> ${JSON.stringify(marker)}\nexit 0\n`);
  chmodSync(fake, 0o755);
  assertAllowed(stop(dir, "walk now", { env: { VEXTRUS_PYTHON: fake } }));
  assert.equal(readFileSync(marker, "utf8").trim(), "-m scripts.walk.ready origin/main");
  assert.ok(!ran(dir), "the default interpreter was not used");
});

test("a builder session is a no-op (cloud, VEXTRUS_ROLE=builder, a linked worktree)", () => {
  assertAllowed(stop(project({ exit: 1 }), "walk now", { env: { CLAUDE_CODE_REMOTE: "true" } }));
  assertAllowed(stop(project({ exit: 1 }), "walk now", { env: { VEXTRUS_ROLE: "builder" } }));
  const main = project({ exit: 1 });
  git(main, "add", "scripts");
  git(main, "commit", "-q", "-m", "stub");
  const worktree = join(mkdtempSync(join(tmpdir(), "f6-walk-wt-")), "wt");
  git(main, "worktree", "add", "-q", "-b", "s12-f6-fixture", worktree);
  assertAllowed(stop(worktree, "walk now"));
});

test("a ready.py that hangs: the hook returns within 13 s with a block (fails closed)", () => {
  const done = stop(project({ exit: 0, hang: true }), "walk now");
  assert.ok(done.ms < 13_000, `took ${done.ms} ms`);
  blockReason(done);
});

// Ticket T-HOOKS (#290): the phrases match as whole words only; each block reason quotes the words that matched, as
// written; a hung ready.py is answered with a block well inside the registered 15 s timeout (a 4 s margin).
for (const message of ["The sidewalk now closed.", "Walk nowhere near it.", "Please walked back the claim."]) {
  test(`"${message}": the phrases inside other words are allowed without running ready.py`, () => {
    const dir = project({ exit: 1 });
    assertAllowed(stop(dir, message));
    assert.ok(!ran(dir), "ready.py must not run");
  });
}

test('a failing G1: the reason quotes the matched words as written ("Please walk"), nothing else of the message', () => {
  const reason = blockReason(stop(project({ exit: 1 }), "Please walk the build."));
  assert.ok(reason.includes('"Please walk"'), reason);
  assert.ok(!reason.includes("the build"), reason);
  assert.match(reason, /G1/);
});

test('ready.py absent: the reason says G1 is not installed and quotes the matched words ("Please walk")', () => {
  const reason = blockReason(stop(project(), "Please walk the build."));
  assert.ok(reason.includes('"Please walk"'), reason);
  assert.ok(!reason.includes("the build"), reason);
  assert.match(reason, /G1 is not installed/);
});

test("a ready.py that hangs: the hook blocks in under 11 s, saying it did not answer within its cap", () => {
  const dir = project({ exit: 0, hang: true });
  const began = performance.now();
  const done = stop(dir, "walk now");
  const ms = performance.now() - began;
  assert.ok(ms < 11_000, `took ${Math.round(ms)} ms`);
  assert.match(blockReason(done), /did not answer within/);
});

test("garbage stdin, or no last_assistant_message: allowed", () => {
  const dir = project({ exit: 1 });
  for (const stdin of ["not json", "", "[]", JSON.stringify({ hook_event_name: "Stop", stop_hook_active: false })]) {
    assertAllowed(stop(dir, undefined, { stdin }));
  }
  assertAllowed(stop(dir, undefined, { stdin: JSON.stringify({ hook_event_name: "Stop", last_assistant_message: 42 }) }));
  assert.ok(!ran(dir));
});
