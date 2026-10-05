// The committed /review-pr workflow's Record stage runs `scripts.ledger record --from <file>` and the Jev
// shadow's `scripts.factory.jev triage --from <file>` in the main checkout. On its first real run (PR 338,
// 5 Oct 2026) both were refused by REVIEW_CODE_RUN, because the workflow wrote those files inside the review
// folder, so no ledger entry was recorded. This test builds both commands from the workflow's own templates
// and asserts the guard lets them through in the main checkout.
// The commands are test inputs only; nothing here runs them.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { judge, tempRepo } from "./acceptance/_guard.mjs";

const SOURCE = readFileSync(new URL("../../workflows/review-pr.js", import.meta.url), "utf8");
const VALUES = { pr: 5, head: "a".repeat(40), round: 1, slot: 1, exceptionFlags: "" };

/** The workflow's template literal that contains `needle`, filled with VALUES and the files it names. */
function command(needle) {
  const fill = (template, extra = {}) => {
    const scope = { ...VALUES, ...extra };
    return new Function(...Object.keys(scope), `return \`${template}\``)(...Object.values(scope));
  };
  const named = (name) => {
    const m = new RegExp(`const ${name} = \`([^\`]+)\``).exec(SOURCE);
    assert.ok(m, `review-pr.js defines ${name}`);
    return fill(m[1]);
  };
  const m = new RegExp(`\`([^\`]*${needle.replace(/\./g, "\\.")}[^\`]*)\``).exec(SOURCE);
  assert.ok(m, `review-pr.js runs ${needle}`);
  return fill(m[1], { decisionFile: named("decisionFile"), triageFile: named("triageFile") }).replace(/^Then run exactly: |^then run | and report its output\.$/g, "");
}

const { repo: main } = tempRepo({ files: { "docs/a.md": "a\n" } });

for (const needle of ["scripts.ledger record", "scripts.factory.jev triage"]) {
  test(`the guard lets /review-pr's ${needle} run in the main checkout`, () => {
    const run = command(needle);
    assert.match(run, /^uv run python -m /);
    const verdict = judge({ input: { command: run }, project: main, cwd: main, main });
    assert.equal(verdict, null, `${run}\nrefused: ${verdict?.reason}`);
  });
}

test("the workflow writes its verdict and triage files outside the review folder", () => {
  for (const name of ["decisionFile", "triageFile"]) {
    const m = new RegExp(`const ${name} = \`([^\`]+)\``).exec(SOURCE);
    assert.ok(m, `review-pr.js defines ${name}`);
    assert.doesNotMatch(m[1], /\.private\/work\/factory\/review\//);
  }
});
