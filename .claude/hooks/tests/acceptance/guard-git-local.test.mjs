// Ticket f2, A5: the hooks path and local discards (spec 3.6). Only the main checkout may point
// `core.hooksPath` at the repo's own `scripts/git-hooks`; no session may discard work (the lawful path is to
// ask the owner). Ordinary checkouts, restores, resets and stashes still pass. Today none of these is refused.
// The commands are test inputs only; nothing here runs them.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { judge, ruleOf, tempRepo } from "./_guard.mjs";

const { repo: main } = tempRepo();
const { repo: worktree } = tempRepo({ branch: "s12-fx-builder", files: { "docs/a.md": "a\n", "web/x.ts": "x\n" } });
mkdirSync(join(worktree, "docs", "sub"), { recursive: true });
writeFileSync(join(worktree, "docs", "sub", "b.md"), "b\n");
const inWorktree = (command) => ruleOf({ input: { command }, project: worktree, cwd: worktree, main });
const inMain = (command) => ruleOf({ input: { command }, project: main, cwd: main, main });
const inCloud = (command) => ruleOf({ input: { command }, project: worktree, cwd: worktree, main, remote: true });

for (const command of [
  "git -c core.hooksPath=x commit -m y",
  "git config core.hooksPath /tmp/x",
  "git config --global core.hooksPath x",
  "git config --system core.hooksPath x",
  "git config --add core.hooksPath x",
  "git config core.hooksPath scripts/git-hooks",
]) {
  test(`a builder may not set the hooks path: ${command}`, () => {
    assert.equal(inWorktree(command), "HOOKS_PATH");
  });
}

test("the main checkout may not point the hooks path anywhere else", () => {
  assert.equal(inMain("git config core.hooksPath /tmp/x"), "HOOKS_PATH");
  assert.equal(inMain("git -c core.hooksPath=/dev/null commit -m x"), "HOOKS_PATH");
});

test("the main checkout may set the hooks path to scripts/git-hooks", () => {
  assert.equal(inMain("git config core.hooksPath scripts/git-hooks"), null);
});

test("a cloud session may not set the hooks path, even to scripts/git-hooks", () => {
  assert.equal(inCloud("git config core.hooksPath scripts/git-hooks"), "HOOKS_PATH");
});

test("--no-verify is still refused", () => {
  assert.equal(inWorktree("git commit --no-verify -m x"), "HOOKS_SKIPPED");
});

for (const command of [
  "git reset --hard",
  "git reset --hard origin/main",
  "git checkout -- .",
  "git checkout -- docs/",
  "git restore .",
  "git restore docs/",
  "git branch -D x",
  "git worktree remove --force p",
  "git stash drop",
  "git stash clear",
]) {
  test(`a discard is refused and the reason names asking the owner: ${command}`, () => {
    const verdict = judge({ input: { command }, project: worktree, cwd: worktree, main });
    assert.equal(verdict?.rule, "DISCARD");
    assert.match(verdict.reason, /owner/i);
  });
}

for (const command of [
  "git checkout -b x",
  "git checkout main",
  "git checkout -- docs/a.md",
  "git restore --staged docs/a.md",
  "git reset --soft HEAD~1",
  "git reset HEAD docs/a.md",
  "git branch -d x",
  "git stash",
  "git stash pop",
  "git worktree add p b",
  "git worktree remove p",
]) {
  test(`ordinary git work passes: ${command}`, () => {
    assert.equal(inWorktree(command), null);
  });
}
