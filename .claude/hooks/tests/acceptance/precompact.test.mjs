// Acceptance (ticket f6, tier 2): the PreCompact dump, `.claude/hooks/precompact.mjs`. docs/specs/factory.md §3.5:
// on PreCompact (manual|auto) it writes the branch, head, budget, open rounds and the last STATE lines to
// `.private/work/factory/precompact-<utc>.md`; SessionStart `compact` (`precompact.mjs restore`) prints the newest
// back. It writes only where `.private/work/factory/` already exists and never blocks. Open rounds are ledger
// records (`.private/work/factory/ledger/<PR>-<head>.json`, ledger-record.schema.json) whose verdict is not PASS.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = fileURLToPath(new URL("../../../../", import.meta.url));
const HOOK = join(REPO, ".claude/hooks/precompact.mjs");
const NOW = "2026-10-04T22:42:00Z";
const INHERITED = ["CLAUDE_CODE_REMOTE", "VEXTRUS_ROLE", "CLAUDE_PROJECT_DIR", "VEXTRUS_NOW_UTC", "VEXTRUS_PYTHON"];
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
const BRANCH = "s12-fixture-branch";
const SUBJECT = "fixture: the head commit's subject";
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

function ledgerRecord(pr, head, verdict) {
  return {
    schema_version: 1,
    pr,
    head,
    round: 1,
    verdict,
    counts: { reviewers: 2, findings: verdict === "PASS" ? 0 : 2, findings_ge_50: 0, confirmed: 0, refuted: 0, unproven: 0, unrefuted_ge_50: 0 },
    decision_input_sha256: "c".repeat(64),
    comment_id: 1000 + pr,
    exception: null,
    source: "review-pr",
    recorded_at: "2026-10-04T22:00:00Z",
  };
}

/** A main checkout on BRANCH with the factory folder, session.json, a 30-line STATE file and two ledger records. */
function project({ factory = true, full = true } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "f6-precompact-"));
  git(dir, "init", "-q", "-b", BRANCH);
  writeFileSync(join(dir, "README.md"), "fixture\n");
  git(dir, "add", "README.md");
  git(dir, "commit", "-q", "-m", SUBJECT);
  if (!factory) return dir;
  mkdirSync(join(dir, FACTORY, "ledger"), { recursive: true });
  if (!full) return dir;
  writeFileSync(
    join(dir, FACTORY, "session.json"),
    JSON.stringify({
      schema: 1,
      started_utc: "2026-10-04T21:08:00Z",
      budget_minutes: 660,
      state_file: ".private/work/session-12/STATE.md",
      phases: [{ name: "build", minutes: 150, start_utc: "2026-10-04T21:30:00Z" }],
    }),
  );
  mkdirSync(join(dir, ".private/work/session-12"), { recursive: true });
  const lines = Array.from({ length: 30 }, (_, i) => `2026-10-04 21:${pad(i + 10)}Z state-entry-${pad(i + 1)} fixture line`);
  writeFileSync(join(dir, ".private/work/session-12/STATE.md"), `${lines.join("\n")}\n`);
  writeFileSync(join(dir, FACTORY, "ledger", `4711-${"a".repeat(40)}.json`), JSON.stringify(ledgerRecord(4711, "a".repeat(40), "FIX")));
  writeFileSync(join(dir, FACTORY, "ledger", `4712-${"b".repeat(40)}.json`), JSON.stringify(ledgerRecord(4712, "b".repeat(40), "PASS")));
  return dir;
}

function run(dir, { args = [], stdin, env = {} } = {}) {
  const event = args[0] === "restore" ? { hook_event_name: "SessionStart", source: "compact" } : { hook_event_name: "PreCompact", trigger: "auto", custom_instructions: "" };
  return spawnSync(process.execPath, [HOOK, ...args], {
    cwd: dir || tmpdir(),
    input: stdin ?? JSON.stringify({ ...event, session_id: "s", cwd: dir }),
    env: environment({ CLAUDE_PROJECT_DIR: dir, VEXTRUS_NOW_UTC: NOW, ...env }),
    encoding: "utf8",
    timeout: 15_000,
  });
}

const dumps = (dir) => (existsSync(join(dir, FACTORY)) ? readdirSync(join(dir, FACTORY)).filter((name) => /^precompact-.*\.md$/.test(name)) : []);

function assertQuiet(done) {
  assert.equal(done.status, 0, done.stderr);
  assert.equal(done.stdout.trim(), "", `PreCompact prints nothing: ${done.stdout}`);
}

test("PreCompact writes one dump named by the UTC compact stamp, silently", () => {
  const dir = project();
  assertQuiet(run(dir));
  const names = dumps(dir);
  assert.equal(names.length, 1, `dumps: ${names}`);
  assert.match(names[0], /^precompact-20261004T2242(\d\d)?Z\.md$/);
});

test("the dump holds the branch, HEAD's short sha and subject, the budgets, the open rounds and the last 20 STATE lines", () => {
  const dir = project();
  assertQuiet(run(dir));
  const text = readFileSync(join(dir, FACTORY, dumps(dir)[0]), "utf8");
  assert.ok(text.includes(BRANCH), "branch");
  assert.ok(text.includes(git(dir, "rev-parse", "HEAD").slice(0, 7)), "HEAD short sha");
  assert.ok(text.includes(SUBJECT), "HEAD subject");
  assert.ok(text.includes("11:00"), "the session budget");
  assert.ok(text.includes("build") && text.includes("2:30"), "the phase and its budget");
  assert.ok(text.includes("4711"), "the open (FIX) round");
  assert.ok(!text.includes("4712"), "a PASS record is not an open round");
  for (let n = 11; n <= 30; n += 1) assert.ok(text.includes(`state-entry-${pad(n)}`), `STATE line ${n}`);
  for (let n = 1; n <= 10; n += 1) assert.ok(!text.includes(`state-entry-${pad(n)}`), `STATE line ${n} is older than the last 20`);
});

test("restore prints the newest dump by name, capped at 8000 characters", () => {
  const dir = project();
  const older = join(dir, FACTORY, "precompact-20261004T200000Z.md");
  const newer = join(dir, FACTORY, "precompact-20261004T210000Z.md");
  writeFileSync(newer, `NEWER-DUMP\n${"x".repeat(20_000)}\n`);
  writeFileSync(older, "OLDER-DUMP\n");
  // The older name has the newer mtime: newest means by name.
  utimesSync(newer, new Date("2026-10-04T21:00:00Z"), new Date("2026-10-04T21:00:00Z"));
  utimesSync(older, new Date("2026-10-04T22:00:00Z"), new Date("2026-10-04T22:00:00Z"));
  const done = run(dir, { args: ["restore"] });
  assert.equal(done.status, 0, done.stderr);
  assert.ok(done.stdout.includes("NEWER-DUMP"));
  assert.ok(!done.stdout.includes("OLDER-DUMP"));
  assert.ok(done.stdout.length <= 8000, `${done.stdout.length} chars`);
});

test("restore after a dump prints that dump back", () => {
  const dir = project();
  assertQuiet(run(dir));
  const done = run(dir, { args: ["restore"] });
  assert.equal(done.status, 0, done.stderr);
  assert.ok(done.stdout.includes(BRANCH));
  assert.ok(done.stdout.includes("state-entry-30"));
});

test("restore with no dump present is silent", () => {
  const dir = project();
  const done = run(dir, { args: ["restore"] });
  assertQuiet(done);
  const bare = project({ factory: false });
  assertQuiet(run(bare, { args: ["restore"], env: { CLAUDE_CODE_REMOTE: "true" } }));
});

test("no .private/work/factory (a cloud clone): writes nothing and creates no .private", () => {
  const dir = project({ factory: false });
  assertQuiet(run(dir, { env: { CLAUDE_CODE_REMOTE: "true" } }));
  assert.ok(!existsSync(join(dir, ".private")));
  const partial = project({ factory: false });
  mkdirSync(join(partial, ".private/work"), { recursive: true });
  assertQuiet(run(partial));
  assert.ok(!existsSync(join(partial, FACTORY)), "the factory folder is not created");
});

test("unreadable inputs and garbage stdin: still writes what it can, exit 0, never a decision", () => {
  const dir = project({ full: false });
  writeFileSync(join(dir, FACTORY, "session.json"), "{ corrupt");
  writeFileSync(join(dir, FACTORY, "ledger", `4713-${"d".repeat(40)}.json`), "not json");
  const done = run(dir, { stdin: "garbage, not json" });
  assert.equal(done.status, 0, done.stderr);
  assert.doesNotMatch(done.stdout, /decision/);
  const names = dumps(dir);
  assert.equal(names.length, 1);
  assert.ok(readFileSync(join(dir, FACTORY, names[0]), "utf8").includes(BRANCH));
});

test("an unset or empty project folder: exit 0, no decision", () => {
  for (const value of [undefined, ""]) {
    const done = run(undefined, { env: { CLAUDE_PROJECT_DIR: value } });
    assert.equal(done.status, 0, done.stderr);
    assert.doesNotMatch(done.stdout, /decision/);
  }
});
