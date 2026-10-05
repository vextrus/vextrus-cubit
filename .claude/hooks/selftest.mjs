#!/usr/bin/env node
// SessionStart: prove the guard is on. A missing or mistyped hook path silently disables a gate (Claude Code reports
// nothing), so feed the project's guard one refusal it must make, a force push, and shout if it does not refuse.
// Refused means exit code 2 or a JSON `permissionDecision: "deny"`; anything else (allow, exit 1, a crash, no
// answer within 5 s, no file) is a warning. Silent when the guard refuses.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const project = process.env.CLAUDE_PROJECT_DIR || resolve(fileURLToPath(new URL("../..", import.meta.url)));
const guard = join(project, ".claude/hooks/guard.mjs");
const WARNING =
  "WARNING: the guard did not refuse a force push. Its gate may be OFF (missing or mistyped hook path). Tell the owner before pushing.";

function refused() {
  if (!existsSync(guard)) return false;
  const event = {
    hook_event_name: "PreToolUse",
    session_id: "selftest",
    cwd: project,
    tool_name: "Bash",
    tool_input: { command: "git push --force origin HEAD", description: "guard self-test" },
  };
  const done = spawnSync(process.execPath, [guard], {
    cwd: project,
    input: JSON.stringify(event),
    encoding: "utf8",
    timeout: 5_000,
    killSignal: "SIGKILL",
  });
  if (done.error || done.signal) return false;
  if (done.status === 2) return true;
  if (done.status !== 0) return false;
  try {
    const out = JSON.parse(done.stdout);
    return out?.hookSpecificOutput?.permissionDecision === "deny" || out?.permissionDecision === "deny" || out?.decision === "block";
  } catch {
    return false;
  }
}

let ok = false;
try {
  ok = refused();
} catch {
  ok = false;
}
if (!ok) process.stdout.write(`${WARNING}\n`);
