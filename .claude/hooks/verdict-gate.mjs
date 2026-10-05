#!/usr/bin/env node
// SubagentStop: the gating agents end with the machine-read line their callers parse (docs/specs/factory.md §3.5).
// `pr-reviewer` ends `VERDICT: PASS|FIX|BLOCK at <40-hex sha>` (review-verdict.schema.json), `refuter` with
// CONFIRMED, REFUTED or UNPROVEN, `acceptance-writer` with both counts (trailers.md 3). A report missing its line is
// sent back once (stop_hook_active lets the second stop through). Every other agent, and any input this hook
// cannot read, passes. The verdict line is the report's LAST non-empty line, as f4's agents write it (spec §3.3).
// The agent's last tool call among SubagentHandback and StructuredOutput, read from the end of its transcript
// (`agent_transcript_path`, its last 2 MB), decides first: /review-pr runs `pr-reviewer` and `refuter` with a schema
// (`REVIEW` and `REFUTE` in .claude/workflows/review-pr.js), so they answer through StructuredOutput, and a valid
// verdict there passes. A handback's `input.message` is the report (the closing text is then not read). Otherwise
// `last_assistant_message` is the report; `tool_input.message` is the last fallback.
import { closeSync, openSync, readFileSync, readSync, statSync } from "node:fs";

const TRANSCRIPT_TAIL = 2 * 1024 * 1024;

const REVIEWER_LINE = "VERDICT: PASS|FIX|BLOCK at <40-hex sha>";

/** The report's last non-empty line, trimmed. */
const lastLine = (text) =>
  text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "")
    .at(-1) ?? "";

const RULES = {
  "pr-reviewer": (text) =>
    /^VERDICT: (?:PASS|FIX|BLOCK) at [0-9a-f]{40}$/.test(lastLine(text))
      ? null
      : `Your last line must be exactly \`${REVIEWER_LINE}\` (the reviewed head's full sha); the orchestrator reads only that line. Add it as the final line.`,
  refuter: (text) =>
    /^[*_`]*(?:[Vv]erdict:\s*)?(?:CONFIRMED|REFUTED|UNPROVEN)[*_`.]*$/.test(lastLine(text))
      ? null
      : "Your last line must be the verdict alone: CONFIRMED, REFUTED or UNPROVEN. Add it as the final line.",
  "acceptance-writer": (text) => {
    const missing = [
      [/^\s*red-on-main: \d+ failed\s*$/m, "red-on-main: <n> failed"],
      [/^\s*green-on-throwaway: \d+ passed\s*$/m, "green-on-throwaway: <n> passed"],
    ]
      .filter(([pattern]) => !pattern.test(text))
      .map(([, line]) => line);
    return missing.length === 0 ? null : `Your report must carry both counts, each on its own line; missing: ${missing.join(", ")}.`;
  },
};

/** Whether a StructuredOutput call's input is a verdict of this agent type (the REVIEW and REFUTE schemas). */
const STRUCTURED = {
  "pr-reviewer": (input) => ["PASS", "FIX", "BLOCK"].includes(input?.verdict) && /^[0-9a-f]{40}$/.test(input?.head ?? ""),
  refuter: (input) => ["CONFIRMED", "REFUTED", "UNPROVEN"].includes(input?.verdict),
};

const HAND_BACK_AGAIN =
  " Hand the whole report back again through SubagentHandback, its last line being the required line: the closing text is not read.";

/** The transcript's last SubagentHandback or StructuredOutput call as `{kind, input}`, or null. */
function lastCall(path) {
  if (typeof path !== "string" || path === "") return null;
  let text;
  let fd;
  try {
    fd = openSync(path, "r");
    const size = statSync(path).size;
    const start = Math.max(0, size - TRANSCRIPT_TAIL);
    const buffer = Buffer.alloc(size - start);
    readSync(fd, buffer, 0, buffer.length, start);
    text = buffer.toString("utf8");
    if (start > 0) text = text.slice(text.indexOf("\n") + 1); // Drop the line the cut began inside.
  } catch {
    return null;
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
  let found = null;
  for (const line of text.split("\n")) {
    if (!line.includes("SubagentHandback") && !line.includes("StructuredOutput")) continue;
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }
    const message = entry?.message;
    if (entry?.type !== "assistant" || !Array.isArray(message?.content)) continue;
    for (const part of message.content) {
      if (part?.type !== "tool_use") continue;
      if (part.name === "SubagentHandback" && typeof part.input?.message === "string") found = { kind: part.name, input: part.input };
      else if (part.name === "StructuredOutput") found = { kind: part.name, input: part.input };
    }
  }
  return found;
}

function verdict() {
  const event = JSON.parse(readFileSync(0, "utf8"));
  if (event === null || typeof event !== "object" || event.stop_hook_active === true) return null;
  const rule = Object.hasOwn(RULES, event.agent_type) ? RULES[event.agent_type] : null;
  if (rule === null) return null;
  const call = lastCall(event.agent_transcript_path);
  if (call?.kind === "SubagentHandback") {
    const reason = rule(call.input.message);
    return reason === null ? null : reason + HAND_BACK_AGAIN;
  }
  if (call?.kind === "StructuredOutput" && STRUCTURED[event.agent_type]?.(call.input)) return null;
  const report = typeof event.last_assistant_message === "string" ? event.last_assistant_message : event.tool_input?.message;
  return typeof report === "string" ? rule(report) : null;
}

try {
  const reason = verdict();
  if (reason !== null) process.stdout.write(`${JSON.stringify({ decision: "block", reason })}\n`);
} catch {
  // Unreadable input passes: the ledger, not this hook, is the wall.
}
