// Ticket f2, A1: an empty CLAUDE_PROJECT_DIR is not the main checkout (spec 3.6; build notes: "`||` instead
// of `??` for CLAUDE_PROJECT_DIR in guard.mjs and state.mjs; the key-user lines are refused when it is empty").
// Today `??` keeps "", which resolves to the process's cwd, so a session started in the main checkout with an
// empty project dir is taken for the orchestrator and may run the poster.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync, chmodSync } from "node:fs";
import { join } from "node:path";
import { REAL_MAIN, STATE, gitEnv, git, judge, tempDir, tempRepo } from "./_guard.mjs";

const POSTER = "sudo -n -u vxkeys /usr/local/lib/vextrus/post-status real-drawings 20260929T101500Z-0123456789ab-beef";
const SCORER = "sudo -n -u vxkeys /usr/local/bin/vx-score run-1";

test("an empty CLAUDE_PROJECT_DIR in the main checkout's cwd does not make the poster lawful", (t) => {
  if (existsSync(REAL_MAIN)) {
    // The guard's own default main checkout, with the child running inside it.
    const verdict = judge({ input: { command: POSTER }, project: "", cwd: REAL_MAIN, childCwd: REAL_MAIN, main: null });
    assert.equal(verdict?.rule, "PRIVILEGE_RAISED");
  } else {
    t.diagnostic(`${REAL_MAIN} does not exist here (CI): the seam case below carries this promise`);
  }
  const main = tempRepo().repo;
  const seam = judge({ input: { command: POSTER }, project: "", cwd: main, childCwd: main, main });
  assert.equal(seam?.rule, "PRIVILEGE_RAISED");
});

test("with VEXTRUS_MAIN_CHECKOUT naming the cwd, an empty project dir refuses the poster and the scorer", () => {
  const main = tempRepo().repo;
  for (const command of [POSTER, SCORER]) {
    assert.equal(judge({ input: { command }, project: "", cwd: main, childCwd: main, main })?.rule, "PRIVILEGE_RAISED", command);
  }
});

test("an empty project dir from a temporary cwd refuses the poster", () => {
  const elsewhere = tempDir();
  assert.equal(judge({ input: { command: POSTER }, project: "", cwd: elsewhere, childCwd: elsewhere })?.rule, "PRIVILEGE_RAISED");
});

test("an unset project dir from a temporary cwd refuses the poster", () => {
  const elsewhere = tempDir();
  assert.equal(judge({ input: { command: POSTER }, project: undefined, cwd: elsewhere, childCwd: elsewhere })?.rule, "PRIVILEGE_RAISED");
});

test("the main checkout as the project still runs the poster (no over-blocking)", () => {
  const main = tempRepo().repo;
  assert.equal(judge({ input: { command: POSTER }, project: main, cwd: main, main }), null);
});

test("state.mjs with an empty CLAUDE_PROJECT_DIR reports its own checkout, not the cwd's", () => {
  // A cwd repository on a branch whose name appears nowhere else.
  const { repo } = tempRepo({ branch: "zz-cwd-not-the-project" });
  // A stub `gh` first on PATH: state.mjs asks gh for the PR, and a test never reaches the network.
  const bin = tempDir("f2-bin-");
  mkdirSync(bin, { recursive: true });
  writeFileSync(join(bin, "gh"), "#!/bin/sh\nexit 1\n");
  chmodSync(join(bin, "gh"), 0o755);
  const env = gitEnv({ CLAUDE_PROJECT_DIR: "", PATH: `${bin}:${process.env.PATH}` });
  delete env.CLAUDE_CODE_REMOTE;
  const run = spawnSync(process.execPath, [STATE], { cwd: repo, env, encoding: "utf8" });
  assert.equal(run.status, 0, run.stderr);
  assert.doesNotMatch(run.stdout, /zz-cwd-not-the-project/);
  const own = git(join(STATE, "..", "..", ".."), "branch", "--show-current");
  assert.match(run.stdout, new RegExp(`git: ${own.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")} @ `));
});
