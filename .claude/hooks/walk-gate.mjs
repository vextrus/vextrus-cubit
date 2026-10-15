#!/usr/bin/env node
// Stop, main checkout only: no "walk now" to the owner without a passing G1 on main (docs/specs/factory.md §5). The
// owner was told "walk now" twice with no agent walking first (spec D3). A last message asking for the walk is
// blocked unless `python3 -m scripts.walk.ready origin/main` exits 0 within 8 s. A phrase inside a longer word
// ("sidewalk now", "walk nowhere") does not count, and each block reason quotes the words that matched, so a message
// that only discusses the rule can be rephrased. A phrase that asks for no walk passes without G1 (#865): one whose own
// verb phrase is negated ("not", "never", "cannot", "n't", straight or curly, right before it or before a few bridge
// words: "is not yet ready for your walk", "do not walk now", "won't ask you to walk now"), or one inside a closed
// quote (double, single, curly), a code span or a fenced block. A negation anywhere else (after the phrase, in an
// earlier clause, in a relative clause of the subject: "the PR that doesn't touch the engine is ready for your walk")
// frees nothing, nor do two negations in the clause ("no reason not to walk now"), "why" before the phrase, or a question (the sentence ends "?"); a clause ends at . ! ? ; : or a line break, and any run of whitespace may sit between the phrase's words (S30-F2c). A plain claim anywhere in the message still blocks, and the reason quotes it. Fails closed where it
// matters: ready.py absent (G1 not installed), failing, or hung blocks. Every other failure (no message, garbage stdin,
// a builder session) lets the stop through.
// stop_hook_active is not honoured: Claude Code's cap of 8 blocks in a row is the backstop, and a second "walk now" is
// no more true than the first.
import { spawnSync } from "node:child_process";
import { performance } from "node:perf_hooks";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { join, resolve } from "node:path";

const project = process.env.CLAUDE_PROJECT_DIR || "";
// Registered with a 15 s timeout, and a timed-out hook fails open: the whole hook ends inside 10 s.
const DEADLINE_MS = 10_000;
// Fails toward blocking: only a letter before a phrase frees it (markdown's `_` and `*` do not), and after it only the
// two false matches "walk nowhere" and "walked"; "walkthrough" and "walking" still block.
const PHRASES = /(?<![A-Za-z])(?:walk\s+now(?!here)|ready\s+for\s+your\s+walk|please\s+walk(?!ed))/gi;
// What frees a phrase: closed quotes and code on one line (a single quote only between non-letters, so "don't" opens
// none, nor an inch mark: 6"), closed fenced blocks; then exactly one negation that governs the phrase (GOVERNED).
const QUOTED = [/```[\s\S]*?```/g, /`[^`\n]+`/g, /(?<![A-Za-z0-9])"[^"\n]*"/g, /“[^“”\n]*”/g, /‘[^‘’\n]*’/g, /(?<![A-Za-z0-9])'[^'\n]*'(?![A-Za-z0-9])/g];
// A negation frees a phrase only when it governs it: the text before the phrase ends with the negation and at most a
// few words from this closed set ("not yet ready", "never say walk now", "won't ask you to walk now"). No finite verb
// and no noun is in it, so a negation in a relative clause of the subject ("the PR that doesn't touch the engine is
// ready for your walk") or in an earlier clause frees nothing.
const BRIDGE = "yet|be|been|ever|even|still|say|ask|asking|tell|telling|invite|inviting|want|wanting|need|you|to";
// Spaces, tabs and no-break spaces only between them: a line break ends the negation's reach.
const GOVERNED = new RegExp(`(?:(?<![A-Za-z])(?:not|never|cannot)|[A-Za-z]n['’]t)(?:[ \\t\\u00a0]+(?:${BRIDGE}))*[ \\t\\u00a0]+$`, "i");
// Every negation word of the clause before the phrase: two or more read as an invitation ("no reason not to walk now").
const NEGATIONS = /(?<![A-Za-z])(?:no|not|never|cannot|nothing|nobody|none|neither|nor)(?![A-Za-z])|[A-Za-z]n['’]t(?![A-Za-z])/gi;
// A clause ends at . ! ? ; : or a line break (the negation's scope, and the sentence a question ends).
const CLAUSE_END = /[.!?;:\n]/;

/** The message with quoted and code text blanked to spaces (same length, line breaks kept). */
function unquoted(message) {
  let text = message;
  for (const pattern of QUOTED) text = text.replace(pattern, (span) => span.replace(/[^\n]/g, " "));
  return text;
}

/** Whether the phrase at `index` is freed: negated once in its own clause, not a question, not "why not". When in doubt, no. */
function freed(text, index, length) {
  let start = index;
  while (start > 0 && !CLAUSE_END.test(text[start - 1])) start -= 1;
  const before = text.slice(start, index);
  if (!GOVERNED.test(before)) return false;
  if ((before.match(NEGATIONS) || []).length !== 1 || /(?<![A-Za-z])why(?![A-Za-z])/i.test(before)) return false;
  const end = text.slice(index + length).search(CLAUSE_END);
  return end === -1 || text[index + length + end] !== "?";
}

/** The first phrase that asks for a walk (not quoted, not freed by a negation), as written; or undefined. */
export function walkRequest(message) {
  const text = unquoted(message);
  for (const match of text.matchAll(PHRASES)) {
    if (!freed(text, match.index, match[0].length)) return message.slice(match.index, match.index + match[0].length);
  }
  return undefined;
}

const git = (...args) => {
  const done = spawnSync("git", ["-C", project, ...args], { encoding: "utf8", timeout: 1_000 });
  return done.status === 0 ? done.stdout.trim() : null;
};
const real = (path) => {
  try {
    return realpathSync(path);
  } catch {
    return resolve(path);
  }
};

/** The orchestrator's checkout: not cloud, not a builder, and not a linked worktree. */
function mainCheckout() {
  if (process.env.CLAUDE_CODE_REMOTE === "true" || process.env.VEXTRUS_ROLE === "builder") return false;
  const dir = git("rev-parse", "--git-dir");
  const common = git("rev-parse", "--git-common-dir");
  return dir !== null && common !== null && real(resolve(project, dir)) === real(resolve(project, common));
}

function verdict() {
  let message;
  try {
    message = JSON.parse(readFileSync(0, "utf8"))?.last_assistant_message;
  } catch {
    return null;
  }
  const matched = typeof message === "string" ? walkRequest(message) : undefined;
  if (matched === undefined) return null;
  if (project === "" || !mainCheckout()) return null;
  const asked = `Your last message asks the owner to walk ("${matched}").`;
  if (!existsSync(join(project, "scripts/walk/ready.py"))) {
    return `${asked} G1 is not installed (scripts/walk/ready.py is absent), so no walk can be offered. Do not ask the owner to walk; say what is unproven instead.`;
  }
  // The project's own interpreter (the venv `uv sync` made, Python 3.14), not the system's; never `uv run`, whose
  // sync could outlast the hook's timeout.
  const venv = join(project, ".venv/bin/python");
  const python = process.env.VEXTRUS_PYTHON || (existsSync(venv) ? venv : "python3");
  const cap = Math.max(500, Math.min(8_000, DEADLINE_MS - performance.now()));
  const ready = spawnSync(python, ["-m", "scripts.walk.ready", "origin/main"], { cwd: project, stdio: "ignore", timeout: cap, killSignal: "SIGKILL" });
  if (ready.status === 0) return null;
  const why = ready.error || ready.signal ? `did not answer within ${Math.round(cap / 1000)} s` : `exited ${ready.status}`;
  return `${asked} No passing G1 on main's current product code (scripts.walk.ready origin/main ${why}). Do not ask the owner to walk: run the G1 walk first, or say what is unproven.`;
}

const reason = verdict();
if (reason !== null) process.stdout.write(`${JSON.stringify({ decision: "block", reason })}\n`);
