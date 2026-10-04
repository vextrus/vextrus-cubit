// Ticket f2, A7: raw sessions, the ledger and the stamp folder are reached only through their tools
// (spec 3.6, 3.7 row 2; build notes: "name `leakscan/ok` only through `python -m tools.leakscan`"). Today none
// of these rules exists. The rule names for the ledger, stamp-folder and review-folder cases are the builder's:
// these tests pin only that they are refused.
// The commands are test inputs only; nothing here runs them.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { REAL_MAIN, judge, ruleOf, tempRepo } from "./_guard.mjs";

const { repo: main } = tempRepo({ files: { "docs/a.md": "a\n", "web/package.json": "{}\n" } });
const { repo: worktree } = tempRepo({ branch: "s12-fx-builder" });
const inWorktree = (command, extra = {}) => ruleOf({ input: { command }, project: worktree, cwd: worktree, main, ...extra });
const inMain = (command, extra = {}) => ruleOf({ input: { command }, project: main, cwd: main, main, ...extra });

// ---------------------------------------------------------------- raw sessions

for (const command of [
  `claude --cloud "build ticket x"`,
  `claude -p --cloud "build ticket x"`,
  `claude --cloud -p "build ticket x"`,
  "claude --resume abc12345",
  "claude --resume 0f3c1d5e",
]) {
  test(`a raw session is refused and the reason names the launcher: ${command}`, () => {
    for (const run of [
      judge({ input: { command }, project: worktree, cwd: worktree, main }),
      judge({ input: { command }, project: main, cwd: main, main }),
    ]) {
      assert.equal(run?.rule, "RAW_SESSION");
      assert.match(run.reason, /scripts\.factory\.launch/);
    }
  });
}

test("claude --resume with a full session id passes", () => {
  assert.equal(inMain("claude --resume 0f3c1d5e-7a9b-4c4d-8e8f-1a3b5c7d9e0f"), null);
});

test('claude -p "x" passes', () => {
  assert.equal(inMain('claude -p "x"'), null);
});

test("a raw --bg session passes while the local launcher does not exist", () => {
  const { repo: bare } = tempRepo();
  for (const command of [`claude --bg "build ticket x"`, `claude --background "build ticket x"`]) {
    assert.equal(ruleOf({ input: { command }, project: bare, cwd: bare, main: bare }), null, command);
  }
});

test("a raw --bg session is refused once <main>/scripts/factory/local.py exists", () => {
  const { repo: withLauncher } = tempRepo({ files: { "scripts/factory/local.py": "# the local launcher\n" } });
  for (const command of [`claude --bg "build ticket x"`, `claude --background "build ticket x"`]) {
    assert.equal(ruleOf({ input: { command }, project: withLauncher, cwd: withLauncher, main: withLauncher }), "RAW_SESSION", command);
  }
});

// ---------------------------------------------------------------- the ledger

const RECORDS = [
  "python -m scripts.ledger record --ticket f2 --event ready",
  "python3 scripts/ledger.py record --ticket f2",
  "uv run python -m scripts.ledger record --ticket f2",
];

for (const command of RECORDS) {
  test(`a ledger record from a builder's worktree is refused: ${command}`, () => {
    assert.notEqual(inWorktree(command), null);
  });
  test(`a ledger record from the main checkout passes: ${command}`, () => {
    assert.equal(inMain(command), null);
  });
}

for (const command of ["uv run python -m scripts.ledger check", "uv run python -m scripts.ledger decide --ticket f2"]) {
  test(`ledger reads pass anywhere: ${command}`, () => {
    assert.equal(inWorktree(command), null);
    assert.equal(inMain(command), null);
  });
}

// ---------------------------------------------------------------- the stamp folder

for (const command of [
  "echo x > .private/work/leakscan/ok/abc",
  "echo x | tee /home/riz/vextrus-cubit/.private/work/leakscan/ok/abc",
  "cp /tmp/s .private/work/leakscan/ok/abc",
  "touch .private/work/leakscan/ok/abc",
  "mkdir -p .private/work/leakscan/ok",
  `python3 -c "open('.private/work/leakscan/ok/abc','w').write('{}')"`,
  "rm .private/work/leakscan/ok/abc",
  "ls .private/work/leakscan/ok/",
]) {
  test(`a command naming the stamp folder is refused unless it is the scanner: ${command}`, () => {
    assert.notEqual(inMain(command), null);
    assert.notEqual(inWorktree(command), null);
  });
}

for (const command of [
  "uv run python -m tools.leakscan range origin/main..HEAD --ref s12-x",
  "uv run python -m tools.leakscan verify-stamp 0123456789abcdef0123456789abcdef01234567",
  "python -m tools.leakscan file .private/work/pr-body.md",
]) {
  test(`the scanner itself passes: ${command}`, () => {
    assert.equal(inMain(command), null);
  });
}

for (const command of [
  "VEXTRUS_LEAKSCAN_HOME=/tmp/fake git push origin HEAD:refs/heads/x",
  "VEXTRUS_LEAKSCAN_HOME=/tmp/fake uv run python -m tools.leakscan file f.md",
  "export VEXTRUS_LEAKSCAN_HOME=/tmp/fake",
]) {
  test(`a command setting VEXTRUS_LEAKSCAN_HOME inline is refused: ${command}`, () => {
    assert.notEqual(inMain(command), null);
  });
}

// ---------------------------------------------------------------- forged records by the file tools

for (const tool of ["Edit", "Write", "NotebookEdit"]) {
  for (const [label, path, options] of [
    ["the main checkout's stamp folder (absolute)", `${main}/.private/work/leakscan/ok/abc`, { project: worktree }],
    ["the project's stamp folder (absolute)", `${main}/.private/work/leakscan/ok/abc`, { project: main }],
    ["the stamp folder (relative)", ".private/work/leakscan/ok/abc", { project: main }],
    ["the ledger folder (absolute)", `${main}/.private/work/factory/ledger/2026-10-05.jsonl`, { project: main }],
    ["the ledger folder (relative)", ".private/work/factory/ledger/2026-10-05.jsonl", { project: main }],
    ["the real main checkout's stamp folder", `${REAL_MAIN}/.private/work/leakscan/ok/abc`, { project: worktree, main: null }],
  ]) {
    test(`${tool} on ${label} is refused as a forged record`, () => {
      const input = tool === "NotebookEdit" ? { notebook_path: path, file_path: path, new_source: "{}" } : { file_path: path, content: "{}", old_string: "a", new_string: "b" };
      assert.equal(ruleOf({ tool, input, cwd: options.project, main, ...options }), "RECORD_FORGED");
    });
  }
  test(`${tool} on other .private/work/ files passes`, () => {
    const path = `${main}/.private/work/session-12/f2/NOTES.txt`;
    const input = tool === "NotebookEdit" ? { notebook_path: path, file_path: path, new_source: "x" } : { file_path: path, content: "x", old_string: "a", new_string: "b" };
    assert.equal(ruleOf({ tool, input, project: main, cwd: main, main }), null);
  });
}

// ---------------------------------------------------------------- tests in a review folder

const review = join(main, ".private", "work", "factory", "review", "pr-5");
mkdirSync(review, { recursive: true });
writeFileSync(join(review, "package.json"), "{}\n");

for (const command of ["npm test", "npm run test", "npx vitest", "vitest run"]) {
  test(`a test run inside a review folder is refused: ${command}`, () => {
    assert.notEqual(ruleOf({ input: { command }, project: main, cwd: review, main }), null);
  });
  test(`the same test run in web/ passes: ${command}`, () => {
    assert.equal(ruleOf({ input: { command }, project: main, cwd: join(main, "web"), main }), null);
  });
}

test("a test run aimed at a review folder with --prefix is refused", () => {
  assert.notEqual(inMain(`npm --prefix ${review} test`), null);
  assert.notEqual(inMain("npm --prefix .private/work/factory/review/pr-5 run test"), null);
  assert.equal(inMain("npm --prefix web test"), null);
});
