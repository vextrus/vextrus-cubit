// Extra (ticket f6, builder's): only a Stop or SubagentStop hook may block. Every hook registered on SessionStart,
// UserPromptSubmit or PreCompact is run here on hostile input (garbage stdin, a missing project, a cloud and a main
// project) and must exit 0 without a `decision`, `continue` or `permissionDecision` on stdout. Exit 2 would block a
// prompt or a compaction; a JSON decision would too.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = fileURLToPath(new URL("../../", import.meta.url));
const settings = JSON.parse(readFileSync(join(REPO, ".claude/settings.json"), "utf8"));
const NON_BLOCKING = ["SessionStart", "UserPromptSubmit", "PreCompact", "StopFailure"];
const BLOCKING = ["Stop", "SubagentStop"];

/** [event, file, extra args] for every node hook on the given events. */
function hooksOn(events) {
  const found = [];
  for (const event of events) {
    for (const group of settings.hooks[event] ?? []) {
      for (const hook of group.hooks ?? []) {
        const match = /^node "\$CLAUDE_PROJECT_DIR"\/\.claude\/hooks\/([\w.-]+\.mjs)((?: \w+)*)$/.exec(hook.command);
        if (match) found.push([event, match[1], match[2].trim().split(" ").filter(Boolean)]);
      }
    }
  }
  return found;
}

function scratchRepo() {
  const dir = mkdtempSync(join(tmpdir(), "f6-extra-"));
  spawnSync("git", ["init", "-q", "-b", "main"], { cwd: dir, env: { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null" } });
  return dir;
}

const STDINS = ["", "not json", "[]", "null", JSON.stringify({ hook_event_name: "SessionStart", source: "compact", prompt: "walk now" })];

test("every SessionStart, UserPromptSubmit and PreCompact hook exits 0 and never prints a decision", () => {
  const hooks = hooksOn(NON_BLOCKING);
  assert.ok(hooks.length >= 5, `found ${hooks.length} hooks`);
  const projects = [undefined, "", scratchRepo()];
  for (const [event, file, args] of hooks) {
    if (file === "state.mjs") continue; // Pre-f6, prints the checkout's state; not f6's.
    for (const project of projects) {
      for (const remote of [undefined, "true"]) {
        for (const stdin of STDINS) {
          const env = { ...process.env, CLAUDE_PROJECT_DIR: project, VEXTRUS_PYTHON: "/nonexistent/python" };
          if (project === undefined) delete env.CLAUDE_PROJECT_DIR;
          if (remote === undefined) delete env.CLAUDE_CODE_REMOTE;
          else env.CLAUDE_CODE_REMOTE = remote;
          const done = spawnSync(process.execPath, [join(REPO, ".claude/hooks", file), ...args], {
            cwd: tmpdir(),
            input: stdin,
            env,
            encoding: "utf8",
            timeout: 15_000,
          });
          const where = `${event} ${file} ${args.join(" ")} project=${JSON.stringify(project)} remote=${remote} stdin=${JSON.stringify(stdin)}`;
          assert.equal(done.status, 0, `${where}: exit ${done.status} ${done.stderr}`);
          assert.doesNotMatch(done.stdout, /"(?:decision|continue|permissionDecision)"\s*:/, `${where}: ${done.stdout}`);
        }
      }
    }
  }
});

test("Stop and SubagentStop hooks exit 0 on garbage, never 2 (a block is a JSON decision only)", () => {
  const hooks = hooksOn(BLOCKING);
  assert.ok(hooks.length >= 3, `found ${hooks.length} hooks`);
  for (const [event, file] of hooks) {
    for (const stdin of ["", "not json", "[]", "null"]) {
      const done = spawnSync(process.execPath, [join(REPO, ".claude/hooks", file)], {
        cwd: tmpdir(),
        input: stdin,
        env: { ...process.env, CLAUDE_PROJECT_DIR: scratchRepo(), CLAUDE_CODE_REMOTE: "true" },
        encoding: "utf8",
        timeout: 15_000,
      });
      assert.equal(done.status, 0, `${event} ${file} stdin=${JSON.stringify(stdin)}: exit ${done.status}`);
      assert.equal(done.stdout.trim(), "", `${event} ${file} stdin=${JSON.stringify(stdin)}: ${done.stdout}`);
    }
  }
});
