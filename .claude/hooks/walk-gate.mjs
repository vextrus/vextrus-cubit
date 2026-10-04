#!/usr/bin/env node
// Stop, main checkout only: no "walk now" to the owner without a passing G1 on main (docs/specs/factory.md §5). The
// owner was told "walk now" twice with no agent walking first (spec D3). A last message asking for the walk is
// blocked unless `python3 -m scripts.walk.ready origin/main` exits 0 within 12 s. Fails closed where it matters:
// ready.py absent (G1 not installed), failing, or hung blocks. Every other failure (no message, garbage stdin, a
// builder session) lets the stop through. stop_hook_active is not honoured: Claude Code's cap of 8 blocks in a
// row is the backstop, and a second "walk now" is no more true than the first.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { join, resolve } from "node:path";

const project = process.env.CLAUDE_PROJECT_DIR || "";
// Registered with a 15 s timeout, and a timed-out hook fails open: every wait below shares one 13 s deadline, so the
// block is printed before Claude Code would kill the hook.
const deadline = Date.now() + 13_000;
const PHRASES = /walk now|ready for your walk|please walk/i;

const git = (...args) => {
  const done = spawnSync("git", ["-C", project, ...args], { encoding: "utf8", timeout: 2_000 });
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
  if (typeof message !== "string" || !PHRASES.test(message)) return null;
  if (project === "" || !mainCheckout()) return null;
  if (!existsSync(join(project, "scripts/walk/ready.py"))) {
    return "G1 is not installed (scripts/walk/ready.py is absent), so no walk can be offered. Do not ask the owner to walk; say what is unproven instead.";
  }
  const python = process.env.VEXTRUS_PYTHON || "python3";
  const cap = Math.max(500, Math.min(12_000, deadline - Date.now()));
  const ready = spawnSync(python, ["-m", "scripts.walk.ready", "origin/main"], { cwd: project, stdio: "ignore", timeout: cap, killSignal: "SIGKILL" });
  if (ready.status === 0) return null;
  const why = ready.error || ready.signal ? `did not answer within ${Math.round(cap / 1000)} s` : `exited ${ready.status}`;
  return `No passing G1 on main's current product code (scripts.walk.ready origin/main ${why}). Do not ask the owner to walk: run the G1 walk first, or say what is unproven.`;
}

const reason = verdict();
if (reason !== null) process.stdout.write(`${JSON.stringify({ decision: "block", reason })}\n`);
