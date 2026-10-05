// Acceptance (ticket T-STAMP, session 12 phase 6, section 3 B): a closed session is not a running clock. The clock
// hook, `.claude/hooks/clock.mjs`, prints `no budget set` when `session.json` carries an `ended_utc` time (a copy
// left in place), keeps the running line when it does not or when `ended_utc` is not a time, and after a real
// `python -m scripts.factory.stamp start` then `end` it prints `no budget set`. `VEXTRUS_NOW_UTC` stands in for the
// wall clock; `VEXTRUS_NOW` for stamp's. The helpers are clock.test.mjs's, copied (never imported).
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = fileURLToPath(new URL("../../../../", import.meta.url));
const HOOK = join(REPO, ".claude/hooks/clock.mjs");
const NOW = "2026-10-04T22:42:00Z";
const PYTHON = process.env.VEXTRUS_PYTHON ?? "python3";
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

/** A scratch git repository with one commit: a main checkout. */
function project() {
  const dir = mkdtempSync(join(tmpdir(), "p6-stamp-clock-"));
  git(dir, "init", "-q", "-b", "main");
  writeFileSync(join(dir, "README.md"), "fixture\n");
  git(dir, "add", "README.md");
  git(dir, "commit", "-q", "-m", "base");
  return dir;
}

function writeSession(dir, body) {
  mkdirSync(join(dir, ".private/work/factory"), { recursive: true });
  writeFileSync(join(dir, ".private/work/factory/session.json"), typeof body === "string" ? body : JSON.stringify(body));
}

const SESSION = {
  schema: 1,
  started_utc: "2026-10-04T21:08:00Z",
  budget_minutes: 660,
  state_file: ".private/work/session-12/STATE.md",
  phases: [{ name: "build", minutes: 150, start_utc: "2026-10-04T21:30:00Z" }],
};
const RUNNING = "now 2026-10-04 22:42Z · session 1:34/11:00 · phase build 1:12/2:30";
const QUIET = "now 2026-10-04 22:42Z · no budget set";

function clock(dir, { now = NOW, env = {} } = {}) {
  return spawnSync(process.execPath, [HOOK], {
    cwd: dir || tmpdir(),
    input: JSON.stringify({ hook_event_name: "UserPromptSubmit", prompt: "go on", session_id: "s", cwd: dir }),
    env: environment({ CLAUDE_PROJECT_DIR: dir, VEXTRUS_NOW_UTC: now, ...env }),
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

/** `python -m scripts.factory.stamp <args>` in the scratch project, its factory folder that project's. */
function stamp(dir, now, ...args) {
  const done = spawnSync(PYTHON, ["-m", "scripts.factory.stamp", ...args], {
    cwd: dir,
    env: environment({
      PYTHONPATH: REPO,
      VEXTRUS_FACTORY_DIR: join(dir, ".private/work/factory"),
      VEXTRUS_NOW: now,
    }),
    encoding: "utf8",
    timeout: 60_000,
  });
  assert.equal(done.error, undefined, `${PYTHON} did not run: ${done.error}`);
  return done;
}

const shown = (done) => `exit ${done.status}\n--- stdout\n${done.stdout}\n--- stderr\n${done.stderr}`;

// B1
test("a session.json with an ended_utc time is a closed session: no budget set", () => {
  const dir = project();
  writeSession(dir, { ...SESSION, ended_utc: "2026-10-04T22:00:00Z" });
  assert.equal(line(clock(dir)), QUIET);
});

// B2 (green on main too: the running case stays)
test("without ended_utc, or with an ended_utc that is not a time, the running line prints", () => {
  const running = project();
  writeSession(running, SESSION);
  assert.equal(line(clock(running)), RUNNING);
  for (const ended of [42, "soon"]) {
    const dir = project();
    writeSession(dir, { ...SESSION, ended_utc: ended });
    assert.equal(line(clock(dir)), RUNNING, `ended_utc ${JSON.stringify(ended)}`);
  }
});

// B3
test("stamp start then stamp end, end to end: the hook prints no budget set", () => {
  const dir = project();
  const state = join(dir, ".private/work/session-13/STATE.md");
  const started = stamp(dir, "2026-10-04T21:08:00Z", "start", "--budget", "11h", "--state", state);
  assert.equal(started.status, 0, shown(started));
  assert.equal(line(clock(dir)), "now 2026-10-04 22:42Z · session 1:34/11:00");

  const ended = stamp(dir, "2026-10-04T22:00:00Z", "end");
  assert.equal(ended.status, 0, shown(ended));
  assert.ok(!existsSync(join(dir, ".private/work/factory/session.json")), "session.json is removed");
  assert.equal(line(clock(dir)), QUIET);
});
