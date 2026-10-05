// Ticket T-GUARD-A, 3.3: reading core.hooksPath is not setting it (ticket 2.3), and a dashed push
// (`/usr/lib/git-core/git-push`, `git-push`) is judged against the repository GIT_DIR names (ticket 2.4: today
// it is judged against the cwd's repository, so a cloud session pushes another repository's main).
// Today the reads are refused as HOOKS_PATH and the dashed pushes are let through or judged in the wrong place.
// Every repository is temporary. The commands are test inputs only; nothing here runs them.
import { test } from "node:test";
import assert from "node:assert/strict";
import { commitFile, git, leakHome, ruleOf, tempDir, tempRepo, writeStamp } from "./_guard.mjs";

const { repo: main } = tempRepo();
const { repo: worktree } = tempRepo({ branch: "s12-fx-builder" });
const { repo: cloudRepo } = tempRepo({ branch: "claude/f9-own-branch" });
const inWorktree = (command) => ruleOf({ input: { command }, project: worktree, cwd: worktree, main });
const inMain = (command) => ruleOf({ input: { command }, project: main, cwd: main, main });
const inCloud = (command) => ruleOf({ input: { command }, project: cloudRepo, cwd: cloudRepo, main, remote: true });

// ---------------------------------------------------------------- core.hooksPath: reads pass

for (const command of [
  "git config --get core.hooksPath",
  "git config --get-all core.hooksPath",
  "git config --local --get core.hooksPath",
  "git config --global --get core.hooksPath",
  "git config --show-origin --get core.hooksPath",
  "git config --file x.cfg --get core.hooksPath",
  `git -C ${worktree} config --get core.hooksPath`,
  "git config -l",
  "git config get core.hooksPath",
  "git config core.hooksPath",
  "git config --local core.hooksPath",
  "git config --get core.hooksPath || echo unset",
]) {
  test(`a read of core.hooksPath passes: ${command}`, () => {
    assert.equal(inWorktree(command), null, "worktree");
    assert.equal(inMain(command), null, "main");
    assert.equal(inCloud(command), null, "cloud");
  });
}

// ---------------------------------------------------------------- core.hooksPath: writes stay refused

for (const command of [
  "git config core.hooksPath /tmp/x",
  "git config --local core.hooksPath /tmp/x",
  "git config --global core.hooksPath /tmp/x",
  "git config --type=path core.hooksPath /tmp/x",
  `git -C ${worktree} config core.hooksPath /tmp/x`,
  "git config --unset core.hooksPath",
  "git config --unset-all core.hooksPath",
  "git config --add core.hooksPath /tmp/x",
  "git config --replace-all core.hooksPath /tmp/x",
  "git config --edit core.hooksPath",
  "git config --get core.hooksPath --unset",
  "git config set core.hooksPath /tmp/x",
  "git config unset core.hooksPath",
  "git -c core.hooksPath=/dev/null commit -m x",
  "git config --get core.hooksPath; git config core.hooksPath /x",
  "git config --get core.hooksPath && git config --unset core.hooksPath",
  // guard.test.mjs:316-320: the hooks path set by environment, a global config or a file write.
  "export GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=core.hooksPath GIT_CONFIG_VALUE_0=/dev/null; git commit -m x",
  "HOME=/tmp/fakehome git commit -m x",
  'printf "[core]\\n\\thooksPath = /dev/null\\n" >> .git/config',
  "sed -i 's/hooks/x/' .git/config",
]) {
  test(`a write of core.hooksPath stays refused: ${command}`, () => {
    assert.equal(inWorktree(command), "HOOKS_PATH", "worktree");
    assert.equal(inMain(command), "HOOKS_PATH", "main");
    assert.equal(inCloud(command), "HOOKS_PATH", "cloud");
  });
}

test("the lawful line is refused from a cloud session and a builder: git config core.hooksPath scripts/git-hooks", () => {
  assert.equal(inCloud("git config core.hooksPath scripts/git-hooks"), "HOOKS_PATH");
  assert.equal(inWorktree("git config core.hooksPath scripts/git-hooks"), "HOOKS_PATH");
});

// ---------------------------------------------------------------- dashed pushes: GIT_DIR is read

/** A temporary repository on `branch` with its own file (so its head differs) and an `origin` remote. */
function repoWithOrigin(branch, file) {
  const { repo } = tempRepo({ branch, files: { [file]: `${file}\n` } });
  git(repo, "remote", "add", "origin", "https://example.invalid/vextrus/vextrus-cubit.git");
  return repo;
}

const own = repoWithOrigin("claude/own", "docs/own.md");
const other = repoWithOrigin("main", "docs/other.md");
const cloudPush = (command, cwd = own) => ruleOf({ input: { command }, project: own, cwd, main, remote: true });

test("a cloud session's plain and dashed pushes of its own branch pass (the control)", () => {
  assert.equal(cloudPush("git push origin HEAD"), null);
  assert.equal(cloudPush("/usr/lib/git-core/git-push origin HEAD"), null);
  assert.equal(cloudPush("git-push origin HEAD"), null);
});

test("a cloud session's plain push with GIT_DIR on another repository's main is refused (the control)", () => {
  assert.equal(cloudPush(`GIT_DIR=${other}/.git git push origin HEAD`), "CLOUD_PUSH");
});

for (const command of [
  `GIT_DIR=${other}/.git /usr/lib/git-core/git-push origin HEAD`,
  `env GIT_DIR=${other}/.git git-push origin HEAD`,
  `GIT_DIR=${other}/.git GIT_WORK_TREE=${other} git-push origin HEAD`,
  `GIT_DIR=${other}/.git git-push origin HEAD`,
]) {
  test(`a cloud session's dashed push into another repository's main is refused: ${command.split(other).join("<other>")}`, () => {
    assert.equal(cloudPush(command), "CLOUD_PUSH");
  });
}

test("a cloud session's dashed push with GIT_DIR on its own repository, from another cwd, is judged there and passes", () => {
  assert.equal(cloudPush(`GIT_DIR=${own}/.git GIT_WORK_TREE=${own} git-push origin HEAD`, other), null);
});

test("a dashed push whose GIT_DIR is expanded at run time is refused", () => {
  assert.notEqual(cloudPush("GIT_DIR=$OTHER/.git git-push origin HEAD"), null);
  assert.notEqual(cloudPush("GIT_DIR=`cat /tmp/d` /usr/lib/git-core/git-push origin HEAD"), null);
});

test("an exported GIT_DIR before a dashed push stays refused", () => {
  assert.notEqual(cloudPush(`export GIT_DIR=${other}/.git; git-push origin HEAD`), null);
});

// The main checkout (the orchestrator's session) with a stamp for its branch x's head only.
const { repo: stampedMain, base } = tempRepo({ files: { "docs/main.md": "main\n" } });
git(stampedMain, "remote", "add", "origin", "https://example.invalid/vextrus/vextrus-cubit.git");
git(stampedMain, "checkout", "-q", "-b", "x");
const head = commitFile(stampedMain, "docs/b.md", "b\n", "docs: b");
const { home, corpusHash } = leakHome();
writeStamp(home, head, corpusHash, `${base}..${head}`);
const elsewhere = tempDir("guard-a-elsewhere-");
const mainPush = (command, cwd = stampedMain) => ruleOf({ input: { command }, project: stampedMain, cwd, main: stampedMain, home });

test("the main checkout's stamped head pushes, plain and dashed (the control)", () => {
  assert.equal(mainPush("git push origin x"), null);
  assert.equal(mainPush("git-push origin x"), null);
});

test("a dashed push from the main checkout with GIT_DIR on an unstamped repository is refused", () => {
  assert.equal(mainPush(`GIT_DIR=${other}/.git git-push origin HEAD`), "LEAK_STAMP");
  assert.equal(mainPush(`GIT_DIR=${other}/.git /usr/lib/git-core/git-push origin HEAD`), "LEAK_STAMP");
});

test("a dashed push with GIT_DIR on the main checkout, run from another cwd, is judged there and passes", () => {
  assert.equal(mainPush(`GIT_DIR=${stampedMain}/.git git-push origin x`, elsewhere), null);
  assert.equal(mainPush(`env GIT_DIR=${stampedMain}/.git /usr/lib/git-core/git-push origin x`, elsewhere), null);
});

test("an exported GIT_DIR before a dashed push from the main checkout stays refused", () => {
  assert.notEqual(mainPush(`export GIT_DIR=${other}/.git; git-push origin HEAD`), null);
});
