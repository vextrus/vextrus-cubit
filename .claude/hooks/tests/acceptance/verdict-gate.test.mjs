// Acceptance (ticket f6, tier 2): the SubagentStop verdict gate, `.claude/hooks/verdict-gate.mjs`.
// docs/specs/factory.md §3.5: `pr-reviewer` must end with its `VERDICT: PASS|FIX|BLOCK at <40-hex sha>` line,
// `refuter` with its verdict (CONFIRMED, REFUTED or UNPROVEN), `acceptance-writer` with both counts
// (`red-on-main: <n>` and `green-on-throwaway: <n>`, trailers.md 3). A block is `{"decision":"block","reason"}`
// on stdout with exit 0; the report is `last_assistant_message`, or `tool_input.message` when that is absent.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = fileURLToPath(new URL("../../../../", import.meta.url));
const HOOK = join(REPO, ".claude/hooks/verdict-gate.mjs");
const SHA = "0123456789abcdef0123456789abcdef01234567";

function gate(event, raw) {
  const env = { ...process.env };
  delete env.CLAUDE_CODE_REMOTE;
  return spawnSync(process.execPath, [HOOK], {
    cwd: tmpdir(),
    input: raw ?? JSON.stringify({ hook_event_name: "SubagentStop", session_id: "s", agent_id: "a1", stop_hook_active: false, ...event }),
    env,
    encoding: "utf8",
    timeout: 15_000,
  });
}

const as = (agent_type, last_assistant_message, extra = {}) => gate({ agent_type, last_assistant_message, ...extra });

function blockReason(done) {
  assert.equal(done.status, 0, done.stderr);
  let out;
  assert.doesNotThrow(() => (out = JSON.parse(done.stdout)), `stdout is one JSON object: ${done.stdout}`);
  assert.equal(out.decision, "block");
  assert.equal(typeof out.reason, "string");
  return out.reason;
}

function assertAllowed(done) {
  assert.equal(done.status, 0, done.stderr);
  assert.equal(done.stdout.trim(), "", `expected no output, got ${done.stdout}`);
}

const REPORT = "## Findings\n1. A finding, scored 60.\n\nThe suites ran into files.\n";

for (const verdict of ["PASS", "FIX", "BLOCK"]) {
  test(`pr-reviewer ending "VERDICT: ${verdict} at <40 hex>" is allowed`, () => {
    assertAllowed(as("pr-reviewer", `${REPORT}\nVERDICT: ${verdict} at ${SHA}`));
    assertAllowed(as("pr-reviewer", `${REPORT}\nVERDICT: ${verdict} at ${SHA}\n\n  \n`));
  });
}

for (const [name, message] of [
  ["no sha", `${REPORT}\nVERDICT: PASS`],
  ["a 39-hex sha", `${REPORT}\nVERDICT: PASS at ${SHA.slice(0, 39)}`],
  ["a 41-hex sha", `${REPORT}\nVERDICT: PASS at ${SHA}a`],
  ["an unknown verdict", `${REPORT}\nVERDICT: MAYBE at ${SHA}`],
  ["the verdict mid-message", `VERDICT: PASS at ${SHA}\n${REPORT}`],
  ["no verdict at all", REPORT],
]) {
  test(`pr-reviewer with ${name} is blocked, quoting the required line`, () => {
    assert.match(blockReason(as("pr-reviewer", message)), /VERDICT/);
  });
}

for (const verdict of ["CONFIRMED", "REFUTED", "UNPROVEN"]) {
  test(`refuter ending ${verdict} is allowed`, () => {
    assertAllowed(as("refuter", `I ran the narrowest proof.\n\n${verdict}`));
    assertAllowed(as("refuter", `I ran the narrowest proof.\n${verdict}\n\n`));
  });
}

for (const [name, message] of [
  ["a sentence for a last line", "I ran the proof.\nProbably CONFIRMED but I am unsure"],
  ["the verdict mid-message", "CONFIRMED\nThen I looked again and wrote more."],
  ["no verdict", "I ran out of time."],
]) {
  test(`refuter with ${name} is blocked`, () => {
    blockReason(as("refuter", message));
  });
}

test("acceptance-writer with both counts is allowed", () => {
  assertAllowed(as("acceptance-writer", "Committed abc123.\nred-on-main: 12 failed\ngreen-on-throwaway: 40 passed\nNot pinned: none."));
});

test("acceptance-writer missing the green count is blocked, naming it", () => {
  assert.match(blockReason(as("acceptance-writer", "Committed.\nred-on-main: 12 failed\n")), /green-on-throwaway/);
});

test("acceptance-writer missing the red count is blocked, naming it", () => {
  assert.match(blockReason(as("acceptance-writer", "Committed.\ngreen-on-throwaway: 40 passed\n")), /red-on-main/);
});

test("acceptance-writer with neither count, or counts without digits, is blocked", () => {
  blockReason(as("acceptance-writer", "Committed the tests."));
  blockReason(as("acceptance-writer", "red-on-main: some failed\ngreen-on-throwaway: all passed"));
});

for (const type of ["Explore", "builder", "general-purpose", ""]) {
  test(`agent_type "${type}" is not gated`, () => {
    assertAllowed(as(type, "No verdict here."));
  });
}

test("no agent_type is not gated", () => {
  assertAllowed(gate({ last_assistant_message: "No verdict here." }));
});

test("stop_hook_active: allowed (blocked once only)", () => {
  assertAllowed(as("pr-reviewer", REPORT, { stop_hook_active: true }));
  assertAllowed(as("acceptance-writer", "nothing", { stop_hook_active: true }));
});

test("the report in tool_input.message (no last_assistant_message) is judged the same", () => {
  assertAllowed(gate({ agent_type: "pr-reviewer", tool_input: { message: `${REPORT}\nVERDICT: FIX at ${SHA}` } }));
  blockReason(gate({ agent_type: "pr-reviewer", tool_input: { message: REPORT } }));
  assertAllowed(gate({ agent_type: "refuter", tool_input: { message: "REFUTED" } }));
  blockReason(gate({ agent_type: "refuter", tool_input: { message: "maybe" } }));
});

test("neither last_assistant_message nor tool_input.message: allowed", () => {
  assertAllowed(gate({ agent_type: "pr-reviewer" }));
  assertAllowed(gate({ agent_type: "acceptance-writer", tool_input: {} }));
});

test("an empty message from a gated type is blocked", () => {
  blockReason(as("pr-reviewer", ""));
  blockReason(as("refuter", ""));
  blockReason(as("acceptance-writer", ""));
});

test("garbage stdin: allowed, exit 0", () => {
  for (const raw of ["not json", "", "[]", "null"]) assertAllowed(gate({}, raw));
});
