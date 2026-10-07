// Extra (ticket f6, builder's): local builders share one git folder, so several budget records sit side by side.
// The clock prefers the record whose ticket names a part of the branch (`s12-f6-…` -> f6) over a newer one, and
// shows a phase's overrun like the session's.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const HOOK = fileURLToPath(new URL("./clock.mjs", import.meta.url));
const GIT_ENV = { GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" };

function clock(dir, env = {}) {
  const base = { ...process.env, ...GIT_ENV, CLAUDE_PROJECT_DIR: dir, VEXTRUS_NOW_UTC: "2026-10-04T22:42:00Z", ...env };
  delete base.VEXTRUS_ROLE;
  if (!("CLAUDE_CODE_REMOTE" in env)) delete base.CLAUDE_CODE_REMOTE;
  const done = spawnSync(process.execPath, [HOOK], { input: "{}", env: base, encoding: "utf8" });
  assert.equal(done.status, 0, done.stderr);
  return done.stdout.trim();
}

function repo(branch) {
  const dir = mkdtempSync(join(tmpdir(), "f6-clock-extra-"));
  spawnSync("git", ["init", "-q", "-b", branch], { cwd: dir, env: { ...process.env, ...GIT_ENV } });
  return dir;
}

function record(dir, ticket, minutes, started, mtime) {
  mkdirSync(join(dir, ".git/vextrus"), { recursive: true });
  const file = join(dir, ".git/vextrus", `budget-${ticket}.json`);
  writeFileSync(file, JSON.stringify({ schema: 1, ticket, minutes, started_utc: started }));
  utimesSync(file, new Date(mtime), new Date(mtime));
}

test("the record whose ticket is part of the branch wins over a newer one", () => {
  const dir = repo("s12-f6-session-hooks");
  record(dir, "f6", 150, "2026-10-04T21:30:00Z", "2026-10-04T21:30:00Z");
  record(dir, "f3", 120, "2026-10-04T22:00:00Z", "2026-10-04T22:00:00Z");
  assert.equal(clock(dir, { CLAUDE_CODE_REMOTE: "true" }), "now 2026-10-04 22:42Z · ticket f6 72/150 min");
});

test("no branch match: the newest record", () => {
  const dir = repo("some-branch");
  record(dir, "f6", 150, "2026-10-04T21:30:00Z", "2026-10-04T21:30:00Z");
  record(dir, "f3", 30, "2026-10-04T22:00:00Z", "2026-10-04T22:00:00Z");
  assert.equal(clock(dir, { CLAUDE_CODE_REMOTE: "true" }), "now 2026-10-04 22:42Z · ticket f3 42/30 min OVER");
});

test("a phase past its budget says OVER too", () => {
  const dir = repo("main");
  mkdirSync(join(dir, ".private/work/factory"), { recursive: true });
  writeFileSync(
    join(dir, ".private/work/factory/session.json"),
    JSON.stringify({ schema: 1, started_utc: "2026-10-04T21:08:00Z", budget_minutes: 660, phases: [{ name: "writers", minutes: 30, start_utc: "2026-10-04T21:10:00Z" }] }),
  );
  assert.equal(clock(dir), "now 2026-10-04 22:42Z · session 1:34/11:00 · phase writers 1:32/0:30 OVER");
});

test("a session closed by `stamp end` (an ended_utc time) reads as no budget set", () => {
  const dir = repo("main");
  mkdirSync(join(dir, ".private/work/factory"), { recursive: true });
  writeFileSync(
    join(dir, ".private/work/factory/session.json"),
    JSON.stringify({ schema: 1, started_utc: "2026-10-04T21:08:00Z", budget_minutes: 660, phases: [], ended_utc: "2026-10-04T22:40:00Z" }),
  );
  assert.equal(clock(dir), "now 2026-10-04 22:42Z · no budget set");
});
