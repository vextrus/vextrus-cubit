#!/usr/bin/env node
// PreToolUse hook: hands the tool call to the session guard (scripts/harness/guard-rules.mjs) and,
// where it breaks a rule, denies it with the rule's name and the lawful path, which the model reads.
// Anything this adapter cannot read is allowed through: the guard refuses what it recognises and is
// never the reason a session cannot work.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = process.env.CLAUDE_PROJECT_DIR ?? resolve(fileURLToPath(new URL("../..", import.meta.url)));

let call;
try {
  const event = JSON.parse(readFileSync(0, "utf8"));
  call = { tool: String(event.tool_name ?? ""), input: event.tool_input ?? {} };
} catch {
  process.exit(0);
}

const { judge } = await import(resolve(root, "scripts/harness/guard-rules.mjs"));
const tracked = (relativePath) => spawnSync("git", ["ls-files", "--error-unmatch", relativePath], { cwd: root, stdio: "ignore" }).status === 0;
const verdict = judge(call, { root, tracked });
if (verdict !== null) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: `${verdict.rule}: ${verdict.reason}`,
      },
    }),
  );
}
process.exit(0);
