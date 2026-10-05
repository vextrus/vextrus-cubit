// Ticket T-GUARD-A, 3.1: the wait rule judges loop structure, not text (ticket 2.1; #303: 30 of 52 recorded
// refusals were such non-waits). A `pgrep -f` or `ps … | grep` is a self-matching wait only when it is a
// loop's condition or inside its body; after the loop's `done`, in quotes, in a message or a heredoc body,
// or under an `if`, it is an ordinary look. A loop the reader cannot balance fails closed.
// Today the allowed half is refused as SELF_MATCHING_WAIT.
// The commands are test inputs only; nothing here runs them.
import { test } from "node:test";
import assert from "node:assert/strict";
import { judge, ruleOf, tempRepo } from "./_guard.mjs";

const { repo: main } = tempRepo();
const { repo: worktree } = tempRepo({ branch: "s12-fx-builder" });
const inWorktree = (command) => ruleOf({ input: { command }, project: worktree, cwd: worktree, main });

for (const command of [
  // A loop that ends before the look, by every separator.
  "for i in 1 2; do echo $i; done; pgrep -f foo",
  "for f in a b; do echo $f; done && ps aux | grep foo",
  "for i in 1 2; do echo $i; done || pgrep -f foo",
  "for i in 1 2; do echo $i; done\npgrep -f foo",
  "while read l; do echo $l; done < f; ps aux | grep -c x",
  "while read l; do echo $l; done < f && ps aux | grep x",
  "until [ -f done.txt ]; do sleep 5; done; pgrep -f x",
  "for i in 1 2; do for j in 3 4; do echo $i$j; done; done; pgrep -f x",
  "(for i in 1 2; do echo $i; done); pgrep -f x",
  "for i in 1 2; do echo $i; done | tee f; pgrep -f x",
  // A loop inside `bash -c`, followed by the look (outside it, and inside it).
  "bash -c 'for i in 1 2; do echo $i; done'; pgrep -f x",
  "bash -c 'for i in 1 2; do echo $i; done; pgrep -f x'",
  // The words for/while/until as text: in quotes, an echo, a commit message, a heredoc body.
  "echo wait for the build; pgrep -f foo",
  'echo "while it runs"; pgrep -f x',
  'echo "for x in y" && ps aux | grep foo',
  'git commit -m "wait for it" && pgrep -f foo',
  'grep -n "until" notes.txt; pgrep -f x',
  "cat <<'EOF'\nfor each file, while the build runs, until it ends\nEOF\npgrep -f x",
  "cat <<EOF > notes.txt\nwait for the build\nEOF\nps aux | grep -c x",
  // A look that is not a loop at all, or comes before it.
  "if pgrep -f x; then echo up; fi",
  "pgrep -f x; for i in 1 2; do echo $i; done",
]) {
  test(`a look after a loop, or beside the word, is not a wait: ${JSON.stringify(command)}`, () => {
    assert.equal(inWorktree(command), null);
  });
}

for (const command of [
  // The look is the loop's condition.
  "while pgrep -f x; do sleep 1; done",
  "until ps aux | grep x; do sleep 1; done",
  "until ! pgrep -f x >/dev/null; do sleep 30; done",
  "while ps aux | grep -q x; do sleep 60; done",
  'while [ -n "$(pgrep -f x)" ]; do sleep 1; done',
  "while pgrep --full x; do sleep 1; done",
  // The look is inside the loop's body.
  "for i in $(seq 100); do pgrep -f x || break; sleep 5; done",
  "while true; do ps -ef | awk '/x/' || break; sleep 5; done",
  "echo start; while sleep 5; do pgrep -f x >/dev/null || break; done; echo end",
  // Nested, and inside `bash -c`.
  "for a in 1; do while pgrep -f x; do :; done; done",
  'bash -c "while pgrep -f x; do sleep 1; done"',
  "bash -c 'until ps aux | grep -q x; do sleep 1; done'",
  "echo go && bash -c 'for i in 1 2 3; do pgrep -f x && sleep 1; done'",
  // A loop the reader cannot balance fails closed.
  "for i in 1 2; do echo $i; pgrep -f x",
  "for i in 1; do echo $i; done; done; pgrep -f x",
]) {
  test(`a self-matching wait stays refused and points to Monitor: ${JSON.stringify(command)}`, () => {
    const verdict = judge({ input: { command }, project: worktree, cwd: worktree, main });
    assert.equal(verdict?.rule, "SELF_MATCHING_WAIT");
    assert.match(verdict.reason, /Monitor/);
  });
}
