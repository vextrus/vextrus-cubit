// Acceptance (ticket f6, tier 1): the hooks' registration in `.claude/settings.json`. docs/specs/factory.md §3.5:
// f6 owns the `hooks` block (f2 owns `permissions`); the guard stays the only PreToolUse hook, with its literal
// entry (the one `tools/lint/hook_paths.py` pins); a missing or mistyped hook path silently disables a gate, so
// every registered file must exist; a timed-out command hook fails open, so each new hook is a short command.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = fileURLToPath(new URL("../../../../", import.meta.url));
const settings = () => JSON.parse(readFileSync(join(REPO, ".claude/settings.json"), "utf8"));
const node = (file) => `node "$CLAUDE_PROJECT_DIR"/.claude/hooks/${file}`;
const MAIN_START = "startup|resume|clear|compact";

const GUARD = { type: "command", command: node("guard.mjs"), timeout: 10 };
const STATE = { type: "command", command: node("state.mjs"), timeout: 20 };
const CLOUD_START = { type: "command", command: 'bash "$CLAUDE_PROJECT_DIR"/scripts/cloud/session-start.sh', timeout: 120 };
const AFTER_BASH = { type: "command", command: node("after-bash.mjs"), timeout: 40 };
const EXISTING = [GUARD, STATE, CLOUD_START, AFTER_BASH].map((hook) => hook.command);

/** Every (event, group matcher, hook) registered. */
function registrations() {
  const found = [];
  for (const [event, groups] of Object.entries(settings().hooks ?? {})) {
    for (const group of groups) {
      for (const hook of group.hooks ?? []) found.push({ event, matcher: group.matcher, hook });
    }
  }
  return found;
}

const unmatched = (matcher) => matcher === undefined || matcher === "" || matcher === "*";
const covers = (matcher, source) => String(matcher ?? "").split("|").includes(source);

function registered(event, command, matcherOk) {
  return registrations().filter((r) => r.event === event && r.hook.command === command && matcherOk(r.matcher));
}

test("the guard is the only PreToolUse hook, with its literal entry", () => {
  assert.deepEqual(settings().hooks.PreToolUse, [{ matcher: "Bash|Edit|Write|NotebookEdit", hooks: [GUARD] }]);
});

test("the existing SessionStart and PostToolUse registrations are intact", () => {
  const groups = settings().hooks.SessionStart.filter((group) => group.matcher === MAIN_START);
  const hooks = groups.flatMap((group) => group.hooks);
  assert.deepEqual(
    hooks.find((hook) => hook.command === STATE.command),
    STATE,
  );
  assert.deepEqual(
    hooks.find((hook) => hook.command === CLOUD_START.command),
    CLOUD_START,
  );
  assert.deepEqual(settings().hooks.PostToolUse, [{ matcher: "Bash", hooks: [AFTER_BASH] }]);
});

test("the clock is registered on UserPromptSubmit (no matcher, timeout at most 10)", () => {
  const found = registered("UserPromptSubmit", node("clock.mjs"), unmatched);
  assert.equal(found.length, 1, "one UserPromptSubmit clock entry");
  assert.ok(typeof found[0].hook.timeout === "number" && found[0].hook.timeout <= 10, `timeout ${found[0].hook.timeout}`);
});

test("the clock and the watcher restart are registered on SessionStart for startup|resume|clear|compact", () => {
  assert.equal(registered("SessionStart", node("clock.mjs"), (m) => m === MAIN_START).length, 1);
  assert.equal(registered("SessionStart", node("watch-start.mjs"), (m) => m === MAIN_START).length, 1);
});

test("every other new hook that exists is registered on its event", () => {
  const exists = (file) => existsSync(join(REPO, ".claude/hooks", file));
  if (exists("stop-gate.mjs")) assert.equal(registered("Stop", node("stop-gate.mjs"), unmatched).length, 1, "stop-gate on Stop");
  if (exists("walk-gate.mjs")) assert.equal(registered("Stop", node("walk-gate.mjs"), unmatched).length, 1, "walk-gate on Stop");
  if (exists("verdict-gate.mjs")) {
    assert.equal(registered("SubagentStop", node("verdict-gate.mjs"), unmatched).length, 1, "verdict-gate on SubagentStop, empty matcher");
  }
  if (exists("precompact.mjs")) {
    assert.equal(registered("PreCompact", node("precompact.mjs"), (m) => m === "manual|auto").length, 1, "precompact on PreCompact manual|auto");
    assert.equal(
      registered("SessionStart", `${node("precompact.mjs")} restore`, (m) => m === "compact").length,
      1,
      "precompact restore on SessionStart compact",
    );
  }
  if (exists("selftest.mjs")) {
    assert.equal(registered("SessionStart", node("selftest.mjs"), (m) => covers(m, "startup")).length, 1, "selftest on SessionStart");
  }
});

test("every hook is a command running an existing file; each new one has a numeric timeout of at most 15", () => {
  for (const { event, hook } of registrations()) {
    assert.equal(hook.type, "command", `${event}: ${JSON.stringify(hook)} is not a command hook`);
    assert.ok(!("async" in hook), `${event}: ${hook.command} is async`);
    if (hook.command === CLOUD_START.command) continue;
    const match = /^node "\$CLAUDE_PROJECT_DIR"\/\.claude\/hooks\/([A-Za-z0-9._-]+\.mjs)( restore)?$/.exec(hook.command);
    assert.ok(match, `${event}: ${hook.command} does not run node "$CLAUDE_PROJECT_DIR"/.claude/hooks/<file>`);
    assert.ok(existsSync(join(REPO, ".claude/hooks", match[1])), `${event}: ${match[1]} does not exist`);
    if (EXISTING.includes(hook.command)) continue;
    assert.ok(typeof hook.timeout === "number" && hook.timeout > 0 && hook.timeout <= 15, `${event}: ${hook.command} timeout ${hook.timeout}`);
  }
});

test("hooks register only on the events the spec names", () => {
  const allowed = ["SessionStart", "PreToolUse", "PostToolUse", "UserPromptSubmit", "Stop", "SubagentStop", "PreCompact", "StopFailure"];
  for (const event of Object.keys(settings().hooks)) assert.ok(allowed.includes(event), `unexpected hook event ${event}`);
});

test("no new hook registers on PreToolUse, so none can allow or deny a tool", () => {
  for (const { event, hook } of registrations()) {
    if (event === "PreToolUse") assert.equal(hook.command, GUARD.command);
  }
});

test("the permissions block is still present (f2 owns it; this test does not read into it)", () => {
  const block = settings().permissions;
  assert.ok(block !== null && typeof block === "object" && !Array.isArray(block));
});
