// Extra (ticket f6, review round 1): walk-gate runs `scripts.walk.ready` with the project's own interpreter
// (`.venv/bin/python`, the venv `uv sync` made) when it exists, not the system's python3; VEXTRUS_PYTHON still wins.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const HOOK = fileURLToPath(new URL("./walk-gate.mjs", import.meta.url));
const GIT_ENV = { GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" };

function fakePython(file, marker, exit) {
  writeFileSync(file, `#!/bin/sh\necho "$@" >> ${JSON.stringify(marker)}\nexit ${exit}\n`);
  chmodSync(file, 0o755);
}

/** A main checkout with scripts/walk/ready.py (never run here) and a fake .venv/bin/python exiting `exit`. */
function project(exit) {
  const dir = mkdtempSync(join(tmpdir(), "f6-walk-extra-"));
  spawnSync("git", ["init", "-q", "-b", "main"], { cwd: dir, env: { ...process.env, ...GIT_ENV } });
  mkdirSync(join(dir, "scripts/walk"), { recursive: true });
  writeFileSync(join(dir, "scripts/walk/ready.py"), "raise SystemExit(1)\n");
  mkdirSync(join(dir, ".venv/bin"), { recursive: true });
  fakePython(join(dir, ".venv/bin/python"), join(dir, "venv.marker"), exit);
  return dir;
}

function stop(dir, env = {}, message = "walk now") {
  const base = { ...process.env, ...GIT_ENV, CLAUDE_PROJECT_DIR: dir, ...env };
  for (const name of ["CLAUDE_CODE_REMOTE", "VEXTRUS_ROLE", "VEXTRUS_PYTHON"]) if (!(name in env)) delete base[name];
  const input = JSON.stringify({ hook_event_name: "Stop", stop_hook_active: false, last_assistant_message: message });
  const done = spawnSync(process.execPath, [HOOK], { cwd: dir, input, env: base, encoding: "utf8", timeout: 20_000 });
  assert.equal(done.status, 0, done.stderr);
  return done.stdout.trim() === "" ? "allowed" : JSON.parse(done.stdout);
}

test("the project's .venv/bin/python runs ready, as a module with origin/main", () => {
  const passing = project(0);
  assert.equal(stop(passing), "allowed");
  assert.equal(readFileSync(join(passing, "venv.marker"), "utf8").trim(), "-m scripts.walk.ready origin/main");
  assert.equal(stop(project(1)).decision, "block");
});

test("VEXTRUS_PYTHON outranks the venv", () => {
  const dir = project(1);
  const bin = mkdtempSync(join(tmpdir(), "f6-walk-extra-py-"));
  fakePython(join(bin, "python"), join(bin, "marker"), 0);
  assert.equal(stop(dir, { VEXTRUS_PYTHON: join(bin, "python") }), "allowed");
  assert.ok(!existsSync(join(dir, "venv.marker")), "the venv was not used");
});

// Extra (ticket T-HOOKS): the reason quotes the first whole-word match as written, beside ready.py's exit.
test("the reason quotes the match as written and names ready.py's exit", () => {
  const { decision, reason } = stop(project(3), {}, "Done; it is Ready For Your Walk, then please walk it.");
  assert.equal(decision, "block");
  assert.ok(reason.includes('("Ready For Your Walk")'), reason);
  assert.ok(reason.includes("exited 3"), reason);
});

test("a phrase run into a word does not match", () => {
  for (const message of ["walk_now", "awalk now", "sidewalk now", "Walk nowhere near it.", "Please walked back the claim."]) {
    assert.equal(stop(project(1), {}, message), "allowed", message);
  }
});

// Fix round 1 (PR #360, finding 75): the match fails toward blocking. Only a letter before the phrase frees it, so
// markdown emphasis (`_`, `*`) still blocks; after it, only the pinned false matches ("nowhere", "walked") are freed,
// so "walkthrough" and "walking" still block.
for (const [message, quoted] of [
  ["The build is ready for your walkthrough.", "ready for your walk"],
  ["Please walkthrough the screens.", "Please walk"],
  ["You can _walk now_", "walk now"],
  ["__Please walk__ the Priced BOQ", "Please walk"],
  ["**Walk now**, the head is green.", "Walk now"],
  ["please walking it through", "please walk"],
]) {
  test(`a walk request blocks on a failing G1: ${JSON.stringify(message)}`, () => {
    const answer = stop(project(1), {}, message);
    assert.equal(answer.decision, "block", message);
    assert.ok(answer.reason.includes(`("${quoted}")`), answer.reason);
  });
}
