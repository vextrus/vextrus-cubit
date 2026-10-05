// Acceptance (ticket T-PRECOMPACT, session 12 phase 6): the PreCompact dump reads the state file that `stamp start`
// really records. `scripts/factory/stamp.py` writes session.json's `state_file` as an absolute path
// (`str(Path(state).resolve())`); `.claude/hooks/precompact.mjs` must read it, whether absolute or relative to the
// project, into the dump's `## Last STATE lines` (its last 20 lines), and still read only a file whose real path lies
// under the project's `.private/work/`: anything else is `(no state file)`, a missing file or a folder there
// `(state file unreadable)`. Exit 0 always.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = fileURLToPath(new URL("../../../../", import.meta.url));
const HOOK = join(REPO, ".claude/hooks/precompact.mjs");
const NOW = "2026-10-04T22:42:00Z";
const INHERITED = [
  "CLAUDE_CODE_REMOTE",
  "VEXTRUS_ROLE",
  "CLAUDE_PROJECT_DIR",
  "VEXTRUS_NOW_UTC",
  "VEXTRUS_NOW",
  "VEXTRUS_PYTHON",
  "VEXTRUS_FACTORY_DIR",
  "PYTHONPATH",
];
const GIT_ENV = {
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_CONFIG_NOSYSTEM: "1",
  GIT_AUTHOR_NAME: "Fixture",
  GIT_AUTHOR_EMAIL: "fixture@example.invalid",
  GIT_COMMITTER_NAME: "Fixture",
  GIT_COMMITTER_EMAIL: "fixture@example.invalid",
  GIT_AUTHOR_DATE: "2026-10-04T20:00:00Z",
  GIT_COMMITTER_DATE: "2026-10-04T20:00:00Z",
};
const FACTORY = ".private/work/factory";
const STATE = ".private/work/session-12/STATE.md";
const DUMP = "precompact-20261004T224200Z.md";
const SECTION = "## Last STATE lines\n";
const BRANCH = "s12-fixture-branch";
const SECRET = "outside-secret";
const PYTHON = process.env.VEXTRUS_PYTHON ?? "python3";
const pad = (n) => String(n).padStart(2, "0");

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

/** A main checkout with one commit, the factory folder and a 30-line STATE file (no session.json yet). */
function project() {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), "p6-precompact-")));
  git(dir, "init", "-q", "-b", BRANCH);
  writeFileSync(join(dir, "README.md"), `fixture ${SECRET}-readme\n`);
  git(dir, "add", "README.md");
  git(dir, "commit", "-q", "-m", "fixture: the head commit's subject");
  mkdirSync(join(dir, FACTORY, "ledger"), { recursive: true });
  mkdirSync(join(dir, ".private/work/session-12"), { recursive: true });
  const lines = Array.from({ length: 30 }, (_, i) => `2026-10-04T21:${pad(i + 10)}:00Z state-entry-${pad(i + 1)}`);
  writeFileSync(join(dir, STATE), `${lines.join("\n")}\n`);
  return dir;
}

/** session.json as `stamp start` lays it out; `state` undefined leaves the key out. */
function session(dir, state) {
  const body = { schema: 1, started_utc: "2026-10-04T21:08:00Z", budget_minutes: 660, phases: [] };
  if (state !== undefined) body.state_file = state;
  writeFileSync(join(dir, FACTORY, "session.json"), JSON.stringify(body));
}

function run(dir, { args = [], env = {} } = {}) {
  const event = args[0] === "restore" ? { hook_event_name: "SessionStart", source: "compact" } : { hook_event_name: "PreCompact", trigger: "manual" };
  return spawnSync(process.execPath, [HOOK, ...args], {
    cwd: dir,
    input: JSON.stringify({ ...event, session_id: "s", cwd: dir }),
    env: environment({ CLAUDE_PROJECT_DIR: dir, VEXTRUS_NOW_UTC: NOW, ...env }),
    encoding: "utf8",
    timeout: 15_000,
  });
}

/** Run the dump for `projectDir` and return the whole dump (read from `realDir`) and its STATE section's lines. */
function dumpOf(projectDir, realDir = projectDir) {
  const done = run(projectDir);
  assert.equal(done.status, 0, done.stderr);
  const path = join(realDir, FACTORY, DUMP);
  assert.ok(existsSync(path), `the dump ${DUMP} was written`);
  const text = readFileSync(path, "utf8");
  assert.ok(text.includes(SECTION), "the dump has its Last STATE lines section");
  const lines = text.split(SECTION)[1].replace(/\n$/, "").split("\n");
  return { text, lines };
}

function assertLastTwenty(lines) {
  assert.ok(!lines.includes("(no state file)"), `the state file was not read: ${lines.join(" | ")}`);
  assert.equal(lines.length, 20, `20 STATE lines: ${lines.join(" | ")}`);
  for (let n = 11; n <= 30; n += 1) assert.ok(lines.some((line) => line.endsWith(`state-entry-${pad(n)}`)), `state-entry-${pad(n)}`);
  assert.ok(!lines.some((line) => line.includes("state-entry-10")), "state-entry-10 is older than the last 20");
}

function assertRefused(dir, state, label) {
  session(dir, state);
  const { text, lines } = dumpOf(dir);
  assert.deepEqual(lines, ["(no state file)"], `${label}: ${lines.join(" | ")}`);
  assert.ok(!text.includes(SECRET), `${label}: nothing from the refused file reaches the dump`);
  assert.ok(!text.includes("state-entry-"), `${label}: no STATE line reaches the dump`);
}

/** A second folder outside the project holding a file with the secret. */
function outsideFile() {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), "p6-precompact-outside-")));
  writeFileSync(join(dir, "STATE.md"), `${SECRET}\n`);
  return join(dir, "STATE.md");
}

function stamp(dir, ...args) {
  const done = spawnSync(PYTHON, ["-m", "scripts.factory.stamp", ...args], {
    cwd: dir,
    env: environment({ PYTHONPATH: REPO, VEXTRUS_FACTORY_DIR: join(dir, FACTORY), VEXTRUS_NOW: NOW }),
    encoding: "utf8",
    timeout: 30_000,
  });
  assert.equal(done.status, 0, `stamp ${args.join(" ")}: ${done.stdout}${done.stderr}${done.error ?? ""}`);
}

test("an absolute state_file inside the project's .private/work/ is read: its last 20 lines", () => {
  const dir = project();
  session(dir, join(dir, STATE));
  assertLastTwenty(dumpOf(dir).lines);
});

test("through the real `stamp start` and one stamped line, the dump ends with that line and restore prints it", () => {
  const dir = project();
  stamp(dir, "start", "--budget", "11h", "--state", STATE);
  stamp(dir, "state-entry-31");
  const { lines } = dumpOf(dir);
  assert.ok(!lines.includes("(no state file)"), `the state file stamp recorded was not read: ${lines.join(" | ")}`);
  assert.equal(lines.length, 20, `20 STATE lines: ${lines.join(" | ")}`);
  assert.match(lines.at(-1), /state-entry-31$/);
  assert.ok(lines.some((line) => line.endsWith("state-entry-12")), "state-entry-12");
  assert.ok(!lines.some((line) => line.endsWith("state-entry-11")), "state-entry-11 is older than the last 20");
  const restored = run(dir, { args: ["restore"] });
  assert.equal(restored.status, 0, restored.stderr);
  assert.ok(restored.stdout.includes("state-entry-31"), `restore: ${restored.stdout}`);
});

test("a relative state_file (taken from the project) is still read", () => {
  const dir = project();
  session(dir, STATE);
  assertLastTwenty(dumpOf(dir).lines);
});

test("a project reached through a symlink reads the state file stamp recorded by its real path", () => {
  const real = project();
  const link = join(realpathSync(mkdtempSync(join(tmpdir(), "p6-precompact-link-"))), "checkout");
  symlinkSync(real, link);
  session(real, join(real, STATE));
  assertLastTwenty(dumpOf(link, real).lines);
  session(real, join(link, STATE));
  assertLastTwenty(dumpOf(link, real).lines);
});

test("refused: an absolute path outside the project", () => {
  const dir = project();
  assertRefused(dir, outsideFile(), "outside the project");
});

test("refused: an absolute path inside the project but not under .private/work/", () => {
  const dir = project();
  mkdirSync(join(dir, ".private/reference"), { recursive: true });
  writeFileSync(join(dir, ".private/reference/x.md"), `${SECRET}-reference\n`);
  assertRefused(dir, join(dir, "README.md"), "the project's README");
  assertRefused(dir, join(dir, ".private/reference/x.md"), ".private/reference/");
});

test("refused: the sibling-prefix trap .private/work-evil/", () => {
  const dir = project();
  mkdirSync(join(dir, ".private/work-evil"), { recursive: true });
  writeFileSync(join(dir, ".private/work-evil/STATE.md"), `${SECRET}-evil\n`);
  assertRefused(dir, join(dir, ".private/work-evil/STATE.md"), "absolute .private/work-evil/");
  assertRefused(dir, ".private/work-evil/STATE.md", "relative .private/work-evil/");
});

test("refused: a path that climbs out of .private/work/ with ..", () => {
  const dir = project();
  mkdirSync(join(dir, ".private/reference"), { recursive: true });
  writeFileSync(join(dir, ".private/reference/x.md"), `${SECRET}-reference\n`);
  assertRefused(dir, `${dir}/.private/work/../reference/x.md`, "absolute .private/work/../reference/");
  assertRefused(dir, ".private/work/../../README.md", "relative .private/work/../../README.md");
});

test("refused: a file under .private/work/ that is a symlink to a file outside it", () => {
  const dir = project();
  symlinkSync(outsideFile(), join(dir, ".private/work/session-12/linked.md"));
  assertRefused(dir, join(dir, ".private/work/session-12/linked.md"), "an absolute symlink out");
  assertRefused(dir, ".private/work/session-12/linked.md", "a relative symlink out");
});

test("refused without a crash: state_file not a non-empty string", () => {
  const dir = project();
  for (const state of [7, null, undefined, "", ["x"], { path: STATE }]) assertRefused(dir, state, `state_file ${JSON.stringify(state)}`);
});

test("an absolute state_file under .private/work/ that is missing or a folder is unreadable", () => {
  const dir = project();
  for (const state of [join(dir, ".private/work/session-12/MISSING.md"), join(dir, ".private/work/session-12")]) {
    session(dir, state);
    const { lines } = dumpOf(dir);
    assert.deepEqual(lines, ["(state file unreadable)"], `${state}: ${lines.join(" | ")}`);
  }
});
