// Acceptance (ticket f6, tier 1, T8): the watcher restart, `.claude/hooks/watch-start.mjs`, on SessionStart.
// docs/specs/factory.md §3.5: "main checkout only: restarts `watch.py` detached when its pidfile is stale, and
// says so"; a stale pidfile gives one start, a live one none. The pidfile is `.private/work/factory/watch.pid`;
// the watcher runs as `python3 scripts/factory/watch.py` (no arguments) with its output in
// `.private/work/factory/watch.out`. f3 lands `watch.py` later, so its absence is quiet.
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as wait } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const REPO = fileURLToPath(new URL("../../../../", import.meta.url));
const HOOK = join(REPO, ".claude/hooks/watch-start.mjs");
const INHERITED = ["CLAUDE_CODE_REMOTE", "VEXTRUS_ROLE", "CLAUDE_PROJECT_DIR", "VEXTRUS_NOW_UTC", "VEXTRUS_PYTHON"];
const GIT_ENV = {
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_CONFIG_NOSYSTEM: "1",
  GIT_AUTHOR_NAME: "Fixture",
  GIT_AUTHOR_EMAIL: "fixture@example.invalid",
  GIT_COMMITTER_NAME: "Fixture",
  GIT_COMMITTER_EMAIL: "fixture@example.invalid",
};
const spawned = new Set();

after(() => {
  for (const pid of spawned) {
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      // Already gone.
    }
  }
});

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

// The stub watcher: records its pid in started.marker (beside the project's root, found from its own path),
// says hello on stdout, then lives 20 s.
const STUB = `import os, sys, time
root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
with open(os.path.join(root, "started.marker"), "a") as marker:
    marker.write(str(os.getpid()) + "\\n")
print("stub-watcher-says-hello", flush=True)
time.sleep(20)
`;

/** A main checkout with the stub committed at scripts/factory/watch.py and the factory folder present. */
function project({ stub = true } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "f6-watch-"));
  git(dir, "init", "-q", "-b", "main");
  writeFileSync(join(dir, "README.md"), "fixture\n");
  git(dir, "add", "README.md");
  if (stub) {
    mkdirSync(join(dir, "scripts/factory"), { recursive: true });
    writeFileSync(join(dir, "scripts/factory/watch.py"), STUB);
    git(dir, "add", "scripts/factory/watch.py");
  }
  git(dir, "commit", "-q", "-m", "base");
  mkdirSync(join(dir, ".private/work/factory"), { recursive: true });
  return dir;
}

function startHook(dir, { env = {}, cwd } = {}) {
  const began = Date.now();
  const done = spawnSync(process.execPath, [HOOK], {
    cwd: cwd ?? dir,
    input: JSON.stringify({ hook_event_name: "SessionStart", source: "startup", session_id: "s", cwd: cwd ?? dir }),
    env: environment({ CLAUDE_PROJECT_DIR: dir, ...env }),
    encoding: "utf8",
    timeout: 15_000,
  });
  return { ...done, ms: Date.now() - began };
}

function markerPids(dir) {
  const marker = join(dir, "started.marker");
  if (!existsSync(marker)) return [];
  const pids = readFileSync(marker, "utf8").split("\n").filter(Boolean).map(Number);
  for (const pid of pids) spawned.add(pid);
  return pids;
}

/** Waits until the stub has written at least one marker line (up to 5 s), then a further half second. */
async function settledStarts(dir) {
  for (let i = 0; i < 50 && markerPids(dir).length === 0; i += 1) await wait(100);
  await wait(500);
  return markerPids(dir);
}

/** Waits long enough for a wrongly started stub to have written its marker, then reads it. */
async function noStart(dir) {
  await wait(1500);
  return markerPids(dir);
}

function pidfile(dir, content) {
  writeFileSync(join(dir, ".private/work/factory/watch.pid"), content);
}

function livingProcess(script) {
  const folder = mkdtempSync(join(tmpdir(), "f6-watch-live-"));
  const file = join(folder, script);
  writeFileSync(file, "import time\ntime.sleep(30)\n");
  const child = spawn("python3", [file], { stdio: "ignore", detached: true });
  child.unref();
  spawned.add(child.pid);
  return child.pid;
}

function deadPid() {
  const done = spawnSync(process.execPath, ["-e", "process.stdout.write(String(process.pid))"], { encoding: "utf8" });
  return Number(done.stdout);
}

test("no pidfile: exactly one start, detached, and the hook says so", async () => {
  const dir = project();
  const done = startHook(dir);
  assert.equal(done.status, 0, done.stderr);
  assert.ok(done.ms < 2000, `the hook took ${done.ms} ms; it must not wait for the watcher`);
  assert.match(done.stdout, /watcher: started \(no pidfile\)/);
  const pids = await settledStarts(dir);
  assert.equal(pids.length, 1, `starts: ${pids.length}`);
});

test("a pidfile naming a dead process: one restart, said as a stale pidfile", async () => {
  const dir = project();
  pidfile(dir, `${deadPid()}\n`);
  const done = startHook(dir);
  assert.equal(done.status, 0, done.stderr);
  assert.match(done.stdout, /watcher: restarted \(stale pidfile\)/);
  assert.equal((await settledStarts(dir)).length, 1);
});

test("a stale pidfile is rewritten with the new watcher's pid", async () => {
  const dir = project();
  pidfile(dir, `${deadPid()}\n`);
  assert.equal(startHook(dir).status, 0);
  const [pid] = await settledStarts(dir);
  assert.equal(Number(readFileSync(join(dir, ".private/work/factory/watch.pid"), "utf8").trim()), pid);
});

test("a pidfile naming a live watch.py: no start, and nothing said", async () => {
  const dir = project();
  pidfile(dir, `${livingProcess("watch.py")}\n`);
  const done = startHook(dir);
  assert.equal(done.status, 0, done.stderr);
  assert.equal(done.stdout, "");
  assert.equal((await noStart(dir)).length, 0);
});

test("a pidfile naming a live process that is not watch.py (a reused pid) is stale: one start", async () => {
  const dir = project();
  pidfile(dir, `${livingProcess("sleeper.py")}\n`);
  const done = startHook(dir);
  assert.equal(done.status, 0, done.stderr);
  assert.match(done.stdout, /watcher: restarted \(stale pidfile\)/);
  assert.equal((await settledStarts(dir)).length, 1);
});

test("a pidfile holding no number is stale: one start", async () => {
  const dir = project();
  pidfile(dir, "not-a-pid\n");
  const done = startHook(dir);
  assert.equal(done.status, 0, done.stderr);
  assert.match(done.stdout, /^watcher: /m);
  assert.equal((await settledStarts(dir)).length, 1);
});

test("a cloud session never starts the watcher", async () => {
  const dir = project();
  const done = startHook(dir, { env: { CLAUDE_CODE_REMOTE: "true" } });
  assert.equal(done.status, 0, done.stderr);
  assert.equal(done.stdout, "");
  assert.equal((await noStart(dir)).length, 0);
});

test("a builder (VEXTRUS_ROLE=builder) never starts the watcher", async () => {
  const dir = project();
  const done = startHook(dir, { env: { VEXTRUS_ROLE: "builder" } });
  assert.equal(done.status, 0, done.stderr);
  assert.equal(done.stdout, "");
  assert.equal((await noStart(dir)).length, 0);
});

test("a linked worktree never starts the watcher", async () => {
  const main = project();
  const worktree = join(mkdtempSync(join(tmpdir(), "f6-watch-wt-")), "wt");
  git(main, "worktree", "add", "-q", "-b", "s12-f6-fixture", worktree);
  mkdirSync(join(worktree, ".private/work/factory"), { recursive: true });
  const done = startHook(worktree);
  assert.equal(done.status, 0, done.stderr);
  assert.equal(done.stdout, "");
  assert.equal((await noStart(worktree)).length, 0);
  assert.equal(markerPids(main).length, 0);
});

test("watch.py absent (f3 not landed): silent, exit 0", () => {
  const dir = project({ stub: false });
  const done = startHook(dir);
  assert.equal(done.status, 0, done.stderr);
  assert.equal(done.stdout, "");
});

test("CLAUDE_PROJECT_DIR unset or empty: silent, exit 0, nothing started even from the project's cwd", async () => {
  const dir = project();
  for (const value of [undefined, ""]) {
    const done = startHook(dir, { env: { CLAUDE_PROJECT_DIR: value }, cwd: dir });
    assert.equal(done.status, 0, done.stderr);
    assert.equal(done.stdout, "");
  }
  assert.equal((await noStart(dir)).length, 0);
});

test("the watcher runs detached: its output goes to watch.out, never the hook's stdout", async () => {
  const dir = project();
  const done = startHook(dir);
  assert.equal(done.status, 0, done.stderr);
  assert.ok(done.ms < 2000, `the hook took ${done.ms} ms`);
  assert.doesNotMatch(done.stdout, /stub-watcher-says-hello/);
  await settledStarts(dir);
  const out = join(dir, ".private/work/factory/watch.out");
  for (let i = 0; i < 30 && !(existsSync(out) && readFileSync(out, "utf8").includes("hello")); i += 1) await wait(100);
  assert.match(readFileSync(out, "utf8"), /stub-watcher-says-hello/);
});
