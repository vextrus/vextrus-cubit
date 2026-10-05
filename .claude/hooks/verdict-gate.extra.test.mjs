// Extra (ticket f6, review round 1, F1): a subagent that reports through SubagentHandback leaves only its closing
// text in `last_assistant_message`; the report it handed back is in its transcript. The gate judges the handed-back
// report (the last SubagentHandback call in `agent_transcript_path`), and the closing text only when there is none.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const HOOK = fileURLToPath(new URL("./verdict-gate.mjs", import.meta.url));
const SHA = "0123456789abcdef0123456789abcdef01234567";
const REPORT = "## Findings\n1. A finding, scored 60.\n";

const user = (text) => ({ type: "user", message: { role: "user", content: [{ type: "text", text }] } });
const said = (text) => ({ type: "assistant", message: { role: "assistant", content: [{ type: "text", text }] } });
const handback = (message) => ({
  type: "assistant",
  message: { role: "assistant", content: [{ type: "tool_use", id: "toolu_1", name: "SubagentHandback", input: { message } }] },
});

function transcript(entries, prefix = "") {
  const file = join(mkdtempSync(join(tmpdir(), "f6-verdict-extra-")), "agent.jsonl");
  writeFileSync(file, prefix + entries.map((entry) => JSON.stringify(entry)).join("\n") + "\n");
  return file;
}

function gate(agent_type, agent_transcript_path, last_assistant_message) {
  const event = { hook_event_name: "SubagentStop", session_id: "s", agent_id: "a1", stop_hook_active: false, agent_type, agent_transcript_path };
  if (last_assistant_message !== undefined) event.last_assistant_message = last_assistant_message;
  const done = spawnSync(process.execPath, [HOOK], { input: JSON.stringify(event), encoding: "utf8", timeout: 15_000 });
  assert.equal(done.status, 0, done.stderr);
  return done.stdout.trim() === "" ? "allowed" : JSON.parse(done.stdout).decision;
}

for (const closing of ["", "Handed back.", undefined]) {
  test(`a correct handed-back report is allowed whatever the closing text (${JSON.stringify(closing)})`, () => {
    const path = transcript([user("review PR 1"), said("Working."), handback(`${REPORT}\nVERDICT: FIX at ${SHA}`), said(closing ?? "")]);
    assert.equal(gate("pr-reviewer", path, closing), "allowed");
    const refuter = transcript([user("refute"), handback("I ran the proof.\nREFUTED")]);
    assert.equal(gate("refuter", refuter, closing), "allowed");
    const writer = transcript([handback("Committed.\nred-on-main: 3 failed\ngreen-on-throwaway: 9 passed")]);
    assert.equal(gate("acceptance-writer", writer, closing), "allowed");
  });
}

test("a handed-back report without its line is blocked, even when the closing text carries one", () => {
  const path = transcript([handback(REPORT)]);
  assert.equal(gate("pr-reviewer", path, `VERDICT: PASS at ${SHA}`), "block");
  assert.equal(gate("refuter", transcript([handback("maybe")]), "CONFIRMED"), "block");
  assert.equal(gate("acceptance-writer", transcript([handback("red-on-main: 3 failed")]), ""), "block");
});

test("the last handback counts: a corrected second handback is allowed, a broken one after a good one is blocked", () => {
  assert.equal(gate("pr-reviewer", transcript([handback(REPORT), user("blocked"), handback(`${REPORT}\nVERDICT: PASS at ${SHA}`)]), ""), "allowed");
  assert.equal(gate("pr-reviewer", transcript([handback(`${REPORT}\nVERDICT: PASS at ${SHA}`), handback(REPORT)]), ""), "block");
});

test("no handback in the transcript: the closing text is the report", () => {
  const path = transcript([user("review"), said("Working.")]);
  assert.equal(gate("pr-reviewer", path, `${REPORT}\nVERDICT: BLOCK at ${SHA}`), "allowed");
  assert.equal(gate("pr-reviewer", path, REPORT), "block");
});

test("a missing or unreadable transcript falls back to the closing text", () => {
  assert.equal(gate("refuter", "/nonexistent/agent.jsonl", "UNPROVEN"), "allowed");
  assert.equal(gate("refuter", "/nonexistent/agent.jsonl", "unsure"), "block");
  const garbage = join(mkdtempSync(join(tmpdir(), "f6-verdict-extra-")), "agent.jsonl");
  writeFileSync(garbage, "not json\n{\n");
  assert.equal(gate("refuter", garbage, "CONFIRMED"), "allowed");
});

test("only the last 2 MB is read: a handback after a 3 MB prefix is found, the line cut in half is skipped", () => {
  const filler = `${JSON.stringify(said("x".repeat(3 * 1024 * 1024)))}\n`;
  const path = transcript([handback(`${REPORT}\nVERDICT: PASS at ${SHA}`)], filler);
  assert.equal(gate("pr-reviewer", path, ""), "allowed");
  const early = transcript([said("x".repeat(3 * 1024 * 1024))], `${JSON.stringify(handback(REPORT))}\n`);
  assert.equal(gate("pr-reviewer", early, `${REPORT}\nVERDICT: PASS at ${SHA}`), "allowed", "a handback older than the tail is not read");
});
