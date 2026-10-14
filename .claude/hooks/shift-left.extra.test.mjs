// The shift-left hook's own cases beyond its acceptance pins (tests/acceptance/ts29f2b/shift-left.test.mjs): how it
// reads a call (cd, heredoc messages, -am, a call that does more than stage), and what it says when a check cannot run.
// Every corpus string is invented; every repository is made in a temporary folder.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = fileURLToPath(new URL("../../", import.meta.url));
const HOOK = join(REPO, ".claude/hooks/shift-left.mjs");
const VENV = join(REPO, ".venv/bin/python");
const PYTHON = process.env.VEXTRUS_PYTHON || (existsSync(VENV) ? VENV : "python3");
const ZEBRA = "Zebra Quarry Holdings Pvt 7731";
const INHERITED = ["CLAUDE_CODE_REMOTE", "VEXTRUS_ROLE", "CLAUDE_PROJECT_DIR", "PYTHONPATH", "VEXTRUS_LEAKSCAN_HOME", "VEXTRUS_LEAKSCAN_ALLOWLIST", "VEXTRUS_MAIN_CHECKOUT", "GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE"];
const GIT_ENV = { GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1", GIT_AUTHOR_NAME: "F", GIT_AUTHOR_EMAIL: "f@example.invalid", GIT_COMMITTER_NAME: "F", GIT_COMMITTER_EMAIL: "f@example.invalid" };

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

/** A repository with one commit and a leak home: a corpus built from ZEBRA, or `corpus` written as given. */
function world({ corpus } = {}) {
  const root = mkdtempSync(join(tmpdir(), "shift-left-x-"));
  const repo = join(root, "repo");
  mkdirSync(repo);
  git(repo, "init", "-q", "-b", "s99-x1");
  write(repo, { "docs/a.md": "a clean first line\n" });
  git(repo, "add", "--", "docs/a.md");
  git(repo, "commit", "-q", "-m", "base: the first commit");
  const home = join(root, "leakhome");
  const allowlist = join(root, "allowlist.txt");
  writeFileSync(allowlist, "");
  const seams = { VEXTRUS_LEAKSCAN_HOME: home, VEXTRUS_LEAKSCAN_ALLOWLIST: allowlist };
  if (corpus === undefined) {
    write(root, { "sources/notes.txt": `${ZEBRA}\n` });
    const built = spawnSync(PYTHON, ["-m", "tools.leakscan", "build", "--source", join(root, "sources")], { cwd: REPO, env: environment({ ...seams, PYTHONPATH: REPO }), encoding: "utf8" });
    assert.equal(built.status, 0, built.stdout + built.stderr);
  } else if (corpus !== null) write(home, { corpus });
  return { root, repo, seams };
}

function hook(w, command, { cwd = w.repo, env = {} } = {}) {
  const event = { hook_event_name: "PreToolUse", session_id: "s", tool_name: "Bash", tool_input: { command }, cwd };
  const extra = { CLAUDE_PROJECT_DIR: w.repo, ...w.seams, ...env };
  if (process.env.VEXTRUS_PYTHON || existsSync(VENV)) extra.VEXTRUS_PYTHON = PYTHON;
  const done = spawnSync(process.execPath, [HOOK], { cwd, input: JSON.stringify(event), env: environment(extra), encoding: "utf8", timeout: 60_000 });
  assert.equal(done.status, 0, done.stderr);
  for (const stream of [done.stdout, done.stderr]) assert.ok(!stream.toUpperCase().includes("ZEBRA"), "the output names a corpus word");
  return done;
}

const reason = (done) => {
  assert.notEqual(done.stdout.trim(), "", "expected a denial");
  const out = JSON.parse(done.stdout);
  assert.equal(out.hookSpecificOutput.permissionDecision, "deny");
  return out.hookSpecificOutput.permissionDecisionReason;
};
const allowed = (done) => assert.equal(done.stdout.trim(), "", `expected no output, got ${done.stdout}`);

test("cd into the repository, git add and git commit in one call: the cd is followed and the add replayed", () => {
  const w = world();
  write(w.repo, { "docs/leak.md": `x\n${ZEBRA}\n` });
  const said = reason(hook(w, `cd ${w.repo} && git add docs/leak.md && git commit -m "docs: a note"`, { cwd: w.root }));
  assert.ok(said.includes("docs/leak.md:2"), said);
  assert.equal(git(w.repo, "diff", "--cached", "--name-only"), "", "the real index is untouched");
});

test("git -C <repo> commit is judged in that repository", () => {
  const w = world();
  write(w.repo, { "docs/leak.md": `${ZEBRA}\n` });
  git(w.repo, "add", "docs/leak.md");
  assert.match(reason(hook(w, `git -C ${w.repo} commit -m "docs: a note"`, { cwd: w.root })), /leak scan/);
});

test("a leak in the commit message is denied at message:<line>", () => {
  const w = world();
  write(w.repo, { "docs/b.md": "clean\n" });
  git(w.repo, "add", "docs/b.md");
  const said = reason(hook(w, `git commit -m "docs: a note" -m "made for ${ZEBRA}"`));
  assert.ok(said.includes("message:3"), said);
});

test("a heredoc message is read: an acceptance: commit staging another file is denied", () => {
  const w = world();
  write(w.repo, { "tools/x/tests/acceptance/test_a.py": "X = 1\n", "tools/x/core.py": "X = 1\n" });
  git(w.repo, "add", "tools");
  const message = "acceptance: t1 pins it\n\nred-on-main: 1 failed\ngreen-on-throwaway: 1 passed";
  const said = reason(hook(w, `git commit -m "$(cat <<'EOF'\n${message}\nEOF\n)"`));
  assert.match(said, /acceptance check/);
  assert.ok(said.includes("tools/x/core.py"), said);
});

test("git commit -am stages the tracked change it commits", () => {
  const w = world();
  write(w.repo, { "docs/a.md": `${ZEBRA}\n` });
  assert.ok(reason(hook(w, 'git commit -am "docs: a note"')).includes("docs/a.md:1"));
});

test("a commit after anything but cd and git add in the same call is refused, naming the rule", () => {
  const w = world();
  for (const command of ['npm run fmt && git commit -m "x"', 'git stash pop; git commit -m "x"', 'echo a > docs/a.md && git add docs/a.md && git commit -m "x"']) {
    assert.match(reason(hook(w, command)), /alone in its call/, command);
  }
});

test("a clean commit followed by a push, a git status before a commit, and a merge-less tree are allowed", () => {
  const w = world();
  write(w.repo, { "docs/b.md": "clean\n" });
  git(w.repo, "add", "docs/b.md");
  allowed(hook(w, 'git status && git commit -m "docs: b" && git push origin HEAD:s99-x1'));
});

test("no corpus: allowed, with one stderr line saying the scan was skipped", () => {
  const w = world({ corpus: null });
  write(w.repo, { "docs/b.md": "clean\n" });
  git(w.repo, "add", "docs/b.md");
  const done = hook(w, 'git commit -m "docs: b"');
  allowed(done);
  assert.match(done.stderr, /leak scan skipped: no corpus/);
});

test("an empty corpus is not trusted: the commit is denied, the leak scan named", () => {
  const w = world({ corpus: "" });
  write(w.repo, { "docs/b.md": "clean\n" });
  git(w.repo, "add", "docs/b.md");
  assert.match(reason(hook(w, 'git commit -m "docs: b"')), /leak scan cannot scan the staged commit \(corpus-unreadable\)/);
});

test("concluding a merge: acceptance files from the other side do not need an acceptance: message", () => {
  const w = world();
  git(w.repo, "checkout", "-q", "-b", "main");
  write(w.repo, { "tools/x/tests/acceptance/test_a.py": "X = 1\n" });
  git(w.repo, "add", "tools");
  git(w.repo, "commit", "-q", "-m", "acceptance: t1", "-m", "red-on-main: 1 failed", "-m", "green-on-throwaway: 1 passed");
  git(w.repo, "checkout", "-q", "s99-x1");
  git(w.repo, "merge", "-q", "--no-commit", "--no-ff", "main");
  allowed(hook(w, 'git commit -m "Merge main"'));
});

test("gh pr create without a body file is denied by the Cut check", () => {
  const w = world();
  for (const command of ['gh pr create --title "x" --fill', 'gh pr create --title x --body "short"', "gh pr create --title x --body-file -"]) {
    assert.match(reason(hook(w, command)), /Cut check/, command);
  }
});

test("gh pr create -F <f> with a clean body holding ## Cut is allowed", () => {
  const w = world();
  write(w.repo, { "pr.md": "The widget.\n\n## Cut\n- the export (#12)\n" });
  allowed(hook(w, "gh pr create --title x -F pr.md"));
});

test("garbage stdin, another tool, or a call naming neither git nor gh: allowed with no output", () => {
  const w = world();
  for (const input of ["not json", "", JSON.stringify({ tool_name: "Edit", tool_input: {} })]) {
    const done = spawnSync(process.execPath, [HOOK], { input, env: environment(), encoding: "utf8" });
    assert.equal(done.status, 0);
    assert.equal(done.stdout, "");
  }
  allowed(hook(w, "ls -la"));
});

// The refuter's round (S29-F2b): each spelling below committed a staged leak with no denial and no stderr note.
/** A world with a leak staged in docs/leak.md, line 1. */
function leaky() {
  const w = world();
  write(w.repo, { "docs/leak.md": `${ZEBRA}\n` });
  git(w.repo, "add", "docs/leak.md");
  return w;
}

test("a wrapper before git (nice, timeout, xargs) does not hide the commit", () => {
  for (const command of ['nice git commit -m "docs: n"', 'timeout 30 git commit -m "docs: n"', 'nice -n 5 /usr/bin/git commit -m "docs: n"']) {
    assert.match(reason(hook(leaky(), command)), /leak scan/, command);
  }
});

test("a git alias that commits or runs a shell is refused by name", () => {
  for (const command of ['git -c alias.zz=commit zz -m "docs: n"', "git -c 'alias.yy=!git commit' yy -m x"]) {
    assert.match(reason(hook(leaky(), command)), /alias/, command);
  }
});

test("a cd that cannot apply (a missing folder, a subshell, the background, a pipeline) leaves the folder as it was", () => {
  for (const make of [(w) => `cd ${w.root}/missing; git commit -m x`, (w) => `(cd ${w.root}); git commit -m x`, (w) => `cd ${w.root} & git commit -m x`, (w) => `cd ${w.root} | cat; git commit -m x`]) {
    const w = leaky();
    assert.match(reason(hook(w, make(w))), /leak scan|alone in its call/, make(w));
  }
});

test("GIT_DIR, GIT_INDEX_FILE or --git-dir set in the call refuses the commit", () => {
  for (const make of [(w) => `GIT_DIR=${w.repo}/.git git commit -m x`, (w) => `env GIT_INDEX_FILE=/tmp/x git commit -m x`, (w) => `export GIT_DIR=${w.repo}/.git; git commit -m x`, (w) => `git --git-dir=${w.repo}/.git commit -m x`]) {
    const w = leaky();
    assert.match(reason(hook(w, make(w), { cwd: w.root })), /GIT_DIR/, make(w));
  }
});

test("a message read from standard input or built at run time is named as not scanned", () => {
  const w = world();
  write(w.repo, { "docs/b.md": "clean\n" });
  git(w.repo, "add", "docs/b.md");
  for (const command of ['echo "docs: n" | git commit -F -', 'git commit -F - <<< "docs: n"', 'git commit -m "$(date)"']) {
    const done = hook(w, command);
    allowed(done);
    assert.match(done.stderr, /commit message was not scanned/, command);
  }
});

test("--fixup with -m still scans the -m text", () => {
  const w = world();
  assert.ok(reason(hook(w, `git commit --fixup HEAD -m "for ${ZEBRA}"`)).includes("message:1"));
});

test("brace expansion in git add, or --pathspec-from-file, is never replayed as written: refused", () => {
  const w = world();
  write(w.repo, { "docs/leak.md": `${ZEBRA}\n`, "docs/b.md": "clean\n", "list.txt": "docs/leak.md\n" });
  assert.match(reason(hook(w, "git add docs/{leak,b}.md && git commit -m x")), /alone in its call/);
  assert.match(reason(hook(w, "git commit --pathspec-from-file=list.txt -m x")), /pathspecs/);
});

test("a comment line holding an apostrophe does not hide what follows it", () => {
  const w = world();
  write(w.repo, { "docs/leak.md": `${ZEBRA}\n` });
  assert.match(reason(hook(w, "# don't forget\ngit add docs/leak.md && git commit -m x")), /leak scan/);
});

test("gh pr create naming a body file that does not exist yet is denied by the Cut check", () => {
  const w = world();
  assert.match(reason(hook(w, "gh pr create --title x --body-file later.md")), /Cut check cannot read later\.md/);
  assert.match(reason(hook(w, 'echo "## Cut" > b.md && gh pr create --title x --body-file b.md')), /alone in its call/);
});
