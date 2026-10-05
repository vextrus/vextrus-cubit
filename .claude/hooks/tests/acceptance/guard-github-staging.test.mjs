// Ticket f2, A8: GitHub bodies and staged folders (spec 5 items 3-4, 3.3's agent-memory line).
// leakscan-cli.md 4: "for a `gh` body write, the stamp named by the sha256 of the `--body-file`'s bytes is
// valid; inline `--body` text longer than a short title is refused outright." A cloud session writes nothing to
// GitHub but its branch. A folder that could hold drawings, or agent memory, is never staged whole.
// Today there are no body or cloud-gh rules and `git add <dir>` passes.
// The commands are test inputs only; nothing here runs them.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { leakHome, ruleOf, sha256, tempDir, tempRepo, writeStamp } from "./_guard.mjs";

const { repo: main } = tempRepo();
const { home, corpusHash } = leakHome();
const inMain = (command) => ruleOf({ input: { command }, project: main, cwd: main, main, home });

const LONG = "This pull request repairs the guard and adds the leak wall; see the ticket for every rule it pins."; // 98 chars
const SHORT = "factory: the guard refuses raw cloud sessions"; // 45 chars
assert.ok(LONG.length > 72 && SHORT.length <= 72);

for (const command of [
  `gh pr create --title "${SHORT}" --body "${LONG}"`,
  `gh pr create --title "${SHORT}" -b "${LONG}"`,
  `gh pr create --title "${SHORT}" --body="${LONG}"`,
  `gh issue create --title "${SHORT}" --body "${LONG}"`,
  `gh pr edit 5 --body "${LONG}"`,
  `gh issue edit 5 --body "${LONG}"`,
  `gh pr comment 5 --body "${LONG}"`,
  `gh issue comment 5 -b "${LONG}"`,
  `gh pr merge 5 --merge --body "${LONG}"`,
]) {
  test(`an inline body longer than 72 characters is refused: ${command.slice(0, 40)}`, () => {
    assert.equal(inMain(command), "GH_BODY");
  });
}

test("an inline body of 72 characters or fewer passes", () => {
  assert.equal(inMain(`gh pr comment 5 --body "${SHORT}"`), null);
  assert.equal(inMain(`gh issue comment 5 --body "${"x".repeat(72)}"`), null);
});

function bodyFile(text) {
  const file = join(tempDir("f2-body-"), "body.md");
  writeFileSync(file, text);
  return { file, hash: sha256(readFileSync(file)) };
}

test("--body-file passes with a valid stamp for the file's bytes", () => {
  const { file, hash } = bodyFile("## What is not verified\n\nNothing; an invented body.\n");
  writeStamp(home, hash, corpusHash, `sha256:${hash}`);
  assert.equal(inMain(`gh pr create --title "${SHORT}" --body-file ${file}`), null);
  assert.equal(inMain(`gh pr comment 5 --body-file ${file}`), null);
});

test("--body-file without a stamp for the file's bytes is refused", () => {
  const { file } = bodyFile("An unscanned body.\n");
  assert.notEqual(inMain(`gh pr create --title "${SHORT}" --body-file ${file}`), null);
});

test("--body-file whose stamp carries a stale corpus hash is refused", () => {
  const { file, hash } = bodyFile("A body scanned against an older corpus.\n");
  writeStamp(home, hash, "f".repeat(64), `sha256:${hash}`);
  assert.notEqual(inMain(`gh issue comment 5 --body-file ${file}`), null);
});

test("--body-file changed after its scan is refused", () => {
  const { file, hash } = bodyFile("The scanned text.\n");
  writeStamp(home, hash, corpusHash, `sha256:${hash}`);
  writeFileSync(file, "The scanned text, then an edit.\n");
  assert.notEqual(inMain(`gh pr edit 5 --body-file ${file}`), null);
});

test("--body-file - (standard input) is refused", () => {
  assert.notEqual(inMain(`gh pr create --title "${SHORT}" --body-file -`), null);
});

for (const command of ["gh pr view 5", "gh pr list", "gh issue list", "gh run view 123", "gh pr merge 5 --merge"]) {
  test(`GitHub reads and a plain merge pass: ${command}`, () => {
    assert.equal(inMain(command), null);
  });
}

// ---------------------------------------------------------------- cloud sessions write nothing to GitHub

const { repo: cloud } = tempRepo({ branch: "claude/f9-own-branch" });
const inCloud = (command) => ruleOf({ input: { command }, project: cloud, cwd: cloud, main, remote: true });

for (const command of [
  `gh pr comment 5 --body "${SHORT}"`,
  `gh pr create --title "${SHORT}" --body "x"`,
  `gh issue create --title "${SHORT}" --body "x"`,
  `gh pr edit 5 --title "${SHORT}"`,
  `gh issue comment 5 --body "x"`,
  `gh issue edit 5 --title "${SHORT}"`,
  "gh pr review 5 --approve",
  "gh api repos/vextrus/vextrus-cubit/issues/5/comments -f body=x",
]) {
  test(`a cloud session may not write to GitHub: ${command}`, () => {
    assert.equal(inCloud(command), "CLOUD_GH");
  });
}

test("a cloud session may read a PR", () => {
  assert.equal(inCloud("gh pr view 5"), null);
});

// ---------------------------------------------------------------- staging folders

const { repo: worktree } = tempRepo({
  branch: "s12-fx-builder",
  files: {
    "docs/specs/factory.md": "spec\n",
    "vextrus/seed/demo.py": "# demo\n",
    "vextrus/seed/recorded/KR-STR-R0.dwg": "AC1032 invented\n",
    ".claude/agent-memory/x.md": "memory\n",
    ".claude/agent-memory-foo/y.md": "memory\n",
    "assets/plans/a.dwg": "AC1032 invented\n",
    "assets/models/b.ifc": "ISO-10303-21;\n",
  },
});
mkdirSync(join(worktree, "assets", "plans"), { recursive: true });
const stage = (command) => ruleOf({ input: { command }, project: worktree, cwd: worktree, main });

for (const command of [
  "git add .claude/agent-memory/x.md",
  "git add .claude/agent-memory-foo/",
  "git add vextrus/seed/",
  "git add vextrus/seed/recorded/",
  "git add vextrus/seed/recorded",
  "git add assets/plans",
  "git add assets/plans/",
  "git add assets/models/",
  "git add docs/a.md assets/plans",
]) {
  test(`staging a folder that may hold drawings or agent memory is refused: ${command}`, () => {
    assert.equal(stage(command), "STAGE_DIR");
  });
}

for (const command of [
  "git add vextrus/seed/demo.py",
  "git add docs/specs/factory.md",
  "git add vextrus/seed/recorded/KR-STR-R0.dwg",
]) {
  test(`staging files by name passes: ${command}`, () => {
    assert.equal(stage(command), null);
  });
}
