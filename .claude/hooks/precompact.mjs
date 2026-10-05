#!/usr/bin/env node
// PreCompact (manual|auto): write what a compaction must not lose (branch, head, budgets, open review rounds, the
// last STATE lines) to `.private/work/factory/precompact-<utc>.md`. With `restore` (SessionStart `compact`): print the
// newest dump back into the fresh context, at most 8000 characters. It writes only where `.private/work/factory/`
// already exists (never in a cloud clone), reads nothing else under `.private/` but the ledger and session.json's state
// file (absolute, as `stamp start` records it, or relative to the project; its real path must lie under the project's
// `.private/work/`), never blocks and always exits 0. `VEXTRUS_NOW_UTC` stands in for the wall clock in tests.
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { isAbsolute, join, relative, resolve, sep } from "node:path";

const project = process.env.CLAUDE_PROJECT_DIR || "";
const factory = join(project, ".private/work/factory");
const DUMP = /^precompact-\d{8}T\d{4,6}Z\.md$/;
const CAP = 8000;
const now = (() => {
  const injected = Date.parse(process.env.VEXTRUS_NOW_UTC ?? "");
  return Number.isFinite(injected) ? new Date(injected) : new Date();
})();

const attempt = (read, fallback = null) => {
  try {
    return read();
  } catch {
    return fallback;
  }
};
const git = (...args) => {
  const done = spawnSync("git", ["-C", project, ...args], { encoding: "utf8", timeout: 3_000 });
  return done.status === 0 ? done.stdout.trim() : null;
};
const readJson = (path) => attempt(() => JSON.parse(readFileSync(path, "utf8")));
const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const isTime = (value) => typeof value === "string" && Number.isFinite(Date.parse(value));
const isBudget = (value) => typeof value === "number" && Number.isFinite(value) && value > 0;
const minutesSince = (iso) => Math.max(0, Math.floor((now.getTime() - Date.parse(iso)) / 60_000));
const hm = (minutes) => `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}`;

function budgetLines(session) {
  if (!isObject(session) || !isTime(session.started_utc) || !isBudget(session.budget_minutes)) return ["- budget: none set"];
  const lines = [`- session: started ${session.started_utc}, ${hm(minutesSince(session.started_utc))}/${hm(Math.round(session.budget_minutes))}`];
  for (const phase of Array.isArray(session.phases) ? session.phases : []) {
    if (!isObject(phase) || typeof phase.name !== "string" || !isBudget(phase.minutes)) continue;
    const used = isTime(phase.start_utc) ? `started ${phase.start_utc}, ${hm(minutesSince(phase.start_utc))}` : "not started";
    lines.push(`- phase ${phase.name.slice(0, 40)}: ${used}/${hm(Math.round(phase.minutes))}`);
  }
  return lines;
}

function openRounds() {
  const folder = join(factory, "ledger");
  const names = attempt(() => readdirSync(folder).filter((name) => name.endsWith(".json")).sort(), []);
  // Only each PR's newest record counts (by recorded_at, then round): a later PASS closes an earlier FIX.
  const newest = new Map();
  const order = (record) => [isTime(record.recorded_at) ? Date.parse(record.recorded_at) : 0, Number.isInteger(record.round) ? record.round : 0];
  for (const name of names) {
    const record = readJson(join(folder, name));
    if (!isObject(record) || !Number.isInteger(record.pr) || typeof record.verdict !== "string") continue;
    const held = newest.get(record.pr);
    const [time, round] = order(record);
    if (held === undefined || time > order(held)[0] || (time === order(held)[0] && round >= order(held)[1])) newest.set(record.pr, record);
  }
  const open = [...newest.values()]
    .filter((record) => record.verdict !== "PASS")
    .map((record) => {
      const head = typeof record.head === "string" ? record.head.slice(0, 7) : "?";
      return `- #${record.pr} at ${head}: round ${record.round ?? "?"}, ${record.verdict.slice(0, 20)}`;
    });
  return open.length > 0 ? open : ["- none"];
}

/** True when `path`, relative to `base`, lies strictly inside it (segments compared, never a bare string prefix). */
const inside = (base, path) => {
  const rel = relative(base, path);
  return rel !== "" && !isAbsolute(rel) && rel.split(sep)[0] !== "..";
};

/** The last 20 lines of session.json's state file, which must lie under .private/work/, by its path and its real path. */
function stateLines(session) {
  if (!isObject(session) || typeof session.state_file !== "string" || session.state_file === "") return ["(no state file)"];
  const wanted = resolve(project, session.state_file);
  const realProject = attempt(() => realpathSync(project), resolve(project));
  const work = join(realProject, ".private", "work");
  // Re-base a path given through the project's own (possibly symlinked) path onto its real path.
  const checked = inside(resolve(project), wanted) ? join(realProject, relative(resolve(project), wanted)) : wanted;
  if (!inside(work, checked)) return ["(no state file)"];
  const real = attempt(() => realpathSync(checked));
  if (real === null) return ["(state file unreadable)"];
  if (!inside(work, real)) return ["(no state file)"];
  const text = attempt(() => readFileSync(real, "utf8"));
  if (text === null) return ["(state file unreadable)"];
  return text.replace(/\n$/, "").split("\n").slice(-20);
}

function dump() {
  if (project === "" || !existsSync(factory)) return;
  const session = readJson(join(factory, "session.json"));
  const stamp = now.toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
  const lines = [
    `# Before compaction, ${now.toISOString().slice(0, 16).replace("T", " ")}Z`,
    "",
    `- branch: ${git("branch", "--show-current") || "(detached)"}`,
    `- head: ${git("log", "-1", "--format=%h %s") ?? "?"}`,
    ...budgetLines(session),
    "",
    "## Open review rounds (ledger records not PASS)",
    ...openRounds(),
    "",
    "## Last STATE lines",
    ...stateLines(session),
  ];
  writeFileSync(join(factory, `precompact-${stamp}.md`), `${lines.join("\n")}\n`);
}

function restore() {
  if (project === "" || !existsSync(factory)) return;
  const newest = readdirSync(factory)
    .filter((name) => DUMP.test(name))
    .sort()
    .at(-1);
  if (newest === undefined) return;
  process.stdout.write(readFileSync(join(factory, newest), "utf8").slice(0, CAP));
}

try {
  if (process.argv[2] === "restore") restore();
  else dump();
} catch {
  // Never blocks, never fails a compaction.
}
