// Acceptance (ticket S30-F2d, issue #895; docs/plans/factory-s29.md item 2, F2, reframed after PR #887 hit the review
// cap): "The leak scan, lint and the Cut check run at `git commit` and `gh pr create` (PreToolUse), so a builder meets
// them before committing, never after." Reframed as ADVISORY (#895): the hook is a builder's early warning; the walls
// stay `scripts.factory.publish`'s range scan and CI. It denies only when it judges a call exactly and a check fails;
// whenever it cannot judge a call it allows, with a one-line note on stderr (never a silent pass, never a deny); it
// never writes the index and never fires a git hook; calls with no commit and no `gh pr create` are allowed.
// #890's class: READY commits whose `## Cut` held notes were refused at publish three times in session 29, so the READY
// commit's message gets merge_ready's Cut check at `git commit` (the Factory and attribution trailers set aside, as
// publish's `pr_body` does before it runs `cut_problems`).
//
// The seams (carried from #887's acceptance, the plan names no file):
// - the hook is `.claude/hooks/shift-left.mjs`, registered in `.claude/settings.json` as its own PreToolUse group with
//   the matcher `Bash`, the guard's literal group staying first;
// - it reads one PreToolUse event on stdin, `{hook_event_name, tool_name, tool_input: {command}, cwd}`; it denies with
//   exit 0 and stdout one JSON object `{hookSpecificOutput: {hookEventName: "PreToolUse", permissionDecision: "deny",
//   permissionDecisionReason}}`; it allows with exit 0 and nothing on stdout (never an "allow" decision, which would
//   skip the permission prompts);
// - a reason names the check (the leak scan, the acceptance check, the Cut check) and the place, `<path>:<line>`, never
//   the hit's text (the repository is public);
// - the leak scan is `python -m tools.leakscan` found by the hook's own location, its seams `VEXTRUS_LEAKSCAN_HOME` and
//   `VEXTRUS_LEAKSCAN_ALLOWLIST` and the interpreter `VEXTRUS_PYTHON` read from the hook's environment.
// Every corpus string is invented; every repository is made in a temporary folder.
//
// Not pinned (the builder's): the note's words; whether a call that stages and commits in one command is replayed
// (with hooks off) and judged, or noted; whether a READY commit lacking `## Cut` is warned (merge_ready passes it);
// a commit whose message is built by `$(cat <<EOF ...)`; a non-READY commit's Cut section; a Cut item linking an issue
// whose state the hook would read from GitHub (only the linked-and-allowed shape is pinned, with `gh` unreachable).
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = fileURLToPath(new URL("../../../../../", import.meta.url));
const HOOK = join(REPO, ".claude/hooks/shift-left.mjs");
const VENV = join(REPO, ".venv/bin/python");
const PYTHON = process.env.VEXTRUS_PYTHON || (existsSync(VENV) ? VENV : "python3");

// Invented corpus strings (no drawing holds them).
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
  "GH_TOKEN",
  "GITHUB_TOKEN",
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
  const root = mkdtempSync(join(tmpdir(), "s30f2d-"));
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

/** A `gh` that cannot reach GitHub (exit 1), first on PATH: no test makes a network call. */
function offlineGh(root) {
  const bin = join(root, "bin");
  mkdirSync(bin, { recursive: true });
  writeFileSync(join(bin, "gh"), "#!/bin/sh\necho 'gh: offline in this test' >&2\nexit 1\n");
  chmodSync(join(bin, "gh"), 0o755);
  return bin;
}

function hook(world, command, { tool = "Bash", input, raw } = {}) {
  const event = {
    hook_event_name: "PreToolUse",
    session_id: "s",
    tool_name: tool,
    tool_input: input ?? { command },
    cwd: world.repo,
  };
  const extra = {
    CLAUDE_PROJECT_DIR: world.repo,
    PATH: `${offlineGh(world.root)}:${process.env.PATH}`,
    ...world.seams,
  };
  if (process.env.VEXTRUS_PYTHON || existsSync(VENV)) extra.VEXTRUS_PYTHON = PYTHON;
  return spawnSync(process.execPath, [HOOK], {
    cwd: world.repo,
    input: raw ?? JSON.stringify(event),
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

/** Allowed: exit 0, nothing on stdout (no decision at all). */
function allowed(done) {
  assert.equal(done.status, 0, `exit ${done.status}: ${done.stderr}`);
  assert.equal(done.stdout.trim(), "", `expected no output, got ${done.stdout}`);
}

/** Allowed with the advisory note: exit 0, nothing on stdout, exactly one non-empty line on stderr. */
function noted(done) {
  allowed(done);
  const lines = done.stderr.trim().split("\n");
  assert.ok(done.stderr.trim() !== "", "a call the hook cannot judge passes silently (no stderr note)");
  assert.equal(lines.length, 1, `the note is one line, got ${JSON.stringify(done.stderr)}`);
}

function noText(done) {
  for (const stream of [done.stdout, done.stderr]) {
    const upper = stream.toUpperCase();
    for (const word of WORDS) assert.ok(!upper.includes(word), `the output names a corpus word (${word[0]}...)`);
  }
}

const ACCEPTANCE_FILE = "tools/x/tests/acceptance/t1/test_a.py";
const COUNTS = '-m "red-on-main: 1 failed" -m "green-on-throwaway: 1 passed"';
const TREE = "0123456789abcdef0123456789abcdef01234567";
const READY_TRAILERS = `-m "Factory-State: READY" -m "Factory-Verify: ${TREE} ok" -m "Co-Authored-By: Fixture <fixture@example.invalid>"`;

// ------------------------------------------------------------------------------------------------ git commit, judged

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

test("git commit: a leak hit only in an untracked file is allowed (the staged tree is what is judged)", () => {
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

// ------------------------------------------------------------------------------------------------ the READY commit's Cut (#890)

test("a READY commit whose ## Cut holds a note linking no issue is denied, naming the Cut check (#890)", () => {
  const world = fixture({ "docs/b.md": "another clean line\n" });
  const command = `git commit -m "ready: S99-X1, the widget" -m "The widget, all of it." -m "## Cut" -m "- For a later ticket: the export" ${READY_TRAILERS}`;
  const reason = denied(hook(world, command));
  assert.match(reason, /\bCut\b/, reason);
});

test("a READY commit read from a message file (-F <file>) whose ## Cut holds notes is denied, naming the Cut check", () => {
  const world = fixture({ "docs/b.md": "another clean line\n" });
  const message = [
    "ready: S99-X1, the widget",
    "",
    "The widget, all of it.",
    "",
    "## Cut",
    "None.",
    "",
    "Later tickets:",
    "- the tier 2 export",
    "",
    "Factory-State: READY",
    `Factory-Verify: ${TREE} ok`,
    "",
  ].join("\n");
  writeFileSync(join(world.root, "message.txt"), message);
  const reason = denied(hook(world, `git commit -F ${join(world.root, "message.txt")}`));
  assert.match(reason, /\bCut\b/, reason);
});

test("a READY commit whose ## Cut says None., its Factory and attribution trailers after it, is allowed", () => {
  const world = fixture({ "docs/b.md": "another clean line\n" });
  allowed(hook(world, `git commit -m "ready: S99-X1, the widget" -m "The widget." -m "## Cut" -m "None." ${READY_TRAILERS}`));
});

test("a READY commit whose one cut links an issue is not denied for its trailers (they are set aside, as publish does)", () => {
  const world = fixture({ "docs/b.md": "another clean line\n" });
  const done = hook(world, `git commit -m "ready: S99-X1, the widget" -m "The widget." -m "## Cut" -m "- the tier 2 export (#9)" ${READY_TRAILERS}`);
  allowed(done);
});

// ------------------------------------------------------------------------------------------------ gh pr create

const CLEAN_BODY = "Closes #9.\n\nThe widget.\n\n## Cut\nNone.\n";

test("gh pr create with a Cut item that links no issue is denied, naming the Cut check", () => {
  const world = fixture();
  write(world.repo, { "body.md": "Closes #9.\n\n## Cut\n- the tier 2 export\n" });
  const reason = denied(hook(world, 'gh pr create --title "S99-X1: the widget" --body-file body.md'));
  assert.match(reason, /\bCut\b/, reason);
});

test("gh pr create with notes after ## Cut None. is denied, naming the Cut check (#890's shape)", () => {
  const world = fixture();
  write(world.repo, { "body.md": "Closes #9.\n\n## Cut\nNone.\n\n- For a later ticket: the export\n" });
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

// ------------------------------------------------------------------------------------------------ cannot judge: allowed with one note

// The input class the hook cannot judge exactly (#895's standing findings, reframed): each row has a leak hit staged
// (and a bad Cut where a body is named), which a judged call would deny. Each is allowed, with one stderr line, and
// the note never holds the hit's text.
const CANNOT_JUDGE = [
  // #895 (55): shell-quoted spellings skipped the raw-text pre-filter.
  ["shell quoting splits the git word", 'g""it commit -m "docs: a note"'],
  ["shell quoting splits the commit word", 'git co""mmit -m "docs: a note"'],
  ["a backslash splits the git word", 'g\\it commit -m "docs: a note"'],
  // #895 (55): GIT_INDEX_FILE, GIT_DIR or GIT_WORK_TREE known only at run time.
  ["GIT_INDEX_FILE from a variable", 'GIT_INDEX_FILE=$IDX git commit -m "docs: a note"'],
  ["GIT_INDEX_FILE exported from a command substitution", 'export GIT_INDEX_FILE="$(mktemp)"; git commit -m "docs: a note"'],
  ["GIT_DIR from a variable", 'GIT_DIR="$D/.git" git commit -m "docs: a note"'],
  ["--git-dir from a variable", 'git --git-dir="$D" commit -m "docs: a note"'],
  ["GIT_WORK_TREE from a command substitution", 'GIT_WORK_TREE=$(pwd) git commit -m "docs: a note"'],
  ["-C a folder known only at run time", 'git -C "$WORK" commit -m "docs: a note"'],
  // #895 (45): the message is read from the hook's consumed standard input.
  ["-F /dev/stdin from a heredoc", "git commit -F /dev/stdin <<'EOF'\ndocs: a note\nEOF"],
  ["-F /dev/stdin from a pipe", "printf 'docs: a note\\n' | git commit -F /dev/stdin"],
  ["-F - from a pipe", "printf 'docs: a note\\n' | git commit -F -"],
  // Unknown verbs (an alias may commit).
  ["an unknown git verb with commit's options", 'git ci -m "docs: a note"'],
  // gh pr create whose body file is named only at run time.
  ["gh pr create --body-file from a variable", 'gh pr create --title "S99-X1: the widget" --body-file "$BODY"'],
];

for (const [label, command] of CANNOT_JUDGE) {
  test(`cannot judge (${label}): allowed with a one-line stderr note, never denied, never silent`, () => {
    const world = fixture({ "docs/leak.md": `the owner is ${ZEBRA} here\n` });
    write(world.repo, { "body.md": "Closes #9.\n\n## Cut\n- the tier 2 export\n" });
    const done = hook(world, command);
    noted(done);
    noText(done);
  });
}

test("no corpus (the leak scan cannot run): a clean commit is allowed with a one-line stderr note", () => {
  const world = fixture({ "docs/b.md": "another clean line\n" });
  const empty = join(world.root, "no-leakhome");
  mkdirSync(empty);
  world.seams = { ...world.seams, VEXTRUS_LEAKSCAN_HOME: empty };
  noted(hook(world, 'git commit -m "docs: a note"'));
});

// ------------------------------------------------------------------------------------------------ never writes the index, never fires a git hook

/** Installs a post-index-change hook that leaves a marker file when it runs; returns the marker's path. */
function tripwire(world) {
  const marker = join(world.root, "post-index-change-ran");
  const hooks = join(world.repo, ".git/hooks");
  mkdirSync(hooks, { recursive: true });
  writeFileSync(join(hooks, "post-index-change"), `#!/bin/sh\necho ran >> '${marker}'\n`);
  chmodSync(join(hooks, "post-index-change"), 0o755);
  return marker;
}

test("the fixture's post-index-change tripwire fires on a real index write (so its silence below means something)", () => {
  const world = fixture();
  const marker = tripwire(world);
  write(world.repo, { "docs/c.md": "a clean line\n" });
  git(world.repo, "add", "--", "docs/c.md");
  assert.ok(existsSync(marker), "git add did not fire post-index-change: the tripwire is broken");
});

const STAGING = [
  ["git add then git commit", 'git add docs/leak.md && git commit -m "docs: a note"'],
  ["git add -u then git commit", 'git add -u && git commit -m "docs: a note"'],
  ["git rm --cached then git commit", 'git rm -q --cached docs/a.md && git commit -m "docs: a note"'],
  ["git commit -a", 'git commit -a -m "docs: a note"'],
  ["a plain git commit", 'git commit -m "docs: a note"'],
];

for (const [label, command] of STAGING) {
  test(`${label}: the hook never writes the index and never fires the repository's post-index-change hook`, () => {
    const world = fixture();
    write(world.repo, { "docs/leak.md": `the owner is ${ZEBRA} here\n`, "docs/a.md": `changed, ${MARIGOLD}\n` });
    const marker = tripwire(world);
    const index = join(world.repo, ".git/index");
    const before = readFileSync(index);
    const done = hook(world, command);
    assert.equal(done.status, 0, `exit ${done.status}: ${done.stderr}`);
    assert.ok(!existsSync(marker), "a git hook ran inside the shift-left hook");
    assert.ok(Buffer.compare(before, readFileSync(index)) === 0, "the shift-left hook wrote the index");
    assert.match(git(world.repo, "status", "--porcelain", "--", "docs/leak.md"), /^\?\? docs\/leak\.md$/m);
    noText(done);
  });
}

test("git add then git commit staging a leak hit is not a silent pass: denied naming the leak scan, or allowed with one note", () => {
  const world = fixture();
  write(world.repo, { "docs/leak.md": `the owner is ${ZEBRA} here\n` });
  const done = hook(world, 'git add docs/leak.md && git commit -m "docs: a note"');
  if (done.stdout.trim() !== "") assert.match(denied(done), /leak/i);
  else noted(done);
  noText(done);
});

// ------------------------------------------------------------------------------------------------ no commit, no gh pr create: allowed

test("a Bash call that is not a commit or a PR is allowed, even with a leak hit staged", () => {
  const world = fixture({ "docs/leak.md": `the owner is ${ZEBRA} here\n` });
  for (const command of ["git status", "git diff --cached", "git log -1", "ls docs", "gh pr view 9", "echo git commit"]) {
    allowed(hook(world, command));
  }
});

test("#895 (50): an unlisted git verb in a folder known only at run time, with no commit, is allowed", () => {
  const world = fixture({ "docs/leak.md": `the owner is ${ZEBRA} here\n` });
  for (const command of [
    'git -C "$WORK" frobnicate',
    'cd "$WORK" && git notes list',
    'git --git-dir="$D" rev-list --count HEAD',
    'cd "$(git rev-parse --show-toplevel)" && git worktree list',
  ]) {
    allowed(hook(world, command));
  }
});

test("another tool, garbage stdin or an empty command is allowed with nothing on stdout", () => {
  const world = fixture({ "docs/leak.md": `the owner is ${ZEBRA} here\n` });
  allowed(hook(world, undefined, { tool: "Edit", input: { file_path: join(world.repo, "docs/a.md"), old_string: "a", new_string: "b" } }));
  allowed(hook(world, undefined, { raw: "not json {" }));
  allowed(hook(world, ""));
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
