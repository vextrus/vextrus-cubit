// Acceptance (ticket T-SETTINGS, B): the StopFailure hook, `.claude/hooks/stop-failure.mjs`. A turn ended by an
// API error (rate limit, overloaded, billing) looks finished in unattended work, so the hook appends one line to
// the factory's event log the orchestrator Monitors. docs/specs/factory.md 3.5 (the StopFailure row). The seams:
// - line: `<UTC> STOP-FAILURE - <error_type> <session8>\n` (`VEXTRUS_NOW_UTC` stands in for the clock);
//   `<error_type>` only when it matches ^[a-z_]{1,40}$, else `unknown`; `<session8>` the first 8 chars of
//   `session_id` when they match ^[A-Za-z0-9-]{8}, else `-`; nothing else from the payload, ever;
// - folder: `VEXTRUS_FACTORY_DIR` (created if missing), else `<main checkout>/.private/work/factory` (the parent of
//   `git -C $CLAUDE_PROJECT_DIR rev-parse --git-common-dir`); nothing written when neither is known, or in the
//   cloud (`CLAUDE_CODE_REMOTE=true`) without `VEXTRUS_FACTORY_DIR`;
// - only a JSON object with `hook_event_name` "StopFailure" counts. Every path exits 0 and prints nothing.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = fileURLToPath(new URL("../../../../", import.meta.url));
const HOOK = join(REPO, ".claude/hooks/stop-failure.mjs");
const COMMAND = 'node "$CLAUDE_PROJECT_DIR"/.claude/hooks/stop-failure.mjs';
const INHERITED = ["CLAUDE_CODE_REMOTE", "CLAUDE_PROJECT_DIR", "VEXTRUS_FACTORY_DIR", "VEXTRUS_NOW_UTC", "VEXTRUS_ROLE"];
const GIT_ENV = {
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_CONFIG_NOSYSTEM: "1",
  GIT_AUTHOR_NAME: "Fixture",
  GIT_AUTHOR_EMAIL: "fixture@example.invalid",
  GIT_COMMITTER_NAME: "Fixture",
  GIT_COMMITTER_EMAIL: "fixture@example.invalid",
};
const NOW = "2026-10-05T03:00:00Z";

function environment(extra = {}) {
  const env = { ...process.env, ...GIT_ENV };
  for (const name of INHERITED) delete env[name];
  for (const [name, value] of Object.entries(extra)) {
    if (value === undefined) delete env[name];
    else env[name] = value;
  }
  return env;
}

const scratch = (name) => mkdtempSync(join(tmpdir(), `t-settings-${name}-`));

function git(cwd, ...args) {
  const done = spawnSync("git", ["-c", "commit.gpgsign=false", ...args], { cwd, env: environment(), encoding: "utf8" });
  assert.equal(done.status, 0, `git ${args.join(" ")}: ${done.stderr}`);
  return done.stdout.trim();
}

/** A git repository with one commit. */
function repository() {
  const dir = scratch("repo");
  git(dir, "init", "-q", "-b", "main");
  writeFileSync(join(dir, "README.md"), "fixture\n");
  git(dir, "add", "README.md");
  git(dir, "commit", "-q", "-m", "base");
  return dir;
}

function run(input, env = {}, cwd = scratch("cwd")) {
  const body = typeof input === "string" ? input : JSON.stringify(input);
  return spawnSync(process.execPath, [HOOK], {
    cwd,
    input: body,
    env: environment({ VEXTRUS_NOW_UTC: NOW, ...env }),
    encoding: "utf8",
    timeout: 15_000,
  });
}

function assertQuiet(done, what) {
  assert.equal(done.status, 0, `${what}: exit ${done.status}: ${done.stderr}`);
  assert.equal(done.stdout, "", `${what}: stdout`);
  assert.equal(done.stderr, "", `${what}: stderr`);
}

const payload = (fields = {}) => ({
  hook_event_name: "StopFailure",
  session_id: "abc12345-xyz",
  error_type: "rate_limit",
  ...fields,
});

test("a. a rate-limit failure appends one line with the type and the session's first 8 chars, nothing else", () => {
  const factory = join(scratch("a"), "f");
  const done = run(
    payload({ error_message: "SENTINEL-MSG", error_details: "SENTINEL-DET" }),
    { VEXTRUS_FACTORY_DIR: factory },
  );
  assertQuiet(done, "a");
  const log = readFileSync(join(factory, "events.log"), "utf8");
  assert.equal(log, `${NOW} STOP-FAILURE - rate_limit abc12345\n`);
  assert.ok(!log.includes("SENTINEL"), "the error text reached the log");
});

test("b. the log is appended to, never truncated: one new line per failure, in order", () => {
  const factory = scratch("b");
  const earlier = "2026-10-05T02:00:00Z READY T-X abcdef0\n";
  writeFileSync(join(factory, "events.log"), earlier);
  assertQuiet(
    run(payload({ error_type: "overloaded" }), { VEXTRUS_FACTORY_DIR: factory, VEXTRUS_NOW_UTC: "2026-10-05T03:01:00Z" }),
    "first",
  );
  assert.equal(
    readFileSync(join(factory, "events.log"), "utf8"),
    `${earlier}2026-10-05T03:01:00Z STOP-FAILURE - overloaded abc12345\n`,
  );
  assertQuiet(
    run(payload({ error_type: "server_error", session_id: "Zz9-8765abc" }), {
      VEXTRUS_FACTORY_DIR: factory,
      VEXTRUS_NOW_UTC: "2026-10-05T03:02:00Z",
    }),
    "second",
  );
  assert.equal(
    readFileSync(join(factory, "events.log"), "utf8"),
    `${earlier}2026-10-05T03:01:00Z STOP-FAILURE - overloaded abc12345\n` +
      "2026-10-05T03:02:00Z STOP-FAILURE - server_error Zz9-8765\n",
  );
});

test("c. a hostile or missing error_type is logged as unknown, on one line, with no forged text", () => {
  const cases = [
    ["a newline and a forged event", "x\nFORGED READY 1 y"],
    ["a space", "rate limit"],
    ["5,000 chars", "a".repeat(5000)],
    ["a number", 429],
    ["absent", undefined],
  ];
  for (const [what, errorType] of cases) {
    const factory = scratch("c");
    const body = payload();
    if (errorType === undefined) delete body.error_type;
    else body.error_type = errorType;
    assertQuiet(run(body, { VEXTRUS_FACTORY_DIR: factory }), what);
    const log = readFileSync(join(factory, "events.log"), "utf8");
    assert.equal(log, `${NOW} STOP-FAILURE - unknown abc12345\n`, what);
    assert.ok(!log.includes("FORGED"), `${what}: forged text in the log`);
  }
});

test("d. bad input exits 0, prints nothing and appends nothing", () => {
  const inputs = [
    "",
    "not json",
    "[]",
    "null",
    '"str"',
    "{}",
    JSON.stringify({ hook_event_name: "Stop", error_type: "rate_limit" }),
  ];
  const factory = scratch("d");
  const earlier = "2026-10-05T02:00:00Z READY T-X abcdef0\n";
  writeFileSync(join(factory, "events.log"), earlier);
  for (const input of inputs) {
    assertQuiet(run(input, { VEXTRUS_FACTORY_DIR: factory }), JSON.stringify(input));
    assert.equal(readFileSync(join(factory, "events.log"), "utf8"), earlier, `${JSON.stringify(input)} appended`);
  }
});

test("e. with no folder known, or in the cloud without VEXTRUS_FACTORY_DIR, nothing is written", () => {
  const cwd = repository();
  assertQuiet(run(payload(), {}, cwd), "no folder");
  assert.ok(!existsSync(join(cwd, ".private")), "wrote under the working directory");

  const project = repository();
  const elsewhere = repository();
  assertQuiet(run(payload(), { CLAUDE_CODE_REMOTE: "true", CLAUDE_PROJECT_DIR: project }, elsewhere), "cloud");
  assert.ok(!existsSync(join(project, ".private")), "wrote under the project in the cloud");
  assert.ok(!existsSync(join(elsewhere, ".private")), "wrote under the working directory in the cloud");
});

test("f. from a linked worktree the line lands in the main checkout's factory folder", () => {
  const main = repository();
  const worktree = join(scratch("wt"), "tree");
  git(main, "worktree", "add", "-q", "-b", "side", worktree);
  assertQuiet(run(payload(), { CLAUDE_PROJECT_DIR: worktree }, worktree), "worktree");
  assert.equal(
    readFileSync(join(main, ".private/work/factory/events.log"), "utf8"),
    `${NOW} STOP-FAILURE - rate_limit abc12345\n`,
  );
  assert.ok(!existsSync(join(worktree, ".private")), "wrote into the worktree");
});

test("g. a VEXTRUS_FACTORY_DIR that is a regular file is survived quietly and left as it was", () => {
  const file = join(scratch("g"), "not-a-folder");
  writeFileSync(file, "keep\n");
  const done = run(payload(), { VEXTRUS_FACTORY_DIR: file });
  assert.equal(done.status, 0, `exit ${done.status}: ${done.stderr}`);
  assert.equal(done.stdout, "");
  assert.equal(readFileSync(file, "utf8"), "keep\n");
});

test("h. .claude/settings.json registers the hook for every StopFailure, and the file exists", () => {
  const settings = JSON.parse(readFileSync(join(REPO, ".claude/settings.json"), "utf8"));
  const groups = settings.hooks?.StopFailure;
  assert.ok(Array.isArray(groups), "no StopFailure entry in .claude/settings.json");
  assert.equal(groups.length, 1);
  assert.ok([undefined, "", "*"].includes(groups[0].matcher), `matcher ${groups[0].matcher}`);
  assert.equal(groups[0].hooks.length, 1);
  const hook = groups[0].hooks[0];
  assert.deepEqual(Object.keys(hook).sort(), ["command", "timeout", "type"]);
  assert.equal(hook.type, "command");
  assert.equal(hook.command, COMMAND);
  assert.ok(Number.isInteger(hook.timeout) && hook.timeout >= 1 && hook.timeout <= 10, `timeout ${hook.timeout}`);
  assert.ok(existsSync(HOOK), ".claude/hooks/stop-failure.mjs does not exist");
});
