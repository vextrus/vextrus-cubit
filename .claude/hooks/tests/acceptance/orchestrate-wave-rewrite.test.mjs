// Acceptance (ticket f6, tier 2): orchestrate-wave rewritten as the orchestrator's runbook. docs/specs/factory.md
// §3.4: "rewritten as the orchestrator's runbook around §2.2's commands: governor → writers → launch → watch →
// `/review-pr` → land → G1 → measures; budgets; when to ask the owner; the G1 rule. About half its length.
// `states.py` stays."
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = fileURLToPath(new URL("../../../../", import.meta.url));
const SKILL = join(REPO, ".claude/skills/orchestrate-wave");
const text = () => readFileSync(join(SKILL, "SKILL.md"), "utf8");
/** The text after the frontmatter. */
const body = () => text().replace(/^---\n[\s\S]*?\n---\n/, "");
const paragraphs = () => body().split(/\n\s*\n/);

test("at most 80 lines", () => {
  const lines = text().replace(/\n$/, "").split("\n").length;
  assert.ok(lines <= 80, `${lines} lines`);
});

test("names each runbook step, in order", () => {
  const steps = [
    ["the governor (preflight)", /governor|preflight/i],
    ["acceptance writers", /acceptance[- ]writer/i],
    ["the cloud launch", /scripts\.factory\.launch cloud/],
    ["the local launch", /launch local/],
    ["watching", /event log|events\.log|\bMonitor\b/i],
    ["/review-pr", /\/review-pr\b/],
    ["landing", /scripts\.land\b|land\.py/],
    ["the G1 walk", /\bG1\b/],
    ["measures", /measure/i],
  ];
  const all = body();
  let from = 0;
  let afterWriters = 0;
  for (const [name, pattern] of steps) {
    // The two launches may come in either order, both after the writers.
    const start = name === "the local launch" ? afterWriters : from;
    const found = all.slice(start).search(pattern);
    assert.ok(found >= 0, `${name} is not named after the previous step`);
    const at = start + found;
    if (name === "acceptance writers") afterWriters = at;
    from = Math.max(from, at);
  }
});

test("watching is through the event log with Monitor, not polling", () => {
  assert.match(body(), /event log|events\.log/i);
  assert.match(body(), /\bMonitor\b/);
});

test("states the G1 rule: walk now only with a passing G1", () => {
  assert.ok(
    paragraphs().some((p) => /walk now/i.test(p) && /\bG1\b/.test(p)),
    'no paragraph ties "walk now" to G1',
  );
});

test("states the two-round review cap", () => {
  assert.match(body(), /\b(?:two|2)\b[^.\n]{0,30}\brounds?\b|\btwo-round\b/i);
});

test("states the budget rule: cut scope and say what", () => {
  assert.match(body(), /cut scope/i);
});

test("states when to ask the owner: product, scope, spending, anything irreversible", () => {
  assert.ok(
    paragraphs().some((p) => /owner/i.test(p) && /product/i.test(p) && /scope/i.test(p) && /spending/i.test(p) && /irreversible/i.test(p)),
    "no paragraph names the owner's decisions",
  );
});

test("no account B, no pgrep, no foreground sleep loop", () => {
  assert.doesNotMatch(text(), /claude-b/);
  assert.doesNotMatch(text(), /account B/i);
  assert.doesNotMatch(text(), /\bpgrep\b/);
  assert.doesNotMatch(text(), /\bsleep\s+\d/);
  assert.doesNotMatch(text(), /\b(?:while|until)\b[^\n]*\bsleep\b/);
});

test("states.py still exists and is still referenced", () => {
  assert.ok(existsSync(join(SKILL, "states.py")));
  assert.match(text(), /states\.py/);
});
