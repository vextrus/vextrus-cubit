// Ticket f2, A6: recursive deletes in every spelling, and waits that match themselves (spec 3.6; CLAUDE.md's
// lessons: "the guard now refuses a recursive `rm`"; "no `pgrep -f` loops (they match themselves)"). Today
// most of these spellings pass and there is no wait rule.
// The commands are test inputs only; nothing here runs them.
import { test } from "node:test";
import assert from "node:assert/strict";
import { judge, ruleOf, tempRepo } from "./_guard.mjs";

const { repo: main } = tempRepo();
const { repo: worktree } = tempRepo({ branch: "s12-fx-builder" });
const inWorktree = (command) => ruleOf({ input: { command }, project: worktree, cwd: worktree, main });

for (const command of [
  "/bin/rm -rf x",
  "\\rm -rf x",
  "rm -fr x",
  "command rm -r x",
  "find p -delete",
  "find p -type f -exec rm {} +",
  `python3 -c "import shutil; shutil.rmtree('p')"`,
  "python3 - <<'EOF'\nimport shutil\nshutil.rmtree('p')\nEOF",
  `node -e "require('fs').rmSync('p', {recursive: true})"`,
  "node --input-type=module <<'EOF'\nimport { rmSync } from 'node:fs';\nrmSync('p', { recursive: true, force: true });\nEOF",
  `node -e "require('fs').rm('p', {recursive:true}, () => {})"`,
  `bash -c "rm -r x"`,
  "echo a; rm -r x",
  "true && rm -r x",
  "echo $(rm -rf x)",
]) {
  test(`a recursive delete is refused: ${JSON.stringify(command)}`, () => {
    assert.equal(inWorktree(command), "RECURSIVE_DELETE");
  });
}

for (const command of [
  "while pgrep -f x; do sleep 60; done",
  "until ! pgrep -f x >/dev/null; do sleep 30; done",
  "while ps aux | grep -q x; do sleep 60; done",
]) {
  test(`a self-matching wait is refused and the reason points to Monitor: ${command}`, () => {
    const verdict = judge({ input: { command }, project: worktree, cwd: worktree, main });
    assert.equal(verdict?.rule, "SELF_MATCHING_WAIT");
    assert.match(verdict.reason, /Monitor/);
  });
}

for (const command of [
  "rm -f a.txt",
  "rm a b",
  "rmdir d",
  "pgrep -f x",
  "until [ -f done.txt ]; do sleep 5; done",
  "while ! git ls-remote --exit-code origin b; do sleep 30; done",
  "grep -rn rmtree vextrus",
  `git commit -m "refuse shutil.rmtree"`,
  "uv run pytest -k rmtree",
]) {
  test(`ordinary work passes: ${command}`, () => {
    assert.equal(inWorktree(command), null);
  });
}
