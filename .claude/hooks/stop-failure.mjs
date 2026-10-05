#!/usr/bin/env node
// StopFailure: a turn ended by an API error (rate limit, overloaded, billing) looks finished in unattended work, so
// append one line to the factory's event log the orchestrator Monitors: `<UTC> STOP-FAILURE - <error_type> <session8>`.
// Only the checked error type and the session id's first 8 chars leave the payload; never the error text, the cwd or
// the transcript path (the repo is public). The folder is VEXTRUS_FACTORY_DIR, else the main checkout's
// `.private/work/factory` (keyed on CLAUDE_PROJECT_DIR, so a worktree writes to its main checkout); nothing is written
// in the cloud without VEXTRUS_FACTORY_DIR. Observational: the CLI ignores output and exit code; every path is silent.
// `VEXTRUS_NOW_UTC` stands in for the wall clock in tests.
import { spawnSync } from "node:child_process";
import { appendFileSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const project = process.env.CLAUDE_PROJECT_DIR || "";

/** The factory folder, or null when none is known. */
function folder() {
  if (process.env.VEXTRUS_FACTORY_DIR) return process.env.VEXTRUS_FACTORY_DIR;
  if (process.env.CLAUDE_CODE_REMOTE === "true" || project === "") return null;
  const done = spawnSync("git", ["-C", project, "rev-parse", "--git-common-dir"], { encoding: "utf8", timeout: 3_000 });
  if (done.status !== 0 || done.stdout.trim() === "") return null;
  return join(dirname(resolve(project, done.stdout.trim())), ".private/work/factory");
}

function utc() {
  const injected = Date.parse(process.env.VEXTRUS_NOW_UTC ?? "");
  const now = Number.isFinite(injected) ? new Date(injected) : new Date();
  return now.toISOString().replace(/\.\d{3}Z$/, "Z");
}

try {
  const payload = JSON.parse(readFileSync(0, "utf8"));
  if (payload !== null && typeof payload === "object" && !Array.isArray(payload) && payload.hook_event_name === "StopFailure") {
    const type = typeof payload.error_type === "string" && /^[a-z_]{1,40}$/.test(payload.error_type) ? payload.error_type : "unknown";
    const head = typeof payload.session_id === "string" ? payload.session_id.slice(0, 8) : "";
    const session = /^[A-Za-z0-9-]{8}$/.test(head) ? head : "-";
    const dir = folder();
    if (dir !== null) {
      mkdirSync(dir, { recursive: true });
      appendFileSync(join(dir, "events.log"), `${utc()} STOP-FAILURE - ${type} ${session}\n`);
    }
  }
} catch {
  // A log line, never a gate.
}
