// Ticket T-GUARD-A, 3.4: the frozen corpus of allowed commands (guard-a-allowed-commands.txt). Every block is
// a plain command a session runs all day; the guard must let each one through (a refusal is an over-block,
// the class #303 recorded 52 of). The corpus is synthetic and real-shaped: no drawing text, no client name,
// no real sha, no key.
// Format: blocks separated by a line holding only `%%`; an optional first line `@main` (the orchestrator in
// the main checkout), `@worktree` (a builder's worktree; the default) or `@cloud` (a cloud session on its own
// branch) picks the session. Every repository is temporary.
// A control (a known self-matching wait) runs through the same function and must be refused, so a broken
// harness cannot pass. Today the loop, ledger, leakscan and hooksPath blocks are refused.
// The commands are test inputs only; nothing here runs them.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { judge, tempRepo } from "./_guard.mjs";

const CORPUS = fileURLToPath(new URL("./guard-a-allowed-commands.txt", import.meta.url));

/** The corpus's blocks: `{session, command}`, in file order. */
function blocks(text) {
  const out = [];
  let lines = [];
  const flush = () => {
    while (lines.length > 0 && lines[0].trim() === "") lines.shift();
    while (lines.length > 0 && lines[lines.length - 1].trim() === "") lines.pop();
    let session = "worktree";
    const marker = /^@(\S+)$/.exec(lines[0] ?? "");
    if (marker) {
      session = marker[1];
      lines.shift();
    }
    out.push({ session, command: lines.join("\n") });
    lines = [];
  };
  for (const line of text.replace(/\r/g, "").split("\n")) {
    if (line === "%%") flush();
    else lines.push(line);
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

/** The guard's verdict on one block in its session: `{rule, reason}` or null. */
function verdictOf({ session, command }) {
  const where = SESSIONS[session];
  assert.ok(where, `unknown session marker @${session}`);
  return judge({ input: { command }, ...where });
}

const corpus = blocks(readFileSync(CORPUS, "utf8"));

// The shapes the corpus must hold, each read from a block's text.
const SHAPES = {
  "loop-then-pgrep/ps-grep": [25, /(?:^|[\s;&|(])(?:for|while|until)\s[\s\S]*\bdone\b[\s\S]*(?:\bpgrep\b[^\n;&|]*\s(?:-[A-Za-z]*f[A-Za-z]*|--full)\b|\bps\b[^\n;&]*\|\s*(?:[ef]?grep|rg|ugrep|awk)\b)/],
  "ledger/leakscan read-only listing": [10, /^(?:ls|cat|head|tail|grep|find|wc|stat|jq|sha256sum|du)\s[^\n]*\.private\/work\/(?:leakscan|factory\/ledger)/m],
  "scanner with value-less uv flags": [6, /\buv run (?:(?:--quiet|-q|--no-sync|--frozen|--locked|--offline|--no-progress) )+python3? -m tools\.leakscan\b/],
  "heredoc or -c body naming the scanner or ledger": [6, /(?:<<-?\s*'?[A-Za-z_]+'?|\s-[ce]\s)[\s\S]*(?:leakscan|scripts[./]ledger)/],
  "STATE line": [4, /\bSTATE\b[^\n]*>>\s*\S*STATE\.md/],
  "git config --get form": [4, /\bgit\b[^\n]*\bconfig\b[^\n]*(?:--get(?:-all|-regexp)?\b|\sget\s)[^\n]*core\.hooksPath/],
};

test("the corpus holds at least 60 blocks, none empty, each with a known session", () => {
  assert.ok(corpus.length >= 60, `the corpus holds ${corpus.length} blocks`);
  for (const [i, block] of corpus.entries()) {
    assert.notEqual(block.command.trim(), "", `block ${i + 1} is empty`);
    assert.ok(block.session in SESSIONS, `block ${i + 1} names the unknown session @${block.session}`);
  }
});

for (const [shape, [floor, pattern]] of Object.entries(SHAPES)) {
  test(`the corpus holds at least ${floor} blocks of the shape: ${shape}`, () => {
    const count = corpus.filter((block) => pattern.test(block.command)).length;
    assert.ok(count >= floor, `${count} blocks of the shape "${shape}", fewer than ${floor}`);
  });
}

test("the control, a self-matching wait, is refused through the same function", () => {
  assert.equal(verdictOf({ session: "worktree", command: "while pgrep -f x; do sleep 1; done" })?.rule, "SELF_MATCHING_WAIT");
});

for (const [i, block] of corpus.entries()) {
  test(`[${i + 1}] @${block.session} ${JSON.stringify(block.command.slice(0, 60))}`, () => {
    const verdict = verdictOf(block);
    assert.equal(verdict, null, `refused by ${verdict?.rule}: ${verdict?.reason}`);
  });
}
