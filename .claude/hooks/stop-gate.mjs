#!/usr/bin/env node
// Stop, builder sessions only: a nudge before a builder stops with its work in a state the factory cannot read.
// Blocked once (stop_hook_active lets the second stop through): uncommitted tracked changes with no finish trailer
// on HEAD, or a READY-looking HEAD (docs/specs/factory/contracts/trailers.md) without a green verify record for its
// tree. The guard's READY push gate is the wall; this only reminds. Keyed on CLAUDE_PROJECT_DIR, not the event's
// cwd (which follows `cd`). Fails open: any parse or git failure lets the stop through.
import { spawnSync } from "node:child_process";
import { readFileSync, realpathSync } from "node:fs";
import { join, resolve } from "node:path";
import { readTrailers } from "./trailers.mjs";

const project = process.env.CLAUDE_PROJECT_DIR || "";
const LAWFUL =
  "Before stopping: commit with explicit paths and run verify, or finish `Factory-State: BLOCKED` with a reason " +
  "(a `Factory-Reason:` trailer).";

const git = (args, input) => {
  const done = spawnSync("git", ["-C", project, ...args], { encoding: "utf8", input, timeout: 5_000 });
  if (done.status !== 0) throw new Error(`git ${args[0]} failed`);
  return done.stdout;
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
  const dir = git(["rev-parse", "--git-dir"]).trim();
  const common = git(["rev-parse", "--git-common-dir"]).trim();
  return real(resolve(project, dir)) === real(resolve(project, common));
}

/**
 * HEAD's finish state per trailers.md 1 (the shared reader): { state, why }, state "ready", "ready-malformed" (gated as
 * READY, or a factory line outside the read paragraph: the watcher alarms on it), "blocked" or "none" (a malformed
 * BLOCKED, or a folded `Factory-State:` value, reads as no trailer: trailers.md 4).
 */
function finishState(tree) {
  const { outcome, why, gated } = readTrailers(git(["log", "-1", "--format=%B"]), tree);
  if (outcome === "READY") return { state: "ready", why };
  if (gated || outcome === "READY-NO-VERIFY") return { state: "ready-malformed", why };
  return { state: outcome === "BLOCKED" ? "blocked" : "none", why };
}

/** A green record (verify-record.schema.json): parses, schema_version 1, non-empty checks, every exit_code 0. */
function verified(tree) {
  const common = git(["rev-parse", "--git-common-dir"]).trim();
  try {
    const record = JSON.parse(readFileSync(join(resolve(project, common), "vextrus", `verify-${tree}.json`), "utf8"));
    return record?.schema_version === 1 && Array.isArray(record.checks) && record.checks.length > 0 && record.checks.every((check) => check?.exit_code === 0);
  } catch {
    return false;
  }
}

function verdict() {
  const event = JSON.parse(readFileSync(0, "utf8"));
  if (event === null || typeof event !== "object" || Array.isArray(event) || event.stop_hook_active === true) return null;
  if (project === "" || mainCheckout()) return null;
  const tree = git(["rev-parse", "HEAD^{tree}"]).trim();
  const { state, why } = finishState(tree);
  if (state === "blocked") return null;
  if (state === "ready") {
    if (verified(tree)) return null;
    return `HEAD says Factory-State: READY but carries no green verify record for its tree (verify not run on this commit). ${LAWFUL}`;
  }
  if (state === "ready-malformed") return `HEAD's factory trailers are malformed (${why}), so the factory cannot read them. ${LAWFUL}`;
  const dirty = git(["status", "--porcelain", "--untracked-files=no"]).trim() !== "";
  return dirty ? `Uncommitted tracked changes and no Factory-State trailer on HEAD. ${LAWFUL}` : null;
}

try {
  const reason = verdict();
  if (reason !== null) process.stdout.write(`${JSON.stringify({ decision: "block", reason })}\n`);
} catch {
  // A nudge fails open.
}
