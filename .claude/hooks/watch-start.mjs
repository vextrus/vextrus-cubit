#!/usr/bin/env node
// SessionStart, main checkout only: restart the factory's watcher (`scripts/factory/watch.py`) when its pidfile is
// stale, detached, and say so. The watcher writes the event log the orchestrator's Monitor wakes on; a reboot or a
// killed terminal used to leave it dead with nobody told. Keyed on CLAUDE_PROJECT_DIR (it stays put when Claude
// `cd`s into a worktree). Silent when the watcher runs, when watch.py is absent (f3 lands it) and on any failure.
import { spawn, spawnSync } from "node:child_process";
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const project = process.env.CLAUDE_PROJECT_DIR || "";

const git = (...args) => {
  const done = spawnSync("git", ["-C", project, ...args], { encoding: "utf8", timeout: 3_000 });
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

const readText = (path) => {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
};

/** Alive means the pid answers signal 0 and, where /proc shows it, its command line runs watch.py (pids get reused). */
function watcherAlive(text) {
  const pid = /^\s*(\d+)\s*$/.exec(text ?? "")?.[1];
  if (pid === undefined || Number(pid) <= 1) return false;
  try {
    process.kill(Number(pid), 0);
  } catch (error) {
    if (error.code !== "EPERM") return false;
  }
  const cmdline = readText(`/proc/${pid}/cmdline`);
  return cmdline === null || cmdline.includes("watch.py");
}

try {
  if (project !== "" && existsSync(join(project, "scripts/factory/watch.py")) && mainCheckout()) {
    const folder = join(project, ".private/work/factory");
    const pidfile = join(folder, "watch.pid");
    const before = readText(pidfile);
    if (!watcherAlive(before)) {
      mkdirSync(folder, { recursive: true });
      const out = openSync(join(folder, "watch.out"), "a");
      const python = process.env.VEXTRUS_PYTHON || "python3";
      const child = spawn(python, ["scripts/factory/watch.py"], { cwd: project, detached: true, stdio: ["ignore", out, out] });
      child.on("error", () => {});
      child.unref();
      closeSync(out);
      if (child.pid !== undefined) {
        // watch.py overwrites the pidfile with its own pid; write ours only if it has not done so already.
        if (readText(pidfile) === before) writeFileSync(pidfile, `${child.pid}\n`);
        process.stdout.write(`watcher: ${before === null ? "started (no pidfile)" : "restarted (stale pidfile)"}\n`);
      }
    }
  }
} catch {
  // A display and a convenience, never a gate.
}
