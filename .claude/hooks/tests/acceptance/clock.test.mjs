// Acceptance (ticket f6, tier 1, T8): the clock hook, `.claude/hooks/clock.mjs`, on UserPromptSubmit and
// SessionStart. docs/specs/factory.md §3.5: it prints `now <UTC> · session h:mm/<budget> · phase <name>
// h:mm/<budget>` from `.private/work/factory/session.json`, or `ticket <t> n/m min` from the builder's own budget
// record; one quiet line when neither exists; elapsed from a fixture budget; a missing file says "no budget set",
// never a crash. The session and budget shapes are f3's (`stamp.py` is their producer). `VEXTRUS_NOW_UTC` stands
// in for the wall clock.
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

/** A scratch git repository with one commit: a main checkout unless the caller makes it otherwise. */
function project() {
  const dir = mkdtempSync(join(tmpdir(), "f6-clock-"));
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

function event(name, dir) {
  if (name === "SessionStart") return JSON.stringify({ hook_event_name: "SessionStart", source: "startup", session_id: "s", cwd: dir });
  return JSON.stringify({ hook_event_name: "UserPromptSubmit", prompt: "go on", session_id: "s", cwd: dir });
}

function clock(dir, { stdin, now = NOW, env = {} } = {}) {
  return spawnSync(process.execPath, [HOOK], {
    cwd: dir || tmpdir(),
    input: stdin ?? event("UserPromptSubmit", dir),
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

test("UserPromptSubmit prints now, the session's elapsed against its budget and the current phase's", () => {
  const dir = project();
  writeSession(dir, SESSION);
  assert.equal(line(clock(dir)), "now 2026-10-04 22:42Z · session 1:34/11:00 · phase build 1:12/2:30");
});

test("SessionStart prints the same line", () => {
  const dir = project();
  writeSession(dir, SESSION);
  const done = clock(dir, { stdin: event("SessionStart", dir) });
  assert.equal(line(done), "now 2026-10-04 22:42Z · session 1:34/11:00 · phase build 1:12/2:30");
});

test("no phase started: the phase segment is left out", () => {
  const dir = project();
  writeSession(dir, {
    ...SESSION,
    phases: [
      { name: "writers", minutes: 30, start_utc: null },
      { name: "build", minutes: 150, start_utc: null },
    ],
  });
  assert.equal(line(clock(dir)), "now 2026-10-04 22:42Z · session 1:34/11:00");
});

test("several phases started: the one with the latest start_utc is current, whatever the list order", () => {
  const dir = project();
  writeSession(dir, {
    ...SESSION,
    phases: [
      { name: "build", minutes: 150, start_utc: "2026-10-04T21:30:00Z" },
      { name: "writers", minutes: 30, start_utc: "2026-10-04T21:10:00Z" },
      { name: "review", minutes: 30, start_utc: null },
    ],
  });
  assert.equal(line(clock(dir)), "now 2026-10-04 22:42Z · session 1:34/11:00 · phase build 1:12/2:30");
});

test("unknown fields beside the known ones are tolerated", () => {
  const dir = project();
  writeSession(dir, { ...SESSION, governor: { slots: 3 }, note: "extra", schema: 1 });
  assert.equal(line(clock(dir)), "now 2026-10-04 22:42Z · session 1:34/11:00 · phase build 1:12/2:30");
});

test("no session.json and no budget record: one quiet line, no budget set", () => {
  const bare = project();
  assert.equal(line(clock(bare)), "now 2026-10-04 22:42Z · no budget set");
  const emptyFactory = project();
  mkdirSync(join(emptyFactory, ".private/work/factory"), { recursive: true });
  assert.equal(line(clock(emptyFactory)), "now 2026-10-04 22:42Z · no budget set");
});

test("no project folder at all: no budget set, exit 0", () => {
  const done = clock(undefined, { env: { CLAUDE_PROJECT_DIR: undefined } });
  assert.equal(line(done), "now 2026-10-04 22:42Z · no budget set");
  const empty = clock(undefined, { env: { CLAUDE_PROJECT_DIR: "" } });
  assert.equal(line(empty), "now 2026-10-04 22:42Z · no budget set");
});

for (const [name, body] of [
  ["corrupt JSON", '{"schema":1,"started_utc":"2026-10-04T21:08:00Z",'],
  ["an empty file", ""],
  ["only unknown fields", JSON.stringify({ hello: "world", phases: "none" })],
  ["a JSON array", "[1,2,3]"],
  ["JSON null", "null"],
]) {
  test(`session.json holding ${name}: no budget set, exit 0, no stack trace`, () => {
    const dir = project();
    writeSession(dir, body);
    assert.equal(line(clock(dir)), "now 2026-10-04 22:42Z · no budget set");
  });
}

for (const [name, stdin] of [
  ["empty stdin", ""],
  ["non-JSON stdin", "this is not json {"],
]) {
  test(`${name}: still one line and exit 0`, () => {
    const bare = project();
    assert.equal(line(clock(bare, { stdin })), "now 2026-10-04 22:42Z · no budget set");
    const withSession = project();
    writeSession(withSession, SESSION);
    assert.match(line(clock(withSession, { stdin })), /^now 2026-10-04 22:42Z · /);
  });
}

test("wrongly typed fields: one line beginning with now, exit 0, no stack trace", () => {
  const dir = project();
  writeSession(dir, { schema: 1, started_utc: "yesterday", budget_minutes: "lots", phases: [{ name: 7, start_utc: 3 }] });
  assert.match(line(clock(dir)), /^now 2026-10-04 22:42Z · /);
});

function budgetFolder(dir) {
  const common = git(dir, "rev-parse", "--git-common-dir");
  const folder = join(resolve(dir, common), "vextrus");
  mkdirSync(folder, { recursive: true });
  return folder;
}

function writeBudgets(folder) {
  const older = join(folder, "budget-f2.json");
  writeFileSync(older, JSON.stringify({ schema: 1, ticket: "f2", minutes: 90, started_utc: "2026-10-04T19:00:00Z" }));
  utimesSync(older, new Date("2026-10-04T19:00:00Z"), new Date("2026-10-04T19:00:00Z"));
  const newest = join(folder, "budget-f6.json");
  writeFileSync(newest, JSON.stringify({ schema: 1, ticket: "f6", minutes: 150, started_utc: "2026-10-04T21:30:00Z" }));
  utimesSync(newest, new Date("2026-10-04T21:30:00Z"), new Date("2026-10-04T21:30:00Z"));
}

test("a cloud builder: the newest budget record in <git-common-dir>/vextrus gives the ticket line", () => {
  const dir = project();
  writeBudgets(budgetFolder(dir));
  const done = clock(dir, { env: { CLAUDE_CODE_REMOTE: "true" } });
  assert.equal(line(done), "now 2026-10-04 22:42Z · ticket f6 72/150 min");
});

test("a local builder in a linked worktree reads the budget record from the shared git folder", () => {
  const main = project();
  const worktree = join(mkdtempSync(join(tmpdir(), "f6-clock-wt-")), "wt");
  git(main, "worktree", "add", "-q", "-b", "s12-f6-fixture", worktree);
  writeBudgets(budgetFolder(worktree));
  assert.equal(line(clock(worktree)), "now 2026-10-04 22:42Z · ticket f6 72/150 min");
});

test("past the session's budget the overrun shows, with the OVER suffix", () => {
  const dir = project();
  writeSession(dir, { ...SESSION, phases: [{ name: "build", minutes: 150, start_utc: null }] });
  const done = clock(dir, { now: "2026-10-05T08:28:00Z" });
  assert.equal(line(done), "now 2026-10-05 08:28Z · session 11:20/11:00 OVER");
});

test("the line is short and carries no path or secret", () => {
  const dir = project();
  writeSession(dir, SESSION);
  const secret = "sk-f6-fixture-secret-value";
  const out = line(clock(dir, { env: { TYPESAFE_API_KEY: secret, ANTHROPIC_API_KEY: secret } }));
  assert.ok(out.length < 200, `${out.length} chars`);
  for (const forbidden of [secret, dir, tmpdir(), ".private", "session.json", "STATE.md"]) {
    assert.ok(!out.includes(forbidden), `the line names ${forbidden}`);
  }
  const builder = project();
  writeBudgets(budgetFolder(builder));
  const ticket = line(clock(builder, { env: { CLAUDE_CODE_REMOTE: "true", TYPESAFE_API_KEY: secret } }));
  for (const forbidden of [secret, builder, ".git", "budget-f6.json"]) {
    assert.ok(!ticket.includes(forbidden), `the ticket line names ${forbidden}`);
  }
});
