// The guard is self-contained (selftest copies guard.mjs alone), so it carries the trailer reader inline: this pins
// that copy to trailers.mjs byte for byte, and checks the stop gate imports the module rather than a copy of its own.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const BEGIN = "// --- trailer reader: begin";
const END = "// --- trailer reader: end";

/** The reader's text between the markers (the begin line itself excluded: it names its own file). */
function block(file) {
  const text = readFileSync(join(here, file), "utf8");
  const start = text.indexOf(BEGIN);
  const end = text.indexOf(END);
  assert.ok(start >= 0 && end > start, `${file} carries the trailer reader's markers`);
  assert.equal(text.indexOf(BEGIN, start + 1), -1, `${file} carries one trailer reader`);
  return text.slice(text.indexOf("\n", start) + 1, end);
}

test("the guard's trailer reader is trailers.mjs's, byte for byte", () => {
  assert.equal(block("guard.mjs"), block("trailers.mjs"));
});

test("the stop gate reads trailers only through trailers.mjs", () => {
  const gate = readFileSync(join(here, "stop-gate.mjs"), "utf8");
  assert.match(gate, /import \{ readTrailers \} from "\.\/trailers\.mjs";/);
  assert.doesNotMatch(gate, /interpret-trailers|startsWith\("factory-"\)/);
});

// The guard's reader before issue #448 (the last paragraph only), kept here as the floor: the shared reader may gate
// more heads, never fewer.
function oldCarriesReady(message) {
  const paragraphs = message.replace(/\r/g, "").trim().split(/\n[ \t]*\n/);
  const last = paragraphs[paragraphs.length - 1] ?? "";
  return last.split("\n").some((line) => {
    const m = /^\s*factory[-_ ]?state\s*:\s*(.*)$/i.exec(line);
    return m !== null && /ready/i.test(m[1]);
  });
}

test("the shared reader gates every head the guard's old reader gated", async () => {
  const { readTrailers } = await import("./trailers.mjs");
  const pieces = ["Factory-State: READY", " factory_state :ready", "FACTORY STATE: not ready", "Factory-State: BLOCKED", "Factory-Reason: r", `Factory-Verify: ${"a".repeat(40)} ok`, "Co-Authored-By: x", "prose", "", " ", "\t", "\r", "\v", "\f", " ", "\u0085", " ", " ", " ", " ", " ", "　", "﻿", "᠎", "ſ"];
  const joins = ["\n", "\n\n", "\n \n", "\n\t\n", "", " ", "\r\n\r\n"];
  let seed = 448;
  const next = (n) => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed % n;
  };
  for (let i = 0; i < 20000; i++) {
    let message = "";
    for (let k = next(10); k > 0; k--) message += pieces[next(pieces.length)] + joins[next(joins.length)];
    if (oldCarriesReady(message)) assert.ok(readTrailers(message, "a".repeat(40)).gated, JSON.stringify(message));
  }
});

// The stop gate holds what the factory cannot read: a factory block outside the read paragraph (the shape `git
// interpret-trailers` read before #448, a block ending at a `---` line deep in the body) is held, clean tree or not.
test("the stop gate holds a head whose factory block sits outside the read paragraph", async () => {
  const { spawnSync } = await import("node:child_process");
  const { mkdtempSync, writeFileSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const env = { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1", GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.invalid", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.invalid" };
  for (const name of ["CLAUDE_CODE_REMOTE", "VEXTRUS_ROLE", "CLAUDE_PROJECT_DIR"]) delete env[name];
  const dir = mkdtempSync(join(tmpdir(), "s14f1-stop-"));
  const git = (...args) => {
    const done = spawnSync("git", args, { cwd: dir, env, encoding: "utf8" });
    assert.equal(done.status, 0, done.stderr);
    return done.stdout.trim();
  };
  git("init", "-q", "-b", "s14-f1-builder");
  writeFileSync(join(dir, "work.txt"), "base\n");
  git("add", "work.txt");
  git("commit", "-q", "-m", "base");
  writeFileSync(join(dir, "work.txt"), "change\n");
  git("add", "work.txt");
  const tree = git("write-tree");
  git("commit", "-q", "-m", `feat: x\n\nFactory-State: READY\nFactory-Verify: ${tree} ok\n---\nnotes\n\nmore notes\n\nCo-Authored-By: x <x@example.invalid>`);
  const done = spawnSync(process.execPath, [join(here, "stop-gate.mjs")], {
    cwd: dir,
    input: JSON.stringify({ hook_event_name: "Stop", session_id: "s", stop_hook_active: false, last_assistant_message: "Done.", cwd: dir }),
    env: { ...env, CLAUDE_PROJECT_DIR: dir, VEXTRUS_ROLE: "builder" },
    encoding: "utf8",
    timeout: 15_000,
  });
  assert.equal(done.status, 0, done.stderr);
  const out = JSON.parse(done.stdout);
  assert.equal(out.decision, "block");
  assert.match(out.reason, /factory trailer not in the last paragraph/);
  assert.match(out.reason, /explicit paths/);
});
