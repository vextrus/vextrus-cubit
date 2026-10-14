// Acceptance (ticket S29-F2b; docs/plans/factory-s29.md item 2, F2): "The leak scan, lint and the Cut check run at
// `git commit` and `gh pr create` (PreToolUse), so a builder meets them before committing, never after."
//
// The contract pinned here (the seams named by the writer, since the plan names no file):
// - the hook is `.claude/hooks/shift-left.mjs`, registered in `.claude/settings.json` as its own PreToolUse group
//   with the matcher `Bash` (builders load the project's settings; `scripts/factory/builder.settings.json` carries no
//   hooks, which test_settings_files.py B2 pins), the guard's literal group staying first;
// - it reads one PreToolUse event on stdin, `{hook_event_name, tool_name, tool_input: {command}, cwd}`, exactly as the
//   guard does, and refuses as the guard does: exit 0, stdout one JSON object `{hookSpecificOutput: {hookEventName:
//   "PreToolUse", permissionDecision: "deny", permissionDecisionReason}}`; it allows with exit 0 and no output;
// - the reason names the check (the leak scan, the acceptance check, the Cut check) and the place, `<path>:<line>`,
//   never the hit's text (the repository is public);
// - the leak scan runs as `python -m tools.leakscan` found by the hook's own location (the fixture repository has no
//   `tools/`), with its seams `VEXTRUS_LEAKSCAN_HOME` and `VEXTRUS_LEAKSCAN_ALLOWLIST` read from the hook's
//   environment, and the interpreter `VEXTRUS_PYTHON` when set (as the walk gate does).
// Every corpus string is invented (tools/leakscan/tests/acceptance/_leak.py's); every repository is made in a
// temporary folder. Not pinned: no corpus (cloud sessions have none), `git commit -a`/`-F`/`--amend`, a compound call
// that stages and commits in one command beyond its being
// denied (one case below; how it is denied is the builder's).
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = fileURLToPath(new URL("../../../../../", import.meta.url));
const HOOK = join(REPO, ".claude/hooks/shift-left.mjs");
const VENV = join(REPO, ".venv/bin/python");
const PYTHON = process.env.VEXTRUS_PYTHON || (existsSync(VENV) ? VENV : "python3");

// Invented corpus strings (no drawing holds them), the scanner's own test patterns.
const ZEBRA = "Zebra Quarry Holdings Pvt 7731";
const MARIGOLD = "Marigold Tannery Lane 42";
const WORDS = ["ZEBRA", "QUARRY", "MARIGOLD", "TANNERY"];

const INHERITED = [
  "CLAUDE_CODE_REMOTE",
  "VEXTRUS_ROLE",
  "CLAUDE_PROJECT_DIR",
  "PYTHONPATH",
  "VEXTRUS_LEAKSCAN_HOME",
  "VEXTRUS_LEAKSCAN_ALLOWLIST",
  "VEXTRUS_MAIN_CHECKOUT",
  "GIT_DIR",
  "GIT_WORK_TREE",
  "GIT_INDEX_FILE",
];
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
  return { ...env, ...extra };
}

function git(cwd, ...args) {
  const done = spawnSync("git", args, { cwd, env: environment(), encoding: "utf8" });
  assert.equal(done.status, 0, `git ${args.join(" ")}: ${done.stderr}`);
  return done.stdout.trim();
}

function write(root, files) {
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
}

/** A leak-scan home whose corpus is built from invented strings, and an empty allowlist. */
function leakHome(root) {
  const sources = join(root, "sources");
  write(sources, { "notes.txt": `${ZEBRA}\n${MARIGOLD}\n` });
  const home = join(root, "leakhome");
  const allowlist = join(root, "allowlist.txt");
  writeFileSync(allowlist, "");
  const seams = { VEXTRUS_LEAKSCAN_HOME: home, VEXTRUS_LEAKSCAN_ALLOWLIST: allowlist };
  const built = spawnSync(PYTHON, ["-m", "tools.leakscan", "build", "--source", sources], {
    cwd: REPO,
    env: environment({ ...seams, PYTHONPATH: REPO }),
    encoding: "utf8",
  });
  assert.equal(built.status, 0, `corpus build: ${built.stdout}${built.stderr}`);
  return seams;
}

/** A repository with one clean commit (origin/main at it), the given files staged on top. */
function fixture(staged = {}) {
  const root = mkdtempSync(join(tmpdir(), "s29f2b-"));
  const repo = join(root, "repo");
  mkdirSync(repo);
  git(repo, "init", "-q", "-b", "s99-x1");
  write(repo, { "docs/a.md": "a clean first line\n" });
  git(repo, "add", "--", "docs/a.md");
  git(repo, "commit", "-q", "-m", "base: the first commit");
  git(repo, "update-ref", "refs/remotes/origin/main", "HEAD");
  write(repo, staged);
  if (Object.keys(staged).length > 0) git(repo, "add", "--", ...Object.keys(staged));
  return { root, repo, seams: leakHome(root) };
}

function hook(world, command, { tool = "Bash", input } = {}) {
  const event = {
    hook_event_name: "PreToolUse",
    session_id: "s",
    tool_name: tool,
    tool_input: input ?? { command },
    cwd: world.repo,
  };
  const extra = { CLAUDE_PROJECT_DIR: world.repo, ...world.seams };
  if (process.env.VEXTRUS_PYTHON || existsSync(VENV)) extra.VEXTRUS_PYTHON = PYTHON;
  return spawnSync(process.execPath, [HOOK], {
    cwd: world.repo,
    input: JSON.stringify(event),
    env: environment(extra),
    encoding: "utf8",
    timeout: 60_000,
  });
}

function denied(done) {
  assert.equal(done.status, 0, `exit ${done.status}: ${done.stderr}`);
  let out;
  assert.doesNotThrow(() => (out = JSON.parse(done.stdout)), `stdout is one JSON object: ${done.stdout}`);
  assert.equal(out?.hookSpecificOutput?.hookEventName, "PreToolUse");
  assert.equal(out.hookSpecificOutput.permissionDecision, "deny");
  const reason = out.hookSpecificOutput.permissionDecisionReason;
  assert.equal(typeof reason, "string");
  return reason;
}

function allowed(done) {
  assert.equal(done.status, 0, `exit ${done.status}: ${done.stderr}`);
  assert.equal(done.stdout.trim(), "", `expected no output, got ${done.stdout}`);
}

function noText(done) {
  for (const stream of [done.stdout, done.stderr]) {
    const upper = stream.toUpperCase();
    for (const word of WORDS) assert.ok(!upper.includes(word), `the output names a corpus word (${word[0]}...)`);
  }
}

const ACCEPTANCE_FILE = "tools/x/tests/acceptance/t1/test_a.py";
const COUNTS = '-m "red-on-main: 1 failed" -m "green-on-throwaway: 1 passed"';

// ------------------------------------------------------------------------------------------------ git commit

test("git commit with a leak hit staged is denied, naming the leak scan and <path>:<line>, never the text", () => {
  const world = fixture({ "docs/leak.md": `a clean line\nthe owner is ${ZEBRA} here\n` });
  const done = hook(world, 'git commit -m "docs: a note"');
  const reason = denied(done);
  assert.match(reason, /leak/i, reason);
  assert.ok(reason.includes("docs/leak.md:2"), reason);
  noText(done);
});

test("git commit with a clean staged tree is allowed", () => {
  allowed(hook(fixture({ "docs/b.md": "another clean line\n" }), 'git commit -m "docs: a note"'));
});

test("git commit: a leak hit only in an unstaged, untracked file is allowed (the staged tree is what is judged)", () => {
  const world = fixture({ "docs/b.md": "another clean line\n" });
  write(world.repo, { "scratch/untracked.md": `${MARIGOLD}\n` });
  allowed(hook(world, 'git commit -m "docs: a note"'));
});

test("git commit staging an acceptance path under a message not starting acceptance: is denied, naming the acceptance check and the path", () => {
  const world = fixture({ [ACCEPTANCE_FILE]: "def test_a() -> None:\n    assert True\n", "tools/x/core.py": "X = 1\n" });
  const reason = denied(hook(world, 'git commit -m "S99-X1: the widget"'));
  assert.match(reason, /acceptance/i, reason);
  assert.ok(reason.includes(ACCEPTANCE_FILE), reason);
});

test("git commit with an acceptance: message that also stages a non-acceptance file is denied, naming the acceptance check and the file", () => {
  const world = fixture({ [ACCEPTANCE_FILE]: "def test_a() -> None:\n    assert True\n", "tools/x/core.py": "X = 1\n" });
  const reason = denied(hook(world, `git commit -m "acceptance: t1 pins the widget" ${COUNTS}`));
  assert.match(reason, /acceptance/i, reason);
  assert.ok(reason.includes("tools/x/core.py"), reason);
});

test("git commit with an acceptance: message staging only acceptance paths, with both counts, is allowed", () => {
  const world = fixture({ [ACCEPTANCE_FILE]: "def test_a() -> None:\n    assert True\n" });
  allowed(hook(world, `git commit -m "acceptance: t1 pins the widget" ${COUNTS}`));
});

test("git add then git commit in one Bash call, staging a leak hit, is denied (the scan cannot be skipped by staging in the same call)", () => {
  const world = fixture();
  write(world.repo, { "docs/leak.md": `the owner is ${ZEBRA} here\n` });
  denied(hook(world, 'git add docs/leak.md && git commit -m "docs: a note"'));
});

test("a Bash call that is not a commit or a PR is untouched, even with a leak hit staged", () => {
  const world = fixture({ "docs/leak.md": `the owner is ${ZEBRA} here\n` });
  for (const command of ["git status", "git diff --cached", "git log -1", "ls docs"]) allowed(hook(world, command));
  allowed(hook(world, undefined, { tool: "Edit", input: { file_path: join(world.repo, "docs/a.md"), old_string: "a", new_string: "b" } }));
});

// ------------------------------------------------------------------------------------------------ gh pr create

const CLEAN_BODY = "Closes #9.\n\nThe widget.\n\n## Cut\nNone.\n";

test("gh pr create with a body file lacking ## Cut is denied, naming the Cut check", () => {
  const world = fixture();
  write(world.repo, { "body.md": "Closes #9.\n\nThe widget, all of it.\n" });
  const reason = denied(hook(world, 'gh pr create --title "S99-X1: the widget" --body-file body.md'));
  assert.match(reason, /\bCut\b/, reason);
});

test("gh pr create with a Cut item that links no issue is denied, naming the Cut check", () => {
  const world = fixture();
  write(world.repo, { "body.md": "Closes #9.\n\n## Cut\n- the tier 2 export\n" });
  const reason = denied(hook(world, 'gh pr create --title "S99-X1: the widget" --body-file body.md'));
  assert.match(reason, /\bCut\b/, reason);
});

test("gh pr create with a leak hit in the body is denied, naming the leak scan and body.md:<line>, never the text", () => {
  const world = fixture();
  write(world.repo, { "body.md": `Closes #9.\n\nMade for ${MARIGOLD}.\n\n## Cut\nNone.\n` });
  const done = hook(world, 'gh pr create --title "S99-X1: the widget" --body-file body.md');
  const reason = denied(done);
  assert.match(reason, /leak/i, reason);
  assert.match(reason, /body\.md:3\b/, reason);
  noText(done);
});

test("gh pr create with a clean body holding ## Cut None. is allowed", () => {
  const world = fixture();
  write(world.repo, { "body.md": CLEAN_BODY });
  allowed(hook(world, 'gh pr create --title "S99-X1: the widget" --body-file body.md'));
});

// ------------------------------------------------------------------------------------------------ registration

test("the hook is registered in .claude/settings.json as a PreToolUse Bash group, after the guard's", () => {
  const settings = JSON.parse(readFileSync(join(REPO, ".claude/settings.json"), "utf8"));
  const groups = settings.hooks.PreToolUse;
  assert.equal(groups[0].hooks[0].command, 'node "$CLAUDE_PROJECT_DIR"/.claude/hooks/guard.mjs', "the guard's group stays first");
  const command = 'node "$CLAUDE_PROJECT_DIR"/.claude/hooks/shift-left.mjs';
  const found = groups.filter((group) => group.matcher === "Bash" && (group.hooks ?? []).some((h) => h.command === command));
  assert.equal(found.length, 1, "one PreToolUse group, matcher Bash, runs shift-left.mjs");
  const entry = found[0].hooks.find((h) => h.command === command);
  assert.equal(entry.type, "command");
  assert.ok(Number.isInteger(entry.timeout) && entry.timeout > 0, `timeout ${entry.timeout}`);
  assert.ok(existsSync(HOOK), "the registered file exists");
});
