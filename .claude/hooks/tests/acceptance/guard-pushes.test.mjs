// Ticket f2, A3: who may push what (spec 3.6; build notes "Pushes"). The main checkout never rewrites or
// deletes history, however git is spelled; a local builder never pushes; a cloud session pushes only HEAD (or
// its current branch) to its own branch, never main. Today none of these is refused.
// The commands are test inputs only; nothing here runs them.
import { test } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { leakHome, ruleOf, tempDir, tempRepo } from "./_guard.mjs";

// The main checkout (VEXTRUS_MAIN_CHECKOUT), with an invented corpus and no stamps.
const { repo: main } = tempRepo();
const { home } = leakHome();
const inMain = (command) => ruleOf({ input: { command }, project: main, cwd: main, main, home });

const REWRITES = [
  "git push origin +main",
  "git push origin +HEAD:refs/heads/main",
  "git push origin :main",
  "git push origin --delete main",
  "git push origin -d main",
  "git push --mirror origin",
  "git -c core.x=y push --force origin main",
  "git --git-dir=.git push -f origin main",
  "/usr/bin/git push --force origin main",
  "git -C . push origin +x",
];

for (const command of REWRITES) {
  test(`the main checkout may not rewrite or delete history: ${command}`, () => {
    assert.equal(inMain(command), "HISTORY_REWRITTEN");
  });
}

test("an unreadable cwd for a push in the main checkout is refused (fails closed)", () => {
  const gone = join(tempDir(), "no-such-folder");
  assert.notEqual(ruleOf({ input: { command: "git push origin HEAD:refs/heads/x" }, project: main, cwd: gone, main, home }), null);
});

// A local builder: the project is a worktree, not the main checkout, and not a cloud session.
const { repo: worktree } = tempRepo({ branch: "s12-fx-builder" });
const asBuilder = (command) => ruleOf({ input: { command }, project: worktree, cwd: worktree, main, home });

const BUILDER_PUSHES = [
  "git push",
  "git push origin HEAD",
  "git push -u origin s12-fx-builder",
  "git push origin HEAD:refs/heads/s12-fx-builder",
  "git -C . push origin HEAD",
  "/usr/bin/git push origin HEAD",
  "env X=1 git push origin HEAD",
  "command git push origin HEAD",
  "git --no-pager push origin HEAD",
];

for (const command of BUILDER_PUSHES) {
  test(`a local builder never pushes: ${command}`, () => {
    assert.equal(asBuilder(command), "LOCAL_PUSH");
  });
}

// A cloud session on its own branch.
const { repo: cloud } = tempRepo({ branch: "claude/f9-own-branch" });
const inCloud = (command, repo = cloud) => ruleOf({ input: { command }, project: repo, cwd: repo, main, remote: true });

for (const command of [
  "git push origin HEAD",
  "git push -u origin HEAD",
  "git push origin HEAD:claude/f9-own-branch",
  "git push origin claude/f9-own-branch",
]) {
  test(`a cloud session pushes its own branch: ${command}`, () => {
    assert.equal(inCloud(command), null);
  });
}

for (const command of [
  "git push origin main",
  "git push origin HEAD:main",
  "git push origin HEAD:refs/heads/main",
  "git push origin HEAD:claude/someone-elses-branch",
  "git push origin other-branch",
  "git push --all origin",
  "git push --tags origin",
]) {
  test(`a cloud session pushes nothing but its own branch: ${command}`, () => {
    assert.equal(inCloud(command), "CLOUD_PUSH");
  });
}

test("a cloud session on main may not push without a refspec", () => {
  const { repo: onMain } = tempRepo({ branch: "main" });
  assert.equal(inCloud("git push", onMain), "CLOUD_PUSH");
  assert.equal(inCloud("git push origin", onMain), "CLOUD_PUSH");
});
