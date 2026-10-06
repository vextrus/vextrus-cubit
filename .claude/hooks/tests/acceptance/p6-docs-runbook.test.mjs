// Acceptance (ticket T-DOCS-RUNBOOK, B1-B4, as re-scoped at 08:55Z: no title stamp): the runbook names commands
// that exist and the guard allows. orchestrate-wave's commands move to `commands.md` beside SKILL.md (SKILL.md is
// capped at 80 lines); the PR recipe scans the range, pushes, scans the body file and opens the PR with
// `--body-file` as its own call; the resume goes through `scripts.factory.say`; every concrete command
// `commands.md` and `docs/agents/issue-tracker.md` prescribe passes the guard (judged in a temporary main checkout
// with a temporary leak home, never the real ones); builder.md writes its budget with `stamp budget`; CLAUDE.md
// carries #309's two lessons. The commands are test inputs only; nothing here runs them.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { leakHome, ruleOf, sha256, tempRepo, writeStamp } from "./_guard.mjs";

const REPO = fileURLToPath(new URL("../../../../", import.meta.url));
const SKILL_DIR = join(REPO, ".claude/skills/orchestrate-wave");
const COMMANDS = join(SKILL_DIR, "commands.md");
const ISSUES = join(REPO, "docs/agents/issue-tracker.md");
const read = (path) => (existsSync(path) ? readFileSync(path, "utf8") : "");
const flat = (text) => text.replace(/\s+/g, " ");
const lineCount = (text) => text.replace(/\n$/, "").split("\n").length;
const FENCE = /^\s*(```|~~~)/;

/**
 * Each command a doc writes out: every line inside a fenced block (trimmed), and every inline code span outside
 * them, a span wrapped across lines joined with a space (paragraphs are the lines between blank lines and fences).
 */
function commandsOf(text) {
  const found = [];
  let fenced = false;
  let paragraph = [];
  const spans = () => {
    const joined = paragraph.join(" ");
    for (const m of joined.matchAll(/(?<!`)`([^`]+)`(?!`)/g)) found.push({ text: m[1].trim(), fenced: false });
    paragraph = [];
  };
  for (const line of text.split("\n")) {
    if (FENCE.test(line)) {
      spans();
      fenced = !fenced;
    } else if (fenced) {
      if (line.trim()) found.push({ text: line.trim().replace(/^\$\s+/, ""), fenced: true });
    } else if (!line.trim()) spans();
    else paragraph.push(line);
  }
  spans();
  return found;
}

// ------------------------------------------------------------------------------------------------- B1

test("SKILL.md stays at most 80 lines and points at commands.md by name", () => {
  const text = read(join(SKILL_DIR, "SKILL.md"));
  assert.ok(lineCount(text) <= 80, `${lineCount(text)} lines`);
  assert.match(text, /commands\.md/);
});

test("commands.md sits beside SKILL.md", () => {
  assert.ok(existsSync(COMMANDS), "no .claude/skills/orchestrate-wave/commands.md");
});

const RUNNABLE = [
  ["scripts.factory.governor check", /python3? -m scripts\.factory\.governor check\b/],
  ["scripts.factory.stamp start", /python3? -m scripts\.factory\.stamp start\b/],
  ["scripts.factory.stamp end", /python3? -m scripts\.factory\.stamp end\b/],
  ["scripts.factory.stamp phase", /python3? -m scripts\.factory\.stamp phase\b/],
  ["scripts.factory.stamp elapsed", /python3? -m scripts\.factory\.stamp elapsed\b/],
  ["scripts.factory.watch ensure", /python3? -m scripts\.factory\.watch ensure\b/],
  ["scripts.factory.rdlock run", /python3? -m scripts\.factory\.rdlock run\b/],
  ["scripts.walk.run <sha40>", /python3? -m scripts\.walk\.run <sha40>/],
  ["/real-set-walk", /^\/real-set-walk\b/],
  ["scripts.factory.review run <PR>", /python3? -m scripts\.factory\.review run <PR>/],
  ["scripts.land <PR>", /python3? -m scripts\.land <PR>/],
  ["scripts.merge_ready <PR>", /python3? -m scripts\.merge_ready <PR>/],
  ["scripts.factory.amend --subject", /python3? -m scripts\.factory\.amend\b.*--subject\b/],
  ["scripts.factory.say", /python3? -m scripts\.factory\.say\b/],
  ["scripts.factory.launch cloud", /python3? -m scripts\.factory\.launch cloud\b/],
  ["scripts.factory.launch local", /python3? -m scripts\.factory\.launch local\b/],
];

for (const [name, pattern] of RUNNABLE) {
  test(`commands.md names ${name} as a runnable line`, () => {
    const lines = commandsOf(read(COMMANDS)).map((c) => c.text);
    assert.ok(lines.some((line) => pattern.test(line)), `no code span or fenced line runs ${name}`);
  });
}

test("neither commands.md nor SKILL.md says scripts.land order (scripts.land orders itself)", () => {
  assert.ok(existsSync(COMMANDS), "no commands.md");
  for (const path of [COMMANDS, join(SKILL_DIR, "SKILL.md")]) {
    assert.doesNotMatch(flat(read(path)), /scripts\.land order\b/, path);
  }
});

// ------------------------------------------------------------------------------------------------- B2

test("the PR recipe: range scan, push, body-file scan, then gh pr create --body-file as its own call", () => {
  const text = flat(read(COMMANDS));
  const range = text.indexOf("tools.leakscan range");
  assert.ok(range >= 0, "no `tools.leakscan range`");
  const push = text.indexOf("git push", range);
  assert.ok(push > range, "no `git push` after the range scan");
  const file = text.indexOf("tools.leakscan file", push);
  assert.ok(file > push, "no `tools.leakscan file` after the push");
  const open = text.slice(file).search(/gh pr create [^`\n]*--body-file\b/);
  assert.ok(open >= 0, "no `gh pr create … --body-file` after the body-file scan");
  assert.ok(text.indexOf("its own call", range) > range, 'the recipe does not say "its own call"');
});

test("the resume recipe names scripts.factory.say and never prescribes claude --bg --resume", () => {
  const text = read(COMMANDS);
  assert.match(text, /scripts\.factory\.say\b/);
  let fenced = false;
  for (const line of text.split("\n")) {
    if (FENCE.test(line)) {
      fenced = !fenced;
      continue;
    }
    if (!/claude\s+--bg\s+--resume/.test(line)) continue;
    // A warning ("never type `claude --bg --resume`") is allowed; a line to run is not.
    assert.ok(!fenced && /\b(?:never|not|don't)\b/i.test(line), `a claude --bg --resume line: ${line}`);
  }
});

// ------------------------------------------------------------------------------------------------- B3

const SHA = `${"0123456789abcdef".repeat(2)}01234567`;
const BODY = ".private/work/acc/body.md";
const JUDGED = /^(?:gh |uv run python -m tools\.leakscan\b|uv run python -m scripts\.)/;

/**
 * The command with its placeholders made concrete, or null when one is left (that line is not judged). A body
 * placeholder after `--body`/`-b` stands for the text an agent writes, so it is longer than a title (73+
 * characters); any other quoted placeholder is a short text; numbers become 5, branches main, shas a 40-hex sha,
 * files a path under .private/work/, and a placeholder inside a path the folder `acc`.
 */
function concrete(command) {
  let c = command;
  c = c.replace(/(--body|-b)(\s+|=)(["'])(?:\.\.\.|<[^<>]*>)\3/g, (_m, flag, sep) => `${flag}${sep}"${"x".repeat(80)}"`);
  c = c.replace(/(["'])(?:\.\.\.|<[^<>]*>)\1/g, '"t"');
  c = c.replace(/<(?:PR|pr|n|N|number|issue|round|minutes|budget|h|count)>/g, "5");
  c = c.replace(/<(?:branch|ref|base)>/g, "main");
  c = c.replace(/<(?:sha|sha40|head|full sha|merge-base|tree|commit)>/g, SHA);
  c = c.replace(/<(?:f|file|path|that|body|body-file|STATE\.md|out)>/g, BODY);
  c = c.replace(/<[^<>\s/]+>(?=\/)|(?<=\/)<[^<>\s/]+>/g, "acc");
  return /<[A-Za-z][^<>]*>|\.\.\./.test(c) ? null : c;
}

/** Judges each concrete command of `doc`; returns the judged commands and the refusals. */
function judgeDoc(doc) {
  const { repo: main } = tempRepo();
  const { home, corpusHash } = leakHome();
  const judged = [];
  const refused = [];
  for (const { text } of commandsOf(read(doc))) {
    if (!JUDGED.test(text)) continue;
    const command = concrete(text);
    if (command === null) continue;
    // A body file is a real file in the main checkout, stamped as `tools.leakscan file` would stamp it.
    for (const m of command.matchAll(/(?:--body-file(?:\s+|=)|-F\s+body=@|--input\s+)["']?([^\s"']+)/g)) {
      const path = join(main, m[1]);
      if (!existsSync(path)) {
        mkdirSync(dirname(path), { recursive: true });
        writeFileSync(path, "A body for the acceptance test.\n");
      }
      const name = sha256(readFileSync(path));
      writeStamp(home, name, corpusHash, `sha256:${name}`);
    }
    judged.push(command);
    const rule = ruleOf({ input: { command }, project: main, cwd: main, main, home });
    if (rule !== null) refused.push(`${rule}: ${text}`);
  }
  return { judged, refused };
}

test("every concrete command commands.md prescribes passes the guard in the main checkout", () => {
  assert.ok(existsSync(COMMANDS), "no commands.md");
  const { judged, refused } = judgeDoc(COMMANDS);
  assert.deepEqual(refused, []);
  assert.ok(
    judged.some((c) => /^gh pr create\b/.test(c) && /--body-file\b/.test(c)),
    `the gh pr create --body-file line was not judged (a placeholder left?): ${JSON.stringify(judged)}`,
  );
  assert.ok(judged.length >= 5, `only ${judged.length} commands judged: ${JSON.stringify(judged)}`);
});

test("every concrete command issue-tracker.md prescribes passes the guard in the main checkout", () => {
  const { judged, refused } = judgeDoc(ISSUES);
  assert.deepEqual(refused, []);
  for (const action of ["create", "comment"]) {
    assert.ok(
      judged.some((c) => new RegExp(`^gh issue ${action}\\b`).test(c) && /--body-file\b/.test(c)),
      `no judged gh issue ${action} … --body-file line: ${JSON.stringify(judged)}`,
    );
  }
});

// ------------------------------------------------------------------------------------------------- B4

test("builder.md's step 2 runs stamp budget --ticket and no longer has the file written by hand", () => {
  const text = read(join(REPO, ".claude/agents/builder.md"));
  const step = /^2\. ([\s\S]*?)^3\. /m.exec(text);
  assert.ok(step, "no step 2");
  const words = flat(step[1]);
  assert.match(words, /scripts\.factory\.stamp budget --ticket\b/);
  assert.doesNotMatch(words, /otherwise write the file by hand/);
  assert.doesNotMatch(words, /\{"schema"/, "the hand-written JSON is still there");
});

test("CLAUDE.md: message only finished agents, wait for running ones; at most 90 lines", () => {
  const text = read(join(REPO, "CLAUDE.md"));
  const words = flat(text).toLowerCase();
  assert.ok(words.includes("message only finished agents"), 'no "message only finished agents"');
  assert.ok(words.includes("wait for running ones"), 'no "wait for running ones"');
  assert.ok(lineCount(text) <= 90, `${lineCount(text)} lines`);
});
