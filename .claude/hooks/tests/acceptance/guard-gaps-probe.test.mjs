// Ticket f2, A9: spec 3.6, "Every `ALLOWED` line of the probe becomes a refused case." The 27 lines the
// guard probe let through (ticket f2 section 8, verbatim in guard-gaps-probe.json) are each refused by a named
// rule; the 5 controls refused before stay refused. Run as a local builder: the project is a worktree, not
// the main checkout, and not a cloud session. Today 27 of the 32 are allowed.
// The commands are test inputs only; nothing here runs them.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ruleOf, tempRepo } from "./_guard.mjs";

const probe = JSON.parse(readFileSync(new URL("./guard-gaps-probe.json", import.meta.url), "utf8"));
const { repo: main } = tempRepo();
const { repo: worktree } = tempRepo({ branch: "s12-fx-builder" });
const asBuilder = (command) => ruleOf({ input: { command }, project: worktree, cwd: worktree, main });

test("the probe holds the 27 allowed lines and the 5 controls", () => {
  assert.equal(probe.allowed.length, 27);
  assert.equal(probe.controls.length, 5);
});

for (const command of probe.allowed) {
  test(`a probe line the guard let through is refused: ${command}`, () => {
    const rule = asBuilder(command);
    assert.notEqual(rule, null);
    assert.match(rule, /^[A-Z_]+$/);
  });
}

for (const command of probe.controls) {
  test(`a control stays refused: ${command}`, () => {
    assert.notEqual(asBuilder(command), null);
  });
}
