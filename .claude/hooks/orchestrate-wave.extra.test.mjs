// Extra (ticket f6, review round 1, F2 and F3): the runbook keeps the rules the rewrite first lost. Resuming a
// local builder is only by its full sessionId, and a `done` session is messaged, never resumed. The gate lines stay
// exact, because the guard accepts only exact lines: design-gate through post-status, and real-drawings only
// through scripts/real-drawings' accept modes, never typed through post-status.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const text = readFileSync(fileURLToPath(new URL("../skills/orchestrate-wave/SKILL.md", import.meta.url)), "utf8");
const flat = text.replace(/\s+/g, " ");

test("the resume rule: full sessionId, stopped or failed with no pid, --settings again, a done session never resumed", () => {
  for (const phrase of ["full `sessionId`", "`stopped` or `failed`", "no `pid`", "--settings", "never resume", "Never restart a builder over its work"]) {
    assert.ok(flat.includes(phrase), `missing: ${phrase}`);
  }
  assert.match(flat, /a `done` session is alive and waiting: SendMessage it, never resume it/);
});

test("the gate lines are exact: design-gate through post-status, real-drawings through its accept modes", () => {
  assert.match(flat, /post-status design-gate <PR> <full sha> --passed <items> --failed <items> --not-applicable <items>/);
  assert.match(flat, /gh pr view <PR> --json statusCheckRollup/);
  assert.match(flat, /scripts\/real-drawings <PR> --accept-if-clean/);
  assert.match(flat, /scripts\/real-drawings <PR> --accept "<judged reason, at most 100 characters>"/);
  assert.doesNotMatch(flat, /post-status real-drawings/, "real-drawings is never typed through post-status");
  assert.doesNotMatch(flat, /post-status <gate>/, "no generic gate line the guard would refuse");
});

test("a local builder's READY head is pushed from the main checkout after the leak scan, and toolchain.sh asks the owner", () => {
  assert.match(flat, /local builder never pushes/);
  assert.match(flat, /leak scan/);
  assert.match(flat, /scripts\/owner\/toolchain\.sh/);
});

test("the resume goes through scripts.factory.say, and the command lines live in commands.md", () => {
  assert.match(flat, /scripts\.factory\.say/);
  assert.match(flat, /`commands\.md`/);
  assert.doesNotMatch(flat, /\/home\/riz\//, "no machine path in the runbook");
});
