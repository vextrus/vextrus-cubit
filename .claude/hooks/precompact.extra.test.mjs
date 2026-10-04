// Extra (ticket f6, review round 1): "open review rounds" lists only each PR's newest ledger record, so a later
// PASS closes an earlier FIX, and a later FIX reopens an earlier PASS.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const HOOK = fileURLToPath(new URL("./precompact.mjs", import.meta.url));
const FACTORY = ".private/work/factory";

function record(dir, pr, head, round, verdict, recorded_at) {
  const body = { schema_version: 1, pr, head: head.repeat(40), round, verdict, recorded_at };
  writeFileSync(join(dir, FACTORY, "ledger", `${pr}-${head.repeat(40)}.json`), JSON.stringify(body));
}

function openRounds(setup) {
  const dir = mkdtempSync(join(tmpdir(), "f6-precompact-extra-"));
  spawnSync("git", ["init", "-q", "-b", "main"], { cwd: dir, env: { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null" } });
  mkdirSync(join(dir, FACTORY, "ledger"), { recursive: true });
  setup(dir);
  const env = { ...process.env, CLAUDE_PROJECT_DIR: dir, VEXTRUS_NOW_UTC: "2026-10-04T22:42:00Z" };
  const done = spawnSync(process.execPath, [HOOK], { input: "{}", env, encoding: "utf8" });
  assert.equal(done.status, 0, done.stderr);
  const [name] = readdirSync(join(dir, FACTORY)).filter((file) => file.startsWith("precompact-"));
  const text = readFileSync(join(dir, FACTORY, name), "utf8");
  return text.split("## Open review rounds")[1].split("##")[0];
}

test("a later PASS closes the PR's earlier FIX round, whatever the file names' order", () => {
  const rounds = openRounds((dir) => {
    record(dir, 4711, "f", 1, "FIX", "2026-10-04T21:00:00Z");
    record(dir, 4711, "a", 2, "PASS", "2026-10-04T22:00:00Z");
  });
  assert.doesNotMatch(rounds, /4711/);
  assert.match(rounds, /- none/);
});

test("a later FIX reopens the PR, and only the newest record is listed", () => {
  const rounds = openRounds((dir) => {
    record(dir, 4712, "a", 1, "PASS", "2026-10-04T21:00:00Z");
    record(dir, 4712, "b", 2, "FIX", "2026-10-04T22:00:00Z");
    record(dir, 4713, "c", 1, "BLOCK", "2026-10-04T21:30:00Z");
  });
  assert.equal((rounds.match(/#4712/g) ?? []).length, 1);
  assert.match(rounds, /#4712 at bbbbbbb: round 2, FIX/);
  assert.match(rounds, /#4713 at ccccccc: round 1, BLOCK/);
});
