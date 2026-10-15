// The builder's own tests of the advisory shift-left hook (S30-F2d), beyond ts30f2d's acceptance: the message builders
// commit with, `-m "$(cat <<'EOF' ... EOF)"`, is judged exactly when its delimiter is quoted (#890 is caught there) and
// noted when it is not; a `git add` earlier in the call is replayed on a copy of the index, so its leak hit is denied.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "./shift-left.mjs";

const REPO = fileURLToPath(new URL("../../", import.meta.url));
const HOOK = join(REPO, ".claude/hooks/shift-left.mjs");
const VENV = join(REPO, ".venv/bin/python");
const PYTHON = process.env.VEXTRUS_PYTHON || (existsSync(VENV) ? VENV : "python3");
const CORPUS_LINE = "Okapi Lantern Works 5519"; // invented
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
  for (const name of ["CLAUDE_CODE_REMOTE", "PYTHONPATH", "VEXTRUS_LEAKSCAN_HOME", "VEXTRUS_LEAKSCAN_ALLOWLIST", "GIT_DIR", "GIT_INDEX_FILE", "GIT_WORK_TREE"]) delete env[name];
  return { ...env, ...extra };
}

function git(cwd, ...args) {
  const done = spawnSync("git", args, { cwd, env: environment(), encoding: "utf8" });
  assert.equal(done.status, 0, done.stderr);
}

function world({ corpus = false } = {}) {
  const root = mkdtempSync(join(tmpdir(), "shift-left-extra-"));
  const repo = join(root, "repo");
  mkdirSync(repo);
  git(repo, "init", "-q", "-b", "s99-x1");
  writeFileSync(join(repo, "a.md"), "a clean line\n");
  git(repo, "add", "--", "a.md");
  git(repo, "commit", "-q", "-m", "base");
  const seams = { VEXTRUS_LEAKSCAN_HOME: join(root, "leakhome"), VEXTRUS_LEAKSCAN_ALLOWLIST: join(root, "allow.txt") };
  writeFileSync(seams.VEXTRUS_LEAKSCAN_ALLOWLIST, "");
  if (corpus) {
    mkdirSync(join(root, "sources"));
    writeFileSync(join(root, "sources/notes.txt"), `${CORPUS_LINE}\n`);
    const built = spawnSync(PYTHON, ["-m", "tools.leakscan", "build", "--source", join(root, "sources")], { cwd: REPO, env: environment({ ...seams, PYTHONPATH: REPO }), encoding: "utf8" });
    assert.equal(built.status, 0, built.stderr);
  }
  return { root, repo, seams };
}

function hook(w, command) {
  const event = { hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command }, cwd: w.repo };
  return spawnSync(process.execPath, [HOOK], { cwd: w.repo, input: JSON.stringify(event), env: environment({ ...w.seams, VEXTRUS_PYTHON: PYTHON }), encoding: "utf8", timeout: 60_000 });
}

const reasonOf = (done) => (done.stdout.trim() === "" ? null : JSON.parse(done.stdout).hookSpecificOutput.permissionDecisionReason);
const READY = (cut, open = "'EOF'") => `git commit -m "$(cat <<${open}
ready: S99-X1, the widget

The widget.

## Cut
${cut}

Factory-State: READY
Factory-Verify: ${"0".repeat(40)} ok
Co-Authored-By: Fixture <fixture@example.invalid>
EOF
)"`;

test("parse: a quoted heredoc inside $(cat ...) is the literal message, $ and backquotes kept", () => {
  const { commands } = parse("git commit -m \"$(cat <<'EOF'\nfix: $HOME and `x`\nEOF\n)\"");
  const message = commands[0].words[3];
  assert.equal(message.dyn, false);
  assert.equal(message.v, "fix: $HOME and `x`");
});

test("parse: <<-'EOF' strips the body's leading tabs, as the shell does", () => {
  const { commands } = parse("git commit -m \"$(cat <<-'EOF'\n\tfix: a\n\tEOF\n)\"");
  assert.equal(commands[0].words[3].v, "fix: a");
});

test("parse: an unquoted heredoc delimiter makes the message a run-time one", () => {
  const { commands } = parse('git commit -m "$(cat <<EOF\nfix: a\nEOF\n)"');
  assert.equal(commands[0].words[3].dyn, true);
  assert.equal(commands[0].words[3].unquotedHeredoc, true);
});

test("a READY commit by a quoted heredoc whose ## Cut holds notes is denied, naming the Cut check (#890)", () => {
  const reason = reasonOf(hook(world(), READY("None.\n\nLater tickets:\n- the tier 2 export")));
  assert.match(reason ?? "", /\bCut\b/);
});

test("a READY commit by a quoted heredoc whose ## Cut says None. is allowed (no decision on stdout)", () => {
  assert.equal(hook(world(), READY("None.")).stdout.trim(), "");
});

test("an unquoted heredoc delimiter is not judged: allowed with one stderr note naming the delimiter", () => {
  const done = hook(world(), READY("- the tier 2 export", "EOF"));
  assert.equal(done.status, 0);
  assert.equal(done.stdout.trim(), "");
  const lines = done.stderr.trim().split("\n");
  assert.equal(lines.length, 1, done.stderr);
  assert.match(lines[0], /unquoted/);
});

test("git add then git commit: the add is replayed on a copy of the index, so its leak hit is denied; the real index is untouched", () => {
  const w = world({ corpus: true });
  writeFileSync(join(w.repo, "leak.md"), `x\n${CORPUS_LINE}\n`);
  const before = readFileSync(join(w.repo, ".git/index"));
  const done = hook(w, 'git add leak.md && git commit -m "docs: a note"');
  assert.match(reasonOf(done) ?? "", /leak scan.*leak\.md:2/);
  assert.ok(!done.stdout.toUpperCase().includes("OKAPI"));
  assert.equal(Buffer.compare(before, readFileSync(join(w.repo, ".git/index"))), 0);
});

test("cd into the repository then commit is judged in that folder", () => {
  const w = world({ corpus: true });
  mkdirSync(join(w.repo, "sub"));
  writeFileSync(join(w.repo, "sub/leak.md"), `${CORPUS_LINE}\n`);
  git(w.repo, "add", "--", "sub/leak.md");
  const done = spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({ tool_name: "Bash", tool_input: { command: `cd ${w.repo}/sub && git commit -m "docs: a"` }, cwd: w.root }),
    env: environment({ ...w.seams, VEXTRUS_PYTHON: PYTHON }),
    encoding: "utf8",
  });
  assert.match(reasonOf(done) ?? "", /sub\/leak\.md:1/);
});

test("gh pr create with a literal --body whose Cut item links no issue is denied", () => {
  assert.match(reasonOf(hook(world(), 'gh pr create --title t --body "## Cut\n- the export"')) ?? "", /\bCut\b/);
});

// review_self (lens-a, 50): the message file is read before the call runs, so a file an earlier command writes is
// judged on its stale text; such a commit is noted, never denied (and never passed on a stale clean file).
test("a commit -F <file> after a command that may write the file is not judged: one note, no deny", () => {
  const w = world();
  const stale = `ready: S99-X1\n\n## Cut\n- the export\n\nFactory-State: READY\nFactory-Verify: ${"0".repeat(40)} ok\n`;
  writeFileSync(join(w.repo, "msg.txt"), stale);
  const done = hook(w, "cat > msg.txt <<'EOF'\nready: S99-X1\n\n## Cut\nNone.\n\nFactory-State: READY\nEOF\ngit commit -F msg.txt");
  assert.equal(done.stdout.trim(), "", done.stdout);
  assert.equal(done.stderr.trim().split("\n").length, 1, done.stderr);
  assert.match(done.stderr, /message file/);
});

// review_self (lens-b, under 50): a commit run by a wrapper was a silent pass.
test("a commit run by a wrapper (env, bash -c) is noted, never a silent pass", () => {
  for (const command of ['env git commit -m "docs: a"', "bash -c 'git commit -m x'", 'command gh pr create --body-file b.md']) {
    const done = hook(world(), command);
    assert.equal(done.stdout.trim(), "", command);
    assert.equal(done.stderr.trim().split("\n").length, 1, `${command}: ${done.stderr}`);
    assert.match(done.stderr, /not judged/, command);
  }
});

test("a commit with pathspecs is judged on its message only: the Cut check runs, the staged tree is noted", () => {
  const done = hook(world(), `${READY("- the export")} -- a.md`);
  assert.match(reasonOf(done) ?? "", /\bCut\b/);
});
