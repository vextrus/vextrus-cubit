// Acceptance (ticket S30-F2c, split out of PR #887 (S29-F2b) under Q16, issue #895; docs/plans/factory-s29.md item 2,
// F2: "The walk gate passes negated and quoted sentences (#865)"). Issue #865: "a message saying the walk is not
// ready, or quoting the phrase in a negative or reported sentence, passes; an invitation to walk is still blocked."
// #895's standing round-2 finding (35): "Why not walk now?" and "I see no reason not to walk now." pass the gate.
// The NEGATED, QUOTED and CLAIMS tables are #887's (ts29f2b/walk-gate-negation.test.mjs), kept as they were.
//
// `.claude/hooks/walk-gate.mjs` on Stop, in a main checkout whose G1 fails (a stub scripts/walk/ready.py exiting 1):
// - a phrase ("walk now", "ready for your walk", "please walk") negated in its own clause, or inside quotes or a code
//   span, is allowed, and ready.py is not run (the message asks for no walk, so G1 is not consulted);
// - a plain claim is still blocked, also when another clause or sentence of the message negates or quotes the phrase;
//   the reason quotes the words of the plain claim.
// The negation's scope is the clause: boundaries are `.`, `!`, `?`, `;`, `:` and a line break. Not pinned either way:
// a comma-joined clause ("Nothing is broken, walk now."), and "not X, but Y is ready for your walk".
//
// S30-F2c's decisions. When in doubt, block: the gate guards the owner's time, and a blocked message only has to be
// rephrased (the reason quotes the words), while a wrongly allowed one asks the owner to walk an unproven build. The
// allowed side is the short list above (lesson F6: list the safe side); everything else blocks:
// - a question frees nothing: a phrase in a sentence ending "?" is blocked even when negated ("Why not walk now?",
//   "Isn't it ready for your walk?"), and "why not" before the phrase is an invitation with or without the "?";
// - a double negative frees nothing: two negations before the phrase in its clause ("no reason not to walk now",
//   "can't see why you shouldn't walk now") read as an invitation;
// - a negation after the phrase frees nothing ("Walk now, not later.");
// - an affirmative phrase blocks in any case and with any run of spaces, tabs, a no-break space or a line break
//   between its words; a quoted phrase is allowed with odd spacing too, and in a question.
// Not pinned: unquoted, un-negated reported speech ("the gate blocks a message that says walk now"): no authority
// tells it from an invitation without a verb list, so the builder may block it; quoted or negated reported speech is
// pinned as allowed. A single "no" before the phrase ("No walk now: G1 failed.") is not pinned either way.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = fileURLToPath(new URL("../../../../../", import.meta.url));
const HOOK = join(REPO, ".claude/hooks/walk-gate.mjs");
const INHERITED = ["CLAUDE_CODE_REMOTE", "VEXTRUS_ROLE", "CLAUDE_PROJECT_DIR", "VEXTRUS_NOW_UTC", "VEXTRUS_PYTHON"];
const GIT_ENV = {
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_CONFIG_NOSYSTEM: "1",
  GIT_AUTHOR_NAME: "Fixture",
  GIT_AUTHOR_EMAIL: "fixture@example.invalid",
  GIT_COMMITTER_NAME: "Fixture",
  GIT_COMMITTER_EMAIL: "fixture@example.invalid",
};

function environment(extra = {}) {
  const env = { ...process.env, ...GIT_ENV };
  for (const name of INHERITED) delete env[name];
  return { ...env, ...extra };
}

function git(cwd, ...args) {
  const done = spawnSync("git", args, { cwd, env: environment(), encoding: "utf8" });
  assert.equal(done.status, 0, `git ${args.join(" ")}: ${done.stderr}`);
}

/** A main checkout whose stub scripts/walk/ready.py records that it ran, then exits 1 (G1 fails). */
function failingG1() {
  const dir = mkdtempSync(join(tmpdir(), "s30f2c-walk-"));
  git(dir, "init", "-q", "-b", "main");
  writeFileSync(join(dir, "README.md"), "fixture\n");
  git(dir, "add", "README.md");
  git(dir, "commit", "-q", "-m", "base");
  mkdirSync(join(dir, "scripts/walk"), { recursive: true });
  writeFileSync(join(dir, "scripts/__init__.py"), "");
  writeFileSync(join(dir, "scripts/walk/__init__.py"), "");
  const marker = JSON.stringify(join(dir, "ready.marker"));
  writeFileSync(join(dir, "scripts/walk/ready.py"), `import sys\nopen(${marker}, "a").write("ran\\n")\nsys.exit(1)\n`);
  return dir;
}

function stop(dir, message) {
  return spawnSync(process.execPath, [HOOK], {
    cwd: dir,
    input: JSON.stringify({ hook_event_name: "Stop", session_id: "s", stop_hook_active: false, last_assistant_message: message, cwd: dir }),
    env: environment({ CLAUDE_PROJECT_DIR: dir }),
    encoding: "utf8",
    timeout: 30_000,
  });
}

function allowedWithoutG1(message) {
  const dir = failingG1();
  const done = stop(dir, message);
  assert.equal(done.status, 0, done.stderr);
  assert.equal(done.stdout.trim(), "", `expected no output, got ${done.stdout}`);
  assert.ok(!existsSync(join(dir, "ready.marker")), "ready.py must not run");
}

function blockReason(message) {
  const done = stop(failingG1(), message);
  assert.equal(done.status, 0, done.stderr);
  let out;
  assert.doesNotThrow(() => (out = JSON.parse(done.stdout)), `stdout is one JSON object: ${done.stdout}`);
  assert.equal(out.decision, "block");
  assert.equal(typeof out.reason, "string");
  return out.reason;
}

// Allowed: the phrase negated in its own clause.
const NEGATED = [
  ["not", "M0 is not ready for your walk."],
  ["not, then a reason", "It is not ready for your walk: G1 has not passed."],
  ["do not", "Do not walk now; G1 has not passed."],
  ["don't", "Don't walk now. The head is red."],
  ["don’t (curly apostrophe)", "Don’t walk now. The head is red."],
  ["never", "I will never say walk now without a passing G1."],
  ["isn't", "The build isn't ready for your walk yet."],
  ["cannot", "You cannot walk now: no G1 verdict exists."],
  ["can't", "You can't walk now."],
  ["won't", "I won't ask you to walk now."],
  ["please do not", "Please do not walk now."],
  ["negation on its own line", "Status:\nNot ready for your walk."],
];
for (const [kind, message] of NEGATED) {
  test(`negated (${kind}): ${JSON.stringify(message)} is allowed without running G1`, () => allowedWithoutG1(message));
}

// Allowed: the phrase quoted or in code.
const QUOTED = [
  ["double quotes", 'The gate matched "walk now" in my last message.'],
  ["single quotes", "The rule: no 'walk now' to the owner without a passing G1 verdict on main's current product code."],
  ["curly quotes", "The hook blocked “ready for your walk” three times today."],
  ["code span", "The hook's phrases are `walk now`, `ready for your walk` and `please walk`."],
  ["fenced code", "The phrases:\n```\nwalk now\nplease walk\n```\nare gated."],
];
for (const [kind, message] of QUOTED) {
  test(`quoted (${kind}): ${JSON.stringify(message)} is allowed without running G1`, () => allowedWithoutG1(message));
}

// Blocked: a plain claim, whatever else the message says.
const CLAIMS = [
  ["negation in an earlier clause", "The build is not broken; walk now.", "walk now"],
  ["negation in an earlier sentence", "G1 has not failed. Please walk the build.", "Please walk"],
  ["negated sentence, then a plain claim", "It was not ready for your walk yesterday. It is ready for your walk today.", "ready for your walk"],
  ["negation word inside another word", "Another green head is ready for your walk.", "ready for your walk"],
  ["a word holding n't-like letters", "Nothing is red. Walk now.", "Walk now"],
  ["quoted phrase, then a plain claim", 'The gate matched "walk now" before. G1 passed: Walk Now.', "Walk Now"],
  ["code span, then a plain claim", "The phrase `please walk` is gated. Now please walk the build.", "please walk"],
  ["an unclosed quote", 'The head is green "for real. Walk now.', "Walk now"],
];
for (const [kind, message, words] of CLAIMS) {
  test(`plain claim (${kind}): ${JSON.stringify(message)} is blocked, quoting "${words}"`, () => {
    const reason = blockReason(message);
    assert.ok(reason.includes(`"${words}"`), reason);
    assert.match(reason, /G1/);
  });
}

// S30-F2c. Blocked: questions, whatever negation they hold (#895's "Why not walk now?").
const QUESTIONS = [
  ["why not", "Why not walk now?", "walk now"],
  ["why not, no question mark", "why not walk now", "walk now"],
  ["why don't you", "Why don't you walk now?", "walk now"],
  ["negated question", "Isn't it ready for your walk?", "ready for your walk"],
  ["negated question, then a plain sentence", "Is it not ready for your walk? The head is green.", "ready for your walk"],
  ["a plain question", "Can you walk now?", "walk now"],
  ["a bare question", "Ready for your walk?", "Ready for your walk"],
  ["a question asking to walk", "Would you please walk the build?", "please walk"],
];
for (const [kind, message, words] of QUESTIONS) {
  test(`question (${kind}): ${JSON.stringify(message)} is blocked, quoting "${words}"`, () => {
    const reason = blockReason(message);
    assert.ok(reason.includes(`"${words}"`), reason);
    assert.match(reason, /G1/);
  });
}

// S30-F2c. Blocked: double negatives and a negation after the phrase (#895's "I see no reason not to walk now.").
const DOUBLE = [
  ["no reason not to", "I see no reason not to walk now.", "walk now"],
  ["no reason you can't", "There is no reason you can't walk now.", "walk now"],
  ["can't see why you shouldn't", "I can't see why you shouldn't walk now.", "walk now"],
  ["would not say it is not", "I would not say it is not ready for your walk.", "ready for your walk"],
  ["cannot fail to", "Nothing stops you; you cannot fail to walk now.", "walk now"],
  ["negation after the phrase", "Walk now, not later.", "Walk now"],
  ["negation after the phrase, its own sentence", "Please walk the build. Not later.", "Please walk"],
];
for (const [kind, message, words] of DOUBLE) {
  test(`double negative or late negation (${kind}): ${JSON.stringify(message)} is blocked, quoting "${words}"`, () => {
    const reason = blockReason(message);
    assert.ok(reason.includes(`"${words}"`), reason);
    assert.match(reason, /G1/);
  });
}

// S30-F2c. Blocked: an affirmative phrase in any case or spacing. The reason quotes the words as written (T-HOOKS),
// their spacing as it was.
const SPACING = [
  ["mixed case", "The head is green: WaLk NoW.", "WaLk NoW"],
  ["upper case", "READY FOR YOUR WALK.", "READY FOR YOUR WALK"],
  ["two spaces", "You can walk  now.", "walk  now"],
  ["a tab", "You can walk\tnow.", "walk\tnow"],
  ["a no-break space", "You can walk\u00a0now.", "walk\u00a0now"],
  ["a line break", "You can walk\nnow.", "walk\nnow"],
  ["spaces in every gap", "It is ready   for  your   walk.", "ready   for  your   walk"],
  ["please, two spaces", "Please  walk the build.", "Please  walk"],
  ["markdown emphasis", "**Ready for your walk.**", "Ready for your walk"],
];
for (const [kind, message, words] of SPACING) {
  test(`affirmative (${kind}): ${JSON.stringify(message)} is blocked, quoting ${JSON.stringify(words)}`, () => {
    const reason = blockReason(message);
    assert.ok(reason.includes(`("${words}")`), reason);
    assert.match(reason, /G1/);
  });
}

// S30-F2c. Blocked: an affirmative with a reporting verb is still a claim, and an unclosed code span quotes nothing.
const NOT_FREED = [
  ["a reporting verb", "As I told you, walk now.", "walk now"],
  ["an unclosed code span", "The phrase `walk now is gated.", "walk now"],
];
for (const [kind, message, words] of NOT_FREED) {
  test(`plain claim (${kind}): ${JSON.stringify(message)} is blocked, quoting "${words}"`, () => {
    const reason = blockReason(message);
    assert.ok(reason.includes(`"${words}"`), reason);
    assert.match(reason, /G1/);
  });
}

// S30-F2c. Allowed: negated or quoted reported speech about the rule, a quoted phrase in a question or with odd
// spacing, and negations in another sentence than the negated phrase.
const REPORTED = [
  ["negated reported speech", "I was told never to say walk now without a passing G1."],
  ["quoted reported speech", "The owner was told “walk now” twice with no agent walking first."],
  ["quoted, in a question", 'Why did the gate match "walk now" in my last message?'],
  ["code span, in a question", "Should the gate also match `ready for your walk`?"],
  ["quoted, odd spacing", 'The gate matched "walk  now" in my last message.'],
  ["negations in two sentences", "No G1 verdict has passed. Do not walk now."],
  ["negated, upper case", "DO NOT WALK NOW."],
  ["negated, odd spacing", "It is not  ready for  your walk."],
];
for (const [kind, message] of REPORTED) {
  test(`allowed (${kind}): ${JSON.stringify(message)} is allowed without running G1`, () => allowedWithoutG1(message));
}
