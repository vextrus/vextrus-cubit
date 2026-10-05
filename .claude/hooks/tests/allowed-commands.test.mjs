// The guard's over-block net: every block of fixtures/allowed-commands.txt (appendable) and of the frozen
// acceptance corpus (acceptance/guard-a-allowed-commands.txt) runs through the guard in its session, and one
// test fails listing every refusal with its rule. A refusal of a plain command a session ran is a bug: append
// it to the fixture, then fix the guard. A known self-matching wait must still be refused (the control).
// The commands are test inputs only; nothing here runs them.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { judge, tempRepo } from "./acceptance/_guard.mjs";

const FILES = ["./fixtures/allowed-commands.txt", "./acceptance/guard-a-allowed-commands.txt"].map((f) => fileURLToPath(new URL(f, import.meta.url)));

/** A corpus file's blocks, `{session, command}`; `#` lines before the first `%%` are its header. */
function blocks(text) {
  const out = [];
  let lines = [];
  let header = true;
  const flush = () => {
    while (lines.length > 0 && lines[0].trim() === "") lines.shift();
    while (lines.length > 0 && lines[lines.length - 1].trim() === "") lines.pop();
    const marker = /^@(\S+)$/.exec(lines[0] ?? "");
    if (marker) lines.shift();
    if (lines.length > 0) out.push({ session: marker ? marker[1] : "worktree", command: lines.join("\n") });
    lines = [];
  };
  for (const line of text.replace(/\r/g, "").split("\n")) {
    if (line === "%%") {
      if (header) lines = lines.filter((l) => !l.startsWith("#"));
      header = false;
      flush();
    } else lines.push(line);
  }
  flush();
  return out;
}

const { repo: main } = tempRepo();
const { repo: worktree } = tempRepo({ branch: "s12-fx-builder" });
const { repo: cloud } = tempRepo({ branch: "claude/f9-own-branch" });
const SESSIONS = {
  main: { project: main, cwd: main, main },
  worktree: { project: worktree, cwd: worktree, main },
  cloud: { project: cloud, cwd: cloud, main, remote: true },
};
const verdictOf = ({ session, command }) => judge({ input: { command }, ...SESSIONS[session] });

const fixture = blocks(readFileSync(FILES[0], "utf8"));
const frozen = blocks(readFileSync(FILES[1], "utf8"));

test("the fixture holds at least 40 blocks, each in a known session", () => {
  assert.ok(fixture.length >= 40, `the fixture holds ${fixture.length} blocks`);
  for (const block of [...fixture, ...frozen]) assert.ok(block.session in SESSIONS, `unknown session @${block.session}`);
});

test("the control, a self-matching wait, is refused through the same function", () => {
  assert.equal(verdictOf({ session: "worktree", command: "while pgrep -f x; do sleep 1; done" })?.rule, "SELF_MATCHING_WAIT");
});

test("no block of either corpus is refused", () => {
  const refused = [];
  for (const block of [...fixture, ...frozen]) {
    const verdict = verdictOf(block);
    if (verdict !== null) refused.push(`@${block.session} ${JSON.stringify(block.command.slice(0, 80))} -> ${verdict.rule}`);
  }
  assert.deepEqual(refused, []);
});
