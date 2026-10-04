#!/usr/bin/env node
// SubagentStop: the gating agents end with the machine-read line their callers parse (docs/specs/factory.md §3.5).
// `pr-reviewer` ends `VERDICT: PASS|FIX|BLOCK at <40-hex sha>` (review-verdict.schema.json), `refuter` with
// CONFIRMED, REFUTED or UNPROVEN, `acceptance-writer` with both counts (trailers.md 3). A report missing its line is
// sent back once (stop_hook_active lets the second stop through). Every other agent, and any input this hook
// cannot read, passes. The report is `last_assistant_message`, or `tool_input.message` for a handback report.
import { readFileSync } from "node:fs";

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

function verdict() {
  const event = JSON.parse(readFileSync(0, "utf8"));
  if (event === null || typeof event !== "object" || event.stop_hook_active === true) return null;
  const rule = Object.hasOwn(RULES, event.agent_type) ? RULES[event.agent_type] : null;
  if (rule === null) return null;
  const report = typeof event.last_assistant_message === "string" ? event.last_assistant_message : event.tool_input?.message;
  return typeof report === "string" ? rule(report) : null;
}

try {
  const reason = verdict();
  if (reason !== null) process.stdout.write(`${JSON.stringify({ decision: "block", reason })}\n`);
} catch {
  // Unreadable input passes: the ledger, not this hook, is the wall.
}
