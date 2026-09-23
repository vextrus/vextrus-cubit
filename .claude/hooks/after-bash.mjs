#!/usr/bin/env node
// PostToolUse hook on Bash: after a `git commit`, flush the page cache to disk. A power cut once
// emptied the newest commit's loose objects, which ext4 had not yet written; the commit was rebuilt
// byte-exact by hand. "Commit, then sync" is the lesson, and this hook is where it lives.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

try {
  const event = JSON.parse(readFileSync(0, "utf8"));
  const command = String(event.tool_input?.command ?? "");
  if (/\bgit\s+(?:-C\s+\S+\s+)?commit\b/.test(command)) spawnSync("sync", { stdio: "ignore", timeout: 30_000 });
} catch {
  // Nothing to flush on a call this hook cannot read.
}
process.exit(0);
