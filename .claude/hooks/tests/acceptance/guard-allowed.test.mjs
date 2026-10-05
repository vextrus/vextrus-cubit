// Ticket f2, A10: ordinary work passes (build notes: "Over-blocking is a failure (the guard is never why a
// session cannot work)"). Green on today's guard; it holds the new rules to not over-block.
// The commands are test inputs only; nothing here runs them.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { GUARD, REAL_MAIN, ruleOf, tempRepo } from "./_guard.mjs";

const { repo: main } = tempRepo();
const { repo: worktree } = tempRepo({ branch: "s12-fx-builder" });
const inWorktree = (command) => ruleOf({ input: { command }, project: worktree, cwd: worktree, main });
// The orchestrator's session: the real main checkout's path, with the guard's own default for it.
const inRealMain = (command) => ruleOf({ input: { command }, project: REAL_MAIN, cwd: REAL_MAIN, main: null });

for (const command of [
  "uv run pytest -rf > .private/work/x.txt 2>&1",
  "uv run mypy",
  "git status",
  "git diff --stat",
  "git log --oneline -5",
  "git add docs/a.md",
  `git commit -m "docs: x"`,
  `git commit -m "feat: x" -m "Factory-State: BLOCKED" -m "Factory-Reason: the spec names no exit code"`,
  `git commit -m "feat: x" -m "Factory-State: READY"`,
  "gh pr view 5 --json state",
  "npm --prefix web run typecheck",
  "node --test .claude/hooks/",
  "cat docs/intent.md",
  "sed -n 1,20p vextrus/settings/jev.py",
  "psql -h 127.0.0.1 -U vextrus -c 'select 1'",
]) {
  test(`ordinary work passes in a builder's worktree: ${command}`, () => {
    assert.equal(inWorktree(command), null);
  });
}

for (const command of [
  "git pull --ff-only",
  "sudo -n -u vxkeys /usr/local/lib/vextrus/post-status real-drawings 20260929T101500Z-0123456789ab-beef",
  `sudo -n -u vxkeys /usr/local/lib/vextrus/post-status design-gate 12 ${"0123456789abcdef".repeat(2)}01234567 --passed 1-3`,
  "sudo -n -u vxkeys /usr/local/bin/vx-score run-1",
]) {
  test(`the orchestrator's lines pass in the main checkout: ${command}`, () => {
    assert.equal(inRealMain(command), null);
  });
}

for (const [label, stdin] of [
  ["malformed", "{not json"],
  ["empty", ""],
]) {
  test(`${label} stdin is let through quietly`, () => {
    const env = { ...process.env };
    delete env.CLAUDE_CODE_REMOTE;
    const run = spawnSync(process.execPath, [GUARD], { input: stdin, encoding: "utf8", env });
    assert.equal(run.status, 0);
    assert.equal(run.stdout, "");
  });
}
