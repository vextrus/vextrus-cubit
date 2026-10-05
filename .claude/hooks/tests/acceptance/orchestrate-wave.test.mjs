// Acceptance (ticket f6, tier 1; finish line 6's obligation): orchestrate-wave's cloud launch. docs/specs/factory.md
// §3.4: "line 49's launch becomes `scripts.factory.launch cloud`, and account B goes"; this lands even if the
// skill's full rewrite is cut. `states.py` stays.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = fileURLToPath(new URL("../../../../", import.meta.url));
const SKILL = join(REPO, ".claude/skills/orchestrate-wave");
const text = () => readFileSync(join(SKILL, "SKILL.md"), "utf8");

test("the cloud launch goes through scripts.factory.launch cloud", () => {
  assert.match(text(), /scripts\.factory\.launch cloud/);
});

test("account B is gone", () => {
  for (const phrase of ["claude-b", "Cloud (account B)", "CLAUDE_CONFIG_DIR=~/.claude-b"]) {
    assert.ok(!text().includes(phrase), `SKILL.md still says ${phrase}`);
  }
});

test("no bare claude --cloud: every --cloud mention sits on the launcher's own line", () => {
  for (const line of text().split("\n")) {
    if (line.includes("--cloud")) assert.match(line, /scripts\.factory\.launch/, `a bare --cloud: ${line}`);
    assert.doesNotMatch(line, /\bclaude\s+--cloud\b/, `a bare claude --cloud: ${line}`);
  }
});

test("no pgrep or ps | grep waits", () => {
  assert.doesNotMatch(text(), /\bpgrep\b/);
  assert.doesNotMatch(text(), /\bps\b[^\n|]*\|\s*grep\b/);
});

test("the frontmatter keeps its name and description", () => {
  const match = /^---\n([\s\S]*?)\n---\n/.exec(text());
  assert.ok(match, "frontmatter");
  assert.match(match[1], /^name: orchestrate-wave$/m);
  assert.match(match[1], /^description: \S.*$/m);
});

test("states.py stays", () => {
  assert.ok(existsSync(join(SKILL, "states.py")));
});
