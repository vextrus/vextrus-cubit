// Acceptance (ticket f6, tier 2): the SubagentStop verdict gate, `.claude/hooks/verdict-gate.mjs`.
// docs/specs/factory.md §3.5: `pr-reviewer` must end with its `VERDICT: PASS|FIX|BLOCK at <40-hex sha>` line,
// `refuter` with its verdict (CONFIRMED, REFUTED or UNPROVEN), `acceptance-writer` with both counts
// (`red-on-main: <n>` and `green-on-throwaway: <n>`, trailers.md 3). A block is `{"decision":"block","reason"}`
// on stdout with exit 0; the report is `last_assistant_message`, or `tool_input.message` when that is absent.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
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

// Ticket T-HOOKS (#290): /review-pr runs `pr-reviewer` and `refuter` with a schema, so they answer by calling the
// StructuredOutput tool (`REVIEW` {verdict, head, findings, report} and `REFUTE` {verdict, evidence} in
// .claude/workflows/review-pr.js); their closing text has no verdict line. The gate reads the agent's transcript
// (`agent_transcript_path`): the LAST call among SubagentHandback and StructuredOutput decides. A valid
// StructuredOutput verdict passes; anything else falls back to the closing-text rule. A handed-back report missing its
// line is told to hand the whole report back again through SubagentHandback.
const said = (text) => ({ type: "assistant", message: { role: "assistant", content: [{ type: "text", text }] } });
const asked = (text) => ({ type: "user", message: { role: "user", content: [{ type: "text", text }] } });
const toolCall = (name, input) => ({
  type: "assistant",
  message: { role: "assistant", content: [{ type: "tool_use", id: `toolu_${name}`, name, input }] },
});
const structured = (input) => toolCall("StructuredOutput", input);
const handback = (message) => toolCall("SubagentHandback", { message });

function transcript(entries) {
  const file = join(mkdtempSync(join(tmpdir(), "t-hooks-verdict-")), "agent.jsonl");
  writeFileSync(file, entries.map((entry) => JSON.stringify(entry)).join("\n") + "\n");
  return file;
}

const closing = (agent_type, entries, last_assistant_message = "Done.") =>
  as(agent_type, last_assistant_message, { agent_transcript_path: transcript(entries) });

for (const verdict of ["PASS", "FIX", "BLOCK"]) {
  test(`pr-reviewer whose last call is StructuredOutput {verdict: "${verdict}", head: <40 hex>} is allowed without a VERDICT line`, () => {
    assertAllowed(closing("pr-reviewer", [asked("review PR 1"), said("Working."), structured({ verdict, head: SHA, findings: [], report: REPORT })]));
  });
}

for (const verdict of ["CONFIRMED", "REFUTED", "UNPROVEN"]) {
  test(`refuter whose last call is StructuredOutput {verdict: "${verdict}"} is allowed with closing text "Done."`, () => {
    assertAllowed(closing("refuter", [asked("refute"), structured({ verdict, evidence: "I ran the narrowest proof." })]));
  });
}

for (const [name, input] of [
  ["an unknown verdict", { verdict: "MAYBE", head: SHA, findings: [], report: REPORT }],
  ["a 39-hex head", { verdict: "PASS", head: SHA.slice(0, 39), findings: [], report: REPORT }],
  ["a 41-hex head", { verdict: "PASS", head: `${SHA}a`, findings: [], report: REPORT }],
  ["a head that is not a sha", { verdict: "PASS", head: "main", findings: [], report: REPORT }],
  ["no head", { verdict: "PASS", findings: [], report: REPORT }],
  ["no verdict", { head: SHA, findings: [], report: REPORT }],
]) {
  test(`pr-reviewer StructuredOutput with ${name} falls back to the closing text`, () => {
    assert.match(blockReason(closing("pr-reviewer", [structured(input)])), /VERDICT/);
    assertAllowed(closing("pr-reviewer", [structured(input)], `${REPORT}\nVERDICT: FIX at ${SHA}`));
  });
}

test('refuter StructuredOutput {verdict: "PASS"} (not a refuter verdict) falls back to the closing text', () => {
  blockReason(closing("refuter", [structured({ verdict: "PASS", evidence: "x" })]));
  assertAllowed(closing("refuter", [structured({ verdict: "PASS", evidence: "x" })], "I ran the proof.\nREFUTED"));
});

test("acceptance-writer: a StructuredOutput verdict changes nothing, its two-count rule stands", () => {
  assert.match(blockReason(closing("acceptance-writer", [structured({ verdict: "PASS", head: SHA })])), /red-on-main/);
  assertAllowed(closing("acceptance-writer", [structured({ verdict: "PASS" })], "Committed.\nred-on-main: 3 failed\ngreen-on-throwaway: 9 passed"));
});

test("the last call wins: a valid StructuredOutput then a handback without a verdict is blocked", () => {
  blockReason(closing("pr-reviewer", [structured({ verdict: "PASS", head: SHA, findings: [], report: REPORT }), handback(REPORT)]));
  blockReason(closing("refuter", [structured({ verdict: "REFUTED", evidence: "x" }), handback("maybe")]));
});

test("the last call wins: a handback without a verdict then a valid StructuredOutput is allowed", () => {
  assertAllowed(closing("pr-reviewer", [handback(REPORT), asked("blocked"), structured({ verdict: "FIX", head: SHA, findings: [], report: REPORT })]));
  assertAllowed(closing("refuter", [handback("maybe"), structured({ verdict: "UNPROVEN", evidence: "x" })]));
});

test("stop_hook_active still allows, whatever the transcript holds", () => {
  const path = transcript([structured({ verdict: "MAYBE", head: SHA }), handback(REPORT)]);
  assertAllowed(as("pr-reviewer", "Done.", { agent_transcript_path: path, stop_hook_active: true }));
});

test("pr-reviewer: a handed-back report without its line is told to hand the whole report back through SubagentHandback", () => {
  const reason = blockReason(closing("pr-reviewer", [handback(REPORT)], `${REPORT}\nVERDICT: PASS at ${SHA}`));
  assert.ok(reason.includes("SubagentHandback"), reason);
  assert.match(reason, /whole report/i);
  assert.ok(reason.includes("VERDICT: PASS|FIX|BLOCK at <40-hex sha>"), reason);
});

test("refuter: a handed-back report without its verdict is told to hand the whole report back through SubagentHandback", () => {
  const reason = blockReason(closing("refuter", [handback("I looked.\nmaybe")], "CONFIRMED"));
  assert.ok(reason.includes("SubagentHandback"), reason);
  assert.match(reason, /whole report/i);
  assert.ok(reason.includes("CONFIRMED, REFUTED or UNPROVEN"), reason);
});

test('a report that did not come through a handback keeps today\'s reason ("Add it as the final line")', () => {
  const reviewer = blockReason(closing("pr-reviewer", [asked("review"), said("Working.")], REPORT));
  assert.ok(reviewer.includes("VERDICT: PASS|FIX|BLOCK at <40-hex sha>"), reviewer);
  assert.ok(reviewer.includes("Add it as the final line"), reviewer);
  const refuter = blockReason(as("refuter", "I looked.\nmaybe"));
  assert.ok(refuter.includes("CONFIRMED, REFUTED or UNPROVEN"), refuter);
  assert.ok(refuter.includes("Add it as the final line"), refuter);
});

test("a transcript missing, unreadable or without either call: the closing-text rule as today", () => {
  const unreadable = join(mkdtempSync(join(tmpdir(), "t-hooks-verdict-")), "agent.jsonl");
  writeFileSync(unreadable, "not json\n{\n");
  const neither = transcript([asked("review"), said("Working."), toolCall("Bash", { command: "true" })]);
  for (const path of ["/nonexistent/agent.jsonl", unreadable, neither, mkdtempSync(join(tmpdir(), "t-hooks-verdict-dir-"))]) {
    assertAllowed(as("pr-reviewer", `${REPORT}\nVERDICT: BLOCK at ${SHA}`, { agent_transcript_path: path }));
    blockReason(as("pr-reviewer", REPORT, { agent_transcript_path: path }));
    assertAllowed(as("refuter", "UNPROVEN", { agent_transcript_path: path }));
    blockReason(as("refuter", "unsure", { agent_transcript_path: path }));
  }
});
