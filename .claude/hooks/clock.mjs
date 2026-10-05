#!/usr/bin/env node
// UserPromptSubmit and SessionStart: the time, against the budget, in one line in the model's context. Sessions
// lost track of time in 4 of 6 runs (spec C7), so this is the only surface that puts the clock in front of the
// model. The orchestrator's line comes from `.private/work/factory/session.json`; a builder's from its own
// budget record, `<git-common-dir>/vextrus/budget-<ticket>.json`. Both shapes are f3's (`stamp.py` writes them);
// anything else reads as "no budget set". A display, never a gate: every failure prints the quiet line, exit 0.
// `VEXTRUS_NOW_UTC` stands in for the wall clock in tests.
import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync, realpathSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const project = process.env.CLAUDE_PROJECT_DIR || "";
const now = (() => {
  const injected = Date.parse(process.env.VEXTRUS_NOW_UTC ?? "");
  return Number.isFinite(injected) ? new Date(injected) : new Date();
})();

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

/** The orchestrator's checkout: not cloud, not a builder, and not a linked worktree (keyed on the project folder). */
function mainCheckout() {
  if (process.env.CLAUDE_CODE_REMOTE === "true" || process.env.VEXTRUS_ROLE === "builder") return false;
  const dir = git("rev-parse", "--git-dir");
  const common = git("rev-parse", "--git-common-dir");
  return dir !== null && common !== null && real(resolve(project, dir)) === real(resolve(project, common));
}

const stamp = (date) => date.toISOString().replace("T", " ").slice(0, 16) + "Z";
const minutesSince = (iso) => Math.max(0, Math.floor((now.getTime() - Date.parse(iso)) / 60_000));
const hm = (minutes) => `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}`;
const isTime = (value) => typeof value === "string" && Number.isFinite(Date.parse(value));
const isBudget = (value) => typeof value === "number" && Number.isFinite(value) && value > 0;
const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const over = (elapsed, budget) => (elapsed > budget ? " OVER" : "");

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

function sessionLine() {
  const session = readJson(join(project, ".private/work/factory/session.json"));
  if (!isObject(session) || !isTime(session.started_utc) || !isBudget(session.budget_minutes)) return null;
  const budget = Math.round(session.budget_minutes);
  const elapsed = minutesSince(session.started_utc);
  let text = `session ${hm(elapsed)}/${hm(budget)}${over(elapsed, budget)}`;
  const started = (Array.isArray(session.phases) ? session.phases : []).filter(
    (phase) => isObject(phase) && typeof phase.name === "string" && /^[\w.-]{1,40}$/.test(phase.name) && isBudget(phase.minutes) && isTime(phase.start_utc),
  );
  const current = started.sort((a, b) => Date.parse(b.start_utc) - Date.parse(a.start_utc))[0];
  if (current) {
    const phaseBudget = Math.round(current.minutes);
    const phaseElapsed = minutesSince(current.start_utc);
    text += ` · phase ${current.name} ${hm(phaseElapsed)}/${hm(phaseBudget)}${over(phaseElapsed, phaseBudget)}`;
  }
  return text;
}

/** The builder's own record: the one whose ticket names a part of the branch, else the newest by mtime. */
function ticketLine() {
  const common = git("rev-parse", "--git-common-dir");
  if (common === null) return null;
  const folder = join(resolve(project, common), "vextrus");
  let records;
  try {
    records = readdirSync(folder)
      .filter((name) => /^budget-[\w.-]+\.json$/.test(name))
      .map((name) => ({ record: readJson(join(folder, name)), mtime: statSync(join(folder, name)).mtimeMs }))
      .filter(({ record }) => isObject(record) && typeof record.ticket === "string" && /^[\w.-]{1,40}$/.test(record.ticket))
      .filter(({ record }) => isBudget(record.minutes) && isTime(record.started_utc));
  } catch {
    return null;
  }
  if (records.length === 0) return null;
  const parts = (git("branch", "--show-current") ?? "").split(/[-/]/);
  records.sort((a, b) => b.mtime - a.mtime || Date.parse(b.record.started_utc) - Date.parse(a.record.started_utc));
  const { record } = records.find(({ record }) => parts.includes(record.ticket)) ?? records[0];
  const budget = Math.round(record.minutes);
  const elapsed = minutesSince(record.started_utc);
  return `ticket ${record.ticket} ${elapsed}/${budget} min${over(elapsed, budget)}`;
}

let budget = null;
try {
  if (project !== "") budget = mainCheckout() ? sessionLine() : ticketLine();
} catch {
  budget = null;
}
process.stdout.write(`now ${stamp(now)} · ${budget ?? "no budget set"}\n`);
