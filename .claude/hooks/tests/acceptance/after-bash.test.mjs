// Acceptance (ticket f6, tier 2, ratchet 1c): a characterisation of `.claude/hooks/after-bash.mjs`, the PostToolUse
// hook that runs `sync` after a `git commit` (a power cut once emptied the newest commit's loose objects). It is
// green on main; its red proof is a mutation (the `spawnSync` line deleted). It pins today's behaviour, the regex
// `\bgit\s+(?:-C\s+\S+\s+)?commit\b` included, so a later change to the hook is a deliberate one.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { delimiter, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const REPO = fileURLToPath(new URL("../../../../", import.meta.url));
const HOOK = join(REPO, ".claude/hooks/after-bash.mjs");

/** Runs the hook with a fake `sync` first on PATH; returns the run and how many times `sync` was called. */
function afterBash(stdin, { syncExit = 0 } = {}) {
  const bin = mkdtempSync(join(tmpdir(), "f6-after-bash-"));
  const log = join(bin, "sync.log");
  writeFileSync(join(bin, "sync"), `#!/bin/sh\necho called >> ${JSON.stringify(log)}\nexit ${syncExit}\n`);
  chmodSync(join(bin, "sync"), 0o755);
  const done = spawnSync(process.execPath, [HOOK], {
    cwd: tmpdir(),
    input: stdin,
    env: { ...process.env, PATH: `${bin}${delimiter}${process.env.PATH}` },
    encoding: "utf8",
    timeout: 40_000,
  });
  const calls = existsSync(log) ? readFileSync(log, "utf8").split("\n").filter(Boolean).length : 0;
  return { ...done, calls };
}

const bash = (command) => JSON.stringify({ hook_event_name: "PostToolUse", tool_name: "Bash", tool_input: { command }, tool_response: {} });

for (const [command, calls] of [
  ["git commit -m x", 1],
  ["git -C /some/dir commit -m x", 1],
  ["git commit --amend --no-edit", 1],
  ["git add a.txt && git commit -m 'two steps'", 1],
  ["echo git commit", 1],
  ["git status", 0],
  ["git log --oneline -5", 0],
  ["git commits", 0],
  ["", 0],
]) {
  test(`${JSON.stringify(command)}: sync called ${calls} time(s), exit 0`, () => {
    const done = afterBash(bash(command));
    assert.equal(done.status, 0, done.stderr);
    assert.equal(done.calls, calls);
  });
}

for (const [name, stdin] of [
  ["non-JSON stdin", "this is not json"],
  ["empty stdin", ""],
  ["a missing tool_input", JSON.stringify({ hook_event_name: "PostToolUse", tool_name: "Bash" })],
  ["a non-string command", JSON.stringify({ tool_input: { command: 42 } })],
]) {
  test(`${name}: no sync, exit 0, no crash`, () => {
    const done = afterBash(stdin);
    assert.equal(done.status, 0, done.stderr);
    assert.equal(done.calls, 0);
    assert.doesNotMatch(done.stderr, /\n\s+at /);
  });
}

test("a failing sync still exits 0", () => {
  const done = afterBash(bash("git commit -m x"), { syncExit: 1 });
  assert.equal(done.status, 0, done.stderr);
  assert.equal(done.calls, 1);
});
